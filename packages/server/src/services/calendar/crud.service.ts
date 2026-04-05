import { db } from '../../config/database';
import { accounts, calendars, calendarEvents } from '../../db/schema';
import { eq, and, gte, lte, sql, inArray, desc } from 'drizzle-orm';
import { logger } from '../../utils/logger';
import type { CalendarEventCreateInput, CalendarEventUpdateInput } from '@atlasmail/shared';
import { getCalendarClient, upsertEvent, syncCalendarEvents } from './sync.service';

// ─── Query helpers ───────────────────────────────────────────────────

export async function listCalendars(accountId: string) {
  return db
    .select()
    .from(calendars)
    .where(eq(calendars.accountId, accountId))
    .orderBy(desc(calendars.isPrimary), calendars.summary);
}

export async function listEvents(
  accountId: string,
  timeMin: string,
  timeMax: string,
  calendarIds?: string[],
) {
  const freeBusyCalIds = (
    await db
      .select({ id: calendars.id })
      .from(calendars)
      .where(and(eq(calendars.accountId, accountId), eq(calendars.accessRole, 'freeBusyReader')))
  ).map((c) => c.id);

  const conditions = [
    eq(calendarEvents.accountId, accountId),
    lte(calendarEvents.startTime, new Date(timeMax)),
    gte(calendarEvents.endTime, new Date(timeMin)),
  ];

  if (calendarIds && calendarIds.length > 0) {
    conditions.push(inArray(calendarEvents.calendarId, calendarIds));
  }

  const rows = await db
    .select()
    .from(calendarEvents)
    .where(and(...conditions))
    .orderBy(calendarEvents.startTime);

  if (freeBusyCalIds.length > 0) {
    const freeBusySet = new Set(freeBusyCalIds);
    return rows.filter((r) => !freeBusySet.has(r.calendarId));
  }

  return rows;
}

// ─── CRUD operations ─────────────────────────────────────────────────

export async function createEvent(accountId: string, input: CalendarEventCreateInput) {
  const [calRow] = await db
    .select()
    .from(calendars)
    .where(and(eq(calendars.id, input.calendarId), eq(calendars.accountId, accountId)))
    .limit(1);

  if (!calRow) throw new Error('Calendar not found');

  const cal = await getCalendarClient(accountId);
  const now = new Date();

  const eventResource: any = {
    summary: input.summary,
    description: input.description,
    location: input.location,
  };

  const tz = calRow.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  if (input.isAllDay) {
    eventResource.start = { date: input.startTime.slice(0, 10) };
    eventResource.end = { date: input.endTime.slice(0, 10) };
  } else {
    eventResource.start = { dateTime: input.startTime, timeZone: tz };
    eventResource.end = { dateTime: input.endTime, timeZone: tz };
  }

  if (input.attendees?.length) eventResource.attendees = input.attendees;
  if (input.colorId) eventResource.colorId = input.colorId;
  if (input.recurrence?.length) eventResource.recurrence = input.recurrence;
  if (input.transparency) eventResource.transparency = input.transparency;
  if (input.reminders) eventResource.reminders = input.reminders;

  const res = await cal.events.insert({
    calendarId: calRow.googleCalendarId,
    requestBody: eventResource,
  });

  const created = res.data;
  await upsertEvent(accountId, calRow.id, created, now);

  const [event] = await db
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.accountId, accountId),
        eq(calendarEvents.googleEventId, created.id!),
      ),
    )
    .limit(1);

  return event;
}

export async function updateEvent(
  accountId: string,
  eventId: string,
  input: CalendarEventUpdateInput,
) {
  const [existing] = await db
    .select()
    .from(calendarEvents)
    .where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.accountId, accountId)))
    .limit(1);

  if (!existing) throw new Error('Event not found');

  let [calRow] = await db
    .select()
    .from(calendars)
    .where(eq(calendars.id, existing.calendarId))
    .limit(1);

  if (!calRow) throw new Error('Calendar not found');

  const cal = await getCalendarClient(accountId);
  const now = new Date();

  // Handle calendar move
  if (input.calendarId && input.calendarId !== existing.calendarId) {
    const [targetCal] = await db.select().from(calendars)
      .where(and(eq(calendars.id, input.calendarId), eq(calendars.accountId, accountId)))
      .limit(1);
    if (!targetCal) throw new Error('Target calendar not found');

    await cal.events.move({
      calendarId: calRow.googleCalendarId,
      eventId: existing.googleEventId,
      destination: targetCal.googleCalendarId,
    });

    await db.update(calendarEvents).set({
      calendarId: input.calendarId,
      updatedAt: now,
    }).where(eq(calendarEvents.id, eventId));

    if (Object.keys(input).filter(k => k !== 'calendarId').length === 0) {
      const [updated] = await db.select().from(calendarEvents)
        .where(eq(calendarEvents.id, eventId)).limit(1);
      return updated;
    }
    calRow = targetCal as typeof calRow;
  }

  const patch: any = {};
  if (input.summary !== undefined) patch.summary = input.summary;
  if (input.description !== undefined) patch.description = input.description;
  if (input.location !== undefined) patch.location = input.location;
  if (input.attendees !== undefined) patch.attendees = input.attendees;
  if (input.colorId !== undefined) patch.colorId = input.colorId;
  if (input.transparency !== undefined) patch.transparency = input.transparency;
  if (input.reminders !== undefined) patch.reminders = input.reminders;

  if (input.startTime !== undefined || input.endTime !== undefined) {
    const isAllDay = input.isAllDay ?? existing.isAllDay;
    if (isAllDay) {
      if (input.startTime) patch.start = { date: input.startTime.slice(0, 10) };
      if (input.endTime) patch.end = { date: input.endTime.slice(0, 10) };
    } else {
      if (input.startTime) patch.start = { dateTime: input.startTime };
      if (input.endTime) patch.end = { dateTime: input.endTime };
    }
  }

  const scope = input.recurringEditScope || 'single';

  let targetGoogleEventId = existing.googleEventId;

  if (scope === 'all' && existing.recurringEventId) {
    targetGoogleEventId = existing.recurringEventId;
    delete patch.start;
    delete patch.end;
  }

  // Handle RSVP response status change
  if (input.responseStatus) {
    const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
    if (account) {
      const gEvent = await cal.events.get({
        calendarId: calRow.googleCalendarId,
        eventId: targetGoogleEventId,
      });
      const attendeesList = gEvent.data.attendees || [];
      const selfAttendee = attendeesList.find(
        (a: any) => a.email?.toLowerCase() === account.email.toLowerCase() || a.self === true,
      );
      if (selfAttendee) {
        selfAttendee.responseStatus = input.responseStatus;
        patch.attendees = attendeesList;
      }
    }
  }

  const res = await cal.events.patch({
    calendarId: calRow.googleCalendarId,
    eventId: targetGoogleEventId,
    requestBody: patch,
    sendUpdates: input.responseStatus ? 'all' : 'none',
  });

  await upsertEvent(accountId, calRow.id, res.data, now);

  if (input.responseStatus) {
    await db.update(calendarEvents).set({
      selfResponseStatus: input.responseStatus,
      updatedAt: now,
    }).where(eq(calendarEvents.id, eventId));
  }

  if ((scope === 'all' && existing.recurringEventId) || scope === 'thisAndFollowing') {
    const timeMin = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const timeMax = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    try {
      await syncCalendarEvents(accountId, calRow.id, timeMin, timeMax);
    } catch (err) {
      logger.warn({ err }, 'Failed to re-sync after updating recurring instances');
    }
  }

  const [updated] = await db
    .select()
    .from(calendarEvents)
    .where(eq(calendarEvents.id, eventId))
    .limit(1);

  return updated;
}

export async function deleteEvent(
  accountId: string,
  eventId: string,
  scope: 'single' | 'all' = 'single',
) {
  const [existing] = await db
    .select()
    .from(calendarEvents)
    .where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.accountId, accountId)))
    .limit(1);

  if (!existing) throw new Error('Event not found');

  const [calRow] = await db
    .select()
    .from(calendars)
    .where(eq(calendars.id, existing.calendarId))
    .limit(1);

  if (!calRow) throw new Error('Calendar not found');

  const cal = await getCalendarClient(accountId);

  if (scope === 'all' && existing.recurringEventId) {
    await cal.events.delete({
      calendarId: calRow.googleCalendarId,
      eventId: existing.recurringEventId,
      sendUpdates: 'all',
    });

    await db
      .delete(calendarEvents)
      .where(
        and(
          eq(calendarEvents.accountId, accountId),
          eq(calendarEvents.recurringEventId, existing.recurringEventId),
        ),
      );
    await db
      .delete(calendarEvents)
      .where(
        and(
          eq(calendarEvents.accountId, accountId),
          eq(calendarEvents.googleEventId, existing.recurringEventId),
        ),
      );
  } else {
    await cal.events.delete({
      calendarId: calRow.googleCalendarId,
      eventId: existing.googleEventId,
      sendUpdates: 'all',
    });

    await db.delete(calendarEvents).where(eq(calendarEvents.id, eventId));
  }
}

export async function toggleCalendarSelected(
  accountId: string,
  calendarDbId: string,
  isSelected: boolean,
) {
  await db
    .update(calendars)
    .set({ isSelected, updatedAt: new Date() })
    .where(and(eq(calendars.id, calendarDbId), eq(calendars.accountId, accountId)));
}

// ─── Search events ──────────────────────────────────────────────────

export async function searchEvents(accountId: string, query: string, limit = 50) {
  const freeBusyCalIds = (
    await db
      .select({ id: calendars.id })
      .from(calendars)
      .where(and(eq(calendars.accountId, accountId), eq(calendars.accessRole, 'freeBusyReader')))
  ).map((c) => c.id);

  const pattern = `%${query}%`;
  const rows = await db
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.accountId, accountId),
        sql`(${calendarEvents.summary} LIKE ${pattern} OR ${calendarEvents.description} LIKE ${pattern} OR ${calendarEvents.location} LIKE ${pattern})`,
      ),
    )
    .orderBy(desc(calendarEvents.startTime))
    .limit(limit);

  if (freeBusyCalIds.length > 0) {
    const freeBusySet = new Set(freeBusyCalIds);
    return rows.filter((r) => !freeBusySet.has(r.calendarId));
  }

  return rows;
}

// ─── Free/Busy lookup ───────────────────────────────────────────────

export async function getFreeBusy(
  accountId: string,
  emails: string[],
  timeMin: string,
  timeMax: string,
) {
  const cal = await getCalendarClient(accountId);

  const res = await cal.freebusy.query({
    requestBody: {
      timeMin,
      timeMax,
      items: emails.map((email) => ({ id: email })),
    },
  });

  const result: Record<string, Array<{ start: string; end: string }>> = {};
  const calendarsData = res.data.calendars || {};

  for (const email of emails) {
    const calData = calendarsData[email];
    if (calData?.busy) {
      result[email] = calData.busy.map((b) => ({
        start: b.start || '',
        end: b.end || '',
      }));
    } else {
      result[email] = [];
    }
  }

  return result;
}

// ─── Create a new calendar ───────────────────────────────────────────

export async function createCalendar(
  accountId: string,
  input: { summary: string; description?: string; backgroundColor?: string },
) {
  const cal = await getCalendarClient(accountId);

  const res = await cal.calendars.insert({
    requestBody: {
      summary: input.summary,
      description: input.description,
    },
  });

  const googleCalId = res.data.id;
  if (!googleCalId) throw new Error('Failed to create calendar');

  if (input.backgroundColor) {
    await cal.calendarList.patch({
      calendarId: googleCalId,
      requestBody: {
        backgroundColor: input.backgroundColor,
        foregroundColor: '#ffffff',
      },
      colorRgbFormat: true,
    });
  }

  const now = new Date();
  const [inserted] = await db
    .insert(calendars)
    .values({
      accountId,
      googleCalendarId: googleCalId,
      summary: input.summary,
      description: input.description || null,
      backgroundColor: input.backgroundColor || null,
      foregroundColor: input.backgroundColor ? '#ffffff' : null,
      timeZone: res.data.timeZone || null,
      accessRole: 'owner',
      isPrimary: false,
      isSelected: true,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  logger.info({ accountId, calendarId: inserted.id }, 'Calendar created');
  return inserted;
}

import { google } from 'googleapis';
import { db } from '../../config/database';
import { crmContacts, crmDeals, calendarEvents, calendars } from '../../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { getAuthenticatedClient } from '../../services/google-auth';
import { logger } from '../../utils/logger';

// ─── Get calendar events for a CRM contact ────────────────────────────

export async function getContactEvents(tenantId: string, contactId: string, limit = 50) {
  const [contact] = await db.select({ email: crmContacts.email })
    .from(crmContacts)
    .where(and(eq(crmContacts.id, contactId), eq(crmContacts.tenantId, tenantId)))
    .limit(1);

  if (!contact?.email) return [];

  const contactEmail = contact.email.toLowerCase();

  const results = await db.execute(sql`
    SELECT ce.id, ce.account_id, ce.calendar_id, ce.google_event_id,
           ce.summary, ce.description, ce.location,
           ce.start_time, ce.end_time, ce.is_all_day,
           ce.status, ce.self_response_status, ce.html_link,
           ce.hangout_link, ce.organizer, ce.attendees
    FROM calendar_events ce
    WHERE ce.account_id = ${tenantId}
    AND ce.attendees @> ${JSON.stringify([{ email: contactEmail }])}::jsonb
    ORDER BY ce.start_time DESC
    LIMIT ${limit}
  `);

  return results.rows;
}

// ─── Get calendar events for a CRM deal ────────────────────────────────

export async function getDealEvents(tenantId: string, dealId: string, limit = 50) {
  const [deal] = await db.select({
    contactId: crmDeals.contactId,
    companyId: crmDeals.companyId,
  })
    .from(crmDeals)
    .where(and(eq(crmDeals.id, dealId), eq(crmDeals.tenantId, tenantId)))
    .limit(1);

  if (!deal) return [];

  if (deal.contactId) {
    return getContactEvents(tenantId, deal.contactId, limit);
  }

  // If deal has a company, get events for all contacts in that company
  if (deal.companyId) {
    const contacts = await db.select({ email: crmContacts.email })
      .from(crmContacts)
      .where(and(
        eq(crmContacts.companyId, deal.companyId),
        eq(crmContacts.tenantId, tenantId),
        eq(crmContacts.isArchived, false),
      ));

    const contactEmails = contacts
      .map((c) => c.email?.toLowerCase())
      .filter((e): e is string => !!e);

    if (contactEmails.length === 0) return [];

    const emailConditions = contactEmails.map((email) =>
      sql`ce.attendees @> ${JSON.stringify([{ email }])}::jsonb`,
    );

    const combinedCondition = sql.join(emailConditions, sql` OR `);

    const results = await db.execute(sql`
      SELECT ce.id, ce.account_id, ce.calendar_id, ce.google_event_id,
             ce.summary, ce.description, ce.location,
             ce.start_time, ce.end_time, ce.is_all_day,
             ce.status, ce.self_response_status, ce.html_link,
             ce.hangout_link, ce.organizer, ce.attendees
      FROM calendar_events ce
      WHERE ce.account_id = ${tenantId}
      AND (${combinedCondition})
      ORDER BY ce.start_time DESC
      LIMIT ${limit}
    `);

    return results.rows;
  }

  return [];
}

// ─── Create a Google Calendar event ────────────────────────────────────

export async function createCalendarEvent(
  tenantId: string,
  summary: string,
  startTime: string,
  endTime: string,
  attendeeEmails: string[],
  location?: string,
  description?: string,
) {
  const client = await getAuthenticatedClient(tenantId);
  const calendarApi = google.calendar({ version: 'v3', auth: client });

  // Get the primary calendar
  const [primaryCal] = await db.select()
    .from(calendars)
    .where(and(
      eq(calendars.tenantId, tenantId),
      eq(calendars.isPrimary, true),
    ))
    .limit(1);

  const calendarId = primaryCal?.googleCalendarId ?? 'primary';

  // Create the event via Google Calendar API
  const eventRes = await calendarApi.events.insert({
    calendarId,
    requestBody: {
      summary,
      start: { dateTime: startTime },
      end: { dateTime: endTime },
      attendees: attendeeEmails.map((email) => ({ email })),
      location: location ?? undefined,
      description: description ?? undefined,
    },
  });

  const event = eventRes.data;

  // Upsert the created event into our database
  if (event.id && primaryCal) {
    const eventStartTime = event.start?.dateTime
      ? new Date(event.start.dateTime)
      : new Date(startTime);
    const eventEndTime = event.end?.dateTime
      ? new Date(event.end.dateTime)
      : new Date(endTime);

    const eventAttendees = (event.attendees ?? []).map((a) => ({
      email: a.email!,
      displayName: a.displayName ?? undefined,
      responseStatus: a.responseStatus ?? undefined,
    }));

    const eventValues = {
      tenantId,
      calendarId: primaryCal.id,
      googleEventId: event.id,
      summary: event.summary ?? null,
      description: event.description ?? null,
      location: event.location ?? null,
      startTime: eventStartTime,
      endTime: eventEndTime,
      isAllDay: false,
      status: event.status ?? 'confirmed',
      htmlLink: event.htmlLink ?? null,
      hangoutLink: event.hangoutLink ?? null,
      organizer: event.organizer
        ? { email: event.organizer.email!, displayName: event.organizer.displayName ?? undefined, self: event.organizer.self ?? undefined }
        : null,
      attendees: eventAttendees,
      updatedAt: new Date(),
    };

    await db.insert(calendarEvents)
      .values({ ...eventValues, createdAt: new Date() })
      .onConflictDoUpdate({
        target: [calendarEvents.tenantId, calendarEvents.googleEventId],
        set: eventValues,
      });
  }

  logger.info({ tenantId, eventId: event.id, summary }, 'Calendar event created via Google Calendar');
  return event;
}

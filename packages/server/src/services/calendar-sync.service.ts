import { google } from 'googleapis';
import { db } from '../config/database';
import { accounts, calendars, calendarEvents } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../utils/logger';
import { withRetry } from '../utils/retry';
import { callGoogleApi } from './google-api-call';

// ─── Full Calendar Sync ────────────────────────────────────────────────

export async function performCalendarFullSync(accountId: string) {
  logger.info({ accountId }, 'Starting full calendar sync');

  try {
    // List all calendars
    let calPageToken: string | undefined;
    do {
      const calListRes = await callGoogleApi(accountId, async (auth) => {
        const calendar = google.calendar({ version: 'v3', auth });
        return withRetry(
          () => calendar.calendarList.list({ pageToken: calPageToken }),
          'Calendar API',
        );
      });

      const items = calListRes.data.items ?? [];
      calPageToken = calListRes.data.nextPageToken ?? undefined;

      for (const cal of items) {
        if (!cal.id) continue;

        // Upsert calendar
        const calValues = {
          accountId,
          googleCalendarId: cal.id,
          summary: cal.summary ?? null,
          description: cal.description ?? null,
          backgroundColor: cal.backgroundColor ?? null,
          foregroundColor: cal.foregroundColor ?? null,
          timeZone: cal.timeZone ?? null,
          accessRole: cal.accessRole ?? null,
          isPrimary: cal.primary === true,
          isSelected: cal.selected !== false,
          updatedAt: new Date(),
        };

        await db.insert(calendars)
          .values({ ...calValues, createdAt: new Date() })
          .onConflictDoUpdate({
            target: [calendars.accountId, calendars.googleCalendarId],
            set: calValues,
          });
      }
    } while (calPageToken);

    // Fetch events for each calendar
    const dbCalendars = await db.select().from(calendars)
      .where(eq(calendars.accountId, accountId));

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    for (const dbCal of dbCalendars) {
      try {
        let eventPageToken: string | undefined;
        let nextSyncToken: string | undefined;

        do {
          const eventsRes = await callGoogleApi(accountId, async (auth) => {
            const calendar = google.calendar({ version: 'v3', auth });
            return withRetry(
              () => calendar.events.list({
                calendarId: dbCal.googleCalendarId,
                maxResults: 2500,
                singleEvents: true,
                orderBy: 'startTime',
                timeMin: sixMonthsAgo.toISOString(),
                pageToken: eventPageToken,
              }),
              'Calendar API',
            );
          });

          const events = eventsRes.data.items ?? [];
          eventPageToken = eventsRes.data.nextPageToken ?? undefined;
          nextSyncToken = eventsRes.data.nextSyncToken ?? undefined;

          for (const event of events) {
            await upsertCalendarEvent(accountId, dbCal.id, event);
          }
        } while (eventPageToken);

        // Store sync token for incremental sync
        if (nextSyncToken) {
          await db.update(calendars).set({
            syncToken: nextSyncToken,
            lastSyncAt: new Date(),
            updatedAt: new Date(),
          }).where(eq(calendars.id, dbCal.id));
        }
      } catch (err) {
        logger.error({ err, calendarId: dbCal.id, googleCalendarId: dbCal.googleCalendarId }, 'Failed to sync events for calendar');
      }
    }

    logger.info({ accountId }, 'Full calendar sync completed');
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error, accountId }, 'Full calendar sync failed');
    throw error;
  }
}

// ─── Incremental Calendar Sync ─────────────────────────────────────────

export async function performCalendarIncrementalSync(accountId: string) {
  logger.info({ accountId }, 'Starting incremental calendar sync');

  try {
    const dbCalendars = await db.select().from(calendars)
      .where(eq(calendars.accountId, accountId));

    for (const dbCal of dbCalendars) {
      if (!dbCal.syncToken) {
        // No sync token — do a full sync for this calendar
        logger.info({ calendarId: dbCal.id }, 'No sync token, performing full sync for calendar');
        try {
          await syncSingleCalendarFull(accountId, dbCal);
        } catch (err) {
          logger.error({ err, calendarId: dbCal.id }, 'Failed full sync for calendar');
        }
        continue;
      }

      try {
        let pageToken: string | undefined;
        let nextSyncToken: string | undefined;

        do {
          const eventsRes = await callGoogleApi(accountId, async (auth) => {
            const calendarApi = google.calendar({ version: 'v3', auth });
            return withRetry(
              () => calendarApi.events.list({
                calendarId: dbCal.googleCalendarId,
                syncToken: dbCal.syncToken!,
                pageToken,
              }),
              'Calendar API',
            );
          });

          const events = eventsRes.data.items ?? [];
          pageToken = eventsRes.data.nextPageToken ?? undefined;
          nextSyncToken = eventsRes.data.nextSyncToken ?? undefined;

          for (const event of events) {
            if (event.status === 'cancelled') {
              // Update status to cancelled
              if (event.id) {
                await db.update(calendarEvents).set({
                  status: 'cancelled',
                  updatedAt: new Date(),
                }).where(
                  and(
                    eq(calendarEvents.accountId, accountId),
                    eq(calendarEvents.googleEventId, event.id),
                  ),
                );
              }
            } else {
              await upsertCalendarEvent(accountId, dbCal.id, event);
            }
          }
        } while (pageToken);

        // Update sync token
        if (nextSyncToken) {
          await db.update(calendars).set({
            syncToken: nextSyncToken,
            lastSyncAt: new Date(),
            updatedAt: new Date(),
          }).where(eq(calendars.id, dbCal.id));
        }
      } catch (err: any) {
        // 410 Gone: sync token expired, do full sync
        if (err?.code === 410) {
          logger.warn({ calendarId: dbCal.id }, 'Sync token expired, performing full sync for calendar');
          await db.update(calendars).set({ syncToken: null, updatedAt: new Date() })
            .where(eq(calendars.id, dbCal.id));
          try {
            await syncSingleCalendarFull(accountId, dbCal);
          } catch (fullErr) {
            logger.error({ fullErr, calendarId: dbCal.id }, 'Failed full sync after token expiry');
          }
        } else {
          logger.error({ err, calendarId: dbCal.id }, 'Failed incremental sync for calendar');
        }
      }
    }

    // Update last sync timestamp
    await db.update(accounts).set({ lastSync: new Date(), updatedAt: new Date() })
      .where(eq(accounts.id, accountId));

    logger.info({ accountId }, 'Incremental calendar sync completed');
  } catch (error: any) {
    logger.error({ error, accountId }, 'Incremental calendar sync failed');
    throw error;
  }
}

// ─── Sync a single calendar fully ──────────────────────────────────────

async function syncSingleCalendarFull(
  accountId: string,
  dbCal: { id: string; googleCalendarId: string },
) {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;

  do {
    const eventsRes = await callGoogleApi(accountId, async (auth) => {
      const calendarApi = google.calendar({ version: 'v3', auth });
      return withRetry(
        () => calendarApi.events.list({
          calendarId: dbCal.googleCalendarId,
          maxResults: 2500,
          singleEvents: true,
          orderBy: 'startTime',
          timeMin: sixMonthsAgo.toISOString(),
          pageToken,
        }),
        'Calendar API',
      );
    });

    const events = eventsRes.data.items ?? [];
    pageToken = eventsRes.data.nextPageToken ?? undefined;
    nextSyncToken = eventsRes.data.nextSyncToken ?? undefined;

    for (const event of events) {
      await upsertCalendarEvent(accountId, dbCal.id, event);
    }
  } while (pageToken);

  if (nextSyncToken) {
    await db.update(calendars).set({
      syncToken: nextSyncToken,
      lastSyncAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(calendars.id, dbCal.id));
  }
}

// ─── Upsert a single calendar event ────────────────────────────────────

async function upsertCalendarEvent(accountId: string, calendarId: string, event: any) {
  if (!event.id) return;

  const startTime = event.start?.dateTime
    ? new Date(event.start.dateTime)
    : event.start?.date
      ? new Date(event.start.date)
      : new Date();

  const endTime = event.end?.dateTime
    ? new Date(event.end.dateTime)
    : event.end?.date
      ? new Date(event.end.date)
      : new Date();

  const isAllDay = !!event.start?.date && !event.start?.dateTime;

  const attendees = (event.attendees ?? []).map((a: any) => ({
    email: a.email,
    displayName: a.displayName ?? undefined,
    responseStatus: a.responseStatus ?? undefined,
  }));

  const organizer = event.organizer
    ? { email: event.organizer.email, displayName: event.organizer.displayName ?? undefined, self: event.organizer.self ?? undefined }
    : null;

  const selfAttendee = (event.attendees ?? []).find((a: any) => a.self === true);

  const eventValues = {
    accountId,
    calendarId,
    googleEventId: event.id,
    summary: event.summary ?? null,
    description: event.description ?? null,
    location: event.location ?? null,
    startTime,
    endTime,
    isAllDay,
    status: event.status ?? 'confirmed',
    selfResponseStatus: selfAttendee?.responseStatus ?? null,
    htmlLink: event.htmlLink ?? null,
    hangoutLink: event.hangoutLink ?? null,
    organizer,
    attendees,
    recurrence: event.recurrence ?? null,
    recurringEventId: event.recurringEventId ?? null,
    transparency: event.transparency ?? null,
    colorId: event.colorId ?? null,
    reminders: event.reminders ?? null,
    updatedAt: new Date(),
  };

  await db.insert(calendarEvents)
    .values({ ...eventValues, createdAt: new Date() })
    .onConflictDoUpdate({
      target: [calendarEvents.accountId, calendarEvents.googleEventId],
      set: eventValues,
    });
}

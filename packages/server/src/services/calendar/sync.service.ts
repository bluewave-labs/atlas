import { google } from 'googleapis';
import { createOAuth2Client } from '../google-auth';
import { decrypt, encrypt } from '../../utils/crypto';
import { db } from '../../config/database';
import { accounts, calendars, calendarEvents } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../../utils/logger';

// ─── Calendar API client ─────────────────────────────────────────────

export async function getCalendarClient(accountId: string) {
  const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
  if (!account) throw new Error('Account not found');

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: decrypt(account.accessToken),
    refresh_token: decrypt(account.refreshToken),
    expiry_date: new Date(account.tokenExpiresAt).getTime(),
  });

  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      const updates: Record<string, any> = {
        accessToken: encrypt(tokens.access_token),
        tokenExpiresAt: new Date(tokens.expiry_date || Date.now() + 3600000),
        updatedAt: new Date(),
      };
      if (tokens.refresh_token) {
        updates.refreshToken = encrypt(tokens.refresh_token);
      }
      await db.update(accounts).set(updates).where(eq(accounts.id, accountId));
    }
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

// ─── Sync calendar list ──────────────────────────────────────────────

export async function syncCalendarList(accountId: string) {
  const cal = await getCalendarClient(accountId);
  const now = new Date();
  let nextPageToken: string | undefined;
  let synced = 0;

  do {
    const res = await cal.calendarList.list({ pageToken: nextPageToken });
    const items = res.data.items || [];

    for (const item of items) {
      if (!item.id) continue;

      await db
        .insert(calendars)
        .values({
          accountId,
          googleCalendarId: item.id,
          summary: item.summary || null,
          description: item.description || null,
          backgroundColor: item.backgroundColor || null,
          foregroundColor: item.foregroundColor || null,
          timeZone: item.timeZone || null,
          accessRole: item.accessRole || null,
          isPrimary: item.primary === true,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [calendars.accountId, calendars.googleCalendarId],
          set: {
            summary: item.summary || null,
            description: item.description || null,
            backgroundColor: item.backgroundColor || null,
            foregroundColor: item.foregroundColor || null,
            timeZone: item.timeZone || null,
            accessRole: item.accessRole || null,
            isPrimary: item.primary === true,
            updatedAt: now,
          },
        });

      synced++;
    }

    nextPageToken = res.data.nextPageToken || undefined;
  } while (nextPageToken);

  logger.info({ accountId, synced }, 'Calendar list sync complete');
}

// ─── Sync calendar events ────────────────────────────────────────────

export async function syncCalendarEvents(
  accountId: string,
  calendarDbId: string,
  timeMin: string,
  timeMax: string,
) {
  const [calRow] = await db
    .select()
    .from(calendars)
    .where(and(eq(calendars.id, calendarDbId), eq(calendars.accountId, accountId)))
    .limit(1);

  if (!calRow) throw new Error('Calendar not found');

  const cal = await getCalendarClient(accountId);
  const now = new Date();
  let nextPageToken: string | undefined;
  let upserted = 0;

  // Try incremental sync first
  if (calRow.syncToken) {
    try {
      await syncWithToken(cal, accountId, calendarDbId, calRow.googleCalendarId, calRow.syncToken, now);
      return;
    } catch (err: any) {
      if (err?.code === 410) {
        logger.info({ accountId, calendarDbId }, 'Calendar sync token expired, falling back to full sync');
        await db.update(calendars).set({ syncToken: null }).where(eq(calendars.id, calendarDbId));
      } else {
        throw err;
      }
    }
  }

  // Full sync with time range
  do {
    const res = await cal.events.list({
      calendarId: calRow.googleCalendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 2500,
      pageToken: nextPageToken,
    });

    const items = res.data.items || [];
    for (const item of items) {
      await upsertEvent(accountId, calendarDbId, item, now);
      upserted++;
    }

    if (res.data.nextSyncToken) {
      await db.update(calendars).set({
        syncToken: res.data.nextSyncToken,
        lastSyncAt: now,
        updatedAt: now,
      }).where(eq(calendars.id, calendarDbId));
    }

    nextPageToken = res.data.nextPageToken || undefined;
  } while (nextPageToken);

  logger.info({ accountId, calendarDbId, upserted }, 'Calendar events sync complete');
}

async function syncWithToken(
  cal: Awaited<ReturnType<typeof getCalendarClient>>,
  accountId: string,
  calendarDbId: string,
  googleCalendarId: string,
  syncToken: string,
  now: Date,
) {
  let nextPageToken: string | undefined;
  let processed = 0;

  do {
    const res = await cal.events.list({
      calendarId: googleCalendarId,
      syncToken,
      pageToken: nextPageToken,
      showDeleted: true,
    });

    const items = res.data.items || [];
    for (const item of items) {
      if (item.status === 'cancelled') {
        await db
          .delete(calendarEvents)
          .where(
            and(
              eq(calendarEvents.accountId, accountId),
              eq(calendarEvents.googleEventId, item.id!),
            ),
          );
      } else {
        await upsertEvent(accountId, calendarDbId, item, now);
      }
      processed++;
    }

    if (res.data.nextSyncToken) {
      await db.update(calendars).set({
        syncToken: res.data.nextSyncToken,
        lastSyncAt: now,
        updatedAt: now,
      }).where(eq(calendars.id, calendarDbId));
    }

    nextPageToken = res.data.nextPageToken || undefined;
  } while (nextPageToken);

  logger.info({ accountId, calendarDbId, processed }, 'Incremental calendar sync complete');
}

export async function upsertEvent(
  accountId: string,
  calendarDbId: string,
  item: any,
  now: Date,
) {
  if (!item.id) return;

  const isAllDay = !!item.start?.date;
  const startTime = isAllDay ? item.start.date : item.start?.dateTime;
  const endTime = isAllDay ? item.end?.date : item.end?.dateTime;

  if (!startTime || !endTime) return;

  await db
    .insert(calendarEvents)
    .values({
      accountId,
      calendarId: calendarDbId,
      googleEventId: item.id,
      summary: item.summary || null,
      description: item.description || null,
      location: item.location || null,
      startTime,
      endTime,
      isAllDay,
      status: item.status || 'confirmed',
      selfResponseStatus: getSelfResponseStatus(item.attendees),
      htmlLink: item.htmlLink || null,
      hangoutLink: item.hangoutLink || null,
      organizer: item.organizer || null,
      attendees: item.attendees || null,
      recurrence: item.recurrence || null,
      recurringEventId: item.recurringEventId || null,
      transparency: item.transparency || null,
      colorId: item.colorId || null,
      reminders: item.reminders || null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [calendarEvents.accountId, calendarEvents.googleEventId],
      set: {
        calendarId: calendarDbId,
        summary: item.summary || null,
        description: item.description || null,
        location: item.location || null,
        startTime,
        endTime,
        isAllDay,
        status: item.status || 'confirmed',
        selfResponseStatus: getSelfResponseStatus(item.attendees),
        htmlLink: item.htmlLink || null,
        hangoutLink: item.hangoutLink || null,
        organizer: item.organizer || null,
        attendees: item.attendees || null,
        recurrence: item.recurrence || null,
        recurringEventId: item.recurringEventId || null,
        transparency: item.transparency || null,
        colorId: item.colorId || null,
        reminders: item.reminders || null,
        updatedAt: now,
      },
    });
}

function getSelfResponseStatus(attendees: any[] | undefined): string | null {
  if (!attendees) return null;
  const self = attendees.find((a: any) => a.self === true);
  return self?.responseStatus || null;
}

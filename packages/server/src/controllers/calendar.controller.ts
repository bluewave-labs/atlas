import type { Request, Response } from 'express';
import * as calendarService from '../services/calendar.service';
import { logger } from '../utils/logger';

export async function listCalendars(req: Request, res: Response) {
  try {
    const cals = await calendarService.listCalendars(req.auth!.accountId);
    res.json({ success: true, data: cals });
  } catch (error: any) {
    logger.error({ error }, 'Failed to list calendars');
    res.status(500).json({ success: false, error: 'Failed to list calendars' });
  }
}

export async function syncCalendars(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;

    // Sync the calendar list first
    await calendarService.syncCalendarList(accountId);

    // Get all selected calendars
    const cals = await calendarService.listCalendars(accountId);
    const selected = cals.filter((c) => c.isSelected);

    // Default time range: 3 months back, 12 months forward
    const now = new Date();
    const timeMin = req.query.timeMin as string ||
      new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString();
    const timeMax = req.query.timeMax as string ||
      new Date(now.getFullYear(), now.getMonth() + 12, 0).toISOString();

    // Sync events for each selected calendar
    for (const cal of selected) {
      try {
        await calendarService.syncCalendarEvents(accountId, cal.id, timeMin, timeMax);
      } catch (err) {
        logger.error({ err, calendarId: cal.id }, 'Failed to sync calendar events');
      }
    }

    // Return updated data
    const events = await calendarService.listEvents(accountId, timeMin, timeMax);
    res.json({ success: true, data: { calendars: cals, events } });
  } catch (error: any) {
    logger.error({ error, status: error?.response?.status, data: error?.response?.data }, 'Failed to sync calendars');

    // Detect Google API errors
    const gStatus = error?.response?.status || error?.code;
    const gReason = error?.response?.data?.error?.errors?.[0]?.reason;

    if (gStatus === 403) {
      if (gReason === 'accessNotConfigured') {
        res.status(403).json({
          success: false,
          error: 'Google Calendar API is not enabled in the Google Cloud project. Please enable it at console.cloud.google.com.',
          code: 'API_NOT_ENABLED',
        });
        return;
      }
      res.status(403).json({
        success: false,
        error: 'Calendar permissions not granted. Please sign out and sign back in to grant calendar access.',
        code: 'SCOPE_MISSING',
      });
      return;
    }

    res.status(500).json({ success: false, error: 'Failed to sync calendars' });
  }
}

export async function listEvents(req: Request, res: Response) {
  try {
    const { timeMin, timeMax, calendarIds } = req.query;

    if (!timeMin || !timeMax) {
      res.status(400).json({ success: false, error: 'timeMin and timeMax are required' });
      return;
    }

    const calIds = calendarIds
      ? (calendarIds as string).split(',').filter(Boolean)
      : undefined;

    const events = await calendarService.listEvents(
      req.auth!.accountId,
      timeMin as string,
      timeMax as string,
      calIds,
    );

    res.json({ success: true, data: events });
  } catch (error) {
    logger.error({ error }, 'Failed to list calendar events');
    res.status(500).json({ success: false, error: 'Failed to list events' });
  }
}

export async function createEvent(req: Request, res: Response) {
  try {
    const { calendarId, summary, description, location, startTime, endTime, isAllDay, attendees, colorId } = req.body;

    if (!calendarId || !summary || !startTime || !endTime) {
      res.status(400).json({ success: false, error: 'calendarId, summary, startTime, and endTime are required' });
      return;
    }

    const event = await calendarService.createEvent(req.auth!.accountId, {
      calendarId,
      summary,
      description,
      location,
      startTime,
      endTime,
      isAllDay,
      attendees,
      colorId,
    });

    res.json({ success: true, data: event });
  } catch (error) {
    logger.error({ error }, 'Failed to create calendar event');
    res.status(500).json({ success: false, error: 'Failed to create event' });
  }
}

export async function updateEvent(req: Request, res: Response) {
  try {
    const eventId = req.params.eventId as string;
    const event = await calendarService.updateEvent(req.auth!.accountId, eventId, req.body);
    res.json({ success: true, data: event });
  } catch (error) {
    logger.error({ error }, 'Failed to update calendar event');
    res.status(500).json({ success: false, error: 'Failed to update event' });
  }
}

export async function deleteEvent(req: Request, res: Response) {
  try {
    const eventId = req.params.eventId as string;
    const scope = (req.query.scope as string) === 'all' ? 'all' : 'single';
    await calendarService.deleteEvent(req.auth!.accountId, eventId, scope);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete calendar event');
    res.status(500).json({ success: false, error: 'Failed to delete event' });
  }
}

export async function createCalendar(req: Request, res: Response) {
  try {
    const { summary, description, backgroundColor } = req.body;

    if (!summary || typeof summary !== 'string' || !summary.trim()) {
      res.status(400).json({ success: false, error: 'summary is required' });
      return;
    }

    const calendar = await calendarService.createCalendar(req.auth!.accountId, {
      summary: summary.trim(),
      description,
      backgroundColor,
    });

    res.json({ success: true, data: calendar });
  } catch (error) {
    logger.error({ error }, 'Failed to create calendar');
    res.status(500).json({ success: false, error: 'Failed to create calendar' });
  }
}

export async function toggleCalendar(req: Request, res: Response) {
  try {
    const calendarId = req.params.calendarId as string;
    const { isSelected } = req.body;

    if (typeof isSelected !== 'boolean') {
      res.status(400).json({ success: false, error: 'isSelected must be a boolean' });
      return;
    }

    await calendarService.toggleCalendarSelected(req.auth!.accountId, calendarId, isSelected);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to toggle calendar');
    res.status(500).json({ success: false, error: 'Failed to toggle calendar' });
  }
}

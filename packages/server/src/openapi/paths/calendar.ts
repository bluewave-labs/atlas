import { z } from 'zod';
import { register, envelope, Uuid, IsoDateTime } from '../_helpers';

const TAG = 'Calendar';

const Calendar = z.object({
  id: Uuid,
  accountId: Uuid.openapi({ description: 'Which account owns this calendar (Google/etc)' }),
  googleCalendarId: z.string(),
  summary: z.string().openapi({ description: 'Calendar name (Google terminology)' }),
  description: z.string().nullable(),
  backgroundColor: z.string(),
  foregroundColor: z.string(),
  timeZone: z.string(),
  accessRole: z.enum(['owner', 'writer', 'reader', 'freeBusyReader']),
  isPrimary: z.boolean(),
  isSelected: z.boolean().openapi({ description: 'Whether the user has this calendar toggled on in their view' }),
  syncToken: z.string().nullable(),
  lastSyncAt: IsoDateTime.nullable(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});

const CalendarEvent = z.object({
  id: Uuid,
  calendarId: Uuid,
  title: z.string(),
  description: z.string().nullable(),
  start: IsoDateTime,
  end: IsoDateTime,
  allDay: z.boolean(),
  location: z.string().nullable(),
  attendees: z.array(z.object({ email: z.string().email(), name: z.string().optional() })).optional(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});

// Calendars
register({ method: 'get', path: '/calendar/calendars', tags: [TAG], summary: 'List calendars (flat Google-style list)',
  response: envelope(z.array(Calendar)) });
register({ method: 'post', path: '/calendar/calendars', tags: [TAG], summary: 'Create a local calendar',
  body: z.object({ summary: z.string(), backgroundColor: z.string().optional() }),
  response: envelope(Calendar) });
register({ method: 'patch', path: '/calendar/calendars/:calendarId/toggle', tags: [TAG], summary: 'Enable/disable a calendar in views',
  params: z.object({ calendarId: Uuid }), body: z.object({ isEnabled: z.boolean() }) });
register({ method: 'post', path: '/calendar/sync', tags: [TAG], summary: 'Trigger sync with Google Calendar',
  response: envelope(z.object({ synced: z.number().int() })) });
register({ method: 'post', path: '/calendar/freebusy', tags: [TAG], summary: 'Query free/busy info across calendars',
  body: z.object({
    calendarIds: z.array(Uuid),
    start: IsoDateTime,
    end: IsoDateTime,
  }),
  response: envelope(z.record(Uuid, z.array(z.object({ start: IsoDateTime, end: IsoDateTime })))) });

// Events
register({ method: 'get', path: '/calendar/events', tags: [TAG], summary: 'List calendar events',
  query: z.object({ from: IsoDateTime.optional(), to: IsoDateTime.optional(), calendarId: Uuid.optional() }),
  response: envelope(z.array(CalendarEvent)) });
register({ method: 'get', path: '/calendar/events/aggregated', tags: [TAG], summary: 'List events aggregated with tasks and other records',
  query: z.object({ from: IsoDateTime.optional(), to: IsoDateTime.optional() }),
  response: envelope(z.array(z.record(z.string(), z.unknown()))) });
register({ method: 'get', path: '/calendar/events/search', tags: [TAG], summary: 'Search calendar events',
  query: z.object({ q: z.string().min(1) }), response: envelope(z.array(CalendarEvent)) });
register({ method: 'post', path: '/calendar/events', tags: [TAG], summary: 'Create a calendar event',
  body: CalendarEvent.omit({ id: true, createdAt: true, updatedAt: true }).partial().extend({
    calendarId: Uuid, title: z.string(), start: IsoDateTime, end: IsoDateTime,
  }),
  response: envelope(CalendarEvent) });
register({ method: 'patch', path: '/calendar/events/:eventId', tags: [TAG], summary: 'Update a calendar event',
  params: z.object({ eventId: Uuid }), body: CalendarEvent.partial(), response: envelope(CalendarEvent) });
register({ method: 'delete', path: '/calendar/events/:eventId', tags: [TAG], summary: 'Delete a calendar event',
  params: z.object({ eventId: Uuid }) });

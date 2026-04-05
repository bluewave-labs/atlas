// Barrel re-export — keeps existing imports unchanged
export {
  syncCalendarList,
  syncCalendarEvents,
} from './calendar/sync.service';

export {
  listCalendars,
  listEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  toggleCalendarSelected,
  searchEvents,
  getFreeBusy,
  createCalendar,
} from './calendar/crud.service';

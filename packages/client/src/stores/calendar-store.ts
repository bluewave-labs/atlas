import { create } from 'zustand';
import type { CalendarEvent } from '@atlasmail/shared';

interface EventModalState {
  open: boolean;
  mode: 'create' | 'edit';
  event: CalendarEvent | null;
  defaultStart: string | null;
  defaultEnd: string | null;
}

interface CalendarStoreState {
  selectedDate: string; // YYYY-MM-DD
  view: 'week' | 'month-grid' | 'day';
  eventModal: EventModalState;
  setSelectedDate: (date: string) => void;
  setView: (view: 'week' | 'month-grid' | 'day') => void;
  openCreateModal: (start?: string, end?: string) => void;
  openEditModal: (event: CalendarEvent) => void;
  closeEventModal: () => void;
}

function toYMD(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const useCalendarStore = create<CalendarStoreState>((set) => ({
  selectedDate: toYMD(),
  view: 'week',
  eventModal: {
    open: false,
    mode: 'create',
    event: null,
    defaultStart: null,
    defaultEnd: null,
  },
  setSelectedDate: (date) => set({ selectedDate: date }),
  setView: (view) => set({ view }),
  openCreateModal: (start, end) =>
    set({
      eventModal: {
        open: true,
        mode: 'create',
        event: null,
        defaultStart: start ?? null,
        defaultEnd: end ?? null,
      },
    }),
  openEditModal: (event) =>
    set({
      eventModal: {
        open: true,
        mode: 'edit',
        event,
        defaultStart: null,
        defaultEnd: null,
      },
    }),
  closeEventModal: () =>
    set((s) => ({
      eventModal: { ...s.eventModal, open: false },
    })),
}));

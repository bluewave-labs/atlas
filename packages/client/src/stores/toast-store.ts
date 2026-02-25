import { create } from 'zustand';

export interface Toast {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'undo';
  /** Called immediately when the user clicks Undo — cancels the pending action. */
  undoAction?: () => void;
  /** Called when the countdown expires — actually commits the deferred action. */
  commitAction?: () => void;
  /** Duration in ms before the toast auto-dismisses and commitAction fires. Defaults to 5000. */
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  dismissToast: (id: string) => void;
  /** Dismiss and fire commitAction if present (used by the internal timer). */
  commitToast: (id: string) => void;
  /** Dismiss and fire undoAction if present (used by the Undo button). */
  undoToast: (id: string) => void;
}

function generateId(): string {
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  addToast: (toastData) => {
    const id = generateId();
    const toast: Toast = { duration: 5000, ...toastData, id };
    set((state) => ({ toasts: [...state.toasts, toast] }));
    return id;
  },

  dismissToast: (id) => {
    const toast = get().toasts.find((t) => t.id === id);
    if (toast?.commitAction) {
      toast.commitAction();
    }
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },

  commitToast: (id) => {
    const toast = get().toasts.find((t) => t.id === id);
    if (toast?.commitAction) {
      toast.commitAction();
    }
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },

  undoToast: (id) => {
    const toast = get().toasts.find((t) => t.id === id);
    if (toast?.undoAction) {
      toast.undoAction();
    }
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));

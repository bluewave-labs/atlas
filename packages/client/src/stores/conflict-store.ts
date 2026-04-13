import { create } from 'zustand';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';

export interface PendingConflict {
  request: AxiosRequestConfig;
  currentUpdatedAt: string;
  resolve: (value: AxiosResponse) => void;
  reject: (error: unknown) => void;
}

interface ConflictState {
  open: boolean;
  pending: PendingConflict | null;
  openConflict: (
    request: AxiosRequestConfig,
    currentUpdatedAt: string,
    resolve: (value: AxiosResponse) => void,
    reject: (error: unknown) => void,
  ) => void;
  close: () => void;
}

export const useConflictStore = create<ConflictState>((set) => ({
  open: false,
  pending: null,

  openConflict: (request, currentUpdatedAt, resolve, reject) => {
    set({
      open: true,
      pending: { request, currentUpdatedAt, resolve, reject },
    });
  },

  close: () => {
    set({ open: false, pending: null });
  },
}));

import { create } from 'zustand';

export interface ComposerDraft {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
}

interface ComposerStore {
  drafts: Record<string, ComposerDraft>;
  getDraft: (key: string) => ComposerDraft;
  updateDraft: (key: string, patch: Partial<ComposerDraft>) => void;
  clearDraft: (key: string) => void;
}

const EMPTY_DRAFT: ComposerDraft = { to: '', cc: '', bcc: '', subject: '', body: '' };

export const useComposerStore = create<ComposerStore>((set, get) => ({
  drafts: {},
  getDraft: (key) => get().drafts[key] ?? EMPTY_DRAFT,
  updateDraft: (key, patch) =>
    set((state) => ({
      drafts: {
        ...state.drafts,
        [key]: { ...EMPTY_DRAFT, ...state.drafts[key], ...patch },
      },
    })),
  clearDraft: (key) =>
    set((state) => {
      const next = { ...state.drafts };
      delete next[key];
      return { drafts: next };
    }),
}));

import type { BadgeTone } from './tour-types';

export const BADGE_TONES: Record<BadgeTone, { bg: string; fg: string }> = {
  success: { bg: '#dcfce7', fg: '#15803d' },
  info: { bg: '#dbeafe', fg: '#1d4ed8' },
  warning: { bg: '#fef3c7', fg: '#a16207' },
  danger: { bg: '#fee2e2', fg: '#b91c1c' },
  neutral: { bg: '#f1f5f9', fg: '#475569' },
};

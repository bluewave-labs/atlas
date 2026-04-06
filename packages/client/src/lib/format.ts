import { useSettingsStore } from '../stores/settings-store';

export function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === 0) return '\u2014';
  if (!Number.isFinite(bytes) || bytes < 0) return '\u2014';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);

  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

// ─── Date Formatting ──────────────────────────────────────────────

/**
 * Format a date string or Date object using the user's date format preference.
 * Reads from the settings store.
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '\u2014';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '\u2014';

  const { dateFormat } = useSettingsStore.getState();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  switch (dateFormat) {
    case 'DD/MM/YYYY': return `${day}/${month}/${year}`;
    case 'YYYY-MM-DD': return `${year}-${month}-${day}`;
    default: return `${month}/${day}/${year}`;
  }
}

/**
 * Format a date with time using the user's format preferences.
 */
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '\u2014';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '\u2014';

  const { timeFormat } = useSettingsStore.getState();
  const datePart = formatDate(d);

  if (timeFormat === '24h') {
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${datePart} ${hours}:${minutes}`;
  }

  // 12h format
  let hours = d.getHours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${datePart} ${hours}:${minutes} ${ampm}`;
}

/**
 * Format a date as relative text (e.g. "Today", "Yesterday", "Mar 15").
 * Falls back to formatDate for older dates.
 */
export function formatRelativeDate(date: string | Date | null | undefined): string {
  if (!date) return '\u2014';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '\u2014';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = today.getTime() - target.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days === -1) return 'Tomorrow';
  if (days < -1) return `in ${Math.abs(days)} days`;
  if (days < 7) return `${days} days ago`;

  return formatDate(d);
}

// ─── Currency Formatting ──────────────────────────────────────────

/**
 * Format a number as currency using the user's currency symbol and number format.
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '\u2014';

  const { currencySymbol } = useSettingsStore.getState();
  const formatted = formatNumber(value);
  return `${currencySymbol}${formatted}`;
}

/**
 * Format a currency value in a compact form (e.g. $1.2M, $50K).
 */
export function formatCurrencyCompact(value: number | null | undefined): string {
  if (value == null) return '\u2014';
  const { currencySymbol } = useSettingsStore.getState();

  if (Math.abs(value) >= 1_000_000) {
    return `${currencySymbol}${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${currencySymbol}${(value / 1_000).toFixed(1)}K`;
  }
  return `${currencySymbol}${formatNumber(value)}`;
}

// ─── Number Formatting ────────────────────────────────────────────

/**
 * Format a number using the user's number format preference.
 */
export function formatNumber(value: number | null | undefined, decimals?: number): string {
  if (value == null) return '\u2014';

  const { numberFormat } = useSettingsStore.getState();
  const dec = decimals ?? (Number.isInteger(value) ? 0 : 2);

  // Get raw parts
  const fixed = Math.abs(value).toFixed(dec);
  const [intPart, decPart] = fixed.split('.');
  const sign = value < 0 ? '-' : '';

  // Add thousands separator
  let formatted: string;
  switch (numberFormat) {
    case 'period-comma':
      // 1.234,56
      formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (decPart ? `,${decPart}` : '');
      break;
    case 'space-comma':
      // 1 234,56
      formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (decPart ? `,${decPart}` : '');
      break;
    default:
      // comma-period: 1,234.56
      formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (decPart ? `.${decPart}` : '');
      break;
  }

  return `${sign}${formatted}`;
}

/**
 * Parse raw text (from PDF extraction) into structured invoice data.
 *
 * Handles multi-language keywords, multiple date/number formats, and
 * provides a confidence rating based on how many fields were matched.
 */
import type { LineItem } from '../components/shared/line-items-editor';

// ─── Public types ────────────────────────────────────────────────

export type Confidence = 'high' | 'medium' | 'low';

export interface ParsedInvoice {
  vendorName?: string;
  invoiceNumber?: string;
  issueDate?: string;
  dueDate?: string;
  currency?: string;
  lineItems: LineItem[];
  subtotal?: number;
  taxPercent?: number;
  total?: number;
  confidence: Confidence;
}

// ─── Keyword dictionaries (EN, TR, DE, FR, IT) ──────────────────

const INVOICE_KEYWORDS =
  /invoice|fatura|rechnung|facture|fattura/i;

const TOTAL_KEYWORDS =
  /\b(?:total|toplam|gesamt|gesamtbetrag|totale|montant\s*total|grand\s*total)\b/i;

const SUBTOTAL_KEYWORDS =
  /\b(?:subtotal|sub[\s-]?total|ara\s*toplam|zwischensumme|sous[\s-]?total|subtotale)\b/i;

const TAX_KEYWORDS =
  /\b(?:tax|vat|kdv|mwst|tva|iva|ust|steuer)\b/i;

const DUE_DATE_KEYWORDS =
  /\b(?:due\s*date|vade\s*tarihi|f[äa]lligkeitsdatum|date\s*d'[ée]ch[ée]ance|data\s*di\s*scadenza|payment\s*due)\b/i;

const INVOICE_NUMBER_KEYWORDS =
  /(?:invoice\s*(?:no|number|#|num)|fatura\s*(?:no|numaras[ıi])|rechnung(?:s)?(?:nummer|nr)|num[ée]ro\s*(?:de\s*)?facture|numero\s*fattura)\s*[:#]?\s*/i;

// ─── Helpers ─────────────────────────────────────────────────────

const CURRENCY_MAP: Record<string, string> = {
  $: 'USD',
  '€': 'EUR',
  '£': 'GBP',
  '₺': 'TRY',
  '¥': 'JPY',
  '₹': 'INR',
  CHF: 'CHF',
  USD: 'USD',
  EUR: 'EUR',
  GBP: 'GBP',
  TRY: 'TRY',
  TL: 'TRY',
  JPY: 'JPY',
  INR: 'INR',
};

/** Match European (1.234,56) or US (1,234.56) number near a keyword. */
function parseNumber(raw: string): number | null {
  let s = raw.replace(/\s/g, '');

  // Strip currency symbols
  s = s.replace(/[$€£₺¥₹]/g, '');

  if (!s) return null;

  // European: 1.234,56  →  last separator is comma
  if (/,\d{1,2}$/.test(s) && /\./.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  }
  // Only comma as decimal: 123,45 (no dot thousands)
  else if (/,\d{1,2}$/.test(s) && !/\./.test(s)) {
    s = s.replace(',', '.');
  }
  // US: 1,234.56  →  strip commas
  else {
    s = s.replace(/,/g, '');
  }

  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

/** Try to parse a date from various formats. Returns YYYY-MM-DD or undefined. */
function parseDate(raw: string): string | undefined {
  // YYYY-MM-DD
  const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];

  // DD/MM/YYYY or DD.MM.YYYY
  const dmy = raw.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // MM/DD/YYYY (US) — heuristic: if first number > 12, treat as DD/MM
  // Already handled above; this branch treats ambiguous as DD/MM (more common internationally).

  return undefined;
}

/** Generate a short random id for line items. */
function rid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function detectCurrency(text: string): string | undefined {
  for (const [symbol, code] of Object.entries(CURRENCY_MAP)) {
    if (text.includes(symbol)) return code;
  }
  return undefined;
}

function extractNumberAfterKeyword(line: string, keyword: RegExp): number | null {
  const match = line.match(keyword);
  if (!match) return null;
  const after = line.slice(match.index! + match[0].length);
  const numMatch = after.match(/[\d.,]+/);
  if (!numMatch) return null;
  return parseNumber(numMatch[0]);
}

// ─── Main parser ─────────────────────────────────────────────────

export function parseInvoiceText(text: string): ParsedInvoice {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  let matchCount = 0;

  // Vendor name: first non-numeric line in first 5 lines
  let vendorName: string | undefined;
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i];
    if (line && !/^\d+$/.test(line) && !INVOICE_KEYWORDS.test(line) && line.length > 2) {
      vendorName = line;
      matchCount++;
      break;
    }
  }

  // Invoice number
  let invoiceNumber: string | undefined;
  for (const line of lines) {
    const m = line.match(INVOICE_NUMBER_KEYWORDS);
    if (m) {
      const after = line.slice(m.index! + m[0].length).trim();
      const numStr = after.match(/[\w\-/]+/);
      if (numStr) {
        invoiceNumber = numStr[0];
        matchCount++;
        break;
      }
    }
  }

  // Dates
  let issueDate: string | undefined;
  let dueDate: string | undefined;
  for (const line of lines) {
    const dateStr = parseDate(line);
    if (dateStr) {
      if (DUE_DATE_KEYWORDS.test(line)) {
        dueDate = dateStr;
        matchCount++;
      } else if (!issueDate) {
        issueDate = dateStr;
        matchCount++;
      }
    }
  }

  // Currency
  const currency = detectCurrency(text);
  if (currency) matchCount++;

  // Totals
  let subtotal: number | undefined;
  let total: number | undefined;
  let taxPercent: number | undefined;

  for (const line of lines) {
    if (SUBTOTAL_KEYWORDS.test(line)) {
      const n = extractNumberAfterKeyword(line, SUBTOTAL_KEYWORDS);
      if (n !== null) {
        subtotal = n;
        matchCount++;
      }
    }
    if (TOTAL_KEYWORDS.test(line) && !SUBTOTAL_KEYWORDS.test(line)) {
      const n = extractNumberAfterKeyword(line, TOTAL_KEYWORDS);
      if (n !== null) {
        total = n;
        matchCount++;
      }
    }
    if (TAX_KEYWORDS.test(line)) {
      // Look for percentage
      const pctMatch = line.match(/(\d+(?:[.,]\d+)?)\s*%/);
      if (pctMatch) {
        const pct = parseNumber(pctMatch[1]);
        if (pct !== null) {
          taxPercent = pct;
          matchCount++;
        }
      }
    }
  }

  // ── Line items ────────────────────────────────────────────────
  const lineItems: LineItem[] = [];

  // Pattern: description  qty  x  price   OR   description  qty  price  total
  const lineItemPattern =
    /^(.+?)\s+(\d+(?:[.,]\d+)?)\s*[xX×]\s*([\d.,]+)/;
  const lineItemPattern2 =
    /^(.+?)\s+(\d+(?:[.,]\d+)?)\s+([\d.,]+)\s+([\d.,]+)/;

  for (const line of lines) {
    let m = line.match(lineItemPattern);
    if (m) {
      const qty = parseNumber(m[2]);
      const price = parseNumber(m[3]);
      if (qty !== null && price !== null) {
        lineItems.push({
          id: rid(),
          description: m[1].trim(),
          quantity: qty,
          unitPrice: price,
          taxRate: taxPercent ?? 0,
        });
        continue;
      }
    }

    m = line.match(lineItemPattern2);
    if (m) {
      const qty = parseNumber(m[2]);
      const price = parseNumber(m[3]);
      if (qty !== null && price !== null && qty <= 10000 && price > 0) {
        lineItems.push({
          id: rid(),
          description: m[1].trim(),
          quantity: qty,
          unitPrice: price,
          taxRate: taxPercent ?? 0,
        });
      }
    }
  }

  if (lineItems.length > 0) matchCount++;

  // ── Confidence ────────────────────────────────────────────────
  let confidence: Confidence;
  if (matchCount >= 5) confidence = 'high';
  else if (matchCount >= 3) confidence = 'medium';
  else confidence = 'low';

  return {
    vendorName,
    invoiceNumber,
    issueDate,
    dueDate,
    currency,
    lineItems,
    subtotal,
    taxPercent,
    total,
    confidence,
  };
}

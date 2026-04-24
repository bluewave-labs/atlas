import { useCallback, useRef, useState } from 'react';

const STORAGE_KEY = 'atlas_invoice_detail_split';
const DEFAULT_PDF_PERCENT = 60;
const MIN_PDF_PERCENT = 30;
const MAX_PDF_PERCENT = 80;

function clamp(value: number): number {
  return Math.min(MAX_PDF_PERCENT, Math.max(MIN_PDF_PERCENT, value));
}

function read(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null) return DEFAULT_PDF_PERCENT;
    const n = Number(raw);
    if (!Number.isFinite(n)) return DEFAULT_PDF_PERCENT;
    return clamp(n);
  } catch {
    return DEFAULT_PDF_PERCENT;
  }
}

/**
 * Returns the PDF pane's percentage of the horizontal split (30-80).
 * `setPdfPercent` is cheap (state only) — safe to call on every mousemove.
 * `persistPdfPercent` writes to localStorage; call it on mouseup / key commit.
 */
export function useInvoiceDetailSplit() {
  const [pdfPercent, setPdfPercentState] = useState<number>(() => read());
  const latest = useRef(pdfPercent);

  const setPdfPercent = useCallback((next: number) => {
    const clamped = clamp(next);
    latest.current = clamped;
    setPdfPercentState(clamped);
  }, []);

  const persistPdfPercent = useCallback(() => {
    try { localStorage.setItem(STORAGE_KEY, String(latest.current)); } catch { /* ignore */ }
  }, []);

  return { pdfPercent, setPdfPercent, persistPdfPercent, MIN_PDF_PERCENT, MAX_PDF_PERCENT };
}

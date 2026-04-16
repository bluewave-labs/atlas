/**
 * PDF text extraction with OCR fallback.
 *
 * 1. Try pdfjs-dist text extraction (fast, works for digital PDFs).
 * 2. If extracted text < 50 chars, fall back to tesseract.js OCR.
 */
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export type ProgressStage = 'reading' | 'extracting' | 'ocr' | 'done';

export interface ExtractionResult {
  text: string;
  method: 'digital' | 'ocr';
}

type ProgressCallback = (percent: number, stage: ProgressStage) => void;

const MIN_DIGITAL_TEXT_LENGTH = 50;

/**
 * Extract text from a PDF file.  Tries digital text layer first,
 * then falls back to OCR via tesseract.js (dynamically imported).
 */
export async function extractTextFromPdf(
  file: File,
  onProgress?: ProgressCallback,
): Promise<ExtractionResult> {
  onProgress?.(0, 'reading');

  const arrayBuffer = await file.arrayBuffer();
  onProgress?.(10, 'reading');

  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  onProgress?.(20, 'extracting');

  // ── Digital text extraction ───────────────────────────────────
  const pageTexts: string[] = [];
  const totalPages = pdf.numPages;

  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .filter((item) => 'str' in item)
      .map((item) => (item as { str: string }).str)
      .join(' ');
    pageTexts.push(text);

    const extractPct = 20 + Math.round((i / totalPages) * 30);
    onProgress?.(extractPct, 'extracting');
  }

  const digitalText = pageTexts.join('\n').trim();

  if (digitalText.length >= MIN_DIGITAL_TEXT_LENGTH) {
    onProgress?.(100, 'done');
    return { text: digitalText, method: 'digital' };
  }

  // ── OCR fallback ──────────────────────────────────────────────
  onProgress?.(55, 'ocr');

  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng');

  const ocrTexts: string[] = [];
  const scale = 2; // 2x for better OCR accuracy

  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport } as any).promise;

    const {
      data: { text },
    } = await worker.recognize(canvas);
    ocrTexts.push(text);

    const ocrPct = 55 + Math.round((i / totalPages) * 40);
    onProgress?.(ocrPct, 'ocr');
  }

  await worker.terminate();

  onProgress?.(100, 'done');
  return { text: ocrTexts.join('\n').trim(), method: 'ocr' };
}

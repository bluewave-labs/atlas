/**
 * PDF Import Modal — three-stage modal for uploading, processing, and
 * reviewing an invoice PDF before importing extracted data.
 */
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Download,
} from 'lucide-react';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { extractTextFromPdf, type ProgressStage } from '../../lib/pdf-extract';
import { parseInvoiceText, type ParsedInvoice, type Confidence } from '../../lib/invoice-parser';
import type { LineItem } from './line-items-editor';

// ─── Props ───────────────────────────────────────────────────────

interface PdfImportModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (data: {
    lineItems: LineItem[];
    currency?: string;
    issueDate?: string;
    dueDate?: string;
    taxPercent?: number;
    notes?: string;
  }) => void;
}

// ─── Stage types ─────────────────────────────────────────────────

type Stage = 'upload' | 'processing' | 'review';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

// ─── Styles ──────────────────────────────────────────────────────

const dropzoneBase: React.CSSProperties = {
  border: '2px dashed var(--color-border-primary)',
  borderRadius: 'var(--radius-lg)',
  padding: 'var(--spacing-2xl) var(--spacing-xl)',
  textAlign: 'center',
  cursor: 'pointer',
  transition: 'border-color 200ms, background 200ms',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 'var(--spacing-md)',
};

const dropzoneActive: React.CSSProperties = {
  ...dropzoneBase,
  borderColor: 'var(--color-accent-primary)',
  background: 'var(--color-surface-selected)',
};

const progressBarOuter: React.CSSProperties = {
  width: '100%',
  height: 6,
  borderRadius: 3,
  background: 'var(--color-bg-tertiary)',
  overflow: 'hidden',
};

const progressBarInner = (pct: number): React.CSSProperties => ({
  width: `${pct}%`,
  height: '100%',
  background: 'var(--color-accent-primary)',
  borderRadius: 3,
  transition: 'width 300ms ease',
});

const fieldRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: 'var(--spacing-sm) 0',
  borderBottom: '1px solid var(--color-border-secondary)',
  fontSize: 'var(--font-size-sm)',
  fontFamily: 'var(--font-family)',
};

const stageLabels: Record<ProgressStage, string> = {
  reading: 'Reading file...',
  extracting: 'Extracting text...',
  ocr: 'Running OCR (this may take a moment)...',
  done: 'Done',
};

const confidenceBadge: Record<Confidence, 'success' | 'warning' | 'error'> = {
  high: 'success',
  medium: 'warning',
  low: 'error',
};

// ─── Component ───────────────────────────────────────────────────

export function PdfImportModal({ open, onClose, onImport }: PdfImportModalProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>('upload');
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStage, setProgressStage] = useState<ProgressStage>('reading');
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedInvoice | null>(null);
  const [method, setMethod] = useState<'digital' | 'ocr'>('digital');

  // ── Reset ──────────────────────────────────────────────────────

  const reset = useCallback(() => {
    setStage('upload');
    setProgress(0);
    setProgressStage('reading');
    setError(null);
    setParsed(null);
    setMethod('digital');
    setDragging(false);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  // ── File processing ────────────────────────────────────────────

  const processFile = useCallback(async (file: File) => {
    if (file.type !== 'application/pdf') {
      setError('Please select a PDF file.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('File size exceeds 20 MB limit.');
      return;
    }

    setError(null);
    setStage('processing');
    setProgress(0);

    try {
      const result = await extractTextFromPdf(file, (pct, s) => {
        setProgress(pct);
        setProgressStage(s);
      });

      setMethod(result.method);
      const invoice = parseInvoiceText(result.text);
      setParsed(invoice);
      setStage('review');
    } catch (err) {
      console.error('PDF extraction failed', err);
      setError('Failed to extract text from this PDF. Please try another file.');
      setStage('upload');
    }
  }, []);

  // ── Drag handlers ──────────────────────────────────────────────

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const onDragLeave = useCallback(() => setDragging(false), []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  // ── Import handler ─────────────────────────────────────────────

  const handleImport = useCallback(() => {
    if (!parsed) return;
    const notes = parsed.vendorName
      ? `Imported from ${parsed.vendorName}${parsed.invoiceNumber ? ` — ${parsed.invoiceNumber}` : ''}`
      : undefined;
    onImport({
      lineItems: parsed.lineItems,
      currency: parsed.currency,
      issueDate: parsed.issueDate,
      dueDate: parsed.dueDate,
      taxPercent: parsed.taxPercent,
      notes,
    });
    handleClose();
  }, [parsed, onImport, handleClose]);

  // ── Render ─────────────────────────────────────────────────────

  return (
    <Modal open={open} onOpenChange={(o) => !o && handleClose()} width={560} title="Import PDF invoice">
      <Modal.Header title={t('invoices.pdfImport.title', 'Import PDF invoice')} />
      <Modal.Body>
        {/* ── Upload stage ── */}
        {stage === 'upload' && (
          <div>
            <div
              style={dragging ? dropzoneActive : dropzoneBase}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
            >
              <Upload size={32} style={{ color: 'var(--color-text-tertiary)' }} />
              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 'var(--font-size-md)',
                    fontWeight: 'var(--font-weight-medium)' as React.CSSProperties['fontWeight'],
                    color: 'var(--color-text-primary)',
                    fontFamily: 'var(--font-family)',
                  }}
                >
                  {t('invoices.pdfImport.dropzone', 'Drag and drop a PDF here, or click to browse')}
                </p>
                <p
                  style={{
                    margin: 'var(--spacing-xs) 0 0',
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-text-tertiary)',
                    fontFamily: 'var(--font-family)',
                  }}
                >
                  PDF only, max 20 MB
                </p>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf"
                style={{ display: 'none' }}
                onChange={onFileChange}
              />
            </div>
            {error && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-sm)',
                  marginTop: 'var(--spacing-md)',
                  color: 'var(--color-error)',
                  fontSize: 'var(--font-size-sm)',
                  fontFamily: 'var(--font-family)',
                }}
              >
                <AlertTriangle size={14} />
                {error}
              </div>
            )}
          </div>
        )}

        {/* ── Processing stage ── */}
        {stage === 'processing' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'var(--spacing-lg)',
              padding: 'var(--spacing-2xl) 0',
            }}
          >
            <FileText size={40} style={{ color: 'var(--color-accent-primary)' }} />
            <div style={{ width: '100%' }}>
              <div style={progressBarOuter}>
                <div style={progressBarInner(progress)} />
              </div>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-family)',
              }}
            >
              {stageLabels[progressStage]}
            </p>
          </div>
        )}

        {/* ── Review stage ── */}
        {stage === 'review' && parsed && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            {/* Confidence + method */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-sm)',
                marginBottom: 'var(--spacing-sm)',
              }}
            >
              <Badge variant={confidenceBadge[parsed.confidence]}>
                {parsed.confidence} confidence
              </Badge>
              <Badge variant="default">
                {method === 'digital' ? 'Digital text' : 'OCR'}
              </Badge>
            </div>

            {/* Extracted fields */}
            <div>
              {parsed.vendorName && (
                <div style={fieldRow}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Vendor</span>
                  <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                    {parsed.vendorName}
                  </span>
                </div>
              )}
              {parsed.invoiceNumber && (
                <div style={fieldRow}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Invoice number</span>
                  <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                    {parsed.invoiceNumber}
                  </span>
                </div>
              )}
              {parsed.currency && (
                <div style={fieldRow}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Currency</span>
                  <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                    {parsed.currency}
                  </span>
                </div>
              )}
              {parsed.issueDate && (
                <div style={fieldRow}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Issue date</span>
                  <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                    {parsed.issueDate}
                  </span>
                </div>
              )}
              {parsed.dueDate && (
                <div style={fieldRow}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Due date</span>
                  <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                    {parsed.dueDate}
                  </span>
                </div>
              )}
              {parsed.total != null && (
                <div style={fieldRow}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Total</span>
                  <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                    {parsed.currency ?? ''} {parsed.total.toFixed(2)}
                  </span>
                </div>
              )}
              {parsed.taxPercent != null && (
                <div style={fieldRow}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Tax</span>
                  <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                    {parsed.taxPercent}%
                  </span>
                </div>
              )}
            </div>

            {/* Line items summary */}
            {parsed.lineItems.length > 0 && (
              <div>
                <p
                  style={{
                    margin: '0 0 var(--spacing-sm)',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 'var(--font-weight-semibold)' as React.CSSProperties['fontWeight'],
                    color: 'var(--color-text-primary)',
                    fontFamily: 'var(--font-family)',
                  }}
                >
                  {parsed.lineItems.length} line item{parsed.lineItems.length !== 1 ? 's' : ''} found
                </p>
                <div
                  style={{
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border-secondary)',
                    overflow: 'hidden',
                  }}
                >
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: 'var(--font-size-xs)',
                      fontFamily: 'var(--font-family)',
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          background: 'var(--color-bg-secondary)',
                          borderBottom: '1px solid var(--color-border-secondary)',
                        }}
                      >
                        <th
                          style={{
                            textAlign: 'left',
                            padding: 'var(--spacing-sm)',
                            color: 'var(--color-text-tertiary)',
                            fontWeight: 500,
                          }}
                        >
                          Description
                        </th>
                        <th
                          style={{
                            textAlign: 'right',
                            padding: 'var(--spacing-sm)',
                            color: 'var(--color-text-tertiary)',
                            fontWeight: 500,
                          }}
                        >
                          Qty
                        </th>
                        <th
                          style={{
                            textAlign: 'right',
                            padding: 'var(--spacing-sm)',
                            color: 'var(--color-text-tertiary)',
                            fontWeight: 500,
                          }}
                        >
                          Unit price
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.lineItems.map((item) => (
                        <tr
                          key={item.id}
                          style={{
                            borderBottom: '1px solid var(--color-border-secondary)',
                          }}
                        >
                          <td
                            style={{
                              padding: 'var(--spacing-sm)',
                              color: 'var(--color-text-primary)',
                              maxWidth: 240,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {item.description}
                          </td>
                          <td
                            style={{
                              textAlign: 'right',
                              padding: 'var(--spacing-sm)',
                              color: 'var(--color-text-secondary)',
                            }}
                          >
                            {item.quantity}
                          </td>
                          <td
                            style={{
                              textAlign: 'right',
                              padding: 'var(--spacing-sm)',
                              color: 'var(--color-text-secondary)',
                            }}
                          >
                            {item.unitPrice.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {parsed.lineItems.length === 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-sm)',
                  padding: 'var(--spacing-md)',
                  background: 'var(--color-bg-secondary)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--color-text-secondary)',
                  fontFamily: 'var(--font-family)',
                }}
              >
                <AlertTriangle size={14} />
                No line items could be extracted. You can still import dates and metadata.
              </div>
            )}
          </div>
        )}
      </Modal.Body>

      {/* Footer — only in review stage */}
      {stage === 'review' && (
        <Modal.Footer>
          <Button variant="secondary" size="sm" onClick={reset}>
            <RefreshCw size={14} style={{ marginRight: 4 }} />
            Try another file
          </Button>
          <Button variant="primary" size="sm" onClick={handleImport}>
            <Download size={14} style={{ marginRight: 4 }} />
            Import to invoice
          </Button>
        </Modal.Footer>
      )}
    </Modal>
  );
}

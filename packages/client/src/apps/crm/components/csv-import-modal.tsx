import { useState, useCallback, useRef, useMemo } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Select } from '../../../components/ui/select';
import { Modal } from '../../../components/ui/modal';
import { Badge } from '../../../components/ui/badge';
import { DataTable, type DataTableColumn } from '../../../components/ui/data-table';
import { api } from '../../../lib/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../config/query-keys';

// ─── Types ──────────────────────────────────────────────────────────

interface CrmField {
  key: string;
  label: string;
  required?: boolean;
}

interface CsvImportModalProps {
  open: boolean;
  onClose: () => void;
  entityType: 'deals' | 'contacts' | 'companies';
  fields: CrmField[];
}

type ImportStatus = 'idle' | 'mapping' | 'importing' | 'done';

// ─── CSV parsing ────────────────────────────────────────────────────

function detectDelimiter(text: string): ',' | '\t' {
  const firstLine = text.split(/\r?\n/)[0] || '';
  const tabs = (firstLine.match(/\t/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  return tabs > commas ? '\t' : ',';
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const delimiter = detectDelimiter(text);
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);

  return { headers, rows };
}

// ─── CSV Export utility ─────────────────────────────────────────────

export function exportToCsv<T extends Record<string, unknown>>(
  data: T[],
  columns: { key: string; label: string }[],
  filename: string,
) {
  const escapeField = (val: unknown): string => {
    if (val == null) return '';
    const str = String(val);
    // Always quote fields that contain commas, quotes, or newlines
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = columns.map((c) => escapeField(c.label)).join(',');
  const rows = data.map((row) =>
    columns.map((col) => escapeField(row[col.key])).join(','),
  );

  // BOM prefix for proper Unicode handling in Excel
  const bom = '\uFEFF';
  const csvContent = bom + [header, ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── TSV Export utility ────────────────────────────────────────────

export function exportToTsv<T extends Record<string, unknown>>(
  data: T[],
  columns: { key: string; label: string }[],
  filename: string,
) {
  const header = columns.map((c) => c.label.replace(/\t/g, ' ')).join('\t');
  const rows = data.map((row) =>
    columns.map((col) => {
      const val = row[col.key];
      if (val == null) return '';
      return String(val).replace(/\t/g, ' ').replace(/\n/g, ' ');
    }).join('\t'),
  );

  const tsvContent = [header, ...rows].join('\n');
  const blob = new Blob([tsvContent], { type: 'text/tab-separated-values;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.tsv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── JSON Export utility ──────────────────────────────────────────

export function exportToJson<T extends Record<string, unknown>>(
  data: T[],
  columns: { key: string; label: string }[],
  filename: string,
) {
  const mapped = data.map((row) => {
    const obj: Record<string, unknown> = {};
    for (const col of columns) {
      obj[col.label] = row[col.key] ?? null;
    }
    return obj;
  });

  const jsonContent = JSON.stringify(mapped, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── XLSX Export utility ─────────────────────────────────────────

export function exportToXlsx<T extends Record<string, unknown>>(
  data: T[],
  columns: { key: string; label: string }[],
  filename: string,
) {
  import('exceljs').then(async (mod) => {
    const ExcelJS = mod.default || mod;
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sheet1');
    worksheet.columns = columns.map((col) => ({ header: col.label, key: col.key }));
    data.forEach((row) => {
      const mappedRow: Record<string, unknown> = {};
      for (const col of columns) {
        mappedRow[col.key] = row[col.key] ?? '';
      }
      worksheet.addRow(mappedRow);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });
}

// ─── CsvImportModal component ───────────────────────────────────────

export function CsvImportModal({ open, onClose, entityType, fields }: CsvImportModalProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<ImportStatus>('idle');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importResults, setImportResults] = useState({ success: 0, failed: 0, errors: [] as string[] });

  const reset = useCallback(() => {
    setStatus('idle');
    setCsvHeaders([]);
    setCsvRows([]);
    setColumnMapping({});
    setImportProgress({ current: 0, total: 0 });
    setImportResults({ success: 0, failed: 0, errors: [] });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const { headers, rows } = parseCSV(text);

      if (headers.length === 0) return;

      setCsvHeaders(headers);
      setCsvRows(rows);

      // Auto-map columns by name similarity
      const autoMap: Record<string, string> = {};
      for (const field of fields) {
        const match = headers.find((h) =>
          h.toLowerCase().replace(/[_\s-]/g, '') === field.key.toLowerCase().replace(/[_\s-]/g, '') ||
          h.toLowerCase().replace(/[_\s-]/g, '') === field.label.toLowerCase().replace(/[_\s-]/g, ''),
        );
        if (match) autoMap[field.key] = match;
      }
      setColumnMapping(autoMap);
      setStatus('mapping');
    };
    reader.readAsText(file);
  }, [fields]);

  const previewRows = useMemo(() => csvRows.slice(0, 5), [csvRows]);

  const mappedFields = useMemo(() =>
    fields.filter((f) => columnMapping[f.key]),
    [fields, columnMapping],
  );

  const hasRequiredMapped = useMemo(() => {
    const requiredFields = fields.filter((f) => f.required);
    return requiredFields.every((f) => columnMapping[f.key]);
  }, [fields, columnMapping]);

  const handleImport = useCallback(async () => {
    setStatus('importing');
    const total = csvRows.length;
    setImportProgress({ current: 0, total });

    // Build row objects from the mapping
    const mappedRows = csvRows.map((row) => {
      const obj: Record<string, string> = {};
      for (const [fieldKey, csvHeader] of Object.entries(columnMapping)) {
        const headerIndex = csvHeaders.indexOf(csvHeader);
        if (headerIndex >= 0 && row[headerIndex] !== undefined) {
          obj[fieldKey] = row[headerIndex];
        }
      }
      return obj;
    });

    // Import in batches of 50
    const batchSize = 50;
    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < mappedRows.length; i += batchSize) {
      const batch = mappedRows.slice(i, i + batchSize);

      try {
        const endpoint = `/crm/${entityType}/import`;
        const { data } = await api.post(endpoint, { rows: batch });

        if (data.success) {
          successCount += data.data?.imported ?? batch.length;
          failCount += data.data?.failed ?? 0;
          if (data.data?.errors) {
            errors.push(...data.data.errors);
          }
        } else {
          failCount += batch.length;
          errors.push(data.error || 'Unknown error');
        }
      } catch (err: unknown) {
        failCount += batch.length;
        errors.push(err instanceof Error ? err.message : 'Network error');
      }

      setImportProgress({ current: Math.min(i + batchSize, total), total });
    }

    setImportResults({ success: successCount, failed: failCount, errors: errors.slice(0, 10) });
    setStatus('done');

    // Invalidate queries to refresh data
    queryClient.invalidateQueries({ queryKey: queryKeys.crm.all });
  }, [csvRows, csvHeaders, columnMapping, entityType, queryClient]);

  const entityLabel = entityType === 'companies' ? 'companies' : entityType;

  return (
    <Modal open={open} onOpenChange={(o) => { if (!o) handleClose(); }} width={640} title={`Import ${entityLabel}`}>
      <Modal.Header
        title={`Import ${entityLabel}`}
        subtitle={
          status === 'idle' ? 'Upload a CSV or TSV file to import records' :
          status === 'mapping' ? `Map CSV columns to ${entityLabel} fields` :
          status === 'importing' ? `Importing ${entityLabel}...` :
          'Import complete'
        }
      />
      <Modal.Body>
        {/* Step 1: File upload */}
        {status === 'idle' && (
          <div
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 'var(--spacing-lg)', padding: 'var(--spacing-2xl)',
              border: '2px dashed var(--color-border-primary)',
              borderRadius: 'var(--radius-lg)', cursor: 'pointer',
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={32} style={{ color: 'var(--color-text-tertiary)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-medium)',
                color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)',
              }}>
                Click to upload file
              </div>
              <div style={{
                fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)',
                fontFamily: 'var(--font-family)', marginTop: 'var(--spacing-xs)',
              }}>
                .csv, .tsv, or .txt files
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.txt"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </div>
        )}

        {/* Step 2: Column mapping */}
        {status === 'mapping' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
              <FileSpreadsheet size={16} style={{ color: 'var(--color-text-tertiary)' }} />
              <span style={{
                fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-family)',
              }}>
                {csvRows.length} row{csvRows.length !== 1 ? 's' : ''} found in CSV
              </span>
            </div>

            {/* Mapping table */}
            <div style={{
              border: '1px solid var(--color-border-secondary)',
              borderRadius: 'var(--radius-md)', overflow: 'hidden',
            }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr',
                borderBottom: '1px solid var(--color-border-secondary)',
                padding: '8px var(--spacing-md)',
                fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-tertiary)', textTransform: 'uppercase',
                letterSpacing: '0.04em', fontFamily: 'var(--font-family)',
              }}>
                <span>CRM field</span>
                <span>CSV column</span>
              </div>
              {fields.map((field) => (
                <div
                  key={field.key}
                  style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr',
                    padding: '6px var(--spacing-md)', alignItems: 'center',
                    borderBottom: '1px solid var(--color-border-secondary)',
                  }}
                >
                  <span style={{
                    fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)',
                    fontFamily: 'var(--font-family)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)',
                  }}>
                    {field.label}
                    {field.required && <span style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-xs)' }}>*</span>}
                  </span>
                  <Select
                    value={columnMapping[field.key] || ''}
                    onChange={(v) => setColumnMapping((prev) => ({ ...prev, [field.key]: v }))}
                    options={[
                      { value: '', label: 'Skip' },
                      ...csvHeaders.map((h) => ({ value: h, label: h })),
                    ]}
                    size="sm"
                  />
                </div>
              ))}
            </div>

            {/* Preview */}
            {previewRows.length > 0 && mappedFields.length > 0 && (
              <div>
                <div style={{
                  fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)',
                  color: 'var(--color-text-tertiary)', textTransform: 'uppercase',
                  letterSpacing: '0.04em', fontFamily: 'var(--font-family)',
                  marginBottom: 'var(--spacing-sm)',
                }}>
                  Preview (first {previewRows.length} rows)
                </div>
                {(() => {
                  // Build typed rows with an id for DataTable
                  type PreviewRow = { id: string } & Record<string, string>;
                  const tableRows: PreviewRow[] = previewRows.map((row, i) => {
                    const obj: PreviewRow = { id: String(i) };
                    for (const f of mappedFields) {
                      const idx = csvHeaders.indexOf(columnMapping[f.key]);
                      obj[f.key] = idx >= 0 ? (row[idx] || '') : '';
                    }
                    return obj;
                  });
                  const columns: DataTableColumn<PreviewRow>[] = mappedFields.map((f) => ({
                    key: f.key,
                    label: f.label,
                    render: (row) => (
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: 150 }}>
                        {row[f.key]}
                      </span>
                    ),
                    searchValue: (row) => row[f.key],
                  }));
                  return (
                    <div className="crm-import-preview">
                      <DataTable
                        data={tableRows}
                        columns={columns}
                        storageKey="crm_csv_preview"
                        paginated={false}
                        searchable={false}
                        hideFooter
                      />
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Importing progress */}
        {status === 'importing' && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 'var(--spacing-lg)', padding: 'var(--spacing-2xl)',
          }}>
            <div style={{
              width: '100%', height: 6, background: 'var(--color-bg-tertiary)',
              borderRadius: 'var(--radius-lg)', overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}%`,
                background: 'var(--color-accent-primary)',
                borderRadius: 'var(--radius-lg)',
                transition: 'width 0.3s ease',
              }} />
            </div>
            <div style={{
              fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-family)',
            }}>
              Importing {importProgress.current} of {importProgress.total}...
            </div>
          </div>
        )}

        {/* Step 4: Results */}
        {status === 'done' && (
          <div style={{
            display: 'flex', flexDirection: 'column',
            gap: 'var(--spacing-md)', padding: 'var(--spacing-md)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
              <CheckCircle2 size={18} style={{ color: 'var(--color-success)' }} />
              <span style={{
                fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)',
              }}>
                Import complete
              </span>
            </div>

            <div style={{ display: 'flex', gap: 'var(--spacing-lg)' }}>
              <div>
                <Badge variant="success">{importResults.success} imported</Badge>
              </div>
              {importResults.failed > 0 && (
                <div>
                  <Badge variant="error">{importResults.failed} failed</Badge>
                </div>
              )}
            </div>

            {importResults.errors.length > 0 && (
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)',
                padding: 'var(--spacing-sm)', background: 'var(--color-bg-secondary)',
                borderRadius: 'var(--radius-md)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                  <AlertCircle size={13} style={{ color: 'var(--color-error)' }} />
                  <span style={{
                    fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)',
                    color: 'var(--color-error)', fontFamily: 'var(--font-family)',
                  }}>
                    Errors
                  </span>
                </div>
                {importResults.errors.map((err, i) => (
                  <div key={i} style={{
                    fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)',
                    fontFamily: 'var(--font-family)',
                  }}>
                    {err}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        {status === 'idle' && (
          <Button variant="ghost" onClick={handleClose}>Cancel</Button>
        )}
        {status === 'mapping' && (
          <>
            <Button variant="ghost" onClick={reset}>Back</Button>
            <Button variant="primary" onClick={handleImport} disabled={!hasRequiredMapped}>
              Import {csvRows.length} row{csvRows.length !== 1 ? 's' : ''}
            </Button>
          </>
        )}
        {status === 'importing' && (
          <Button variant="ghost" disabled>Importing...</Button>
        )}
        {status === 'done' && (
          <Button variant="primary" onClick={handleClose}>Done</Button>
        )}
      </Modal.Footer>
    </Modal>
  );
}

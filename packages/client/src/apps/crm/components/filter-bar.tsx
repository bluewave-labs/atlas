import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X, Filter } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { Chip } from '../../../components/ui/chip';
import { Popover, PopoverTrigger, PopoverContent } from '../../../components/ui/popover';

// ─── Types ──────────────────────────────────────────────────────────

export interface FilterColumn {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'date';
  options?: { value: string; label: string }[];
}

export interface CrmFilter {
  id: string;
  column: string;
  operator: string;
  value: string;
  value2?: string; // for "between" operator
}

interface FilterBarProps {
  columns: FilterColumn[];
  filters: CrmFilter[];
  onFiltersChange: (filters: CrmFilter[]) => void;
}

// ─── Operators per type ─────────────────────────────────────────────

const OPERATORS: Record<FilterColumn['type'], { value: string; label: string }[]> = {
  text: [
    { value: 'contains', label: 'Contains' },
    { value: 'equals', label: 'Equals' },
    { value: 'starts_with', label: 'Starts with' },
    { value: 'is_empty', label: 'Is empty' },
  ],
  number: [
    { value: 'equals', label: 'Equals' },
    { value: 'greater_than', label: 'Greater than' },
    { value: 'less_than', label: 'Less than' },
    { value: 'between', label: 'Between' },
  ],
  select: [
    { value: 'is', label: 'Is' },
    { value: 'is_not', label: 'Is not' },
  ],
  date: [
    { value: 'is', label: 'Is' },
    { value: 'before', label: 'Before' },
    { value: 'after', label: 'After' },
    { value: 'between', label: 'Between' },
  ],
};

// ─── Helpers ────────────────────────────────────────────────────────

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function getOperatorLabel(type: FilterColumn['type'], operator: string): string {
  const ops = OPERATORS[type] || OPERATORS.text;
  return ops.find((o) => o.value === operator)?.label || operator;
}

function getDisplayValue(column: FilterColumn, filter: CrmFilter): string {
  if (filter.operator === 'is_empty') return '';
  if (filter.operator === 'between') {
    return `${filter.value} - ${filter.value2 || ''}`;
  }
  if (column.type === 'select' && column.options) {
    return column.options.find((o) => o.value === filter.value)?.label || filter.value;
  }
  return filter.value;
}

// ─── Single filter editor (inside popover) ──────────────────────────

function FilterEditor({
  filter,
  columns,
  onChange,
  onRemove,
}: {
  filter: CrmFilter;
  columns: FilterColumn[];
  onChange: (f: CrmFilter) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const column = columns.find((c) => c.key === filter.column);
  const colType = column?.type || 'text';
  const operators = OPERATORS[colType] || OPERATORS.text;
  const needsValue = filter.operator !== 'is_empty';
  const needsValue2 = filter.operator === 'between';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)',
      padding: 'var(--spacing-md)', minWidth: 280,
    }}>
      <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
        <Select
          value={filter.column}
          onChange={(v) => onChange({ ...filter, column: v, value: '', value2: undefined })}
          options={columns.map((c) => ({ value: c.key, label: c.label }))}
          size="sm"
        />
        <Select
          value={filter.operator}
          onChange={(v) => onChange({ ...filter, operator: v })}
          options={operators}
          size="sm"
        />
      </div>

      {needsValue && (
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
          {colType === 'select' && column?.options ? (
            <Select
              value={filter.value}
              onChange={(v) => onChange({ ...filter, value: v })}
              options={column.options}
              size="sm"
            />
          ) : (
            <Input
              type={colType === 'number' ? 'number' : colType === 'date' ? 'date' : 'text'}
              value={filter.value}
              onChange={(e) => onChange({ ...filter, value: e.target.value })}
              placeholder={colType === 'date' ? '' : 'Value...'}
              size="sm"
              style={{ flex: 1 }}
            />
          )}
          {needsValue2 && (
            <Input
              type={colType === 'number' ? 'number' : 'date'}
              value={filter.value2 || ''}
              onChange={(e) => onChange({ ...filter, value2: e.target.value })}
              placeholder={colType === 'date' ? '' : 'To...'}
              size="sm"
              style={{ flex: 1 }}
            />
          )}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="ghost" size="sm" onClick={onRemove}>
          {t('common.remove')}
        </Button>
      </div>
    </div>
  );
}

// ─── FilterBar component ────────────────────────────────────────────

export function FilterBar({ columns, filters, onFiltersChange }: FilterBarProps) {
  const { t } = useTranslation();
  const [addOpen, setAddOpen] = useState(false);
  const [editingFilterId, setEditingFilterId] = useState<string | null>(null);

  const addFilter = useCallback((columnKey: string) => {
    const col = columns.find((c) => c.key === columnKey);
    if (!col) return;
    const ops = OPERATORS[col.type] || OPERATORS.text;
    const newFilter: CrmFilter = {
      id: generateId(),
      column: columnKey,
      operator: ops[0].value,
      value: '',
    };
    onFiltersChange([...filters, newFilter]);
    setAddOpen(false);
    setEditingFilterId(newFilter.id);
  }, [columns, filters, onFiltersChange]);

  const updateFilter = useCallback((updated: CrmFilter) => {
    onFiltersChange(filters.map((f) => f.id === updated.id ? updated : f));
  }, [filters, onFiltersChange]);

  const removeFilter = useCallback((id: string) => {
    onFiltersChange(filters.filter((f) => f.id !== id));
    setEditingFilterId(null);
  }, [filters, onFiltersChange]);

  const clearAll = useCallback(() => {
    onFiltersChange([]);
    setEditingFilterId(null);
  }, [onFiltersChange]);

  // Column label lookup
  const colMap = useMemo(() => {
    const map: Record<string, FilterColumn> = {};
    for (const c of columns) map[c.key] = c;
    return map;
  }, [columns]);

  if (filters.length === 0) {
    return (
      <Popover open={addOpen} onOpenChange={setAddOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" icon={<Filter size={13} />}>
            Filter
          </Button>
        </PopoverTrigger>
        <PopoverContent width={220} align="start">
          <div style={{ padding: 'var(--spacing-sm)', display: 'flex', flexDirection: 'column' }}>
            <div style={{
              fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-text-tertiary)', padding: 'var(--spacing-xs) var(--spacing-sm)',
              textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-family)',
            }}>
              {t('crm.actions.filterBy')}
            </div>
            {columns.map((col) => (
              <button
                key={col.key}
                onClick={() => addFilter(col.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)',
                  padding: '6px var(--spacing-sm)', borderRadius: 'var(--radius-md)',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-family)', width: '100%', textAlign: 'left',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                {col.label}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div className="crm-filter-bar">
      <Filter size={13} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-xs)', alignItems: 'center' }}>
        {filters.map((filter) => {
          const col = colMap[filter.column];
          if (!col) return null;
          const label = `${col.label} ${getOperatorLabel(col.type, filter.operator).toLowerCase()}`;
          const displayVal = getDisplayValue(col, filter);

          return (
            <Popover
              key={filter.id}
              open={editingFilterId === filter.id}
              onOpenChange={(open) => setEditingFilterId(open ? filter.id : null)}
            >
              <PopoverTrigger asChild>
                <span>
                  <Chip
                    onRemove={() => removeFilter(filter.id)}
                    onClick={() => setEditingFilterId(filter.id)}
                    active={editingFilterId === filter.id}
                  >
                    {label}{displayVal ? ` "${displayVal}"` : ''}
                  </Chip>
                </span>
              </PopoverTrigger>
              <PopoverContent align="start">
                <FilterEditor
                  filter={filter}
                  columns={columns}
                  onChange={updateFilter}
                  onRemove={() => removeFilter(filter.id)}
                />
              </PopoverContent>
            </Popover>
          );
        })}

        <Popover open={addOpen} onOpenChange={setAddOpen}>
          <PopoverTrigger asChild>
            <button
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)',
                fontFamily: 'var(--font-family)', padding: '2px 6px', borderRadius: 'var(--radius-sm)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-tertiary)'; }}
            >
              <Plus size={11} /> {t('crm.actions.addFilter')}
            </button>
          </PopoverTrigger>
          <PopoverContent width={220} align="start">
            <div style={{ padding: 'var(--spacing-sm)', display: 'flex', flexDirection: 'column' }}>
              <div style={{
                fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-tertiary)', padding: 'var(--spacing-xs) var(--spacing-sm)',
                textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-family)',
              }}>
                {t('crm.actions.filterBy')}
              </div>
              {columns.map((col) => (
                <button
                  key={col.key}
                  onClick={() => addFilter(col.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)',
                    padding: '6px var(--spacing-sm)', borderRadius: 'var(--radius-md)',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)',
                    fontFamily: 'var(--font-family)', width: '100%', textAlign: 'left',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-hover)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  {col.label}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <button
        onClick={clearAll}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 3,
          background: 'transparent', border: 'none', cursor: 'pointer',
          fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)',
          fontFamily: 'var(--font-family)', marginLeft: 'auto', padding: '2px 6px',
          borderRadius: 'var(--radius-sm)', flexShrink: 0,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-tertiary)'; }}
      >
        <X size={11} /> {t('crm.actions.clearFilters')}
      </button>
    </div>
  );
}

// ─── Filter application utility ─────────────────────────────────────

export function applyFilters<T extends Record<string, unknown>>(
  data: T[],
  filters: CrmFilter[],
  columns: FilterColumn[],
): T[] {
  if (filters.length === 0) return data;

  const colMap: Record<string, FilterColumn> = {};
  for (const c of columns) colMap[c.key] = c;

  return data.filter((row) => {
    return filters.every((filter) => {
      const col = colMap[filter.column];
      if (!col) return true;

      const rawValue = row[filter.column];
      const strValue = rawValue != null ? String(rawValue) : '';
      const numValue = rawValue != null ? Number(rawValue) : NaN;

      switch (col.type) {
        case 'text': {
          const lowerVal = strValue.toLowerCase();
          const lowerFilter = filter.value.toLowerCase();
          switch (filter.operator) {
            case 'contains': return lowerVal.includes(lowerFilter);
            case 'equals': return lowerVal === lowerFilter;
            case 'starts_with': return lowerVal.startsWith(lowerFilter);
            case 'is_empty': return !strValue || strValue.trim() === '';
            default: return true;
          }
        }
        case 'number': {
          const filterNum = Number(filter.value);
          switch (filter.operator) {
            case 'equals': return numValue === filterNum;
            case 'greater_than': return numValue > filterNum;
            case 'less_than': return numValue < filterNum;
            case 'between': {
              const filterNum2 = Number(filter.value2);
              return numValue >= filterNum && numValue <= filterNum2;
            }
            default: return true;
          }
        }
        case 'select': {
          switch (filter.operator) {
            case 'is': return strValue === filter.value;
            case 'is_not': return strValue !== filter.value;
            default: return true;
          }
        }
        case 'date': {
          const dateVal = strValue ? new Date(strValue).getTime() : 0;
          const filterDate = filter.value ? new Date(filter.value).getTime() : 0;
          switch (filter.operator) {
            case 'is': return dateVal === filterDate;
            case 'before': return dateVal < filterDate;
            case 'after': return dateVal > filterDate;
            case 'between': {
              const filterDate2 = filter.value2 ? new Date(filter.value2).getTime() : 0;
              return dateVal >= filterDate && dateVal <= filterDate2;
            }
            default: return true;
          }
        }
        default: return true;
      }
    });
  });
}

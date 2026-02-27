import { useTranslation } from 'react-i18next';
import * as Popover from '@radix-ui/react-popover';
import { Filter, Plus, X } from 'lucide-react';
import type { TableColumn, TableViewConfig, TableFieldType } from '@atlasmail/shared';

interface FilterRule {
  columnId: string;
  operator: string;
  value: unknown;
}

function getOperatorsForType(type: TableFieldType): { value: string; labelKey: string }[] {
  switch (type) {
    case 'text':
    case 'longText':
    case 'email':
    case 'url':
    case 'phone':
      return [
        { value: 'contains', labelKey: 'tables.contains' },
        { value: 'doesNotContain', labelKey: 'tables.doesNotContain' },
        { value: 'is', labelKey: 'tables.is' },
        { value: 'isNot', labelKey: 'tables.isNot' },
        { value: 'isEmpty', labelKey: 'tables.isEmpty' },
        { value: 'isNotEmpty', labelKey: 'tables.isNotEmpty' },
      ];
    case 'number':
    case 'currency':
    case 'percent':
    case 'rating':
      return [
        { value: 'is', labelKey: 'tables.is' },
        { value: 'isNot', labelKey: 'tables.isNot' },
        { value: 'greaterThan', labelKey: 'tables.greaterThan' },
        { value: 'lessThan', labelKey: 'tables.lessThan' },
        { value: 'isEmpty', labelKey: 'tables.isEmpty' },
        { value: 'isNotEmpty', labelKey: 'tables.isNotEmpty' },
      ];
    case 'singleSelect':
    case 'multiSelect':
      return [
        { value: 'is', labelKey: 'tables.is' },
        { value: 'isNot', labelKey: 'tables.isNot' },
        { value: 'isAnyOf', labelKey: 'tables.isAnyOf' },
        { value: 'isEmpty', labelKey: 'tables.isEmpty' },
        { value: 'isNotEmpty', labelKey: 'tables.isNotEmpty' },
      ];
    case 'checkbox':
      return [
        { value: 'isChecked', labelKey: 'tables.isChecked' },
        { value: 'isNotChecked', labelKey: 'tables.isNotChecked' },
      ];
    case 'date':
      return [
        { value: 'is', labelKey: 'tables.is' },
        { value: 'isBefore', labelKey: 'tables.isBefore' },
        { value: 'isAfter', labelKey: 'tables.isAfter' },
        { value: 'isEmpty', labelKey: 'tables.isEmpty' },
        { value: 'isNotEmpty', labelKey: 'tables.isNotEmpty' },
      ];
    default:
      return [
        { value: 'contains', labelKey: 'tables.contains' },
        { value: 'isEmpty', labelKey: 'tables.isEmpty' },
      ];
  }
}

const noValueOperators = new Set(['isEmpty', 'isNotEmpty', 'isChecked', 'isNotChecked']);

interface FilterPopoverProps {
  columns: TableColumn[];
  viewConfig: TableViewConfig;
  onUpdate: (filters: FilterRule[]) => void;
}

export function FilterPopover({ columns, viewConfig, onUpdate }: FilterPopoverProps) {
  const { t } = useTranslation();
  const filters = (viewConfig.filters || []) as FilterRule[];

  const handleAdd = () => {
    if (columns.length === 0) return;
    const col = columns[0];
    const ops = getOperatorsForType(col.type);
    onUpdate([...filters, { columnId: col.id, operator: ops[0]?.value || 'contains', value: '' }]);
  };

  const handleRemove = (idx: number) => {
    onUpdate(filters.filter((_, i) => i !== idx));
  };

  const handleChange = (idx: number, field: 'columnId' | 'operator' | 'value', value: unknown) => {
    const updated = filters.map((f, i) => {
      if (i !== idx) return f;
      const newFilter = { ...f, [field]: value };
      // Reset operator when column changes
      if (field === 'columnId') {
        const col = columns.find((c) => c.id === value);
        if (col) {
          const ops = getOperatorsForType(col.type);
          newFilter.operator = ops[0]?.value || 'contains';
          newFilter.value = '';
        }
      }
      return newFilter;
    });
    onUpdate(updated);
  };

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          className={`tables-toolbar-btn${filters.length > 0 ? ' active' : ''}`}
          title={t('tables.filter')}
        >
          <Filter size={14} />
          {t('tables.filter')}
          {filters.length > 0 && <span className="tables-toolbar-badge">{filters.length}</span>}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="tables-popover-content"
          sideOffset={4}
          align="start"
        >
          <div className="tables-popover-header">
            <span>{t('tables.filter')}</span>
          </div>

          {filters.length === 0 ? (
            <div className="tables-popover-empty">{t('tables.noFilters')}</div>
          ) : (
            <div className="tables-popover-list">
              {filters.map((filter, idx) => {
                const col = columns.find((c) => c.id === filter.columnId);
                const ops = col ? getOperatorsForType(col.type) : [];
                const hideValue = noValueOperators.has(filter.operator);

                return (
                  <div key={idx} className="tables-popover-rule">
                    <select
                      value={filter.columnId}
                      onChange={(e) => handleChange(idx, 'columnId', e.target.value)}
                    >
                      {columns.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <select
                      value={filter.operator}
                      onChange={(e) => handleChange(idx, 'operator', e.target.value)}
                    >
                      {ops.map((op) => (
                        <option key={op.value} value={op.value}>{t(op.labelKey)}</option>
                      ))}
                    </select>
                    {!hideValue && (
                      <input
                        value={filter.value != null ? String(filter.value) : ''}
                        onChange={(e) => handleChange(idx, 'value', e.target.value)}
                        placeholder="Value"
                      />
                    )}
                    <button className="tables-popover-rule-remove" onClick={() => handleRemove(idx)}>
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <button className="tables-popover-add" onClick={handleAdd}>
            <Plus size={14} />
            {t('tables.addFilter')}
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

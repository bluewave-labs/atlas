import { useTranslation } from 'react-i18next';
import { Rows3, Check } from 'lucide-react';
import type { TableViewConfig } from '@atlasmail/shared';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';

type RowHeightKey = 'short' | 'medium' | 'tall' | 'extraTall';

const ROW_HEIGHT_OPTIONS: { key: RowHeightKey; labelKey: string; px: number }[] = [
  { key: 'short', labelKey: 'tables.short', px: 28 },
  { key: 'medium', labelKey: 'tables.medium', px: 36 },
  { key: 'tall', labelKey: 'tables.tall', px: 52 },
  { key: 'extraTall', labelKey: 'tables.extraTall', px: 72 },
];

interface RowHeightPopoverProps {
  viewConfig: TableViewConfig;
  onUpdate: (rowHeight: RowHeightKey) => void;
}

export function RowHeightPopover({ viewConfig, onUpdate }: RowHeightPopoverProps) {
  const { t } = useTranslation();
  const current = viewConfig.rowHeight || 'medium';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="tables-toolbar-btn" title={t('tables.rowHeight')}>
          <Rows3 size={14} />
          {t('tables.rowHeight')}
        </button>
      </PopoverTrigger>
      <PopoverContent sideOffset={4} align="start" minWidth={180} style={{ padding: 8 }}>
        <div className="popover-header">{t('tables.rowHeight')}</div>
        {ROW_HEIGHT_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            className={`context-menu-item${current === opt.key ? ' active' : ''}`}
            onClick={() => onUpdate(opt.key)}
          >
            {current === opt.key && <Check size={14} />}
            <span>{t(opt.labelKey)}</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-text-tertiary)' }}>{opt.px}px</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

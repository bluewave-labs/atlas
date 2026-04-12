import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useTablesSettingsStore,
  type TablesDefaultView,
  type TablesDefaultSort,
  type DateFormat,
} from '../settings-store';
import {
  SettingsSection,
  SettingsRow,
  SettingsToggle,
  SettingsSelect,
} from '../../../components/settings/settings-primitives';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

const DEFAULT_VIEW_OPTIONS: Array<{ value: TablesDefaultView; label: string }> = [
  { value: 'grid', label: 'Grid' },
  { value: 'kanban', label: 'Kanban' },
  { value: 'calendar', label: 'Calendar' },
  { value: 'gallery', label: 'Gallery' },
];

const DEFAULT_SORT_OPTIONS: Array<{ value: TablesDefaultSort; label: string }> = [
  { value: 'none', label: 'None (manual order)' },
  { value: 'createdDate', label: 'By created date' },
  { value: 'alphabetical', label: 'Alphabetical' },
];

const ROW_COUNT_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: 'None (empty table)' },
  { value: 3, label: '3 rows' },
  { value: 5, label: '5 rows' },
  { value: 10, label: '10 rows' },
];

const DATE_FORMAT_OPTIONS: Array<{ value: DateFormat; label: string }> = [
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (ISO)' },
];

const CURRENCY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '$', label: '$ (USD)' },
  { value: '€', label: '€ (EUR)' },
  { value: '£', label: '£ (GBP)' },
  { value: '¥', label: '¥ (JPY/CNY)' },
  { value: '₹', label: '₹ (INR)' },
  { value: 'R$', label: 'R$ (BRL)' },
  { value: '₩', label: '₩ (KRW)' },
  { value: 'CHF', label: 'CHF (CHF)' },
  { value: 'A$', label: 'A$ (AUD)' },
  { value: 'C$', label: 'C$ (CAD)' },
];

const TIMEZONE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Auto (browser default)' },
  { value: 'America/New_York', label: 'Eastern (ET)' },
  { value: 'America/Chicago', label: 'Central (CT)' },
  { value: 'America/Denver', label: 'Mountain (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
  { value: 'America/Anchorage', label: 'Alaska (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii (HT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Central Europe (CET)' },
  { value: 'Europe/Helsinki', label: 'Eastern Europe (EET)' },
  { value: 'Europe/Istanbul', label: 'Istanbul (TRT)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'Asia/Shanghai', label: 'China (CST)' },
  { value: 'Asia/Tokyo', label: 'Japan (JST)' },
  { value: 'Asia/Seoul', label: 'Korea (KST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
  { value: 'Pacific/Auckland', label: 'New Zealand (NZST)' },
];

// ---------------------------------------------------------------------------
// Panel: General
// ---------------------------------------------------------------------------

export function TablesGeneralPanel(): ReactElement {
  const { t } = useTranslation();
  const {
    defaultView, setDefaultView,
    defaultSort, setDefaultSort,
    showFieldTypeIcons, setShowFieldTypeIcons,
    defaultRowCount, setDefaultRowCount,
    includeRowIdsInExport, setIncludeRowIdsInExport,
  } = useTablesSettingsStore();

  return (
    <div>
      <SettingsSection title={t('tables.settings.newTables')} description={t('tables.settings.newTablesDesc')}>
        <SettingsRow label={t('tables.settings.defaultView')} description={t('tables.settings.defaultViewDesc')}>
          <SettingsSelect
            value={defaultView}
            options={DEFAULT_VIEW_OPTIONS}
            onChange={setDefaultView}
          />
        </SettingsRow>
        <SettingsRow label={t('tables.settings.defaultSort')} description={t('tables.settings.defaultSortDesc')}>
          <SettingsSelect
            value={defaultSort}
            options={DEFAULT_SORT_OPTIONS}
            onChange={setDefaultSort}
          />
        </SettingsRow>
        <SettingsRow label={t('tables.settings.defaultEmptyRows')} description={t('tables.settings.defaultEmptyRowsDesc')}>
          <SettingsSelect
            value={defaultRowCount}
            options={ROW_COUNT_OPTIONS}
            onChange={(v) => setDefaultRowCount(Number(v))}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title={t('tables.settings.display')} description={t('tables.settings.displayDesc')}>
        <SettingsRow label={t('tables.settings.fieldTypeIcons')} description={t('tables.settings.fieldTypeIconsDesc')}>
          <SettingsToggle checked={showFieldTypeIcons} onChange={setShowFieldTypeIcons} label={t('tables.settings.fieldTypeIcons')} />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title={t('tables.settings.export')} description={t('tables.settings.exportDesc')}>
        <SettingsRow label={t('tables.settings.includeRowIds')} description={t('tables.settings.includeRowIdsDesc')}>
          <SettingsToggle checked={includeRowIdsInExport} onChange={setIncludeRowIdsInExport} label={t('tables.settings.includeRowIds')} />
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel: Regional (global settings shown under Tables)
// ---------------------------------------------------------------------------

export function TablesRegionalPanel(): ReactElement {
  const { t } = useTranslation();
  const {
    dateFormat, setDateFormat,
    currencySymbol, setCurrencySymbol,
    timezone, setTimezone,
  } = useTablesSettingsStore();

  return (
    <div>
      <SettingsSection title={t('tables.settings.dateTime')} description={t('tables.settings.dateTimeDesc')}>
        <SettingsRow label={t('tables.settings.dateFormat')} description={t('tables.settings.dateFormatDesc')}>
          <SettingsSelect
            value={dateFormat}
            options={DATE_FORMAT_OPTIONS}
            onChange={setDateFormat}
          />
        </SettingsRow>
        <SettingsRow label={t('tables.settings.timezone')} description={t('tables.settings.timezoneDesc')}>
          <SettingsSelect
            value={timezone}
            options={TIMEZONE_OPTIONS}
            onChange={setTimezone}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title={t('tables.settings.currency')} description={t('tables.settings.currencyDesc')}>
        <SettingsRow label={t('tables.settings.currencySymbol')} description={t('tables.settings.currencySymbolDesc')}>
          <SettingsSelect
            value={currencySymbol}
            options={CURRENCY_OPTIONS}
            onChange={setCurrencySymbol}
          />
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}

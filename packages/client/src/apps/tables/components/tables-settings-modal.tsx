import type { ReactElement } from 'react';
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
  const {
    defaultView, setDefaultView,
    defaultSort, setDefaultSort,
    showFieldTypeIcons, setShowFieldTypeIcons,
    defaultRowCount, setDefaultRowCount,
    includeRowIdsInExport, setIncludeRowIdsInExport,
  } = useTablesSettingsStore();

  return (
    <div>
      <SettingsSection title="New tables" description="Defaults applied when creating a new table.">
        <SettingsRow label="Default view" description="Which view to open when creating a new table.">
          <SettingsSelect
            value={defaultView}
            options={DEFAULT_VIEW_OPTIONS}
            onChange={setDefaultView}
          />
        </SettingsRow>
        <SettingsRow label="Default sort" description="Initial sort order for new tables.">
          <SettingsSelect
            value={defaultSort}
            options={DEFAULT_SORT_OPTIONS}
            onChange={setDefaultSort}
          />
        </SettingsRow>
        <SettingsRow label="Default empty rows" description="Number of blank rows added to new tables.">
          <SettingsSelect
            value={defaultRowCount}
            options={ROW_COUNT_OPTIONS}
            onChange={(v) => setDefaultRowCount(Number(v))}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Display" description="How data is displayed in the grid.">
        <SettingsRow label="Field type icons" description="Show type icons in column headers (text, number, date, etc.).">
          <SettingsToggle checked={showFieldTypeIcons} onChange={setShowFieldTypeIcons} label="Field type icons" />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Export" description="Options for exporting tables to Excel or CSV.">
        <SettingsRow label="Include row IDs" description="Add a hidden _id column when exporting to Excel.">
          <SettingsToggle checked={includeRowIdsInExport} onChange={setIncludeRowIdsInExport} label="Include row IDs" />
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel: Regional (global settings shown under Tables)
// ---------------------------------------------------------------------------

export function TablesRegionalPanel(): ReactElement {
  const {
    dateFormat, setDateFormat,
    currencySymbol, setCurrencySymbol,
    timezone, setTimezone,
  } = useTablesSettingsStore();

  return (
    <div>
      <SettingsSection title="Date & time" description="These settings apply across all apps.">
        <SettingsRow label="Date format" description="How dates are displayed everywhere in the app.">
          <SettingsSelect
            value={dateFormat}
            options={DATE_FORMAT_OPTIONS}
            onChange={setDateFormat}
          />
        </SettingsRow>
        <SettingsRow label="Timezone" description="Default timezone for date fields. Leave on auto to use your browser's timezone.">
          <SettingsSelect
            value={timezone}
            options={TIMEZONE_OPTIONS}
            onChange={setTimezone}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Currency" description="These settings apply across all apps.">
        <SettingsRow label="Currency symbol" description="Symbol used for currency fields in tables and other apps.">
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

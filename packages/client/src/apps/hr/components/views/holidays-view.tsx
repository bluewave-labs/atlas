import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Download, Pencil, Check, X, Info } from 'lucide-react';
import { useHolidayCalendars, useCreateHolidayCalendar, useHolidays, useCreateHoliday, useUpdateHoliday, useDeleteHoliday, useBulkImportHolidays } from '../../hooks';
import type { HrHoliday } from '../../hooks';
import { useAppActions } from '../../../../hooks/use-app-permissions';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Select } from '../../../../components/ui/select';
import { Badge } from '../../../../components/ui/badge';
import { IconButton } from '../../../../components/ui/icon-button';
import { FeatureEmptyState } from '../../../../components/ui/feature-empty-state';
import { Popover, PopoverTrigger, PopoverContent } from '../../../../components/ui/popover';
import { useToastStore } from '../../../../stores/toast-store';
import { formatDate } from '../../../../lib/format';
import { COUNTRY_HOLIDAY_PACKS } from '../../lib/country-holidays';

const typeColors: Record<string, string> = {
  public: 'var(--color-error)',
  company: 'var(--color-accent-primary)',
  optional: 'var(--color-warning)',
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getMonthIndex(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00');
  return d.getMonth();
}

function formatShortDate(dateStr: string, locale: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

function getMonthName(monthIndex: number, locale: string): string {
  const d = new Date(2026, monthIndex, 1);
  return d.toLocaleDateString(locale, { month: 'long' });
}

export function HolidaysView() {
  const { t, i18n } = useTranslation();
  const { addToast } = useToastStore();
  const { canDelete, role: hrRole } = useAppActions('hr');
  const { data: calendars } = useHolidayCalendars();
  const createCalendar = useCreateHolidayCalendar();

  const currentYear = new Date().getFullYear();
  const yearTabs = [currentYear, currentYear + 1, currentYear + 2];
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // Derive calendarId from selectedYear
  const selectedCalendarId = useMemo(() => {
    if (!calendars) return null;
    const match = calendars.find((c) => c.year === selectedYear);
    return match ? match.id : null;
  }, [calendars, selectedYear]);

  const { data: holidays } = useHolidays(selectedCalendarId ?? undefined);
  const createHoliday = useCreateHoliday();
  const updateHoliday = useUpdateHoliday();
  const deleteHoliday = useDeleteHoliday();
  const bulkImport = useBulkImportHolidays();
  const [showAddHoliday, setShowAddHoliday] = useState(false);
  const [hName, setHName] = useState('');
  const [hDate, setHDate] = useState('');
  const [hType, setHType] = useState('public');
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const importingRef = useRef(false);

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editType, setEditType] = useState('public');

  const startEditing = (h: { id: string; name: string; date: string; type: string }) => {
    setEditingId(h.id);
    setEditName(h.name);
    setEditDate(h.date);
    setEditType(h.type);
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const saveEditing = () => {
    if (!editingId || !editName.trim() || !editDate) return;
    updateHoliday.mutate({ id: editingId, name: editName.trim(), date: editDate, type: editType }, {
      onSuccess: () => setEditingId(null),
    });
  };

  // Auto-create calendar for selected year if it doesn't exist
  const [autoCreating, setAutoCreating] = useState(false);
  useEffect(() => {
    if (!calendars || autoCreating) return;
    const exists = calendars.some((c) => c.year === selectedYear);
    if (!exists) {
      setAutoCreating(true);
      createCalendar.mutate(
        { name: `${t('hr.holidays.calendar')} ${selectedYear}`, year: selectedYear, isDefault: selectedYear === currentYear },
        { onSettled: () => setAutoCreating(false) },
      );
    }
  }, [calendars, selectedYear]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddHoliday = () => {
    if (!hName.trim() || !hDate || !selectedCalendarId) return;
    createHoliday.mutate({ calendarId: selectedCalendarId, name: hName.trim(), date: hDate, type: hType }, {
      onSuccess: () => { setShowAddHoliday(false); setHName(''); setHDate(''); },
    });
  };

  const handleImportCountry = async (countryCode: string) => {
    if (!selectedCalendarId || importingRef.current) return;
    importingRef.current = true;
    setImporting(countryCode);
    const pack = COUNTRY_HOLIDAY_PACKS.find((p) => p.countryCode === countryCode);
    if (!pack) {
      importingRef.current = false;
      setImporting(null);
      return;
    }

    try {
      const result = await bulkImport.mutateAsync({
        calendarId: selectedCalendarId,
        holidays: pack.holidays.map(h => ({ name: h.name, date: h.date, type: h.type })),
      });
      addToast({
        type: 'success',
        message: t('hr.holidays.importSuccess', { count: result.length, country: pack.countryName }),
      });
    } catch {
      addToast({ type: 'error', message: t('hr.holidays.importFailed') });
    } finally {
      setImporting(null);
      setImportOpen(false);
      importingRef.current = false;
    }
  };

  // Group holidays by month
  const groupedByMonth = useMemo(() => {
    if (!holidays || holidays.length === 0) return [];
    const sorted = [...holidays].sort((a, b) => a.date.localeCompare(b.date));
    const groups: Array<{ monthIndex: number; monthName: string; holidays: HrHoliday[] }> = [];
    let currentGroup: (typeof groups)[0] | null = null;

    for (const h of sorted) {
      const mi = getMonthIndex(h.date);
      if (!currentGroup || currentGroup.monthIndex !== mi) {
        currentGroup = { monthIndex: mi, monthName: getMonthName(mi, i18n.language), holidays: [] };
        groups.push(currentGroup);
      }
      currentGroup.holidays.push(h);
    }
    return groups;
  }, [holidays, i18n.language]);

  // Count summary
  const counts = useMemo(() => {
    if (!holidays) return { total: 0, public: 0, company: 0, optional: 0 };
    return {
      total: holidays.length,
      public: holidays.filter((h) => h.type === 'public').length,
      company: holidays.filter((h) => h.type === 'company').length,
      optional: holidays.filter((h) => h.type === 'optional').length,
    };
  }, [holidays]);

  const showYearNote = selectedYear > currentYear;

  const isViewer = hrRole === 'viewer';

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 'var(--spacing-xl)' }}>
      {isViewer && (
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 'var(--spacing-xs)',
          marginBottom: 'var(--spacing-lg)',
          padding: 'var(--spacing-xs) var(--spacing-sm)',
          background: 'var(--color-surface-hover)',
          borderRadius: 'var(--radius-sm)',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-family)',
        }}>
          <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          {t('hr.readOnlyNotice')}
        </div>
      )}
      {/* Year tabs */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        borderBottom: '1px solid var(--color-border-secondary)',
        marginBottom: 'var(--spacing-lg)',
      }}>
        {yearTabs.map((year) => (
          <button
            key={year}
            onClick={() => setSelectedYear(year)}
            style={{
              padding: 'var(--spacing-sm) var(--spacing-xl)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: selectedYear === year ? 'var(--font-weight-semibold)' : 'var(--font-weight-medium)',
              fontFamily: 'var(--font-family)',
              color: selectedYear === year ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
              background: 'transparent',
              border: 'none',
              borderBottom: selectedYear === year ? '2px solid var(--color-accent-primary)' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              marginBottom: -1,
            }}
          >
            {year}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {selectedCalendarId && (
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xs)' }}>
            <Popover open={importOpen} onOpenChange={setImportOpen}>
              <PopoverTrigger asChild>
                <Button variant="secondary" size="sm" icon={<Download size={14} />}>
                  {t('hr.holidays.importHolidays')}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" style={{ width: 300, padding: 0 }}>
                <div style={{ padding: 'var(--spacing-md) var(--spacing-lg)', borderBottom: '1px solid var(--color-border-secondary)' }}>
                  <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                    {t('hr.holidays.importTitle')}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)', marginTop: 2 }}>
                    {t('hr.holidays.importDesc')}
                  </div>
                  {showYearNote && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 'var(--spacing-xs)',
                      marginTop: 'var(--spacing-sm)',
                      padding: 'var(--spacing-xs) var(--spacing-sm)',
                      background: 'var(--color-surface-hover)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--color-text-secondary)',
                      fontFamily: 'var(--font-family)',
                    }}>
                      <Info size={12} style={{ flexShrink: 0, marginTop: 1 }} />
                      {t('hr.holidays.yearNote', { year: selectedYear })}
                    </div>
                  )}
                </div>
                <div style={{ maxHeight: 320, overflow: 'auto' }}>
                  {COUNTRY_HOLIDAY_PACKS.map((pack) => (
                    <button
                      key={pack.countryCode}
                      onClick={() => handleImportCountry(pack.countryCode)}
                      disabled={importing !== null}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-md)',
                        width: '100%',
                        padding: 'var(--spacing-sm) var(--spacing-lg)',
                        border: 'none',
                        background: importing === pack.countryCode ? 'var(--color-surface-selected)' : 'transparent',
                        cursor: importing !== null ? 'wait' : 'pointer',
                        textAlign: 'left',
                        fontFamily: 'var(--font-family)',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={(e) => { if (!importing) e.currentTarget.style.background = 'var(--color-surface-hover)'; }}
                      onMouseLeave={(e) => { if (importing !== pack.countryCode) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <span style={{ fontSize: 18, lineHeight: 1 }}>{pack.flag}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>
                          {pack.countryName}
                        </div>
                      </div>
                      <span style={{
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-text-tertiary)',
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        {pack.holidays.length} {t('hr.holidays.holidayCount')}
                      </span>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      {/* Count summary bar */}
      {selectedCalendarId && holidays && holidays.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-lg)',
          padding: 'var(--spacing-sm) var(--spacing-lg)',
          background: 'var(--color-bg-secondary)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 'var(--spacing-xl)',
          fontSize: 'var(--font-size-sm)',
          fontFamily: 'var(--font-family)',
          color: 'var(--color-text-secondary)',
        }}>
          <span style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)' }}>
            {t('hr.holidays.summaryTotal', { count: counts.total })}
          </span>
          <span style={{ color: 'var(--color-border-secondary)' }}>&mdash;</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: typeColors.public, flexShrink: 0 }} />
            {t('hr.holidays.summaryPublic', { count: counts.public })}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: typeColors.company, flexShrink: 0 }} />
            {t('hr.holidays.summaryCompany', { count: counts.company })}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: typeColors.optional, flexShrink: 0 }} />
            {t('hr.holidays.summaryOptional', { count: counts.optional })}
          </span>
        </div>
      )}

      {/* Holiday list grouped by month */}
      {selectedCalendarId && (
        <>
          {(!holidays || holidays.length === 0) && !showAddHoliday && (
            <FeatureEmptyState
              illustration="calendar"
              title={t('hr.holidays.empty')}
              description={t('hr.holidays.emptyDesc')}
              actionLabel={t('hr.holidays.add')}
              actionIcon={<Plus size={14} />}
              onAction={() => setShowAddHoliday(true)}
            />
          )}

          {groupedByMonth.map((group) => (
            <div key={group.monthIndex} style={{ marginBottom: 'var(--spacing-xl)' }}>
              {/* Month header */}
              <div style={{
                fontSize: 'var(--font-size-xs)',
                fontWeight: 'var(--font-weight-semibold)',
                fontFamily: 'var(--font-family)',
                color: 'var(--color-text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                padding: 'var(--spacing-sm) var(--spacing-lg)',
                paddingTop: 'var(--spacing-md)',
              }}>
                {group.monthName}
              </div>

              {/* Holidays in this month */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {group.holidays.map((h) => (
                  <div key={h.id} style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', padding: 'var(--spacing-md) var(--spacing-lg)',
                    borderBottom: '1px solid var(--color-border-secondary)',
                  }}>
                    <div style={{ width: 4, height: 24, borderRadius: 2, background: typeColors[editingId === h.id ? editType : h.type] || 'var(--color-text-tertiary)', flexShrink: 0 }} />
                    {editingId === h.id ? (
                      <>
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          size="sm"
                          style={{ flex: 1 }}
                          autoFocus
                          onKeyDown={(e) => { if (e.key === 'Enter') saveEditing(); if (e.key === 'Escape') cancelEditing(); }}
                        />
                        <Input
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          size="sm"
                          style={{ width: 160 }}
                        />
                        <Select
                          value={editType}
                          onChange={setEditType}
                          options={[
                            { value: 'public', label: t('hr.holidays.typePublic') },
                            { value: 'company', label: t('hr.holidays.typeCompany') },
                            { value: 'optional', label: t('hr.holidays.typeOptional') },
                          ]}
                          size="sm"
                          width={160}
                        />
                        <IconButton icon={<Check size={14} />} label={t('common.save')} size={26} onClick={saveEditing} disabled={!editName.trim() || !editDate} />
                        <IconButton icon={<X size={14} />} label={t('common.cancel')} size={26} onClick={cancelEditing} />
                      </>
                    ) : (
                      <>
                        <span style={{ width: 100, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>
                          {formatShortDate(h.date, i18n.language)}
                        </span>
                        <span style={{ flex: 1, fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                          {h.name}
                        </span>
                        <Badge variant={h.type === 'public' ? 'error' : h.type === 'company' ? 'primary' : 'warning'}>{t(`hr.holidays.type${h.type.charAt(0).toUpperCase() + h.type.slice(1)}`)}</Badge>
                        {h.type === 'optional' && (
                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)', fontStyle: 'italic' }}>
                            {t('hr.holidays.optionalNote')}
                          </span>
                        )}
                        {canDelete && (
                          <>
                            <IconButton icon={<Pencil size={14} />} label={t('common.edit')} size={26} onClick={() => startEditing(h)} />
                            <IconButton icon={<Trash2 size={14} />} label={t('common.delete')} size={26} destructive onClick={() => deleteHoliday.mutate(h.id)} />
                          </>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {showAddHoliday && (
            <div style={{ marginTop: 'var(--spacing-lg)', padding: 'var(--spacing-lg)', border: '1px solid var(--color-border-primary)', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
                <Input size="sm" label={t('hr.holidays.name')} value={hName} onChange={(e) => setHName(e.target.value)} placeholder={t('hr.placeholder.holidayName')} style={{ flex: 1 }} autoFocus />
                <Input size="sm" label={t('hr.holidays.date')} type="date" value={hDate} onChange={(e) => setHDate(e.target.value)} style={{ flex: 1 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)', flex: 1 }}>
                  <label className="hr-field-label">{t('hr.fields.type')}</label>
                  <Select value={hType} onChange={setHType} options={[
                    { value: 'public', label: t('hr.holidays.typePublic') },
                    { value: 'company', label: t('hr.holidays.typeCompany') },
                    { value: 'optional', label: t('hr.holidays.typeOptional') },
                  ]} size="sm" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end', marginTop: 'var(--spacing-md)' }}>
                <Button variant="ghost" size="sm" onClick={() => setShowAddHoliday(false)}>{t('common.cancel')}</Button>
                <Button variant="primary" size="sm" onClick={handleAddHoliday} disabled={!hName.trim() || !hDate}>{t('common.save')}</Button>
              </div>
            </div>
          )}

          {!showAddHoliday && holidays && holidays.length > 0 && (
            <div style={{ marginTop: 'var(--spacing-lg)' }}>
              <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => setShowAddHoliday(true)}>
                {t('hr.holidays.add')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

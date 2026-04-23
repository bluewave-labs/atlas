import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, SlidersHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SearchBar } from '../search/search-bar';
import { Chip } from '../ui/chip';
import type { CSSProperties } from 'react';

// ---------------------------------------------------------------------------
// Search filter parsing
// ---------------------------------------------------------------------------

interface SearchFilters {
  from: string | null;
  to: string | null;
  subject: string | null;
  hasAttachment: boolean;
  inMailbox: string | null;
  isFilter: string | null;
  newerThan: string | null;
  olderThan: string | null;
  freeText: string;
}

function parseSearchQuery(query: string): SearchFilters {
  const filters: SearchFilters = {
    from: null,
    to: null,
    subject: null,
    hasAttachment: false,
    inMailbox: null,
    isFilter: null,
    newerThan: null,
    olderThan: null,
    freeText: '',
  };

  let remaining = query;

  remaining = remaining.replace(/\bfrom:(\S+)/gi, (_, val) => { filters.from = val; return ''; });
  remaining = remaining.replace(/\bto:(\S+)/gi, (_, val) => { filters.to = val; return ''; });
  remaining = remaining.replace(/\bsubject:"([^"]+)"/gi, (_, val) => { filters.subject = val; return ''; });
  remaining = remaining.replace(/\bsubject:(\S+)/gi, (_, val) => { filters.subject = val; return ''; });
  remaining = remaining.replace(/\bhas:attachment\b/gi, () => { filters.hasAttachment = true; return ''; });
  remaining = remaining.replace(/\bin:(\S+)/gi, (_, val) => { filters.inMailbox = val.toLowerCase(); return ''; });
  remaining = remaining.replace(/\bis:(\S+)/gi, (_, val) => { filters.isFilter = val.toLowerCase(); return ''; });
  remaining = remaining.replace(/\bnewer_than:(\S+)/gi, (_, val) => { filters.newerThan = val; return ''; });
  remaining = remaining.replace(/\bolder_than:(\S+)/gi, (_, val) => { filters.olderThan = val; return ''; });

  filters.freeText = remaining.trim();
  return filters;
}

export function hasActiveFilters(filters: SearchFilters): boolean {
  return (
    filters.from !== null ||
    filters.to !== null ||
    filters.subject !== null ||
    filters.hasAttachment ||
    filters.inMailbox !== null ||
    filters.isFilter !== null ||
    filters.newerThan !== null ||
    filters.olderThan !== null ||
    filters.freeText.length > 0
  );
}

// ---------------------------------------------------------------------------
// Filter chips
// ---------------------------------------------------------------------------

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function SearchFilterChips({ query, onChange }: { query: string; onChange: (q: string) => void }) {
  const filters = useMemo(() => parseSearchQuery(query), [query]);
  const chips: Array<{ label: string; remove: () => void }> = [];

  if (filters.from) {
    const escaped = escapeRegExp(filters.from);
    chips.push({ label: `from:${filters.from}`, remove: () => onChange(query.replace(new RegExp(`\\bfrom:${escaped}\\b`, 'i'), '').trim()) });
  }
  if (filters.to) {
    const escaped = escapeRegExp(filters.to);
    chips.push({ label: `to:${filters.to}`, remove: () => onChange(query.replace(new RegExp(`\\bto:${escaped}\\b`, 'i'), '').trim()) });
  }
  if (filters.subject) {
    const escaped = escapeRegExp(filters.subject);
    chips.push({
      label: `subject:${filters.subject}`,
      remove: () => onChange(query.replace(new RegExp(`\\bsubject:"${escaped}"`, 'i'), '').replace(new RegExp(`\\bsubject:${escaped}\\b`, 'i'), '').trim()),
    });
  }
  if (filters.hasAttachment) {
    chips.push({ label: 'has:attachment', remove: () => onChange(query.replace(/\bhas:attachment\b/i, '').trim()) });
  }
  if (filters.inMailbox) {
    const escaped = escapeRegExp(filters.inMailbox);
    chips.push({ label: `in:${filters.inMailbox}`, remove: () => onChange(query.replace(new RegExp(`\\bin:${escaped}\\b`, 'i'), '').trim()) });
  }
  if (filters.isFilter) {
    const escaped = escapeRegExp(filters.isFilter);
    chips.push({ label: `is:${filters.isFilter}`, remove: () => onChange(query.replace(new RegExp(`\\bis:${escaped}\\b`, 'i'), '').trim()) });
  }
  if (filters.newerThan) {
    const escaped = escapeRegExp(filters.newerThan);
    chips.push({ label: `newer_than:${filters.newerThan}`, remove: () => onChange(query.replace(new RegExp(`\\bnewer_than:${escaped}\\b`, 'i'), '').trim()) });
  }
  if (filters.olderThan) {
    const escaped = escapeRegExp(filters.olderThan);
    chips.push({ label: `older_than:${filters.olderThan}`, remove: () => onChange(query.replace(new RegExp(`\\bolder_than:${escaped}\\b`, 'i'), '').trim()) });
  }

  if (chips.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-xs)', padding: 'var(--spacing-xs) var(--spacing-lg)', paddingTop: 0 }}>
      {chips.map((chip) => (
        <Chip key={chip.label} color="var(--color-accent-primary)" onRemove={chip.remove} aria-label={`Remove filter ${chip.label}`}>
          {chip.label}
        </Chip>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ContentToolbar
// ---------------------------------------------------------------------------

export function ContentToolbar() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div style={{ flexShrink: 0, background: 'var(--color-bg-primary)' }}>
      {/* Header row: search | gear */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          padding: 'var(--spacing-sm) var(--spacing-lg)',
          borderBottom: '1px solid var(--color-border-primary)',
          minHeight: 40,
        }}
      >
        <div />

        <div role="search" style={{ width: 400 }}>
          <SearchBar value="" onChange={() => {}} placeholder="Search..." />
        </div>

        {/* Settings */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4 }}>
          {/* Global app settings */}
          <button
            aria-label="App settings"
            onClick={() => navigate('/settings')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              background: 'transparent',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--color-text-tertiary)',
              cursor: 'pointer',
              transition: 'background var(--transition-normal), color var(--transition-normal)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-hover)'; e.currentTarget.style.color = 'var(--color-text-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-tertiary)'; }}
          >
            <SlidersHorizontal size={15} />
          </button>

          <button
            aria-label="Settings"
            onClick={() => navigate('/settings')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              background: 'transparent',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--color-text-tertiary)',
              cursor: 'pointer',
              transition: 'background var(--transition-normal), color var(--transition-normal)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-hover)'; e.currentTarget.style.color = 'var(--color-text-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-tertiary)'; }}
          >
            <Settings size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

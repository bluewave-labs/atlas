import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import {
  Search,
  Home,
  Users,
  UserCog,
  Briefcase,
  CalendarDays,
  FileSignature,
  Receipt,
  HardDrive,
  CheckSquare,
  FileText,
  PenLine,
  Settings,
  Building,
  Clock,
  X,
  Loader2,
} from 'lucide-react';
import { useGlobalSearch } from '../../hooks/use-global-search';
import { appRecordPath } from '../../lib/app-routes';
import { useUIStore } from '../../stores/ui-store';
import '../../styles/command-palette.css';

const RECENT_KEY = 'atlas_cmd_recent';
const MAX_RECENT = 5;
const HINT_KEYS = [
  'commandPalette.hints.searchRecords',
  'commandPalette.hints.jumpTo',
  'commandPalette.hints.findAcrossApps',
  'commandPalette.hints.navigateWithK',
] as const;

const PLATFORM_NAV = [
  { id: 'home', labelKey: 'sidebar.home', icon: Home, path: '/' },
  { id: 'crm', labelKey: 'sidebar.crm', icon: Users, path: '/crm' },
  { id: 'hr', labelKey: 'sidebar.hr', icon: UserCog, path: '/hr' },
  { id: 'work', labelKey: 'sidebar.work', icon: Briefcase, path: '/work' },
  { id: 'calendar', labelKey: 'sidebar.calendar', icon: CalendarDays, path: '/calendar' },
  { id: 'sign', labelKey: 'sidebar.sign', icon: FileSignature, path: '/sign-app' },
  { id: 'invoices', labelKey: 'sidebar.invoices', icon: Receipt, path: '/invoices' },
  { id: 'drive', labelKey: 'sidebar.drive', icon: HardDrive, path: '/drive' },
  { id: 'tasks', labelKey: 'sidebar.tasks', icon: CheckSquare, path: '/tasks' },
  { id: 'docs', labelKey: 'sidebar.docs', icon: PenLine, path: '/docs' },
  { id: 'draw', labelKey: 'sidebar.draw', icon: FileText, path: '/draw' },
  { id: 'system', labelKey: 'sidebar.system', icon: Building, path: '/system' },
  { id: 'settings', labelKey: 'settings.title', icon: Settings, path: '/settings' },
  { id: 'org', labelKey: 'sidebar.organization', icon: Building, path: '/org' },
] as const;

interface Recent { query: string; ts: number }
function loadRecent(): Recent[] { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; } }
function saveRecent(items: Recent[]) { localStorage.setItem(RECENT_KEY, JSON.stringify(items.slice(0, MAX_RECENT))); }

export function CommandPalette() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const open = useUIStore((s) => s.commandPaletteOpen);
  const setOpen = useUIStore((s) => s.setCommandPaletteOpen);
  const toggleCommandPalette = useUIStore((s) => s.toggleCommandPalette);
  const [query, setQuery] = useState('');
  const [recents, setRecents] = useState<Recent[]>([]);
  const [hint, setHint] = useState(0);
  const { data: searchResults, isLoading } = useGlobalSearch(query.length >= 2 ? query : '');
  const allResults = searchResults ?? [];

  // Cmd+K
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); toggleCommandPalette(); }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [toggleCommandPalette]);

  // Scroll lock + load recents + clear query when the palette closes.
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      setRecents(loadRecent());
      setHint((p) => (p + 1) % HINT_KEYS.length);
    } else {
      document.body.style.overflow = '';
      setQuery('');
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const close = () => { setOpen(false); };

  const handleSelect = useCallback((value: string) => {
    if (query.trim().length >= 2) {
      const items = loadRecent().filter(r => r.query !== query.trim());
      items.unshift({ query: query.trim(), ts: Date.now() });
      saveRecent(items);
    }
    close();
    const nav = PLATFORM_NAV.find(n => n.id === value);
    if (nav) { navigate(nav.path); return; }
    if (value.startsWith('search-') && searchResults) {
      const r = searchResults.find(x => `search-${x.appId}-${x.recordId}` === value);
      if (r) navigate(appRecordPath(r.appId, r.recordId));
    }
  }, [navigate, searchResults, query]);

  // Group results by appName
  const groupedResults = useMemo(
    () =>
      allResults.slice(0, 8).reduce<Map<string, typeof allResults>>((acc, r) => {
        const group = acc.get(r.appName) ?? [];
        group.push(r);
        acc.set(r.appName, group);
        return acc;
      }, new Map()),
    [allResults],
  );

  return (
    <Command.Dialog open={open} onOpenChange={setOpen} label={t('commandPalette.search', 'Search')} overlayClassName="cmd-overlay" contentClassName="cmd-content">
      <div className="cmd-header">
        {isLoading
          ? <Loader2 size={16} style={{ color: 'var(--color-accent-primary)', flexShrink: 0, animation: 'spin 1s linear infinite' }} />
          : <Search size={16} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />}
        <Command.Input value={query} onValueChange={setQuery} placeholder={t(HINT_KEYS[hint])} className="cmd-input" />
        {query && <button className="cmd-clear-btn" onClick={() => setQuery('')}><X size={14} /></button>}
      </div>

      {query.length >= 2 && !isLoading && (
        <div className="cmd-result-count">
          {allResults.length > 0
            ? t('commandPalette.resultCount', { count: allResults.length })
            : t('common.noResults')}
        </div>
      )}

      <Command.List className="cmd-list">
        <Command.Empty className="cmd-empty">{t('common.noResults')}</Command.Empty>

        {!query && recents.length > 0 && (
          <Command.Group heading={t('commandPalette.recentSearches')}>
            {recents.map(r => (
              <Command.Item key={r.ts} value={`recent-${r.query}`} onSelect={() => setQuery(r.query)} className="cmd-item">
                <span className="cmd-item-icon"><Clock size={14} /></span>
                <span className="cmd-item-title" style={{ flex: 1 }}>{r.query}</span>
                <button className="cmd-recent-remove" onClick={e => { e.stopPropagation(); saveRecent(loadRecent().filter(x => x.ts !== r.ts)); setRecents(loadRecent()); }}><X size={12} /></button>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {groupedResults.size > 0 && Array.from(groupedResults.entries()).map(([appName, results]) => (
          <Command.Group key={appName} heading={`${appName} (${results.length})`}>
            {results.map(r => (
              <Command.Item key={`search-${r.appId}-${r.recordId}`} value={`search-${r.appId}-${r.recordId}`} onSelect={handleSelect} className="cmd-item">
                <span className="cmd-item-icon"><Search size={14} /></span>
                <div className="cmd-item-text">
                  <span className="cmd-item-title">{r.title}</span>
                  <span className="cmd-item-desc">{r.appName}</span>
                </div>
              </Command.Item>
            ))}
          </Command.Group>
        ))}

        <Command.Group heading={t('common.navigation')}>
          {PLATFORM_NAV.map(item => { const I = item.icon; return (
            <Command.Item key={item.id} value={item.id} onSelect={handleSelect} className="cmd-item">
              <span className="cmd-item-icon"><I size={14} /></span>
              <span className="cmd-item-title">{t(item.labelKey)}</span>
            </Command.Item>
          ); })}
        </Command.Group>
      </Command.List>

      <div className="cmd-footer">
        <span><kbd>↑↓</kbd> {t('commandPalette.toNavigate')}</span>
        <span><kbd>↵</kbd> {t('commandPalette.toSelect')}</span>
        <span><kbd>esc</kbd> {t('commandPalette.toClose')}</span>
      </div>
    </Command.Dialog>
  );
}

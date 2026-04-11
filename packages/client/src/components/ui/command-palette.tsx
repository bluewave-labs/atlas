import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import {
  Search, LayoutDashboard, GitBranch, Briefcase, Users, Building2,
  Activity, Zap, FileText, BarChart3,
  Plus, Clock, X, Loader2,
} from 'lucide-react';
import { useGlobalSearch } from '../../hooks/use-global-search';
import '../../styles/command-palette.css';

const RECENT_KEY = 'atlas_crm_cmd_recent';
const MAX_RECENT = 5;
const HINTS = [
  'Search contacts, companies, deals...',
  'Navigate to pipeline, leads, forecast...',
  'Create a new contact or deal...',
  'Find activities and automations...',
];

const CRM_NAV = [
  { id: 'dashboard', key: 'crm.sidebar.dashboard', icon: LayoutDashboard, view: 'dashboard' },
  { id: 'pipeline', key: 'crm.sidebar.pipeline', icon: GitBranch, view: 'pipeline' },
  { id: 'deals', key: 'crm.sidebar.deals', icon: Briefcase, view: 'deals' },
  { id: 'contacts', key: 'crm.sidebar.contacts', icon: Users, view: 'contacts' },
  { id: 'companies', key: 'crm.sidebar.companies', icon: Building2, view: 'companies' },
  { id: 'leads', key: 'crm.leads.title', icon: FileText, view: 'leads' },
  { id: 'activities', key: 'crm.sidebar.activities', icon: Activity, view: 'activities' },
  { id: 'forecast', key: 'crm.forecast.title', icon: BarChart3, view: 'forecast' },
  { id: 'automations', key: 'crm.sidebar.automations', icon: Zap, view: 'automations' },
  { id: 'leadForms', key: 'crm.sidebar.leadForms', icon: FileText, view: 'leadForms' },
];

const CRM_ACTIONS = [
  { id: 'new-contact', key: 'commandPalette.createContact', icon: Plus, view: 'contacts', kw: ['new', 'add', 'contact'] },
  { id: 'new-deal', key: 'commandPalette.createDeal', icon: Plus, view: 'pipeline', kw: ['new', 'add', 'deal'] },
  { id: 'new-company', key: 'commandPalette.createCompany', icon: Plus, view: 'companies', kw: ['new', 'add', 'company'] },
];

interface Recent { query: string; ts: number }
function loadRecent(): Recent[] { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; } }
function saveRecent(items: Recent[]) { localStorage.setItem(RECENT_KEY, JSON.stringify(items.slice(0, MAX_RECENT))); }

export function CommandPalette() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [recents, setRecents] = useState<Recent[]>([]);
  const [hint, setHint] = useState(0);
  const { data: searchResults, isLoading } = useGlobalSearch(query.length >= 2 ? query : '');
  const crmResults = searchResults?.filter((r) => r.appId === 'crm') ?? [];

  // Cmd+K
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setOpen(p => !p); } };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  // Scroll lock + load recents
  useEffect(() => {
    if (open) { document.body.style.overflow = 'hidden'; setRecents(loadRecent()); setHint(p => (p + 1) % HINTS.length); }
    else { document.body.style.overflow = ''; }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const close = () => { setOpen(false); setQuery(''); };

  const handleSelect = useCallback((value: string) => {
    if (query.trim().length >= 2) {
      const items = loadRecent().filter(r => r.query !== query.trim());
      items.unshift({ query: query.trim(), ts: Date.now() });
      saveRecent(items);
    }
    close();
    const nav = CRM_NAV.find(n => n.id === value);
    if (nav) { navigate(`/crm?view=${nav.view}`); return; }
    const act = CRM_ACTIONS.find(a => a.id === value);
    if (act) { navigate(`/crm?view=${act.view}`); return; }
    if (value.startsWith('search-') && searchResults) {
      const r = searchResults.find(x => `search-${x.appId}-${x.recordId}` === value);
      if (r) navigate(`/crm?id=${r.recordId}`);
    }
  }, [navigate, searchResults, query]);

  return (
    <Command.Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setQuery(''); }} label="CRM" overlayClassName="cmd-overlay" contentClassName="cmd-content">
      <div className="cmd-header">
        {isLoading
          ? <Loader2 size={16} style={{ color: 'var(--color-accent-primary)', flexShrink: 0, animation: 'spin 1s linear infinite' }} />
          : <Search size={16} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />}
        <Command.Input value={query} onValueChange={setQuery} placeholder={HINTS[hint]} className="cmd-input" />
        {query && <button className="cmd-clear-btn" onClick={() => setQuery('')}><X size={14} /></button>}
      </div>

      {query.length >= 2 && !isLoading && (
        <div className="cmd-result-count">
          {crmResults.length > 0 ? `${crmResults.length} result${crmResults.length !== 1 ? 's' : ''}` : t('common.noResults')}
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

        {crmResults.length > 0 && (
          <Command.Group heading={`${t('common.records')} (${crmResults.length})`}>
            {crmResults.slice(0, 8).map(r => (
              <Command.Item key={`search-${r.appId}-${r.recordId}`} value={`search-${r.appId}-${r.recordId}`} onSelect={handleSelect} className="cmd-item">
                <span className="cmd-item-icon"><Briefcase size={14} /></span>
                <div className="cmd-item-text">
                  <span className="cmd-item-title">{r.title}</span>
                  <span className="cmd-item-desc">{r.appName}</span>
                </div>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        <Command.Group heading={t('common.navigation')}>
          {CRM_NAV.map(item => { const I = item.icon; return (
            <Command.Item key={item.id} value={item.id} onSelect={handleSelect} className="cmd-item">
              <span className="cmd-item-icon"><I size={14} /></span>
              <span className="cmd-item-title">{t(item.key)}</span>
            </Command.Item>
          ); })}
        </Command.Group>

        <Command.Group heading={t('common.actions')}>
          {CRM_ACTIONS.map(item => { const I = item.icon; return (
            <Command.Item key={item.id} value={item.id} keywords={item.kw} onSelect={handleSelect} className="cmd-item">
              <span className="cmd-item-icon"><I size={14} /></span>
              <span className="cmd-item-title">{t(item.key)}</span>
            </Command.Item>
          ); })}
        </Command.Group>
      </Command.List>

      <div className="cmd-footer">
        <span><kbd>↑↓</kbd> navigate</span>
        <span><kbd>↵</kbd> select</span>
        <span><kbd>esc</kbd> close</span>
      </div>
    </Command.Dialog>
  );
}

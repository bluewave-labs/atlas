import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Plus, Search, X, Trash2, Merge,
} from 'lucide-react';
import {
  useCompanies, useContacts,
  useStages, useDeals,
  useActivities,
  useUpdateDeal, useDeleteDeal, useDeleteContact, useDeleteCompany,
  useMarkDealWon,
  useSeedCrmData,
  useMyCrmPermission, canAccess,
  type CrmDeal,
} from './hooks';
import type { ActiveView, EditingCell, SortState } from './lib/crm-helpers';
import {
  getDealsFilterColumns, getContactsFilterColumns, getCompaniesFilterColumns,
  getDealsCsvColumns, getContactsCsvColumns, getCompaniesCsvColumns,
  getDealsImportFields, getContactsImportFields, getCompaniesImportFields,
} from './lib/crm-columns';
import { applyFilters, type CrmFilter } from './components/filter-bar';
import { type SavedView } from './components/saved-views';
import { CsvImportModal, exportToCsv, exportToXlsx, exportToJson } from './components/csv-import-modal';
import { MergeContactsModal, MergeCompaniesModal } from './components/merge-modal';
import { CreateDealModal } from './components/modals/create-deal-modal';
import { CreateContactModal } from './components/modals/create-contact-modal';
import { CreateCompanyModal } from './components/modals/create-company-modal';
import { LogActivityModal } from './components/modals/log-activity-modal';
import { MarkLostModal } from './components/mark-lost-modal';
import { CrmSidebar } from './components/crm-sidebar';
import { CrmToolbar } from './components/crm-toolbar';
import { CrmContent } from './components/crm-content';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { IconButton } from '../../components/ui/icon-button';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { ContentArea } from '../../components/ui/content-area';
import '../../styles/crm.css';

// ─── Main CRM Page ─────────────────────────────────────────────────

export function CrmPage() {
  const { t } = useTranslation();

  // Permissions
  const { data: myPermission } = useMyCrmPermission();
  const myRole = myPermission?.role ?? 'admin';

  // Navigation
  const [searchParams, setSearchParams] = useSearchParams();
  const activeView = (searchParams.get('view') || 'dashboard') as ActiveView;
  const setActiveView = useCallback((view: ActiveView) => {
    setSearchParams({ view }, { replace: true });
  }, [setSearchParams]);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Multi-select & table interaction state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [sort, setSort] = useState<SortState | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [bulkStageId, setBulkStageId] = useState<string | null>(null);

  // Filters & grouping
  const [filters, setFilters] = useState<CrmFilter[]>([]);
  const pendingViewRef = useRef<SavedView | null>(null);
  const [groupBy, setGroupBy] = useState<string | null>(null);

  // Import/export & modals
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCreateDeal, setShowCreateDeal] = useState(false);
  const [showCreateContact, setShowCreateContact] = useState(false);
  const [showCreateCompany, setShowCreateCompany] = useState(false);
  const [showLogActivity, setShowLogActivity] = useState(false);
  const [markLostDealId, setMarkLostDealId] = useState<string | null>(null);
  const [showMergeContacts, setShowMergeContacts] = useState(false);
  const [showMergeCompanies, setShowMergeCompanies] = useState(false);

  // Data
  const { data: companiesData } = useCompanies();
  const companies = companiesData?.companies ?? [];
  const { data: contactsData } = useContacts();
  const contacts = contactsData?.contacts ?? [];
  const { data: stagesData, isLoading: loadingStages } = useStages();
  const stages = stagesData?.stages ?? [];
  const { data: dealsData, isLoading: loadingDeals } = useDeals();
  const deals = dealsData?.deals ?? [];
  const { data: activitiesData } = useActivities();
  const activities = activitiesData?.activities ?? [];

  const updateDeal = useUpdateDeal();
  const deleteDeal = useDeleteDeal();
  const deleteContact = useDeleteContact();
  const deleteCompany = useDeleteCompany();
  const markWon = useMarkDealWon();
  const seedCrm = useSeedCrmData();

  // Auto-seed on first visit
  const hasSeeded = useRef(false);
  useEffect(() => {
    if (!loadingStages && !loadingDeals && stages.length === 0 && deals.length === 0 && companies.length === 0 && !hasSeeded.current) {
      hasSeeded.current = true;
      seedCrm.mutate();
    }
  }, [loadingStages, loadingDeals, stages.length, deals.length, companies.length, seedCrm]);

  // Selected entities
  const selectedDeal = selectedDealId ? deals.find((d) => d.id === selectedDealId) : null;
  const selectedContact = selectedContactId ? contacts.find((c) => c.id === selectedContactId) : null;
  const selectedCompany = selectedCompanyId ? companies.find((c) => c.id === selectedCompanyId) : null;

  // Close selection on view change
  useEffect(() => {
    setSelectedDealId(null); setSelectedContactId(null); setSelectedCompanyId(null);
    setSearchQuery(''); setShowSearch(false);
    setSelectedIds(new Set()); setFocusedIndex(null); setEditingCell(null);
    setGroupBy(null);
    const pending = pendingViewRef.current;
    if (pending) {
      setFilters(pending.filters);
      setSort(pending.sortColumn ? { column: pending.sortColumn, direction: pending.sortDirection } : null);
      pendingViewRef.current = null;
    } else {
      setSort(null); setFilters([]);
    }
  }, [activeView]);

  // Filter columns & filtered data
  const dealsFilterColumns = useMemo(() => getDealsFilterColumns(stages, t), [stages, t]);
  const contactsFilterColumns = useMemo(() => getContactsFilterColumns(t), [t]);
  const companiesFilterColumns = useMemo(() => getCompaniesFilterColumns(t), [t]);

  const filteredDeals = useMemo(
    () => applyFilters(deals as unknown as Record<string, unknown>[], filters, dealsFilterColumns) as unknown as CrmDeal[],
    [deals, filters, dealsFilterColumns],
  );
  const filteredContacts = useMemo(
    () => applyFilters(contacts as unknown as Record<string, unknown>[], filters, contactsFilterColumns) as unknown as typeof contacts,
    [contacts, filters, contactsFilterColumns],
  );
  const filteredCompanies = useMemo(
    () => applyFilters(companies as unknown as Record<string, unknown>[], filters, companiesFilterColumns) as unknown as typeof companies,
    [companies, filters, companiesFilterColumns],
  );

  const currentFilterColumns = useMemo(() => {
    switch (activeView) {
      case 'deals': return dealsFilterColumns;
      case 'contacts': return contactsFilterColumns;
      case 'companies': return companiesFilterColumns;
      default: return [];
    }
  }, [activeView, dealsFilterColumns, contactsFilterColumns, companiesFilterColumns]);

  // Handlers
  const handleApplyView = useCallback((view: SavedView) => {
    setFilters(view.filters);
    setSort(view.sortColumn ? { column: view.sortColumn, direction: view.sortDirection } : null);
  }, []);

  const handleExport = useCallback((format: 'csv' | 'xlsx' | 'json' = 'csv') => {
    const now = new Date().toISOString().slice(0, 10);
    const exportFn = format === 'xlsx' ? exportToXlsx : format === 'json' ? exportToJson : exportToCsv;
    switch (activeView) {
      case 'deals': exportFn(filteredDeals as unknown as Record<string, unknown>[], getDealsCsvColumns(t), `crm-deals-${now}`); break;
      case 'contacts': exportFn(filteredContacts as unknown as Record<string, unknown>[], getContactsCsvColumns(t), `crm-contacts-${now}`); break;
      case 'companies': exportFn(filteredCompanies as unknown as Record<string, unknown>[], getCompaniesCsvColumns(t), `crm-companies-${now}`); break;
    }
  }, [activeView, filteredDeals, filteredContacts, filteredCompanies, t]);

  const importEntityType = activeView === 'deals' ? 'deals' : activeView === 'contacts' ? 'contacts' : 'companies';
  const importFields = activeView === 'deals' ? getDealsImportFields(t) : activeView === 'contacts' ? getContactsImportFields(t) : getCompaniesImportFields(t);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (showSearch) { setShowSearch(false); setSearchQuery(''); }
        else if (selectedDealId || selectedContactId || selectedCompanyId) {
          setSelectedDealId(null); setSelectedContactId(null); setSelectedCompanyId(null);
        }
      }
      const target = e.target as HTMLElement;
      if (e.key === '/' && !(target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        e.preventDefault();
        setShowSearch(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDealId, selectedContactId, selectedCompanyId, showSearch]);

  const sectionTitle = useMemo(() => {
    switch (activeView) {
      case 'dashboard': return t('crm.sidebar.dashboard');
      case 'leads': return t('crm.leads.title');
      case 'pipeline': return t('crm.sidebar.pipeline');
      case 'deals': return t('crm.sidebar.deals');
      case 'contacts': return t('crm.sidebar.contacts');
      case 'companies': return t('crm.sidebar.companies');
      case 'activities': return t('crm.sidebar.activities');
      case 'automations': return t('crm.sidebar.automations');
      case 'forecast': return t('crm.forecast.title');
      case 'leadForms': return t('crm.leadForms.title');
    }
  }, [activeView, t]);

  const handleAdd = () => {
    switch (activeView) {
      case 'pipeline': case 'deals': setShowCreateDeal(true); break;
      case 'contacts': setShowCreateContact(true); break;
      case 'companies': setShowCreateCompany(true); break;
      case 'activities': setShowLogActivity(true); break;
    }
  };

  const addButtonLabel = useMemo(() => {
    switch (activeView) {
      case 'dashboard': case 'pipeline': case 'deals': return t('crm.deals.newDeal');
      case 'contacts': return t('crm.contacts.newContact');
      case 'companies': return t('crm.companies.newCompany');
      case 'activities': return t('crm.activities.logActivity');
      default: return '';
    }
  }, [activeView, t]);

  const handleMoveDeal = useCallback((dealId: string, newStageId: string) => {
    const stage = stages.find((s) => s.id === newStageId);
    updateDeal.mutate({ id: dealId, stageId: newStageId, probability: stage?.probability ?? 0 });
  }, [stages, updateDeal]);

  const handleDealClick = useCallback((dealId: string) => {
    setSearchParams({ view: 'deal-detail', dealId }, { replace: true });
  }, [setSearchParams]);

  const handleBulkDelete = useCallback(() => {
    const ids = Array.from(selectedIds);
    if (activeView === 'deals') ids.forEach((id) => deleteDeal.mutate(id));
    else if (activeView === 'contacts') ids.forEach((id) => deleteContact.mutate(id));
    else if (activeView === 'companies') ids.forEach((id) => deleteCompany.mutate(id));
    setSelectedIds(new Set());
    setShowBulkDeleteConfirm(false);
  }, [selectedIds, activeView, deleteDeal, deleteContact, deleteCompany]);

  const handleBulkStageChange = useCallback((stageId: string) => {
    Array.from(selectedIds).forEach((id) => updateDeal.mutate({ id, stageId }));
    setBulkStageId(null);
  }, [selectedIds, updateDeal]);

  const hasDetailPanel = !!(
    (activeView === 'pipeline' && selectedDeal) || (activeView === 'deals' && selectedDeal)
  );

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <CrmSidebar
        activeView={activeView}
        setActiveView={setActiveView}
        dealsCount={deals.length}
        contactsCount={contacts.length}
        companiesCount={companies.length}
        myRole={myRole}
        onApplyView={handleApplyView}
        pendingViewRef={pendingViewRef}
      />

      <ContentArea
        title={sectionTitle ?? ''}
        actions={
          activeView !== 'dashboard' && activeView !== 'automations' && activeView !== 'deal-detail' && activeView !== 'lead-detail' && activeView !== 'contact-detail' && activeView !== 'company-detail' ? (
            <>
              <IconButton icon={<Search size={14} />} label={t('crm.actions.search')} size={28} active={showSearch}
                onClick={() => { setShowSearch(!showSearch); if (!showSearch) setTimeout(() => searchInputRef.current?.focus(), 50); }} />
              {((activeView === 'pipeline' || activeView === 'deals') && canAccess(myRole, 'deals', 'create')) ||
               (activeView === 'contacts' && canAccess(myRole, 'contacts', 'create')) ||
               (activeView === 'companies' && canAccess(myRole, 'companies', 'create')) ||
               (activeView === 'activities' && canAccess(myRole, 'activities', 'create'))
                ? <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={handleAdd}>{addButtonLabel}</Button>
                : null}
            </>
          ) : undefined
        }
      >
        {showSearch && (
          <div className="crm-search-bar">
            <Input ref={searchInputRef} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('crm.actions.search')} iconLeft={<Search size={14} />} size="sm"
              style={{ border: 'none', background: 'transparent' }} />
            <IconButton icon={<X size={14} />} label={t('common.close')} size={24}
              onClick={() => { setShowSearch(false); setSearchQuery(''); }} />
          </div>
        )}

        <CrmToolbar
          activeView={activeView}
          importEntityType={importEntityType as 'deals' | 'contacts' | 'companies'}
          filters={filters}
          onFiltersChange={setFilters}
          currentFilterColumns={currentFilterColumns}
          sort={sort}
          onApplyView={handleApplyView}
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
          onImport={() => setShowImportModal(true)}
          onExport={handleExport}
        />

        <CrmContent
          activeView={activeView} setActiveView={setActiveView}
          deals={deals} filteredDeals={filteredDeals} stages={stages}
          contacts={contacts} filteredContacts={filteredContacts}
          companies={companies} filteredCompanies={filteredCompanies}
          activities={activities}
          selectedDealId={selectedDealId} setSelectedDealId={setSelectedDealId}
          selectedContactId={selectedContactId} setSelectedContactId={setSelectedContactId}
          selectedCompanyId={selectedCompanyId} setSelectedCompanyId={setSelectedCompanyId}
          selectedDeal={selectedDeal} selectedContact={selectedContact} selectedCompany={selectedCompany}
          searchQuery={searchQuery}
          selectedIds={selectedIds} setSelectedIds={setSelectedIds}
          focusedIndex={focusedIndex} setFocusedIndex={setFocusedIndex}
          editingCell={editingCell} setEditingCell={setEditingCell}
          sort={sort} setSort={setSort} groupBy={groupBy}
          myRole={myRole} hasDetailPanel={hasDetailPanel}
          handleMoveDeal={handleMoveDeal} handleDealClick={handleDealClick}
          onMarkWon={() => selectedDeal && markWon.mutate(selectedDeal.id)}
          onMarkLost={() => selectedDeal && setMarkLostDealId(selectedDeal.id)}
          onShowCreateDeal={() => setShowCreateDeal(true)}
          onShowCreateContact={() => setShowCreateContact(true)}
          onShowCreateCompany={() => setShowCreateCompany(true)}
          canEditDeals={canAccess(myRole, 'deals', 'update')}
          canEditContacts={canAccess(myRole, 'contacts', 'update')}
          canEditCompanies={canAccess(myRole, 'companies', 'update')}
        />
      </ContentArea>

      {/* Floating bulk action bar */}
      {selectedIds.size > 0 && (activeView === 'deals' || activeView === 'contacts' || activeView === 'companies') && (
        <div className="crm-bulk-bar">
          <span className="crm-bulk-bar-count">{t('common.selected', { count: selectedIds.size })}</span>
          {activeView === 'deals' && (
            <Select value={bulkStageId || ''} onChange={(v) => { if (v) handleBulkStageChange(v); }}
              options={[{ value: '', label: t('crm.deals.changeStage') }, ...stages.map((s) => ({ value: s.id, label: s.name }))]}
              size="sm" width={150} />
          )}
          {selectedIds.size === 2 && activeView === 'contacts' && (
            <Button variant="secondary" size="sm" onClick={() => setShowMergeContacts(true)}>
              <Merge size={14} style={{ marginRight: 4 }} />{t('crm.merge.merge')}
            </Button>
          )}
          {selectedIds.size === 2 && activeView === 'companies' && (
            <Button variant="secondary" size="sm" onClick={() => setShowMergeCompanies(true)}>
              <Merge size={14} style={{ marginRight: 4 }} />{t('crm.merge.merge')}
            </Button>
          )}
          {((activeView === 'deals' && canAccess(myRole, 'deals', 'delete')) ||
            (activeView === 'contacts' && canAccess(myRole, 'contacts', 'delete')) ||
            (activeView === 'companies' && canAccess(myRole, 'companies', 'delete'))) && (
            <Button variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={() => setShowBulkDeleteConfirm(true)}>
              {t('crm.actions.delete')}
            </Button>
          )}
          <IconButton icon={<X size={14} />} label={t('crm.deals.clearSelection')} size={24} onClick={() => setSelectedIds(new Set())} />
        </div>
      )}

      <ConfirmDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}
        title={t('crm.bulk.deleteTitle', { count: selectedIds.size })} description={t('crm.bulk.deleteDescription')}
        confirmLabel={t('crm.actions.delete')} onConfirm={handleBulkDelete} destructive />

      {/* Modals */}
      <CreateDealModal open={showCreateDeal} onClose={() => setShowCreateDeal(false)} stages={stages} contacts={contacts} companies={companies} />
      <CreateContactModal open={showCreateContact} onClose={() => setShowCreateContact(false)} companies={companies} contacts={contacts} />
      <CreateCompanyModal open={showCreateCompany} onClose={() => setShowCreateCompany(false)} />
      <LogActivityModal open={showLogActivity} onClose={() => setShowLogActivity(false)} deals={deals} contacts={contacts} companies={companies} />
      {markLostDealId && <MarkLostModal open={!!markLostDealId} onClose={() => setMarkLostDealId(null)} dealId={markLostDealId} />}
      {(activeView === 'deals' || activeView === 'contacts' || activeView === 'companies') && (
        <CsvImportModal open={showImportModal} onClose={() => setShowImportModal(false)}
          entityType={importEntityType as 'deals' | 'contacts' | 'companies'} fields={importFields} />
      )}

      {/* Merge modals */}
      {(() => {
        const selectedArr = Array.from(selectedIds);
        if (showMergeContacts && selectedArr.length === 2) {
          return <MergeContactsModal open={showMergeContacts}
            onClose={() => { setShowMergeContacts(false); setSelectedIds(new Set()); }}
            contactA={contacts.find((c) => c.id === selectedArr[0]) ?? null}
            contactB={contacts.find((c) => c.id === selectedArr[1]) ?? null} />;
        }
        if (showMergeCompanies && selectedArr.length === 2) {
          return <MergeCompaniesModal open={showMergeCompanies}
            onClose={() => { setShowMergeCompanies(false); setSelectedIds(new Set()); }}
            companyA={companies.find((c) => c.id === selectedArr[0]) ?? null}
            companyB={companies.find((c) => c.id === selectedArr[1]) ?? null} />;
        }
        return null;
      })()}
    </div>
  );
}

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ActiveView, EditingCell, SortState } from '../lib/crm-helpers';
import type {
  CrmDeal, CrmDealStage, CrmContact, CrmCompany, CrmActivity,
} from '../hooks';
import { DealKanban } from './deal-kanban';
import { CrmDashboard } from './dashboard';
import { DashboardCharts } from './dashboard-charts';
import { AutomationsView } from './automations-view';
import { LeadsView } from './leads-view';
import { LeadDetailPage } from './lead-detail-page';
import { DealDetailPage } from './deal-detail-page';
import { LeadFormsView } from './lead-forms-view';
import { ForecastView } from './forecast-view';
import { DealsListView } from './views/deals-list-view';
import { ContactsListView } from './views/contacts-list-view';
import { CompaniesListView } from './views/companies-list-view';
import { ActivitiesListView } from './views/activities-list-view';
import { DealDetailPanel } from './panels/deal-detail-panel';
import { ContactDetailPanel } from './panels/contact-detail-panel';
import { CompanyDetailPanel } from './panels/company-detail-panel';
import { ProposalsListView } from './proposals-list-view';
import { ProposalDetailPanel } from './proposal-detail-panel';
import { ProposalEditor } from './proposal-editor';
import type { Proposal } from '../hooks';

export function CrmContent({
  activeView, setActiveView,
  deals, filteredDeals, stages, contacts, filteredContacts, companies, filteredCompanies, activities,
  selectedDealId, setSelectedDealId,
  selectedContactId, setSelectedContactId,
  selectedCompanyId, setSelectedCompanyId,
  selectedDeal, selectedContact, selectedCompany,
  searchQuery,
  selectedIds, setSelectedIds,
  focusedIndex, setFocusedIndex,
  editingCell, setEditingCell,
  sort, setSort,
  groupBy,
  myRole,
  hasDetailPanel,
  handleMoveDeal, handleDealClick,
  onMarkWon, onMarkLost,
  onShowCreateDeal, onShowCreateContact, onShowCreateCompany,
  canEditDeals, canEditContacts, canEditCompanies,
}: {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  deals: CrmDeal[];
  filteredDeals: CrmDeal[];
  stages: CrmDealStage[];
  contacts: CrmContact[];
  filteredContacts: CrmContact[];
  companies: CrmCompany[];
  filteredCompanies: CrmCompany[];
  activities: CrmActivity[];
  selectedDealId: string | null;
  setSelectedDealId: (id: string | null) => void;
  selectedContactId: string | null;
  setSelectedContactId: (id: string | null) => void;
  selectedCompanyId: string | null;
  setSelectedCompanyId: (id: string | null) => void;
  selectedDeal: CrmDeal | null | undefined;
  selectedContact: CrmContact | null | undefined;
  selectedCompany: CrmCompany | null | undefined;
  searchQuery: string;
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
  focusedIndex: number | null;
  setFocusedIndex: (idx: number | null) => void;
  editingCell: EditingCell | null;
  setEditingCell: (cell: EditingCell | null) => void;
  sort: SortState | null;
  setSort: (sort: SortState | null) => void;
  groupBy: string | null;
  myRole: string;
  hasDetailPanel: boolean;
  handleMoveDeal: (dealId: string, newStageId: string) => void;
  handleDealClick: (dealId: string) => void;
  onMarkWon: () => void;
  onMarkLost: () => void;
  onShowCreateDeal: () => void;
  onShowCreateContact: () => void;
  onShowCreateCompany: () => void;
  canEditDeals: boolean;
  canEditContacts: boolean;
  canEditCompanies: boolean;
}) {
  const [searchParams, setSearchParams] = useSearchParams();

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {activeView === 'dashboard' && (
          <div style={{ overflow: 'auto', flex: 1 }}>
            <CrmDashboard />
            <div style={{ padding: '0 var(--spacing-xl) var(--spacing-xl)' }}>
              <DashboardCharts />
            </div>
          </div>
        )}

        {activeView === 'leads' && (
          <LeadsView />
        )}

        {activeView === 'lead-detail' && searchParams.get('leadId') && (
          <LeadDetailPage
            leadId={searchParams.get('leadId')!}
            onBack={() => setActiveView('leads')}
            onNavigate={(leadId) => setSearchParams({ view: 'lead-detail', leadId }, { replace: true })}
          />
        )}

        {activeView === 'deal-detail' && searchParams.get('dealId') && (
          <DealDetailPage
            dealId={searchParams.get('dealId')!}
            onBack={() => setActiveView('deals')}
            onNavigate={(dealId) => setSearchParams({ view: 'deal-detail', dealId }, { replace: true })}
          />
        )}

        {activeView === 'leadForms' && (
          <LeadFormsView />
        )}

        {activeView === 'forecast' && (
          <ForecastView />
        )}

        {activeView === 'pipeline' && (
          <DealKanban
            deals={deals}
            stages={stages}
            onMoveDeal={handleMoveDeal}
            onDealClick={handleDealClick}
          />
        )}

        {activeView === 'deals' && (
          <DealsListView
            deals={filteredDeals}
            stages={stages}
            selectedId={selectedDealId}
            onSelect={handleDealClick}
            searchQuery={searchQuery}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            focusedIndex={focusedIndex}
            onFocusedIndexChange={setFocusedIndex}
            editingCell={editingCell}
            onEditingCellChange={setEditingCell}
            sort={sort}
            onSortChange={setSort}
            companies={companies}
            onAdd={onShowCreateDeal}
            canEdit={canEditDeals}
            groupBy={groupBy}
          />
        )}

        {activeView === 'contacts' && (
          <ContactsListView
            contacts={filteredContacts}
            selectedId={selectedContactId}
            onSelect={(id) => { setSelectedContactId(id); setSelectedDealId(null); setSelectedCompanyId(null); }}
            searchQuery={searchQuery}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            focusedIndex={focusedIndex}
            onFocusedIndexChange={setFocusedIndex}
            editingCell={editingCell}
            onEditingCellChange={setEditingCell}
            sort={sort}
            onSortChange={setSort}
            companies={companies}
            onAdd={onShowCreateContact}
            canEdit={canEditContacts}
            groupBy={groupBy}
          />
        )}

        {activeView === 'companies' && (
          <CompaniesListView
            companies={filteredCompanies}
            selectedId={selectedCompanyId}
            onSelect={(id) => { setSelectedCompanyId(id); setSelectedDealId(null); setSelectedContactId(null); }}
            searchQuery={searchQuery}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            focusedIndex={focusedIndex}
            onFocusedIndexChange={setFocusedIndex}
            editingCell={editingCell}
            onEditingCellChange={setEditingCell}
            sort={sort}
            onSortChange={setSort}
            onAdd={onShowCreateCompany}
            canEdit={canEditCompanies}
            groupBy={groupBy}
          />
        )}

        {activeView === 'activities' && (
          <ActivitiesListView
            activities={activities}
            searchQuery={searchQuery}
          />
        )}

        {activeView === 'automations' && (
          <AutomationsView stages={stages} />
        )}

        {activeView === 'proposals' && (
          <ProposalsListViewWrapper
            setActiveView={setActiveView}
            setSearchParams={setSearchParams}
          />
        )}

        {activeView === 'proposal-detail' && searchParams.get('proposalId') && (
          <ProposalDetailWrapper
            proposalId={searchParams.get('proposalId')!}
            onBack={() => setActiveView('proposals')}
            setActiveView={setActiveView}
            setSearchParams={setSearchParams}
          />
        )}
      </div>

      {/* Slide-out detail drawer */}
      {hasDetailPanel && (
        <div className="crm-drawer-backdrop" onClick={() => { setSelectedDealId(null); setSelectedContactId(null); setSelectedCompanyId(null); }} />
      )}
      <div className={`crm-drawer-container${hasDetailPanel ? ' open' : ''}`}>
        {(activeView === 'pipeline' || activeView === 'deals') && selectedDeal && (
          <DealDetailPanel
            deal={selectedDeal}
            stages={stages}
            onClose={() => setSelectedDealId(null)}
            onMarkWon={onMarkWon}
            onMarkLost={onMarkLost}
            onContactClick={(contactId) => { setActiveView('contacts'); setSelectedContactId(contactId); setSelectedDealId(null); setSelectedCompanyId(null); }}
            onCompanyClick={(companyId) => { setActiveView('companies'); setSelectedCompanyId(companyId); setSelectedDealId(null); setSelectedContactId(null); }}
          />
        )}
        {activeView === 'contacts' && selectedContact && (
          <ContactDetailPanel
            contact={selectedContact}
            deals={deals}
            onClose={() => setSelectedContactId(null)}
            onCompanyClick={(companyId) => { setActiveView('companies'); setSelectedCompanyId(companyId); setSelectedContactId(null); setSelectedDealId(null); }}
            onDealClick={(dealId) => { setActiveView('deals'); setSelectedDealId(dealId); setSelectedContactId(null); setSelectedCompanyId(null); }}
          />
        )}
        {activeView === 'companies' && selectedCompany && (
          <CompanyDetailPanel
            company={selectedCompany}
            contacts={contacts}
            deals={deals}
            onClose={() => setSelectedCompanyId(null)}
            onContactClick={(contactId) => { setActiveView('contacts'); setSelectedContactId(contactId); setSelectedCompanyId(null); setSelectedDealId(null); }}
            onDealClick={(dealId) => { setActiveView('deals'); setSelectedDealId(dealId); setSelectedCompanyId(null); setSelectedContactId(null); }}
          />
        )}
      </div>
    </div>
  );
}

// ─── Proposals wrappers ─────────────────────────────────────────

function ProposalsListViewWrapper({
  setActiveView,
  setSearchParams,
}: {
  setActiveView: (view: ActiveView) => void;
  setSearchParams: ReturnType<typeof useSearchParams>[1];
}) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorPrefill, setEditorPrefill] = useState<{ dealId?: string; companyId?: string; contactId?: string } | undefined>();

  return (
    <>
      <ProposalsListView
        onSelect={(id) => setSearchParams({ view: 'proposal-detail', proposalId: id }, { replace: true })}
        onCreateNew={(prefill) => {
          setEditorPrefill(prefill);
          setEditorOpen(true);
        }}
      />
      <ProposalEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        prefill={editorPrefill}
      />
    </>
  );
}

function ProposalDetailWrapper({
  proposalId,
  onBack,
  setActiveView,
  setSearchParams,
}: {
  proposalId: string;
  onBack: () => void;
  setActiveView: (view: ActiveView) => void;
  setSearchParams: ReturnType<typeof useSearchParams>[1];
}) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingProposal, setEditingProposal] = useState<Proposal | null>(null);

  return (
    <>
      <ProposalDetailPanel
        proposalId={proposalId}
        onBack={onBack}
        onEdit={(proposal) => {
          setEditingProposal(proposal);
          setEditorOpen(true);
        }}
      />
      <ProposalEditor
        open={editorOpen}
        onClose={() => { setEditorOpen(false); setEditingProposal(null); }}
        proposal={editingProposal}
      />
    </>
  );
}

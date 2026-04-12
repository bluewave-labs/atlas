import { useTranslation } from 'react-i18next';
import {
  Users, Building2, Clock, Settings2,
  LayoutGrid, List,
  BarChart3, Zap,
  UserPlus, TrendingUp,
  Eye, FileText, FileSignature,
} from 'lucide-react';
import { canAccess, type CrmRole } from '../hooks';
import type { ActiveView } from '../lib/crm-helpers';
import { usePinnedViews, type SavedView } from './saved-views';
import { AppSidebar, SidebarSection, SidebarItem } from '../../../components/layout/app-sidebar';
import { useUIStore } from '../../../stores/ui-store';

export function CrmSidebar({
  activeView, setActiveView,
  dealsCount, contactsCount, companiesCount,
  myRole,
  onApplyView, pendingViewRef,
}: {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  dealsCount: number;
  contactsCount: number;
  companiesCount: number;
  myRole: CrmRole;
  onApplyView: (view: SavedView) => void;
  pendingViewRef: React.MutableRefObject<SavedView | null>;
}) {
  const { t } = useTranslation();
  const { openSettings } = useUIStore();

  const pinnedDealViews = usePinnedViews('deals');
  const pinnedContactViews = usePinnedViews('contacts');
  const pinnedCompanyViews = usePinnedViews('companies');

  return (
    <AppSidebar
      storageKey="atlas_crm_sidebar"
      title={t('crm.title')}
      footer={
        <SidebarItem
          label={t('crm.sidebar.settings')}
          icon={<Settings2 size={14} />}
          onClick={() => openSettings('crm')}
        />
      }
    >
      <SidebarSection>
        <SidebarItem
          label={t('crm.sidebar.dashboard')}
          icon={<BarChart3 size={14} />}
          iconColor="#f97316"
          isActive={activeView === 'dashboard'}
          onClick={() => setActiveView('dashboard')}
        />
        <SidebarItem
          label={t('crm.leads.title')}
          icon={<UserPlus size={14} />}
          iconColor="#ec4899"
          isActive={activeView === 'leads' || activeView === 'lead-detail'}
          onClick={() => setActiveView('leads')}
        />
        <SidebarItem
          label={t('crm.sidebar.pipeline')}
          icon={<LayoutGrid size={14} />}
          iconColor="#8b5cf6"
          isActive={activeView === 'pipeline'}
          onClick={() => setActiveView('pipeline')}
        />
        <SidebarItem
          label={t('crm.sidebar.deals')}
          icon={<List size={14} />}
          iconColor="#3b82f6"
          isActive={activeView === 'deals' || activeView === 'deal-detail'}
          count={dealsCount}
          onClick={() => setActiveView('deals')}
        />
        {pinnedDealViews.map((v) => (
          <SidebarItem
            key={v.id}
            label={v.name}
            icon={<Eye size={12} />}
            isActive={false}
            onClick={() => {
              if (activeView === 'deals') {
                onApplyView(v);
              } else {
                pendingViewRef.current = v;
                setActiveView('deals');
              }
            }}
            style={{ paddingLeft: 'var(--spacing-xl)' }}
          />
        ))}
      </SidebarSection>

      <SidebarSection>
        <SidebarItem
          label={t('crm.sidebar.contacts')}
          icon={<Users size={14} />}
          iconColor="#10b981"
          isActive={activeView === 'contacts' || activeView === 'contact-detail'}
          count={contactsCount}
          onClick={() => setActiveView('contacts')}
        />
        {pinnedContactViews.map((v) => (
          <SidebarItem
            key={v.id}
            label={v.name}
            icon={<Eye size={12} />}
            isActive={false}
            onClick={() => {
              if (activeView === 'contacts') {
                onApplyView(v);
              } else {
                pendingViewRef.current = v;
                setActiveView('contacts');
              }
            }}
            style={{ paddingLeft: 'var(--spacing-xl)' }}
          />
        ))}
        <SidebarItem
          label={t('crm.sidebar.companies')}
          icon={<Building2 size={14} />}
          iconColor="#06b6d4"
          isActive={activeView === 'companies' || activeView === 'company-detail'}
          count={companiesCount}
          onClick={() => setActiveView('companies')}
        />
        {pinnedCompanyViews.map((v) => (
          <SidebarItem
            key={v.id}
            label={v.name}
            icon={<Eye size={12} />}
            isActive={false}
            onClick={() => {
              if (activeView === 'companies') {
                onApplyView(v);
              } else {
                pendingViewRef.current = v;
                setActiveView('companies');
              }
            }}
            style={{ paddingLeft: 'var(--spacing-xl)' }}
          />
        ))}
      </SidebarSection>

      <SidebarSection>
        <SidebarItem
          label={t('crm.proposals.title')}
          icon={<FileSignature size={14} />}
          iconColor="#8b5cf6"
          isActive={activeView === 'proposals' || activeView === 'proposal-detail'}
          onClick={() => setActiveView('proposals')}
        />
      </SidebarSection>

      <SidebarSection>
        <SidebarItem
          label={t('crm.forecast.title')}
          icon={<TrendingUp size={14} />}
          iconColor="#6366f1"
          isActive={activeView === 'forecast'}
          onClick={() => setActiveView('forecast')}
        />
        {canAccess(myRole, 'activities', 'view') && (
          <SidebarItem
            label={t('crm.sidebar.activities')}
            icon={<Clock size={14} />}
            iconColor="#f59e0b"
            isActive={activeView === 'activities'}
            onClick={() => setActiveView('activities')}
          />
        )}
        {canAccess(myRole, 'workflows', 'view') && (
          <SidebarItem
            label={t('crm.sidebar.automations')}
            icon={<Zap size={14} />}
            iconColor="#ef4444"
            isActive={activeView === 'automations'}
            onClick={() => setActiveView('automations')}
          />
        )}
        <SidebarItem
          label={t('crm.sidebar.leadForms')}
          icon={<FileText size={14} />}
          iconColor="#14b8a6"
          isActive={activeView === 'leadForms'}
          onClick={() => setActiveView('leadForms')}
        />
      </SidebarSection>
    </AppSidebar>
  );
}

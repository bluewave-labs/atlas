import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Receipt, Repeat, Settings2 } from 'lucide-react';
import { AppSidebar, SidebarSection, SidebarItem } from '../../../components/layout/app-sidebar';
import { useNavigate } from 'react-router-dom';
import { urlForCategory } from '../../../config/settings-url';

interface InvoicesSidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
}

export function InvoicesSidebar({ activeView, setActiveView }: InvoicesSidebarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <AppSidebar
      storageKey="atlas_invoices_sidebar"
      title={t('invoices.title')}
      footer={
        <SidebarItem
          label={t('invoices.sidebar.settings')}
          icon={<Settings2 size={14} />}
          onClick={() => navigate(urlForCategory('invoices'))}
        />
      }
    >
      <SidebarSection>
        <SidebarItem
          label={t('invoices.sidebar.dashboard')}
          icon={<LayoutDashboard size={14} />}
          iconColor="#6366f1"
          isActive={activeView === 'dashboard'}
          onClick={() => setActiveView('dashboard')}
        />
        <SidebarItem
          label={t('invoices.sidebar.invoices')}
          icon={<Receipt size={14} />}
          iconColor="#0ea5e9"
          isActive={activeView === 'invoices'}
          onClick={() => setActiveView('invoices')}
        />
        <SidebarItem
          label={t('invoices.sidebar.recurring')}
          icon={<Repeat size={14} />}
          iconColor="#8b5cf6"
          isActive={activeView === 'recurring'}
          onClick={() => setActiveView('recurring')}
        />
      </SidebarSection>
    </AppSidebar>
  );
}

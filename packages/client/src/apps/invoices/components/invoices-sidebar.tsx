import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Receipt, Settings2 } from 'lucide-react';
import { AppSidebar, SidebarSection, SidebarItem } from '../../../components/layout/app-sidebar';
import { useUIStore } from '../../../stores/ui-store';

interface InvoicesSidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
}

export function InvoicesSidebar({ activeView, setActiveView }: InvoicesSidebarProps) {
  const { t } = useTranslation();
  const { openSettings } = useUIStore();

  return (
    <AppSidebar
      storageKey="atlas_invoices_sidebar"
      title={t('invoices.title')}
      footer={
        <SidebarItem
          label={t('invoices.sidebar.settings')}
          icon={<Settings2 size={14} />}
          onClick={() => openSettings('invoices')}
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
      </SidebarSection>
    </AppSidebar>
  );
}

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Search, X } from 'lucide-react';
import { useInvoices } from './hooks';
import { useAppActions } from '../../hooks/use-app-permissions';
import { InvoicesSidebar } from './components/invoices-sidebar';
import { InvoicesListView } from './components/invoices-list-view';
import { InvoiceDetailPanel } from './components/invoice-detail-panel';
import { InvoicesDashboard } from './components/invoices-dashboard';
import { RecurringInvoicesList } from './components/recurring-invoices-list';
import { InvoicePreview } from './components/invoice-preview';
import { InvoiceBuilderModal } from '../../components/shared/invoice-builder-modal';
import { ContentArea } from '../../components/ui/content-area';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { IconButton } from '../../components/ui/icon-button';
import type { Invoice } from '@atlas-platform/shared';

export function InvoicesPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();

  // State
  const [activeView, setActiveView] = useState('dashboard');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(searchParams.get('id'));
  const [showBuilder, setShowBuilder] = useState(searchParams.get('new') === 'true');
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [previewInvoiceId, setPreviewInvoiceId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Prefill from URL params
  const prefillCompanyId = searchParams.get('companyId') ?? undefined;
  const prefillDealId = searchParams.get('dealId') ?? undefined;

  // Data — fetch all invoices (filtering is done client-side in the list view)
  const { data: invoicesData } = useInvoices();
  const invoices = invoicesData?.invoices ?? [];

  // Permissions
  const { canCreate } = useAppActions('invoices');

  // Selected invoice
  const selectedInvoice = selectedInvoiceId ? invoices.find((i) => i.id === selectedInvoiceId) : null;

  // Reset selection on view change
  useEffect(() => {
    setSelectedInvoiceId(null);
    setSearchQuery('');
    setShowSearch(false);
  }, [activeView]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (showSearch) {
          setShowSearch(false);
          setSearchQuery('');
        } else {
          setSelectedInvoiceId(null);
        }
      }
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (e.key === '/' && !isInput) {
        e.preventDefault();
        setShowSearch(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSearch]);

  const sectionTitle = activeView === 'dashboard'
    ? t('invoices.sidebar.dashboard')
    : activeView === 'recurring'
      ? t('invoices.sidebar.recurring')
      : t('invoices.sidebar.invoices');

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <InvoicesSidebar activeView={activeView} setActiveView={setActiveView} />

      <ContentArea
        title={sectionTitle}
        actions={
          activeView === 'invoices' ? (
            <>
              <IconButton
                icon={<Search size={14} />}
                label={t('common.search')}
                size={28}
                active={showSearch}
                onClick={() => {
                  setShowSearch(!showSearch);
                  if (!showSearch) setTimeout(() => searchInputRef.current?.focus(), 50);
                }}
              />
              {canCreate && (
                <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => { setEditingInvoice(null); setShowBuilder(true); }}>
                  {t('invoices.builder.createInvoice')}
                </Button>
              )}
            </>
          ) : undefined
        }
      >
        {activeView === 'dashboard' ? (
          <InvoicesDashboard />
        ) : activeView === 'recurring' ? (
          <RecurringInvoicesList />
        ) : (
          <>
            {/* Search bar */}
            {showSearch && (
              <div style={{ display: 'flex', alignItems: 'center', padding: '0 var(--spacing-lg)', borderBottom: '1px solid var(--color-border-secondary)' }}>
                <Input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('common.search')}
                  iconLeft={<Search size={14} />}
                  size="sm"
                  style={{ border: 'none', background: 'transparent' }}
                />
                <IconButton
                  icon={<X size={14} />}
                  label={t('common.close')}
                  size={24}
                  onClick={() => { setShowSearch(false); setSearchQuery(''); }}
                />
              </div>
            )}

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <InvoicesListView
                  invoices={invoices}
                  searchQuery={searchQuery}
                  selectedId={selectedInvoiceId}
                  onSelect={(id) => setSelectedInvoiceId(id)}
                  onAdd={canCreate ? () => { setEditingInvoice(null); setShowBuilder(true); } : undefined}
                />
              </div>

              {/* Detail panel */}
              {selectedInvoice && (
                <div style={{ width: 360, borderLeft: '1px solid var(--color-border-secondary)', flexShrink: 0, overflow: 'hidden' }}>
                  <InvoiceDetailPanel
                    invoice={selectedInvoice}
                    onClose={() => setSelectedInvoiceId(null)}
                    onEdit={() => { setEditingInvoice(selectedInvoice); setShowBuilder(true); }}
                    onPreview={() => setPreviewInvoiceId(selectedInvoice.id)}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </ContentArea>

      {/* Invoice preview overlay */}
      {previewInvoiceId && (
        <InvoicePreview
          invoiceId={previewInvoiceId}
          onClose={() => setPreviewInvoiceId(null)}
        />
      )}

      {/* Builder modal */}
      <InvoiceBuilderModal
        open={showBuilder}
        onClose={() => { setShowBuilder(false); setEditingInvoice(null); }}
        invoice={editingInvoice}
        prefill={{
          companyId: prefillCompanyId,
          dealId: prefillDealId,
        }}
        onCreated={(invoice) => {
          setSelectedInvoiceId(invoice.id);
          setShowBuilder(false);
          setEditingInvoice(null);
        }}
      />
    </div>
  );
}

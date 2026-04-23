import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Search, X, Upload } from 'lucide-react';
import { useInvoices } from './hooks';
import { useAppActions } from '../../hooks/use-app-permissions';
import { InvoicesSidebar } from './components/invoices-sidebar';
import { InvoicesListView } from './components/invoices-list-view';
import { InvoiceDetailPage } from './components/invoice-detail-page';
import { InvoicesDashboard } from './components/invoices-dashboard';
import { RecurringInvoicesList } from './components/recurring-invoices-list';
import { InvoiceBuilderModal } from '../../components/shared/invoice-builder-modal';
import { PdfImportModal } from '../../components/shared/pdf-import-modal';
import { ContentArea } from '../../components/ui/content-area';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { IconButton } from '../../components/ui/icon-button';
import { QueryErrorState } from '../../components/ui/query-error-state';
import type { Invoice } from '@atlas-platform/shared';

export function InvoicesPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  // View from URL
  const activeView = searchParams.get('view') || 'dashboard';
  const setActiveView = useCallback((view: string) => {
    setSearchParams({ view }, { replace: true });
  }, [setSearchParams]);
  const [showBuilder, setShowBuilder] = useState(searchParams.get('new') === 'true');
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [showPdfImport, setShowPdfImport] = useState(false);
  const [builderPrefill, setBuilderPrefill] = useState<Record<string, unknown>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Prefill from URL params
  const prefillCompanyId = searchParams.get('companyId') ?? undefined;
  const prefillDealId = searchParams.get('dealId') ?? undefined;
  const prefillProjectId = searchParams.get('projectId') ?? undefined;

  // Data — fetch all invoices (filtering is done client-side in the list view)
  const { data: invoicesData, isError: invoicesError, refetch: refetchInvoices } = useInvoices();
  const invoices = invoicesData?.invoices ?? [];

  // Permissions
  const { canCreate } = useAppActions('invoices');

  // Auto-open create modal from quick action URL param
  useEffect(() => {
    if (searchParams.get('action') === 'create') {
      setShowBuilder(true);
      const next = new URLSearchParams(searchParams);
      next.delete('action');
      setSearchParams(next, { replace: true });
    }
  }, []);

  // Reset search on view change
  useEffect(() => {
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
      : activeView === 'invoice-detail'
        ? t('invoices.sidebar.invoices')
        : t('invoices.sidebar.invoices');

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 48px)', overflow: 'hidden', marginLeft: 56, marginTop: 48 }}>
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
                <>
                  <Button variant="secondary" size="sm" icon={<Upload size={14} />} onClick={() => setShowPdfImport(true)}>
                    {t('invoices.importPdf')}
                  </Button>
                  <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => { setEditingInvoice(null); setBuilderPrefill({}); setShowBuilder(true); }}>
                    {t('invoices.builder.createInvoice')}
                  </Button>
                </>
              )}
            </>
          ) : undefined
        }
      >
        {activeView === 'invoice-detail' && searchParams.get('invoiceId') ? (
          <InvoiceDetailPage
            invoiceId={searchParams.get('invoiceId')!}
            onBack={() => setSearchParams({ view: 'invoices' }, { replace: true })}
          />
        ) : activeView === 'dashboard' ? (
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
                {invoicesError ? (
                  <QueryErrorState onRetry={() => refetchInvoices()} />
                ) : (
                <InvoicesListView
                  invoices={invoices}
                  searchQuery={searchQuery}
                  selectedId={null}
                  onOpenDetail={(id) => setSearchParams({ view: 'invoice-detail', invoiceId: id }, { replace: true })}
                  onAdd={canCreate ? () => { setEditingInvoice(null); setBuilderPrefill({}); setShowBuilder(true); } : undefined}
                  onImportPdf={canCreate ? () => setShowPdfImport(true) : undefined}
                />
                )}
              </div>
            </div>
          </>
        )}
      </ContentArea>

      {/* Builder modal */}
      <InvoiceBuilderModal
        open={showBuilder}
        onClose={() => { setShowBuilder(false); setEditingInvoice(null); setBuilderPrefill({}); }}
        invoice={editingInvoice}
        prefill={{
          companyId: prefillCompanyId,
          dealId: prefillDealId,
          projectId: prefillProjectId,
          ...builderPrefill,
        }}
        onCreated={(invoice) => {
          setShowBuilder(false);
          setEditingInvoice(null);
          setBuilderPrefill({});
          setSearchParams({ view: 'invoice-detail', invoiceId: invoice.id }, { replace: true });
        }}
      />

      {/* PDF import modal */}
      <PdfImportModal
        open={showPdfImport}
        onClose={() => setShowPdfImport(false)}
        onImport={(data) => {
          setShowPdfImport(false);
          setEditingInvoice(null);
          setBuilderPrefill({
            lineItems: data.lineItems,
            currency: data.currency,
            issueDate: data.issueDate,
            dueDate: data.dueDate,
            taxPercent: data.taxPercent,
            notes: data.notes,
          });
          setShowBuilder(true);
        }}
      />
    </div>
  );
}

import { useTranslation } from 'react-i18next';
import {
  FileText,
  Clock,
  CheckCircle,
  FilePen,
  AlertTriangle,
  Upload,
  Ban,
  BookTemplate,
} from 'lucide-react';
import { AppSidebar, SidebarSection, SidebarItem } from '../../components/layout/app-sidebar';
import { ContentArea } from '../../components/ui/content-area';
import { Button } from '../../components/ui/button';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { QueryErrorState } from '../../components/ui/query-error-state';
import { SignatureModal } from './components/signature-modal';
import { SignListView } from './components/sign-list-view';
import { SignEditorView } from './components/sign-editor-view';
import { SignTemplatesView } from './components/sign-templates-view';
import { SignAuditView } from './components/sign-audit-view';
import { SignSendModal } from './components/sign-send-modal';
import { SignSignersModal } from './components/sign-signers-modal';
import { useSignPageState } from './lib/use-sign-page-state';
import { useAppActions } from '../../hooks/use-app-permissions';
import { useAuthStore } from '../../stores/auth-store';
import { useNavigate } from 'react-router-dom';
import { urlForCategory } from '../../config/settings-url';
import { Settings2 } from 'lucide-react';
import { TopBar } from '../../components/layout/top-bar';
import '../../styles/sign.css';

export function SignPage() {
  const { t } = useTranslation();
  const s = useSignPageState();
  const { canCreate, canDelete, canDeleteOwn } = useAppActions('sign');
  const currentUserId = useAuthStore((st) => st.account?.userId);
  const navigate = useNavigate();

  return (
    <div className="sign-page" style={{ marginLeft: 56 }}>
      {/* Hidden file input */}
      <input
        ref={s.fileInputRef}
        type="file"
        accept="application/pdf"
        style={{ display: 'none' }}
        onChange={s.handleFileChange}
      />

      {/* Sidebar */}
      <AppSidebar
        storageKey="atlas_sign_sidebar"
        title={t('sign.title')}
        footer={
          <SidebarItem
            label={t('sign.settings', 'Settings')}
            icon={<Settings2 size={14} />}
            onClick={() => navigate(urlForCategory('sign'))}
          />
        }
      >
        <SidebarSection>
          <SidebarItem
            label={t('sign.sidebar.allDocuments')}
            icon={<FileText size={15} />}
            iconColor="#8b5cf6"
            isActive={s.view !== 'templates' && s.filterStatus === 'all'}
            count={s.counts.all}
            onClick={() => { s.setFilterStatus('all'); s.setView('list'); s.setSelectedDocId(null); }}
          />
          <SidebarItem
            label={t('sign.sidebar.pending')}
            icon={<Clock size={15} />}
            iconColor="#f59e0b"
            isActive={s.view !== 'templates' && s.filterStatus === 'pending'}
            count={s.counts.pending}
            onClick={() => { s.setFilterStatus('pending'); s.setView('list'); s.setSelectedDocId(null); }}
          />
          <SidebarItem
            label={t('sign.sidebar.signed')}
            icon={<CheckCircle size={15} />}
            iconColor="#10b981"
            isActive={s.view !== 'templates' && s.filterStatus === 'signed'}
            count={s.counts.signed}
            onClick={() => { s.setFilterStatus('signed'); s.setView('list'); s.setSelectedDocId(null); }}
          />
          <SidebarItem
            label={t('sign.sidebar.draft')}
            icon={<FilePen size={15} />}
            iconColor="#64748b"
            isActive={s.view !== 'templates' && s.filterStatus === 'draft'}
            count={s.counts.draft}
            onClick={() => { s.setFilterStatus('draft'); s.setView('list'); s.setSelectedDocId(null); }}
          />
          <SidebarItem
            label={t('sign.sidebar.expired')}
            icon={<AlertTriangle size={15} />}
            iconColor="#ef4444"
            isActive={s.view !== 'templates' && s.filterStatus === 'expired'}
            count={s.counts.expired}
            onClick={() => { s.setFilterStatus('expired'); s.setView('list'); s.setSelectedDocId(null); }}
          />
          <SidebarItem
            label={t('sign.sidebar.voided')}
            icon={<Ban size={15} />}
            iconColor="#ef4444"
            isActive={s.view !== 'templates' && s.filterStatus === 'voided'}
            count={s.counts.voided}
            onClick={() => { s.setFilterStatus('voided'); s.setView('list'); s.setSelectedDocId(null); }}
          />
        </SidebarSection>
        <SidebarSection>
          <SidebarItem
            label={t('sign.sidebar.templates')}
            icon={<BookTemplate size={15} />}
            iconColor="#8b5cf6"
            isActive={s.view === 'templates'}
            count={s.templates?.length ?? 0}
            onClick={() => { s.setView('templates'); s.setSelectedDocId(null); }}
          />
        </SidebarSection>
      </AppSidebar>

      {/* Main content column */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
      <TopBar />
      <ContentArea
        title={
          s.view === 'templates' ? t('sign.templates.title')
            : s.view === 'audit' ? t('sign.audit.title')
            : s.filterStatus === 'all' ? t('sign.sidebar.allDocuments')
            : t(`sign.status.${s.filterStatus}`)
        }
        actions={
          s.view === 'list' && canCreate ? (
            <Button variant="primary" size="sm" icon={<Upload size={14} />} onClick={s.handleUpload}>
              {t('sign.editor.uploadPdf')}
            </Button>
          ) : undefined
        }
      >
        {s.view === 'list' && s.docsError && (
          <QueryErrorState onRetry={() => s.refetchDocs()} />
        )}

        {s.view === 'list' && !s.docsError && (
          <SignListView
            searchQuery={s.searchQuery}
            onSearchChange={s.setSearchQuery}
            uploading={s.uploading}
            docsLoading={s.docsLoading}
            filteredDocs={s.filteredDocs as any}
            selectedDocId={s.selectedDocId}
            sortField={s.sortField}
            sortDir={s.sortDir}
            onSort={s.handleSort}
            onUpload={s.handleUpload}
            onOpenDoc={s.handleOpenDoc}
            onDownload={s.handleDownload}
            onRequestDelete={s.handleRequestDelete}
            canCreate={canCreate}
            canDelete={canDelete}
            canDeleteOwn={canDeleteOwn}
            currentUserId={currentUserId}
          />
        )}

        {s.view === 'editor' && s.selectedDoc && s.fieldsError && (
          <QueryErrorState onRetry={() => s.refetchFields()} />
        )}

        {s.view === 'editor' && s.selectedDoc && !s.fieldsError && (
          <SignEditorView
            selectedDoc={s.selectedDoc}
            fields={s.fields}
            pdfUrl={s.pdfUrl}
            uploading={s.uploading}
            selectedFieldId={s.selectedFieldId}
            selectedField={s.selectedField}
            signers={s.signers}
            activeSignerIndex={s.activeSignerIndex}
            allFieldsAssigned={s.allFieldsAssigned}
            pageThumbnails={s.pageThumbnails}
            activePageNumber={s.activePageNumber}
            scrollToPage={s.scrollToPage}
            onSetSelectedFieldId={s.setSelectedFieldId}
            onSetActiveSignerIndex={s.setActiveSignerIndex}
            onSetSigners={s.setSigners}
            onSetActivePageNumber={s.setActivePageNumber}
            onSetScrollToPage={s.setScrollToPage}
            onSetPageThumbnails={s.setPageThumbnails}
            onBackToList={s.handleBackToList}
            onDownload={s.handleDownload}
            onRequestDelete={s.handleRequestDelete}
            onVoidOpen={() => s.setVoidConfirmOpen(true)}
            onAuditView={() => s.setView('audit')}
            onSaveAsTemplate={async () => {
              try { await s.saveAsTemplate.mutateAsync({}); } catch { /* handled by RQ */ }
            }}
            onSignersModalOpen={() => s.setSignersModalOpen(true)}
            onSendModalOpen={() => s.setSendModalOpen(true)}
            onSignNowClick={s.handleSignNowClick}
            onAddField={s.handleAddField}
            onFieldMove={s.handleFieldMove}
            onFieldResize={s.handleFieldResize}
            onFieldClick={s.handleFieldClick}
            onFieldDelete={s.handleFieldDelete}
            onFieldPropertyUpdate={s.handleFieldPropertyUpdate}
            onUpdateDoc={(data) => s.updateDoc.mutate({ ...data, updatedAt: s.selectedDoc?.updatedAt })}
          />
        )}

        {s.view === 'templates' && s.templatesError && (
          <QueryErrorState onRetry={() => s.refetchTemplates()} />
        )}

        {s.view === 'templates' && !s.templatesError && (
          <SignTemplatesView
            templates={s.templates}
            templatesLoading={s.templatesLoading}
            onCreateFromTemplate={async (templateId) => {
              try {
                const doc = await s.createFromTemplate.mutateAsync({ templateId });
                s.setSelectedDocId(doc.id);
                s.setView('editor');
              } catch { /* handled by RQ */ }
            }}
            isCreating={s.createFromTemplate.isPending}
            onDeleteTemplate={(id) => { s.setDeleteTemplateId(id); s.setDeleteTemplateOpen(true); }}
          />
        )}

        {s.view === 'audit' && s.selectedDocId && (
          <SignAuditView
            auditEntries={s.auditEntries}
            onBack={() => s.setView('editor')}
          />
        )}
      </ContentArea>
      </div>

      {/* Signature modal */}
      <SignatureModal
        open={s.sigModalOpen}
        onOpenChange={s.setSigModalOpen}
        onApply={s.handleSignatureApply}
        fieldType={s.sigFieldType}
      />

      {/* Send for signing modal */}
      <SignSendModal
        open={s.sendModalOpen}
        onOpenChange={s.handleCloseSendModal}
        signers={s.signers}
        onSignersChange={s.setSigners}
        emailSubject={s.emailSubject}
        onEmailSubjectChange={s.setEmailSubject}
        emailMessage={s.emailMessage}
        onEmailMessageChange={s.setEmailMessage}
        expiryDate={s.expiryDate}
        onExpiryDateChange={s.setExpiryDate}
        signInOrder={s.signInOrder}
        onSignInOrderChange={s.setSignInOrder}
        documentType={s.documentType}
        onDocumentTypeChange={s.setDocumentType}
        counterpartyName={s.counterpartyName}
        onCounterpartyNameChange={s.setCounterpartyName}
        generatedLink={s.generatedLink}
        generatedLinks={s.generatedLinks}
        linkCopied={s.linkCopied}
        onCopyLink={s.handleCopyLink}
        signingLinks={s.signingLinks}
        onSendForSigning={s.handleSendForSigning}
        onSendReminder={(linkId) => s.sendReminder.mutate(linkId)}
        isSending={s.createSigningLink.isPending}
      />

      {/* Signers management modal */}
      <SignSignersModal
        open={s.signersModalOpen}
        onOpenChange={s.setSignersModalOpen}
        signingLinks={s.signingLinks}
        activeSigner={s.activeSigner}
        onActiveSignerChange={s.setActiveSigner}
      />

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={s.deleteConfirmOpen}
        onOpenChange={s.setDeleteConfirmOpen}
        title={t('sign.editor.deleteDocument')}
        description={t('sign.editor.deleteConfirm')}
        confirmLabel={t('common.delete')}
        destructive
        onConfirm={s.handleConfirmDelete}
      />

      {/* Void confirmation dialog */}
      <ConfirmDialog
        open={s.voidConfirmOpen}
        onOpenChange={s.setVoidConfirmOpen}
        title={t('sign.editor.voidDocument')}
        description={t('sign.editor.voidConfirm')}
        confirmLabel={t('sign.editor.voidDocument')}
        destructive
        onConfirm={s.handleVoidDocument}
      />

      {/* Template delete confirmation dialog */}
      <ConfirmDialog
        open={s.deleteTemplateOpen}
        onOpenChange={s.setDeleteTemplateOpen}
        title={t('sign.templates.deleteTemplate')}
        description={t('sign.editor.deleteConfirm')}
        confirmLabel={t('common.delete')}
        destructive
        onConfirm={async () => {
          if (!s.deleteTemplateId) return;
          await s.deleteTemplate.mutateAsync(s.deleteTemplateId);
          s.setDeleteTemplateId(null);
        }}
      />
    </div>
  );
}

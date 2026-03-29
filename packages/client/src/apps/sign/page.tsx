import { useState, useCallback, useRef } from 'react';
import {
  FileText,
  Clock,
  CheckCircle,
  FilePen,
  AlertTriangle,
  Upload,
  PenTool,
  Type,
  Calendar,
  AlignLeft,
  Send,
  ArrowLeft,
  Link2,
  Copy,
} from 'lucide-react';
import { AppSidebar, SidebarSection, SidebarItem } from '../../components/layout/app-sidebar';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Modal } from '../../components/ui/modal';
import { PdfViewer } from './components/pdf-viewer';
import { FieldOverlay } from './components/field-overlay';
import { SignatureModal } from './components/signature-modal';
import {
  useSignDocuments,
  useSignDocument,
  useSignFields,
  useCreateSignDoc,
  useUpdateSignDoc,
  useDeleteSignDoc,
  useCreateField,
  useUpdateField,
  useDeleteField,
  useCreateSigningLink,
  useSigningLinks,
} from './hooks';
import { config } from '../../config/env';
import type { SignatureDocument, SignatureFieldType, SignatureField } from '@atlasmail/shared';
import { format } from 'date-fns';
import '../../styles/sign.css';

// ─── Status helpers ─────────────────────────────────────────────────

type FilterStatus = 'all' | 'pending' | 'signed' | 'draft' | 'expired';

const STATUS_BADGE_MAP: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'error'> = {
  draft: 'default',
  pending: 'warning',
  signed: 'success',
  expired: 'error',
};

// ─── Main page ──────────────────────────────────────────────────────

export function SignPage() {
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [selectedFieldId, setSelectedFieldId] = useState<string | undefined>();
  const [sigModalOpen, setSigModalOpen] = useState(false);
  const [sigFieldType, setSigFieldType] = useState<SignatureFieldType>('signature');
  const [sigFieldId, setSigFieldId] = useState<string | undefined>();
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [signerEmail, setSignerEmail] = useState('');
  const [signerName, setSignerName] = useState('');
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Queries
  const { data: documents, isLoading: docsLoading } = useSignDocuments();
  const { data: selectedDoc } = useSignDocument(selectedDocId ?? undefined);
  const { data: fields } = useSignFields(selectedDocId ?? undefined);
  const { data: signingLinks } = useSigningLinks(selectedDocId ?? undefined);

  // Mutations
  const createDoc = useCreateSignDoc();
  const updateDoc = useUpdateSignDoc(selectedDocId ?? undefined);
  const deleteDoc = useDeleteSignDoc();
  const createField = useCreateField(selectedDocId ?? undefined);
  const updateField = useUpdateField(selectedDocId ?? undefined);
  const deleteField = useDeleteField(selectedDocId ?? undefined);
  const createSigningLink = useCreateSigningLink(selectedDocId ?? undefined);

  // ─── Handlers ───────────────────────────────────────────────────

  const handleUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const formData = new FormData();
      formData.append('pdf', file);
      formData.append('title', file.name.replace(/\.pdf$/i, ''));
      try {
        const doc = await createDoc.mutateAsync(formData);
        setSelectedDocId(doc.id);
        setView('editor');
      } catch {
        // Error handled by React Query
      }
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [createDoc],
  );

  const handleOpenDoc = useCallback((doc: SignatureDocument) => {
    setSelectedDocId(doc.id);
    setSelectedFieldId(undefined);
    setView('editor');
  }, []);

  const handleBackToList = useCallback(() => {
    setView('list');
    setSelectedDocId(null);
    setSelectedFieldId(undefined);
  }, []);

  const handleDeleteDoc = useCallback(
    async (id: string) => {
      await deleteDoc.mutateAsync(id);
      if (selectedDocId === id) {
        handleBackToList();
      }
    },
    [deleteDoc, selectedDocId, handleBackToList],
  );

  const handleAddField = useCallback(
    async (type: SignatureFieldType) => {
      if (!selectedDocId) return;
      await createField.mutateAsync({
        type,
        pageNumber: 1,
        x: 25,
        y: 40,
        width: 20,
        height: 5,
        signerEmail: null,
        label: null,
        required: true,
        sortOrder: 0,
      });
    },
    [selectedDocId, createField],
  );

  const handleFieldMove = useCallback(
    (id: string, x: number, y: number) => {
      updateField.mutate({ fieldId: id, x, y });
    },
    [updateField],
  );

  const handleFieldResize = useCallback(
    (id: string, width: number, height: number) => {
      updateField.mutate({ fieldId: id, width, height });
    },
    [updateField],
  );

  const handleFieldDelete = useCallback(
    (id: string) => {
      deleteField.mutate(id);
      if (selectedFieldId === id) setSelectedFieldId(undefined);
    },
    [deleteField, selectedFieldId],
  );

  const handleFieldClick = useCallback(
    (id: string) => {
      setSelectedFieldId(id);
    },
    [],
  );

  // Sign now: click a field to apply a signature
  const handleSignNowClick = useCallback(
    (fieldId: string) => {
      const field = fields?.find((f) => f.id === fieldId);
      if (!field) return;
      if (field.signatureData) return; // Already signed
      setSigFieldType(field.type);
      setSigFieldId(fieldId);
      setSigModalOpen(true);
    },
    [fields],
  );

  const handleSignatureApply = useCallback(
    (signatureData: string) => {
      if (!sigFieldId) return;
      updateField.mutate({ fieldId: sigFieldId, signatureData, signedAt: new Date().toISOString() });
      setSigFieldId(undefined);
    },
    [sigFieldId, updateField],
  );

  // Send for signing
  const handleSendForSigning = useCallback(async () => {
    if (!signerEmail.trim()) return;
    try {
      const token = await createSigningLink.mutateAsync({
        email: signerEmail.trim(),
        name: signerName.trim() || undefined,
      });
      const link = `${window.location.origin}/sign/${token.token}`;
      setGeneratedLink(link);
      setLinkCopied(false);
      // Mark document as pending
      await updateDoc.mutateAsync({ status: 'pending' });
    } catch {
      // Handled by RQ
    }
  }, [signerEmail, signerName, createSigningLink, updateDoc]);

  const handleCopyLink = useCallback(() => {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }, [generatedLink]);

  const handleCloseSendModal = useCallback((open: boolean) => {
    setSendModalOpen(open);
    if (!open) {
      setSignerEmail('');
      setSignerName('');
      setGeneratedLink(null);
      setLinkCopied(false);
    }
  }, []);

  // ─── Filtered docs ─────────────────────────────────────────────

  const filteredDocs = (documents ?? []).filter((doc) => {
    if (filterStatus === 'all') return true;
    return doc.status === filterStatus;
  });

  // ─── Sidebar counts ───────────────────────────────────────────

  const counts = {
    all: documents?.length ?? 0,
    pending: documents?.filter((d) => d.status === 'pending').length ?? 0,
    signed: documents?.filter((d) => d.status === 'signed').length ?? 0,
    draft: documents?.filter((d) => d.status === 'draft').length ?? 0,
    expired: documents?.filter((d) => d.status === 'expired').length ?? 0,
  };

  // PDF url for the selected document
  const pdfUrl = selectedDocId
    ? `${config.apiUrl}/sign/${selectedDocId}/view`
    : undefined;

  return (
    <div className="sign-page">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Sidebar */}
      <AppSidebar storageKey="atlas_sign_sidebar" title="Sign">
        <SidebarSection>
          <SidebarItem
            label="All documents"
            icon={<FileText size={15} />}
            isActive={filterStatus === 'all'}
            count={counts.all}
            onClick={() => { setFilterStatus('all'); if (view === 'editor') handleBackToList(); }}
          />
          <SidebarItem
            label="Pending"
            icon={<Clock size={15} />}
            isActive={filterStatus === 'pending'}
            count={counts.pending}
            onClick={() => { setFilterStatus('pending'); if (view === 'editor') handleBackToList(); }}
          />
          <SidebarItem
            label="Signed"
            icon={<CheckCircle size={15} />}
            isActive={filterStatus === 'signed'}
            count={counts.signed}
            onClick={() => { setFilterStatus('signed'); if (view === 'editor') handleBackToList(); }}
          />
          <SidebarItem
            label="Draft"
            icon={<FilePen size={15} />}
            isActive={filterStatus === 'draft'}
            count={counts.draft}
            onClick={() => { setFilterStatus('draft'); if (view === 'editor') handleBackToList(); }}
          />
          <SidebarItem
            label="Expired"
            icon={<AlertTriangle size={15} />}
            isActive={filterStatus === 'expired'}
            count={counts.expired}
            onClick={() => { setFilterStatus('expired'); if (view === 'editor') handleBackToList(); }}
          />
        </SidebarSection>
      </AppSidebar>

      {/* Main content */}
      <div className="sign-main">
        {view === 'list' && (
          <>
            <div className="sign-list-header">
              <h2>
                {filterStatus === 'all' ? 'All documents' : filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)}
              </h2>
              <Button variant="primary" size="sm" icon={<Upload size={14} />} onClick={handleUpload}>
                Upload PDF
              </Button>
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              {docsLoading ? (
                <div className="sign-empty">Loading documents...</div>
              ) : filteredDocs.length === 0 ? (
                <div className="sign-empty">
                  <PenTool size={40} style={{ opacity: 0.3 }} />
                  <div>No documents yet</div>
                  <Button variant="secondary" size="sm" icon={<Upload size={14} />} onClick={handleUpload}>
                    Upload your first PDF
                  </Button>
                </div>
              ) : (
                <table className="sign-doc-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th>Pages</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDocs.map((doc) => (
                      <tr key={doc.id} onClick={() => handleOpenDoc(doc)}>
                        <td style={{ fontWeight: 500 }}>{doc.title}</td>
                        <td>
                          <Badge variant={STATUS_BADGE_MAP[doc.status] ?? 'default'}>
                            {doc.status}
                          </Badge>
                        </td>
                        <td style={{ color: 'var(--color-text-secondary)' }}>
                          {format(new Date(doc.createdAt), 'MMM d, yyyy')}
                        </td>
                        <td style={{ color: 'var(--color-text-secondary)' }}>{doc.pageCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {view === 'editor' && selectedDoc && (
          <>
            {/* Editor toolbar */}
            <div className="sign-toolbar">
              <div className="sign-toolbar-left">
                <Button variant="ghost" size="sm" icon={<ArrowLeft size={14} />} onClick={handleBackToList}>
                  Back
                </Button>
                <span
                  style={{
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 600,
                    color: 'var(--color-text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {selectedDoc.title}
                </span>
                <Badge variant={STATUS_BADGE_MAP[selectedDoc.status] ?? 'default'}>
                  {selectedDoc.status}
                </Badge>
              </div>
              <div className="sign-toolbar-right">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<PenTool size={14} />}
                  onClick={() => handleAddField('signature')}
                >
                  Signature
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Type size={14} />}
                  onClick={() => handleAddField('initials')}
                >
                  Initials
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Calendar size={14} />}
                  onClick={() => handleAddField('date')}
                >
                  Date
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<AlignLeft size={14} />}
                  onClick={() => handleAddField('text')}
                >
                  Text
                </Button>
                <div style={{ width: 1, height: 20, background: 'var(--color-border-primary)' }} />
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Send size={14} />}
                  onClick={() => setSendModalOpen(true)}
                >
                  Send for signing
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<PenTool size={14} />}
                  onClick={() => {
                    // Sign now mode: click a field to sign
                    if (fields && fields.length > 0) {
                      const firstUnsigned = fields.find((f) => !f.signatureData);
                      if (firstUnsigned) {
                        handleSignNowClick(firstUnsigned.id);
                      }
                    }
                  }}
                >
                  Sign now
                </Button>
              </div>
            </div>

            {/* PDF viewer + field overlay */}
            <div className="sign-content">
              {pdfUrl && (
                <PdfViewer
                  url={pdfUrl}
                  scale={1.5}
                  onPageCount={(count) => {
                    if (selectedDoc.pageCount !== count) {
                      updateDoc.mutate({ pageCount: count });
                    }
                  }}
                  renderOverlay={(pageNumber, pageWidth, pageHeight) => (
                    <FieldOverlay
                      fields={fields ?? []}
                      pageNumber={pageNumber}
                      pageWidth={pageWidth}
                      pageHeight={pageHeight}
                      onFieldMove={handleFieldMove}
                      onFieldResize={handleFieldResize}
                      onFieldClick={handleFieldClick}
                      onFieldDelete={handleFieldDelete}
                      selectedFieldId={selectedFieldId}
                      editable
                    />
                  )}
                />
              )}
            </div>
          </>
        )}
      </div>

      {/* Signature modal */}
      <SignatureModal
        open={sigModalOpen}
        onOpenChange={setSigModalOpen}
        onApply={handleSignatureApply}
        fieldType={sigFieldType}
      />

      {/* Send for signing modal */}
      <Modal open={sendModalOpen} onOpenChange={handleCloseSendModal} width={480} title="Send for signing">
        <Modal.Header title="Send for signing" />
        <Modal.Body>
          {!generatedLink ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Input
                label="Signer email"
                placeholder="name@example.com"
                value={signerEmail}
                onChange={(e) => setSignerEmail(e.target.value)}
                size="md"
              />
              <Input
                label="Signer name (optional)"
                placeholder="John Doe"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                size="md"
              />
              {/* Existing links */}
              {signingLinks && signingLinks.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 600,
                      color: 'var(--color-text-tertiary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: 6,
                    }}
                  >
                    Existing signing links
                  </div>
                  {signingLinks.map((link) => (
                    <div
                      key={link.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 0',
                        borderBottom: '1px solid var(--color-border-secondary)',
                        fontSize: 'var(--font-size-sm)',
                      }}
                    >
                      <span style={{ color: 'var(--color-text-primary)' }}>
                        {link.signerEmail}
                      </span>
                      <Badge variant={link.status === 'signed' ? 'success' : link.status === 'expired' ? 'error' : 'warning'}>
                        {link.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div
                style={{
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--color-text-secondary)',
                  marginBottom: 4,
                }}
              >
                Signing link generated. Share this link with the signer:
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  background: 'var(--color-bg-tertiary)',
                  border: '1px solid var(--color-border-primary)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <Link2 size={14} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
                <span
                  style={{
                    flex: 1,
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {generatedLink}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Copy size={13} />}
                  onClick={handleCopyLink}
                >
                  {linkCopied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" onClick={() => handleCloseSendModal(false)}>
            {generatedLink ? 'Done' : 'Cancel'}
          </Button>
          {!generatedLink && (
            <Button
              variant="primary"
              onClick={handleSendForSigning}
              disabled={!signerEmail.trim() || createSigningLink.isPending}
            >
              {createSigningLink.isPending ? 'Generating...' : 'Generate link'}
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </div>
  );
}

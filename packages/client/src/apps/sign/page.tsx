import { useState, useCallback, useRef, useMemo, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
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
  Trash2,
  Download,
  Ban,
  Plus,
  X,
  Users,
  CheckSquare,
  ChevronDown,
  Pencil,
  Tag,
  Search,
} from 'lucide-react';
import { ColumnHeader } from '../../components/ui/column-header';
import { AppSidebar, SidebarSection, SidebarItem } from '../../components/layout/app-sidebar';
import { ContentArea } from '../../components/ui/content-area';
import { ListToolbar } from '../../components/ui/list-toolbar';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Modal } from '../../components/ui/modal';
import { StatusDot } from '../../components/ui/status-dot';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { IconButton } from '../../components/ui/icon-button';
import { Tooltip } from '../../components/ui/tooltip';
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
  useVoidDocument,
} from './hooks';
import { config } from '../../config/env';
import type { SignatureDocument, SignatureFieldType, SignatureField } from '@atlasmail/shared';
import { formatDate } from '../../lib/format';
import { SmartButtonBar } from '../../components/shared/SmartButtonBar';
import { Chip } from '../../components/ui/chip';
import { FeatureEmptyState } from '../../components/ui/feature-empty-state';
import '../../styles/sign.css';

// ─── Status helpers ─────────────────────────────────────────────────

type FilterStatus = 'all' | 'pending' | 'signed' | 'draft' | 'expired' | 'voided';

const STATUS_BADGE_MAP: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'error'> = {
  draft: 'default',
  pending: 'warning',
  signed: 'success',
  expired: 'error',
  voided: 'error',
};

const SIGNER_COLORS = ['#8b5cf6', '#3b82f6', '#ef4444', '#f59e0b', '#10b981'];

// ─── Main page ──────────────────────────────────────────────────────

export function SignPage() {
  const { t } = useTranslation();
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'title' | 'status' | 'updatedAt' | 'createdAt'>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedFieldId, setSelectedFieldId] = useState<string | undefined>();
  const [sigModalOpen, setSigModalOpen] = useState(false);
  const [sigFieldType, setSigFieldType] = useState<SignatureFieldType>('signature');
  const [sigFieldId, setSigFieldId] = useState<string | undefined>();
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [signerEmail, setSignerEmail] = useState('');
  const [signerName, setSignerName] = useState('');
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [voidConfirmOpen, setVoidConfirmOpen] = useState(false);
  // Multiple signers
  const [signers, setSigners] = useState<{ email: string; name: string }[]>([{ email: '', name: '' }]);
  const [generatedLinks, setGeneratedLinks] = useState<{ email: string; link: string }[]>([]);
  const [activeSigner, setActiveSigner] = useState<string | undefined>();
  const [signersModalOpen, setSignersModalOpen] = useState(false);
  // Expiration date
  const getDefaultExpiry = () => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  };
  const [expiryDate, setExpiryDate] = useState(getDefaultExpiry);
  // Inline title editing
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  // Tags
  const [addingTag, setAddingTag] = useState(false);
  const [tagDraft, setTagDraft] = useState('');

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
  const voidDoc = useVoidDocument(selectedDocId ?? undefined);

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

  const handleRequestDelete = useCallback((id: string) => {
    setDeleteTargetId(id);
    setDeleteConfirmOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTargetId) return;
    await deleteDoc.mutateAsync(deleteTargetId);
    if (selectedDocId === deleteTargetId) {
      handleBackToList();
    }
    setDeleteTargetId(null);
  }, [deleteDoc, deleteTargetId, selectedDocId, handleBackToList]);

  const handleDownload = useCallback(
    (docId: string) => {
      const authToken = localStorage.getItem('atlasmail_token');
      const tokenParam = authToken ? `?token=${encodeURIComponent(authToken)}` : '';
      const url = `${config.apiUrl}/sign/${docId}/download${tokenParam}`;
      const link = document.createElement('a');
      link.href = url;
      link.download = '';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    [],
  );

  const handleVoidDocument = useCallback(async () => {
    if (!selectedDocId) return;
    await voidDoc.mutateAsync();
  }, [selectedDocId, voidDoc]);

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

  // Send for signing (multi-signer)
  const handleSendForSigning = useCallback(async () => {
    const validSigners = signers.filter((s) => s.email.trim());
    if (validSigners.length === 0) return;
    // Calculate days from now to expiry
    const now = new Date();
    const expiry = new Date(expiryDate);
    const diffMs = expiry.getTime() - now.getTime();
    const expiresInDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    try {
      const links: { email: string; link: string }[] = [];
      for (const signer of validSigners) {
        const tokenResult = await createSigningLink.mutateAsync({
          email: signer.email.trim(),
          name: signer.name.trim() || undefined,
          expiresInDays,
        });
        links.push({
          email: signer.email.trim(),
          link: `${window.location.origin}/sign/${tokenResult.token}`,
        });
      }
      setGeneratedLinks(links);
      // Also set single link for backward compat display
      if (links.length === 1) {
        setGeneratedLink(links[0].link);
      } else {
        setGeneratedLink('__multi__');
      }
      setLinkCopied(false);
      // Mark document as pending
      await updateDoc.mutateAsync({ status: 'pending' });
    } catch {
      // Handled by RQ
    }
  }, [signers, createSigningLink, updateDoc]);

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
      setGeneratedLinks([]);
      setLinkCopied(false);
      setSigners([{ email: '', name: '' }]);
      setExpiryDate(getDefaultExpiry());
    }
  }, []);

  // ─── Filtered + searched + sorted docs ─────────────────────────

  const filteredDocs = useMemo(() => {
    let docs = (documents ?? []).filter((doc) => {
      if (filterStatus !== 'all' && doc.status !== filterStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (doc.title || '').toLowerCase().includes(q);
        const matchFile = (doc.fileName || '').toLowerCase().includes(q);
        if (!matchTitle && !matchFile) return false;
      }
      return true;
    });

    docs.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'title':
          cmp = (a.title || '').localeCompare(b.title || '');
          break;
        case 'status':
          cmp = (a.status || '').localeCompare(b.status || '');
          break;
        case 'updatedAt':
          cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
        case 'createdAt':
        default:
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return docs;
  }, [documents, filterStatus, searchQuery, sortField, sortDir]);

  const handleSort = useCallback((columnKey: string) => {
    const key = columnKey as typeof sortField;
    if (sortField === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(key);
      setSortDir('asc');
    }
  }, [sortField]);

  // ─── Sidebar counts ───────────────────────────────────────────

  const counts = useMemo(() => ({
    all: documents?.length ?? 0,
    pending: documents?.filter((d) => d.status === 'pending').length ?? 0,
    signed: documents?.filter((d) => d.status === 'signed').length ?? 0,
    draft: documents?.filter((d) => d.status === 'draft').length ?? 0,
    expired: documents?.filter((d) => d.status === 'expired').length ?? 0,
    voided: documents?.filter((d) => d.status === 'voided').length ?? 0,
  }), [documents]);

  // PDF url for the selected document (include auth token for pdfjs-dist)
  const token = localStorage.getItem('atlasmail_token');
  const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
  const pdfUrl = selectedDocId
    ? `${config.apiUrl}/sign/${selectedDocId}/view${tokenParam}`
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
      <AppSidebar storageKey="atlas_sign_sidebar" title={t('sign.title')}>
        <SidebarSection>
          <SidebarItem
            label={t('sign.sidebar.allDocuments')}
            icon={<FileText size={15} />}
            iconColor="#8b5cf6"
            isActive={filterStatus === 'all'}
            count={counts.all}
            onClick={() => { setFilterStatus('all'); if (view === 'editor') handleBackToList(); }}
          />
          <SidebarItem
            label={t('sign.sidebar.pending')}
            icon={<Clock size={15} />}
            iconColor="#f59e0b"
            isActive={filterStatus === 'pending'}
            count={counts.pending}
            onClick={() => { setFilterStatus('pending'); if (view === 'editor') handleBackToList(); }}
          />
          <SidebarItem
            label={t('sign.sidebar.signed')}
            icon={<CheckCircle size={15} />}
            iconColor="#10b981"
            isActive={filterStatus === 'signed'}
            count={counts.signed}
            onClick={() => { setFilterStatus('signed'); if (view === 'editor') handleBackToList(); }}
          />
          <SidebarItem
            label={t('sign.sidebar.draft')}
            icon={<FilePen size={15} />}
            iconColor="#64748b"
            isActive={filterStatus === 'draft'}
            count={counts.draft}
            onClick={() => { setFilterStatus('draft'); if (view === 'editor') handleBackToList(); }}
          />
          <SidebarItem
            label={t('sign.sidebar.expired')}
            icon={<AlertTriangle size={15} />}
            iconColor="#ef4444"
            isActive={filterStatus === 'expired'}
            count={counts.expired}
            onClick={() => { setFilterStatus('expired'); if (view === 'editor') handleBackToList(); }}
          />
          <SidebarItem
            label={t('sign.sidebar.voided')}
            icon={<Ban size={15} />}
            iconColor="#ef4444"
            isActive={filterStatus === 'voided'}
            count={counts.voided}
            onClick={() => { setFilterStatus('voided'); if (view === 'editor') handleBackToList(); }}
          />
        </SidebarSection>
      </AppSidebar>

      {/* Main content */}
      <ContentArea
        title={filterStatus === 'all' ? t('sign.sidebar.allDocuments') : t(`sign.status.${filterStatus}`)}
        actions={
          view === 'list' ? (
            <Button variant="primary" size="sm" icon={<Upload size={14} />} onClick={handleUpload}>
              {t('sign.editor.uploadPdf')}
            </Button>
          ) : undefined
        }
      >
        {view === 'list' && (
          <>
            <ListToolbar>
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('sign.list.search', 'Search documents...')}
                iconLeft={<Search size={14} />}
                size="sm"
                style={{ width: 220 }}
              />
            </ListToolbar>
            <div style={{ flex: 1, overflow: 'auto' }}>
              {docsLoading ? (
                <div className="sign-empty">{t('sign.list.loading')}</div>
              ) : filteredDocs.length === 0 ? (
                <FeatureEmptyState
                  illustration="documents"
                  title={t('sign.empty.title')}
                  description={t('sign.empty.desc')}
                  highlights={[
                    { icon: <PenTool size={14} />, title: t('sign.empty.h1Title'), description: t('sign.empty.h1Desc') },
                    { icon: <Send size={14} />, title: t('sign.empty.h2Title'), description: t('sign.empty.h2Desc') },
                    { icon: <CheckCircle size={14} />, title: t('sign.empty.h3Title'), description: t('sign.empty.h3Desc') },
                  ]}
                  actionLabel={t('sign.empty.upload')}
                  actionIcon={<Upload size={14} />}
                  onAction={handleUpload}
                />
              ) : (
                <table className="sign-doc-table">
                  <thead>
                    <tr>
                      <th><ColumnHeader label={t('sign.list.title')} icon={<FileText size={12} />} sortable columnKey="title" sortColumn={sortField} sortDirection={sortDir} onSort={handleSort} /></th>
                      <th><ColumnHeader label={t('sign.list.status')} icon={<Tag size={12} />} sortable columnKey="status" sortColumn={sortField} sortDirection={sortDir} onSort={handleSort} /></th>
                      <th><ColumnHeader label={t('sign.list.created')} icon={<Calendar size={12} />} sortable columnKey="createdAt" sortColumn={sortField} sortDirection={sortDir} onSort={handleSort} /></th>
                      <th><ColumnHeader label={t('sign.list.pages')} icon={<Users size={12} />} /></th>
                      <th style={{ width: 80 }}><ColumnHeader label={t('sign.list.actions')} /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDocs.map((doc) => (
                      <tr key={doc.id} onClick={() => handleOpenDoc(doc)}>
                        <td style={{ fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'] }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span>{doc.title}</span>
                            {(doc.tags ?? []).map((tag) => (
                              <Chip key={tag} color="#8b5cf6" height={18} style={{ fontSize: 10 }}>
                                {tag}
                              </Chip>
                            ))}
                          </div>
                        </td>
                        <td>
                          <Badge variant={STATUS_BADGE_MAP[doc.status] ?? 'default'}>
                            {doc.status}
                          </Badge>
                        </td>
                        <td style={{ color: 'var(--color-text-secondary)' }}>
                          {formatDate(doc.createdAt)}
                        </td>
                        <td style={{ color: 'var(--color-text-secondary)' }}>{doc.pageCount}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 2 }}>
                            {doc.status === 'signed' && (
                              <IconButton
                                icon={<Download size={14} />}
                                label={t('sign.editor.downloadPdf')}
                                size={26}
                                onClick={() => handleDownload(doc.id)}
                              />
                            )}
                            <IconButton
                              icon={<Trash2 size={14} />}
                              label={t('sign.editor.deleteDocument')}
                              size={26}
                              destructive
                              onClick={() => handleRequestDelete(doc.id)}
                            />
                          </div>
                        </td>
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
                  {t('sign.editor.back')}
                </Button>
                {editingTitle ? (
                  <input
                    autoFocus
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (titleDraft.trim() && titleDraft.trim() !== selectedDoc.title) {
                          updateDoc.mutate({ title: titleDraft.trim() });
                        }
                        setEditingTitle(false);
                      }
                      if (e.key === 'Escape') {
                        setEditingTitle(false);
                      }
                    }}
                    onBlur={() => {
                      if (titleDraft.trim() && titleDraft.trim() !== selectedDoc.title) {
                        updateDoc.mutate({ title: titleDraft.trim() });
                      }
                      setEditingTitle(false);
                    }}
                    style={{
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
                      color: 'var(--color-text-primary)',
                      fontFamily: 'var(--font-family)',
                      border: '1px solid var(--color-border-primary)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '2px 6px',
                      outline: 'none',
                      background: 'var(--color-bg-primary)',
                      maxWidth: 240,
                    }}
                  />
                ) : (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
                      color: 'var(--color-text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                    }}
                    onClick={() => { setTitleDraft(selectedDoc.title); setEditingTitle(true); }}
                  >
                    {selectedDoc.title}
                    <Pencil size={12} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
                  </span>
                )}
                <Badge variant={STATUS_BADGE_MAP[selectedDoc.status] ?? 'default'}>
                  {selectedDoc.status}
                </Badge>
              </div>
              <div className="sign-toolbar-right">
                <IconButton
                  icon={<Users size={14} />}
                  label={t('sign.editor.manageSigners')}
                  size={28}
                  onClick={() => setSignersModalOpen(true)}
                />
                <IconButton
                  icon={<Download size={14} />}
                  label={t('sign.editor.downloadPdf')}
                  size={28}
                  onClick={() => handleDownload(selectedDoc.id)}
                />
                <IconButton
                  icon={<Trash2 size={14} />}
                  label={t('sign.editor.deleteDocument')}
                  size={28}
                  destructive
                  onClick={() => handleRequestDelete(selectedDoc.id)}
                />
                {selectedDoc.status === 'pending' && (
                  <IconButton
                    icon={<Ban size={14} />}
                    label={t('sign.editor.voidDocument')}
                    size={28}
                    destructive
                    onClick={() => setVoidConfirmOpen(true)}
                  />
                )}
                <div style={{ width: 1, height: 20, background: 'var(--color-border-primary)' }} />
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Send size={14} />}
                  onClick={() => setSendModalOpen(true)}
                >
                  {t('sign.editor.sendForSigning')}
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
                  {t('sign.editor.signNow')}
                </Button>
              </div>
            </div>

            {/* Tags */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px', borderBottom: '1px solid var(--color-border-secondary)', flexWrap: 'wrap' }}>
              <Tag size={13} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
              {(selectedDoc.tags ?? []).map((tag) => (
                <Chip
                  key={tag}
                  color="#8b5cf6"
                  onRemove={() => {
                    const next = (selectedDoc.tags ?? []).filter((t) => t !== tag);
                    updateDoc.mutate({ tags: next });
                  }}
                >
                  {tag}
                </Chip>
              ))}
              {addingTag ? (
                <input
                  autoFocus
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && tagDraft.trim()) {
                      const current = selectedDoc.tags ?? [];
                      if (!current.includes(tagDraft.trim())) {
                        updateDoc.mutate({ tags: [...current, tagDraft.trim()] });
                      }
                      setTagDraft('');
                      setAddingTag(false);
                    }
                    if (e.key === 'Escape') {
                      setTagDraft('');
                      setAddingTag(false);
                    }
                  }}
                  onBlur={() => {
                    if (tagDraft.trim()) {
                      const current = selectedDoc.tags ?? [];
                      if (!current.includes(tagDraft.trim())) {
                        updateDoc.mutate({ tags: [...current, tagDraft.trim()] });
                      }
                    }
                    setTagDraft('');
                    setAddingTag(false);
                  }}
                  placeholder="Tag name..."
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    fontFamily: 'var(--font-family)',
                    border: '1px solid var(--color-border-primary)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '2px 6px',
                    outline: 'none',
                    background: 'var(--color-bg-primary)',
                    width: 100,
                    height: 22,
                  }}
                />
              ) : (
                <Chip onClick={() => setAddingTag(true)} color="#6b7280">
                  + {t('sign.editor.addTag')}
                </Chip>
              )}
            </div>

            <SmartButtonBar appId="sign" recordId={selectedDoc.id} />

            {/* Field toolbar (vertical) + PDF viewer */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              {/* Vertical field type toolbar */}
              <div className="sign-field-toolbar">
                <Tooltip content={t('sign.fields.signature')} side="right">
                  <button className="sign-field-toolbar-btn" onClick={() => handleAddField('signature')}>
                    <PenTool size={18} />
                  </button>
                </Tooltip>
                <Tooltip content={t('sign.fields.initials')} side="right">
                  <button className="sign-field-toolbar-btn" onClick={() => handleAddField('initials')}>
                    <Type size={18} />
                  </button>
                </Tooltip>
                <Tooltip content={t('sign.fields.date')} side="right">
                  <button className="sign-field-toolbar-btn" onClick={() => handleAddField('date')}>
                    <Calendar size={18} />
                  </button>
                </Tooltip>
                <Tooltip content={t('sign.fields.text')} side="right">
                  <button className="sign-field-toolbar-btn" onClick={() => handleAddField('text')}>
                    <AlignLeft size={18} />
                  </button>
                </Tooltip>
                <Tooltip content={t('sign.fields.checkbox')} side="right">
                  <button className="sign-field-toolbar-btn" onClick={() => handleAddField('checkbox')}>
                    <CheckSquare size={18} />
                  </button>
                </Tooltip>
                <Tooltip content={t('sign.fields.dropdown')} side="right">
                  <button className="sign-field-toolbar-btn" onClick={() => handleAddField('dropdown')}>
                    <ChevronDown size={18} />
                  </button>
                </Tooltip>
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
            </div>
          </>
        )}
      </ContentArea>

      {/* Signature modal */}
      <SignatureModal
        open={sigModalOpen}
        onOpenChange={setSigModalOpen}
        onApply={handleSignatureApply}
        fieldType={sigFieldType}
      />

      {/* Send for signing modal (multi-signer) */}
      <Modal open={sendModalOpen} onOpenChange={handleCloseSendModal} width={520} title={t('sign.editor.sendForSigning')}>
        <Modal.Header title={t('sign.editor.sendForSigning')} />
        <Modal.Body>
          {!generatedLink ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {signers.map((signer, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'flex-end',
                    padding: '8px 0',
                    borderLeft: `3px solid ${SIGNER_COLORS[idx % SIGNER_COLORS.length]}`,
                    paddingLeft: 12,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <Input
                      label={idx === 0 ? t('sign.send.signerEmail') : undefined}
                      placeholder="name@example.com"
                      value={signer.email}
                      onChange={(e) => {
                        const updated = [...signers];
                        updated[idx] = { ...updated[idx], email: e.target.value };
                        setSigners(updated);
                      }}
                      size="md"
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <Input
                      label={idx === 0 ? t('sign.send.signerName') : undefined}
                      placeholder="John Doe"
                      value={signer.name}
                      onChange={(e) => {
                        const updated = [...signers];
                        updated[idx] = { ...updated[idx], name: e.target.value };
                        setSigners(updated);
                      }}
                      size="md"
                    />
                  </div>
                  {signers.length > 1 && (
                    <IconButton
                      icon={<X size={14} />}
                      label={t('sign.send.removeSigner')}
                      size={28}
                      destructive
                      onClick={() => {
                        setSigners(signers.filter((_, i) => i !== idx));
                      }}
                    />
                  )}
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                icon={<Plus size={14} />}
                onClick={() => setSigners([...signers, { email: '', name: '' }])}
                style={{ alignSelf: 'flex-start' }}
              >
                {t('sign.send.addSigner')}
              </Button>
              <Input
                label={t('sign.send.expiresOn')}
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                size="md"
                min={new Date().toISOString().split('T')[0]}
              />
              {/* Existing links */}
              {signingLinks && signingLinks.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
                      color: 'var(--color-text-tertiary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: 6,
                    }}
                  >
                    {t('sign.send.existingLinks')}
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
                      <Badge variant={link.status === 'signed' ? 'success' : link.status === 'expired' || link.status === 'declined' ? 'error' : 'warning'}>
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
                {generatedLinks.length > 1
                  ? t('sign.send.linksGenerated')
                  : t('sign.send.linkGenerated')}
              </div>
              {generatedLinks.map((gl, idx) => (
                <div key={idx}>
                  {generatedLinks.length > 1 && (
                    <div
                      style={{
                        fontSize: 'var(--font-size-xs)',
                        color: SIGNER_COLORS[idx % SIGNER_COLORS.length],
                        fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
                        marginBottom: 4,
                      }}
                    >
                      {gl.email}
                    </div>
                  )}
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
                      {gl.link}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Copy size={13} />}
                      onClick={() => {
                        navigator.clipboard.writeText(gl.link);
                        setLinkCopied(true);
                        setTimeout(() => setLinkCopied(false), 2000);
                      }}
                    >
                      {t('sign.send.copy')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" onClick={() => handleCloseSendModal(false)}>
            {generatedLink ? t('sign.send.done') : t('sign.send.cancel')}
          </Button>
          {!generatedLink && (
            <Button
              variant="primary"
              onClick={handleSendForSigning}
              disabled={!signers.some((s) => s.email.trim()) || createSigningLink.isPending}
            >
              {createSigningLink.isPending ? t('sign.send.generating') : signers.filter((s) => s.email.trim()).length > 1 ? t('sign.send.generateLinks') : t('sign.send.generateLink')}
            </Button>
          )}
        </Modal.Footer>
      </Modal>

      {/* Signers management modal */}
      <Modal open={signersModalOpen} onOpenChange={setSignersModalOpen} width={480} title={t('sign.signers.manageSigners')}>
        <Modal.Header title={t('sign.signers.manageSigners')} />
        <Modal.Body>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div
              style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-secondary)',
                marginBottom: 4,
              }}
            >
              {t('sign.signers.assignFieldsDesc')}
            </div>
            {signingLinks && signingLinks.length > 0 ? (
              signingLinks.map((link, idx) => (
                <div
                  key={link.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${activeSigner === link.signerEmail ? SIGNER_COLORS[idx % SIGNER_COLORS.length] : 'var(--color-border-primary)'}`,
                    background: activeSigner === link.signerEmail ? `${SIGNER_COLORS[idx % SIGNER_COLORS.length]}10` : 'transparent',
                    cursor: 'pointer',
                  }}
                  onClick={() => setActiveSigner(activeSigner === link.signerEmail ? undefined : link.signerEmail)}
                >
                  <StatusDot color={SIGNER_COLORS[idx % SIGNER_COLORS.length]} size={10} />
                  <span style={{ flex: 1, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                    {link.signerName || link.signerEmail}
                  </span>
                  <Badge variant={link.status === 'signed' ? 'success' : link.status === 'expired' || link.status === 'declined' ? 'error' : 'warning'}>
                    {link.status}
                  </Badge>
                </div>
              ))
            ) : (
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', padding: '12px 0' }}>
                {t('sign.signers.noSignersYet')}
              </div>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" onClick={() => setSignersModalOpen(false)}>
            {t('common.close')}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title={t('sign.editor.deleteDocument')}
        description={t('sign.editor.deleteConfirm')}
        confirmLabel={t('common.delete')}
        destructive
        onConfirm={handleConfirmDelete}
      />

      {/* Void confirmation dialog */}
      <ConfirmDialog
        open={voidConfirmOpen}
        onOpenChange={setVoidConfirmOpen}
        title={t('sign.editor.voidDocument')}
        description={t('sign.editor.voidConfirm')}
        confirmLabel={t('sign.editor.voidDocument')}
        destructive
        onConfirm={handleVoidDocument}
      />
    </div>
  );
}

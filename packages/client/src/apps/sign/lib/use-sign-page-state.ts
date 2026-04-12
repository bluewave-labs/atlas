import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  useSendReminder,
  useVoidDocument,
  useAuditLog,
  useTemplates,
  useCreateFromTemplate,
  useSaveAsTemplate,
  useDeleteTemplate,
} from '../hooks';
import { config } from '../../../config/env';
import type { SignatureDocument, SignatureFieldType, SignatureField, DocumentType } from '@atlas-platform/shared';
import type { Signer } from '../components/signer-panel';
import { type FilterStatus, getDefaultExpiry } from './helpers';

export function useSignPageState() {
  const { id: urlDocId } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [view, setView] = useState<'list' | 'editor' | 'templates' | 'audit'>(urlDocId ? 'editor' : 'list');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(urlDocId ?? null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'title' | 'status' | 'updatedAt' | 'createdAt'>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedFieldId, setSelectedFieldId] = useState<string | undefined>();
  const [sigModalOpen, setSigModalOpen] = useState(false);
  const [sigFieldType, setSigFieldType] = useState<SignatureFieldType>('signature');
  const [sigFieldId, setSigFieldId] = useState<string | undefined>();
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [voidConfirmOpen, setVoidConfirmOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [signers, setSigners] = useState<Signer[]>([{ email: '', name: '', role: 'signer' }]);
  const [activeSignerIndex, setActiveSignerIndex] = useState<number | null>(null);
  const [generatedLinks, setGeneratedLinks] = useState<{ email: string; link: string }[]>([]);
  const [activeSigner, setActiveSigner] = useState<string | undefined>();
  const [signersModalOpen, setSignersModalOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [signInOrder, setSignInOrder] = useState(false);
  const [expiryDate, setExpiryDate] = useState(getDefaultExpiry);
  const [documentType, setDocumentType] = useState<DocumentType>('contract');
  const [counterpartyName, setCounterpartyName] = useState('');
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);
  const [deleteTemplateOpen, setDeleteTemplateOpen] = useState(false);
  const [pageThumbnails, setPageThumbnails] = useState<Array<{ page: number; dataUrl: string; width: number; height: number }>>([]);
  const [scrollToPage, setScrollToPage] = useState<number | null>(null);
  const [activePageNumber, setActivePageNumber] = useState(1);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Queries
  const { data: documents, isLoading: docsLoading } = useSignDocuments();
  const { data: selectedDoc } = useSignDocument(selectedDocId ?? undefined);
  const { data: fields } = useSignFields(selectedDocId ?? undefined);
  const { data: signingLinks } = useSigningLinks(selectedDocId ?? undefined);
  const { data: auditEntries } = useAuditLog(selectedDocId ?? undefined);
  const { data: templates, isLoading: templatesLoading } = useTemplates();

  // Mutations
  const createDoc = useCreateSignDoc();
  const updateDoc = useUpdateSignDoc(selectedDocId ?? undefined);
  const deleteDoc = useDeleteSignDoc();
  const createField = useCreateField(selectedDocId ?? undefined);
  const updateField = useUpdateField(selectedDocId ?? undefined);
  const deleteField = useDeleteField(selectedDocId ?? undefined);
  const createSigningLink = useCreateSigningLink(selectedDocId ?? undefined);
  const sendReminder = useSendReminder(selectedDocId ?? undefined);
  const voidDoc = useVoidDocument(selectedDocId ?? undefined);
  const createFromTemplate = useCreateFromTemplate();
  const saveAsTemplate = useSaveAsTemplate(selectedDocId ?? undefined);
  const deleteTemplate = useDeleteTemplate();

  // ─── Handlers ───────────────────────────────────────────────────

  const handleUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploading(true);
      const formData = new FormData();
      formData.append('pdf', file);
      formData.append('title', file.name.replace(/\.pdf$/i, ''));
      try {
        const doc = await createDoc.mutateAsync(formData);
        setSelectedDocId(doc.id);
        setView('editor');
      } catch {
        // Error handled by React Query
      } finally {
        setUploading(false);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [createDoc],
  );

  const handleOpenDoc = useCallback((doc: SignatureDocument) => {
    setSelectedDocId(doc.id);
    setSelectedFieldId(undefined);
    setView('editor');
    navigate(`/sign-app/${doc.id}`, { replace: true });
  }, [navigate]);

  const handleBackToList = useCallback(() => {
    setView('list');
    setSelectedDocId(null);
    setSelectedFieldId(undefined);
    navigate('/sign-app', { replace: true });
  }, [navigate]);

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
    async (type: SignatureFieldType, pageNumber?: number, x = 25, y = 40) => {
      if (!selectedDocId) return;
      const assignedEmail = activeSignerIndex !== null && signers[activeSignerIndex]?.email.trim()
        ? signers[activeSignerIndex].email.trim()
        : null;
      await createField.mutateAsync({
        type,
        pageNumber: pageNumber ?? activePageNumber,
        x,
        y,
        width: type === 'checkbox' ? 5 : 20,
        height: type === 'checkbox' ? 4 : 5,
        signerEmail: assignedEmail,
        label: null,
        required: true,
        sortOrder: 0,
      });
    },
    [selectedDocId, createField, activeSignerIndex, signers, activePageNumber],
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

  const handleFieldClick = useCallback((id: string) => {
    setSelectedFieldId(id);
  }, []);

  // Delete selected field with Delete/Backspace key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!selectedFieldId) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleFieldDelete(selectedFieldId);
      }
      if (e.key === 'Escape') {
        setSelectedFieldId(undefined);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFieldId, handleFieldDelete]);

  const handleSignNowClick = useCallback(
    (fieldId: string) => {
      const field = fields?.find((f) => f.id === fieldId);
      if (!field) return;
      if (field.signatureData) return;
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

  // Prefill document type + counterparty when opening the send modal
  useEffect(() => {
    if (sendModalOpen && selectedDoc) {
      setDocumentType((selectedDoc.documentType as DocumentType) || 'contract');
      setCounterpartyName(selectedDoc.counterpartyName || '');
    }
  }, [sendModalOpen, selectedDoc]);

  const handleSendForSigning = useCallback(async () => {
    const validSigners = signers.filter((s) => s.email.trim());
    if (validSigners.length === 0) return;
    const now = new Date();
    const globalExpiry = new Date(expiryDate);
    try {
      const links: { email: string; link: string }[] = [];
      for (let idx = 0; idx < validSigners.length; idx++) {
        const signer = validSigners[idx];
        const signerExpiry = signer.expiryDate ? new Date(signer.expiryDate) : globalExpiry;
        const diffMs = signerExpiry.getTime() - now.getTime();
        const expiresInDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        const tokenResult = await createSigningLink.mutateAsync({
          email: signer.email.trim(),
          name: signer.name.trim() || undefined,
          expiresInDays,
          signingOrder: signInOrder ? idx : 0,
          role: signer.role || 'signer',
          customSubject: emailSubject.trim() || undefined,
          customMessage: emailMessage.trim() || undefined,
        });
        links.push({
          email: signer.email.trim(),
          link: `${window.location.origin}/sign/${tokenResult.token}`,
        });
      }
      setGeneratedLinks(links);
      if (links.length === 1) {
        setGeneratedLink(links[0].link);
      } else {
        setGeneratedLink('__multi__');
      }
      setLinkCopied(false);
      await updateDoc.mutateAsync({
        status: 'pending',
        documentType,
        counterpartyName: counterpartyName.trim() || null,
      });
    } catch {
      // Handled by RQ
    }
  }, [signers, signInOrder, emailSubject, emailMessage, createSigningLink, updateDoc, expiryDate, documentType, counterpartyName]);

  const handleCopyLink = useCallback((link: string) => {
    navigator.clipboard.writeText(link);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }, []);

  const handleCloseSendModal = useCallback((open: boolean) => {
    setSendModalOpen(open);
    if (!open) {
      setGeneratedLink(null);
      setGeneratedLinks([]);
      setLinkCopied(false);
      setExpiryDate(getDefaultExpiry());
      setEmailSubject('');
      setEmailMessage('');
      setDocumentType('contract');
      setCounterpartyName('');
    }
  }, []);

  const selectedField = useMemo(() => {
    if (!selectedFieldId || !fields) return null;
    return fields.find((f) => f.id === selectedFieldId) ?? null;
  }, [selectedFieldId, fields]);

  const handleFieldPropertyUpdate = useCallback(
    (data: Partial<SignatureField>) => {
      if (!selectedFieldId) return;
      updateField.mutate({ fieldId: selectedFieldId, ...data });
    },
    [selectedFieldId, updateField],
  );

  const allFieldsAssigned = useMemo(() => {
    if (!fields || fields.length === 0) return false;
    const requiredFields = fields.filter((f) => f.required);
    if (requiredFields.length === 0) return true;
    return requiredFields.every((f) => f.signerEmail);
  }, [fields]);

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

  const counts = useMemo(() => ({
    all: documents?.length ?? 0,
    pending: documents?.filter((d) => d.status === 'pending').length ?? 0,
    signed: documents?.filter((d) => d.status === 'signed').length ?? 0,
    draft: documents?.filter((d) => d.status === 'draft').length ?? 0,
    expired: documents?.filter((d) => d.status === 'expired').length ?? 0,
    voided: documents?.filter((d) => d.status === 'voided').length ?? 0,
  }), [documents]);

  const token = localStorage.getItem('atlasmail_token');
  const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
  const pdfUrl = selectedDocId
    ? `${config.apiUrl}/sign/${selectedDocId}/view${tokenParam}`
    : undefined;

  return {
    // View state
    view, setView,
    selectedDocId, setSelectedDocId,
    filterStatus, setFilterStatus,
    searchQuery, setSearchQuery,
    sortField, sortDir,
    selectedFieldId, setSelectedFieldId,
    sigModalOpen, setSigModalOpen,
    sigFieldType,
    sendModalOpen, setSendModalOpen,
    generatedLink, generatedLinks, linkCopied,
    deleteConfirmOpen, setDeleteConfirmOpen,
    voidConfirmOpen, setVoidConfirmOpen,
    uploading,
    signers, setSigners,
    activeSignerIndex, setActiveSignerIndex,
    activeSigner, setActiveSigner,
    signersModalOpen, setSignersModalOpen,
    emailSubject, setEmailSubject,
    emailMessage, setEmailMessage,
    signInOrder, setSignInOrder,
    expiryDate, setExpiryDate,
    documentType, setDocumentType,
    counterpartyName, setCounterpartyName,
    deleteTemplateId, deleteTemplateOpen, setDeleteTemplateOpen,
    pageThumbnails, setPageThumbnails,
    scrollToPage, setScrollToPage,
    activePageNumber, setActivePageNumber,
    fileInputRef,

    // Query data
    documents, docsLoading,
    selectedDoc, fields, signingLinks, auditEntries,
    templates, templatesLoading,

    // Mutations
    createFromTemplate, saveAsTemplate, deleteTemplate,
    createSigningLink, sendReminder, updateDoc,

    // Computed
    selectedField, allFieldsAssigned, filteredDocs, counts, pdfUrl,

    // Handlers
    handleUpload, handleFileChange, handleOpenDoc, handleBackToList,
    handleRequestDelete, handleConfirmDelete, handleDownload,
    handleVoidDocument, handleAddField, handleFieldMove, handleFieldResize,
    handleFieldDelete, handleFieldClick, handleSignNowClick,
    handleSignatureApply, handleSendForSigning, handleCopyLink,
    handleCloseSendModal, handleFieldPropertyUpdate, handleSort,
    setDeleteTemplateId,
  };
}

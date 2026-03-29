import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle, AlertTriangle, PenTool, ChevronRight, Download, XCircle, ChevronDown } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Modal } from '../components/ui/modal';
import { Input } from '../components/ui/input';
import { PdfViewer } from '../apps/sign/components/pdf-viewer';
import { FieldOverlay } from '../apps/sign/components/field-overlay';
import { SignatureModal } from '../apps/sign/components/signature-modal';
import { usePublicSignDoc, submitPublicSign, submitPublicDecline } from '../apps/sign/hooks';
import { config } from '../config/env';
import type { SignatureFieldType, SignatureField } from '@atlasmail/shared';
import '../styles/sign.css';

export function SignPublicPage() {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const { data, isLoading, error, refetch } = usePublicSignDoc(token);

  const [sigModalOpen, setSigModalOpen] = useState(false);
  const [sigFieldType, setSigFieldType] = useState<SignatureFieldType>('signature');
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const [localSignatures, setLocalSignatures] = useState<Record<string, string>>({});
  const [completed, setCompleted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Guided signing state
  const [isGuided, setIsGuided] = useState(false);
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  // Dropdown popover state
  const [dropdownFieldId, setDropdownFieldId] = useState<string | null>(null);
  const [dropdownOptions, setDropdownOptions] = useState<string[]>([]);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  // Decline state
  const [declineModalOpen, setDeclineModalOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [declined, setDeclined] = useState(false);
  const [declining, setDeclining] = useState(false);

  // ─── Sorted unsigned fields for guided mode ───────────────────────

  const sortedUnsignedFields = useMemo(() => {
    if (!data) return [];
    return data.fields
      .filter((f) => f.required && !f.signatureData && !localSignatures[f.id])
      .sort((a, b) => {
        if (a.pageNumber !== b.pageNumber) return a.pageNumber - b.pageNumber;
        return a.y - b.y;
      });
  }, [data, localSignatures]);

  const totalRequiredFields = useMemo(() => {
    if (!data) return 0;
    return data.fields.filter((f) => f.required).length;
  }, [data]);

  const signedCount = totalRequiredFields - sortedUnsignedFields.length;

  // ─── Scroll to active guided field ────────────────────────────────

  useEffect(() => {
    if (!isGuided || sortedUnsignedFields.length === 0) return;
    const idx = Math.min(currentFieldIndex, sortedUnsignedFields.length - 1);
    const field = sortedUnsignedFields[idx];
    if (!field || !contentRef.current) return;

    // Find the field element and scroll it into view
    const el = contentRef.current.querySelector(`[data-field-id="${field.id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isGuided, currentFieldIndex, sortedUnsignedFields]);

  // ─── Handlers ───────────────────────────────────────────────────

  const handleFieldClick = useCallback(
    (fieldId: string) => {
      if (!data) return;
      const field = data.fields.find((f) => f.id === fieldId);
      if (!field) return;

      // Checkbox: toggle directly
      if (field.type === 'checkbox') {
        const current = localSignatures[fieldId] || field.signatureData;
        const next = current === 'checked' ? '' : 'checked';
        setLocalSignatures((prev) => ({ ...prev, [fieldId]: next }));
        return;
      }

      // Dropdown: show options popover
      if (field.type === 'dropdown') {
        if (field.signatureData || localSignatures[fieldId]) return;
        const options = (field.label || '').split(',').map((o) => o.trim()).filter(Boolean);
        if (options.length === 0) return;
        // Position the dropdown near the field
        const el = contentRef.current?.querySelector(`[data-field-id="${fieldId}"]`);
        if (el) {
          const rect = el.getBoundingClientRect();
          setDropdownPos({ top: rect.bottom + 4, left: rect.left });
        }
        setDropdownOptions(options);
        setDropdownFieldId(fieldId);
        return;
      }

      // Don't allow re-signing already signed fields
      if (field.signatureData || localSignatures[fieldId]) return;
      setSigFieldType(field.type);
      setActiveFieldId(fieldId);
      setSigModalOpen(true);
    },
    [data, localSignatures],
  );

  const handleDropdownSelect = useCallback(
    (option: string) => {
      if (!dropdownFieldId) return;
      setLocalSignatures((prev) => ({ ...prev, [dropdownFieldId]: option }));
      setDropdownFieldId(null);
      setDropdownOptions([]);
    },
    [dropdownFieldId],
  );

  const handleSignatureApply = useCallback(
    (signatureData: string) => {
      if (!activeFieldId) return;
      setLocalSignatures((prev) => ({ ...prev, [activeFieldId]: signatureData }));
      setActiveFieldId(null);

      // In guided mode, auto-advance to next field
      if (isGuided) {
        // The sortedUnsignedFields will update via useMemo, but we need to handle index
        setCurrentFieldIndex((prev) => prev); // Stay at same index (next unsigned field takes this position)
      }
    },
    [activeFieldId, isGuided],
  );

  const handleStartGuided = useCallback(() => {
    setIsGuided(true);
    setCurrentFieldIndex(0);
  }, []);

  const handleNextField = useCallback(() => {
    if (currentFieldIndex < sortedUnsignedFields.length - 1) {
      setCurrentFieldIndex((prev) => prev + 1);
    }
  }, [currentFieldIndex, sortedUnsignedFields.length]);

  const handleGuidedFieldClick = useCallback(() => {
    if (sortedUnsignedFields.length === 0) return;
    const idx = Math.min(currentFieldIndex, sortedUnsignedFields.length - 1);
    const field = sortedUnsignedFields[idx];
    if (field) {
      handleFieldClick(field.id);
    }
  }, [currentFieldIndex, sortedUnsignedFields, handleFieldClick]);

  const handleCompleteSigning = useCallback(async () => {
    if (!token || !data) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      // Submit each locally signed field
      const entries = Object.entries(localSignatures);
      for (const [fieldId, sigData] of entries) {
        await submitPublicSign(token, fieldId, sigData);
      }
      setCompleted(true);
    } catch (err: any) {
      const msg = err?.response?.data?.error || t('sign.public.failedToSubmit');
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  }, [token, data, localSignatures]);

  const handleDecline = useCallback(async () => {
    if (!token) return;
    setDeclining(true);
    try {
      await submitPublicDecline(token, declineReason.trim());
      setDeclined(true);
      setDeclineModalOpen(false);
    } catch (err: any) {
      setSubmitError(err?.response?.data?.error || t('sign.public.failedToSubmit'));
    } finally {
      setDeclining(false);
    }
  }, [token, declineReason]);

  const handleDownloadPublic = useCallback(() => {
    if (!token) return;
    const url = `${config.apiUrl}/sign/public/${token}/view`;
    const link = document.createElement('a');
    link.href = url;
    link.download = '';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [token]);

  // ─── Merge local signatures into fields for display ────────────

  const mergedFields: SignatureField[] = (data?.fields ?? []).map((field) => {
    const localSig = localSignatures[field.id];
    if (localSig) {
      return { ...field, signatureData: localSig };
    }
    return field;
  });

  const hasLocalSignatures = Object.keys(localSignatures).length > 0;
  const allFieldsSigned = sortedUnsignedFields.length === 0 && totalRequiredFields > 0;

  // ─── Error / expired state ────────────────────────────────────

  const isExpired = error && (error as any)?.response?.status === 410;
  const isNotFound = error && (error as any)?.response?.status === 404;

  if (isLoading) {
    return (
      <div className="sign-public-container">
        <div className="sign-public-content">
          <div className="sign-empty">{t('sign.public.loading')}</div>
        </div>
      </div>
    );
  }

  if (isExpired || isNotFound || error) {
    return (
      <div className="sign-public-container">
        <div className="sign-public-content">
          <div className="sign-public-error">
            <AlertTriangle size={48} />
            <h2 style={{ margin: 0, fontSize: 'var(--font-size-xl)', fontFamily: 'var(--font-family)' }}>
              {isExpired ? t('sign.public.linkExpired') : t('sign.public.invalidLink')}
            </h2>
            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>
              {isExpired
                ? t('sign.public.linkExpiredDesc')
                : t('sign.public.invalidLinkDesc')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Declined state
  if (declined) {
    return (
      <div className="sign-public-container">
        <div className="sign-public-content">
          <div className="sign-public-error">
            <XCircle size={48} style={{ color: 'var(--color-error)' }} />
            <h2 style={{ margin: 0, fontSize: 'var(--font-size-xl)', fontFamily: 'var(--font-family)', color: 'var(--color-text-primary)' }}>
              {t('sign.public.declined')}
            </h2>
            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>
              {t('sign.public.declinedDesc')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="sign-public-container">
        <div className="sign-public-content">
          <div className="sign-public-success">
            <CheckCircle size={48} style={{ color: 'var(--color-success)' }} />
            <h2 style={{ margin: 0, fontSize: 'var(--font-size-xl)', fontFamily: 'var(--font-family)', color: 'var(--color-text-primary)' }}>
              {t('sign.public.signedSuccess')}
            </h2>
            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>
              {t('sign.public.signedSuccessDesc')}
            </p>
            <Button
              variant="secondary"
              size="sm"
              icon={<Download size={14} />}
              onClick={handleDownloadPublic}
              style={{ marginTop: 16 }}
            >
              {t('sign.public.downloadPdf')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // If token is already signed
  if (data.token.status === 'signed') {
    return (
      <div className="sign-public-container">
        <div className="sign-public-content">
          <div className="sign-public-success">
            <CheckCircle size={48} style={{ color: 'var(--color-success)' }} />
            <h2 style={{ margin: 0, fontSize: 'var(--font-size-xl)', fontFamily: 'var(--font-family)', color: 'var(--color-text-primary)' }}>
              {t('sign.public.alreadySigned')}
            </h2>
            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>
              {t('sign.public.alreadySignedDesc')}
            </p>
            <Button
              variant="secondary"
              size="sm"
              icon={<Download size={14} />}
              onClick={handleDownloadPublic}
              style={{ marginTop: 16 }}
            >
              {t('sign.public.downloadPdf')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // If token is declined
  if (data.token.status === 'declined') {
    return (
      <div className="sign-public-container">
        <div className="sign-public-content">
          <div className="sign-public-error">
            <XCircle size={48} style={{ color: 'var(--color-error)' }} />
            <h2 style={{ margin: 0, fontSize: 'var(--font-size-xl)', fontFamily: 'var(--font-family)', color: 'var(--color-text-primary)' }}>
              {t('sign.public.signingDeclined')}
            </h2>
            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>
              {t('sign.public.signingDeclinedDesc')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const pdfUrl = `${config.apiUrl}/sign/public/${token}/view`;

  return (
    <div className="sign-public-container">
      {/* Header */}
      <div className="sign-public-header">
        <h1>
          <PenTool size={18} style={{ marginRight: 8, verticalAlign: 'text-bottom', color: '#8b5cf6' }} />
          {data.document.title}
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {data.token.signerName && (
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>
              {t('sign.public.signingAs', { name: data.token.signerName })}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            icon={<XCircle size={14} />}
            onClick={() => setDeclineModalOpen(true)}
          >
            {t('sign.public.decline')}
          </Button>
          {!isGuided && !allFieldsSigned && (
            <Button
              variant="secondary"
              size="sm"
              icon={<PenTool size={14} />}
              onClick={handleStartGuided}
            >
              {t('sign.public.startSigning')}
            </Button>
          )}
          {isGuided && !allFieldsSigned && (
            <>
              <span
                style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-tertiary)',
                  fontFamily: 'var(--font-family)',
                  padding: '4px 8px',
                  background: 'var(--color-bg-tertiary)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                {t('sign.public.fieldProgress', { current: signedCount + 1, total: totalRequiredFields })}
              </span>
              <Button
                variant="secondary"
                size="sm"
                icon={<PenTool size={14} />}
                onClick={handleGuidedFieldClick}
              >
                {t('sign.public.signThisField')}
              </Button>
              {currentFieldIndex < sortedUnsignedFields.length - 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<ChevronRight size={14} />}
                  onClick={handleNextField}
                >
                  {t('sign.public.next')}
                </Button>
              )}
            </>
          )}
          {(allFieldsSigned && hasLocalSignatures) && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleCompleteSigning}
              disabled={submitting}
            >
              {submitting ? t('sign.public.submitting') : t('sign.public.completeSigning')}
            </Button>
          )}
          {(!allFieldsSigned && hasLocalSignatures && !isGuided) && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleCompleteSigning}
              disabled={!hasLocalSignatures || submitting}
            >
              {submitting ? t('sign.public.submitting') : t('sign.public.completeSigning')}
            </Button>
          )}
        </div>
      </div>

      {submitError && (
        <div
          style={{
            padding: '8px 24px',
            background: 'rgba(239, 68, 68, 0.1)',
            color: 'var(--color-error)',
            fontSize: 'var(--font-size-sm)',
            fontFamily: 'var(--font-family)',
            borderBottom: '1px solid var(--color-border-primary)',
          }}
        >
          {submitError}
        </div>
      )}

      {/* Guided mode progress bar */}
      {isGuided && totalRequiredFields > 0 && (
        <div
          style={{
            padding: '0 24px',
            paddingTop: 8,
            paddingBottom: 8,
            borderBottom: '1px solid var(--color-border-primary)',
          }}
        >
          <div
            style={{
              height: 4,
              background: 'var(--color-bg-tertiary)',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${(signedCount / totalRequiredFields) * 100}%`,
                background: '#8b5cf6',
                borderRadius: 2,
                transition: 'width 300ms ease',
              }}
            />
          </div>
        </div>
      )}

      {/* PDF + fields */}
      <div className="sign-public-content" ref={contentRef}>
        <PdfViewer
          url={pdfUrl}
          scale={1.5}
          renderOverlay={(pageNumber, pageWidth, pageHeight) => (
            <FieldOverlay
              fields={mergedFields}
              pageNumber={pageNumber}
              pageWidth={pageWidth}
              pageHeight={pageHeight}
              onFieldClick={handleFieldClick}
              editable={false}
              signable
              highlightFieldId={
                isGuided && sortedUnsignedFields.length > 0
                  ? sortedUnsignedFields[Math.min(currentFieldIndex, sortedUnsignedFields.length - 1)]?.id
                  : undefined
              }
            />
          )}
        />
      </div>

      {/* Signature modal */}
      <SignatureModal
        open={sigModalOpen}
        onOpenChange={setSigModalOpen}
        onApply={handleSignatureApply}
        fieldType={sigFieldType}
      />

      {/* Decline modal */}
      <Modal open={declineModalOpen} onOpenChange={setDeclineModalOpen} width={420} title={t('sign.public.declineToSign')}>
        <Modal.Header title={t('sign.public.declineToSign')} />
        <Modal.Body>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              {t('sign.public.declineConfirm')}
            </div>
            <Input
              label={t('sign.public.reasonOptional')}
              placeholder={t('sign.public.reasonPlaceholder')}
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              size="md"
            />
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" onClick={() => setDeclineModalOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={handleDecline}
            disabled={declining}
            style={{ background: 'var(--color-error)' }}
          >
            {declining ? t('sign.public.declining') : t('sign.public.declineToSign')}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Dropdown popover */}
      {dropdownFieldId && (
        <>
          <div
            onClick={() => { setDropdownFieldId(null); setDropdownOptions([]); }}
            style={{ position: 'fixed', inset: 0, zIndex: 999 }}
          />
          <div
            style={{
              position: 'fixed',
              top: dropdownPos.top,
              left: dropdownPos.left,
              zIndex: 1000,
              background: 'var(--color-bg-primary)',
              border: '1px solid var(--color-border-primary)',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
              minWidth: 160,
              overflow: 'hidden',
            }}
          >
            {dropdownOptions.map((opt) => (
              <button
                key={opt}
                onClick={() => handleDropdownSelect(opt)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '8px 12px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: 'var(--font-size-sm)',
                  fontFamily: 'var(--font-family)',
                  color: 'var(--color-text-primary)',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => { (e.target as HTMLElement).style.background = 'var(--color-bg-tertiary)'; }}
                onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'none'; }}
              >
                {opt}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

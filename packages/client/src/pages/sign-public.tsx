import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, AlertTriangle, PenTool, ChevronRight, Download, XCircle } from 'lucide-react';
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
      // Don't allow re-signing already signed fields
      if (field.signatureData || localSignatures[fieldId]) return;
      setSigFieldType(field.type);
      setActiveFieldId(fieldId);
      setSigModalOpen(true);
    },
    [data, localSignatures],
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
      const msg = err?.response?.data?.error || 'Failed to submit signature';
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
      setSubmitError(err?.response?.data?.error || 'Failed to decline');
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
          <div className="sign-empty">Loading document...</div>
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
              {isExpired ? 'This signing link has expired' : 'Invalid signing link'}
            </h2>
            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>
              {isExpired
                ? 'Please contact the document owner for a new signing link.'
                : 'The signing link you followed is not valid. Please check the URL and try again.'}
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
              You have declined to sign this document
            </h2>
            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>
              The document owner has been notified of your decision.
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
              Document signed successfully
            </h2>
            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>
              Thank you for signing. The document owner has been notified.
            </p>
            <Button
              variant="secondary"
              size="sm"
              icon={<Download size={14} />}
              onClick={handleDownloadPublic}
              style={{ marginTop: 16 }}
            >
              Download PDF
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
              Already signed
            </h2>
            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>
              This document has already been signed with this link.
            </p>
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
              Signing declined
            </h2>
            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>
              This signing request has been declined.
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
              Signing as {data.token.signerName}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            icon={<XCircle size={14} />}
            onClick={() => setDeclineModalOpen(true)}
          >
            Decline
          </Button>
          {!isGuided && !allFieldsSigned && (
            <Button
              variant="secondary"
              size="sm"
              icon={<PenTool size={14} />}
              onClick={handleStartGuided}
            >
              Start signing
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
                Field {signedCount + 1} of {totalRequiredFields}
              </span>
              <Button
                variant="secondary"
                size="sm"
                icon={<PenTool size={14} />}
                onClick={handleGuidedFieldClick}
              >
                Sign this field
              </Button>
              {currentFieldIndex < sortedUnsignedFields.length - 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<ChevronRight size={14} />}
                  onClick={handleNextField}
                >
                  Next
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
              {submitting ? 'Submitting...' : 'Complete signing'}
            </Button>
          )}
          {(!allFieldsSigned && hasLocalSignatures && !isGuided) && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleCompleteSigning}
              disabled={!hasLocalSignatures || submitting}
            >
              {submitting ? 'Submitting...' : 'Complete signing'}
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
      <Modal open={declineModalOpen} onOpenChange={setDeclineModalOpen} width={420} title="Decline to sign">
        <Modal.Header title="Decline to sign" />
        <Modal.Body>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              Are you sure you want to decline signing this document? The document owner will be notified.
            </div>
            <Input
              label="Reason (optional)"
              placeholder="Enter your reason for declining..."
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              size="md"
            />
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" onClick={() => setDeclineModalOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleDecline}
            disabled={declining}
            style={{ background: 'var(--color-error)' }}
          >
            {declining ? 'Declining...' : 'Decline to sign'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

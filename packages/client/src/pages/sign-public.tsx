import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, AlertTriangle, PenTool } from 'lucide-react';
import { Button } from '../components/ui/button';
import { PdfViewer } from '../apps/sign/components/pdf-viewer';
import { FieldOverlay } from '../apps/sign/components/field-overlay';
import { SignatureModal } from '../apps/sign/components/signature-modal';
import { usePublicSignDoc, submitPublicSign } from '../apps/sign/hooks';
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
    },
    [activeFieldId],
  );

  const handleCompleteSigning = useCallback(async () => {
    if (!token || !data) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      // Submit each locally signed field
      const entries = Object.entries(localSignatures);
      let docComplete = false;
      for (const [fieldId, sigData] of entries) {
        const result = await submitPublicSign(token, fieldId, sigData);
        if (result.documentComplete) docComplete = true;
      }
      setCompleted(true);
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Failed to submit signature';
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  }, [token, data, localSignatures]);

  // ─── Merge local signatures into fields for display ────────────

  const mergedFields: SignatureField[] = (data?.fields ?? []).map((field) => {
    const localSig = localSignatures[field.id];
    if (localSig) {
      return { ...field, signatureData: localSig };
    }
    return field;
  });

  const hasLocalSignatures = Object.keys(localSignatures).length > 0;

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
            variant="primary"
            size="sm"
            onClick={handleCompleteSigning}
            disabled={!hasLocalSignatures || submitting}
          >
            {submitting ? 'Submitting...' : 'Complete signing'}
          </Button>
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

      {/* PDF + fields */}
      <div className="sign-public-content">
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
    </div>
  );
}

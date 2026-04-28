import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Loader2 } from 'lucide-react';
import { Modal } from '../../ui/modal';
import type { OdooImportPreview, OdooImportSummary } from '@atlas-platform/shared';
import { humanizeDropReason } from './humanize';

interface Step {
  key: string;
  durationMs: number;
}

const STEPS: Step[] = [
  { key: 'reading', durationMs: 600 },
  { key: 'companies', durationMs: 700 },
  { key: 'contacts', durationMs: 600 },
  { key: 'leadsDeals', durationMs: 800 },
  { key: 'activities', durationMs: 600 },
  { key: 'finalizing', durationMs: 500 },
];

interface Props {
  open: boolean;
  preview: OdooImportPreview;
  /** When set, the server has finished — start the wind-down animation. */
  serverDone: boolean;
  /** Set when the server returns the summary; we reveal the post-modal Done state via this. */
  summary: OdooImportSummary | null;
  /** Called when the user clicks Open CRM after the animation finishes. */
  onOpenCrm: () => void;
}

export function OdooImportProgressModal({ open, preview, serverDone, summary, onOpenCrm }: Props) {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);

  // Reset on open
  useEffect(() => {
    if (open) setCurrentStep(0);
  }, [open]);

  // Drive the step animation. Each step waits its duration before advancing.
  // We never advance past STEPS.length - 1 until the server has actually finished;
  // if the server is fast we still play the full animation, if slow we hold on
  // the last step until done.
  useEffect(() => {
    if (!open) return;
    if (currentStep >= STEPS.length) return;
    const isLast = currentStep === STEPS.length - 1;
    if (isLast && !serverDone) return; // hold on last step until server returns

    const t = window.setTimeout(() => {
      setCurrentStep((s) => s + 1);
    }, STEPS[currentStep].durationMs);
    return () => window.clearTimeout(t);
  }, [open, currentStep, serverDone]);

  const allStepsDone = currentStep >= STEPS.length;
  const showSummary = allStepsDone && summary !== null;

  return (
    <Modal
      open={open}
      onOpenChange={() => {/* not closeable mid-animation */}}
      width={460}
      title={t('import.odoo.progressTitle')}
    >
      <Modal.Header
        title={showSummary ? t('import.odoo.summaryTitle') : t('import.odoo.progressTitle')}
        subtitle={showSummary ? undefined : t('import.odoo.progressSubtitle')}
      />
      <Modal.Body>
        {showSummary ? (
          <SummaryContent summary={summary} t={t} />
        ) : (
          <ProgressContent currentStep={currentStep} preview={preview} t={t} />
        )}
      </Modal.Body>
      {showSummary && (
        <Modal.Footer>
          <button
            type="button"
            onClick={onOpenCrm}
            style={{
              marginLeft: 'auto',
              background: 'var(--color-accent-primary)',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 'var(--font-weight-medium)',
              fontSize: 'var(--font-size-sm)',
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            {t('import.odoo.openCrm')}
          </button>
        </Modal.Footer>
      )}
    </Modal>
  );
}

function ProgressContent({
  currentStep,
  preview,
  t,
}: {
  currentStep: number;
  preview: OdooImportPreview;
  t: (k: string, v?: Record<string, unknown>) => string;
}) {
  const labels: Record<string, string> = {
    reading: t('import.odoo.progressReading'),
    companies: t('import.odoo.progressCompanies', { count: preview.counts.companies }),
    contacts: t('import.odoo.progressContacts', { count: preview.counts.contacts }),
    leadsDeals: t('import.odoo.progressLeadsDeals', {
      leads: preview.counts.leads,
      deals: preview.counts.deals,
    }),
    activities: t('import.odoo.progressActivities', { count: preview.counts.activities }),
    finalizing: t('import.odoo.progressFinalizing'),
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
      {STEPS.map((step, idx) => {
        const isDone = idx < currentStep;
        const isActive = idx === currentStep;
        const isPending = idx > currentStep;
        return (
          <div
            key={step.key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-md)',
              opacity: isPending ? 0.35 : 1,
              transition: 'opacity 200ms ease',
            }}
          >
            <StepIcon done={isDone} active={isActive} />
            <span
              style={{
                fontSize: 'var(--font-size-sm)',
                color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                fontWeight: isActive ? 'var(--font-weight-medium)' : 'var(--font-weight-normal)',
              }}
            >
              {labels[step.key]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function StepIcon({ done, active }: { done: boolean; active: boolean }) {
  if (done) {
    return (
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: 'var(--color-success)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          animation: 'tour-pulse-once 200ms ease-out',
        }}
      >
        <Check size={14} color="white" strokeWidth={3} />
      </span>
    );
  }
  if (active) {
    return (
      <span
        style={{
          width: 22,
          height: 22,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Loader2 size={18} className="odoo-spin" color="var(--color-accent-primary)" strokeWidth={2.5} />
      </span>
    );
  }
  return (
    <span
      style={{
        width: 22,
        height: 22,
        borderRadius: '50%',
        border: '2px solid var(--color-border-primary)',
        flexShrink: 0,
      }}
    />
  );
}

function SummaryContent({
  summary,
  t,
}: {
  summary: OdooImportSummary;
  t: (k: string, v?: Record<string, unknown>) => string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
      <Counter label={t('import.odoo.summaryCompanies', { count: summary.imported.companies })} count={summary.imported.companies} />
      <Counter label={t('import.odoo.summaryContacts', { count: summary.imported.contacts })} count={summary.imported.contacts} />
      <Counter label={t('import.odoo.summaryLeads', { count: summary.imported.leads })} count={summary.imported.leads} />
      <Counter label={t('import.odoo.summaryDeals', { count: summary.imported.deals })} count={summary.imported.deals} />
      <Counter label={t('import.odoo.summaryActivities', { count: summary.imported.activities })} count={summary.imported.activities} />
      {summary.dropped.length > 0 && (
        <details style={{ marginTop: 'var(--spacing-md)' }}>
          <summary
            style={{
              cursor: 'pointer',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
              fontWeight: 500,
            }}
          >
            {t('import.odoo.summaryDroppedTitle')}
          </summary>
          <ul
            style={{
              margin: 'var(--spacing-sm) 0 0 0',
              paddingLeft: 'var(--spacing-lg)',
              color: 'var(--color-text-secondary)',
              fontSize: 'var(--font-size-sm)',
              lineHeight: 1.5,
            }}
          >
            {summary.dropped.map((d, i) => (
              <li key={i}>
                {humanizeDropReason(d.reason, t)}{' '}
                <span style={{ color: 'var(--color-text-tertiary)' }}>({d.count})</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Counter({ label, count }: { label: ReactNode; count: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-md)',
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: count > 0 ? 'var(--color-success)' : 'var(--color-bg-tertiary)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Check size={14} color={count > 0 ? 'white' : 'var(--color-text-tertiary)'} strokeWidth={3} />
      </span>
      <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
        {label}
      </span>
    </div>
  );
}

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Send, Copy, Trash2, Edit3, Link2, ArrowLeft, ChevronDown, ChevronRight, History, FileText,
} from 'lucide-react';
import { DataTable, type DataTableColumn } from '../../../components/ui/data-table';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { IconButton } from '../../../components/ui/icon-button';
import { ConfirmDialog } from '../../../components/ui/confirm-dialog';
import { Tooltip } from '../../../components/ui/tooltip';
import { StatusTimeline } from '../../../components/shared/status-timeline';
import { LineItemsEditor, type LineItem } from '../../../components/shared/line-items-editor';
import { TotalsBlock } from '../../../components/shared/totals-block';
import {
  useProposal,
  useSendProposal,
  useDuplicateProposal,
  useDeleteProposal,
  useMyCrmPermission,
  useProposalRevisions,
  useRestoreProposalRevision,
  useProposalInvoices,
  useConvertProposalToInvoice,
  canAccess,
  type Proposal,
  type ProposalRevision,
} from '../hooks';
import { getProposalStatusVariant } from '@atlas-platform/shared';
import { formatDate } from '../../../lib/format';
import { useToastStore } from '../../../stores/toast-store';

interface ProposalDetailPanelProps {
  proposalId: string;
  onBack: () => void;
  onEdit: (proposal: Proposal) => void;
}

export function ProposalDetailPanel({ proposalId, onBack, onEdit }: ProposalDetailPanelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: perm } = useMyCrmPermission();
  const canUpdate = canAccess(perm?.role, 'proposals', 'update');
  const canCreate = canAccess(perm?.role, 'proposals', 'create');
  const canDelete = canAccess(perm?.role, 'proposals', 'delete');
  const { data: proposal, isLoading } = useProposal(proposalId);
  const sendProposal = useSendProposal();
  const duplicateProposal = useDuplicateProposal();
  const deleteProposal = useDeleteProposal();
  const convertToInvoice = useConvertProposalToInvoice();
  const { data: proposalInvoices = [] } = useProposalInvoices(proposalId);
  const hasLinkedInvoice = proposalInvoices.length > 0;
  const { addToast } = useToastStore();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedRevision, setExpandedRevision] = useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<ProposalRevision | null>(null);
  const { data: revisions = [] } = useProposalRevisions(showHistory ? proposalId : undefined);
  const restoreRevision = useRestoreProposalRevision();

  const publicUrl = proposal
    ? `${window.location.origin}/proposal/${proposal.publicToken}`
    : '';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setLinkCopied(true);
    addToast({ type: 'success', message: t('crm.proposals.linkCopied') });
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const statusSteps = useMemo(() => {
    if (!proposal) return [];
    return [
      { label: t('crm.proposals.status.draft'), timestamp: formatDate(proposal.createdAt) },
      { label: t('crm.proposals.status.sent'), timestamp: proposal.sentAt ? formatDate(proposal.sentAt) : null },
      { label: t('crm.proposals.status.viewed'), timestamp: proposal.viewedAt ? formatDate(proposal.viewedAt) : null },
      {
        label: proposal.status === 'declined'
          ? t('crm.proposals.status.declined')
          : t('crm.proposals.status.accepted'),
        timestamp: proposal.acceptedAt
          ? formatDate(proposal.acceptedAt)
          : proposal.declinedAt
            ? formatDate(proposal.declinedAt)
            : null,
      },
    ];
  }, [proposal, t]);

  const currentStepIndex = useMemo(() => {
    if (!proposal) return 0;
    switch (proposal.status) {
      case 'draft': return 0;
      case 'sent': return 1;
      case 'viewed': return 2;
      case 'accepted': return 3;
      case 'declined': return 3;
      case 'expired': return 1;
      default: return 0;
    }
  }, [proposal]);

  const readOnlyLineItems: LineItem[] = useMemo(() => {
    if (!proposal) return [];
    return proposal.lineItems.map((li, i) => ({
      id: String(i),
      description: li.description,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      taxRate: li.taxRate,
    }));
  }, [proposal]);

  if (isLoading || !proposal) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
        {t('common.loading')}
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
          padding: 'var(--spacing-sm) var(--spacing-lg)',
          borderBottom: '1px solid var(--color-border-secondary)',
          flexShrink: 0,
        }}
      >
        <IconButton icon={<ArrowLeft size={16} />} label={t('common.back')} size={28} onClick={onBack} />
        <span
          style={{
            fontSize: 'var(--font-size-md)',
            fontWeight: 'var(--font-weight-semibold)' as never,
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-family)',
            flex: 1,
          }}
        >
          {proposal.title}
        </span>
        <Badge variant={getProposalStatusVariant(proposal.status)}>
          {t(`crm.proposals.status.${proposal.status}`)}
        </Badge>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 'var(--spacing-xl)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
        {/* Status timeline */}
        <StatusTimeline steps={statusSteps} currentIndex={currentStepIndex} />

        {/* Meta */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
          {proposal.companyName && (
            <MetaField label={t('crm.sidebar.companies')} value={proposal.companyName} />
          )}
          {proposal.contactName && (
            <MetaField label={t('crm.sidebar.contacts')} value={proposal.contactName} />
          )}
          {proposal.dealTitle && (
            <MetaField label={t('crm.sidebar.deals')} value={proposal.dealTitle} />
          )}
          {proposal.validUntil && (
            <MetaField label={t('crm.proposals.validUntil')} value={formatDate(proposal.validUntil)} />
          )}
        </div>

        {/* Scope / terms */}
        {proposal.notes && (
          <div>
            <div style={sectionLabelStyle}>{t('crm.proposals.scopeAndTerms')}</div>
            <div
              style={{
                fontSize: 'var(--font-size-sm)',
                fontFamily: 'var(--font-family)',
                color: 'var(--color-text-primary)',
                whiteSpace: 'pre-wrap',
                padding: 'var(--spacing-md)',
                background: 'var(--color-bg-secondary)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              {proposal.notes}
            </div>
          </div>
        )}

        {/* Line items */}
        <div>
          <div style={sectionLabelStyle}>{t('crm.proposals.pricing')}</div>
          <LineItemsEditor items={readOnlyLineItems} onChange={() => {}} readOnly />
        </div>

        {/* Totals */}
        <div style={{ maxWidth: 320, marginLeft: 'auto' }}>
          <TotalsBlock
            subtotal={proposal.subtotal}
            taxPercent={proposal.taxPercent}
            discountPercent={proposal.discountPercent}
          />
        </div>

        {/* Public link */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)',
            padding: 'var(--spacing-md)',
            background: 'var(--color-bg-secondary)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <Link2 size={14} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
          <span
            style={{
              fontSize: 'var(--font-size-sm)',
              fontFamily: 'var(--font-family)',
              color: 'var(--color-text-secondary)',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {publicUrl}
          </span>
          <Button variant="ghost" size="sm" onClick={handleCopyLink}>
            {linkCopied ? t('crm.proposals.linkCopied') : t('crm.proposals.copyLink')}
          </Button>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
          {canUpdate && (
            <Button variant="secondary" size="sm" icon={<Edit3 size={14} />} onClick={() => onEdit(proposal)}>
              {t('crm.proposals.edit')}
            </Button>
          )}
          {canUpdate && proposal.status === 'draft' && (
            <Button variant="primary" size="sm" icon={<Send size={14} />} onClick={() => sendProposal.mutate(proposal.id)} disabled={sendProposal.isPending}>
              {t('crm.proposals.send')}
            </Button>
          )}
          {canCreate && (
            <Tooltip
              content={hasLinkedInvoice ? t('crm.proposals.alreadyConverted') : undefined}
              side="top"
            >
              <Button
                variant="secondary"
                size="sm"
                icon={<FileText size={14} />}
                disabled={hasLinkedInvoice || convertToInvoice.isPending}
                onClick={() => {
                  convertToInvoice.mutate(proposal.id, {
                    onSuccess: ({ invoiceId }) => {
                      addToast({ type: 'success', message: t('crm.proposals.convertedToInvoice') });
                      navigate(`/invoices?view=invoice-detail&invoiceId=${invoiceId}`);
                    },
                    onError: () => {
                      addToast({ type: 'error', message: t('crm.proposals.convertToInvoiceFailed') });
                    },
                  });
                }}
              >
                {t('crm.proposals.convertToInvoice')}
              </Button>
            </Tooltip>
          )}
          {canCreate && (
            <Button
              variant="secondary"
              size="sm"
              icon={<Copy size={14} />}
              onClick={() => duplicateProposal.mutate(proposal.id, {
                onSuccess: () => {
                  addToast({ type: 'success', message: t('crm.proposals.duplicated') });
                },
              })}
              disabled={duplicateProposal.isPending}
            >
              {t('crm.proposals.duplicate')}
            </Button>
          )}
          {canDelete && (
            <Button variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={() => setShowDeleteConfirm(true)}>
              {t('crm.proposals.delete')}
            </Button>
          )}
        </div>

        {/* History */}
        <div>
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-xs)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0',
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-family)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-medium)' as never,
            }}
          >
            <History size={14} />
            {t('crm.proposals.history')}
            {revisions && revisions.length > 0 && (
              <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)' }}>
                ({t('crm.proposals.revisions', { count: revisions.length })})
              </span>
            )}
            {showHistory ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>

          {showHistory && (
            <div style={{ marginTop: 'var(--spacing-sm)', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {!revisions || revisions.length === 0 ? (
                <div style={{ fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family)', color: 'var(--color-text-tertiary)', padding: 'var(--spacing-md)' }}>
                  {t('crm.proposals.noHistory')}
                </div>
              ) : (
                revisions.map((rev) => (
                  <RevisionRow
                    key={rev.id}
                    revision={rev}
                    isExpanded={expandedRevision === rev.id}
                    onToggle={() => setExpandedRevision(expandedRevision === rev.id ? null : rev.id)}
                    canRestore={canUpdate}
                    onRestore={() => setRestoreTarget(rev)}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={t('crm.proposals.delete')}
        description={t('crm.proposals.deleteConfirm', { title: proposal.title })}
        confirmLabel={t('common.delete')}
        destructive
        onConfirm={() => {
          deleteProposal.mutate(proposal.id, { onSuccess: () => onBack() });
        }}
      />

      <ConfirmDialog
        open={!!restoreTarget}
        onOpenChange={(open) => { if (!open) setRestoreTarget(null); }}
        title={t('crm.proposals.restoreConfirmTitle', { number: restoreTarget?.revisionNumber })}
        description={t('crm.proposals.restoreConfirmBody')}
        confirmLabel={t('crm.proposals.restoreVersion')}
        onConfirm={() => {
          if (!restoreTarget) return;
          restoreRevision.mutate(
            { proposalId: proposal.id, revisionId: restoreTarget.id },
            {
              onSuccess: () => {
                addToast({ type: 'success', message: t('crm.proposals.restoredFrom', { number: restoreTarget.revisionNumber }) });
                setRestoreTarget(null);
              },
            },
          );
        }}
      />
    </div>
  );
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={sectionLabelStyle}>{label}</span>
      <span
        style={{
          fontSize: 'var(--font-size-sm)',
          fontFamily: 'var(--font-family)',
          color: 'var(--color-text-primary)',
        }}
      >
        {value}
      </span>
    </div>
  );
}

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  fontWeight: 'var(--font-weight-semibold)' as never,
  color: 'var(--color-text-tertiary)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  fontFamily: 'var(--font-family)',
  marginBottom: 'var(--spacing-xs)',
};

interface RevisionRowProps {
  revision: ProposalRevision;
  isExpanded: boolean;
  onToggle: () => void;
  canRestore: boolean;
  onRestore: () => void;
}

function RevisionRow({ revision, isExpanded, onToggle, canRestore, onRestore }: RevisionRowProps) {
  const { t } = useTranslation();
  const snap = revision.snapshotJson;

  return (
    <div
      style={{
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border-secondary)',
        overflow: 'hidden',
        fontFamily: 'var(--font-family)',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
          width: '100%',
          padding: 'var(--spacing-sm) var(--spacing-md)',
          background: 'var(--color-bg-secondary)',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {isExpanded ? <ChevronDown size={13} style={{ flexShrink: 0 }} /> : <ChevronRight size={13} style={{ flexShrink: 0 }} />}
        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' as never, color: 'var(--color-text-primary)' }}>
          #{revision.revisionNumber}
        </span>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', flex: 1 }}>
          {formatDate(revision.createdAt)}
          {revision.changeReason ? ` — ${revision.changeReason}` : ''}
        </span>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
          {snap.currency} {snap.total.toFixed(2)}
        </span>
      </button>

      {isExpanded && (
        <div style={{ padding: 'var(--spacing-md)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
          {/* Snapshot summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--spacing-sm)' }}>
            <div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>{t('crm.proposals.statusLabel')}</div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>{snap.status}</div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>{t('crm.proposals.snapshotTotal')}</div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>{snap.currency} {snap.total.toFixed(2)}</div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>{t('crm.proposals.pricing')}</div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                {t('crm.proposals.snapshotItems', { count: snap.lineItems?.length ?? 0 })}
              </div>
            </div>
          </div>

          {/* Line items */}
          {snap.lineItems && snap.lineItems.length > 0 && (() => {
            type LineItemRow = { id: string; description: string; quantity: number; unitPrice: number; amount: number };
            const liRows: LineItemRow[] = snap.lineItems.map((li, i) => ({
              id: String(i),
              description: li.description,
              quantity: li.quantity,
              unitPrice: li.unitPrice,
              amount: li.quantity * li.unitPrice,
            }));
            const liColumns: DataTableColumn<LineItemRow>[] = [
              {
                key: 'description',
                label: t('crm.proposals.titleLabel'),
                hideable: false,
                minWidth: 80,
                render: (row) => <span>{row.description}</span>,
                searchValue: (row) => row.description,
              },
              {
                key: 'quantity',
                label: 'Qty',
                width: 60,
                align: 'right',
                render: (row) => <span>{row.quantity}</span>,
              },
              {
                key: 'unitPrice',
                label: 'Unit',
                width: 70,
                align: 'right',
                render: (row) => <span>{row.unitPrice.toFixed(2)}</span>,
              },
              {
                key: 'amount',
                label: 'Amt',
                width: 70,
                align: 'right',
                render: (row) => <span>{row.amount.toFixed(2)}</span>,
              },
            ];
            return (
              <DataTable
                data={liRows}
                columns={liColumns}
                storageKey="crm_proposal_line_items"
                paginated={false}
                searchable={false}
                hideFooter
              />
            );
          })()}

          {snap.notes && (
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap' }}>
              {snap.notes}
            </div>
          )}

          {canRestore && (
            <div>
              <Button variant="secondary" size="sm" onClick={onRestore}>
                {t('crm.proposals.restoreVersion')}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

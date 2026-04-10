import { useMemo, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FileText,
  Upload,
  PenTool,
  Send,
  Calendar,
  Download,
  Trash2,
  Users,
  Tag,
  Search,
  CheckCircle,
  Building2,
} from 'lucide-react';
import { DataTable, type DataTableColumn } from '../../../components/ui/data-table';
import { ListToolbar } from '../../../components/ui/list-toolbar';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Input } from '../../../components/ui/input';
import { IconButton } from '../../../components/ui/icon-button';
import { Skeleton } from '../../../components/ui/skeleton';
import { StatusDot } from '../../../components/ui/status-dot';
import { Chip } from '../../../components/ui/chip';
import { FeatureEmptyState } from '../../../components/ui/feature-empty-state';
import { formatDate } from '../../../lib/format';
import { STATUS_BADGE_MAP } from '../lib/helpers';
import type { DocumentType, SignatureDocument } from '@atlasmail/shared';

const TYPE_FILTERS: Array<{ value: DocumentType | 'all'; labelKey: string }> = [
  { value: 'all', labelKey: 'sign.filters.all' },
  { value: 'contract', labelKey: 'sign.filters.contracts' },
  { value: 'nda', labelKey: 'sign.filters.ndas' },
  { value: 'offer_letter', labelKey: 'sign.filters.offerLetters' },
  { value: 'acknowledgment', labelKey: 'sign.filters.acknowledgments' },
  { value: 'waiver', labelKey: 'sign.filters.waivers' },
  { value: 'other', labelKey: 'sign.filters.other' },
];

type DocWithSigners = SignatureDocument & {
  signerCount?: number;
  signedCount?: number;
  signers?: Array<{ email: string; name: string | null; status: string }>;
};

export function SignListView({
  searchQuery,
  onSearchChange,
  uploading,
  docsLoading,
  filteredDocs,
  selectedDocId,
  sortField,
  sortDir,
  onSort,
  onUpload,
  onOpenDoc,
  onDownload,
  onRequestDelete,
}: {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  uploading: boolean;
  docsLoading: boolean;
  filteredDocs: DocWithSigners[];
  selectedDocId: string | null;
  sortField: string;
  sortDir: 'asc' | 'desc';
  onSort: (column: string) => void;
  onUpload: () => void;
  onOpenDoc: (doc: SignatureDocument) => void;
  onDownload: (id: string) => void;
  onRequestDelete: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [typeFilter, setTypeFilter] = useState<DocumentType | 'all'>('all');

  const visibleDocs = useMemo(() => {
    if (typeFilter === 'all') return filteredDocs;
    return filteredDocs.filter((doc) => doc.documentType === typeFilter);
  }, [filteredDocs, typeFilter]);

  return (
    <>
      <ListToolbar>
        <Input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('sign.list.search', 'Search documents...')}
          iconLeft={<Search size={14} />}
          size="sm"
          style={{ width: 220 }}
        />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-xs)',
            flexWrap: 'wrap',
          }}
          role="group"
          aria-label={t('sign.documentType')}
        >
          {TYPE_FILTERS.map((f) => (
            <Chip
              key={f.value}
              active={typeFilter === f.value}
              onClick={() => setTypeFilter(f.value)}
              aria-pressed={typeFilter === f.value}
            >
              {t(f.labelKey)}
            </Chip>
          ))}
        </div>
      </ListToolbar>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {uploading ? (
          <div className="sign-upload-feedback">
            <Skeleton width={60} height={60} borderRadius="var(--radius-lg)" />
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-sm)' }}>
              {t('sign.editor.uploading')}
            </span>
          </div>
        ) : docsLoading ? (
          <div className="sign-empty">{t('sign.list.loading')}</div>
        ) : visibleDocs.length === 0 ? (
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
            onAction={onUpload}
          />
        ) : (
          <DataTable<DocWithSigners>
            data={visibleDocs}
            columns={[
              {
                key: 'title',
                label: t('sign.list.title'),
                icon: <FileText size={12} />,
                sortable: true,
                render: (doc) => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span>{doc.title}</span>
                    {(doc.tags ?? []).map((tag) => (
                      <Chip key={tag} color="#8b5cf6" height={18} style={{ fontSize: 10 }}>
                        {tag}
                      </Chip>
                    ))}
                  </div>
                ),
              },
              {
                key: 'counterpartyName',
                label: t('sign.counterparty'),
                icon: <Building2 size={12} />,
                sortable: true,
                minWidth: 160,
                render: (doc) =>
                  doc.counterpartyName ? (
                    <span>{doc.counterpartyName}</span>
                  ) : (
                    <span style={{ color: 'var(--color-text-tertiary)' }}>&mdash;</span>
                  ),
              },
              {
                key: 'status',
                label: t('sign.list.status'),
                icon: <Tag size={12} />,
                sortable: true,
                width: 110,
                render: (doc) => (
                  <Badge variant={STATUS_BADGE_MAP[doc.status] ?? 'default'}>
                    {doc.status}
                  </Badge>
                ),
              },
              {
                key: 'signers',
                label: t('sign.list.signers'),
                icon: <Users size={12} />,
                width: 140,
                render: (doc) =>
                  doc.signerCount && doc.signerCount > 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ display: 'flex', gap: 3 }}>
                        {(doc.signers ?? []).map((signer, sIdx) => (
                          <StatusDot
                            key={sIdx}
                            color={
                              signer.status === 'signed' ? 'var(--color-success)'
                                : signer.status === 'declined' || signer.status === 'expired' ? 'var(--color-error)'
                                : 'var(--color-warning)'
                            }
                            size={8}
                            glow={signer.status === 'signed'}
                            label={`${signer.email}: ${signer.status}`}
                          />
                        ))}
                      </div>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                        {doc.signedCount}/{doc.signerCount}
                      </span>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--color-text-tertiary)' }}>&mdash;</span>
                  ),
              },
              {
                key: 'createdAt',
                label: t('sign.list.created'),
                icon: <Calendar size={12} />,
                sortable: true,
                width: 130,
                render: (doc) => (
                  <span style={{ color: 'var(--color-text-secondary)' }}>{formatDate(doc.createdAt)}</span>
                ),
              },
              {
                key: 'actions',
                label: t('sign.list.actions'),
                width: 80,
                render: (doc) => (
                  <div
                    style={{ display: 'flex', gap: 2 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {doc.status === 'signed' && (
                      <IconButton
                        icon={<Download size={14} />}
                        label={t('sign.editor.downloadPdf')}
                        size={26}
                        onClick={() => onDownload(doc.id)}
                      />
                    )}
                    <IconButton
                      icon={<Trash2 size={14} />}
                      label={t('sign.editor.deleteDocument')}
                      size={26}
                      destructive
                      onClick={() => onRequestDelete(doc.id)}
                    />
                  </div>
                ),
              },
            ] as DataTableColumn<DocWithSigners>[]}
            onRowClick={onOpenDoc}
            activeRowId={selectedDocId}
            sort={{ column: sortField, direction: sortDir }}
            onSortChange={(s) => {
              if (!s) return;
              onSort(s.column);
            }}
            rowClassName={(doc) => `sign-doc-row-dt`}
            paginated={false}
            hideFooter={false}
            emptyTitle={t('sign.empty.title')}
          />
        )}
      </div>
    </>
  );
}

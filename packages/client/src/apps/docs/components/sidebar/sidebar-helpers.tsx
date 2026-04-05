import { IconButton } from '../../../../components/ui/icon-button';
import { useTranslation } from 'react-i18next';
import { useDocumentList } from '../../hooks';
import { RotateCcw } from 'lucide-react';
import { FlatDocRow } from './flat-doc-row';
import type { DocumentTreeNode } from '@atlasmail/shared';

// ─── SidebarButton ──────────────────────────────────────────────────────

export function SidebarButton({
  icon,
  onClick,
  tooltip,
  disabled,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  tooltip?: string;
  disabled?: boolean;
}) {
  return (
    <IconButton
      icon={icon}
      label={tooltip ?? ''}
      size={22}
      tooltip={!!tooltip}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{ opacity: disabled ? 0.4 : 1 }}
    />
  );
}

// ─── EmptySidebarMsg ────────────────────────────────────────────────────

export function EmptySidebarMsg({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: '16px 12px',
        textAlign: 'center',
        color: 'var(--color-text-tertiary)',
        fontSize: 12,
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
}

// ─── LoadingPlaceholder ─────────────────────────────────────────────────

export function LoadingPlaceholder() {
  return (
    <div style={{ padding: '8px' }}>
      {[120, 90, 140, 80, 110].map((w, i) => (
        <div
          key={i}
          style={{
            height: 28,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '0 8px',
          }}
        >
          <div style={{ width: 16, height: 16, borderRadius: 3, background: 'var(--color-surface-hover)' }} />
          <div style={{ width: w, height: 10, borderRadius: 3, background: 'var(--color-surface-hover)' }} />
        </div>
      ))}
    </div>
  );
}

// ─── Trash view ─────────────────────────────────────────────────────────

export function TrashView({
  selectedId,
  onSelect,
  onRestore,
}: {
  selectedId?: string;
  onSelect: (id: string) => void;
  onRestore: (id: string) => void;
}) {
  const { t } = useTranslation();
  const { data } = useDocumentList(true); // include archived
  const allDocs = data?.documents ?? [];
  const archivedDocs = allDocs.filter((d) => d.isArchived);

  if (archivedDocs.length === 0) {
    return <EmptySidebarMsg>{t('docs.trashEmpty')}</EmptySidebarMsg>;
  }

  return (
    <>
      {archivedDocs.map((doc) => (
        <FlatDocRow
          key={doc.id}
          id={doc.id}
          title={doc.title}
          icon={doc.icon}
          isSelected={doc.id === selectedId}
          onClick={() => onSelect(doc.id)}
          muted
          action={
            <SidebarButton
              icon={<RotateCcw size={12} />}
              onClick={() => onRestore(doc.id)}
              tooltip={t('docs.restore')}
            />
          }
        />
      ))}
    </>
  );
}

// ─── Tree filter helper ─────────────────────────────────────────────────

export function filterTree(tree: DocumentTreeNode[], query: string): DocumentTreeNode[] {
  const result: DocumentTreeNode[] = [];
  for (const node of tree) {
    const matchesTitle = node.title.toLowerCase().includes(query);
    const filteredChildren = filterTree(node.children, query);
    if (matchesTitle || filteredChildren.length > 0) {
      result.push({
        ...node,
        children: filteredChildren,
      });
    }
  }
  return result;
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, ExternalLink } from 'lucide-react';
import { useLinkCounts, useLinkedRecords, useDeleteLink } from '../../hooks/use-record-links';
import { appRegistry } from '../../apps';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';
import { LinkPicker } from './LinkPicker';
import { appRecordPath } from '../../lib/app-routes';
import type { LinkedRecord } from '@atlas-platform/shared';

export function SmartButtonBar({ appId, recordId }: { appId: string; recordId: string }) {
  const { data: counts } = useLinkCounts(appId, recordId);
  const [pickerOpen, setPickerOpen] = useState(false);

  if (!counts || counts.length === 0) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '4px 16px',
        gap: 6,
        minHeight: 34,
        borderBottom: '1px solid var(--color-border-secondary)',
      }}>
        <AddButton onClick={() => setPickerOpen(true)} />
        <LinkPicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          sourceAppId={appId}
          sourceRecordId={recordId}
        />
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: '4px 16px',
      gap: 6,
      minHeight: 34,
      borderBottom: '1px solid var(--color-border-secondary)',
      flexWrap: 'wrap',
    }}>
      {counts.map((c) => (
        <SmartButton
          key={c.appId}
          targetAppId={c.appId}
          count={c.count}
          sourceAppId={appId}
          sourceRecordId={recordId}
        />
      ))}
      <AddButton onClick={() => setPickerOpen(true)} />
      <LinkPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        sourceAppId={appId}
        sourceRecordId={recordId}
      />
    </div>
  );
}

function SmartButton({
  targetAppId,
  count,
  sourceAppId,
  sourceRecordId,
}: {
  targetAppId: string;
  count: number;
  sourceAppId: string;
  sourceRecordId: string;
}) {
  const app = appRegistry.get(targetAppId);
  const Icon = app?.icon;
  const name = app?.name ?? targetAppId;
  const color = app?.color ?? 'var(--color-text-tertiary)';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            height: 26,
            padding: '0 10px',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--color-border-primary)',
            background: 'var(--color-bg-primary)',
            color: 'var(--color-text-secondary)',
            fontSize: 12,
            fontWeight: 500,
            fontFamily: 'var(--font-family)',
            cursor: 'pointer',
            transition: 'background 0.15s, border-color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--color-surface-hover)';
            e.currentTarget.style.borderColor = color;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--color-bg-primary)';
            e.currentTarget.style.borderColor = 'var(--color-border-primary)';
          }}
        >
          {Icon && <Icon size={13} color={color} />}
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{count}</span>
          <span>{name}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={4}>
        <LinkedRecordsList
          sourceAppId={sourceAppId}
          sourceRecordId={sourceRecordId}
          filterAppId={targetAppId}
        />
      </PopoverContent>
    </Popover>
  );
}

function LinkedRecordsList({
  sourceAppId,
  sourceRecordId,
  filterAppId,
}: {
  sourceAppId: string;
  sourceRecordId: string;
  filterAppId: string;
}) {
  const navigate = useNavigate();
  const { data: allLinks, isLoading } = useLinkedRecords(sourceAppId, sourceRecordId);
  const deleteMutation = useDeleteLink(sourceAppId, sourceRecordId);

  const links = (allLinks ?? []).filter((l: LinkedRecord) => l.appId === filterAppId);

  if (isLoading) {
    return (
      <div style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-text-tertiary)' }}>
        Loading...
      </div>
    );
  }

  if (links.length === 0) {
    return (
      <div style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-text-tertiary)' }}>
        No linked records
      </div>
    );
  }

  return (
    <div style={{ minWidth: 220, maxWidth: 320 }}>
      {links.map((link: LinkedRecord) => (
        <div
          key={link.linkId}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            cursor: 'pointer',
            transition: 'background 0.1s',
            borderBottom: '1px solid var(--color-border-secondary)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <span
            style={{ flex: 1, fontSize: 13, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            onClick={() => navigate(appRecordPath(link.appId, link.recordId))}
          >
            {link.title}
          </span>
          <button
            onClick={() => navigate(appRecordPath(link.appId, link.recordId))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: 2, display: 'flex' }}
            title="Open"
          >
            <ExternalLink size={12} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              deleteMutation.mutate(link.linkId);
            }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: 2, display: 'flex' }}
            title="Remove link"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Link to another record"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 26,
        height: 26,
        borderRadius: 'var(--radius-xl)',
        border: '1px dashed var(--color-border-primary)',
        background: 'transparent',
        color: 'var(--color-text-tertiary)',
        cursor: 'pointer',
        transition: 'background 0.15s, color 0.15s, border-color 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--color-surface-hover)';
        e.currentTarget.style.color = 'var(--color-text-primary)';
        e.currentTarget.style.borderColor = 'var(--color-accent-primary)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.color = 'var(--color-text-tertiary)';
        e.currentTarget.style.borderColor = 'var(--color-border-primary)';
      }}
    >
      <Plus size={14} />
    </button>
  );
}

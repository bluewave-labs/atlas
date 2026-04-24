import { useState } from 'react';
import { Search } from 'lucide-react';
import { Modal } from '../ui/modal';
import { useGlobalSearch } from '../../hooks/use-global-search';
import { useCreateLink } from '../../hooks/use-record-links';
import { appRegistry } from '../../apps';
import type { GlobalSearchResult } from '@atlas-platform/shared';

interface LinkPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceAppId: string;
  sourceRecordId: string;
}

export function LinkPicker({ open, onOpenChange, sourceAppId, sourceRecordId }: LinkPickerProps) {
  const [query, setQuery] = useState('');
  const { data: results, isLoading } = useGlobalSearch(query);
  const createLink = useCreateLink(sourceAppId, sourceRecordId);

  function handleSelect(result: GlobalSearchResult) {
    createLink.mutate(
      { targetAppId: result.appId, targetRecordId: result.recordId },
      { onSuccess: () => { onOpenChange(false); setQuery(''); } },
    );
  }

  // Group results by app
  const grouped = (results ?? []).reduce<Record<string, GlobalSearchResult[]>>((acc, r) => {
    (acc[r.appId] ??= []).push(r);
    return acc;
  }, {});

  return (
    <Modal open={open} onOpenChange={onOpenChange} width={480}>
      <Modal.Header title="Link to record" />
      {/* No Modal.Footer: links are created immediately on result-row click.
          There is no pending selection requiring an explicit confirm action. */}
      <Modal.Body>
        <div style={{ padding: '0 0 8px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            border: '1px solid var(--color-border-primary)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-bg-primary)',
          }}>
            <Search size={15} color="var(--color-text-tertiary)" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search docs, tasks, drawings, tables..."
              autoFocus
              className="bare-search-input"
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: 14,
                fontFamily: 'var(--font-family)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>
        </div>

        <div style={{ maxHeight: 360, overflow: 'auto' }}>
          {query.length < 2 && (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
              Type at least 2 characters to search
            </div>
          )}

          {query.length >= 2 && isLoading && (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
              Searching...
            </div>
          )}

          {query.length >= 2 && !isLoading && results?.length === 0 && (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
              No results found
            </div>
          )}

          {Object.entries(grouped).map(([appId, items]) => {
            const app = appRegistry.get(appId);
            const Icon = app?.icon;
            return (
              <div key={appId}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 12px 4px',
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--color-text-tertiary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}>
                  {Icon && <Icon size={12} color={app?.color} />}
                  {app?.name ?? appId}
                </div>
                {items.map((result) => (
                  <button
                    key={result.recordId}
                    onClick={() => handleSelect(result)}
                    disabled={createLink.isPending}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      width: '100%',
                      padding: '8px 12px',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontFamily: 'var(--font-family)',
                      color: 'var(--color-text-primary)',
                      textAlign: 'left',
                      transition: 'background 0.1s',
                      borderRadius: 'var(--radius-sm)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-hover)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    {result.title}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </Modal.Body>
    </Modal>
  );
}

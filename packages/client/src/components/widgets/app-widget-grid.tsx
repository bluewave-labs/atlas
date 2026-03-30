import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings2, ChevronUp, ChevronDown } from 'lucide-react';
import { useAppWidgets, useUpdateAppWidgets } from '../../hooks/use-app-widgets';
import { appRegistry } from '../../config/app-registry';
import { Button } from '../ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';
import type { ClientAppWidget } from '../../config/app-manifest.client';

const SIZE_SPAN: Record<string, number> = { sm: 1, md: 2, lg: 3 };

interface AppWidgetGridProps {
  appId: string;
  className?: string;
}

export function AppWidgetGrid({ appId, className }: AppWidgetGridProps) {
  const { t } = useTranslation();
  const { widgets, isLoading } = useAppWidgets(appId);
  const [pickerOpen, setPickerOpen] = useState(false);

  if (isLoading || widgets.length === 0) return null;

  return (
    <div className={className}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <span
          style={{
            fontSize: 'var(--font-size-xs)',
            fontWeight: 600,
            color: 'var(--color-text-tertiary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {t('widgets.title')}
        </span>
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" style={{ gap: 4 }}>
              <Settings2 size={14} />
              {t('widgets.customize')}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" style={{ width: 320, padding: 0 }}>
            <WidgetPicker appId={appId} onClose={() => setPickerOpen(false)} />
          </PopoverContent>
        </Popover>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 16,
        }}
      >
        {widgets.map((widget) => (
          <div
            key={widget.id}
            style={{
              gridColumn: `span ${SIZE_SPAN[widget.defaultSize] ?? 1}`,
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border-secondary)',
              borderRadius: 'var(--radius-xl)',
              overflow: 'hidden',
              minHeight: 140,
            }}
          >
            <widget.component width={240} height={140} appId={appId} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Widget Picker ─────────────────────────────────────────────────

function WidgetPicker({ appId, onClose }: { appId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const allWidgets = appRegistry.getAppWidgets(appId);
  const { widgets: enabledWidgets } = useAppWidgets(appId);
  const updateMutation = useUpdateAppWidgets(appId);

  const enabledIds = enabledWidgets.map((w) => w.id);
  const [localIds, setLocalIds] = useState<string[]>(enabledIds);

  const isEnabled = (id: string) => localIds.includes(id);

  const toggle = useCallback(
    (id: string) => {
      setLocalIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
      );
    },
    [],
  );

  const moveUp = useCallback((id: string) => {
    setLocalIds((prev) => {
      const idx = prev.indexOf(id);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  }, []);

  const moveDown = useCallback((id: string) => {
    setLocalIds((prev) => {
      const idx = prev.indexOf(id);
      if (idx === -1 || idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  }, []);

  const save = () => {
    updateMutation.mutate({ enabledIds: localIds, order: localIds });
    onClose();
  };

  return (
    <div style={{ padding: 12 }}>
      <div
        style={{
          fontSize: 'var(--font-size-sm)',
          fontWeight: 600,
          color: 'var(--color-text-primary)',
          marginBottom: 8,
        }}
      >
        {t('widgets.pickWidgets')}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {allWidgets.map((widget: ClientAppWidget) => {
          const Icon = widget.icon;
          const on = isEnabled(widget.id);
          return (
            <div
              key={widget.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px',
                borderRadius: 'var(--radius-md)',
                background: on ? 'var(--color-bg-tertiary)' : 'transparent',
                border: '1px solid var(--color-border-secondary)',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onClick={() => toggle(widget.id)}
            >
              <div
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 4,
                  border: on ? 'none' : '2px solid var(--color-border-primary)',
                  background: on ? 'var(--color-accent-primary)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all 0.15s',
                }}
              >
                {on && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5L4.5 7.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <Icon size={14} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 500,
                    color: 'var(--color-text-primary)',
                  }}
                >
                  {widget.name}
                </div>
                <div
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-text-tertiary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {widget.description}
                </div>
              </div>
              {on && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); moveUp(widget.id); }}
                    style={{
                      background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                      color: 'var(--color-text-tertiary)',
                    }}
                  >
                    <ChevronUp size={12} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); moveDown(widget.id); }}
                    style={{
                      background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                      color: 'var(--color-text-tertiary)',
                    }}
                  >
                    <ChevronDown size={12} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button variant="primary" size="sm" onClick={save}>
          {t('common.save')}
        </Button>
      </div>
    </div>
  );
}

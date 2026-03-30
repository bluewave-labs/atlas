import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api-client';
import { queryKeys } from '../../../config/query-keys';
import { widgetRegistry } from './registry';
import { appRegistry } from '../../../config/app-registry';

const WIDGET_W = 240;
const WIDGET_H = 160;
const GAP = 12;

export function WidgetGrid() {
  const { data: settings } = useQuery({
    queryKey: queryKeys.settings.all,
    queryFn: async () => {
      const { data } = await api.get('/settings');
      return data.data as Record<string, unknown> | null;
    },
    staleTime: 60_000,
  });

  const enabledWidgets = useMemo(() => {
    const raw = settings?.homeEnabledWidgets;
    let enabledIds: string[] | null = null;

    if (Array.isArray(raw)) {
      enabledIds = raw as string[];
    } else if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) enabledIds = parsed;
      } catch { /* use defaults */ }
    }

    if (enabledIds === null) {
      return widgetRegistry.filter((w) => w.defaultEnabled);
    }

    return widgetRegistry.filter((w) => enabledIds!.includes(w.id));
  }, [settings]);

  // App widgets enabled for the home screen
  const enabledAppWidgets = useMemo(() => {
    const all = appRegistry.getAllWidgets();
    const raw = settings?.homeEnabledWidgets;
    let enabledIds: string[] | null = null;

    if (Array.isArray(raw)) {
      enabledIds = raw as string[];
    } else if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) enabledIds = parsed;
      } catch { /* ignore */ }
    }

    if (enabledIds === null) {
      // By default, show app widgets that are defaultEnabled
      return all.filter((w) => w.defaultEnabled);
    }

    // Prefix app widget IDs with appId: to distinguish from home widgets
    return all.filter((w) => enabledIds!.includes(`${w.appId}:${w.id}`));
  }, [settings]);

  const hasWidgets = enabledWidgets.length > 0 || enabledAppWidgets.length > 0;
  if (!hasWidgets) return null;

  const visibleWidgets = enabledWidgets.slice(0, 10);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: GAP, marginTop: 16 }}>
      {visibleWidgets.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fill, ${WIDGET_W}px)`,
            gap: GAP,
            justifyContent: 'center',
            width: '100%',
            maxWidth: '90vw',
          }}
        >
          {visibleWidgets.map((widget) => (
            <div
              key={widget.id}
              style={{
                width: WIDGET_W,
                height: WIDGET_H,
                background: 'rgba(255,255,255,0.08)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 'var(--radius-xl)',
                overflow: 'hidden',
              }}
            >
              <widget.component width={WIDGET_W} height={WIDGET_H} />
            </div>
          ))}
        </div>
      )}

      {enabledAppWidgets.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fill, ${WIDGET_W}px)`,
            gap: GAP,
            justifyContent: 'center',
            width: '100%',
            maxWidth: '90vw',
          }}
        >
          {enabledAppWidgets.map((widget) => (
            <div
              key={`${widget.appId}:${widget.id}`}
              style={{
                width: WIDGET_W,
                height: WIDGET_H,
                background: 'rgba(255,255,255,0.08)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 'var(--radius-xl)',
                overflow: 'hidden',
              }}
            >
              <widget.component width={WIDGET_W} height={WIDGET_H} appId={widget.appId} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

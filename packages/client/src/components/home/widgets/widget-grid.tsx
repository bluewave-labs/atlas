import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api-client';
import { queryKeys } from '../../../config/query-keys';
import { widgetRegistry } from './registry';

const WIDGET_W = 240;
const WIDGET_H = 160;
const GAP = 14;
const COLS = 3;

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

  if (enabledWidgets.length === 0) return null;

  const visibleWidgets = enabledWidgets.slice(0, 10);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.min(COLS, visibleWidgets.length)}, ${WIDGET_W}px)`,
        gap: GAP,
        marginTop: 16,
        justifyContent: 'center',
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
            borderRadius: 12,
            overflow: 'hidden',
            transition: 'background 0.2s, border-color 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.14)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
          }}
        >
          <widget.component width={WIDGET_W} height={WIDGET_H} />
        </div>
      ))}
    </div>
  );
}

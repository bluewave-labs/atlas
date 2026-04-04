import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api-client';
import { queryKeys } from '../../../config/query-keys';
import { widgetRegistry } from './registry';
import { appRegistry } from '../../../config/app-registry';
import { useAuthStore } from '../../../stores/auth-store';
import { useMyAppPermission } from '../../../hooks/use-app-permissions';

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

  // Role-based widget filtering
  const tenantRole = useAuthStore((s) => s.tenantRole);
  const isAdmin = tenantRole === 'owner' || tenantRole === 'admin';
  const { data: crmPerm } = useMyAppPermission('crm');
  const { data: hrPerm } = useMyAppPermission('hr');

  const filteredAppWidgets = useMemo(() => {
    return enabledAppWidgets.filter(w => {
      // CPU/Memory: admin only
      if (w.id === 'cpu-usage' || w.id === 'memory-usage') return isAdmin;
      // CRM Pipeline: only if user has CRM access
      if (w.appId === 'crm') return !!crmPerm;
      // HR Team: only if user has HR admin/manager/editor access (not portal viewers)
      if (w.appId === 'hr') return !!hrPerm && hrPerm.role !== 'viewer';
      return true;
    });
  }, [enabledAppWidgets, isAdmin, crmPerm, hrPerm]);

  const navigate = useNavigate();
  const [hoveredWidget, setHoveredWidget] = useState<string | null>(null);

  const hasWidgets = enabledWidgets.length > 0 || filteredAppWidgets.length > 0;
  if (!hasWidgets) return null;

  const visibleWidgets = enabledWidgets.slice(0, 10);

  return (
    <div style={{ marginTop: 16 }}>
      {hasWidgets && (
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
          {/* Home widgets */}
          {visibleWidgets.map((widget) => (
            <div
              key={widget.id}
              style={{
                width: WIDGET_W,
                height: WIDGET_H,
                background: 'rgba(0,0,0,0.35)',
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

          {/* App widgets — merged into the same grid */}
          {filteredAppWidgets.map((widget) => {
            const wKey = `${widget.appId}:${widget.id}`;
            const isHovered = hoveredWidget === wKey;
            const app = appRegistry.getAll().find((a) => a.id === widget.appId);
            const route = app?.routes[0]?.path;
            return (
              <div
                key={wKey}
                onClick={() => route && navigate(route)}
                onMouseEnter={() => setHoveredWidget(wKey)}
                onMouseLeave={() => setHoveredWidget(null)}
                style={{
                  width: WIDGET_W,
                  height: WIDGET_H,
                  background: 'rgba(0,0,0,0.35)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: isHovered ? '1px solid rgba(255,255,255,0.25)' : '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 'var(--radius-xl)',
                  overflow: 'hidden',
                  cursor: route ? 'pointer' : 'default',
                  transition: 'border-color 0.2s, transform 0.2s',
                  transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
                }}
              >
                <widget.component width={WIDGET_W} height={WIDGET_H} appId={widget.appId} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

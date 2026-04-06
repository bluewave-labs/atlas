import { useMemo, useState, useCallback, useEffect, useRef, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api-client';
import { queryKeys } from '../../../config/query-keys';
import { widgetRegistry } from './registry';
import { appRegistry } from '../../../config/app-registry';
import { useAuthStore } from '../../../stores/auth-store';
import { useMyAccessibleApps } from '../../../hooks/use-app-permissions';

const DRAG_THRESHOLD = 5;

const WIDGET_W = 240;
const WIDGET_H = 160;
const GAP = 12;
const FLIP_DURATION = 250;

type UnifiedWidget =
  | { type: 'home'; key: string; widget: (typeof widgetRegistry)[number] }
  | { type: 'app'; key: string; widget: ReturnType<typeof appRegistry.getAllWidgets>[number]; route?: string };

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

  // Role-based widget filtering using accessible apps
  const tenantRole = useAuthStore((s) => s.tenantRole);
  const isAdmin = tenantRole === 'owner' || tenantRole === 'admin';
  const { data: myApps } = useMyAccessibleApps();

  const filteredAppWidgets = useMemo(() => {
    const accessibleSet = myApps?.appIds === '__all__'
      ? null // null means all accessible
      : new Set(myApps?.appIds ?? []);

    return enabledAppWidgets.filter(w => {
      // CPU/Memory: admin only
      if (w.id === 'cpu-usage' || w.id === 'memory-usage') return isAdmin;
      // If not admin, only show widgets for apps user has explicit access to
      if (accessibleSet && !accessibleSet.has(w.appId)) return false;
      return true;
    });
  }, [enabledAppWidgets, isAdmin, myApps]);

  const navigate = useNavigate();
  const [hoveredWidget, setHoveredWidget] = useState<string | null>(null);

  // --- Mouse-based drag state ---
  const [dragState, setDragState] = useState<{
    key: string;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    isDragging: boolean;
  } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const dragStartOrderRef = useRef<string[] | null>(null);

  // FLIP animation: store previous bounding rects before reorder
  const prevRectsRef = useRef<Map<string, DOMRect>>(new Map());
  const flipPendingRef = useRef(false);
  // Track which items are currently animating to avoid React overriding their transforms
  const animatingKeysRef = useRef<Set<string>>(new Set());
  // Debounce reorder to prevent rapid flickering
  const lastReorderTimeRef = useRef(0);

  // Local order state for instant feedback before server round-trip
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);

  // Capture current positions of all grid items
  const capturePositions = useCallback(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const items = grid.querySelectorAll<HTMLElement>('.widget-grid-item');
    const rects = new Map<string, DOMRect>();
    for (const item of items) {
      const key = item.dataset.widgetKey;
      if (key) rects.set(key, item.getBoundingClientRect());
    }
    prevRectsRef.current = rects;
  }, []);

  // After DOM updates, animate items from old position to new position
  useLayoutEffect(() => {
    if (!flipPendingRef.current) return;
    flipPendingRef.current = false;

    const grid = gridRef.current;
    if (!grid) return;
    const prevRects = prevRectsRef.current;
    if (prevRects.size === 0) return;

    const items = grid.querySelectorAll<HTMLElement>('.widget-grid-item');
    for (const item of items) {
      const key = item.dataset.widgetKey;
      if (!key) continue;
      // Skip the dragged item (it's hidden via opacity)
      if (dragState?.key === key) continue;

      const prevRect = prevRects.get(key);
      if (!prevRect) continue;

      const newRect = item.getBoundingClientRect();
      const dx = prevRect.left - newRect.left;
      const dy = prevRect.top - newRect.top;

      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;

      // Mark as animating
      animatingKeysRef.current.add(key);

      // Apply inverse transform (FLIP: Invert)
      item.style.transform = `translate(${dx}px, ${dy}px)`;
      item.style.transition = 'none';

      // Force reflow so the browser registers the starting position
      item.getBoundingClientRect();

      // Animate to final position (FLIP: Play)
      item.style.transition = `transform ${FLIP_DURATION}ms cubic-bezier(0.2, 0, 0, 1)`;
      item.style.transform = 'translate(0px, 0px)';

      // Clean up after animation completes
      const onEnd = () => {
        animatingKeysRef.current.delete(key);
        item.style.transition = '';
        item.style.transform = '';
        item.removeEventListener('transitionend', onEnd);
      };
      item.addEventListener('transitionend', onEnd, { once: true });
      // Fallback cleanup in case transitionend doesn't fire
      setTimeout(onEnd, FLIP_DURATION + 50);
    }
  }, [localOrder, dragState?.key]);

  // Parse saved widget order from settings
  const widgetOrder = useMemo(() => {
    const raw = settings?.homeWidgetOrder;
    if (typeof raw === 'string') {
      try { return JSON.parse(raw) as string[]; } catch { return null; }
    }
    if (Array.isArray(raw)) return raw as string[];
    return null;
  }, [settings]);

  const hasWidgets = enabledWidgets.length > 0 || filteredAppWidgets.length > 0;

  const visibleWidgets = enabledWidgets.slice(0, 10);

  // Combine all widgets into a single ordered array
  const allWidgets: UnifiedWidget[] = useMemo(() => {
    const homeItems: UnifiedWidget[] = visibleWidgets.map((w) => ({
      type: 'home' as const,
      key: w.id,
      widget: w,
    }));

    const appItems: UnifiedWidget[] = filteredAppWidgets.map((w) => {
      const app = appRegistry.getAll().find((a) => a.id === w.appId);
      const route = app?.routes[0]?.path;
      return {
        type: 'app' as const,
        key: `${w.appId}:${w.id}`,
        widget: w,
        route,
      };
    });

    return [...homeItems, ...appItems];
  }, [visibleWidgets, filteredAppWidgets]);

  // Sort widgets by saved order (local override > server setting > default)
  const orderedWidgets = useMemo(() => {
    const order = localOrder ?? widgetOrder;
    if (!order) return allWidgets;
    const orderMap = new Map(order.map((id, i) => [id, i]));
    return [...allWidgets].sort((a, b) => {
      const aIdx = orderMap.get(a.key) ?? 999;
      const bIdx = orderMap.get(b.key) ?? 999;
      return aIdx - bIdx;
    });
  }, [allWidgets, widgetOrder, localOrder]);

  // Get current ordered keys
  const orderedWidgetKeys = useMemo(
    () => orderedWidgets.map((w) => w.key),
    [orderedWidgets],
  );

  // Live reorder: move widget from its current position to the target position
  const reorderPreview = useCallback(
    (draggedKey: string, targetKey: string) => {
      if (draggedKey === targetKey) return;
      const currentOrder = [...orderedWidgetKeys];
      const fromIdx = currentOrder.indexOf(draggedKey);
      const toIdx = currentOrder.indexOf(targetKey);
      if (fromIdx === -1 || toIdx === -1) return;

      // FLIP: capture positions before reorder
      capturePositions();
      flipPendingRef.current = true;

      currentOrder.splice(fromIdx, 1);
      currentOrder.splice(toIdx, 0, draggedKey);
      setLocalOrder(currentOrder);
    },
    [orderedWidgetKeys, capturePositions],
  );

  // Persist order to server
  const persistOrder = useCallback(() => {
    const order = localOrder ?? orderedWidgetKeys;
    api.put('/settings', { homeWidgetOrder: JSON.stringify(order) }).catch(() => {});
  }, [localOrder, orderedWidgetKeys]);

  // Mouse down on a widget card
  const handleWidgetMouseDown = useCallback(
    (key: string, e: React.MouseEvent) => {
      // Only left button
      if (e.button !== 0) return;
      // Don't interfere with interactive elements inside widgets
      const target = e.target as HTMLElement;
      if (target.closest('button, a, input, select, textarea')) return;

      setDragState({
        key,
        startX: e.clientX,
        startY: e.clientY,
        currentX: e.clientX,
        currentY: e.clientY,
        isDragging: false,
      });
      dragStartOrderRef.current = [...orderedWidgetKeys];
    },
    [orderedWidgetKeys],
  );

  // Global mousemove and mouseup handlers
  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      const pastThreshold = Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD;

      setDragState((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          currentX: e.clientX,
          currentY: e.clientY,
          isDragging: prev.isDragging || pastThreshold,
        };
      });

      // If dragging, find which widget we're hovering over and reorder
      if (pastThreshold || dragState.isDragging) {
        // Debounce: don't reorder more often than the animation duration
        const now = Date.now();
        if (now - lastReorderTimeRef.current < FLIP_DURATION * 0.6) return;

        const grid = gridRef.current;
        if (!grid) return;
        const items = grid.querySelectorAll<HTMLElement>('.widget-grid-item');
        for (const item of items) {
          const itemKey = item.dataset.widgetKey;
          if (!itemKey || itemKey === dragState.key) continue;
          const rect = item.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          // Check if cursor is within the widget bounds
          if (
            e.clientX >= rect.left &&
            e.clientX <= rect.right &&
            e.clientY >= rect.top &&
            e.clientY <= rect.bottom
          ) {
            // Only reorder if cursor is closer to center than edge (prevents flickering)
            const distX = Math.abs(e.clientX - cx);
            const distY = Math.abs(e.clientY - cy);
            if (distX < rect.width * 0.45 && distY < rect.height * 0.45) {
              lastReorderTimeRef.current = now;
              reorderPreview(dragState.key, itemKey);
            }
            break;
          }
        }
      }
    };

    const handleMouseUp = () => {
      if (dragState.isDragging) {
        // Check if order actually changed
        const startOrder = dragStartOrderRef.current;
        const currentOrder = localOrder ?? orderedWidgetKeys;
        const orderChanged = !startOrder || startOrder.some((k, i) => currentOrder[i] !== k);
        if (orderChanged) {
          persistOrder();
        }
      }
      setDragState(null);
      dragStartOrderRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, reorderPreview, persistOrder, localOrder, orderedWidgetKeys]);

  // Prevent text selection during drag
  useEffect(() => {
    if (dragState?.isDragging) {
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'grabbing';
      return () => {
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      };
    }
  }, [dragState?.isDragging]);

  if (!hasWidgets) return null;

  // Compute floating clone position
  const floatingClone = dragState?.isDragging ? (() => {
    const draggedWidget = orderedWidgets.find((w) => w.key === dragState.key);
    if (!draggedWidget) return null;
    return {
      widget: draggedWidget,
      x: dragState.currentX - WIDGET_W / 2,
      y: dragState.currentY - WIDGET_H / 2,
    };
  })() : null;

  return (
    <div style={{ marginTop: 16 }}>
      <div
        ref={gridRef}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fill, ${WIDGET_W}px)`,
          gap: GAP,
          justifyContent: 'center',
          width: '100%',
          maxWidth: '90vw',
        }}
      >
        {orderedWidgets.map((item) => {
          const isDragged = dragState?.isDragging && dragState.key === item.key;
          const isHovered = hoveredWidget === item.key && !dragState?.isDragging;
          const isFlipping = animatingKeysRef.current.has(item.key);

          return (
            <div
              key={item.key}
              className="widget-grid-item"
              data-widget-key={item.key}
              onMouseDown={(e) => handleWidgetMouseDown(item.key, e)}
              onClick={() => {
                if (dragState?.isDragging) return;
                if (item.type === 'app' && item.route) navigate(item.route);
              }}
              onMouseEnter={() => !dragState?.isDragging && setHoveredWidget(item.key)}
              onMouseLeave={() => setHoveredWidget(null)}
              style={{
                width: WIDGET_W,
                height: WIDGET_H,
                background: 'rgba(0,0,0,0.35)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: isHovered
                  ? '1px solid rgba(255,255,255,0.25)'
                  : '1px solid rgba(255,255,255,0.12)',
                borderRadius: 'var(--radius-xl)',
                overflow: 'hidden',
                opacity: isDragged ? 0.3 : 1,
                cursor: dragState?.isDragging ? 'grabbing' : 'grab',
                // When FLIP animating, don't set transition/transform — let the layout effect control them
                ...(isFlipping ? {} : {
                  transition: dragState?.isDragging
                    ? 'opacity 0.15s ease, border-color 0.15s'
                    : 'transform 0.25s cubic-bezier(0.2, 0, 0, 1), opacity 0.15s, border-color 0.15s',
                  transform: isHovered && item.type === 'app' ? 'translateY(-2px)' : undefined,
                }),
                pointerEvents: isDragged ? 'none' : 'auto',
              }}
            >
              {item.type === 'home' ? (
                <item.widget.component width={WIDGET_W} height={WIDGET_H} />
              ) : (
                <item.widget.component width={WIDGET_W} height={WIDGET_H} appId={item.widget.appId} />
              )}
            </div>
          );
        })}
      </div>

      {/* Floating clone during drag */}
      {floatingClone && (
        <div
          style={{
            position: 'fixed',
            left: floatingClone.x,
            top: floatingClone.y,
            width: WIDGET_W,
            height: WIDGET_H,
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.25)',
            borderRadius: 'var(--radius-xl)',
            overflow: 'hidden',
            zIndex: 9999,
            pointerEvents: 'none',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            transform: 'scale(1.04)',
            opacity: 0.92,
          }}
        >
          {floatingClone.widget.type === 'home' ? (
            <floatingClone.widget.widget.component width={WIDGET_W} height={WIDGET_H} />
          ) : (
            <floatingClone.widget.widget.component width={WIDGET_W} height={WIDGET_H} appId={floatingClone.widget.widget.appId} />
          )}
        </div>
      )}
    </div>
  );
}

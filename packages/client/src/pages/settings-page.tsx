import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { getSettingsCategories, type SettingsCategory, type SettingsPanel } from '../config/settings-registry';
import { appRegistry } from '../apps';
import { SettingsSidebar } from '../components/settings/settings-sidebar';
import {
  fromUrlSegments,
  firstPanelOfUrlScope,
  urlForPanel,
  readLastVisited,
  writeLastVisited,
} from '../config/settings-url';
import { useAuthStore } from '../stores/auth-store';
import { isTenantAdmin, isTenantOwner } from '@atlas-platform/shared';

function useVisibleCategories() {
  const tenantRole = useAuthStore((s) => s.tenantRole);
  const isOwner = isTenantOwner(tenantRole);
  const isAdmin = isTenantAdmin(tenantRole);

  return useMemo(() => {
    const all = getSettingsCategories(appRegistry.getSettingsCategories());
    return all
      .map((cat) => ({
        ...cat,
        panels: cat.panels.filter((p) => {
          if (p.ownerOnly && !isOwner) return false;
          if (p.adminOnly && !isAdmin) return false;
          return true;
        }),
      }))
      .filter((cat) => cat.panels.length > 0);
  }, [isAdmin, isOwner]);
}

interface PanelViewProps {
  categories: SettingsCategory[];
  category: SettingsCategory;
  panel: SettingsPanel;
}

function SettingsPanelView({ categories, category, panel }: PanelViewProps) {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentPath = urlForPanel(category.id, panel.id);

  useEffect(() => {
    writeLastVisited(currentPath);
  }, [currentPath]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (document.querySelector('[role="dialog"]')) return;
      navigate(-1);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [navigate]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const storageKey = 'atlas_settings_scroll_' + currentPath;
    const saved = sessionStorage.getItem(storageKey);
    if (saved) {
      const top = Number(saved);
      if (!Number.isNaN(top)) el.scrollTop = top;
    }
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        try {
          sessionStorage.setItem(storageKey, String(el.scrollTop));
        } catch {
          /* ignore */
        }
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('scroll', onScroll);
    };
  }, [currentPath]);

  const PanelComponent = panel.component;

  const shellStyle: CSSProperties = {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
    marginLeft: 56,
  };

  return (
    <div style={shellStyle}>
      <SettingsSidebar
        categories={categories}
        activeCategoryId={category.id}
        activePanelId={panel.id}
      />
      <main
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--spacing-2xl)',
          background: 'var(--color-bg-primary)',
        }}
      >
        <PanelComponent />
      </main>
    </div>
  );
}

export function SettingsPage() {
  const params = useParams();
  const splat = params['*'] ?? '';
  const segs = splat.split('/').filter(Boolean);
  const categories = useVisibleCategories();

  // Bare /settings → last visited or platform/general
  if (segs.length === 0) {
    const last = readLastVisited();
    if (last && last.startsWith('/settings/')) {
      return <Navigate to={last} replace />;
    }
    const first = categories.find((c) => c.id === 'global')?.panels[0];
    if (first) {
      return <Navigate to={urlForPanel('global', first.id)} replace />;
    }
    return null;
  }

  // /settings/platform or /settings/apps/:appId — redirect to first panel in scope
  if (segs.length === 1 || (segs[0] === 'apps' && segs.length === 2)) {
    const first = firstPanelOfUrlScope(segs, categories);
    if (first) {
      return <Navigate to={urlForPanel(first.categoryId, first.panelId)} replace />;
    }
    return <Navigate to="/settings" replace />;
  }

  const resolved = fromUrlSegments(segs);
  if (!resolved) {
    return <Navigate to="/settings" replace />;
  }

  const category = categories.find((c) => c.id === resolved.categoryId);
  const panel = category?.panels.find((p) => p.id === resolved.panelId);

  if (!category || !panel) {
    return <Navigate to="/settings" replace />;
  }

  return <SettingsPanelView categories={categories} category={category} panel={panel} />;
}

import type { SettingsCategory } from './settings-registry';

const LAST_VISITED_KEY = 'atlas_settings_last_panel';

/**
 * Convert an internal category id + panel id into URL path segments.
 * `global` category → `['platform', panelId]`
 * anything else → `['apps', categoryId, panelId]`
 */
export function toUrlSegments(categoryId: string, panelId: string): string[] {
  if (categoryId === 'global') {
    return ['platform', panelId];
  }
  return ['apps', categoryId, panelId];
}

/** Build the full path for a category + panel. */
export function urlForPanel(categoryId: string, panelId: string): string {
  const segs = toUrlSegments(categoryId, panelId);
  return '/settings/' + segs.join('/');
}

/** URL for a whole category, no panel. Page will redirect to first panel. */
export function urlForCategory(categoryId: string): string {
  if (categoryId === 'global') return '/settings/platform';
  return '/settings/apps/' + categoryId;
}

export interface ResolvedPanel {
  categoryId: string;
  panelId: string;
}

/**
 * Parse URL segments from a splat match (after `/settings/`) back into a
 * category + panel. Returns null when the URL is incomplete (bare `/settings`
 * or `/settings/platform` without a panel) — caller handles redirect.
 */
export function fromUrlSegments(segs: string[]): ResolvedPanel | null {
  if (segs.length === 0) return null;
  if (segs[0] === 'platform') {
    if (segs.length < 2) return null;
    return { categoryId: 'global', panelId: segs[1] };
  }
  if (segs[0] === 'apps') {
    if (segs.length < 3) return null;
    return { categoryId: segs[1], panelId: segs[2] };
  }
  return null;
}

/**
 * When the URL names a scope (platform or apps/:appId) but no panel, return
 * the first panel in that category so the page can redirect there.
 */
export function firstPanelOfUrlScope(
  segs: string[],
  categories: SettingsCategory[],
): ResolvedPanel | null {
  if (segs[0] === 'platform') {
    const cat = categories.find((c) => c.id === 'global');
    if (!cat || cat.panels.length === 0) return null;
    return { categoryId: 'global', panelId: cat.panels[0].id };
  }
  if (segs[0] === 'apps' && segs[1]) {
    const cat = categories.find((c) => c.id === segs[1]);
    if (!cat || cat.panels.length === 0) return null;
    return { categoryId: cat.id, panelId: cat.panels[0].id };
  }
  return null;
}

export function readLastVisited(): string | null {
  try {
    return localStorage.getItem(LAST_VISITED_KEY);
  } catch {
    return null;
  }
}

export function writeLastVisited(path: string): void {
  try {
    localStorage.setItem(LAST_VISITED_KEY, path);
  } catch {
    /* ignore quota / private-mode errors */
  }
}

# Atlas Product Tour — Design Spec

**Date:** 2026-04-25
**Status:** Approved, awaiting implementation plan
**Inspiration:** Eaglewire-style first-run dock walkthrough

---

## Goal

When a user lands on the Atlas home page for the first time, walk them through the apps in their dock with a sequence of small modals. Each modal points at one dock icon, names the app, explains what it does, and shows a small illustration of the app's content. Users can skip; users who skip can replay later from the user menu.

## Non-goals

- Interactive hotspots inside steps (e.g., "click this button to try it")
- Mid-tour navigation into apps
- "We just added a new app" mini-tour when an owner enables a new app later (revisit post-v1)
- Mobile-specific layout (desktop-first; mobile uses the same overlay)
- Analytics on step views/skips (`skipped` flag accepted by API, not stored)

## Decisions

| # | Decision |
|---|----------|
| Trigger | Auto on first login (any user) + replay from user menu |
| Scope | Only steps for apps the user can access (`tenantApps` ∩ user permissions) |
| Step source | Per-app manifest field (`tour: { variant, illustrationData, ... }`) — apps without `tour` are skipped silently |
| Illustrations | 3 shared variants (`list` / `kanban` / `activity`) + manifest can override with `variant: 'custom'` and a custom React component (hybrid) |
| State | `tenantMembers.tourCompletedAt` timestamp, per-tenant-per-user |
| Skip behavior | Esc / × / click-outside / Skip button all = "done forever"; replay from user menu |
| Positioning | Always above the icon, downward caret tracks; dock magnification suspended during tour |
| Existing users | Land with `tourCompletedAt = null` — every existing user sees the tour on their next login |

---

## Visual treatment

### Backdrop and spotlight

Three layered effects to pull focus to the targeted dock icon:

1. **Heavy global dim:** `rgba(8, 12, 24, 0.72)` full-screen overlay
2. **Spotlight halo:** radial gradient from `rgba(255,255,255,0.18)` at the icon center, fading to transparent at ~130px, with `mix-blend-mode: screen`
3. **Vignette darkening:** radial gradient from transparent (~140px from icon) to `rgba(0,0,0,0.35)` at the corners

The targeted icon gets a subtle white ring (`box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.12)`) and is rendered at a fixed enlarged size — dock magnification is suspended while the tour is open.

### Modal

- White (`--color-bg-primary` in light mode), 4px radius, 16px padding, 340px wide
- `--shadow-elevated` for depth
- Positioned **above the active dock icon**, centered horizontally on it
- 8px downward caret pointing at the icon, flush with modal's bottom edge
- Edge clamping: if the modal would clip viewport horizontally, it slides inward by the overflow amount and the caret tracks to remain pointed at the icon

**Header:** app color square (16×16, radius 4px) + app title (14px, weight 600) + close × (right)
**Body:** description (13px, regular, `--color-text-secondary`) → illustration block
**Footer:** `{n} of {total}` (left, 11px, `--color-text-tertiary`) + Previous (ghost outline; hidden on step 0) + Next/Finish (primary, `--color-accent-primary`)

Typography uses Atlas tokens: system font stack, sizes `--font-size-md` for title, `--font-size-sm` for body, `--font-size-xs` for meta.

### Illustration variants

All three variants render at 280px tall × 308px wide (modal width minus padding). Each is a pure presentational component driven by props.

**Variant A — `list`:**
- Stack of contact-style rows (avatar square, primary text, secondary text, optional badge)
- Opacity fades down from a configurable index (`fadeFrom`)
- Bottom 60px gradient mask to white
- Optional collaborator: a colored cursor + name flag overlaid on a target row, with a 2px highlight ring on that row
- Used by: CRM (contacts), Drive (files as rows), Invoices (invoice rows), HR (employees)

**Variant B — `kanban`:**
- 3 columns with uppercase labels and counts
- 1–3 cards per column with primary + secondary text
- Optional drag-in-progress: a tilted floating card overlapping two columns, dashed drop slot, optional collaborator cursor + name flag on the dragged card
- Used by: Tasks (kanban board), Projects (status columns), Sign (signing stages)

**Variant C — `activity`:**
- Single contact card at top (larger avatar, badge, role)
- Activity timeline below: events with bullet markers, primary text, timestamp
- Most recent event has `isLive: true` → green dot with pulse halo + "just now" timestamp
- Older events fade to ~30% opacity
- Bottom gradient mask
- Used by: Calendar (event timeline), Write (recent edits), Draw (drawings activity), System (audit log)

**Variant `custom`:** manifest provides a React component, rendered as-is at 280px tall.

---

## Architecture

### File layout (client)

```
packages/client/src/components/tour/
  tour-overlay.tsx            — Top-level overlay: backdrop + spotlight + caret + modal
  tour-modal.tsx              — 340px white card (header / body / footer)
  tour-illustration.tsx       — Variant dispatcher
  illustrations/
    list-illustration.tsx
    kanban-illustration.tsx
    activity-illustration.tsx
  use-tour.ts                 — Zustand store
  use-tour-bootstrap.ts       — Hook that auto-opens the tour on first home-page render
  tour-target.ts              — Pure helper: rect → { modalLeft, modalTop, caretLeft }
  tour-types.ts               — Shared types (ListData, KanbanData, ActivityData, TourStep)
```

### Files modified (client)

```
packages/client/src/apps/types.ts                   — extend ClientAppManifest with optional tour field
packages/client/src/apps/{name}/manifest.ts         — add tour: { variant, illustrationData } where appropriate
packages/client/src/pages/home.tsx                  — mount <TourOverlay />, call useTourBootstrap(), gate dock magnification on tour state
packages/client/src/components/layout/sidebar.tsx   — gate dock-icon hover handlers on tour state (if dock magnification logic lives there)
packages/client/src/components/home/dock-pet.tsx    — hide pet while tour is open (read useTour().isOpen)
packages/client/src/i18n/locales/{en,tr,de,fr,it}.json — add tour.* namespace + per-app tour.title / tour.description keys
packages/client/src/config/query-keys.ts            — add queryKeys.tour key family if needed
```

### File layout (server)

```
packages/server/src/db/schema.ts                                    — add tourCompletedAt to tenantMembers
packages/server/src/apps/system/controller.ts                       — add completeTour handler
packages/server/src/apps/system/routes.ts                           — wire PATCH /tour/complete
packages/server/src/apps/system/service.ts                          — add markTourComplete service function
(no /me extension needed — replaced with dedicated GET /system/tour endpoint)
packages/server/src/openapi/paths/system.ts                         — register the new path
```

### LOC budget

Approximate, for sanity-checking scope:

- Client new: ~800 LOC (overlay 150, modal 120, three illustrations 150 each, store 60, bootstrap 50, target helper 50, types 30)
- Client modified: ~150 LOC (manifest extensions, home/sidebar gates, i18n keys)
- Server: ~50 LOC (column, endpoint, /me extension, OpenAPI)

---

## Data model

### Manifest extension

```typescript
// packages/client/src/apps/types.ts
import type { ListData, KanbanData, ActivityData } from '../components/tour/tour-types';

export type TourVariant = 'list' | 'kanban' | 'activity' | 'custom';

export type TourConfig =
  | { variant: 'list'; illustrationData: ListData }
  | { variant: 'kanban'; illustrationData: KanbanData }
  | { variant: 'activity'; illustrationData: ActivityData }
  | { variant: 'custom'; component: React.ComponentType };

export interface ClientAppManifest {
  // ... existing fields
  tour?: TourConfig;
  // titleKey / descriptionKey are conventional, not part of the type:
  //   `${app.id}.tour.title`, `${app.id}.tour.description`
}
```

### Illustration data shapes

```typescript
// packages/client/src/components/tour/tour-types.ts

export type BadgeTone = 'success' | 'info' | 'warning' | 'neutral' | 'danger';

export interface ListData {
  rows: Array<{
    initials: string;
    avatarColor: string;        // any CSS color
    primary: string;
    secondary: string;
    badge?: { label: string; tone: BadgeTone };
  }>;
  fadeFrom: number;             // 0-based index from which opacity decays (default: 2)
  collaborator?: {
    name: string;
    color: string;
    targetRowIndex: number;
  };
}

export interface KanbanData {
  columns: Array<{
    label: string;
    count: number;
    cards: Array<{ primary: string; secondary: string }>;
  }>;
  draggedCard?: {
    fromColumn: number;
    toColumn: number;
    primary: string;
    secondary: string;
    collaborator?: { name: string; color: string };
  };
}

export interface ActivityData {
  contact: {
    initials: string;
    avatarColor: string;
    name: string;
    meta: string;
    badge?: { label: string; tone: BadgeTone };
  };
  events: Array<{
    text: string;
    timestamp: string;
    isLive?: boolean;
  }>;
}

export interface TourStep {
  appId: string;
  appColor: string;             // for the small color square in the modal header
  variant: TourVariant;
  illustrationData?: ListData | KanbanData | ActivityData;
  customComponent?: React.ComponentType;
  titleKey: string;             // i18n key, e.g. 'crm.tour.title'
  descriptionKey: string;       // i18n key, e.g. 'crm.tour.description'
}
```

### Tour store (Zustand)

```typescript
interface TourState {
  isOpen: boolean;
  steps: TourStep[];
  currentStepIndex: number;
  open: (steps: TourStep[]) => void;
  next: () => void;
  prev: () => void;
  skip: () => void;
  finish: () => void;
}
```

`skip()` and `finish()` both call the PATCH endpoint (fire-and-forget) and reset state. The store itself does not gate on bootstrap state — `useTourBootstrap()` decides when to call `open()`.

### Server schema delta

```typescript
// packages/server/src/db/schema.ts — tenantMembers table
{
  // ... existing columns
  tourCompletedAt: timestamp('tour_completed_at', { withTimezone: true }), // nullable
}
```

Apply via `cd packages/server && npm run db:push`. No migration file (per project conventions).

### Endpoints

Two dedicated endpoints in the system app — chosen over piggy-backing on `/auth/me` because that endpoint returns account-level data only (no tenant-membership context).

```
GET /api/v1/system/tour
  Auth:    authMiddleware (req.auth!.userId, req.auth!.tenantId)
  Returns: { success: true, data: { tourCompletedAt: string | null } }

  Implementation:
    SELECT tour_completed_at FROM tenant_members
     WHERE user_id = $userId AND tenant_id = $tenantId
    LIMIT 1;
    If no row → 404
```

```
PATCH /api/v1/system/tour/complete
  Auth:    authMiddleware (req.auth!.userId, req.auth!.tenantId)
  Body:    { skipped: boolean }     // accepted, not stored — reserved for future analytics
  Returns: { success: true, data: { tourCompletedAt: string } }

  Implementation:
    UPDATE tenant_members
       SET tour_completed_at = COALESCE(tour_completed_at, now())
     WHERE user_id = $userId AND tenant_id = $tenantId
    RETURNING tour_completed_at;
    If no row updated → 404
```

The `COALESCE` makes the PATCH idempotent: re-calling does not bump the timestamp.

The home page calls the GET via TanStack Query (key: `queryKeys.tour.status`). Cache is set on `onSettled` of the PATCH so reload doesn't re-fire the tour even if the server call failed.

---

## Data flow

### Bootstrap (auto-fire)

```
home.tsx mounts
  └─ useTourBootstrap() runs after first paint (~150ms timeout)
       └─ TanStack Query fetches GET /api/v1/system/tour → { tourCompletedAt }
       └─ if tourCompletedAt !== null                    → exit
       └─ reads useMyAccessibleApps()                    → ['crm', 'hr', 'tasks', ...]
       └─ reads appRegistry.getAll()                     → all manifests
       └─ filter: app.tour && accessibleApps.includes(app.id)
       └─ sort by manifest.sidebarOrder
       └─ map to TourStep[]:
            { appId, appColor, variant, illustrationData/customComponent,
              titleKey: `${app.id}.tour.title`,
              descriptionKey: `${app.id}.tour.description` }
       └─ if steps.length === 0                          → exit silently
       └─ tourStore.open(steps)
```

### During the tour

- `tourStore.currentStepIndex` drives which dock icon is targeted
- Dock icons carry `data-tour-target="<appId>"` attributes (one-line addition in dock rendering)
- `<TourOverlay>` resolves the icon element via `document.querySelector('[data-tour-target="<id>"]')` and reads its `getBoundingClientRect()`
- `tour-target.ts` computes:
  - Spotlight center = icon rect center
  - Modal position = above icon, centered, with edge clamping
  - Caret left offset = icon center minus modal left
- Effects: re-run computation on `currentStepIndex` change, on `window resize`, and via a `ResizeObserver` watching the dock root
- Dock magnification: `home.tsx` (and/or `sidebar.tsx`) reads `useTour().isOpen` and short-circuits the magnification handler when true

### Termination

All four user actions take the same path:

```
skip / Esc / × / click-outside / "Finish" on last step
  → tourStore.skip()  (or .finish())
       └─ POST PATCH /system/tour/complete (fire-and-forget; { skipped: true|false })
       └─ optimistically update React Query cache for /me so reload doesn't re-fire
       └─ tourStore reset (isOpen=false, steps=[], currentStepIndex=0)
```

If the PATCH fails: local cache is still updated for the session; on next login `/me` returns `tourCompletedAt: null` and the user sees the tour again — acceptable failure mode.

### Replay (user menu → "Take the tour")

- Calls the same step-assembly logic as bootstrap, ignoring `tourCompletedAt`
- `tourStore.open(steps)` runs
- On finish/skip: PATCH still fires (idempotent — no-op server-side because `COALESCE` keeps the original timestamp)

---

## i18n

Each app's existing locale namespace gains two new keys:

```json
"crm": {
  "tour": {
    "title": "CRM",
    "description": "Your complete client database. Manage contacts, track opportunities through your pipeline, and log every interaction with notes and activity history."
  }
}
```

Modal chrome lives in a new top-level `tour` namespace:

```json
"tour": {
  "previous": "Previous",
  "next": "Next",
  "finish": "Finish",
  "skip": "Skip tour",
  "stepCounter": "{{current}} of {{total}}",
  "menuReplay": "Take the tour"
}
```

All 5 locales (en/tr/de/fr/it) get the keys in the same commit.

---

## Edge cases & error handling

- **Zero-step tour:** user has no apps with `tour` declared → tour silently no-ops. No flash of empty overlay.
- **Single-step tour:** "Previous" hidden, "Next" labeled "Finish".
- **App enabled mid-tour:** not possible — apps list is captured at `tourStore.open(steps)` and frozen for the duration.
- **Window resize / dock width change:** `ResizeObserver` recomputes positions in the same frame.
- **Icon doesn't exist in DOM at step transition:** skip that step and advance; log a warning. Defensive — should never happen given accessible-apps filtering.
- **User logs out mid-tour:** auth interceptor routes to login; tour state lost (acceptable).
- **PATCH 5xx:** local cache still flips to "completed" for this session; tour reappears next login.
- **Two concurrent sessions for the same user:** session A completes → session B's stale `/me` still says null until next refetch → session B might still fire the tour on next page load until cache refetches. Acceptable; idempotent endpoint absorbs the duplicate.
- **Super-admin viewing a tenant they're not a member of:** PATCH returns 404 (no membership row). Tour bootstrap shouldn't fire here anyway because the apps-permission hook returns nothing in that context.
- **Backdrop click vs. modal click:** modal stops click propagation. Backdrop captures the rest.
- **Esc inside another modal stacked on top of tour:** the topmost modal's Esc handler wins. Tour bootstrap defers to first paint, so this is unlikely.

---

## Testing & rollout

### Manual checklist (mandatory before merge)

1. First-login fire — fresh tenant + fresh user → tour appears, dock magnification frozen, modal above first accessible app's icon.
2. Filtered apps — owner enables only CRM + Tasks for a member → that member sees a 2-step tour.
3. Empty case — user has zero apps with `tour` declared → no overlay flashes.
4. Skip paths — Esc, ×, click-outside, "Skip" all close it and persist; reload doesn't re-fire.
5. Replay — user menu → "Take the tour" → fires regardless of `tourCompletedAt`; completion endpoint is a no-op (idempotent).
6. Edge positioning — first/last icon: modal slides inward, caret tracks.
7. Resize during tour — modal/spotlight reposition smoothly.
8. Multi-tenant — completing in tenant A leaves tenant B's tour pending.
9. All 5 locales — switch language → tour copy updates on next replay.
10. Network failure on PATCH — modal still closes; next login retries naturally.

### Build/lint/format gates (per project rules)

```
cd packages/server && npm run build
cd packages/client && npm run build
cd packages/server && npm run format-check
cd packages/client && npm run format-check
```

### No automated tests

Atlas has no client visual-overlay test infrastructure today. Adding one for a tour is overkill. The TypeScript types + manual checklist carry the load.

### Rollout

- No feature flag — first-run experience, additive, low-risk
- Schema change is additive (nullable column), backward-compatible with old client builds
- Existing users land with `tourCompletedAt = null` → all of them see the tour on their next login (per explicit decision)
- Per-app translation keys must land in the same commit as the manifest entries; any app with `tour` declared but missing keys is a build-time check via i18n linting (if available) or runtime warning otherwise

---

## Open questions (none blocking implementation)

- Final wording for the user-menu replay item ("Take the tour" vs. "Replay tour"). Default in this spec: "Take the tour".

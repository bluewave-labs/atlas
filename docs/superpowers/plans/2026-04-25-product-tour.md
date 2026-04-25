# Atlas Product Tour Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a first-run dock walkthrough that auto-fires after login, walks the user through every accessible app with a small modal above each dock icon, and persists per tenant membership.

**Architecture:** Per-app `tour` field in each `ClientAppManifest` declares a variant (`list` / `kanban` / `activity` / `custom`) plus illustration data. A new `<TourOverlay>` mounted on the home page reads accessible apps, builds steps, and drives a Zustand store. Server stores `tourCompletedAt` on `tenantMembers`; a single `GET /api/v1/system/tour` returns the timestamp, `PATCH /api/v1/system/tour/complete` marks it. Dock magnification is suspended while the tour is open.

**Tech Stack:** React + TypeScript + Vite (client), Express + Drizzle ORM + PostgreSQL (server), Zustand for tour state, TanStack Query for fetching tour status, react-i18next for translations.

**Spec:** `docs/superpowers/specs/2026-04-25-product-tour-design.md`

---

## Notes for the implementing engineer

- This codebase has **no client unit-test infrastructure** for visual overlays. The plan substitutes manual visual checks (using the dev server) and a TypeScript build for "tests pass." Server endpoints get manual `curl` checks.
- **Always commit and push to `main` directly.** Do not create branches. After each commit, run `git push origin main` in the background.
- **Atlas dev server ports:** client 5180, server 3001. Before starting dev: `lsof -ti:5180,3001 | xargs kill -9 2>/dev/null || true`.
- All UI must use Atlas tokens (`--color-*`, `--radius-*`, `--spacing-*`, `--font-size-*`). No hardcoded hex unless it's brand color from the manifest.
- All user-visible strings must use `t()` and have keys in **all 5 locale files** (`en.json`, `tr.json`, `de.json`, `fr.json`, `it.json`).
- This product is called **Atlas** — never "AtlasMail."

---

## File structure

### New files

| Path | Responsibility |
|------|---------------|
| `packages/client/src/components/tour/tour-types.ts` | All shared TypeScript types: `BadgeTone`, `ListData`, `KanbanData`, `ActivityData`, `TourConfig`, `TourStep` |
| `packages/client/src/components/tour/use-tour.ts` | Zustand store: `{ isOpen, steps, currentStepIndex, open, next, prev, skip, finish }` |
| `packages/client/src/components/tour/tour-target.ts` | Pure helper that takes a DOM rect + viewport size and returns `{ modalLeft, modalTop, caretLeft, spotlightX, spotlightY }` |
| `packages/client/src/components/tour/use-tour-bootstrap.ts` | Hook mounted in home page: fetches tour status, builds steps, opens tour if needed |
| `packages/client/src/components/tour/tour-overlay.tsx` | Top-level: backdrop dim + spotlight + vignette + caret + `<TourModal>` |
| `packages/client/src/components/tour/tour-modal.tsx` | The 340px white card (header / body / footer) |
| `packages/client/src/components/tour/tour-illustration.tsx` | Variant dispatcher: switches on variant, renders the matching illustration component |
| `packages/client/src/components/tour/illustrations/list-illustration.tsx` | Variant A — fading row list with optional collaborator cursor |
| `packages/client/src/components/tour/illustrations/kanban-illustration.tsx` | Variant B — three columns with optional drag-in-progress card |
| `packages/client/src/components/tour/illustrations/activity-illustration.tsx` | Variant C — contact card + fading activity timeline with live pulse |
| `packages/client/src/components/tour/tour.css` | Tour-only styles (backdrop, spotlight gradient, modal, caret, illustrations) |

### Modified files (client)

| Path | Change |
|------|--------|
| `packages/client/src/config/app-manifest.client.ts` | Add optional `tour?: TourConfig` field to `ClientAppManifest` |
| `packages/client/src/config/query-keys.ts` | Add `tour: { status: ['tour', 'status'] as const }` |
| `packages/client/src/apps/crm/manifest.ts` | Add `tour: { variant: 'list', illustrationData: {...} }` |
| `packages/client/src/apps/hr/manifest.ts` | Add `tour: { variant: 'activity', illustrationData: {...} }` |
| `packages/client/src/apps/work/manifest.ts` | Add `tour: { variant: 'kanban', illustrationData: {...} }` (Tasks/Projects) |
| `packages/client/src/apps/calendar/manifest.ts` | Add `tour: { variant: 'activity', illustrationData: {...} }` |
| `packages/client/src/apps/sign/manifest.ts` | Add `tour: { variant: 'kanban', illustrationData: {...} }` |
| `packages/client/src/apps/invoices/manifest.ts` | Add `tour: { variant: 'list', illustrationData: {...} }` |
| `packages/client/src/apps/drive/manifest.ts` | Add `tour: { variant: 'list', illustrationData: {...} }` |
| `packages/client/src/apps/docs/manifest.ts` | Add `tour: { variant: 'activity', illustrationData: {...} }` |
| `packages/client/src/apps/draw/manifest.ts` | Add `tour: { variant: 'list', illustrationData: {...} }` |
| `packages/client/src/apps/system/manifest.ts` | Add `tour: { variant: 'list', illustrationData: {...} }` |
| `packages/client/src/pages/home.tsx` | Mount `<TourOverlay />`, call `useTourBootstrap()`, add `data-tour-target="<appId>"` to dock buttons, gate dock magnification on tour state, hide dock-pet when tour is open |
| `packages/client/src/i18n/locales/en.json` | Add top-level `tour` namespace + per-app `tour.title` / `tour.description` keys |
| `packages/client/src/i18n/locales/tr.json` | Same keys, Turkish |
| `packages/client/src/i18n/locales/de.json` | Same keys, German |
| `packages/client/src/i18n/locales/fr.json` | Same keys, French |
| `packages/client/src/i18n/locales/it.json` | Same keys, Italian |

### Modified files (server)

| Path | Change |
|------|--------|
| `packages/server/src/db/schema.ts:715-725` | Add `tourCompletedAt: timestamp('tour_completed_at', { withTimezone: true })` to `tenantMembers` |
| `packages/server/src/apps/system/service.ts` | Add `getTourStatus(userId, tenantId)` and `markTourComplete(userId, tenantId)` |
| `packages/server/src/apps/system/controller.ts` | Add `getTour` and `completeTour` handlers |
| `packages/server/src/apps/system/routes.ts` | Wire `GET /tour` and `PATCH /tour/complete` (auth-only, no admin gate) |
| `packages/server/src/openapi/paths/system.ts` (or equivalent) | Register the two new paths |

---

## Task 1: Add `tourCompletedAt` column to `tenantMembers`

**Files:**
- Modify: `packages/server/src/db/schema.ts:715-725`

- [ ] **Step 1: Read the current `tenantMembers` definition**

Read `packages/server/src/db/schema.ts` lines 715–725. Confirm shape matches what's in the design spec.

- [ ] **Step 2: Add the column**

Edit `packages/server/src/db/schema.ts`. Find:

```typescript
export const tenantMembers = pgTable('tenant_members', {
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  role: varchar('role', { length: 50 }).notNull().default('member'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueMember: uniqueIndex('idx_tenant_members_unique').on(table.tenantId, table.userId),
}));
```

Replace with:

```typescript
export const tenantMembers = pgTable('tenant_members', {
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  role: varchar('role', { length: 50 }).notNull().default('member'),
  tourCompletedAt: timestamp('tour_completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueMember: uniqueIndex('idx_tenant_members_unique').on(table.tenantId, table.userId),
}));
```

- [ ] **Step 3: Push the schema to Postgres**

Run from repo root:

```bash
cd packages/server && npm run db:push
```

Expected: drizzle-kit prints `[✓] Pulling schema from database...` and `[✓] Changes applied`. The new `tour_completed_at` column appears under `tenant_members`. No prompts because the column is nullable.

- [ ] **Step 4: Verify by querying Postgres**

```bash
docker compose exec -T postgres psql -U postgres -d atlas -c "\d tenant_members"
```

Expected output includes a line like:

```
 tour_completed_at | timestamp with time zone |
```

- [ ] **Step 5: Commit and push**

```bash
git add packages/server/src/db/schema.ts
git commit -m "feat(tour): add tourCompletedAt column to tenant_members"
git push origin main
```

---

## Task 2: Server tour service functions

**Files:**
- Modify: `packages/server/src/apps/system/service.ts`

- [ ] **Step 1: Read the existing service file to see imports**

Read the top 30 lines of `packages/server/src/apps/system/service.ts` to learn the existing import style and how `db` and the schema are imported.

- [ ] **Step 2: Add the two new service functions**

Append to `packages/server/src/apps/system/service.ts`:

```typescript
// ─── Product tour ────────────────────────────────────────────────

import { tenantMembers } from '../../db/schema';
import { and, eq, sql } from 'drizzle-orm';

export interface TourStatus {
  tourCompletedAt: string | null;
}

export async function getTourStatus(
  userId: string,
  tenantId: string,
): Promise<TourStatus> {
  const [row] = await db
    .select({ tourCompletedAt: tenantMembers.tourCompletedAt })
    .from(tenantMembers)
    .where(and(eq(tenantMembers.userId, userId), eq(tenantMembers.tenantId, tenantId)))
    .limit(1);

  if (!row) {
    throw new Error('TENANT_MEMBERSHIP_NOT_FOUND');
  }

  return {
    tourCompletedAt: row.tourCompletedAt
      ? row.tourCompletedAt.toISOString()
      : null,
  };
}

export async function markTourComplete(
  userId: string,
  tenantId: string,
): Promise<TourStatus> {
  // COALESCE makes this idempotent — a re-call doesn't bump the timestamp.
  const [row] = await db
    .update(tenantMembers)
    .set({ tourCompletedAt: sql`COALESCE(${tenantMembers.tourCompletedAt}, now())` })
    .where(and(eq(tenantMembers.userId, userId), eq(tenantMembers.tenantId, tenantId)))
    .returning({ tourCompletedAt: tenantMembers.tourCompletedAt });

  if (!row) {
    throw new Error('TENANT_MEMBERSHIP_NOT_FOUND');
  }

  return {
    tourCompletedAt: row.tourCompletedAt
      ? row.tourCompletedAt.toISOString()
      : null,
  };
}
```

If imports for `db`, `and`, `eq`, `sql`, or `tenantMembers` already exist at the top of the file, **do not duplicate them** — instead, merge the new identifiers into the existing import lines and remove the duplicate import block above.

- [ ] **Step 3: Type-check**

```bash
cd packages/server && npm run build
```

Expected: build succeeds with no errors.

- [ ] **Step 4: Commit and push**

```bash
git add packages/server/src/apps/system/service.ts
git commit -m "feat(tour): add getTourStatus and markTourComplete service functions"
git push origin main
```

---

## Task 3: Server tour controller handlers

**Files:**
- Modify: `packages/server/src/apps/system/controller.ts`

- [ ] **Step 1: Read existing controller to learn the handler style**

Read top 40 lines of `packages/server/src/apps/system/controller.ts` for the import block and the shape of an existing handler.

- [ ] **Step 2: Add the two handlers**

Append to `packages/server/src/apps/system/controller.ts`:

```typescript
// ─── Product tour ────────────────────────────────────────────────

export async function getTour(req: Request, res: Response) {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      res.status(400).json({ success: false, error: 'No active tenant' });
      return;
    }
    const data = await systemService.getTourStatus(req.auth!.userId, tenantId);
    res.json({ success: true, data });
  } catch (error) {
    if (error instanceof Error && error.message === 'TENANT_MEMBERSHIP_NOT_FOUND') {
      res.status(404).json({ success: false, error: 'Tenant membership not found' });
      return;
    }
    logger.error({ error }, 'Failed to fetch tour status');
    res.status(500).json({ success: false, error: 'Failed to fetch tour status' });
  }
}

export async function completeTour(req: Request, res: Response) {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      res.status(400).json({ success: false, error: 'No active tenant' });
      return;
    }
    // body.skipped is accepted but not stored — reserved for future analytics.
    const data = await systemService.markTourComplete(req.auth!.userId, tenantId);
    res.json({ success: true, data });
  } catch (error) {
    if (error instanceof Error && error.message === 'TENANT_MEMBERSHIP_NOT_FOUND') {
      res.status(404).json({ success: false, error: 'Tenant membership not found' });
      return;
    }
    logger.error({ error }, 'Failed to mark tour complete');
    res.status(500).json({ success: false, error: 'Failed to mark tour complete' });
  }
}
```

If `Request`, `Response`, `logger`, or `systemService` (or `* as systemService`) aren't imported at the top of the file already, add the missing imports. Match whatever import style the rest of the file uses (e.g., `import * as systemService from './service'` or named imports).

- [ ] **Step 3: Type-check**

```bash
cd packages/server && npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit and push**

```bash
git add packages/server/src/apps/system/controller.ts
git commit -m "feat(tour): add getTour and completeTour controllers"
git push origin main
```

---

## Task 4: Server tour routes

**Files:**
- Modify: `packages/server/src/apps/system/routes.ts`

- [ ] **Step 1: Add the two routes**

Edit `packages/server/src/apps/system/routes.ts`. After the `router.use(authMiddleware);` line (line 36) and before `router.get('/metrics', ...)` (line 39), add:

```typescript
// Product tour — every authenticated tenant member can read and mark their own tour.
router.get('/tour', systemController.getTour);
router.patch('/tour/complete', systemController.completeTour);
```

These routes deliberately have no admin gate — every user marks their own tour state.

- [ ] **Step 2: Type-check and start the server**

```bash
cd packages/server && npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Manual smoke check via curl**

Start the dev server:

```bash
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
cd packages/server && npm run dev &
sleep 3
```

Log in via the existing UI at `http://localhost:5180` to get a token (if not already logged in), then copy the token from `localStorage.atlasmail_token` in the browser console.

```bash
TOKEN="<paste-here>"
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/v1/system/tour
```

Expected: `{"success":true,"data":{"tourCompletedAt":null}}` (or a timestamp if you've already run the PATCH).

```bash
curl -s -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"skipped":true}' http://localhost:3001/api/v1/system/tour/complete
```

Expected: `{"success":true,"data":{"tourCompletedAt":"2026-04-25T..."}}`. Re-running the same PATCH must return the **same** timestamp (idempotent).

- [ ] **Step 4: Reset the column for further testing**

```bash
docker compose exec -T postgres psql -U postgres -d atlas -c "UPDATE tenant_members SET tour_completed_at = NULL"
```

- [ ] **Step 5: Commit and push**

```bash
git add packages/server/src/apps/system/routes.ts
git commit -m "feat(tour): wire GET /tour and PATCH /tour/complete routes"
git push origin main
```

---

## Task 5: Tour types

**Files:**
- Create: `packages/client/src/components/tour/tour-types.ts`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p /Users/gorkemcetin/atlasmail/packages/client/src/components/tour/illustrations
```

- [ ] **Step 2: Create the types file**

Write `packages/client/src/components/tour/tour-types.ts`:

```typescript
import type { ComponentType } from 'react';

export type BadgeTone = 'success' | 'info' | 'warning' | 'neutral' | 'danger';

export interface ListRow {
  initials: string;
  avatarColor: string;
  primary: string;
  secondary: string;
  badge?: { label: string; tone: BadgeTone };
}

export interface ListData {
  rows: ListRow[];
  fadeFrom: number;
  collaborator?: { name: string; color: string; targetRowIndex: number };
}

export interface KanbanCard {
  primary: string;
  secondary: string;
}

export interface KanbanColumn {
  label: string;
  count: number;
  cards: KanbanCard[];
}

export interface KanbanData {
  columns: KanbanColumn[];
  draggedCard?: {
    fromColumn: number;
    toColumn: number;
    primary: string;
    secondary: string;
    collaborator?: { name: string; color: string };
  };
}

export interface ActivityEvent {
  text: string;
  timestamp: string;
  isLive?: boolean;
}

export interface ActivityData {
  contact: {
    initials: string;
    avatarColor: string;
    name: string;
    meta: string;
    badge?: { label: string; tone: BadgeTone };
  };
  events: ActivityEvent[];
}

export type TourVariant = 'list' | 'kanban' | 'activity' | 'custom';

export type TourConfig =
  | { variant: 'list'; illustrationData: ListData }
  | { variant: 'kanban'; illustrationData: KanbanData }
  | { variant: 'activity'; illustrationData: ActivityData }
  | { variant: 'custom'; component: ComponentType };

export interface TourStep {
  appId: string;
  appColor: string;
  config: TourConfig;
  titleKey: string;       // e.g. 'crm.tour.title'
  descriptionKey: string; // e.g. 'crm.tour.description'
}
```

- [ ] **Step 3: Type-check**

```bash
cd packages/client && npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit and push**

```bash
git add packages/client/src/components/tour/tour-types.ts
git commit -m "feat(tour): add shared TypeScript types for tour"
git push origin main
```

---

## Task 6: Extend `ClientAppManifest` with optional `tour` field

**Files:**
- Modify: `packages/client/src/config/app-manifest.client.ts`

- [ ] **Step 1: Add the import + field**

Edit `packages/client/src/config/app-manifest.client.ts`. After the existing imports, add:

```typescript
import type { TourConfig } from '../components/tour/tour-types';
```

Inside `interface ClientAppManifest`, after `widgets?: ClientAppWidget[];`, add:

```typescript
  /** First-run product tour configuration. Apps without this are skipped in the tour. */
  tour?: TourConfig;
```

- [ ] **Step 2: Type-check**

```bash
cd packages/client && npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Commit and push**

```bash
git add packages/client/src/config/app-manifest.client.ts
git commit -m "feat(tour): add optional tour field to ClientAppManifest"
git push origin main
```

---

## Task 7: Tour Zustand store

**Files:**
- Create: `packages/client/src/components/tour/use-tour.ts`

- [ ] **Step 1: Check whether the project uses Zustand**

```bash
grep -l "from 'zustand'" /Users/gorkemcetin/atlasmail/packages/client/src/stores/*.ts | head -1
```

Expected: at least one match (e.g., `auth-store.ts`). Use the same import style as that file.

- [ ] **Step 2: Create the store**

Write `packages/client/src/components/tour/use-tour.ts`:

```typescript
import { create } from 'zustand';
import type { TourStep } from './tour-types';

interface TourState {
  isOpen: boolean;
  steps: TourStep[];
  currentStepIndex: number;
  open: (steps: TourStep[]) => void;
  next: () => void;
  prev: () => void;
  skip: () => void;
  finish: () => void;
  reset: () => void;
}

export const useTour = create<TourState>((set, get) => ({
  isOpen: false,
  steps: [],
  currentStepIndex: 0,

  open: (steps) => {
    if (steps.length === 0) return;
    set({ isOpen: true, steps, currentStepIndex: 0 });
  },

  next: () => {
    const { currentStepIndex, steps } = get();
    if (currentStepIndex >= steps.length - 1) {
      get().finish();
      return;
    }
    set({ currentStepIndex: currentStepIndex + 1 });
  },

  prev: () => {
    const { currentStepIndex } = get();
    if (currentStepIndex <= 0) return;
    set({ currentStepIndex: currentStepIndex - 1 });
  },

  skip: () => {
    set({ isOpen: false, steps: [], currentStepIndex: 0 });
  },

  finish: () => {
    set({ isOpen: false, steps: [], currentStepIndex: 0 });
  },

  reset: () => {
    set({ isOpen: false, steps: [], currentStepIndex: 0 });
  },
}));
```

The store does **not** call the server — that's the bootstrap hook's job. Both `skip()` and `finish()` just reset state; the network call is wired up in Task 11.

- [ ] **Step 3: Type-check**

```bash
cd packages/client && npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit and push**

```bash
git add packages/client/src/components/tour/use-tour.ts
git commit -m "feat(tour): add Zustand store for tour state"
git push origin main
```

---

## Task 8: Tour positioning helper

**Files:**
- Create: `packages/client/src/components/tour/tour-target.ts`

- [ ] **Step 1: Create the helper**

Write `packages/client/src/components/tour/tour-target.ts`:

```typescript
const MODAL_WIDTH = 340;
const MODAL_GAP = 16;        // distance between modal bottom edge and icon top edge
const VIEWPORT_PADDING = 12; // minimum gap between modal and viewport edges
const CARET_HALF_WIDTH = 8;
const MIN_CARET_OFFSET = 16; // caret can't get closer than this to modal edges

export interface TourPosition {
  /** Modal top-left position in viewport pixels */
  modalLeft: number;
  modalTop: number;
  /** Caret horizontal offset from modal's left edge (px) */
  caretLeft: number;
  /** Spotlight center for the radial gradient (viewport px) */
  spotlightX: number;
  spotlightY: number;
  /** Icon rect echoed back so the overlay can draw the white ring on it */
  iconRect: { left: number; top: number; width: number; height: number };
}

/**
 * Compute the modal/caret/spotlight positions for a target dock-icon rect.
 * Modal is always above the icon. Edge-clamps inward without ever going off-screen.
 * Caret tracks the icon center even when the modal is clamped.
 */
export function computeTourPosition(
  iconRect: { left: number; top: number; width: number; height: number },
  viewport: { width: number; height: number },
  modalHeight: number,
): TourPosition {
  const iconCenterX = iconRect.left + iconRect.width / 2;
  const iconTop = iconRect.top;

  // Default: center modal horizontally on the icon
  let modalLeft = Math.round(iconCenterX - MODAL_WIDTH / 2);

  // Clamp horizontally
  const minLeft = VIEWPORT_PADDING;
  const maxLeft = viewport.width - MODAL_WIDTH - VIEWPORT_PADDING;
  if (modalLeft < minLeft) modalLeft = minLeft;
  if (modalLeft > maxLeft) modalLeft = maxLeft;

  // Modal sits above the icon
  let modalTop = Math.round(iconTop - modalHeight - MODAL_GAP);
  if (modalTop < VIEWPORT_PADDING) modalTop = VIEWPORT_PADDING;

  // Caret points down at the icon center; constrain so it doesn't run past modal edges
  const minCaret = MIN_CARET_OFFSET + CARET_HALF_WIDTH;
  const maxCaret = MODAL_WIDTH - MIN_CARET_OFFSET - CARET_HALF_WIDTH;
  let caretLeft = iconCenterX - modalLeft;
  if (caretLeft < minCaret) caretLeft = minCaret;
  if (caretLeft > maxCaret) caretLeft = maxCaret;

  return {
    modalLeft,
    modalTop,
    caretLeft,
    spotlightX: iconCenterX,
    spotlightY: iconRect.top + iconRect.height / 2,
    iconRect,
  };
}
```

- [ ] **Step 2: Type-check**

```bash
cd packages/client && npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Commit and push**

```bash
git add packages/client/src/components/tour/tour-target.ts
git commit -m "feat(tour): add positioning helper for modal and caret"
git push origin main
```

---

## Task 9: List illustration component

**Files:**
- Create: `packages/client/src/components/tour/illustrations/list-illustration.tsx`

- [ ] **Step 1: Create the component**

Write `packages/client/src/components/tour/illustrations/list-illustration.tsx`:

```typescript
import type { ListData, BadgeTone } from '../tour-types';

const BADGE_TONES: Record<BadgeTone, { bg: string; fg: string }> = {
  success: { bg: '#dcfce7', fg: '#15803d' },
  info: { bg: '#dbeafe', fg: '#1d4ed8' },
  warning: { bg: '#fef3c7', fg: '#a16207' },
  danger: { bg: '#fee2e2', fg: '#b91c1c' },
  neutral: { bg: '#f1f5f9', fg: '#475569' },
};

export function ListIllustration({ data }: { data: ListData }) {
  const visibleRows = data.rows.slice(0, 5);

  return (
    <div className="tour-illust tour-illust--list">
      {visibleRows.map((row, index) => {
        const fadeAmount =
          index < data.fadeFrom ? 1 : Math.max(0.2, 1 - (index - data.fadeFrom + 1) * 0.32);

        const isCollabRow =
          data.collaborator !== undefined && data.collaborator.targetRowIndex === index;

        return (
          <div
            key={index}
            className={`tour-illust-row${isCollabRow ? ' tour-illust-row--collab' : ''}`}
            style={{
              opacity: fadeAmount,
              borderColor: isCollabRow && data.collaborator ? data.collaborator.color : undefined,
              boxShadow:
                isCollabRow && data.collaborator
                  ? `0 0 0 2px ${hexToRgba(data.collaborator.color, 0.18)}`
                  : undefined,
            }}
          >
            <div
              className="tour-illust-avatar"
              style={{ background: row.avatarColor }}
            >
              {row.initials}
            </div>
            <div className="tour-illust-row-text">
              <div className="tour-illust-row-primary">{row.primary}</div>
              <div className="tour-illust-row-secondary">{row.secondary}</div>
            </div>
            {row.badge && (
              <span
                className="tour-illust-badge"
                style={{
                  background: BADGE_TONES[row.badge.tone].bg,
                  color: BADGE_TONES[row.badge.tone].fg,
                }}
              >
                {row.badge.label}
              </span>
            )}

            {isCollabRow && data.collaborator && (
              <>
                <svg
                  className="tour-illust-cursor"
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  aria-hidden="true"
                >
                  <path
                    d="M2 1 L2 11 L5 8 L7 12 L9 11 L7 7 L11 7 Z"
                    fill={data.collaborator.color}
                    stroke="white"
                    strokeWidth="0.8"
                  />
                </svg>
                <span
                  className="tour-illust-cursor-flag"
                  style={{ background: data.collaborator.color }}
                >
                  {data.collaborator.name}
                </span>
              </>
            )}
          </div>
        );
      })}
      <div className="tour-illust-fade" />
    </div>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const m = hex.replace('#', '');
  const r = parseInt(m.substring(0, 2), 16);
  const g = parseInt(m.substring(2, 4), 16);
  const b = parseInt(m.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
```

- [ ] **Step 2: Type-check**

```bash
cd packages/client && npm run build
```

Expected: build succeeds (CSS classes resolve at runtime, not at compile time).

- [ ] **Step 3: Commit and push**

```bash
git add packages/client/src/components/tour/illustrations/list-illustration.tsx
git commit -m "feat(tour): add list illustration component"
git push origin main
```

---

## Task 10: Kanban illustration component

**Files:**
- Create: `packages/client/src/components/tour/illustrations/kanban-illustration.tsx`

- [ ] **Step 1: Create the component**

Write `packages/client/src/components/tour/illustrations/kanban-illustration.tsx`:

```typescript
import type { KanbanData } from '../tour-types';

export function KanbanIllustration({ data }: { data: KanbanData }) {
  const cols = data.columns.slice(0, 3);

  // Position the dragged card horizontally as the midpoint between source and target columns
  const draggedLeftPct = data.draggedCard
    ? ((data.draggedCard.fromColumn + data.draggedCard.toColumn) / 2) * (100 / cols.length) +
      100 / cols.length / 2 -
      18
    : 0;

  return (
    <div className="tour-illust tour-illust--kanban">
      <div className="tour-illust-kanban-grid">
        {cols.map((col, colIndex) => (
          <div key={colIndex} className="tour-illust-kanban-col">
            <div className="tour-illust-kanban-label">
              {col.label} · {col.count}
            </div>
            {col.cards.slice(0, 3).map((card, cardIndex) => {
              const showDropSlot =
                data.draggedCard &&
                data.draggedCard.toColumn === colIndex &&
                cardIndex === 1;
              return (
                <div key={cardIndex}>
                  {showDropSlot && <div className="tour-illust-kanban-slot" />}
                  <div className="tour-illust-kanban-card">
                    <div className="tour-illust-kanban-card-primary">{card.primary}</div>
                    <div className="tour-illust-kanban-card-secondary">{card.secondary}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {data.draggedCard && (
        <>
          <div
            className="tour-illust-kanban-dragged"
            style={{ left: `${draggedLeftPct}%` }}
          >
            <div className="tour-illust-kanban-card-primary">{data.draggedCard.primary}</div>
            <div className="tour-illust-kanban-card-secondary">{data.draggedCard.secondary}</div>
          </div>
          {data.draggedCard.collaborator && (
            <>
              <svg
                className="tour-illust-cursor tour-illust-cursor--kanban"
                width="14"
                height="14"
                viewBox="0 0 14 14"
                style={{ left: `calc(${draggedLeftPct}% + 60px)` }}
                aria-hidden="true"
              >
                <path
                  d="M2 1 L2 11 L5 8 L7 12 L9 11 L7 7 L11 7 Z"
                  fill={data.draggedCard.collaborator.color}
                  stroke="white"
                  strokeWidth="0.8"
                />
              </svg>
              <span
                className="tour-illust-cursor-flag tour-illust-cursor-flag--kanban"
                style={{
                  left: `calc(${draggedLeftPct}% + 76px)`,
                  background: data.draggedCard.collaborator.color,
                }}
              >
                {data.draggedCard.collaborator.name}
              </span>
            </>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd packages/client && npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Commit and push**

```bash
git add packages/client/src/components/tour/illustrations/kanban-illustration.tsx
git commit -m "feat(tour): add kanban illustration component"
git push origin main
```

---

## Task 11: Activity illustration component

**Files:**
- Create: `packages/client/src/components/tour/illustrations/activity-illustration.tsx`

- [ ] **Step 1: Create the component**

Write `packages/client/src/components/tour/illustrations/activity-illustration.tsx`:

```typescript
import type { ActivityData, BadgeTone } from '../tour-types';

const BADGE_TONES: Record<BadgeTone, { bg: string; fg: string }> = {
  success: { bg: '#dcfce7', fg: '#15803d' },
  info: { bg: '#dbeafe', fg: '#1d4ed8' },
  warning: { bg: '#fef3c7', fg: '#a16207' },
  danger: { bg: '#fee2e2', fg: '#b91c1c' },
  neutral: { bg: '#f1f5f9', fg: '#475569' },
};

export function ActivityIllustration({ data }: { data: ActivityData }) {
  const visibleEvents = data.events.slice(0, 4);

  return (
    <div className="tour-illust tour-illust--activity">
      <div className="tour-illust-contact">
        <div
          className="tour-illust-avatar tour-illust-avatar--lg"
          style={{ background: data.contact.avatarColor }}
        >
          {data.contact.initials}
        </div>
        <div className="tour-illust-contact-text">
          <div className="tour-illust-contact-name">{data.contact.name}</div>
          <div className="tour-illust-contact-meta">{data.contact.meta}</div>
        </div>
        {data.contact.badge && (
          <span
            className="tour-illust-badge"
            style={{
              background: BADGE_TONES[data.contact.badge.tone].bg,
              color: BADGE_TONES[data.contact.badge.tone].fg,
            }}
          >
            {data.contact.badge.label}
          </span>
        )}
      </div>

      <div className="tour-illust-activity-label">Activity</div>

      <div className="tour-illust-activity-list">
        {visibleEvents.map((event, index) => {
          const opacity = index === 0 ? 1 : Math.max(0.3, 1 - index * 0.25);
          return (
            <div
              key={index}
              className="tour-illust-activity-item"
              style={{ opacity }}
            >
              <div
                className={`tour-illust-activity-dot${event.isLive ? ' tour-illust-activity-dot--live' : ''}`}
              />
              <div className="tour-illust-activity-text">
                <div className="tour-illust-activity-event">{event.text}</div>
                <div className="tour-illust-activity-time">{event.timestamp}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="tour-illust-fade" />
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd packages/client && npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Commit and push**

```bash
git add packages/client/src/components/tour/illustrations/activity-illustration.tsx
git commit -m "feat(tour): add activity illustration component"
git push origin main
```

---

## Task 12: Illustration variant dispatcher

**Files:**
- Create: `packages/client/src/components/tour/tour-illustration.tsx`

- [ ] **Step 1: Create the dispatcher**

Write `packages/client/src/components/tour/tour-illustration.tsx`:

```typescript
import type { TourConfig } from './tour-types';
import { ListIllustration } from './illustrations/list-illustration';
import { KanbanIllustration } from './illustrations/kanban-illustration';
import { ActivityIllustration } from './illustrations/activity-illustration';

export function TourIllustration({ config }: { config: TourConfig }) {
  switch (config.variant) {
    case 'list':
      return <ListIllustration data={config.illustrationData} />;
    case 'kanban':
      return <KanbanIllustration data={config.illustrationData} />;
    case 'activity':
      return <ActivityIllustration data={config.illustrationData} />;
    case 'custom': {
      const Custom = config.component;
      return <Custom />;
    }
  }
}
```

- [ ] **Step 2: Type-check**

```bash
cd packages/client && npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Commit and push**

```bash
git add packages/client/src/components/tour/tour-illustration.tsx
git commit -m "feat(tour): add illustration variant dispatcher"
git push origin main
```

---

## Task 13: Tour modal component

**Files:**
- Create: `packages/client/src/components/tour/tour-modal.tsx`

- [ ] **Step 1: Create the component**

Write `packages/client/src/components/tour/tour-modal.tsx`:

```typescript
import { useTranslation } from 'react-i18next';
import type { TourStep } from './tour-types';
import { TourIllustration } from './tour-illustration';

interface TourModalProps {
  step: TourStep;
  stepIndex: number;
  totalSteps: number;
  modalLeft: number;
  modalTop: number;
  caretLeft: number;
  onPrev: () => void;
  onNext: () => void;
  onSkip: () => void;
  onClose: () => void;
}

export function TourModal({
  step,
  stepIndex,
  totalSteps,
  modalLeft,
  modalTop,
  caretLeft,
  onPrev,
  onNext,
  onSkip,
  onClose,
}: TourModalProps) {
  const { t } = useTranslation();
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === totalSteps - 1;

  return (
    <div
      className="tour-modal"
      style={{ left: modalLeft, top: modalTop }}
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-modal-title"
    >
      <div className="tour-modal-header">
        <span
          className="tour-modal-app-color"
          style={{ background: step.appColor }}
          aria-hidden="true"
        />
        <span id="tour-modal-title" className="tour-modal-title">
          {t(step.titleKey)}
        </span>
        <button
          type="button"
          className="tour-modal-close"
          onClick={onClose}
          aria-label={t('tour.skip')}
        >
          ×
        </button>
      </div>

      <div className="tour-modal-body">
        <p className="tour-modal-description">{t(step.descriptionKey)}</p>
        <TourIllustration config={step.config} />
      </div>

      <div className="tour-modal-footer">
        <span className="tour-modal-step-counter">
          {t('tour.stepCounter', { current: stepIndex + 1, total: totalSteps })}
        </span>
        <div className="tour-modal-actions">
          {!isFirst && (
            <button type="button" className="tour-modal-btn tour-modal-btn--ghost" onClick={onPrev}>
              {t('tour.previous')}
            </button>
          )}
          <button type="button" className="tour-modal-btn tour-modal-btn--ghost tour-modal-btn--skip" onClick={onSkip}>
            {t('tour.skip')}
          </button>
          <button type="button" className="tour-modal-btn tour-modal-btn--primary" onClick={onNext}>
            {isLast ? t('tour.finish') : t('tour.next')}
          </button>
        </div>
      </div>

      <span
        className="tour-modal-caret"
        style={{ left: caretLeft }}
        aria-hidden="true"
      />
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd packages/client && npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Commit and push**

```bash
git add packages/client/src/components/tour/tour-modal.tsx
git commit -m "feat(tour): add tour modal component"
git push origin main
```

---

## Task 14: Tour CSS

**Files:**
- Create: `packages/client/src/components/tour/tour.css`

- [ ] **Step 1: Create the stylesheet**

Write `packages/client/src/components/tour/tour.css`:

```css
/* ─── Backdrop layers ────────────────────────────────────────────── */

.tour-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9000;
  background: rgba(8, 12, 24, 0.72);
  pointer-events: auto;
}

.tour-spotlight {
  position: fixed;
  inset: 0;
  z-index: 9001;
  pointer-events: none;
  mix-blend-mode: screen;
}

.tour-vignette {
  position: fixed;
  inset: 0;
  z-index: 9002;
  pointer-events: none;
}

.tour-icon-ring {
  position: fixed;
  z-index: 9003;
  border-radius: var(--radius-sm);
  box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.12);
  pointer-events: none;
}

/* ─── Modal ──────────────────────────────────────────────────────── */

.tour-modal {
  position: fixed;
  z-index: 9010;
  width: 340px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  border-radius: var(--radius-sm);
  padding: var(--spacing-lg);
  box-shadow: var(--shadow-elevated);
  font-family: var(--font-family);
  font-size: var(--font-size-sm);
  pointer-events: auto;
  animation: tour-modal-in 180ms ease-out;
}

@keyframes tour-modal-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.tour-modal-caret {
  position: absolute;
  bottom: -7px;
  width: 0;
  height: 0;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-top: 8px solid var(--color-bg-primary);
  filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.1));
  transform: translateX(-8px);
}

.tour-modal-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}

.tour-modal-app-color {
  width: 16px;
  height: 16px;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.tour-modal-title {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  letter-spacing: -0.01em;
}

.tour-modal-close {
  margin-left: auto;
  background: none;
  border: none;
  color: var(--color-text-tertiary);
  font-size: 18px;
  line-height: 1;
  padding: 4px 6px;
  cursor: pointer;
  border-radius: var(--radius-sm);
}

.tour-modal-close:hover {
  background: var(--color-surface-hover);
  color: var(--color-text-primary);
}

.tour-modal-body {
  margin-bottom: var(--spacing-md);
}

.tour-modal-description {
  font-size: var(--font-size-sm);
  line-height: 1.5;
  color: var(--color-text-secondary);
  margin: 0 0 var(--spacing-md) 0;
}

.tour-modal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-sm);
}

.tour-modal-step-counter {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}

.tour-modal-actions {
  display: flex;
  gap: 6px;
}

.tour-modal-btn {
  font-family: inherit;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  border: 1px solid transparent;
}

.tour-modal-btn--ghost {
  background: transparent;
  border-color: var(--color-border-primary);
  color: var(--color-text-secondary);
}

.tour-modal-btn--ghost:hover {
  background: var(--color-surface-hover);
}

.tour-modal-btn--skip {
  border-color: transparent;
}

.tour-modal-btn--primary {
  background: var(--color-accent-primary);
  border-color: var(--color-accent-primary);
  color: white;
}

.tour-modal-btn--primary:hover {
  filter: brightness(1.05);
}

/* ─── Illustrations: shared ──────────────────────────────────────── */

.tour-illust {
  position: relative;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--radius-sm);
  padding: 10px;
  height: 280px;
  overflow: hidden;
}

.tour-illust-fade {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 60px;
  background: linear-gradient(to bottom, rgba(255, 255, 255, 0), var(--color-bg-secondary));
  pointer-events: none;
}

.tour-illust-avatar {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  color: white;
  font-size: 10px;
  font-weight: var(--font-weight-semibold);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.tour-illust-avatar--lg {
  width: 32px;
  height: 32px;
  font-size: 12px;
}

.tour-illust-badge {
  font-size: 11px;
  font-weight: var(--font-weight-medium);
  padding: 2px 7px;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.tour-illust-cursor {
  position: absolute;
  top: -4px;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.25));
  pointer-events: none;
}

.tour-illust-cursor-flag {
  position: absolute;
  top: 10px;
  color: white;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 3px;
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
  pointer-events: none;
}

/* ─── List variant ───────────────────────────────────────────────── */

.tour-illust--list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tour-illust-row {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
}

.tour-illust-row--collab {
  border-width: 1px;
}

.tour-illust-row-text {
  flex: 1;
  min-width: 0;
}

.tour-illust-row-primary {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tour-illust-row-secondary {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tour-illust-row .tour-illust-cursor {
  right: 38px;
}

.tour-illust-row .tour-illust-cursor-flag {
  right: 18px;
}

/* ─── Kanban variant ─────────────────────────────────────────────── */

.tour-illust--kanban {
  position: relative;
}

.tour-illust-kanban-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 6px;
  height: 100%;
}

.tour-illust-kanban-col {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tour-illust-kanban-label {
  font-size: 10px;
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 2px;
}

.tour-illust-kanban-card {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--radius-sm);
  padding: 6px;
}

.tour-illust-kanban-card-primary {
  font-size: 11px;
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}

.tour-illust-kanban-card-secondary {
  font-size: 10px;
  color: var(--color-text-tertiary);
}

.tour-illust-kanban-slot {
  border: 1px dashed #6366f1;
  border-radius: var(--radius-sm);
  height: 30px;
  margin-bottom: 4px;
}

.tour-illust-kanban-dragged {
  position: absolute;
  top: 60px;
  background: var(--color-bg-primary);
  border: 1px solid #6366f1;
  border-radius: var(--radius-sm);
  padding: 6px 8px;
  width: 110px;
  box-shadow: 0 8px 18px rgba(99, 102, 241, 0.35);
  transform: rotate(-3deg);
  z-index: 2;
  pointer-events: none;
}

.tour-illust-cursor--kanban {
  top: 80px;
  z-index: 3;
}

.tour-illust-cursor-flag--kanban {
  top: 92px;
  z-index: 3;
}

/* ─── Activity variant ───────────────────────────────────────────── */

.tour-illust--activity {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tour-illust-contact {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.tour-illust-contact-text {
  flex: 1;
  min-width: 0;
}

.tour-illust-contact-name {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}

.tour-illust-contact-meta {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}

.tour-illust-activity-label {
  font-size: 10px;
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.tour-illust-activity-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tour-illust-activity-item {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.tour-illust-activity-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--color-border-primary);
  margin-top: 5px;
  flex-shrink: 0;
}

.tour-illust-activity-dot--live {
  background: var(--color-success);
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.18);
  animation: tour-pulse 1.6s infinite ease-out;
}

@keyframes tour-pulse {
  0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
  70% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
  100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
}

.tour-illust-activity-text {
  flex: 1;
}

.tour-illust-activity-event {
  font-size: 12px;
  color: var(--color-text-primary);
}

.tour-illust-activity-time {
  font-size: 10px;
  color: var(--color-text-tertiary);
}
```

- [ ] **Step 2: Commit and push**

```bash
git add packages/client/src/components/tour/tour.css
git commit -m "feat(tour): add tour stylesheet"
git push origin main
```

---

## Task 15: Tour overlay (top-level mount, with API integration)

**Files:**
- Create: `packages/client/src/components/tour/tour-overlay.tsx`
- Modify: `packages/client/src/config/query-keys.ts`

- [ ] **Step 1: Add tour query key**

Read `packages/client/src/config/query-keys.ts`. Add a new entry inside the `queryKeys` object:

```typescript
  tour: {
    status: ['tour', 'status'] as const,
  },
```

Place it alphabetically, matching the existing pattern.

- [ ] **Step 2: Create the overlay component**

Write `packages/client/src/components/tour/tour-overlay.tsx`:

```typescript
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { queryKeys } from '../../config/query-keys';
import { useTour } from './use-tour';
import { TourModal } from './tour-modal';
import { computeTourPosition, type TourPosition } from './tour-target';
import './tour.css';

export function TourOverlay() {
  const { isOpen, steps, currentStepIndex, prev, next, skip, finish } = useTour();
  const [position, setPosition] = useState<TourPosition | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const queryClient = useQueryClient();

  const completeMutation = useMutation({
    mutationFn: async (skipped: boolean) => {
      await api.patch('/system/tour/complete', { skipped });
    },
    onSettled: () => {
      // Mark cache as completed regardless of network outcome so reload doesn't re-fire.
      queryClient.setQueryData(queryKeys.tour.status, { tourCompletedAt: new Date().toISOString() });
    },
  });

  const currentStep = steps[currentStepIndex];

  // Recompute position whenever the active step or viewport changes
  useLayoutEffect(() => {
    if (!isOpen || !currentStep) {
      setPosition(null);
      return;
    }

    const recompute = () => {
      const target = document.querySelector<HTMLElement>(
        `[data-tour-target="${currentStep.appId}"]`,
      );
      if (!target) {
        setPosition(null);
        return;
      }
      const iconRect = target.getBoundingClientRect();
      const modalHeight = modalRef.current?.offsetHeight ?? 380;
      setPosition(
        computeTourPosition(
          {
            left: iconRect.left,
            top: iconRect.top,
            width: iconRect.width,
            height: iconRect.height,
          },
          { width: window.innerWidth, height: window.innerHeight },
          modalHeight,
        ),
      );
    };

    recompute();
    window.addEventListener('resize', recompute);
    const ro = new ResizeObserver(recompute);
    const dock = document.querySelector('[data-tour-target]');
    if (dock?.parentElement) ro.observe(dock.parentElement);

    return () => {
      window.removeEventListener('resize', recompute);
      ro.disconnect();
    };
  }, [isOpen, currentStep, currentStepIndex]);

  // Re-measure once the modal has rendered (so we know the real height)
  useEffect(() => {
    if (!isOpen || !currentStep || !modalRef.current) return;
    const target = document.querySelector<HTMLElement>(
      `[data-tour-target="${currentStep.appId}"]`,
    );
    if (!target) return;
    const iconRect = target.getBoundingClientRect();
    setPosition(
      computeTourPosition(
        {
          left: iconRect.left,
          top: iconRect.top,
          width: iconRect.width,
          height: iconRect.height,
        },
        { width: window.innerWidth, height: window.innerHeight },
        modalRef.current.offsetHeight,
      ),
    );
  }, [isOpen, currentStepIndex, currentStep]);

  // Esc → skip
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        completeMutation.mutate(true);
        skip();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, skip, completeMutation]);

  if (!isOpen || !currentStep || !position) return null;

  const handleSkip = () => {
    completeMutation.mutate(true);
    skip();
  };

  const handleClose = handleSkip;

  const handleNext = () => {
    const isLast = currentStepIndex === steps.length - 1;
    if (isLast) {
      completeMutation.mutate(false);
      finish();
    } else {
      next();
    }
  };

  return (
    <>
      <div className="tour-backdrop" onClick={handleSkip} />

      <div
        className="tour-spotlight"
        style={{
          background: `radial-gradient(circle at ${position.spotlightX}px ${position.spotlightY}px, rgba(255,255,255,0.18) 0px, rgba(255,255,255,0.08) 60px, rgba(255,255,255,0) 130px, rgba(0,0,0,0) 100%)`,
        }}
      />

      <div
        className="tour-vignette"
        style={{
          background: `radial-gradient(circle at ${position.spotlightX}px ${position.spotlightY}px, transparent 0, transparent 140px, rgba(0,0,0,0.35) 320px)`,
        }}
      />

      <div
        className="tour-icon-ring"
        style={{
          left: position.iconRect.left,
          top: position.iconRect.top,
          width: position.iconRect.width,
          height: position.iconRect.height,
        }}
      />

      <div ref={modalRef}>
        <TourModal
          step={currentStep}
          stepIndex={currentStepIndex}
          totalSteps={steps.length}
          modalLeft={position.modalLeft}
          modalTop={position.modalTop}
          caretLeft={position.caretLeft}
          onPrev={prev}
          onNext={handleNext}
          onSkip={handleSkip}
          onClose={handleClose}
        />
      </div>
    </>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
cd packages/client && npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit and push**

```bash
git add packages/client/src/components/tour/tour-overlay.tsx packages/client/src/config/query-keys.ts
git commit -m "feat(tour): add tour overlay component with API integration"
git push origin main
```

---

## Task 16: Bootstrap hook

**Files:**
- Create: `packages/client/src/components/tour/use-tour-bootstrap.ts`

- [ ] **Step 1: Read app-registry to confirm `getAll()` returns sorted apps**

```bash
grep -n "getAll\|values()" /Users/gorkemcetin/atlasmail/packages/client/src/config/app-registry.ts
```

If `getAll()` returns insertion order (not sidebarOrder-sorted), the bootstrap will sort manually — handled below.

- [ ] **Step 2: Create the bootstrap hook**

Write `packages/client/src/components/tour/use-tour-bootstrap.ts`:

```typescript
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { queryKeys } from '../../config/query-keys';
import { appRegistry } from '../../apps';
import { useMyAccessibleApps } from '../../hooks/use-app-permissions';
import { useTour } from './use-tour';
import type { TourStep } from './tour-types';

interface TourStatusResponse {
  tourCompletedAt: string | null;
}

export function useTourBootstrap() {
  const { open, isOpen } = useTour();
  const accessibleQuery = useMyAccessibleApps();
  const tourStatusQuery = useQuery({
    queryKey: queryKeys.tour.status,
    queryFn: async () => {
      const { data } = await api.get('/system/tour');
      return data.data as TourStatusResponse;
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (isOpen) return;
    if (!tourStatusQuery.data || !accessibleQuery.data) return;
    if (tourStatusQuery.data.tourCompletedAt !== null) return;

    const accessibleAppIds = accessibleQuery.data.appIds;
    const allApps = appRegistry.getAll();

    const tourApps = allApps
      .filter((app) => app.tour !== undefined)
      .filter((app) => {
        if (accessibleAppIds === '__all__') return true;
        return Array.isArray(accessibleAppIds) && accessibleAppIds.includes(app.id);
      })
      .sort((a, b) => a.sidebarOrder - b.sidebarOrder);

    if (tourApps.length === 0) return;

    const steps: TourStep[] = tourApps.map((app) => ({
      appId: app.id,
      appColor: app.color,
      config: app.tour!,
      titleKey: `${app.id}.tour.title`,
      descriptionKey: `${app.id}.tour.description`,
    }));

    // Defer to after first paint so the dock renders before the overlay drops in
    const id = window.setTimeout(() => open(steps), 150);
    return () => window.clearTimeout(id);
  }, [tourStatusQuery.data, accessibleQuery.data, isOpen, open]);
}

/** Replay path used by the user-menu "Take the tour" entry. Ignores tourCompletedAt. */
export function replayTour() {
  const { open } = useTour.getState();
  const allApps = appRegistry.getAll();
  const tourApps = allApps
    .filter((app) => app.tour !== undefined)
    .sort((a, b) => a.sidebarOrder - b.sidebarOrder);
  const steps: TourStep[] = tourApps.map((app) => ({
    appId: app.id,
    appColor: app.color,
    config: app.tour!,
    titleKey: `${app.id}.tour.title`,
    descriptionKey: `${app.id}.tour.description`,
  }));
  if (steps.length > 0) open(steps);
}
```

Note: `replayTour()` does **not** filter by accessible apps because the menu item only appears in contexts where the user has at least one. We rely on the `app.tour` filter to be enough; if the user opens the replay and has no accessible apps with tours, no steps are produced.

- [ ] **Step 3: Type-check**

```bash
cd packages/client && npm run build
```

Expected: build succeeds. If `app.tour` is flagged as `unknown`, the manifest extension from Task 6 didn't make it in — go back and verify.

- [ ] **Step 4: Commit and push**

```bash
git add packages/client/src/components/tour/use-tour-bootstrap.ts
git commit -m "feat(tour): add bootstrap hook and replay function"
git push origin main
```

---

## Task 17: Add i18n keys for tour chrome (5 locales)

**Files:**
- Modify: `packages/client/src/i18n/locales/en.json`
- Modify: `packages/client/src/i18n/locales/tr.json`
- Modify: `packages/client/src/i18n/locales/de.json`
- Modify: `packages/client/src/i18n/locales/fr.json`
- Modify: `packages/client/src/i18n/locales/it.json`

- [ ] **Step 1: Add the `tour` namespace to each locale**

Read the top-level structure of each locale file (one quick `head -20`). Add a new top-level `tour` block alongside others (e.g., near `common`, `sidebar`):

`en.json`:
```json
"tour": {
  "previous": "Previous",
  "next": "Next",
  "finish": "Finish",
  "skip": "Skip tour",
  "stepCounter": "{{current}} of {{total}}",
  "menuReplay": "Take the tour"
},
```

`tr.json`:
```json
"tour": {
  "previous": "Geri",
  "next": "İleri",
  "finish": "Bitir",
  "skip": "Turu atla",
  "stepCounter": "{{current}} / {{total}}",
  "menuReplay": "Turu başlat"
},
```

`de.json`:
```json
"tour": {
  "previous": "Zurück",
  "next": "Weiter",
  "finish": "Fertig",
  "skip": "Tour überspringen",
  "stepCounter": "{{current}} von {{total}}",
  "menuReplay": "Tour starten"
},
```

`fr.json`:
```json
"tour": {
  "previous": "Précédent",
  "next": "Suivant",
  "finish": "Terminer",
  "skip": "Passer la visite",
  "stepCounter": "{{current}} sur {{total}}",
  "menuReplay": "Lancer la visite"
},
```

`it.json`:
```json
"tour": {
  "previous": "Indietro",
  "next": "Avanti",
  "finish": "Fine",
  "skip": "Salta tour",
  "stepCounter": "{{current}} di {{total}}",
  "menuReplay": "Avvia il tour"
},
```

- [ ] **Step 2: Validate JSON**

```bash
for f in en tr de fr it; do
  cat /Users/gorkemcetin/atlasmail/packages/client/src/i18n/locales/$f.json | python3 -c "import json,sys;json.load(sys.stdin)" || echo "INVALID: $f.json"
done
```

Expected: no "INVALID" output.

- [ ] **Step 3: Commit and push**

```bash
git add packages/client/src/i18n/locales/
git commit -m "feat(tour): add tour chrome translations for all 5 locales"
git push origin main
```

---

## Task 18: Add per-app tour content (manifests + 5 locale files each)

For each of the 11 apps, the engineer adds a `tour` field to the manifest **and** corresponding `tour.title` / `tour.description` keys in each locale's existing app namespace.

> **Important:** every manifest gets a tour entry. App content for the illustrations is provided below — copy verbatim. Translations: provide English copy below; for tr/de/fr/it use the same English text as a placeholder unless the engineer is fluent and can translate. (Per project rules, all 5 locales must have keys — so the keys must exist even if they fall back to English copy.)

**Files (per app):**
- Modify: `packages/client/src/apps/<id>/manifest.ts`
- Modify: `packages/client/src/i18n/locales/{en,tr,de,fr,it}.json` — add to existing `<appNamespace>.tour.title` and `<appNamespace>.tour.description`

The list below uses an English-only copy table. The engineer must add the same keys (with the same English values) under tr/de/fr/it locale files unless they have human translations available. This is the same approach used by other recently-added Atlas features.

### 18.1 — CRM (`crm`)

**Manifest patch** — add to `packages/client/src/apps/crm/manifest.ts` inside the `crmManifest` object:

```typescript
tour: {
  variant: 'list',
  illustrationData: {
    rows: [
      { initials: 'JR', avatarColor: '#a78bfa', primary: 'James Rodriguez', secondary: 'Horizon Media Group', badge: { label: 'Active', tone: 'success' } },
      { initials: 'EC', avatarColor: '#10b981', primary: 'Emily Chen', secondary: 'CloudNine Solutions', badge: { label: 'Lead', tone: 'info' } },
      { initials: 'DK', avatarColor: '#f59e0b', primary: 'David Kim', secondary: 'Northwind Logistics', badge: { label: 'Prospect', tone: 'warning' } },
      { initials: 'SP', avatarColor: '#ef4444', primary: 'Sara Park', secondary: 'Pinecrest Studio', badge: { label: 'Cold', tone: 'danger' } },
    ],
    fadeFrom: 2,
    collaborator: { name: 'Maria', color: '#6366f1', targetRowIndex: 1 },
  },
},
```

**Locale keys** — add under existing `crm` namespace:

```json
"crm": {
  ...existing keys,
  "tour": {
    "title": "CRM",
    "description": "Your complete client database. Manage contacts, track opportunities through your pipeline, and log every interaction."
  }
}
```

### 18.2 — HR (`hr`)

```typescript
tour: {
  variant: 'activity',
  illustrationData: {
    contact: { initials: 'AS', avatarColor: '#10b981', name: 'Anna Schmidt', meta: 'Engineering · Senior Engineer', badge: { label: 'Active', tone: 'success' } },
    events: [
      { text: 'Promotion approved by manager', timestamp: 'just now', isLive: true },
      { text: 'PTO request — 5 days · approved', timestamp: '2h ago' },
      { text: 'Quarterly review submitted', timestamp: 'yesterday' },
      { text: 'Onboarding completed', timestamp: '14d ago' },
    ],
  },
},
```

```json
"hr": {
  ...,
  "tour": {
    "title": "HR",
    "description": "Manage employees, time off, performance reviews, and lifecycle events. Everything personnel-related in one timeline."
  }
}
```

### 18.3 — Projects/Tasks (`work`)

> Note: `work` covers Tasks + Projects per the manifest registry. Use kanban variant.

```typescript
tour: {
  variant: 'kanban',
  illustrationData: {
    columns: [
      { label: 'Backlog', count: 6, cards: [
        { primary: 'Audit homepage copy', secondary: 'Marketing' },
        { primary: 'Migrate logger', secondary: 'Platform' },
      ]},
      { label: 'In progress', count: 3, cards: [
        { primary: 'Q4 roadmap deck', secondary: 'Strategy' },
        { primary: 'Tour overlay', secondary: 'Engineering' },
      ]},
      { label: 'Done', count: 11, cards: [
        { primary: 'Launch invoice templates', secondary: 'Billing' },
      ]},
    ],
    draggedCard: {
      fromColumn: 0,
      toColumn: 1,
      primary: 'Refresh sidebar icons',
      secondary: 'Design',
      collaborator: { name: 'Tom', color: '#6366f1' },
    },
  },
},
```

```json
"work": {
  ...,
  "tour": {
    "title": "Tasks & Projects",
    "description": "Plan work in projects, track tasks across a kanban board, and watch teammates move things in real time."
  }
}
```

### 18.4 — Calendar (`calendar`)

```typescript
tour: {
  variant: 'activity',
  illustrationData: {
    contact: { initials: 'CW', avatarColor: '#f97316', name: 'Client workshop', meta: 'Today · 14:00 — 16:00 · Room 3', badge: { label: 'Today', tone: 'info' } },
    events: [
      { text: 'Maria added a Zoom link', timestamp: 'just now', isLive: true },
      { text: 'Reminder set · 30 min before', timestamp: '1h ago' },
      { text: '3 attendees confirmed', timestamp: 'yesterday' },
      { text: 'Event created from CRM lead', timestamp: '3d ago' },
    ],
  },
},
```

```json
"calendar": {
  ...,
  "tour": {
    "title": "Calendar",
    "description": "One unified calendar across people, projects, and CRM events. Every reminder, every attendee, in one place."
  }
}
```

### 18.5 — Sign (`sign`)

```typescript
tour: {
  variant: 'kanban',
  illustrationData: {
    columns: [
      { label: 'Drafting', count: 2, cards: [
        { primary: 'Vendor MSA', secondary: 'Legal · 12 pages' },
      ]},
      { label: 'Awaiting signature', count: 4, cards: [
        { primary: 'Q4 services contract', secondary: 'Sales · 2 signers' },
        { primary: 'NDA — Beacon Co.', secondary: 'Sales · 1 signer' },
      ]},
      { label: 'Signed', count: 18, cards: [
        { primary: 'Lease renewal', secondary: 'Operations' },
      ]},
    ],
    draggedCard: {
      fromColumn: 1,
      toColumn: 2,
      primary: 'Vendor SOW',
      secondary: 'Procurement',
      collaborator: { name: 'Alex', color: '#8b5cf6' },
    },
  },
},
```

```json
"sign": {
  ...,
  "tour": {
    "title": "Sign",
    "description": "Send agreements for signature, track signing stages, and see when each party signs. No external tools needed."
  }
}
```

### 18.6 — Invoices (`invoices`)

```typescript
tour: {
  variant: 'list',
  illustrationData: {
    rows: [
      { initials: 'HM', avatarColor: '#0ea5e9', primary: 'Horizon Media · INV-1042', secondary: '$4,200 · due in 7 days', badge: { label: 'Sent', tone: 'info' } },
      { initials: 'CN', avatarColor: '#10b981', primary: 'CloudNine · INV-1041', secondary: '$1,850 · paid', badge: { label: 'Paid', tone: 'success' } },
      { initials: 'NW', avatarColor: '#f59e0b', primary: 'Northwind · INV-1040', secondary: '$3,300 · 12 days late', badge: { label: 'Overdue', tone: 'danger' } },
      { initials: 'PS', avatarColor: '#ef4444', primary: 'Pinecrest · INV-1039', secondary: '$960 · draft', badge: { label: 'Draft', tone: 'neutral' } },
    ],
    fadeFrom: 2,
    collaborator: { name: 'Lina', color: '#0ea5e9', targetRowIndex: 0 },
  },
},
```

```json
"invoices": {
  ...,
  "tour": {
    "title": "Invoices",
    "description": "Send invoices, track payments and overdue balances, and chase late payers automatically."
  }
}
```

### 18.7 — Drive (`drive`)

```typescript
tour: {
  variant: 'list',
  illustrationData: {
    rows: [
      { initials: 'PD', avatarColor: '#0ea5e9', primary: 'Q4 Roadmap.pdf', secondary: 'updated 2 min ago · 2.4 MB' },
      { initials: 'XL', avatarColor: '#10b981', primary: 'Sales pipeline.xlsx', secondary: 'shared with Sales' },
      { initials: 'PN', avatarColor: '#f59e0b', primary: 'Brand assets.zip', secondary: '128 MB · folder' },
      { initials: 'DR', avatarColor: '#a78bfa', primary: 'Demo recordings/', secondary: '42 items' },
    ],
    fadeFrom: 2,
    collaborator: { name: 'Tom', color: '#6366f1', targetRowIndex: 0 },
  },
},
```

```json
"drive": {
  ...,
  "tour": {
    "title": "Drive",
    "description": "Centralize files, share with teammates, and keep version history. Used by every other Atlas app."
  }
}
```

### 18.8 — Write (`docs`)

```typescript
tour: {
  variant: 'activity',
  illustrationData: {
    contact: { initials: 'QR', avatarColor: '#c4856c', name: 'Q4 Roadmap', meta: 'Document · 8 collaborators', badge: { label: 'Live', tone: 'success' } },
    events: [
      { text: 'Maria edited "Goals"', timestamp: 'just now', isLive: true },
      { text: 'Tom added a comment on §3', timestamp: '4 min ago' },
      { text: 'Anna shared with Sales team', timestamp: 'yesterday' },
      { text: 'Document created from template', timestamp: '5d ago' },
    ],
  },
},
```

```json
"docs": {
  ...,
  "tour": {
    "title": "Write",
    "description": "Collaborative docs with rich formatting and comments. Every change tracked, every teammate visible."
  }
}
```

### 18.9 — Draw (`draw`)

```typescript
tour: {
  variant: 'list',
  illustrationData: {
    rows: [
      { initials: 'WB', avatarColor: '#e06c9f', primary: 'Onboarding flow', secondary: 'edited just now' },
      { initials: 'AR', avatarColor: '#a78bfa', primary: 'Architecture v2', secondary: '12 shapes · 3 collaborators' },
      { initials: 'WF', avatarColor: '#0ea5e9', primary: 'Wireframes — settings', secondary: 'shared with Design' },
      { initials: 'BR', avatarColor: '#f97316', primary: 'Brainstorm — Q4', secondary: '24 sticky notes' },
    ],
    fadeFrom: 2,
    collaborator: { name: 'Sam', color: '#e06c9f', targetRowIndex: 0 },
  },
},
```

```json
"draw": {
  ...,
  "tour": {
    "title": "Draw",
    "description": "Whiteboards and diagrams that live alongside everything else. Sketch flows, brainstorm, draw what you mean."
  }
}
```

### 18.10 — System (`system`)

```typescript
tour: {
  variant: 'list',
  illustrationData: {
    rows: [
      { initials: 'PM', avatarColor: '#13715B', primary: 'Permissions', secondary: 'Who can see what — per app' },
      { initials: 'BL', avatarColor: '#0ea5e9', primary: 'Billing', secondary: 'Plan · Atlas Team · 24 seats' },
      { initials: 'AU', avatarColor: '#f59e0b', primary: 'Audit log', secondary: '142 events this week' },
      { initials: 'IN', avatarColor: '#a78bfa', primary: 'Integrations', secondary: '6 connected services' },
    ],
    fadeFrom: 3,
  },
},
```

```json
"system": {
  ...,
  "tour": {
    "title": "System",
    "description": "Workspace settings — permissions, billing, audit log, integrations. The control room for your tenant."
  }
}
```

### 18.11 — Per-app commit cadence

After each app's manifest + locale changes:

- [ ] **Type-check**

```bash
cd packages/client && npm run build
```

- [ ] **Commit**

```bash
git add packages/client/src/apps/<id>/manifest.ts packages/client/src/i18n/locales/
git commit -m "feat(tour): add tour content for <app-name>"
git push origin main
```

(11 commits total for this task — one per app — to keep diffs small and reviewable.)

---

## Task 19: Wire `useTourBootstrap()` and `<TourOverlay />` into the home page; gate dock magnification; add `data-tour-target`

**Files:**
- Modify: `packages/client/src/pages/home.tsx`

This is the most invasive change in the plan because it threads the tour state through the dock-magnification logic. Read the file once before editing.

- [ ] **Step 1: Read the home page**

Read `packages/client/src/pages/home.tsx` in full. Identify:

1. The component function name (e.g., `HomePage`).
2. Where dock icons are rendered — there's a `.map()` over apps that produces buttons.
3. Where mouse-move handlers compute icon scale (the magnification logic).
4. Where `<DockPet />` is rendered.

- [ ] **Step 2: Add imports**

At the top of `home.tsx`, add:

```typescript
import { TourOverlay } from '../components/tour/tour-overlay';
import { useTourBootstrap } from '../components/tour/use-tour-bootstrap';
import { useTour } from '../components/tour/use-tour';
```

- [ ] **Step 3: Call the bootstrap hook inside the component**

Inside the home page component function (e.g., `HomePage`), after the existing hook calls (`useNavigate`, `useTaskCounts`, etc.), add:

```typescript
useTourBootstrap();
const tourIsOpen = useTour((s) => s.isOpen);
```

- [ ] **Step 4: Add `data-tour-target` to dock buttons**

Find the dock-icon button in the dock-rendering JSX (it'll be a `<button>` or `<a>` inside the dock map). Add the attribute:

```tsx
<button
  ...
  data-tour-target={app.id}
  ...
>
```

If the dock renders something other than a button at the top of each item (e.g., a wrapping `<li>`), put the attribute on the outermost element so `getBoundingClientRect()` covers the visible icon area.

- [ ] **Step 5: Gate dock magnification on tour state**

Find the mouse-move handler (or the function that returns scale per icon, often something like `iconScale(distance)`). Wrap the magnification logic so it returns `1` (no scaling) when `tourIsOpen` is true.

Two common shapes; apply whichever matches:

**If it's a function returning a scale:**
```typescript
function iconScale(distance: number): number {
  if (tourIsOpen) return 1;
  // existing logic
}
```

**If it's an inline mouse-move state setter:**
```typescript
const handleMouseMove = (e: ReactMouseEvent) => {
  if (tourIsOpen) {
    setHoveredIndex(null);
    return;
  }
  // existing logic
};
```

The exact change depends on the file's current structure. The goal: when `tourIsOpen === true`, dock icons render at their idle, non-magnified size and stay there — so the `getBoundingClientRect()` rect doesn't change as the user hovers across the dock during the tour.

- [ ] **Step 6: Hide the dock-pet during the tour**

Find the `<DockPet ... />` rendering. Wrap it:

```tsx
{!tourIsOpen && <DockPet ... />}
```

- [ ] **Step 7: Mount `<TourOverlay />` at the end of the component's returned JSX**

Just before the final closing tag of the home page's root element, add:

```tsx
<TourOverlay />
```

- [ ] **Step 8: Type-check**

```bash
cd packages/client && npm run build
```

Expected: build succeeds.

- [ ] **Step 9: Manual smoke test**

```bash
lsof -ti:5180,3001 | xargs kill -9 2>/dev/null || true
cd packages/server && npm run dev &
sleep 3
cd packages/client && npm run dev &
sleep 5
```

In your browser at `http://localhost:5180`:

1. **Reset the tour state:**
   ```bash
   docker compose exec -T postgres psql -U postgres -d atlas -c "UPDATE tenant_members SET tour_completed_at = NULL"
   ```
2. Reload the home page. Within ~150ms of paint, the tour should drop in: dim backdrop, spotlight halo on the first dock icon, modal above with copy.
3. Hover the dock with the tour open: **icons must not magnify**. The active icon stays anchored in place.
4. Click "Next" — modal slides to the next app's icon, copy updates.
5. Hover the spotlight area — dock-pet is gone.
6. Press Esc — overlay closes; dock magnification resumes on hover.
7. Reload the page — tour does **not** reappear (`tourCompletedAt` is now set).
8. Reset and try again with the user-menu replay (will be wired in the next task).

If the position math is off (modal off-screen, caret not pointing at the icon), inspect the DOM in DevTools — confirm the `data-tour-target="<id>"` attribute is on the right element and that `getBoundingClientRect()` returns sensible numbers.

- [ ] **Step 10: Commit and push**

```bash
git add packages/client/src/pages/home.tsx
git commit -m "feat(tour): wire tour overlay and bootstrap into home page"
git push origin main
```

---

## Task 20: Add "Take the tour" entry to user menu

**Files:**
- Modify: the user-menu rendering in `packages/client/src/pages/home.tsx` (or wherever the user-menu popover lives)

- [ ] **Step 1: Locate the user menu**

```bash
grep -n "LogOut\|Settings.*useState\|user.menu\|UserMenu\|user-menu" /Users/gorkemcetin/atlasmail/packages/client/src/pages/home.tsx | head -10
```

The home page already imports `LogOut` and `Settings` from `lucide-react` — there's an existing menu near the bottom of the file. If the menu lives in a separate component, follow the import to that file.

- [ ] **Step 2: Add the menu item**

Add a menu item between "Settings" and "Log out" (or in whatever spot matches existing menu UX):

```tsx
import { Sparkles } from 'lucide-react';
import { replayTour } from '../components/tour/use-tour-bootstrap';

// inside the menu JSX:
<button
  type="button"
  className="<existing menu-item class>"
  onClick={() => {
    replayTour();
    closeMenu();  // whatever the existing menu close handler is named
  }}
>
  <Sparkles size={14} />
  <span>{t('tour.menuReplay')}</span>
</button>
```

If the existing menu uses `<MenuItem>` or another shared component, use it instead of a raw button — match the surrounding pattern.

- [ ] **Step 3: Type-check**

```bash
cd packages/client && npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Manual smoke test**

With the dev server running and the user logged in:

1. Open the user menu → click "Take the tour".
2. Tour should fire regardless of `tourCompletedAt`.
3. Skip it; try again — still works (idempotent).

- [ ] **Step 5: Commit and push**

```bash
git add packages/client/src/pages/home.tsx
git commit -m "feat(tour): add 'Take the tour' entry to user menu"
git push origin main
```

---

## Task 21: Full manual test pass

This is a single task with multiple checks. Each check is a discrete step.

- [ ] **Step 1: Reset and run the dev stack**

```bash
docker compose exec -T postgres psql -U postgres -d atlas -c "UPDATE tenant_members SET tour_completed_at = NULL"
lsof -ti:5180,3001 | xargs kill -9 2>/dev/null || true
cd packages/server && npm run dev &
sleep 3
cd packages/client && npm run dev &
sleep 5
```

- [ ] **Step 2: First-login fire**

Reload `http://localhost:5180`. Tour appears, dock magnification frozen, modal above first accessible app. ✓

- [ ] **Step 3: Filtered apps**

In a second browser (or incognito), log in as a member who only has CRM + Tasks enabled. Tour should be 2 steps. ✓

- [ ] **Step 4: Empty case**

Temporarily comment out the `tour:` field in **every** manifest. Reset `tour_completed_at`. Reload. No overlay should appear. Restore the manifests. ✓

- [ ] **Step 5: Skip paths (Esc / × / click-outside / Skip button)**

Each one must close the overlay AND set `tour_completed_at`. After each, verify with:

```bash
docker compose exec -T postgres psql -U postgres -d atlas -c "SELECT tour_completed_at FROM tenant_members WHERE user_id = (SELECT id FROM users WHERE email = '<your-email>')"
```

Reset between tries with the UPDATE NULL command. ✓

- [ ] **Step 6: Replay**

User menu → "Take the tour" → tour fires; complete it; verify `tour_completed_at` is **unchanged** (idempotent). ✓

- [ ] **Step 7: Edge positioning**

With a wide window, navigate through every step. Modal should slide inward at left/right edges. Caret should always point at the icon center. ✓

- [ ] **Step 8: Resize**

Open the tour, then drag the window narrower / wider. Modal and spotlight should reposition smoothly. ✓

- [ ] **Step 9: Multi-tenant**

In a tenant where the user has tour completed, verify tour doesn't fire. Switch active tenant (or create a second tenant) — tour fires for the new tenant. ✓

- [ ] **Step 10: Locales**

Switch language to TR/DE/FR/IT in settings. Replay the tour. Modal chrome and per-app titles update. ✓

- [ ] **Step 11: Network failure**

In Chrome DevTools, set network to "Offline". Click "Skip". Modal should still close locally. Re-enable network. Reload. Because the local cache was set on `onSettled`, the tour should not re-fire in this session. (On next login the tour will re-fire because the server timestamp wasn't set — acceptable.) ✓

- [ ] **Step 12: Build & format gates**

```bash
cd packages/server && npm run build
cd packages/client && npm run build
cd packages/server && npm run format-check
cd packages/client && npm run format-check
```

If any format-check fails:

```bash
cd packages/<dir> && npm run format
git add -A && git commit -m "chore(tour): format" && git push origin main
```

- [ ] **Step 13: Commit final state**

If any cleanup commits are needed (formatting, missed translations, etc.), make them now. The branch should be ready to ship.

```bash
git status
git log --oneline -20
```

---

## Self-review (run before declaring complete)

After all tasks complete, re-read the spec at `docs/superpowers/specs/2026-04-25-product-tour-design.md` and verify:

1. Auto-fire on first login — Task 19 ✓
2. Replay from user menu — Task 20 ✓
3. Filter by accessible apps — Task 16 (`useTourBootstrap`) ✓
4. Per-app manifest source — Tasks 6 + 18 ✓
5. Three illustration variants + custom — Tasks 9, 10, 11, 12 ✓
6. `tenantMembers.tourCompletedAt` per-tenant-per-user — Task 1 ✓
7. Skip = done forever; idempotent — Tasks 2, 15 (PATCH endpoint with COALESCE + cache update) ✓
8. Modal above icon, caret tracks, edge clamp — Task 8 ✓
9. Dock magnification suspended — Task 19 ✓
10. All 5 locales — Tasks 17, 18 ✓
11. Existing users see tour on next login (column lands as null) — Task 1 ✓

If any item is missing, add a follow-up task before declaring complete.

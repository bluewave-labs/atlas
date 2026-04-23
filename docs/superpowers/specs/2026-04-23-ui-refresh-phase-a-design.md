# UI Refresh — Phase A: Tokens & Typography

**Date:** 2026-04-23
**Scope:** Phase A of a 3-phase refresh. Token + typography pass only. No shell restructure, no table conversions.
**Ships as:** one PR, one version bump.

## Why

Current UI reads slightly dull and heavy in places the user asked to fix:
- Dull `#5A7FA0` used as link, info, unread indicator, category-important, calendar-event default.
- Form-control borders sit on `#dce0e6` over `#eef0f3` tertiary fill — muted, low-lift.
- DataTable headers use `var(--font-size-xs)` (12px) at `--font-weight-semibold` (620) in `--color-text-tertiary` — reads dark and thick.
- Several files hardcode hex (`#6b7280`, `#111318`, `#ef4444`, `#000000`) instead of tokens, so any token change leaves visual drift.

The agreed direction is Sample 1 (Linear-inspired) from `/tmp/atlas-design-samples/`. This spec translates that sample's tokens onto the real Atlas variable names.

## Non-goals (deferred, not forgotten)

- **Phase B** — app rail structural change (thin monochrome icon rail on every app page, colored dockbar only on Home, per-app brand colors removed from in-app content).
- **Phase C** — convert 11 non-canonical tables to `DataTable`. Audit already written; punch-list attached to the spec as an appendix so it isn't lost.

Both are explicit follow-ups. The user asked to be reminded about Phase C.

## What changes

### 1. Light-mode tokens (`packages/client/src/styles/theme.css`)

| Token | Current | New | Why |
|-------|---------|-----|-----|
| `--color-bg-primary` | `#ffffff` | `#ffffff` | keep |
| `--color-bg-secondary` | `#f8f9fb` | `#fafafa` | warmer page background, closer to Linear |
| `--color-bg-tertiary` | `#eef0f3` | `#f7f7f8` | inputs sit on lighter fill (was the "dull gray" input background) |
| `--color-bg-elevated` | `#ffffff` | `#ffffff` | keep |
| `--color-surface-hover` | `#ebedf1` | `#f1f1f2` | quieter neutral |
| `--color-surface-active` | `#e2e5ea` | `#ebecee` | quieter neutral |
| `--color-surface-selected` | `#ebedf1` | `#f0f1fd` | faint accent tint so selection reads |
| `--color-text-primary` | `#111318` | `#1c1e21` | slightly softer near-black |
| `--color-text-secondary` | `#3b4253` | `#4d525c` | warmer |
| `--color-text-tertiary` | `#5f6b7a` | `#7e838e` | brighter for placeholders and meta text |
| `--color-text-link` | **`#5a7fa0`** | **`#5e6ad2`** | kill the dull blue; use accent |
| `--color-border-primary` | `#dce0e6` | `#e6e7ea` | lighter hairline |
| `--color-border-secondary` | `#ebedf1` | `#ebedf1` | keep |
| `--color-border-focus` | `#7a9ab8` | `#5e6ad2` | focus matches accent |
| `--color-accent-primary` | `#5e6ad2` | `#5e6ad2` | keep (brand continuity) |
| `--color-info` | **`#5a7fa0`** | **`#3b82f6`** | brighter info blue |
| `--color-unread-indicator` | **`#5a7fa0`** | **`#5e6ad2`** | accent-aligned |
| `--color-category-important` | **`#5a7fa0`** | **`#5e6ad2`** | accent-aligned |
| `--color-error` | `#ec4899` | `#e5484d` | pink → red; reads as error everywhere else in the mock |
| `--sidebar-bg` | `#FBFAFB` | `#fbfbfc` | align to new neutral scale |
| `--sidebar-hover` | `#F5F5F6` | `#f1f1f2` | match `--color-surface-hover` |
| `--sidebar-active` | `#F0F0F1` | `#f0f1fd` | match `--color-surface-selected` |

### 2. Dark-mode tokens

| Token | Current | New | Why |
|-------|---------|-----|-----|
| `--color-bg-primary` | `#101114` | `#0f1012` | slight warm shift |
| `--color-bg-secondary` | `#181a1e` | `#17181b` | matches panel in sample |
| `--color-bg-tertiary` | `#282c35` | `#1c1d20` | inputs feel slightly inset, not lighter than panel |
| `--color-bg-elevated` | `#252830` | `#17181b` | panels match sample |
| `--color-surface-hover` | `#2e323c` | `#23242a` | |
| `--color-surface-selected` | `#262a33` | `#24253a` | accent-tinted selection |
| `--color-text-primary` | `#f0f1f4` | `#edeef2` | |
| `--color-text-secondary` | `#adb4c2` | `#b8bcc5` | |
| `--color-text-tertiary` | `#8e96a8` | `#858994` | |
| `--color-text-link` | **`#7a9ab8`** | **`#8b94ea`** | kill dull blue; lifted accent |
| `--color-border-primary` | `#333842` | `#26272c` | quieter hairline |
| `--color-border-secondary` | `#282b34` | `#36383f` | |
| `--color-border-focus` | `#7a9ab8` | `#8b94ea` | matches accent |
| `--color-accent-primary` | `#7b87e3` | `#8b94ea` | slightly more luminous |
| `--color-info` | **`#7a9ab8`** | **`#60a5fa`** | brighter info blue |
| `--color-unread-indicator` | **`#7a9ab8`** | **`#8b94ea`** | accent-aligned |
| `--color-category-important` | **`#7a9ab8`** | **`#8b94ea`** | accent-aligned |
| `--sidebar-bg` | `#181a1e` | `#131418` | |

### 3. Typography adjustments (theme.css)

| Token | Current | New |
|-------|---------|-----|
| `--font-size-xs` | `12px` | `11px` (for uppercase section labels and table headers) |
| `--font-weight-medium` | `520` | `500` (closer to Inter's real medium; 520 was off-axis) |
| `--font-weight-semibold` | `620` | `600` (same reason) |
| `--font-weight-bold` | `720` | `700` |

`--font-weight-normal` stays at `420` — that's intentional for Geist body text.

### 4. Focus-ring standard

Add a shared token:
```css
--focus-ring: 0 0 0 3px color-mix(in srgb, var(--color-accent-primary) 18%, transparent);
```

Apply in `Input`, `Select`, `Textarea`, and `Button` on `:focus-visible`. Today they use `border-color: var(--color-border-focus)` alone with no halo.

### 5. DataTable header (`packages/client/src/components/ui/column-header.tsx`)

Change header cell style:
- `font-size: 11px` (was 12px via `--font-size-xs`)
- `font-weight: 500` (was 620)
- `text-transform: uppercase`
- `letter-spacing: 0.05em`
- `color: var(--color-text-tertiary)` — idle
- `color: var(--color-text-primary)` when sorted

No background fill (Linear-style hairline look). The existing `.dt-header` `border-bottom: 1px solid var(--color-border-secondary)` stays.

### 6. Segmented controls (no shared component — grep first)

There is no shared `Segmented` in `components/ui/`; segmented groups are inlined per page. Grep for them (`grep -r "segmented" packages/client/src/apps`), and at each site verify the active state reads in dark mode. If any inline segmented uses a hardcoded background for its active tab, replace with `var(--color-accent-subtle)` + `color: var(--color-accent-primary)` so dark mode distinguishes the active chip. Skip if it already uses tokens.

### 7. Button primary shadow

Add `box-shadow: 0 1px 2px color-mix(in srgb, var(--color-accent-primary) 25%, transparent);` to `.btn-primary` (or equivalent). Gives the subtle lift in the sample. Keep it small — we're not Stripe.

### 8. Inline-hex fixes (files flagged by audit)

Replace hardcoded hex with tokens:

| File | Hex | Token |
|------|-----|-------|
| `packages/client/src/apps/crm/components/lead-forms-view.tsx` | `#111318` | `var(--color-text-primary)` |
| `packages/client/src/apps/crm/components/lead-forms-view.tsx` | `#ef4444` | `var(--color-error)` |
| `packages/client/src/apps/crm/components/lead-forms-view.tsx` | `#13715B` | **leave** — brand accent override is intentional |
| `packages/client/src/apps/sign/components/signature-modal.tsx` | `#000000` canvas fill | leave — canvas ink is literal black by design; confirm with user if unsure |
| `packages/client/src/apps/docs/components/editor/bubble-toolbar.tsx` | `#6b7280` color picker swatch | leave — it's a user-facing color choice, not chrome |
| Any inline `#6b7280` used for chrome (icon color, placeholder) | → `var(--color-text-tertiary)` | audit and swap case by case |

The signature-canvas ink and the bubble-toolbar color-picker swatch are **user-visible color values**, not UI chrome — those stay literal.

### 9. Legacy email-themed tokens (scope note)

`--email-list-*` tokens, `color-category-newsletters`, `color-category-notifications`, `color-star` — these are leftovers from before the product was renamed to Atlas (no email app exists). **Leave them alone** in Phase A. Cleanup belongs to a separate housekeeping PR.

## What stays exactly the same

- All component APIs, props, compound structures.
- Dockbar / home-page launcher visuals (Phase B territory).
- Per-app brand colors in content (dept chips, avatar fills, activity feed) — Phase B removes these.
- All spacing tokens.
- All radius tokens.
- Geist + JetBrains Mono font stack.
- `data-density` overrides.

## Test plan

After tokens land, run both server and client, then walk these pages in **light and dark**:

1. **Home** — home page, app tiles, recent items.
2. **CRM** — dashboard, deals/contacts/leads list (uses DataTable), proposal detail (line items), CSV import modal.
3. **HRM** — dashboard, employee list, leave requests.
4. **Invoices** — dashboard, invoice list (DataTable), recurring invoices, invoice detail, PDF preview.
5. **Sign** — document list, signing flow, template editor.
6. **Projects** — kanban, list view, timeline.
7. **Drive** — file grid, preview panels (CSV preview and spreadsheet preview — these are non-canonical tables; they'll look updated but structurally unchanged).
8. **Tasks** — list + board.
9. **Write / Draw** — quick sanity pass; editor chrome is embedded, mostly unaffected.
10. **System admin** — tenants, all users, permissions (non-canonical tables still here).
11. **Settings** — every panel, focus-ring behavior, toggle/checkbox states.

Specific checks:
- Every `<input>` / `<select>` / `<textarea>` renders the new 3px accent focus ring.
- Every DataTable header is 11px / 500 / uppercase / muted.
- No remaining `#5a7fa0` hits in rendered CSS (DevTools → Computed → grep).
- Placeholder text readable, not invisible, in both modes.
- Success / warning / error badges legible in dark mode.
- Form controls at `size="sm"` (28px) align on data-view rows with buttons — size rule in CLAUDE.md still holds.

## Rollback

Phase A is token-only plus ~5 component file edits. If anything looks wrong post-ship, `git revert` the PR; no schema or behavior changes to unwind.

## Phase B reminder (for later)

Bake a thin 56px icon-only rail as the primary nav on every app page. Colored dockbar moves to Home only. Remove per-app brand colors from in-app content (dept chips, avatars, category dots → monochrome/tokens). New shell component, layout restructure in `app-shell.tsx` (or equivalent). Medium risk — layout changes ripple.

## Files touched (expected diff footprint)

**Definite:**
- `packages/client/src/styles/theme.css` — token swaps (both light and dark blocks)
- `packages/client/src/components/ui/column-header.tsx` — table header typography
- `packages/client/src/components/ui/input.tsx` — focus ring
- `packages/client/src/components/ui/select.tsx` — focus ring
- `packages/client/src/components/ui/textarea.tsx` — focus ring
- `packages/client/src/components/ui/button.tsx` — primary shadow
- `packages/client/src/apps/crm/components/lead-forms-view.tsx` — hex → tokens

**Conditional (touch only if hardcoded hex / non-token active states found on walk-through):**
- Per-app segmented-group active states (inline in various pages)
- Dashboard/chart files that use literal `#3b82f6`, `#8b5cf6` inline — leave series colors alone (charts are user-facing color values, like the sig-canvas rule)

No changes to server code, DB schema, or app manifests. No new components, no new routes.

## Phase C reminder (for later, user explicitly asked to be reminded)

11 non-canonical table candidates from the audit, ranked by visibility × effort:

**High-value, trivial-to-moderate**:
1. `apps/system/components/all-users-view.tsx` — admin, 7 cols, raw HTML
2. `apps/system/components/tenants-view.tsx` (main) — admin, 8 cols, raw HTML
3. `apps/crm/components/dashboard.tsx` — "Closing soon" + "Top deals" tables
4. `apps/crm/components/proposals-list-view.tsx` — main CRM list view
5. `apps/invoices/components/invoices-dashboard.tsx` — sales/receipts/dues KPI

**Medium / lower priority**:
6. `apps/crm/components/csv-import-modal.tsx` — modal-only preview
7. `apps/crm/components/proposal-detail-panel.tsx` — read-only line items
8. `apps/invoices/components/import-time-entries-modal.tsx` — has inline selection
9. `apps/system/components/tenants-view.tsx` (members) — modal-only
10. `apps/drive/components/drive-preview-panel.tsx` — CSV preview + sheet preview

**Tricky — may not fit DataTable API**:
11. `apps/system/components/permissions-view.tsx` — matrix with inline Select per cell (needs editable-cell support or custom component)

`components/shared/line-items-editor.tsx` is editable and specialized — keep as-is unless DataTable grows editable-cell support.

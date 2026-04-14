# ContentArea Universal Page Template Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `<ContentArea>` the universal right-side template used by every app page (except Draw), with a single place to enforce shell layout, header frame, and dock-bottom reserve.

**Architecture:** Extend `<ContentArea>` with one new optional prop — `headerSlot` — that replaces the default title/breadcrumbs/actions contents while keeping the 44px header frame and border. Apps with custom toolbars (Drive, Docs, Calendar) pass their existing toolbar JSX via `headerSlot`. Apps without custom toolbars (System, org-layout) migrate to the default title+actions shape. Draw stays exempt because its Excalidraw canvas has no app-level header. All per-app `padding-bottom: var(--global-dock-offset)` patches move into `ContentArea` as the single source of truth.

**Tech Stack:** React + TypeScript, react-i18next, existing `ContentArea` component at `packages/client/src/components/ui/content-area.tsx`. No new dependencies.

---

## File Structure

**Modified:**
- `packages/client/src/components/ui/content-area.tsx` — add `headerSlot` prop
- `packages/client/src/apps/drive/page.tsx` — wrap drive-toolbar in ContentArea
- `packages/client/src/apps/docs/page.tsx` — wrap TopBar + SmartButtonBar in ContentArea
- `packages/client/src/apps/system/page.tsx` — use ContentArea default shape
- `packages/client/src/pages/calendar.tsx` — wrap calendar toolbar in ContentArea
- `packages/client/src/pages/org/org-layout.tsx` — migrate custom header to ContentArea
- `packages/client/src/apps/draw/page.tsx` — remove per-app dock-reserve padding, add exemption comment
- `packages/client/src/apps/docs/page.tsx` — remove per-app dock-reserve padding (migrated into ContentArea)
- `packages/client/src/styles/drive.css` — remove `.drive-main` padding-bottom
- `packages/client/src/styles/drive.css` — drive-toolbar becomes a pure inner toolbar (no longer the top frame)
- `CLAUDE.md` — document the "every page uses ContentArea" rule

**Not touched (already use ContentArea correctly):**
- CRM, HR, Invoices, Projects, Sign, Tasks pages

**Exempted (documented):**
- Draw (full-bleed canvas, no app header)
- Home page (dashboard, no sidebar — out of scope per user decision)

---

## Task 1: Extend ContentArea with headerSlot prop

**Files:**
- Modify: `packages/client/src/components/ui/content-area.tsx`

- [ ] **Step 1: Read the current ContentArea to confirm exact state**

Run: Read `packages/client/src/components/ui/content-area.tsx`. Confirm the current shape is `ContentAreaProps = { title, breadcrumbs?, actions?, children }` and that the content div already has `paddingBottom: 'var(--global-dock-offset, 0px)'`.

- [ ] **Step 2: Replace the entire file with the extended version**

Replace the file at `packages/client/src/components/ui/content-area.tsx` with:

```tsx
import { type ReactNode, type CSSProperties } from 'react';
import { ChevronRight } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

interface ContentAreaProps {
  /**
   * Page/app title displayed in the default header.
   * Required when `headerSlot` is not provided.
   */
  title?: string;
  /** Optional breadcrumb trail (replaces title when provided). Ignored when `headerSlot` is set. */
  breadcrumbs?: BreadcrumbItem[];
  /** Right-side header actions (buttons, etc.). Ignored when `headerSlot` is set. */
  actions?: ReactNode;
  /**
   * When provided, replaces the default title/breadcrumbs/actions layout inside the 44px
   * header frame. Use this for apps with custom toolbars (Drive, Docs, Calendar).
   * The header frame (height, border, flex-shrink) is still owned by ContentArea.
   */
  headerSlot?: ReactNode;
  /** Content below the header */
  children: ReactNode;
}

export function ContentArea({ title, breadcrumbs, actions, headerSlot, children }: ContentAreaProps) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minWidth: 0,
      }}
    >
      {/* Header frame — owned by ContentArea; contents are either default or headerSlot */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
          padding: headerSlot ? 0 : 'var(--spacing-sm) var(--spacing-lg)',
          borderBottom: '1px solid var(--color-border-secondary)',
          flexShrink: 0,
          minHeight: 44,
        }}
      >
        {headerSlot ? (
          headerSlot
        ) : breadcrumbs ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', minWidth: 0 }}>
              {breadcrumbs.map((item, index) => {
                const isLast = index === breadcrumbs.length - 1;
                return (
                  <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', minWidth: 0 }}>
                    {index > 0 && (
                      <ChevronRight
                        size={12}
                        style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }}
                      />
                    )}
                    {isLast ? (
                      <span
                        style={{
                          fontSize: 'var(--font-size-sm)',
                          fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
                          color: 'var(--color-text-primary)',
                          fontFamily: 'var(--font-family)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.label}
                      </span>
                    ) : (
                      <button
                        onClick={item.onClick}
                        style={{
                          fontSize: 'var(--font-size-sm)',
                          color: 'var(--color-text-tertiary)',
                          fontFamily: 'var(--font-family)',
                          background: 'none',
                          border: 'none',
                          cursor: item.onClick ? 'pointer' : 'default',
                          padding: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.label}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ flex: 1 }} />
            {actions}
          </>
        ) : (
          <>
            <span
              style={{
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-normal)' as CSSProperties['fontWeight'],
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-family)',
              }}
            >
              {title ?? ''}
            </span>
            <div style={{ flex: 1 }} />
            {actions}
          </>
        )}
      </div>

      {/* Content — owns dock-bottom reserve */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
          paddingBottom: 'var(--global-dock-offset, 0px)',
        }}
      >
        {children}
      </div>
    </div>
  );
}
```

Key changes vs. current:
1. `title` is now optional (required only if no `headerSlot` or `breadcrumbs`).
2. New `headerSlot` prop replaces the default header contents.
3. Header uses `minHeight: 44` instead of fixed `height: 44` so custom slots with wrapping rows still work.
4. Header padding is removed when `headerSlot` is used (slot controls its own padding).
5. Root gets `minWidth: 0` so it shrinks correctly inside flex rows.

- [ ] **Step 3: Run TypeScript check**

Run: `cd packages/client && npx tsc --noEmit`
Expected: PASS with no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/components/ui/content-area.tsx
git commit -m "feat(ui): add headerSlot prop to ContentArea for custom toolbars"
```

---

## Task 2: Migrate System page to ContentArea default shape

**Files:**
- Modify: `packages/client/src/apps/system/page.tsx`

System currently has no header at all — just a `padding: 24` scrollable div. Migration gives it a standard title header (improvement, not regression). The scroll container becomes an inner `flex: 1; overflow: auto; padding: 24` div inside ContentArea's children.

- [ ] **Step 1: Read the current page section**

Run: Read `packages/client/src/apps/system/page.tsx` lines 1-40 to see imports, and lines 175-240 to see the render.

- [ ] **Step 2: Add ContentArea import**

Find the imports block at the top (near line 7 where `AppSidebar` is imported) and add `ContentArea`:

```tsx
import { ContentArea } from '../../components/ui/content-area';
```

Place it next to other `components/ui/*` imports.

- [ ] **Step 3: Replace the right-side div with ContentArea**

Replace lines 225–end-of-right-side-div (the `<div style={{ flex: 1, overflow: 'auto', padding: 24, paddingBottom: 'calc(24px + var(--global-dock-offset, 0px))' }}>` block) with:

```tsx
      <ContentArea title={t('system.title')}>
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          {/* existing children — overview/email/permissions views — move here unchanged */}
        </div>
      </ContentArea>
```

Concretely: keep all the existing `{activeView === 'overview' && ...}`, `{activeView === 'email' && ...}`, `{activeView === 'permissions' && ...}` blocks as children of the inner scroll div. Only the outer wrapper changes from a raw `<div>` to `<ContentArea>` with an inner scroll `<div>`.

Note: the `calc(24px + var(--global-dock-offset, 0px))` bottom padding is removed — ContentArea now owns dock-reserve.

- [ ] **Step 4: TypeScript check**

Run: `cd packages/client && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Manual smoke test**

Run: `cd packages/client && npm run dev` (or rely on already-running dev server at http://localhost:5180). Navigate to `/system`. Verify:
- Page header shows "System" (or translated equivalent) at the top.
- Overview/email/permissions views render below.
- Sidebar still full-height; dock floats over its bottom.
- Content scroll area doesn't hide content under the dock.

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/apps/system/page.tsx
git commit -m "refactor(system): use ContentArea as page template"
```

---

## Task 3: Migrate Drive page — wrap drive-toolbar in ContentArea headerSlot

**Files:**
- Modify: `packages/client/src/apps/drive/page.tsx`
- Modify: `packages/client/src/styles/drive.css`

Drive has two blocks that logically form its "header": an optional upload-progress row and the `.drive-toolbar` row. Both go into `headerSlot`. The `.drive-content` stays as the children.

- [ ] **Step 1: Read the current structure**

Run: Read `packages/client/src/apps/drive/page.tsx` lines 125–205 to map the main-content block.

- [ ] **Step 2: Add ContentArea import**

Find the imports block at the top of `drive/page.tsx` and add:

```tsx
import { ContentArea } from '../../components/ui/content-area';
```

- [ ] **Step 3: Replace `<div className="drive-main">` with ContentArea**

Replace the block starting at `<div className="drive-main" ...>` and ending at its matching `</div>` (immediately before `{/* Preview panel */}`) with:

```tsx
      {/* Main content */}
      <ContentArea
        headerSlot={
          <div className="drive-main-header">
            {d.uploadProgress && (
              <div className="drive-upload-progress">
                <div className="drive-upload-progress-info"><span>{t('drive.actions.uploading')}</span><span>{Math.round((d.uploadProgress.loaded / d.uploadProgress.total) * 100)}%</span></div>
                <div className="drive-upload-progress-bar"><div className="drive-upload-progress-fill" style={{ width: `${Math.round((d.uploadProgress.loaded / d.uploadProgress.total) * 100)}%` }} /></div>
              </div>
            )}
            <div className="drive-toolbar">
              {/* existing drive-toolbar-left and drive-toolbar-right blocks, unchanged */}
            </div>
          </div>
        }
      >
        <div className="drive-content" onDragEnter={d.handleDragEnter} onDragLeave={d.handleDragLeave} onDragOver={d.handleDragOver} onDrop={d.handleDrop} onClick={() => { if (!d.hasSelection) d.setSelectedIds(new Set()); d.setContextMenu(null); }}>
          {/* existing drive-content children (dropzone overlay, empty states, list/grid views) — unchanged */}
        </div>
      </ContentArea>
```

Important:
- Copy the exact contents of the current `drive-toolbar` and `drive-content` blocks into the new locations verbatim.
- The `flex: d.previewItem ? undefined : 1` inline style on the old `<div className="drive-main">` is no longer needed — ContentArea applies `flex: 1`. When the preview panel is open, Drive's layout is `AppSidebar + ContentArea + DrivePreviewPanel` in a flex row, and ContentArea with `flex: 1` plus the preview panel's fixed width is the correct shrinking behavior.

- [ ] **Step 4: Update drive.css to remove obsolete main styling**

Open `packages/client/src/styles/drive.css`. Find:

```css
.drive-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  padding-bottom: var(--global-dock-offset, 0px);
}
```

Replace with:

```css
.drive-main-header {
  display: flex;
  flex-direction: column;
  width: 100%;
}
```

Rationale: the old `.drive-main` class is no longer used (ContentArea provides its own outer flex column and dock-reserve). The new `.drive-main-header` is just a thin wrapper so upload-progress stacks above the toolbar inside the header frame.

- [ ] **Step 5: Verify drive-toolbar styles still apply**

Grep `packages/client/src/styles/drive.css` for `.drive-toolbar` and confirm the rule uses only the class name (not `.drive-main .drive-toolbar`), so it still matches when the toolbar lives inside `.drive-main-header` instead of `.drive-main`.

Run: `grep -n "\.drive-toolbar" packages/client/src/styles/drive.css`
Expected: rules start with `.drive-toolbar {` (no descendant combinator). If any rule starts with `.drive-main .drive-toolbar`, change `.drive-main` to `.drive-main-header` in that rule.

- [ ] **Step 6: TypeScript check**

Run: `cd packages/client && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Manual smoke test**

Navigate to `/drive`. Verify:
- Toolbar (breadcrumbs + filter dropdowns + search + view toggle) renders at the top inside the standard header frame.
- Upload progress (trigger by dragging a file in) stacks above the toolbar.
- File grid/list scrolls beneath; last row not hidden by dock.
- Preview panel opens on the right without layout glitch.
- Drive folder navigation (`/drive/folder/:id`) works.

- [ ] **Step 8: Commit**

```bash
git add packages/client/src/apps/drive/page.tsx packages/client/src/styles/drive.css
git commit -m "refactor(drive): migrate to ContentArea with headerSlot"
```

---

## Task 4: Migrate Docs (Write) page — use ContentArea with TopBar in headerSlot

**Files:**
- Modify: `packages/client/src/apps/docs/page.tsx`

Docs has a `<TopBar>` component (its own header with doc title, save state, share, etc.) followed by a `<SmartButtonBar>` and the editor area. `TopBar` + `SmartButtonBar` go into the header slot; the editor area becomes children.

- [ ] **Step 1: Read the current structure**

Run: Read `packages/client/src/apps/docs/page.tsx` lines 220–310.

- [ ] **Step 2: Add ContentArea import**

At the top of `docs/page.tsx`, add:

```tsx
import { ContentArea } from '../../components/ui/content-area';
```

- [ ] **Step 3: Replace the right-side column div with ContentArea**

Replace the block starting at `<div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', paddingBottom: 'var(--global-dock-offset, 0px)' }}>` (currently at line 240) and ending at its matching `</div>` (immediately before `{/* Version history panel */}`) with:

```tsx
      <ContentArea
        headerSlot={
          doc && !showTemplates ? (
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
              <TopBar
                doc={doc}
                breadcrumbs={breadcrumbs}
                isSaving={isSaving}
                onNavigate={handleSelect}
                onShowVersionHistory={() => setShowVersionHistory(true)}
                onOpenSettings={() => openSettings('documents')}
                showComments={showComments}
                onToggleComments={() => setShowComments(!showComments)}
                visibility={(doc.visibility as 'private' | 'team') || 'private'}
                onVisibilityToggle={(v) => updateVisibility.mutate({ id: doc.id, visibility: v })}
                isOwner={doc.userId === account?.userId}
              />
              <SmartButtonBar appId="docs" recordId={doc.id} />
            </div>
          ) : undefined
        }
        title={!doc || showTemplates ? t('docs.title', 'Write') : undefined}
      >
        {/* Editor area or template gallery — UNCHANGED from current */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'row' }}>
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {showTemplates ? (
              <TemplateGallery
                onSelect={handleCreateFromTemplate}
                onClose={() => setShowTemplates(false)}
              />
            ) : !selectedId ? (
              <div style={{ flex: 1, overflow: 'auto' }}><EmptyState /></div>
            ) : isLoading ? (
              <div style={{ flex: 1, overflow: 'auto' }}><CenterText>{t('common.loading')}</CenterText></div>
            ) : doc ? (
              <div style={{ flex: 1, overflow: 'auto' }}>
                <DocumentView
                  key={doc.id}
                  doc={doc}
                  isSaving={isSaving}
                  onContentChange={handleContentChange}
                  onTitleChange={handleTitleChange}
                  onIconChange={handleIconChange}
                  onCoverChange={handleCoverChange}
                  allDocuments={listData?.documents}
                  onNavigate={handleSelect}
                  allDrawings={drawingListData?.drawings?.map((d) => ({ id: d.id, title: d.title }))}
                  allTables={[]}
                />
              </div>
            ) : (
              <div style={{ flex: 1, overflow: 'auto' }}><CenterText>{t('docs.documentNotFound')}</CenterText></div>
            )}
          </div>
          {selectedId && (
            <CommentSidebar docId={selectedId} isOpen={showComments} onClose={() => setShowComments(false)} />
          )}
        </div>
      </ContentArea>
```

Key notes:
- `headerSlot` is conditionally set: only when a doc is loaded and templates gallery is not open. When no doc/templates open, fall back to default `title` (app name "Write").
- `paddingBottom: 'var(--global-dock-offset, 0px)'` is removed — ContentArea owns dock-reserve now.
- `docs.title` key may need adding to locale files. Check `packages/client/src/i18n/locales/en.json` for an existing key. If missing, add `"docs": { "title": "Write", ... }` — translations already exist per CLAUDE.md requirement; fallback `'Write'` in `t('docs.title', 'Write')` covers the gap.

- [ ] **Step 4: Verify `docs.title` translation key**

Run: `grep -n "\"docs\":" packages/client/src/i18n/locales/en.json` to find the docs namespace, then check if `title` exists inside it. If missing, add `"title": "Write"` (EN), `"title": "Yazı"` (TR), `"title": "Schreiben"` (DE), `"title": "Écrire"` (FR), `"title": "Scrivi"` (IT) to each of `en.json`, `tr.json`, `de.json`, `fr.json`, `it.json`.

- [ ] **Step 5: TypeScript check**

Run: `cd packages/client && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Manual smoke test**

Navigate to `/docs` (empty state) and to `/docs/:id` (doc loaded). Verify:
- With doc open: TopBar + SmartButtonBar render inside the header frame. Editor fills the body below.
- With template gallery open: default "Write" title shows in header.
- No doc selected: default "Write" title shows in header, empty state fills body.
- Comments sidebar toggles correctly.
- Content doesn't get hidden under dock.

- [ ] **Step 7: Commit**

```bash
git add packages/client/src/apps/docs/page.tsx packages/client/src/i18n/locales/
git commit -m "refactor(docs): migrate to ContentArea with TopBar in headerSlot"
```

---

## Task 5: Migrate Calendar page — use ContentArea with custom toolbar in headerSlot

**Files:**
- Modify: `packages/client/src/pages/calendar.tsx`

Calendar's structure is unusual: its top toolbar spans the full viewport width (above both the sidebar and grid). To fit the universal template, we restructure it as `[AppSidebar-like sidebar on left][ContentArea on right]` where ContentArea's headerSlot holds the calendar toolbar contents.

This is the biggest visual structural change in the plan — the toolbar no longer spans the full width; it lives above the calendar grid only, matching how CRM/HR/Sign/etc. already work.

**Risk:** Calendar uses `desktop-drag-region` on its toolbar for Electron window dragging. This class must stay on the toolbar wrapper. Also, Calendar's root is **not** using `<AppSidebar>` — it has a custom `data-sidebar` div. We'll leave the sidebar div alone and wrap only the grid area in ContentArea.

- [ ] **Step 1: Read the current structure**

Run: Read `packages/client/src/pages/calendar.tsx` lines 650–830 (toolbar) and lines 1090–1270 (body row with sidebar + grid).

- [ ] **Step 2: Add ContentArea import**

At the top of `pages/calendar.tsx`, add:

```tsx
import { ContentArea } from '../components/ui/content-area';
```

- [ ] **Step 3: Restructure the root — move toolbar into ContentArea headerSlot**

Currently calendar is:
```
<div column 100vh>
  <div toolbar>
  <div row flex:1>
    <sidebar>
    <div data-calendar-grid>  ← main content
```

Target structure:
```
<div row 100vh>
  <sidebar>  (still 210px fixed)
  <ContentArea headerSlot={<toolbar>}>
    <div data-calendar-grid>
```

Concretely, edit `pages/calendar.tsx`:

1. Change the root `<div>` at line 655 from `flexDirection: 'column'` to `flexDirection: 'row'`:

```tsx
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        height: '100vh',
        background: 'var(--color-bg-primary)',
        fontFamily: 'var(--font-family)',
        overflow: 'hidden',
      }}
    >
```

2. **Move the sidebar first.** Find the sidebar block at line 1094 (`{/* Main content: sidebar + week grid */} <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>` and the inner `{showSidebar && ( <div data-sidebar ...>...</div>)}`). The sidebar needs to render as a direct child of the new root row. Extract the sidebar JSX (from `{showSidebar && (` to its matching `)}`) and place it as the **first** child of the root, immediately after the opening `<div style={{ display: 'flex', flexDirection: 'row', ... }}>`.

3. **Wrap the existing toolbar in a variable** for readability. At the top of the return block (or just above the JSX return), create:

```tsx
    const calendarToolbar = (
      <div
        data-calendar-toolbar
        className={isDesktop ? 'desktop-drag-region' : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
          padding: '6px 16px',
          paddingTop: isDesktop ? 40 : 6,
          borderBottom: 'none',
          background: 'var(--color-bg-secondary)',
          flexShrink: 0,
          width: '100%',
        }}
      >
        {/* existing toolbar children — IconButton, Back, Calendar span, Today, prev/next, date picker, view toggle, New event — move unchanged */}
      </div>
    );
```

Note: `borderBottom` is removed because ContentArea's header frame already has a border-bottom. Keep `desktop-drag-region` intact.

4. **Wrap the grid in ContentArea.** Replace the existing `data-calendar-grid` div with:

```tsx
      <ContentArea headerSlot={calendarToolbar}>
        <div data-calendar-grid style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
          {/* existing grid children — UNCHANGED — loading overlay, day/week view, event list */}
        </div>
      </ContentArea>
```

Remove the existing `paddingBottom: 'var(--global-dock-offset, 0px)'` from this div — ContentArea owns that now.

5. **Remove the old inner flex row** that used to contain `[sidebar | grid]` (the `<div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>` at line 1094). It's replaced by the top-level row and the ContentArea.

- [ ] **Step 4: TypeScript check**

Run: `cd packages/client && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Manual smoke test**

Navigate to `/calendar`. Verify:
- Calendar toolbar renders inside the header frame, no longer spans above the sidebar.
- Left sidebar (calendars list, showSidebar toggle) still works and is full-height.
- Day/week grid renders beneath the toolbar.
- Today/prev/next/date-picker all work.
- Creating a new event via the button works.
- Dock doesn't cover the grid's bottom rows.
- On Electron desktop (if available), the drag region on the toolbar still allows dragging the window — `desktop-drag-region` class preserved.

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/pages/calendar.tsx
git commit -m "refactor(calendar): migrate to ContentArea with custom headerSlot"
```

---

## Task 6: Migrate org-layout to ContentArea

**Files:**
- Modify: `packages/client/src/pages/org/org-layout.tsx`

org-layout has a custom 48px header (not 44) with "Organization / {pageTitle}" breadcrumb. Migrate to ContentArea with a `breadcrumbs` prop so it matches the standard shape.

- [ ] **Step 1: Read the current org-layout**

Run: Read `packages/client/src/pages/org/org-layout.tsx` lines 80–163.

- [ ] **Step 2: Add ContentArea import**

At the top, add:

```tsx
import { ContentArea } from '../../components/ui/content-area';
```

- [ ] **Step 3: Replace the right-side content div with ContentArea**

Replace the block starting at `{/* Content area */}` (line 114) and ending at its matching `</div>` (line 160, after `</main>`) with:

```tsx
      {/* Content area */}
      <ContentArea
        breadcrumbs={[
          { label: 'Organization' },
          { label: pageTitle },
        ]}
      >
        <main style={{ flex: 1, overflow: 'auto', padding: 'var(--spacing-xl)' }}>
          <Outlet />
        </main>
      </ContentArea>
```

Notes:
- Removes the custom `<header>` (org-layout's 48px version) in favor of ContentArea's 44px standard header. Minor visual change — acceptable per your decision to break up to 4 apps.
- Removes `paddingBottom: 'var(--global-dock-offset, 0px)'` from the content wrapper — ContentArea handles it.
- The `pageTitle` variable already exists earlier in the component (`const pageTitle = getPageTitle(pathname);`).
- Breadcrumb items without `onClick` render as non-interactive text — matches the existing design (neither label was clickable before either).

- [ ] **Step 4: Remove unused CSSProperties import if applicable**

After the edit, the `CSSProperties` import (used only by the removed header's `fontWeight` cast) may become unused. Run: `grep -n "CSSProperties" packages/client/src/pages/org/org-layout.tsx`. If no references remain, remove it from the import line.

- [ ] **Step 5: TypeScript check**

Run: `cd packages/client && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Manual smoke test**

Navigate to `/org/members`, `/org/apps`, `/org/settings`. Verify:
- Each page shows "Organization / {pageTitle}" breadcrumb in the standard header.
- Members list, apps list, settings form render beneath.
- Dock doesn't cover content.

- [ ] **Step 7: Commit**

```bash
git add packages/client/src/pages/org/org-layout.tsx
git commit -m "refactor(org): migrate layout to ContentArea"
```

---

## Task 7: Remove per-app dock-reserve patches and document Draw exemption

**Files:**
- Modify: `packages/client/src/apps/draw/page.tsx`

Draw is exempt — its Excalidraw canvas is the whole content, no app-level header. But it currently has `paddingBottom: 'var(--global-dock-offset, 0px)'` on its right-side column, which means content *does* reserve 72px. That's fine functionally (the canvas shrinks so the dock doesn't cover tool palettes). We keep the padding but annotate it so future maintainers know Draw is intentionally not using ContentArea.

- [ ] **Step 1: Read current Draw page**

Run: Read `packages/client/src/apps/draw/page.tsx` lines 160–200.

- [ ] **Step 2: Add a comment above the right-side div**

Find the right-side column div (currently has `paddingBottom: 'var(--global-dock-offset, 0px)'`). Immediately above it, add:

```tsx
      {/*
        Draw is intentionally exempt from ContentArea because Excalidraw owns the full
        viewport and has no app-level header. It keeps its own flex column but still
        honors the dock-bottom reserve via padding-bottom below.
      */}
```

Leave the existing `paddingBottom: 'var(--global-dock-offset, 0px)'` in place.

- [ ] **Step 3: TypeScript check**

Run: `cd packages/client && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/apps/draw/page.tsx
git commit -m "docs(draw): annotate intentional ContentArea exemption"
```

---

## Task 8: Update CLAUDE.md with the template rule

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Read the "Coding Rules" section**

Run: Read `CLAUDE.md` and find the `## Coding Rules` section (near the bottom, around the "Always do" / "Never do" lists).

- [ ] **Step 2: Add rule under "Always do"**

Under `### Always do`, append:

```markdown
- Use `<ContentArea>` (`packages/client/src/components/ui/content-area.tsx`) as the right-side page template for every app page. It owns the 44px header frame and the dock-bottom reserve. Apps with custom toolbars pass them via the `headerSlot` prop. Only Draw is exempt (full-bleed Excalidraw canvas).
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: require ContentArea as universal page template"
```

---

## Task 9: Final verification — all pages visually consistent

**Files:** None — verification only.

- [ ] **Step 1: Typecheck full client**

Run: `cd packages/client && npx tsc --noEmit`
Expected: PASS with no errors.

- [ ] **Step 2: Build client**

Run: `cd packages/client && npm run build`
Expected: PASS. No type errors, no bundler errors.

- [ ] **Step 3: Smoke test every migrated app in the browser**

Dev server at http://localhost:5180. Visit each route and confirm:
- `/crm` — ContentArea (unchanged)
- `/hr` — ContentArea (unchanged)
- `/projects` — ContentArea (unchanged)
- `/invoices` — ContentArea (unchanged)
- `/sign-app` — ContentArea (unchanged)
- `/tasks` — ContentArea (unchanged)
- `/system` — NEW: standard header with "System" title
- `/drive` — NEW: toolbar inside header frame
- `/drive/folder/:id` — breadcrumbs navigable
- `/docs` and `/docs/:id` — TopBar inside header frame; empty state shows "Write" title
- `/draw` and `/draw/:id` — unchanged (exempt); canvas doesn't hide under dock
- `/calendar` — NEW: toolbar above grid only, sidebar to the left
- `/org/members`, `/org/apps`, `/org/settings` — NEW: standard breadcrumbs

For each, confirm:
- Sidebar extends full viewport height (dock floats over its bottom).
- Content area respects dock reserve (last row not hidden).
- No horizontal scrollbar from layout changes.
- No visual regressions on existing ContentArea pages.

- [ ] **Step 4: Verify dock reserve single source of truth**

Run: `grep -rn "paddingBottom.*global-dock-offset\|padding-bottom.*global-dock-offset" packages/client/src`
Expected output: ONLY the following locations:
- `packages/client/src/components/ui/content-area.tsx` (the source of truth)
- `packages/client/src/apps/draw/page.tsx` (exempt, documented)
- `packages/client/src/styles/global-dock.css` (comment + `:root` + `body:has(.global-dock)` variable definitions)

If any other file still has `padding-bottom: var(--global-dock-offset)` (including `.drive-main`, system scroll div, calendar-grid, docs right-pane, org-layout), that's a bug — remove it.

- [ ] **Step 5: Commit any verification fixes**

If step 4 revealed leftover patches, remove them and commit:

```bash
git commit -m "cleanup: remove obsolete per-app dock-reserve patches"
```

- [ ] **Step 6: Final commit summary**

All migrations complete. Verify by viewing the branch log:

Run: `git log --oneline main..HEAD`
Expected: 8 commits (one per Task 1–8), plus the optional cleanup commit from step 5.

---

## Risks and rollback

**Risks:**
1. **Calendar restructure is the highest-risk step.** The toolbar changes from full-width to grid-width-only — this is a visual change users may or may not want. If it looks bad, revert Task 5 only; the other tasks stand independently.
2. **TopBar in Docs may overflow the 44px minHeight.** If TopBar is taller than 44px, ContentArea's `minHeight: 44` accommodates it (the header frame grows). If this looks wrong, the fallback is to exempt Docs like Draw.
3. **Drive toolbar uses a lot of horizontal space.** On narrow windows, it may wrap or overflow. ContentArea doesn't constrain horizontal space, so behavior should match current. If not, Drive stays exempt.

**Rollback:** Each task is an isolated commit. To revert a specific migration, `git revert <commit-sha>` works cleanly because tasks don't depend on each other post-Task 1.

---

## Out of scope

- Home page (`/`) — dashboard, no sidebar, different layout.
- Login/register/setup/onboarding — dock isn't rendered there; no migration needed.
- Public sign/proposal pages — no app chrome.
- Renaming `ContentArea` to `PageShell` — keeping the name per user decision.
- Migrating `<AppSidebar>` to be slot-based — out of scope; AppSidebar stays as-is.

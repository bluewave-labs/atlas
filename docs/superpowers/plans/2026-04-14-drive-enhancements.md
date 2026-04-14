# Drive Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three independent Drive improvements — bulk actions toolbar + drag-to-folder, cross-app linked-record badges, and public upload-only file request links — without touching any other app.

**Architecture:**
- **Bulk toolbar**: reuse existing `batchMove` / `batchDelete` / `batchFavourite` endpoints; add 2 new batch endpoints (trash, tag); introduce a floating `<DriveBulkBar>` component that mirrors the CRM bulk bar pattern; wire drag handlers on list rows that use `selectedIds` as the payload.
- **Linked-record badges**: extend `GET /drive/:id` response with a `linkedFrom[]` array joined from the `record_links` table; render a new `<LinkedRecordsSection>` at the top of the preview panel. (The `linked_resource_type` column on `drive_items` is out of scope for MVP — it's used for linked-Write / linked-Draw placeholders, a different feature.)
- **File request links**: extend `driveShareLinks` schema with `mode`, `uploadInstructions`, `requireUploaderEmail`; new public route `/drive/upload/:token` (no auth); new `POST /share/:token/upload` endpoint with rate limiting and upload tagging; Share modal gains a "Link type" selector.

**Tech Stack:** React + TypeScript + TanStack Query (client), Express + Drizzle ORM + Postgres (server), multer for uploads, existing `express-rate-limit` for throttling. No new dependencies.

---

## File Structure

### New files

- `packages/client/src/apps/drive/components/drive-bulk-bar.tsx` — floating bulk-action toolbar
- `packages/client/src/apps/drive/components/linked-records-section.tsx` — linked-records display for preview panel
- `packages/client/src/apps/drive/components/modals/file-request-settings.tsx` — upload-only link settings section (slot inside existing ShareModal)
- `packages/client/src/pages/drive-upload-public.tsx` — public upload page route
- `packages/server/src/apps/drive/services/linked-records.service.ts` — resolve inbound record_links + outbound linked_resource for a drive item
- `packages/server/src/apps/drive/controllers/public-upload.controller.ts` — handle public file uploads via share tokens

### Modified files

- `packages/server/src/db/schema.ts` — add `mode`, `uploadInstructions`, `requireUploaderEmail` columns to `driveShareLinks`
- `packages/server/src/apps/drive/routes.ts` — register batch/trash, batch/tag endpoints
- `packages/server/src/routes/share.routes.ts` — register `GET /share/:token/info`, `POST /share/:token/upload`, `GET /share/:token/uploads`
- `packages/server/src/apps/drive/controllers/items.controller.ts` — add `batchTrash`, `batchTag` handlers; enrich `getItem` response with linked-records
- `packages/server/src/apps/drive/controllers/sharing.controller.ts` — accept `mode` / `uploadInstructions` / `requireUploaderEmail` on link creation
- `packages/server/src/apps/drive/services/items.service.ts` — add `batchTrash`, `batchTag`, enrich `getItem` with linked-records
- `packages/client/src/apps/drive/hooks.ts` — add `useBatchTrash`, `useBatchTag`, `usePublicUploadLink`
- `packages/client/src/apps/drive/page.tsx` — render `<DriveBulkBar>`; wire drag-to-folder; pass preview panel into `<LinkedRecordsSection>`
- `packages/client/src/apps/drive/components/drive-data-table-list.tsx` — add drag handlers to rows + folder drop targets + small "linked" icon
- `packages/client/src/apps/drive/components/drive-preview-panel.tsx` — mount `<LinkedRecordsSection>`
- `packages/client/src/apps/drive/components/modals/share-modal.tsx` — add link-type selector, render `<FileRequestSettings>` when upload-only is chosen
- `packages/client/src/App.tsx` — register `/drive/upload/:token` route (public, outside auth)
- `packages/client/src/i18n/locales/{en,tr,de,fr,it}.json` — add `drive.bulk.*`, `drive.linkedFrom.*`, `drive.upload.*` namespaces

### CLAUDE.md / Never-touched

- No schema rename; only additive columns.
- Existing `drive.*` i18n keys stay; new keys use sub-namespaces so nothing collides.

---

## Feature 1 — Bulk toolbar + drag-to-folder

### Task 1.1: Add batch-trash + batch-tag server endpoints

**Files:**
- Modify: `packages/server/src/apps/drive/services/items.service.ts` — append two functions
- Modify: `packages/server/src/apps/drive/controllers/items.controller.ts` — append two handlers
- Modify: `packages/server/src/apps/drive/routes.ts` — register two routes

- [ ] **Step 1: Add `batchTrash` to items.service.ts**

Append at the end of `packages/server/src/apps/drive/services/items.service.ts`:

```ts
export async function batchTrash(userId: string, itemIds: string[]) {
  if (itemIds.length === 0) return { trashed: 0 };
  const result = await db
    .update(driveItems)
    .set({ isArchived: true, updatedAt: new Date() })
    .where(and(
      eq(driveItems.userId, userId),
      inArray(driveItems.id, itemIds),
    ))
    .returning({ id: driveItems.id });
  return { trashed: result.length };
}

export async function batchTag(
  userId: string,
  itemIds: string[],
  tags: string[],
  op: 'add' | 'remove',
) {
  if (itemIds.length === 0 || tags.length === 0) return { updated: 0 };
  // Read-modify-write since tags is a jsonb array
  const rows = await db
    .select({ id: driveItems.id, tags: driveItems.tags })
    .from(driveItems)
    .where(and(
      eq(driveItems.userId, userId),
      inArray(driveItems.id, itemIds),
    ));
  let updated = 0;
  for (const row of rows) {
    const current = new Set((row.tags as string[]) ?? []);
    for (const t of tags) {
      if (op === 'add') current.add(t);
      else current.delete(t);
    }
    await db
      .update(driveItems)
      .set({ tags: Array.from(current), updatedAt: new Date() })
      .where(eq(driveItems.id, row.id));
    updated++;
  }
  return { updated };
}
```

Import `inArray` at the top of the file if not already imported.

- [ ] **Step 2: Add controllers**

Append to `packages/server/src/apps/drive/controllers/items.controller.ts`:

```ts
export async function batchTrash(req: Request, res: Response) {
  try {
    const { itemIds } = req.body as { itemIds: string[] };
    if (!Array.isArray(itemIds)) return res.status(400).json({ success: false, error: 'itemIds required' });
    const result = await itemsService.batchTrash(req.auth!.userId, itemIds);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error }, 'Failed to batch trash drive items');
    res.status(500).json({ success: false, error: 'Failed to trash items' });
  }
}

export async function batchTag(req: Request, res: Response) {
  try {
    const { itemIds, tags, op } = req.body as { itemIds: string[]; tags: string[]; op: 'add' | 'remove' };
    if (!Array.isArray(itemIds) || !Array.isArray(tags) || !['add', 'remove'].includes(op)) {
      return res.status(400).json({ success: false, error: 'Invalid payload' });
    }
    const result = await itemsService.batchTag(req.auth!.userId, itemIds, tags, op);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error }, 'Failed to batch tag drive items');
    res.status(500).json({ success: false, error: 'Failed to tag items' });
  }
}
```

- [ ] **Step 3: Register routes**

Edit `packages/server/src/apps/drive/routes.ts`, insert immediately after the existing `router.post('/batch/favourite', ...)` line:

```ts
router.post('/batch/trash', driveController.batchTrash);
router.post('/batch/tag', driveController.batchTag);
```

- [ ] **Step 4: Typecheck**

Run: `cd /Users/gorkemcetin/atlasmail/packages/server && npx tsc --noEmit 2>&1 | tail -10`
Expected: no errors.

- [ ] **Step 5: Smoke test with curl**

With dev server running at localhost:3001:

```bash
# Obtain a JWT by opening localhost:5180 in a browser, logging in, then running in
# DevTools console:  copy(localStorage.getItem('atlasmail_token'))
# Paste the value into TOKEN below.
TOKEN='<paste-jwt-here>'
curl -X POST http://localhost:3001/api/v1/drive/batch/trash \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"itemIds":[]}' -s | jq
```

Expected: `{"success":true,"data":{"trashed":0}}` (empty array proves the endpoint is wired; actual trashing happens via the UI).

- [ ] **Step 6: Commit**

```bash
cd /Users/gorkemcetin/atlasmail
git add packages/server/src/apps/drive/
git commit -m "feat(drive): add batch trash + batch tag server endpoints"
git push origin main
```

---

### Task 1.2: Add client hooks for batch operations

**Files:**
- Modify: `packages/client/src/apps/drive/hooks.ts`

- [ ] **Step 1: Add two hooks at the end of hooks.ts**

Append:

```ts
export function useBatchTrash() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (itemIds: string[]) => {
      const { data } = await api.post('/drive/batch/trash', { itemIds });
      return data.data as { trashed: number };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.drive.all });
    },
  });
}

export function useBatchTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { itemIds: string[]; tags: string[]; op: 'add' | 'remove' }) => {
      const { data } = await api.post('/drive/batch/tag', input);
      return data.data as { updated: number };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.drive.all });
    },
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `cd /Users/gorkemcetin/atlasmail/packages/client && npx tsc --noEmit 2>&1 | tail -5`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/gorkemcetin/atlasmail
git add packages/client/src/apps/drive/hooks.ts
git commit -m "feat(drive): add useBatchTrash + useBatchTag hooks"
git push origin main
```

---

### Task 1.3: Create `<DriveBulkBar>` component

**Files:**
- Create: `packages/client/src/apps/drive/components/drive-bulk-bar.tsx`

- [ ] **Step 1: Create the file**

Write `packages/client/src/apps/drive/components/drive-bulk-bar.tsx`:

```tsx
import { useTranslation } from 'react-i18next';
import { Trash2, FolderInput, Copy, Download, X, Tag, EyeOff } from 'lucide-react';
import { Button } from '../../../components/ui/button';

interface DriveBulkBarProps {
  selectedCount: number;
  onMove: () => void;
  onCopy: () => void;
  onTrash: () => void;
  onDownload: () => void;
  onClear: () => void;
  canDelete: boolean;
  canEdit: boolean;
}

export function DriveBulkBar({
  selectedCount, onMove, onCopy, onTrash, onDownload, onClear, canDelete, canEdit,
}: DriveBulkBarProps) {
  const { t } = useTranslation();
  if (selectedCount < 1) return null;
  return (
    <div
      className="drive-bulk-bar"
      role="toolbar"
      aria-label={t('drive.bulk.toolbar')}
      style={{
        position: 'fixed',
        bottom: 96, // sit above the global dock
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-sm)',
        padding: 'var(--spacing-sm) var(--spacing-md)',
        background: 'var(--color-bg-elevated)',
        border: '1px solid var(--color-border-primary)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg)',
        zIndex: 90,
      }}
    >
      <span style={{
        fontSize: 'var(--font-size-sm)',
        fontWeight: 'var(--font-weight-medium)',
        color: 'var(--color-text-primary)',
        paddingInline: 'var(--spacing-xs)',
      }}>
        {t('drive.bulk.selected', { count: selectedCount })}
      </span>
      <div style={{ width: 1, height: 20, background: 'var(--color-border-primary)' }} />
      {canEdit && (
        <Button variant="ghost" size="sm" icon={<FolderInput size={13} />} onClick={onMove}>
          {t('drive.bulk.move')}
        </Button>
      )}
      {canEdit && (
        <Button variant="ghost" size="sm" icon={<Copy size={13} />} onClick={onCopy}>
          {t('drive.bulk.copy')}
        </Button>
      )}
      <Button variant="ghost" size="sm" icon={<Download size={13} />} onClick={onDownload}>
        {t('drive.bulk.download')}
      </Button>
      {canDelete && (
        <Button variant="ghost" size="sm" icon={<Trash2 size={13} />} onClick={onTrash} destructive>
          {t('drive.bulk.trash')}
        </Button>
      )}
      <div style={{ width: 1, height: 20, background: 'var(--color-border-primary)' }} />
      <Button variant="ghost" size="sm" icon={<X size={13} />} onClick={onClear} aria-label={t('drive.bulk.clear')} />
    </div>
  );
}
```

Note: the `Tag` and `EyeOff` imports are for future-use slots (tag + visibility controls). Leaving them imported so later tasks don't need another round of imports. If TypeScript complains about unused imports, remove them.

- [ ] **Step 2: Add i18n keys**

Add to all 5 locales under `drive`:

- EN: `"bulk": { "toolbar": "Bulk actions", "selected_one": "{{count}} selected", "selected_other": "{{count}} selected", "move": "Move", "copy": "Copy", "download": "Download", "trash": "Trash", "clear": "Clear selection" }`
- TR: `"bulk": { "toolbar": "Toplu işlemler", "selected_one": "{{count}} seçildi", "selected_other": "{{count}} seçildi", "move": "Taşı", "copy": "Kopyala", "download": "İndir", "trash": "Çöpe at", "clear": "Seçimi temizle" }`
- DE: `"bulk": { "toolbar": "Sammelaktionen", "selected_one": "{{count}} ausgewählt", "selected_other": "{{count}} ausgewählt", "move": "Verschieben", "copy": "Kopieren", "download": "Herunterladen", "trash": "In Papierkorb", "clear": "Auswahl aufheben" }`
- FR: `"bulk": { "toolbar": "Actions en masse", "selected_one": "{{count}} sélectionné", "selected_other": "{{count}} sélectionnés", "move": "Déplacer", "copy": "Copier", "download": "Télécharger", "trash": "Corbeille", "clear": "Désélectionner" }`
- IT: `"bulk": { "toolbar": "Azioni in blocco", "selected_one": "{{count}} selezionato", "selected_other": "{{count}} selezionati", "move": "Sposta", "copy": "Copia", "download": "Scarica", "trash": "Cestina", "clear": "Deseleziona" }`

Use the native Edit tool — find the existing `"drive": {` section in each locale and add the `"bulk": {...}` object next to other `drive.*` sub-namespaces (after `sidebar`, for example).

- [ ] **Step 3: Typecheck**

Run: `cd /Users/gorkemcetin/atlasmail/packages/client && npx tsc --noEmit 2>&1 | tail -5`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/gorkemcetin/atlasmail
git add packages/client/src/apps/drive/components/drive-bulk-bar.tsx packages/client/src/i18n/locales/
git commit -m "feat(drive): DriveBulkBar component + i18n"
git push origin main
```

---

### Task 1.4: Wire `<DriveBulkBar>` into Drive page

**Files:**
- Modify: `packages/client/src/apps/drive/page.tsx`

- [ ] **Step 1: Import DriveBulkBar + useBatchTrash**

At the top of `packages/client/src/apps/drive/page.tsx`, add to the imports:

```tsx
import { DriveBulkBar } from './components/drive-bulk-bar';
import { useBatchTrash } from './hooks';
```

(The existing hooks file already exports `useBatchTrash` after Task 1.2.)

- [ ] **Step 2: Wire handlers in the component body**

Inside the `DrivePage` component function, near the existing `const d = useDrive()` line (or equivalent — grep for `selectedIds` in drive/page.tsx to find the exact spot), add:

```tsx
const batchTrash = useBatchTrash();

const handleBulkTrash = () => {
  if (d.selectedIds.size === 0) return;
  batchTrash.mutate(Array.from(d.selectedIds), {
    onSuccess: () => d.setSelectedIds(new Set()),
  });
};

const handleBulkDownload = () => {
  // Reuse per-item download endpoint looped via browser's concurrent downloads.
  // localStorage key is 'atlasmail_token' — intentional legacy name, see CLAUDE.md memory.
  const token = localStorage.getItem('atlasmail_token');
  for (const id of d.selectedIds) {
    window.open(`/api/v1/drive/${id}/download${token ? `?token=${encodeURIComponent(token)}` : ''}`, '_blank');
  }
};
```

- [ ] **Step 3: Render the bulk bar**

Inside the JSX, after the `<ContentArea>` closing tag (but still inside the outer root `<div>`), add:

```tsx
<DriveBulkBar
  selectedCount={d.selectedIds.size}
  onMove={() => d.setBatchMoveOpen(true)}
  onCopy={() => d.setCopyModalOpen(true)}
  onTrash={handleBulkTrash}
  onDownload={handleBulkDownload}
  onClear={() => d.setSelectedIds(new Set())}
  canDelete={canDeleteAny || canDeleteOwn}
  canEdit={canEdit}
/>
```

The `canDeleteAny` / `canDeleteOwn` / `canEdit` variables are defined earlier in `drive/page.tsx` using the existing `useAppActions('drive')` hook — re-use whatever names are already in scope. If you find different names (e.g. `canWrite` instead of `canEdit`), adapt the component props accordingly. If `setBatchMoveOpen` / `setCopyModalOpen` don't exist on `d` (e.g. they're lifted state), look at how the existing "Move" context menu triggers them and call the same setter.

- [ ] **Step 4: Typecheck**

Run: `cd /Users/gorkemcetin/atlasmail/packages/client && npx tsc --noEmit 2>&1 | tail -5`
Expected: no errors.

- [ ] **Step 5: Manual smoke test**

Open http://localhost:5180/drive, select 2+ items by shift-clicking or checkbox. Expect the bulk bar to appear above the dock with counts and actions. Click Trash → items move to trash and bar disappears.

- [ ] **Step 6: Commit**

```bash
cd /Users/gorkemcetin/atlasmail
git add packages/client/src/apps/drive/page.tsx
git commit -m "feat(drive): wire DriveBulkBar into the page"
git push origin main
```

---

### Task 1.5: Drag-to-folder in list view

**Files:**
- Modify: `packages/client/src/apps/drive/components/drive-data-table-list.tsx`

- [ ] **Step 1: Extend the row drag handlers**

Find the existing `handleItemDragStart` in the component and modify its draggable row to include `selectedIds` in the payload when the dragged item is part of the selection:

```tsx
onDragStart={(e) => {
  const isInSelection = selectedIds.has(item.id);
  const payload = isInSelection
    ? { ids: Array.from(selectedIds) }
    : { ids: [item.id] };
  e.dataTransfer.setData('application/x-atlas-drive-ids', JSON.stringify(payload));
  e.dataTransfer.effectAllowed = 'move';
  handleItemDragStart(item.id);
}}
```

- [ ] **Step 2: Fold folder drop target to accept the batch payload**

Find the existing folder-row `onDrop` handler and replace its body so it reads the new payload format:

```tsx
onDrop={(e) => {
  e.preventDefault();
  e.stopPropagation();
  handleFolderDragLeave();
  const raw = e.dataTransfer.getData('application/x-atlas-drive-ids');
  if (!raw) {
    handleFolderDrop(item.id); // fallback to existing single-item logic
    return;
  }
  const { ids } = JSON.parse(raw) as { ids: string[] };
  // Reuse the existing batch move mutation by delegating via a prop
  onBatchMoveToFolder?.(ids, item.id);
}}
```

- [ ] **Step 3: Add the new prop to the component signature**

At the interface declaration:

```tsx
onBatchMoveToFolder?: (ids: string[], targetFolderId: string) => void;
```

- [ ] **Step 4: Pass the new prop from the Drive page**

In `packages/client/src/apps/drive/page.tsx`, add to the already-existing `useBatchMove` or equivalent (if not present, grep for `handleBulkMoveSubmit`) and pipe it into `<DriveDataTableList onBatchMoveToFolder={(ids, to) => d.handleBulkMoveTo?.(ids, to) ?? ...}>`. If no matching handler exists on the hook, call `useBatchMove` from hooks.ts directly — it already exists (used by the existing MoveModal batch flow).

- [ ] **Step 5: Typecheck + smoke test**

Run `cd /Users/gorkemcetin/atlasmail/packages/client && npx tsc --noEmit`. Then in the browser: select 3 files, drag one onto a folder row → all 3 move. Check the folder contents: the 3 files are there.

- [ ] **Step 6: Commit**

```bash
cd /Users/gorkemcetin/atlasmail
git add packages/client/src/apps/drive/
git commit -m "feat(drive): drag-to-folder moves entire selection"
git push origin main
```

---

## Feature 2 — Linked-record badges

### Task 2.1: Create `linked-records.service.ts`

**Files:**
- Create: `packages/server/src/apps/drive/services/linked-records.service.ts`

- [ ] **Step 1: Create the service**

Write `packages/server/src/apps/drive/services/linked-records.service.ts`:

```ts
import { db } from '../../../config/database';
import { recordLinks, crmDeals, signatureDocuments, invoices } from '../../../db/schema';
import { and, or, eq } from 'drizzle-orm';

export interface LinkedRecord {
  appId: 'crm' | 'sign' | 'invoices';
  recordType: string;
  recordId: string;
  recordTitle: string;
  recordUrl: string;
}

/**
 * Return every record in another Atlas app that links to this Drive item,
 * via either direction of the record_links table.
 */
export async function getLinkedRecordsForDriveItem(
  driveItemId: string,
  tenantId: string,
): Promise<LinkedRecord[]> {
  const results: LinkedRecord[] = [];

  const inboundLinks = await db
    .select()
    .from(recordLinks)
    .where(and(
      eq(recordLinks.tenantId, tenantId),
      or(
        and(eq(recordLinks.targetAppId, 'drive'), eq(recordLinks.targetRecordId, driveItemId)),
        and(eq(recordLinks.sourceAppId, 'drive'), eq(recordLinks.sourceRecordId, driveItemId)),
      ),
    ));

  for (const link of inboundLinks) {
    const otherAppId = link.targetAppId === 'drive' ? link.sourceAppId : link.targetAppId;
    const otherRecordId = link.targetAppId === 'drive' ? link.sourceRecordId : link.targetRecordId;

    if (otherAppId === 'crm') {
      const [deal] = await db
        .select({ id: crmDeals.id, title: crmDeals.title })
        .from(crmDeals)
        .where(eq(crmDeals.id, otherRecordId))
        .limit(1);
      if (deal) {
        results.push({
          appId: 'crm',
          recordType: 'deal',
          recordId: deal.id,
          recordTitle: deal.title,
          recordUrl: `/crm/deals/${deal.id}`,
        });
      }
    } else if (otherAppId === 'sign') {
      const [doc] = await db
        .select({ id: signatureDocuments.id, title: signatureDocuments.title })
        .from(signatureDocuments)
        .where(eq(signatureDocuments.id, otherRecordId))
        .limit(1);
      if (doc) {
        results.push({
          appId: 'sign',
          recordType: 'agreement',
          recordId: doc.id,
          recordTitle: doc.title,
          recordUrl: `/sign-app/${doc.id}`,
        });
      }
    } else if (otherAppId === 'invoices') {
      const [inv] = await db
        .select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber })
        .from(invoices)
        .where(eq(invoices.id, otherRecordId))
        .limit(1);
      if (inv) {
        results.push({
          appId: 'invoices',
          recordType: 'invoice',
          recordId: inv.id,
          recordTitle: inv.invoiceNumber,
          recordUrl: `/invoices/${inv.id}`,
        });
      }
    }
  }

  return results;
}
```

Exact table column names (`crmDeals.title`, `signatureDocuments.title`, `invoices.invoiceNumber`) are confirmed from reading `packages/server/src/db/schema.ts` — do not rename.

- [ ] **Step 2: Typecheck**

Run: `cd /Users/gorkemcetin/atlasmail/packages/server && npx tsc --noEmit 2>&1 | tail -10`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/gorkemcetin/atlasmail
git add packages/server/src/apps/drive/services/linked-records.service.ts
git commit -m "feat(drive): linked-records service for cross-app badges"
git push origin main
```

---

### Task 2.2: Enrich `GET /drive/:id` with linked records

**Files:**
- Modify: `packages/server/src/apps/drive/controllers/items.controller.ts`

- [ ] **Step 1: Call the service in `getItem`**

The existing `getItem` controller already passes `req.auth!.tenantId` to the service. Add the linked-records enrichment by modifying the existing handler — only the `res.json(...)` line changes. The real current implementation is:

```ts
export async function getItem(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const itemId = req.params.id as string;
    const item = await driveService.getItem(userId, itemId, req.auth!.tenantId ?? null);
    if (!item) {
      res.status(404).json({ success: false, error: 'Item not found' });
      return;
    }
    res.json({ success: true, data: item });
  } catch (error) {
    logger.error({ error }, 'Failed to get drive item');
    res.status(500).json({ success: false, error: 'Failed to get drive item' });
  }
}
```

Add the import at the top:

```ts
import { getLinkedRecordsForDriveItem } from './services/linked-records.service';
```

Then change the `res.json` line to:

```ts
const linkedFrom = req.auth!.tenantId
  ? await getLinkedRecordsForDriveItem(item.id, req.auth!.tenantId)
  : [];
res.json({ success: true, data: { ...item, linkedFrom } });
```

Note: `req.auth.tenantId` (not `accountId` — Atlas has `tenantId` on the auth payload). The enrichment degrades gracefully to an empty array if the user has no tenant.

- [ ] **Step 2: Typecheck + smoke test**

Run: `cd /Users/gorkemcetin/atlasmail/packages/server && npx tsc --noEmit`. Then:

```bash
curl -s http://localhost:3001/api/v1/drive/<some-id> -H "Authorization: Bearer $TOKEN" | jq '.data.linkedFrom'
```

Expected: `[]` for files with no links, or an array with entries for linked files.

- [ ] **Step 3: Commit**

```bash
cd /Users/gorkemcetin/atlasmail
git add packages/server/src/apps/drive/controllers/items.controller.ts
git commit -m "feat(drive): include linkedFrom in getItem response"
git push origin main
```

---

### Task 2.3: Create `<LinkedRecordsSection>` component

**Files:**
- Create: `packages/client/src/apps/drive/components/linked-records-section.tsx`

- [ ] **Step 1: Create the component**

Write `packages/client/src/apps/drive/components/linked-records-section.tsx`:

```tsx
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Briefcase, FileSignature, Receipt, Link as LinkIcon } from 'lucide-react';
import { appRegistry } from '../../../apps';

const APP_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  crm: Briefcase,
  sign: FileSignature,
  invoices: Receipt,
};

export interface LinkedRecord {
  appId: 'crm' | 'sign' | 'invoices';
  recordType: string;
  recordId: string;
  recordTitle: string;
  recordUrl: string;
}

interface Props {
  linkedFrom?: LinkedRecord[];
}

export function LinkedRecordsSection({ linkedFrom }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // Pull app brand colors from the registry so chips stay in sync with the dock/sidebar.
  const appColors = useMemo(() => {
    const map: Record<string, string> = {};
    for (const app of appRegistry.getAll()) map[app.id] = app.color;
    return map;
  }, []);
  if (!linkedFrom || linkedFrom.length === 0) return null;
  return (
    <div style={{
      padding: 'var(--spacing-md)',
      borderBottom: '1px solid var(--color-border-secondary)',
    }}>
      <div style={{
        fontSize: 'var(--font-size-xs)',
        fontWeight: 'var(--font-weight-semibold)',
        color: 'var(--color-text-tertiary)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: 'var(--spacing-sm)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        <LinkIcon size={11} />
        {t('drive.linkedFrom.title')}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-xs)' }}>
        {linkedFrom.map((link) => {
          const Icon = APP_ICONS[link.appId] ?? LinkIcon;
          const color = appColors[link.appId] ?? 'var(--color-text-tertiary)';
          return (
            <button
              key={`${link.appId}-${link.recordId}`}
              onClick={() => navigate(link.recordUrl)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`,
                background: `color-mix(in srgb, ${color} 8%, transparent)`,
                color,
                fontSize: 'var(--font-size-xs)',
                fontWeight: 'var(--font-weight-medium)',
                cursor: 'pointer',
                fontFamily: 'var(--font-family)',
              }}
            >
              <Icon size={12} />
              {link.recordTitle}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add i18n keys**

Add to all 5 locales under `drive`:

- EN: `"linkedFrom": { "title": "Linked records" }`
- TR: `"linkedFrom": { "title": "Bağlı kayıtlar" }`
- DE: `"linkedFrom": { "title": "Verknüpfte Datensätze" }`
- FR: `"linkedFrom": { "title": "Enregistrements liés" }`
- IT: `"linkedFrom": { "title": "Record collegati" }`

- [ ] **Step 3: Typecheck**

Run: `cd /Users/gorkemcetin/atlasmail/packages/client && npx tsc --noEmit 2>&1 | tail -5`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/gorkemcetin/atlasmail
git add packages/client/src/apps/drive/components/linked-records-section.tsx packages/client/src/i18n/locales/
git commit -m "feat(drive): LinkedRecordsSection component + i18n"
git push origin main
```

---

### Task 2.4: Mount `<LinkedRecordsSection>` in the preview panel

**Files:**
- Modify: `packages/client/src/apps/drive/components/drive-preview-panel.tsx`

- [ ] **Step 1: Import + render the section**

Add the import at the top:

```tsx
import { LinkedRecordsSection, type LinkedRecord } from './linked-records-section';
```

Extend the component's existing `previewItem` prop type to include `linkedFrom?: LinkedRecord[]` (the server now returns it).

Mount the section at the top of the panel body, immediately after the panel header:

```tsx
<LinkedRecordsSection linkedFrom={(previewItem as { linkedFrom?: LinkedRecord[] }).linkedFrom} />
```

- [ ] **Step 2: Typecheck + smoke test**

Run `cd /Users/gorkemcetin/atlasmail/packages/client && npx tsc --noEmit`. Then in the browser: open a file that has a `record_links` entry (for a quick test, manually insert one via `psql` pointing a Drive item to a CRM deal). The preview panel should show a chip at the top linking to the deal.

To manually create a test link (uses whatever drive item + deal exist):

```bash
psql -U postgres -h localhost -d atlas -c "
INSERT INTO record_links (tenant_id, source_app_id, source_record_id, target_app_id, target_record_id, link_type, created_by)
SELECT d.tenant_id, 'drive', d.id, 'crm', c.id, 'attachment', d.user_id
FROM drive_items d
CROSS JOIN LATERAL (SELECT id FROM crm_deals WHERE tenant_id = d.tenant_id LIMIT 1) c
WHERE d.type = 'file' AND d.is_archived = false
LIMIT 1
ON CONFLICT DO NOTHING;"
```

The `record_links` table has a unique index on `(source_app_id, source_record_id, target_app_id, target_record_id, link_type)`, so `ON CONFLICT DO NOTHING` makes this safely re-runnable.

Then in the browser, open Drive, click any file — the preview panel should show a chip under "Linked records" linking to the deal. If you can't tell which file got the link, run: `SELECT d.name FROM drive_items d JOIN record_links r ON r.source_record_id = d.id WHERE r.source_app_id = 'drive';` to find out.

- [ ] **Step 3: Commit**

```bash
cd /Users/gorkemcetin/atlasmail
git add packages/client/src/apps/drive/components/drive-preview-panel.tsx
git commit -m "feat(drive): render LinkedRecordsSection in preview panel"
git push origin main
```

---

## Feature 3 — File request / upload-only links

### Task 3.1: Extend `driveShareLinks` schema

**Files:**
- Modify: `packages/server/src/db/schema.ts`

- [ ] **Step 1: Add three columns**

Find the existing `export const driveShareLinks = pgTable('drive_share_links', { ... })` block (around line 506 of schema.ts) and add three new columns before the closing `});`:

```ts
mode: varchar('mode', { length: 20 }).notNull().default('view'),  // 'view' | 'edit' | 'upload_only'
uploadInstructions: text('upload_instructions'),
requireUploaderEmail: boolean('require_uploader_email').notNull().default(true),
```

Result should look like:

```ts
export const driveShareLinks = pgTable('drive_share_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  driveItemId: uuid('drive_item_id').notNull().references(() => driveItems.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  shareToken: text('share_token').notNull().unique(),
  passwordHash: text('password_hash'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  mode: varchar('mode', { length: 20 }).notNull().default('view'),
  uploadInstructions: text('upload_instructions'),
  requireUploaderEmail: boolean('require_uploader_email').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tokenIdx: index('idx_share_links_token').on(table.shareToken),
  itemIdx: index('idx_share_links_item').on(table.driveItemId),
}));
```

- [ ] **Step 2: Push schema**

Run: `cd /Users/gorkemcetin/atlasmail/packages/server && npm run db:push`
Expected: Drizzle reports "3 columns added" and no destructive changes.

- [ ] **Step 3: Verify in Postgres**

```bash
psql -U postgres -h localhost -d atlas -c "\d drive_share_links" | grep -E "mode|upload_instructions|require_uploader_email"
```

Expected: three new columns listed with correct defaults.

- [ ] **Step 4: Typecheck**

Run: `cd /Users/gorkemcetin/atlasmail/packages/server && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/gorkemcetin/atlasmail
git add packages/server/src/db/schema.ts
git commit -m "feat(drive): extend drive_share_links with upload-only mode columns"
git push origin main
```

---

### Task 3.2: Share-link creation accepts mode

**Files:**
- Modify: `packages/server/src/apps/drive/services/sharing.service.ts`
- Modify: `packages/server/src/apps/drive/controllers/sharing.controller.ts`

- [ ] **Step 1: Extend service — additive args, backwards-compatible**

The current signature is `createShareLink(userId, itemId, expiresAt?, password?)`. To avoid rewriting every call site, keep positional args and append a single optional `options` argument. In `packages/server/src/apps/drive/services/sharing.service.ts`, replace the existing function with:

```ts
export async function createShareLink(
  userId: string,
  itemId: string,
  expiresAt?: string | null,
  password?: string | null,
  options: {
    mode?: 'view' | 'edit' | 'upload_only';
    uploadInstructions?: string | null;
    requireUploaderEmail?: boolean;
  } = {},
) {
  const { getItem } = await import('./items.service');
  const item = await getItem(userId, itemId);
  if (!item) return null;

  const mode = options.mode ?? 'view';
  if (mode === 'upload_only' && item.type !== 'folder') {
    throw new Error('Upload-only links require a folder');
  }

  const shareToken = crypto.randomUUID();
  const passwordHashValue = password ? await hashPassword(password) : null;
  const [link] = await db
    .insert(driveShareLinks)
    .values({
      driveItemId: itemId,
      userId,
      shareToken,
      passwordHash: passwordHashValue,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      mode,
      uploadInstructions: options.uploadInstructions ?? null,
      requireUploaderEmail: options.requireUploaderEmail ?? true,
      createdAt: new Date(),
    })
    .returning();
  return link;
}
```

Note: token generation stays as `crypto.randomUUID()` to match the existing code. The URL-visible identifier is the full UUID.

- [ ] **Step 2: Controller passes new fields — preserve permission check**

In `packages/server/src/apps/drive/controllers/sharing.controller.ts`, find `createShareLink`. The existing handler has a permission guard (`canAccess(perm.role, 'update')`) that **must stay**. Only change the destructuring and the service call — keep everything else.

Find this block:

```ts
const { expiresAt, password } = req.body as { expiresAt?: string; password?: string };
const link = await driveService.createShareLink(userId, itemId, expiresAt, password);
```

Replace with:

```ts
const { expiresAt, password, mode, uploadInstructions, requireUploaderEmail } = req.body as {
  expiresAt?: string;
  password?: string;
  mode?: 'view' | 'edit' | 'upload_only';
  uploadInstructions?: string | null;
  requireUploaderEmail?: boolean;
};
const link = await driveService.createShareLink(userId, itemId, expiresAt, password, {
  mode, uploadInstructions, requireUploaderEmail,
});
```

Do not remove the `canAccess(perm.role, 'update')` check — that's the existing RBAC guard.

- [ ] **Step 3: Typecheck**

Run: `cd /Users/gorkemcetin/atlasmail/packages/server && npx tsc --noEmit 2>&1 | tail -5`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/gorkemcetin/atlasmail
git add packages/server/src/apps/drive/
git commit -m "feat(drive): share-link creation accepts mode + upload settings"
git push origin main
```

---

### Task 3.3: Public info endpoint

**Files:**
- Modify: `packages/server/src/routes/share.routes.ts`

- [ ] **Step 1: Add `GET /share/:token/info`**

`share.routes.ts` imports via a barrel: `import * as driveService from '../apps/drive/service'`. The `getShareLinkByToken` function is already exported from that barrel (used by the existing `/download` route indirectly). Check: `grep "getShareLinkByToken" packages/server/src/apps/drive/service.ts`. If it's not re-exported from the barrel, add an export line there: `export { getShareLinkByToken } from './services/sharing.service';`.

Then in `packages/server/src/routes/share.routes.ts`, add these imports at the top (next to the existing ones):

```ts
import { db } from '../config/database';
import { driveItems } from '../db/schema';
import { eq } from 'drizzle-orm';
```

And append this route after the existing `GET /:token/download` handler:

```ts
// GET /api/v1/share/:token/info — public metadata for file request links
router.get('/:token/info', async (req: Request, res: Response) => {
  try {
    const token = req.params.token as string;
    const link = await driveService.getShareLinkByToken(token);
    if (!link) {
      res.status(404).json({ success: false, error: 'Link not found' });
      return;
    }
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      res.status(410).json({ success: false, error: 'Link expired' });
      return;
    }
    const [folder] = await db
      .select({ id: driveItems.id, name: driveItems.name, type: driveItems.type })
      .from(driveItems)
      .where(eq(driveItems.id, link.driveItemId))
      .limit(1);
    if (!folder) {
      res.status(404).json({ success: false, error: 'Target not found' });
      return;
    }
    res.json({
      success: true,
      data: {
        mode: link.mode,
        folderName: folder.name,
        instructions: link.uploadInstructions,
        requireEmail: link.requireUploaderEmail,
        passwordProtected: !!link.passwordHash,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to load share link info');
    res.status(500).json({ success: false, error: 'Failed to load link info' });
  }
});
```

(`logger` is already imported in this file.)

- [ ] **Step 2: Typecheck + smoke test**

Run `cd /Users/gorkemcetin/atlasmail/packages/server && npx tsc --noEmit`. Then:

```bash
# Create a test upload-only link via psql first
psql -U postgres -h localhost -d atlas -c "
UPDATE drive_share_links SET mode='upload_only', upload_instructions='Drop your files here'
WHERE id=(SELECT id FROM drive_share_links LIMIT 1);"
# Fetch info
TOK=$(psql -U postgres -h localhost -d atlas -tAc "SELECT share_token FROM drive_share_links WHERE mode='upload_only' LIMIT 1")
curl -s http://localhost:3001/api/v1/share/$TOK/info | jq
```

Expected: JSON with `mode: "upload_only"`, folder name, instructions.

- [ ] **Step 3: Commit**

```bash
cd /Users/gorkemcetin/atlasmail
git add packages/server/src/routes/share.routes.ts
git commit -m "feat(drive): public GET /share/:token/info endpoint"
git push origin main
```

---

### Task 3.4: Public upload endpoint

**Files:**
- Create: `packages/server/src/apps/drive/controllers/public-upload.controller.ts`
- Modify: `packages/server/src/routes/share.routes.ts`

- [ ] **Step 1: Create controller**

Write `packages/server/src/apps/drive/controllers/public-upload.controller.ts`:

```ts
import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { db } from '../../../config/database';
import { driveItems, driveShareLinks, driveActivityLog } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../../../utils/logger';

const UPLOADS_DIR = path.join(__dirname, '../../../../uploads');

export async function handlePublicUpload(req: Request, res: Response) {
  try {
    const { token } = req.params;
    const { name, email } = req.body as { name?: string; email?: string };

    const [link] = await db.select().from(driveShareLinks).where(eq(driveShareLinks.shareToken, token)).limit(1);
    if (!link) {
      res.status(404).json({ success: false, error: 'Link not found' });
      return;
    }
    if (link.mode !== 'upload_only') {
      res.status(403).json({ success: false, error: 'Not an upload link' });
      return;
    }
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      res.status(410).json({ success: false, error: 'Link expired' });
      return;
    }
    if (link.requireUploaderEmail && (!name || !email)) {
      res.status(400).json({ success: false, error: 'Name and email required' });
      return;
    }

    const [folder] = await db.select().from(driveItems).where(eq(driveItems.id, link.driveItemId)).limit(1);
    if (!folder || folder.type !== 'folder') {
      res.status(404).json({ success: false, error: 'Target folder not found' });
      return;
    }

    const files = (req.files as Express.Multer.File[]) ?? [];
    const created: Array<{ id: string; name: string; size: number }> = [];

    for (const file of files) {
      const storageRel = `${folder.tenantId}/${crypto.randomUUID()}_${Date.now()}_${file.originalname}`;
      const storageAbs = path.join(UPLOADS_DIR, storageRel);
      fs.mkdirSync(path.dirname(storageAbs), { recursive: true });
      fs.writeFileSync(storageAbs, file.buffer);

      const [row] = await db.insert(driveItems).values({
        tenantId: folder.tenantId,
        userId: folder.userId,
        parentId: folder.id,
        name: file.originalname,
        type: 'file',
        mimeType: file.mimetype,
        size: file.size,
        storagePath: storageRel,
        tags: [
          { type: 'upload_source', name: name || 'Anonymous', email: email || null, uploadedAt: new Date().toISOString() },
        ],
      }).returning();

      // drive_activity_log requires tenant_id (NOT NULL)
      await db.insert(driveActivityLog).values({
        driveItemId: row.id,
        tenantId: folder.tenantId,
        userId: folder.userId,
        action: 'public_upload',
        metadata: { uploaderName: name, uploaderEmail: email, viaToken: token },
      });

      created.push({ id: row.id, name: row.name, size: row.size ?? 0 });
    }

    res.json({ success: true, data: { uploaded: created } });
  } catch (error) {
    logger.error({ error }, 'Public upload failed');
    res.status(500).json({ success: false, error: 'Upload failed' });
  }
}
```

Verified against schema: `drive_activity_log.tenant_id` is NOT NULL with FK to tenants — the insert above includes it.

- [ ] **Step 2: Register route with multer + rate limit**

`express-rate-limit` is already in `packages/server/package.json` (^7.4.0), so no install needed. Multer is also already a dep.

Add to `packages/server/src/routes/share.routes.ts`:

```ts
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { handlePublicUpload } from '../apps/drive/controllers/public-upload.controller';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB per file
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // per token+IP
  keyGenerator: (req) => `${req.params.token}:${req.ip}`,
  message: { success: false, error: 'Too many uploads. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

function handleMulterError(err: unknown, _req: Request, res: Response, next: Function) {
  const error = err as { code?: string; message?: string };
  if (error?.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ success: false, error: 'File too large (max 100 MB)' });
    return;
  }
  if (error?.message) {
    res.status(400).json({ success: false, error: error.message });
    return;
  }
  next();
}

router.post('/:token/upload', uploadLimiter, upload.array('files', 10), handleMulterError, handlePublicUpload);
```

- [ ] **Step 3: Typecheck + smoke test**

Run `cd /Users/gorkemcetin/atlasmail/packages/server && npx tsc --noEmit`. Then:

```bash
TOK=$(psql -U postgres -h localhost -d atlas -tAc "SELECT share_token FROM drive_share_links WHERE mode='upload_only' LIMIT 1")
echo "hello test" > /tmp/test.txt
curl -X POST "http://localhost:3001/api/v1/share/$TOK/upload" \
  -F "name=Test Person" \
  -F "email=test@example.com" \
  -F "files=@/tmp/test.txt" -s | jq
```

Expected: `{ "success": true, "data": { "uploaded": [ { "id": "...", "name": "test.txt", "size": 11 } ] } }`

- [ ] **Step 4: Commit**

```bash
cd /Users/gorkemcetin/atlasmail
git add packages/server/src/apps/drive/controllers/public-upload.controller.ts packages/server/src/routes/share.routes.ts
git commit -m "feat(drive): public upload endpoint with rate limit + multer"
git push origin main
```

---

### Task 3.5: Public upload page

**Files:**
- Create: `packages/client/src/pages/drive-upload-public.tsx`
- Modify: `packages/client/src/App.tsx`

- [ ] **Step 1: Create the page**

Write `packages/client/src/pages/drive-upload-public.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Upload, Check, AlertCircle } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';

interface LinkInfo {
  mode: string;
  folderName: string;
  instructions: string | null;
  requireEmail: boolean;
  passwordProtected: boolean;
}

export function DriveUploadPublicPage() {
  const { token } = useParams<{ token: string }>();
  const { t } = useTranslation();
  const [info, setInfo] = useState<LinkInfo | null>(null);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<Array<{ name: string; size: number }>>([]);

  useEffect(() => {
    fetch(`/api/v1/share/${token}/info`)
      .then(r => r.json())
      .then(j => {
        if (!j.success) setError(j.error);
        else setInfo(j.data);
      })
      .catch(() => setError('Failed to load link'));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('name', name);
    fd.append('email', email);
    for (const f of files) fd.append('files', f);
    try {
      const r = await fetch(`/api/v1/share/${token}/upload`, { method: 'POST', body: fd });
      const j = await r.json();
      if (!j.success) setError(j.error);
      else {
        setUploaded((prev) => [...prev, ...j.data.uploaded]);
        setFiles([]);
      }
    } finally {
      setUploading(false);
    }
  };

  if (error) {
    return (
      <div style={{ maxWidth: 480, margin: '80px auto', padding: 'var(--spacing-xl)', textAlign: 'center' }}>
        <AlertCircle size={32} style={{ color: 'var(--color-error)', marginBottom: 16 }} />
        <div style={{ fontSize: 'var(--font-size-md)', color: 'var(--color-text-primary)' }}>{error}</div>
      </div>
    );
  }
  if (!info) return <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>;

  return (
    <div style={{ maxWidth: 520, margin: '48px auto', padding: 'var(--spacing-xl)', fontFamily: 'var(--font-family)' }}>
      <h1 style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 8 }}>{t('drive.upload.heading', { folder: info.folderName })}</h1>
      {info.instructions && (
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 24 }}>{info.instructions}</p>
      )}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        {info.requireEmail && (
          <>
            <Input label={t('drive.upload.nameLabel')} value={name} onChange={(e) => setName(e.target.value)} required />
            <Input label={t('drive.upload.emailLabel')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </>
        )}
        <label style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
          padding: 40, border: '2px dashed var(--color-border-primary)', borderRadius: 'var(--radius-md)',
          cursor: 'pointer', gap: 8,
        }}>
          <Upload size={24} style={{ color: 'var(--color-text-tertiary)' }} />
          <span style={{ color: 'var(--color-text-secondary)' }}>
            {files.length > 0 ? t('drive.upload.filesChosen', { count: files.length }) : t('drive.upload.chooseFiles')}
          </span>
          <input type="file" multiple style={{ display: 'none' }} onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
        </label>
        <Button type="submit" variant="primary" size="md" disabled={files.length === 0 || uploading}>
          {uploading ? t('drive.upload.uploading') : t('drive.upload.submit')}
        </Button>
      </form>
      {uploaded.length > 0 && (
        <div style={{ marginTop: 24, padding: 16, border: '1px solid var(--color-success)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: 'var(--color-success)' }}>
            <Check size={16} />
            <strong>{t('drive.upload.successTitle')}</strong>
          </div>
          <ul>
            {uploaded.map((u, i) => <li key={i} style={{ fontSize: 'var(--font-size-sm)' }}>{u.name}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Register route in App.tsx**

In `packages/client/src/App.tsx`, add the import near the other public-page imports (`SignPublicPage`, `ProposalPublicPage`):

```tsx
import { DriveUploadPublicPage } from './pages/drive-upload-public';
```

And add a route inside `<Routes>`, co-located with the other public routes (around line 110 where `<Route path="/sign/:token" ...>` lives):

```tsx
<Route path="/drive/upload/:token" element={<DriveUploadPublicPage />} />
```

Also add `/drive/upload/` to the `hiddenPaths` list in `GlobalDockWrapper` so the dock doesn't appear on the public page.

- [ ] **Step 3: Add i18n keys**

Add to all 5 locales under `drive`:

- EN: `"upload": { "heading": "Upload files to {{folder}}", "nameLabel": "Your name", "emailLabel": "Email", "chooseFiles": "Click or drop files to upload", "filesChosen_one": "{{count}} file ready", "filesChosen_other": "{{count}} files ready", "uploading": "Uploading…", "submit": "Upload", "successTitle": "Files uploaded" }`
- TR: `"upload": { "heading": "{{folder}} klasörüne dosya yükle", "nameLabel": "Adınız", "emailLabel": "E-posta", "chooseFiles": "Dosya seçmek için tıklayın veya sürükleyin", "filesChosen_one": "{{count}} dosya hazır", "filesChosen_other": "{{count}} dosya hazır", "uploading": "Yükleniyor…", "submit": "Yükle", "successTitle": "Dosyalar yüklendi" }`
- DE: `"upload": { "heading": "Dateien nach {{folder}} hochladen", "nameLabel": "Ihr Name", "emailLabel": "E-Mail", "chooseFiles": "Klicken oder Dateien hierher ziehen", "filesChosen_one": "{{count}} Datei bereit", "filesChosen_other": "{{count}} Dateien bereit", "uploading": "Wird hochgeladen…", "submit": "Hochladen", "successTitle": "Dateien hochgeladen" }`
- FR: `"upload": { "heading": "Téléverser des fichiers dans {{folder}}", "nameLabel": "Votre nom", "emailLabel": "E-mail", "chooseFiles": "Cliquez ou déposez des fichiers à téléverser", "filesChosen_one": "{{count}} fichier prêt", "filesChosen_other": "{{count}} fichiers prêts", "uploading": "Téléversement en cours…", "submit": "Téléverser", "successTitle": "Fichiers téléversés" }`
- IT: `"upload": { "heading": "Carica file in {{folder}}", "nameLabel": "Il tuo nome", "emailLabel": "Email", "chooseFiles": "Clicca o trascina i file per caricarli", "filesChosen_one": "{{count}} file pronto", "filesChosen_other": "{{count}} file pronti", "uploading": "Caricamento in corso…", "submit": "Carica", "successTitle": "File caricati" }`

- [ ] **Step 4: Typecheck + smoke test**

Run `cd /Users/gorkemcetin/atlasmail/packages/client && npx tsc --noEmit`. Open an incognito window, visit `http://localhost:5180/drive/upload/<your-token>`. Fill in name/email, choose a file, submit. Expect success message and a new file in the target folder when you open Drive as the owner.

- [ ] **Step 5: Commit**

```bash
cd /Users/gorkemcetin/atlasmail
git add packages/client/src/pages/drive-upload-public.tsx packages/client/src/App.tsx packages/client/src/i18n/locales/
git commit -m "feat(drive): public upload page + route registration"
git push origin main
```

---

### Task 3.6: Share modal UI for upload-only mode

**Files:**
- Create: `packages/client/src/apps/drive/components/modals/file-request-settings.tsx`
- Modify: `packages/client/src/apps/drive/components/modals/share-modal.tsx`

- [ ] **Step 1: Create the settings sub-component**

Write `packages/client/src/apps/drive/components/modals/file-request-settings.tsx`:

```tsx
import { useTranslation } from 'react-i18next';
import { Input } from '../../../../components/ui/input';
import { Textarea } from '../../../../components/ui/textarea';

interface Props {
  instructions: string;
  requireEmail: boolean;
  onInstructionsChange: (v: string) => void;
  onRequireEmailChange: (v: boolean) => void;
}

export function FileRequestSettings({ instructions, requireEmail, onInstructionsChange, onRequireEmailChange }: Props) {
  const { t } = useTranslation();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-md)' }}>
      <Textarea
        label={t('drive.share.uploadInstructionsLabel')}
        value={instructions}
        onChange={(e) => onInstructionsChange(e.target.value)}
        placeholder={t('drive.share.uploadInstructionsPlaceholder')}
      />
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
        <input type="checkbox" checked={requireEmail} onChange={(e) => onRequireEmailChange(e.target.checked)} />
        <span style={{ fontSize: 'var(--font-size-sm)' }}>{t('drive.share.requireEmail')}</span>
      </label>
    </div>
  );
}
```

- [ ] **Step 2: Integrate into Share modal**

In `packages/client/src/apps/drive/components/modals/share-modal.tsx`:

1. Add a `mode` state (view / edit / upload_only); show a radio or segmented control.
2. If the target item is a folder and user picks upload_only, render `<FileRequestSettings>` below.
3. Hide the upload_only option if the target is a file (not a folder).
4. When creating the share link, pass `mode`, `uploadInstructions`, `requireUploaderEmail` to the mutation.

Concretely: find the existing `createShareLink.mutate(...)` call in share-modal.tsx and extend its body. If the `useCreateShareLink` hook doesn't accept those args yet, extend it in `hooks.ts` first (the API shape already accepts them after Task 3.2).

- [ ] **Step 3: Add i18n keys**

Inside each locale file's existing `"drive": { ... }` block, add a new **nested** `"share"` sub-object (note: the current `drive.share` is a flat string — we're replacing it with an object that contains a `.label` for the existing use, plus the new keys).

Check `grep '"share":' packages/client/src/apps/drive/` for current usages; if the existing flat `drive.share` string is not referenced anywhere, simply add the object. If it IS referenced (e.g. as a menu item), add `label` inside the new object and update the two or three call sites.

EN (the nested structure to add or replace):
```json
"share": {
  "label": "Share",
  "linkType": "Link type",
  "modeView": "View only",
  "modeEdit": "Can edit",
  "modeUploadOnly": "Upload only",
  "uploadOnlyHint": "Visitors can upload files to this folder but cannot see other contents.",
  "uploadInstructionsLabel": "Instructions for uploaders (optional)",
  "uploadInstructionsPlaceholder": "e.g. Please upload your signed contract",
  "requireEmail": "Ask uploaders for name and email"
}
```

TR:
```json
"share": {
  "label": "Paylaş",
  "linkType": "Bağlantı türü",
  "modeView": "Yalnızca görüntüleme",
  "modeEdit": "Düzenleyebilir",
  "modeUploadOnly": "Yalnızca yükleme",
  "uploadOnlyHint": "Ziyaretçiler bu klasöre dosya yükleyebilir ancak içeriği göremez.",
  "uploadInstructionsLabel": "Yükleyenler için talimat (isteğe bağlı)",
  "uploadInstructionsPlaceholder": "örn. İmzalı sözleşmenizi yükleyin",
  "requireEmail": "Ad ve e-posta iste"
}
```

DE:
```json
"share": {
  "label": "Teilen",
  "linkType": "Link-Typ",
  "modeView": "Nur ansehen",
  "modeEdit": "Bearbeiten",
  "modeUploadOnly": "Nur hochladen",
  "uploadOnlyHint": "Besucher können Dateien in diesen Ordner hochladen, sehen aber keine anderen Inhalte.",
  "uploadInstructionsLabel": "Anweisungen für Hochladende (optional)",
  "uploadInstructionsPlaceholder": "z. B. Bitte den unterschriebenen Vertrag hochladen",
  "requireEmail": "Name und E-Mail abfragen"
}
```

FR:
```json
"share": {
  "label": "Partager",
  "linkType": "Type de lien",
  "modeView": "Lecture seule",
  "modeEdit": "Modifier",
  "modeUploadOnly": "Téléversement uniquement",
  "uploadOnlyHint": "Les visiteurs peuvent téléverser des fichiers dans ce dossier sans voir le reste.",
  "uploadInstructionsLabel": "Instructions pour les expéditeurs (facultatif)",
  "uploadInstructionsPlaceholder": "ex. Téléversez votre contrat signé",
  "requireEmail": "Demander le nom et l'e-mail"
}
```

IT:
```json
"share": {
  "label": "Condividi",
  "linkType": "Tipo di link",
  "modeView": "Solo visualizzazione",
  "modeEdit": "Può modificare",
  "modeUploadOnly": "Solo caricamento",
  "uploadOnlyHint": "I visitatori possono caricare file in questa cartella senza vederne il contenuto.",
  "uploadInstructionsLabel": "Istruzioni per chi carica (facoltativo)",
  "uploadInstructionsPlaceholder": "es. Carica il contratto firmato",
  "requireEmail": "Chiedi nome e email"
}
```

- [ ] **Step 4: Typecheck + smoke test**

Run `cd /Users/gorkemcetin/atlasmail/packages/client && npx tsc --noEmit`. In the UI: open Share modal for a folder, pick "Upload only", fill in instructions, create link, copy URL, open incognito, upload a file, confirm it arrives.

- [ ] **Step 5: Commit**

```bash
cd /Users/gorkemcetin/atlasmail
git add packages/client/src/apps/drive/components/modals/ packages/client/src/i18n/locales/
git commit -m "feat(drive): Share modal supports upload-only file request links"
git push origin main
```

---

## Task 4: Final verification

**Files:** none; verification only.

- [ ] **Step 1: Workspace-wide typecheck**

Run: `cd /Users/gorkemcetin/atlasmail && npm run typecheck 2>&1 | tail -15`
Expected: client + shared pass; server may still fail on pre-existing `hrEmployees` reference (not our scope).

- [ ] **Step 2: Client production build**

Run: `cd /Users/gorkemcetin/atlasmail/packages/client && npm run build 2>&1 | tail -5`
Expected: PASS.

- [ ] **Step 3: Manual smoke across three features**

With dev server running:

1. **Bulk bar**: select 3 files in Drive → bar shows "3 selected" → click Trash → all 3 gone from list, found in Trash.
2. **Drag-to-folder**: select 2 files → drag one onto a folder → both files appear in that folder.
3. **Linked records**: open a file that has a `record_links` row → preview panel shows a chip under "Linked records" → click chip → navigates to the target record.
4. **File request link**: open Share modal on a folder → pick Upload only → create → open URL in incognito → upload a file with name/email → back in Drive, see the new file with an "uploaded via link" tag.

- [ ] **Step 4: Confirm all three features committed**

Run: `git log --oneline main~15..HEAD | head -20` and confirm commits covering batch endpoints, DriveBulkBar, drag-to-folder, linked-records service + UI, share-link schema extension, public upload page.

- [ ] **Step 5: No tag, no release**

**Per user instruction: do not run `git tag`, do not run `gh release create`. Leave v1.13.0 as the current tag until explicitly told otherwise.**

---

## Risks & rollback

**Risk 1 (low): Drag-to-folder conflicts with external file drops.** The existing `onDrop` on `.drive-content` handles OS file uploads. The new internal drag uses a custom MIME type (`application/x-atlas-drive-ids`) which won't be present on external drops, so the existing code path remains intact. Tested by the smoke-test in Task 1.5.

**Risk 2 (medium): Public upload rate limit config.** If `express-rate-limit` isn't installed, Task 3.4 will fail at import. Check the package.json first; if missing, halt and report.

**Risk 3 (medium): Multer memory storage for public uploads.** 100 MB limit × 10 files = 1 GB RAM per upload. For a single-tenant demo, acceptable. If abused, tighten the limiter or switch to disk storage.

**Rollback:** Each feature is a series of additive commits. `git revert <sha>..<sha>` removes a feature cleanly. The only irreversible step is the schema migration in Task 3.1; to roll back, drop the 3 columns manually via `psql`.

---

## Out of scope

- Bulk tag UI (endpoint is built, but no UI exposes it yet — future release).
- Linked records for Tasks / Docs / HR (MVP covers CRM / Sign / Invoices only).
- Uploader activity feed on the folder owner's home page (notifications plumbing is there, surfacing them is a UI job for another plan).
- OnlyOffice / Collabora office-file preview (different, larger effort).

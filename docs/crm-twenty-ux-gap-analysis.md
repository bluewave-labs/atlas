# Atlas CRM vs Twenty CRM — UI/UX Gap Analysis

_Research date: 2026-04-01_
_Source: Twenty CRM GitHub (twentyhq/twenty) — codebase structure, component source, README_

This document covers UI/UX patterns where Twenty CRM does something Atlas CRM is missing or does notably worse. Enterprise features, infrastructure, and features Atlas already has are excluded.

---

## 1. Command Menu / Command Palette (Cmd+K)

**What Twenty does:** Twenty has a full command menu (Cmd+K) that acts as a universal search + action launcher. It supports:
- Global search across all record types (contacts, companies, deals, etc.)
- Quick navigation to any page or record
- Contextual actions on the currently viewed record (delete, archive, assign, etc.)
- Record creation directly from the command menu
- Keyboard-first UX — users can accomplish most actions without touching the mouse
- Mobile-specific variant (`CommandMenuForMobile.tsx`)
- Items can be dragged to add to navigation favorites
- Dropdown actions, text inputs, number inputs, and toggles inline within menu items

**What Atlas has:** Basic search within individual list views. No universal command palette.

**Gap severity:** HIGH — This is the single most impactful UX gap. Command palettes are now expected in modern productivity tools (Linear, Notion, Raycast pattern). It dramatically speeds up power-user workflows.

**Recommendation:** Build a `Cmd+K` command palette that:
- Searches across all CRM records (contacts, companies, deals, leads)
- Provides quick navigation (go to dashboard, go to deals, etc.)
- Offers contextual actions (when viewing a contact: edit, delete, create deal, log activity)
- Supports keyboard navigation (arrow keys, Enter to select)

---

## 2. Record Detail Page — Summary Card + Customizable Layout

**What Twenty does:** Record detail pages use a `SummaryCard` component at the top showing:
- Avatar (with upload support for person records)
- Record title as an inline-editable cell
- Key identifier fields rendered inline
- Created-at date
- Action buttons (favorite, more actions via command menu)

Below the summary card, the page uses a **`PageLayoutRenderer`** backed by a **`page-layout` module** that supports:
- Draggable, reorderable field sections (layout-customization module with `isLayoutCustomizationModeEnabled` state)
- Users can enter a "layout customization mode" to rearrange which fields appear and in what order
- Widget system for embedding different content blocks (timeline, relations, etc.)
- Side panel rendering — the same record can be previewed in a slide-out side panel without leaving the current page

**What Atlas has:** Standard detail panel with fixed field order. No drag-to-reorder. No layout customization mode.

**Gap severity:** MEDIUM-HIGH — Layout customization is a differentiator. Users want to put the fields they care about at the top.

**Recommendation:**
- Add a "customize layout" toggle on record detail views that lets users drag-reorder field sections
- Persist layout preferences per user per object type
- Consider a summary card pattern at the top of detail views with avatar + key fields

---

## 3. Record Side Panel (Peek/Preview Drawer)

**What Twenty does:** Twenty has a dedicated `record-side-panel` module. Clicking a record in a list can open it in a right-side slide-out panel instead of navigating away. This lets users:
- Preview record details without losing their place in a list
- Have a split-view experience (list on left, detail on right)
- Open the full record from the side panel via a dedicated button (`RecordShowSidePanelOpenRecordButton`)
- The command menu also works inside the side panel context

**What Atlas has:** Clicking a record navigates to a detail view or opens a modal. No side-panel peek.

**Gap severity:** MEDIUM — This is a quality-of-life improvement that reduces context switching.

**Recommendation:** Add a side panel / drawer that opens when clicking a record from a list, showing key fields and activity timeline. Include an "open full record" button.

---

## 4. Inline Cell Editing in Table View

**What Twenty does:** Twenty has a sophisticated `record-inline-cell` system with 13+ components:
- `RecordInlineCellDisplayMode` / `RecordInlineCellEditMode` — toggle between display and edit
- `RecordInlineCellEditButton` — small pencil icon on hover
- `RecordInlineCellContainer` — handles click-to-edit transitions
- `RecordInlineCellHoveredPortal` — hover state shows edit affordance
- Anchored portals for edit popups that stay positioned correctly
- Works on both table rows AND record detail field sections

Atlas has basic inline editing in tables, but Twenty's implementation is more polished with hover states, portal-based edit popups, and smooth transitions between display/edit modes.

**Gap severity:** LOW-MEDIUM — Atlas has inline editing, but could improve the hover-to-reveal-edit-button pattern and portal-based edit popups.

**Recommendation:** Add hover-to-reveal edit affordances on table cells and detail panel fields. Use portal-based edit popups that feel snappier than switching the cell to an input.

---

## 5. Record Grouping in Table Views

**What Twenty does:** Twenty has a full `record-group` module that allows:
- Grouping table rows by any field (status, assignee, company, etc.)
- Collapsible group sections with headers showing group name + count
- Group-level aggregates
- Works across table view, board view, and calendar view

**What Atlas has:** Kanban board groups by pipeline stage. No grouping in table/list views.

**Gap severity:** MEDIUM — Grouping in list views is a common request. It turns a flat list into an organized overview.

**Recommendation:** Add a "Group by" dropdown to table views that groups rows by select/status fields with collapsible sections.

---

## 6. Record Aggregates (Column Footer Totals)

**What Twenty does:** Twenty has a `record-aggregate` module that calculates aggregates at the bottom of table columns:
- Count, sum, average, min, max per column
- Visible in table footer row
- Works with grouped views (aggregate per group)

**What Atlas has:** Pipeline stage totals on the kanban board. No column-level aggregates in table views.

**Gap severity:** MEDIUM — Sales teams frequently need "total deal value" or "average deal size" at the bottom of a list.

**Recommendation:** Add optional aggregate footer rows to CRM table views (sum for currency columns, count for all columns, average for numeric columns).

---

## 7. Keyboard Shortcut System

**What Twenty does:** Twenty has a dedicated `keyboard-shortcut-menu` module with:
- A shortcut reference overlay (like `?` in Gmail/GitHub)
- Registered hotkeys for common actions
- Navigation shortcuts (go to contacts, go to deals)
- Action shortcuts (new record, delete, archive)
- Integration with the command menu

**What Atlas has:** No keyboard shortcut system.

**Gap severity:** MEDIUM — Power users expect keyboard shortcuts. A shortcut reference overlay is low effort, high polish.

**Recommendation:**
- Add a keyboard shortcut overlay (triggered by `?` or from a help menu)
- Implement basic shortcuts: `C` for new contact, `D` for new deal, `/` for search, `Esc` to close panels
- Show shortcut hints in tooltips and menu items

---

## 8. Favorites / Pinned Navigation

**What Twenty does:** Twenty's navigation sidebar supports:
- Pinning individual records (a specific deal, a specific contact) to the sidebar as favorites
- Drag-and-drop reordering of favorites
- Adding items to navigation directly from the command menu via drag
- Favorites section at the top of the sidebar separate from object type navigation

**What Atlas has:** Pinned saved views in the sidebar. No ability to pin individual records.

**Gap severity:** LOW-MEDIUM — Pinning specific records (like "Acme Corp deal" or "John Smith") to the sidebar is useful for active deals being worked on.

**Recommendation:** Add a "favorite" or "pin" action on records that adds them to a sidebar favorites section.

---

## 9. Visual Data Model / Schema Builder

**What Twenty does:** Settings include a `data-model` module with:
- `graph-overview` — a visual graph showing objects and their relationships
- Object detail pages showing fields and relations
- Visual relation builder between objects
- Field type management with validation schemas

**What Atlas has:** Custom fields per record type. No visual data model or relationship graph.

**Gap severity:** LOW — This is more of an admin/power-user feature, but the visual graph is impressive for understanding the data model.

**Recommendation:** Consider adding a visual relationship map to CRM settings showing how contacts, companies, deals, and leads relate to each other.

---

## 10. Geo Map View

**What Twenty does:** Twenty has a `geo-map` module that shows records on a map based on address fields. This provides a geographic view of contacts/companies.

**What Atlas has:** No map view.

**Gap severity:** LOW — Nice to have for field sales teams, not critical for most users.

**Recommendation:** Low priority. Could add a map view for companies/contacts with address fields if there is user demand.

---

## 11. Calendar View for Records

**What Twenty does:** Twenty has a `record-calendar` module that displays records in a calendar layout:
- Monthly calendar grid
- Calendar cards for records with date fields
- Contextual hooks and states for calendar interactions
- Separate from the activities calendar — this shows any records (deals, tasks) on a calendar

**What Atlas has:** Activity logging with dates, but no calendar visualization of CRM records.

**Gap severity:** MEDIUM — Viewing deals by close date on a calendar, or seeing upcoming follow-ups, is valuable for sales planning.

**Recommendation:** Add a calendar view option for deals (by expected close date) and activities (by date).

---

## 12. AI Module

**What Twenty does:** Twenty has a built-in `ai` module with components, hooks, contexts, and GraphQL integration. This appears to support AI-powered features like:
- Record enrichment
- Writing assistance
- Data suggestions

**What Atlas has:** No AI features.

**Gap severity:** LOW for now, but increasing rapidly. AI enrichment (auto-fill company info from domain) and writing assistance (draft follow-up emails) are becoming table stakes.

**Recommendation:** Future consideration. Start with company enrichment from domain name and email draft suggestions.

---

## 13. Mobile Navigation

**What Twenty does:** Twenty has a dedicated `MobileNavigationBar` component and `CommandMenuForMobile` — purpose-built mobile UX rather than just making desktop responsive.

**What Atlas has:** Responsive layout, but no mobile-specific navigation components.

**Gap severity:** LOW-MEDIUM — Depends on whether mobile CRM usage is a priority.

**Recommendation:** If mobile CRM access is important, build a mobile-specific bottom navigation bar.

---

## Priority Ranking

| # | Feature | Effort | Impact | Priority |
|---|---------|--------|--------|----------|
| 1 | Command palette (Cmd+K) | Medium | Very High | P0 |
| 2 | Record detail layout customization | Medium | High | P1 |
| 3 | Record side panel / peek drawer | Medium | High | P1 |
| 5 | Table row grouping | Medium | Medium | P1 |
| 6 | Column aggregate footers | Small | Medium | P1 |
| 7 | Keyboard shortcut system | Small | Medium | P2 |
| 8 | Favorites / pin records to sidebar | Small | Medium | P2 |
| 11 | Calendar view for records | Medium | Medium | P2 |
| 4 | Polished inline edit (hover portals) | Small | Low-Med | P2 |
| 9 | Visual data model graph | Medium | Low | P3 |
| 10 | Geo map view | Large | Low | P3 |
| 12 | AI module | Large | Low (growing) | P3 |
| 13 | Mobile navigation bar | Medium | Low-Med | P3 |

---

## Summary

The biggest UX gap between Atlas CRM and Twenty CRM is the **command palette** — it is the centerpiece of Twenty's keyboard-first, Notion/Linear-inspired UX. The second major gap is **record detail page customization** (drag-reorder fields, summary card pattern). The third is the **side panel peek drawer** for previewing records without navigating away.

Together, these three features would bring Atlas CRM's UX polish significantly closer to Twenty's standard. The remaining items (grouping, aggregates, shortcuts, favorites) are incremental improvements that compound into a more professional feel.

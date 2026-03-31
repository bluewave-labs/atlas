# Atlas design system

This document covers the CSS design tokens, shared UI component library, layout components, theming system, common patterns, and internationalization.

---

## CSS variables

All design tokens are defined as CSS custom properties in `packages/client/src/styles/theme.css`. Light mode is the default (`:root` and `[data-theme="light"]`); dark mode overrides are scoped to `[data-theme="dark"]`.

### Colors -- light mode

| Variable | Value | Usage |
|----------|-------|-------|
| `--color-bg-primary` | `#ffffff` | Main background |
| `--color-bg-secondary` | `#f5f6f8` | Secondary/sidebar background |
| `--color-bg-tertiary` | `#eef0f3` | Input backgrounds |
| `--color-bg-elevated` | `#ffffff` | Elevated surfaces (modals, cards) |
| `--color-bg-overlay` | `rgba(0, 0, 0, 0.4)` | Modal backdrop |
| `--color-surface-primary` | `#ffffff` | Surface fill |
| `--color-surface-hover` | `#ebedf1` | Hover state |
| `--color-surface-active` | `#e2e5ea` | Active/pressed state |
| `--color-surface-selected` | `#dce1e9` | Selected/current state |
| `--color-text-primary` | `#111318` | Primary text |
| `--color-text-secondary` | `#3b4253` | Secondary text |
| `--color-text-tertiary` | `#5f6b7a` | Muted/helper text |
| `--color-text-inverse` | `#ffffff` | Text on dark backgrounds |
| `--color-text-link` | `#5a7fa0` | Hyperlinks |
| `--color-border-primary` | `#dce0e6` | Primary borders |
| `--color-border-secondary` | `#ebedf1` | Subtle borders |
| `--color-border-focus` | `#7a9ab8` | Focus ring color |
| `--color-accent-primary` | `#5a7fa0` | Brand accent |
| `--color-accent-primary-hover` | `#4d6e8c` | Accent hover |
| `--color-accent-primary-active` | `#3f5c78` | Accent active |
| `--color-accent-subtle` | `color-mix(in srgb, #5a7fa0 10%, transparent)` | Subtle accent tint |
| `--color-accent-subtle-hover` | `color-mix(in srgb, #5a7fa0 16%, transparent)` | Subtle accent hover |
| `--color-success` | `#3a9e7e` | Success green |
| `--color-warning` | `#c4880d` | Warning amber |
| `--color-error` | `#c44040` | Error red |
| `--color-info` | `#5a7fa0` | Info blue |
| `--color-star` | `#d4a017` | Star/favourite gold |

### Colors -- dark mode

| Variable | Value |
|----------|-------|
| `--color-bg-primary` | `#101114` |
| `--color-bg-secondary` | `#181a1e` |
| `--color-bg-tertiary` | `#1f2128` |
| `--color-bg-elevated` | `#252830` |
| `--color-bg-overlay` | `rgba(0, 0, 0, 0.6)` |
| `--color-surface-primary` | `#181a1e` |
| `--color-surface-hover` | `#2e323c` |
| `--color-surface-active` | `#363b47` |
| `--color-surface-selected` | `#1e2a3d` |
| `--color-text-primary` | `#f0f1f4` |
| `--color-text-secondary` | `#adb4c2` |
| `--color-text-tertiary` | `#8e96a8` |
| `--color-text-inverse` | `#1a1d23` |
| `--color-text-link` | `#7a9ab8` |
| `--color-border-primary` | `#333842` |
| `--color-border-secondary` | `#282b34` |
| `--color-border-focus` | `#7a9ab8` |
| `--color-accent-primary` | `#7a9ab8` |
| `--color-accent-primary-hover` | `#8dadc8` |
| `--color-accent-primary-active` | `#6889a5` |
| `--color-success` | `#4dba93` |
| `--color-warning` | `#d4a030` |
| `--color-error` | `#d45c5c` |
| `--color-info` | `#7a9ab8` |
| `--color-star` | `#d4b040` |

### Spacing

| Variable | Value |
|----------|-------|
| `--spacing-xs` | `4px` |
| `--spacing-sm` | `8px` |
| `--spacing-md` | `12px` |
| `--spacing-lg` | `16px` |
| `--spacing-xl` | `24px` |
| `--spacing-2xl` | `32px` |

### Typography

| Variable | Value |
|----------|-------|
| `--font-family` | `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` |
| `--font-mono` | `'JetBrains Mono', 'Fira Code', monospace` |
| `--font-size-xs` | `11px` |
| `--font-size-sm` | `12px` |
| `--font-size-md` | `14px` |
| `--font-size-lg` | `16px` |
| `--font-size-xl` | `20px` |
| `--font-size-2xl` | `24px` |
| `--line-height-tight` | `1.25` |
| `--line-height-normal` | `1.5` |
| `--font-weight-normal` | `420` |
| `--font-weight-medium` | `520` |
| `--font-weight-semibold` | `620` |
| `--font-weight-bold` | `720` |

### Border radius

| Variable | Value |
|----------|-------|
| `--radius-sm` | `4px` |
| `--radius-md` | `6px` |
| `--radius-lg` | `8px` |
| `--radius-xl` | `12px` |
| `--radius-full` | `9999px` |

### Shadows

| Variable | Light value | Dark value |
|----------|-------------|------------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | `0 1px 2px rgba(0,0,0,0.3)` |
| `--shadow-md` | `0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)` | `0 4px 6px -1px rgba(0,0,0,0.4), 0 2px 4px -2px rgba(0,0,0,0.3)` |
| `--shadow-lg` | `0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)` | `0 10px 15px -3px rgba(0,0,0,0.4), 0 4px 6px -4px rgba(0,0,0,0.3)` |
| `--shadow-elevated` | `0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)` | `0 20px 25px -5px rgba(0,0,0,0.5), 0 8px 10px -6px rgba(0,0,0,0.4)` |
| `--shadow-card` | `0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)` | `0 1px 3px rgba(0,0,0,0.2), 0 1px 2px rgba(0,0,0,0.15)` |
| `--shadow-card-hover` | `0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)` | `0 4px 12px rgba(0,0,0,0.25), 0 2px 4px rgba(0,0,0,0.15)` |

### Gradients

| Variable | Value |
|----------|-------|
| `--gradient-card-subtle` | `linear-gradient(135deg, var(--color-bg-elevated) 0%, ...)` |
| `--gradient-accent-subtle` | `linear-gradient(135deg, color-mix(accent 6%, elevated) 0%, ...)` |

### Transitions

| Variable | Value |
|----------|-------|
| `--transition-fast` | `100ms ease` |
| `--transition-normal` | `200ms ease` |
| `--transition-slow` | `300ms ease` |

### Layout dimensions

| Variable | Value |
|----------|-------|
| `--sidebar-width` | `220px` |
| `--header-height` | `48px` |
| `--email-list-width` | `400px` |

---

## Component library

All shared UI components live in `packages/client/src/components/ui/`. Always use these instead of raw HTML elements.

### Form elements

#### Button (`button.tsx`)

Standard button with variant and size support.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'primary' \| 'secondary' \| 'ghost' \| 'danger'` | `'secondary'` | Visual style |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Button height (28/34/40px) |
| `icon` | `ReactNode` | -- | Leading icon |
| `children` | `ReactNode` | -- | Button label text |

```tsx
<Button variant="primary" size="md" icon={<Plus size={14} />}>
  New item
</Button>
```

#### Input (`input.tsx`)

Text input with optional label, error state, and leading icon.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | -- | Above-input label |
| `error` | `string` | -- | Error message (turns border red) |
| `iconLeft` | `ReactNode` | -- | Leading icon |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Input height (28/34/40px) |

```tsx
<Input label="Email" placeholder="user@example.com" error={errors.email} />
```

#### Textarea (`textarea.tsx`)

Multi-line text input with optional label and error.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | -- | Above-input label |
| `error` | `string` | -- | Error message |

```tsx
<Textarea label="Notes" rows={4} />
```

#### Select (`select.tsx`)

Custom dropdown built on Popover. Options can have icons and colors.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | -- | Current selected value |
| `onChange` | `(value: string) => void` | -- | Change handler |
| `options` | `SelectOption[]` | -- | `{ value, label, color?, icon? }` |
| `placeholder` | `string` | `'Select...'` | Placeholder text |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Height (28/34/40px) |
| `width` | `number \| string` | `'100%'` | Dropdown width |
| `disabled` | `boolean` | `false` | Disabled state |

```tsx
<Select
  value={status}
  onChange={setStatus}
  options={[
    { value: 'open', label: 'Open' },
    { value: 'closed', label: 'Closed' },
  ]}
/>
```

#### IconButton (`icon-button.tsx`)

Icon-only button with tooltip, destructive, active, and press effect options.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `icon` | `ReactNode` | -- | Icon element |
| `label` | `string` | -- | Accessible label (also tooltip text) |
| `size` | `number` | `28` | Button size in pixels |
| `tooltip` | `boolean` | `true` | Show tooltip on hover |
| `tooltipSide` | `'top' \| 'bottom' \| 'left' \| 'right'` | `'bottom'` | Tooltip position |
| `destructive` | `boolean` | `false` | Red color on hover |
| `active` | `boolean` | `false` | Active/pressed accent state |
| `activeColor` | `string` | -- | Override active color |
| `pressEffect` | `boolean` | `false` | Scale-down on press |

```tsx
<IconButton icon={<Trash2 size={14} />} label="Delete" destructive />
```

### Size alignment

Input, Button, and Select sizes match for consistent row alignment:

| Size | Height |
|------|--------|
| `sm` | 28px |
| `md` | 34px |
| `lg` | 40px |

Always use the same `size` prop when placing these side-by-side.

---

### Feedback components

#### Badge (`badge.tsx`)

Status label chip with semantic variants.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'default' \| 'primary' \| 'success' \| 'warning' \| 'error'` | `'default'` | Color variant |
| `children` | `ReactNode` | -- | Badge text |

```tsx
<Badge variant="success">Active</Badge>
```

#### Chip (`chip.tsx`)

Removable tag with optional color. Can be clickable or static.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | -- | Chip content |
| `color` | `string` | -- | Color for tint/border/text |
| `onRemove` | `() => void` | -- | Shows X button when provided |
| `onClick` | `() => void` | -- | Makes chip interactive |
| `active` | `boolean` | `false` | Selected state |
| `height` | `number` | `22` | Chip height in pixels |

```tsx
<Chip color="#f97316" onRemove={() => removeTag(id)}>Sales</Chip>
```

#### Skeleton (`skeleton.tsx`)

Shimmer loading placeholder. Also exports `EmailListSkeleton` and `ReadingPaneSkeleton` composites.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `width` | `CSS width` | `'100%'` | Width |
| `height` | `CSS height` | `16` | Height |
| `borderRadius` | `CSS radius` | `4` | Corner radius |

```tsx
<Skeleton width="60%" height={14} />
```

#### Toast (`toast.tsx`)

Notification system with undo support. Mount `<ToastContainer />` near the app root.

Usage via Zustand store:
```tsx
const { addToast } = useToastStore();

// Info toast
addToast({ type: 'info', message: 'Saved' });

// Undo toast (optimistic pattern)
addToast({
  type: 'undo',
  message: 'Item archived',
  undoAction: () => restore(id),
  commitAction: () => archive(id),
  duration: 5000,
});
```

Features: progress bar countdown, undo button with countdown timer, slide-up entrance animation, fade-out exit.

#### Tooltip (`tooltip.tsx`)

Hover help text. Wraps Radix `@radix-ui/react-tooltip`. Must be inside a `<TooltipProvider>`.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `content` | `ReactNode` | -- | Tooltip text |
| `children` | `ReactNode` | -- | Trigger element |
| `side` | `'top' \| 'bottom' \| 'left' \| 'right'` | `'bottom'` | Position |

```tsx
<Tooltip content="Edit item">
  <button>...</button>
</Tooltip>
```

#### StatusDot (`status-dot.tsx`)

Small colored circle for status indication.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `color` | `string` | -- | Dot color |
| `size` | `number` | `8` | Diameter |
| `glow` | `boolean` | `false` | Outer glow shadow |
| `label` | `string` | -- | Accessible label |

---

### Overlay components

#### Modal (`modal.tsx`)

Dialog built on Radix `@radix-ui/react-dialog`. Compound component pattern.

| Component | Props |
|-----------|-------|
| `Modal` (root) | `open`, `onOpenChange`, `width?` (default 480), `maxWidth?`, `height?`, `zIndex?` (default 200), `title?`, `contentStyle?` |
| `Modal.Header` | `title`, `subtitle?`, `children?` (extra actions) |
| `Modal.Body` | `children`, `padding?` |
| `Modal.Footer` | `children` (buttons) |

```tsx
<Modal open={isOpen} onOpenChange={setIsOpen} title="Edit item">
  <Modal.Header title="Edit item" subtitle="Update the details" />
  <Modal.Body>
    <Input label="Name" value={name} onChange={...} />
  </Modal.Body>
  <Modal.Footer>
    <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
    <Button variant="primary" onClick={handleSave}>Save</Button>
  </Modal.Footer>
</Modal>
```

Also exports `ModalSidebarNavButton` for settings-style modals with a sidebar navigation.

#### Popover (`popover.tsx`)

Wraps Radix `@radix-ui/react-popover` with standard styling.

| Component | Props |
|-----------|-------|
| `Popover` | Radix Root (pass `open`, `onOpenChange`) |
| `PopoverTrigger` | Radix Trigger (use with `asChild`) |
| `PopoverContent` | `width?`, `minWidth?`, `sideOffset?` (default 6), `style?`, `align?` |

```tsx
<Popover open={open} onOpenChange={setOpen}>
  <PopoverTrigger asChild>
    <Button>Open menu</Button>
  </PopoverTrigger>
  <PopoverContent width={240}>
    {/* menu items */}
  </PopoverContent>
</Popover>
```

#### ContextMenu (`context-menu.tsx`)

Right-click positioned menu with viewport clamping. Closes on outside click or Escape.

| Component | Props |
|-----------|-------|
| `ContextMenu` | `x`, `y`, `onClose`, `children`, `minWidth?` |
| `ContextMenuItem` | `icon?`, `label`, `onClick`, `destructive?`, `active?`, `disabled?` |
| `ContextMenuSeparator` | (none) |

```tsx
{contextMenu && (
  <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={closeMenu}>
    <ContextMenuItem icon={<Edit size={14} />} label="Edit" onClick={handleEdit} />
    <ContextMenuSeparator />
    <ContextMenuItem icon={<Trash2 size={14} />} label="Delete" onClick={handleDelete} destructive />
  </ContextMenu>
)}
```

#### ConfirmDialog (`confirm-dialog.tsx`)

Destructive action confirmation dialog built on Modal.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | `boolean` | -- | Visibility |
| `onOpenChange` | `(open: boolean) => void` | -- | Toggle handler |
| `title` | `string` | -- | Dialog title |
| `description` | `string` | -- | Explanation text |
| `confirmLabel` | `string` | `t('common.confirm')` | Confirm button text |
| `cancelLabel` | `string` | `t('common.cancel')` | Cancel button text |
| `destructive` | `boolean` | `true` | Red confirm button |
| `onConfirm` | `() => void` | -- | Confirmation handler |

```tsx
<ConfirmDialog
  open={showDelete}
  onOpenChange={setShowDelete}
  title="Delete item"
  description="This action cannot be undone."
  onConfirm={handleDelete}
/>
```

#### CommandPalette (`command-palette.tsx`)

Global keyboard shortcut finder (Cmd+K). Shows all available shortcuts with search filtering. Built on Radix Dialog.

---

### Layout components

#### AppSidebar (`packages/client/src/components/layout/app-sidebar.tsx`)

Resizable sidebar shell for app pages. Persists width to localStorage.

| Prop | Type | Description |
|------|------|-------------|
| `storageKey` | `string` | localStorage key for width (e.g. `'atlas_docs_sidebar'`) |
| `title` | `string` | App title in header |
| `headerAction` | `ReactNode` | Header action button (e.g. "New document") |
| `search` | `ReactNode` | Search bar below header |
| `children` | `ReactNode` | Sidebar content (sections, trees, lists) |
| `footer` | `ReactNode` | Footer content |

Constants: default width 260px, min 200px, max 400px.

```tsx
<div style={{ display: 'flex', height: '100vh' }}>
  <AppSidebar storageKey="atlas_tasks_sidebar" title="Tasks">
    <SidebarSection label="Views">
      <SidebarItem label="Today" icon={<Star size={15} />} isActive />
      <SidebarItem label="All tasks" icon={<List size={15} />} />
    </SidebarSection>
  </AppSidebar>
  <div style={{ flex: 1 }}>
    {/* main content */}
  </div>
</div>
```

#### ContentArea (`content-area.tsx`)

Page content wrapper with header bar, optional breadcrumbs, and action buttons.

| Prop | Type | Description |
|------|------|-------------|
| `title` | `string` | Page title |
| `breadcrumbs` | `BreadcrumbItem[]` | `{ label, onClick? }[]` -- replaces title when provided |
| `actions` | `ReactNode` | Right-side header actions |
| `children` | `ReactNode` | Page content |

```tsx
<ContentArea title="All deals" actions={<Button variant="primary">New deal</Button>}>
  {/* table or list */}
</ContentArea>
```

#### DetailPanel (`detail-panel.tsx`)

Side panel for viewing/editing record details. Has compound sub-components.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | -- | Panel title |
| `subtitle` | `string` | -- | Subtitle |
| `onClose` | `() => void` | -- | Close handler |
| `width` | `number` | `380` | Panel width |
| `headerActions` | `ReactNode` | -- | Extra header buttons |
| `children` | `ReactNode` | -- | Panel body |

Sub-components:
- `DetailPanel.Section` -- grouped section with optional title
- `DetailPanel.Field` -- key-value row

```tsx
<DetailPanel title="Deal details" onClose={close}>
  <DetailPanel.Section title="Overview">
    <DetailPanel.Field label="Value">$50,000</DetailPanel.Field>
    <DetailPanel.Field label="Stage">Negotiation</DetailPanel.Field>
  </DetailPanel.Section>
</DetailPanel>
```

#### ListToolbar (`list-toolbar.tsx`)

Toolbar bar above a list/table with search on the left and actions on the right.

| Prop | Type | Description |
|------|------|-------------|
| `children` | `ReactNode` | Left side (search, filters) |
| `actions` | `ReactNode` | Right side actions |

Sub-component: `ListToolbar.Separator` -- vertical divider line.

```tsx
<ListToolbar actions={<IconButton icon={<Filter size={14} />} label="Filter" />}>
  <Input size="sm" placeholder="Search..." />
</ListToolbar>
```

#### ResizeHandle (`resize-handle.tsx`)

Draggable splitter between two panes. Supports both vertical and horizontal orientation. Uses document-level listeners during drag for smooth UX. Keyboard accessible (arrow keys).

| Prop | Type | Description |
|------|------|-------------|
| `orientation` | `'vertical' \| 'horizontal'` | Split direction |
| `onResize` | `(delta: number) => void` | Resize callback |
| `onResizeEnd` | `() => void` | Persistence callback |

---

### Data display components

#### StatCard (`stat-card.tsx`)

KPI/metric card with optional background icon. Uses monospace font for numbers.

| Prop | Type | Description |
|------|------|-------------|
| `label` | `string` | Metric label (rendered uppercase) |
| `value` | `string \| ReactNode` | Metric value |
| `subtitle` | `string` | Additional context text |
| `color` | `string` | Value and icon color |
| `icon` | `LucideIcon` | Background icon (rendered at 72px, 6% opacity) |

#### InfoCard (`stat-card.tsx`)

Key-value rows card with optional background icon.

| Prop | Type | Description |
|------|------|-------------|
| `title` | `string` | Card title |
| `rows` | `{ label: string; value: string }[]` | Key-value pairs |
| `icon` | `LucideIcon` | Background icon |

#### FieldRow (`field-row.tsx`)

Key-value display row for detail views.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | -- | Field label |
| `children` | `ReactNode` | -- | Field value |
| `direction` | `'horizontal' \| 'vertical'` | `'horizontal'` | Layout direction |

#### ColumnHeader (`column-header.tsx`)

Sortable table column header with arrow indicators.

| Prop | Type | Description |
|------|------|-------------|
| `label` | `string` | Column label |
| `icon` | `ReactNode` | Leading icon |
| `sortable` | `boolean` | Whether sortable |
| `sortColumn` | `string \| null` | Currently sorted column |
| `columnKey` | `string` | This column's key |
| `sortDirection` | `'asc' \| 'desc'` | Current sort direction |
| `onSort` | `(key: string) => void` | Sort handler |

---

### Empty states

#### EmptyState (`empty-state.tsx`)

Full-page empty state with SVG illustrations. Used for inbox-style views.

| Prop | Type | Description |
|------|------|-------------|
| `type` | `'inbox' \| 'search' \| 'archive' \| 'trash'` | Illustration type |
| `title` | `string` | Override title |
| `description` | `string` | Override description |

The `inbox` type includes a celebration particle animation.

#### FeatureEmptyState (`feature-empty-state.tsx`)

Rich empty state for app features with illustration, highlights, and CTA button.

| Prop | Type | Description |
|------|------|-------------|
| `illustration` | `'pipeline' \| 'contacts' \| 'documents' \| 'tasks' \| 'table' \| 'files' \| 'drawings' \| 'employees' \| 'calendar' \| 'generic'` | SVG illustration |
| `title` | `string` | Heading |
| `description` | `string` | Subtext |
| `highlights` | `FeatureHighlight[]` | Collapsible tip cards |
| `actionLabel` | `string` | CTA button label |
| `actionIcon` | `ReactNode` | CTA button icon |
| `onAction` | `() => void` | CTA handler |

Highlights rotate through accent color palettes (green, blue, amber).

---

### Other components

#### Avatar (`avatar.tsx`)

User profile picture with multi-layer fallback chain: explicit `src` then Google Favicon (for business email domains) then Boring Avatars marble gradient with initials overlay. Theme-aware color palettes.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `src` | `string \| null` | -- | Explicit image URL |
| `name` | `string \| null` | -- | User display name |
| `email` | `string` | -- | Email for favicon/initials |
| `size` | `number` | `32` | Pixel size |
| `cssSize` | `string` | -- | CSS variable override |

#### Kbd (`kbd.tsx`)

Keyboard shortcut display. Converts keys to platform-specific symbols (Cmd on Mac, Ctrl elsewhere).

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `shortcut` | `string` | -- | Shortcut string (e.g. `'mod+K'`) |
| `variant` | `'default' \| 'inline'` | `'default'` | Display style |

#### ScrollArea (`scroll-area.tsx`)

Custom scrollbar wrapper. Wraps Radix `@radix-ui/react-scroll-area`.

| Prop | Type | Description |
|------|------|-------------|
| `children` | `ReactNode` | Scrollable content |
| `className` | `string` | Extra CSS class |

#### ConnectionBanner (`connection-banner.tsx`)

Slim bar at the top of the viewport when the API is unreachable. Shows disconnected/reconnecting/restored states.

#### ErrorBoundary (`error-boundary.tsx`)

React error boundary class component. Also exports `QueryErrorFallback` for TanStack Query errors with retry button.

#### SendAnimation (`send-animation.tsx`)

Paper-plane fly-out animation triggered via `atlasmail:email_sent` custom event. Disabled via settings.

---

## Dark mode

### How it works

Theming is driven by the `data-theme` attribute on `<html>`:

```html
<html data-theme="light">  <!-- or "dark" -->
```

The `theme.css` file defines `:root` / `[data-theme="light"]` variables for light mode and `[data-theme="dark"]` overrides. Components reference CSS variables exclusively, so theme switching is instant with no re-render.

### Theme transition

Atlas uses the View Transitions API for smooth theme switching:
- `::view-transition-old(root)` -- clip-path sweep out (500ms)
- `::view-transition-new(root)` -- clip-path sweep in (500ms)
- The `::view-transition` pseudo-element has `pointer-events: none` so dialogs stay interactive during transitions

### Density modes

Three density options controlled by `data-density` attribute: `compact`, `default`, `comfortable`. Adjusts list item heights, padding, and avatar sizes.

---

## Design tokens -- size scale

### Component heights

| Size | Height | Usage |
|------|--------|-------|
| `sm` | 28px | Compact buttons, inputs, selects |
| `md` | 34px | Default buttons, inputs, selects |
| `lg` | 40px | Large buttons, inputs, selects |

### Font scale

| Token | Size | Usage |
|-------|------|-------|
| `--font-size-xs` | 11px | Labels, captions, helper text |
| `--font-size-sm` | 12px | Secondary text, sidebar items |
| `--font-size-md` | 14px | Body text, form inputs |
| `--font-size-lg` | 16px | Section headers |
| `--font-size-xl` | 20px | Page titles, stat values |
| `--font-size-2xl` | 24px | Large headings |

### Weight scale

| Token | Value | Usage |
|-------|-------|-------|
| `--font-weight-normal` | 420 | Body text |
| `--font-weight-medium` | 520 | Labels, active items |
| `--font-weight-semibold` | 620 | Section titles, headings |
| `--font-weight-bold` | 720 | Large stat values |

### Spacing scale

| Token | Value | Usage |
|-------|-------|-------|
| `--spacing-xs` | 4px | Tight gaps (icon to label) |
| `--spacing-sm` | 8px | Small gaps, padding |
| `--spacing-md` | 12px | Medium gaps, section spacing |
| `--spacing-lg` | 16px | Content padding |
| `--spacing-xl` | 24px | Section margins |
| `--spacing-2xl` | 32px | Large margins |

### Radius scale

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 4px | Badges, chips, small elements |
| `--radius-md` | 6px | Buttons, inputs, selects |
| `--radius-lg` | 8px | Cards, popovers, chips |
| `--radius-xl` | 12px | Modals, large cards |
| `--radius-full` | 9999px | Avatars, pill shapes |

---

## Patterns

### Modal pattern

Settings and CRUD modals use the compound `Modal` component:

```tsx
const [open, setOpen] = useState(false);

<Modal open={open} onOpenChange={setOpen} title="Dialog title">
  <Modal.Header title="Dialog title" />
  <Modal.Body>
    {/* form fields */}
  </Modal.Body>
  <Modal.Footer>
    <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
    <Button variant="primary" onClick={handleSubmit}>Save</Button>
  </Modal.Footer>
</Modal>
```

For settings modals with sidebar navigation, use `ModalSidebarNavButton`:

```tsx
<Modal open={open} onOpenChange={setOpen} width={700} title="Settings">
  <div style={{ display: 'flex', height: 500 }}>
    <nav style={{ width: 200, padding: 'var(--spacing-md)' }}>
      <ModalSidebarNavButton
        isActive={panel === 'general'}
        onClick={() => setPanel('general')}
        label="General"
        icon={<Settings size={15} />}
      />
    </nav>
    <Modal.Body>{activePanel}</Modal.Body>
  </div>
</Modal>
```

### Popover pattern

Used for dropdown menus, color pickers, and inline editors:

```tsx
const [open, setOpen] = useState(false);

<Popover open={open} onOpenChange={setOpen}>
  <PopoverTrigger asChild>
    <Button variant="secondary">Options</Button>
  </PopoverTrigger>
  <PopoverContent width={200}>
    {/* menu items */}
  </PopoverContent>
</Popover>
```

### Context menu pattern

Right-click menus. Track coordinates with `onContextMenu`:

```tsx
const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

<div onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY }); }}>
  {/* content */}
</div>

{menu && (
  <ContextMenu x={menu.x} y={menu.y} onClose={() => setMenu(null)}>
    <ContextMenuItem label="Edit" icon={<Edit size={14} />} onClick={handleEdit} />
    <ContextMenuSeparator />
    <ContextMenuItem label="Delete" icon={<Trash2 size={14} />} onClick={handleDelete} destructive />
  </ContextMenu>
)}
```

### Confirm dialog pattern

Wrap destructive actions with a confirmation step:

```tsx
const [showConfirm, setShowConfirm] = useState(false);

<Button variant="danger" onClick={() => setShowConfirm(true)}>Delete</Button>

<ConfirmDialog
  open={showConfirm}
  onOpenChange={setShowConfirm}
  title="Delete item?"
  description="This cannot be undone. The item and all related data will be permanently removed."
  confirmLabel="Delete"
  destructive
  onConfirm={handleDelete}
/>
```

### App page pattern

Standard app page with sidebar + content area:

```tsx
export function MyAppPage() {
  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <AppSidebar storageKey="atlas_myapp_sidebar" title="My app">
        <SidebarSection>
          <SidebarItem label="All items" icon={<List size={15} />} isActive />
        </SidebarSection>
      </AppSidebar>
      <ContentArea title="All items" actions={<Button variant="primary">New</Button>}>
        {/* list, table, or detail view */}
      </ContentArea>
    </div>
  );
}
```

---

## Internationalization (i18n)

Atlas uses `react-i18next` with 5 supported languages.

### Configuration

Setup in `packages/client/src/i18n/index.ts`:
- Uses `i18next-browser-languagedetector` with `localStorage` (`atlasmail-language` key) and `navigator` detection
- Fallback language: `en`
- Interpolation: `escapeValue: false` (React handles escaping)

### Supported languages

| Code | Language |
|------|----------|
| `en` | English |
| `de` | Deutsch |
| `fr` | Francais |
| `it` | Italiano |
| `tr` | Turkce |

### Translation files

Located at `packages/client/src/i18n/locales/{en,de,fr,it,tr}.json`.

### Usage in components

```tsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();
  return <h1>{t('myApp.pageTitle')}</h1>;
}
```

### Adding new strings

1. Add keys to **all 5 locale files** in the same commit
2. Namespace keys by app: `crm.sidebar.deals`, `tasks.actions.create`
3. Use interpolation for dynamic values: `t('items.count', { count: 5 })` with `"{{count}} items"` in JSON
4. Every user-visible string must use `t()` -- no hardcoded English text

### What to translate

- Sidebar labels and section headers
- View titles and page headings
- Button labels and action text
- Form labels and placeholders
- Empty states (title + description)
- Error messages and confirmations
- Toast messages

---

## Component file index

All files in `packages/client/src/components/ui/`:

| File | Component(s) | Category |
|------|-------------|----------|
| `button.tsx` | `Button` | Form |
| `input.tsx` | `Input` | Form |
| `textarea.tsx` | `Textarea` | Form |
| `select.tsx` | `Select` | Form |
| `icon-button.tsx` | `IconButton` | Form |
| `badge.tsx` | `Badge` | Feedback |
| `chip.tsx` | `Chip` | Feedback |
| `skeleton.tsx` | `Skeleton`, `EmailListSkeleton`, `ReadingPaneSkeleton` | Feedback |
| `toast.tsx` | `ToastContainer`, `ToastItem` | Feedback |
| `tooltip.tsx` | `Tooltip`, `TooltipProvider` | Feedback |
| `status-dot.tsx` | `StatusDot` | Feedback |
| `modal.tsx` | `Modal`, `Modal.Header`, `Modal.Body`, `Modal.Footer`, `ModalSidebarNavButton` | Overlay |
| `popover.tsx` | `Popover`, `PopoverTrigger`, `PopoverContent` | Overlay |
| `context-menu.tsx` | `ContextMenu`, `ContextMenuItem`, `ContextMenuSeparator` | Overlay |
| `confirm-dialog.tsx` | `ConfirmDialog` | Overlay |
| `command-palette.tsx` | `CommandPalette` | Overlay |
| `content-area.tsx` | `ContentArea` | Layout |
| `detail-panel.tsx` | `DetailPanel`, `DetailPanel.Section`, `DetailPanel.Field` | Layout |
| `list-toolbar.tsx` | `ListToolbar`, `ListToolbar.Separator` | Layout |
| `resize-handle.tsx` | `ResizeHandle` | Layout |
| `stat-card.tsx` | `StatCard`, `InfoCard` | Data display |
| `field-row.tsx` | `FieldRow` | Data display |
| `column-header.tsx` | `ColumnHeader` | Data display |
| `avatar.tsx` | `Avatar` | Other |
| `kbd.tsx` | `Kbd` | Other |
| `scroll-area.tsx` | `ScrollArea` | Other |
| `empty-state.tsx` | `EmptyState` | Empty states |
| `feature-empty-state.tsx` | `FeatureEmptyState` | Empty states |
| `connection-banner.tsx` | `ConnectionBanner` | Other |
| `error-boundary.tsx` | `ErrorBoundary`, `QueryErrorFallback` | Other |
| `send-animation.tsx` | `SendAnimation` | Other |

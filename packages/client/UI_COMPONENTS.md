# Atlas UI Components Reference

Complete documentation for shared UI components in `/packages/client/src/components/ui/`.

---

## Avatar

**Export:** `Avatar`

**Props Interface:**
```typescript
interface AvatarProps {
  src?: string | null;
  name?: string | null;
  email?: string;
  size?: number;
  cssSize?: string; // CSS size string, overrides size for layout
}
```

**Renders:** User avatar with fallback to initials or theme-aware generated avatar using Boring Avatars. Supports custom image, favicon, or generated avatar based on email/name.

**Usage Example:**
```typescript
import { Avatar } from '@/components/ui/avatar';

<Avatar name="John Doe" email="john@example.com" size={32} />
<Avatar src="https://example.com/avatar.jpg" size={40} />
```

---

## Badge

**Export:** `Badge`

**Props Interface:**
```typescript
interface BadgeProps {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error';
  children: ReactNode;
}
```

**Renders:** Colored badge/label component. Wraps `Chip` with predefined color variants.

**Usage Example:**
```typescript
import { Badge } from '@/components/ui/badge';

<Badge variant="success">Delivered</Badge>
<Badge variant="warning">Pending</Badge>
```

---

## Button

**Export:** `Button`

**Props Interface:**
```typescript
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  children?: ReactNode;
}
```

**Renders:** Standard button with multiple variants and sizes. Supports icon + text.

**Usage Example:**
```typescript
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

<Button variant="primary" size="md">Save</Button>
<Button variant="danger" size="sm" icon={<Plus />}>Create</Button>
```

---

## Chip

**Export:** `Chip`, `CHIP_RADIUS`

**Props Interface:**
```typescript
interface ChipProps {
  children: ReactNode;
  color?: string;
  onRemove?: () => void;
  onClick?: () => void;
  active?: boolean;
  height?: number;
  style?: CSSProperties;
  'aria-label'?: string;
  'aria-pressed'?: boolean;
  title?: string;
}
```

**Renders:** Compact label/tag component with optional remove button and active state.

**Usage Example:**
```typescript
import { Chip } from '@/components/ui/chip';

<Chip color="#3b82f6" onRemove={() => removeTag()}>JavaScript</Chip>
<Chip active onClick={() => selectTag()}>Selected</Chip>
```

---

## ConfirmDialog

**Export:** `ConfirmDialog`

**Props Interface:**
```typescript
interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}
```

**Renders:** Modal dialog for confirmation with destructive warning option. Uses `Modal` internally.

**Usage Example:**
```typescript
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

<ConfirmDialog
  open={isOpen}
  onOpenChange={setIsOpen}
  title="Delete Thread"
  description="This action cannot be undone"
  destructive
  onConfirm={() => deleteThread()}
/>
```

---

## ContextMenu

**Export:** `ContextMenu`, `ContextMenuItem`, `ContextMenuSeparator`

**Props Interfaces:**
```typescript
interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  children: ReactNode;
  minWidth?: number;
}

interface ContextMenuItemProps {
  icon?: ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
  active?: boolean;
  disabled?: boolean;
  children?: ReactNode;
}
```

**Renders:** Fixed-position context menu with viewport clamping. Items with optional icon and state.

**Usage Example:**
```typescript
import { ContextMenu, ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu';

<ContextMenu x={e.clientX} y={e.clientY} onClose={() => setMenu(null)}>
  <ContextMenuItem icon={<Archive />} label="Archive" onClick={() => archive()} />
  <ContextMenuSeparator />
  <ContextMenuItem label="Delete" destructive onClick={() => delete()} />
</ContextMenu>
```

---

## EmptyState

**Export:** `EmptyState`

**Props Interface:**
```typescript
interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  illustration?: 'inbox' | 'search' | 'archive' | 'celebration';
  showCelebration?: boolean;
}
```

**Renders:** Full-page empty state with optional illustration, title, description, and action button.

**Usage Example:**
```typescript
import { EmptyState } from '@/components/ui/empty-state';

<EmptyState
  illustration="inbox"
  title="Inbox Zero"
  description="All caught up!"
  action={<Button>Compose</Button>}
/>
```

---

## IconButton

**Export:** `IconButton`

**Props Interface:**
```typescript
interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: string;
  size?: number;
  tooltip?: boolean;
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right';
  destructive?: boolean;
  active?: boolean;
  activeColor?: string;
  pressEffect?: boolean;
}
```

**Renders:** Small icon-only button with optional tooltip, active state, and press effect.

**Usage Example:**
```typescript
import { IconButton } from '@/components/ui/icon-button';
import { Star, Trash } from 'lucide-react';

<IconButton icon={<Star />} label="Mark as important" active={isStarred} />
<IconButton icon={<Trash />} label="Delete" destructive size={24} />
```

---

## Input

**Export:** `Input`

**Props Interface:**
```typescript
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  iconLeft?: ReactNode;
}
```

**Renders:** Text input field with optional label, error message, and left icon.

**Usage Example:**
```typescript
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

<Input 
  label="Search"
  placeholder="Find emails..."
  iconLeft={<Search size={16} />}
  error={error && "Invalid search"}
/>
```

---

## Kbd

**Export:** `Kbd`

**Props Interface:**
```typescript
interface KbdProps {
  shortcut: string;
  variant?: 'default' | 'inline';
}
```

**Renders:** Keyboard shortcut display with platform-aware symbols (⌘ on Mac, Ctrl on Windows).

**Usage Example:**
```typescript
import { Kbd } from '@/components/ui/kbd';

<Kbd shortcut="mod+k" variant="default" />
<Kbd shortcut="shift+Enter" variant="inline" />
```

---

## Modal

**Export:** `Modal` (compound component)

**Props Interface:**
```typescript
interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  width?: number | string;
  maxWidth?: number | string;
  height?: number | string;
  zIndex?: number;
  children: ReactNode;
  title?: string;
  contentStyle?: React.CSSProperties;
}

// Compound parts:
Modal.Header = ModalHeader
Modal.Body = ModalBody
Modal.Footer = ModalFooter
```

**Renders:** Centered modal dialog with accessible focus management. Compound component for header/body/footer.

**Usage Example:**
```typescript
import { Modal } from '@/components/ui/modal';

<Modal open={isOpen} onOpenChange={setIsOpen} width={480}>
  <Modal.Header>Compose</Modal.Header>
  <Modal.Body>
    <Input placeholder="To:" />
  </Modal.Body>
  <Modal.Footer>
    <Button>Send</Button>
  </Modal.Footer>
</Modal>
```

---

## Popover

**Export:** `Popover`, `PopoverTrigger`, `PopoverContent`

**Props Interface:**
```typescript
interface PopoverContentProps 
  extends Omit<ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>, 'style'> {
  width?: number | string;
  minWidth?: number | string;
  style?: React.CSSProperties;
}
```

**Renders:** Popover using Radix UI with styled content wrapper. `Popover` and `PopoverTrigger` are re-exports from Radix.

**Usage Example:**
```typescript
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

<Popover>
  <PopoverTrigger asChild>
    <Button>Open</Button>
  </PopoverTrigger>
  <PopoverContent width={200}>
    Content here
  </PopoverContent>
</Popover>
```

---

## ScrollArea

**Export:** `ScrollArea`

**Props Interface:**
```typescript
interface ScrollAreaProps {
  children: ReactNode;
  className?: string;
}
```

**Renders:** Scrollable container with custom styled scrollbar using Radix UI ScrollArea.

**Usage Example:**
```typescript
import { ScrollArea } from '@/components/ui/scroll-area';

<ScrollArea className="h-96">
  {/* Long list of items */}
</ScrollArea>
```

---

## Select

**Export:** `Select`, `SelectOption`

**Props Interfaces:**
```typescript
interface SelectOption {
  value: string;
  label: string;
  color?: string;
  icon?: ReactNode;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  size?: 'sm' | 'md';
  width?: number | string;
  disabled?: boolean;
  style?: CSSProperties;
}
```

**Renders:** Dropdown select using Popover with icon/color support per option.

**Usage Example:**
```typescript
import { Select } from '@/components/ui/select';

<Select
  value={selected}
  onChange={setSelected}
  options={[
    { value: 'inbox', label: 'Inbox' },
    { value: 'archive', label: 'Archive' },
  ]}
  placeholder="Select folder..."
/>
```

---

## Skeleton

**Export:** `Skeleton`, `EmailListSkeleton`, `ReadingPaneSkeleton`

**Props Interface:**
```typescript
interface SkeletonProps {
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
  borderRadius?: CSSProperties['borderRadius'];
  style?: CSSProperties;
}
```

**Renders:** Shimmer loading placeholder. Base `Skeleton` for custom layouts, plus preset `EmailListSkeleton` and `ReadingPaneSkeleton`.

**Usage Example:**
```typescript
import { Skeleton, EmailListSkeleton, ReadingPaneSkeleton } from '@/components/ui/skeleton';

<Skeleton width="100%" height={16} borderRadius={4} />
<EmailListSkeleton />
<ReadingPaneSkeleton />
```

---

## Toast

**Export:** `ToastContainer`, (Toast type from store)

**Props Interface:**
```typescript
// Toast type from toast-store:
interface Toast {
  id: string;
  type: 'info' | 'undo';
  message: string;
  duration?: number;
  undoAction?: () => void;
  commitAction?: () => void;
}
```

**Renders:** Fixed notification container at bottom-center. Managed via `useToastStore()`.

**Usage Example:**
```typescript
import { ToastContainer } from '@/components/ui/toast';
import { useToastStore } from '@/stores/toast-store';

// Mount once in your app root:
<ToastContainer />

// Then show toasts:
const { addToast } = useToastStore();
addToast({ type: 'info', message: 'Thread archived' });
addToast({
  type: 'undo',
  message: 'Deleted 3 emails',
  undoAction: () => restore(),
  commitAction: () => delete(),
  duration: 5000,
});
```

---

## Tooltip

**Export:** `Tooltip`, `TooltipProvider`

**Props Interface:**
```typescript
interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  shortcut?: string;
}
```

**Renders:** Floating tooltip using Radix UI. Wrap your app with `TooltipProvider` once at the top.

**Usage Example:**
```typescript
import { Tooltip, TooltipProvider } from '@/components/ui/tooltip';

// In app root:
<TooltipProvider>
  <App />
</TooltipProvider>

// In components:
<Tooltip content="Archive this thread" side="top">
  <IconButton icon={<Archive />} label="Archive" />
</Tooltip>
```

---

## Summary Table

| Component | Type | Purpose |
|-----------|------|---------|
| Avatar | Display | User profile picture with fallback |
| Badge | Display | Colored status label |
| Button | Input | Primary action element |
| Chip | Display | Removable tag/label |
| ConfirmDialog | Modal | Destructive action confirmation |
| ContextMenu | Menu | Right-click menu |
| EmptyState | Display | Empty page illustration |
| IconButton | Input | Icon-only button |
| Input | Input | Text field with validation |
| Kbd | Display | Keyboard shortcut |
| Modal | Modal | Dialog window |
| Popover | Popup | Positioning popover |
| ScrollArea | Container | Custom scrollable area |
| Select | Input | Dropdown selector |
| Skeleton | Loading | Shimmer placeholder |
| Toast | Notification | Bottom notification |
| Tooltip | Popup | Hover help text |

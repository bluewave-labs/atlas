import { useState, type ReactElement } from 'react';
import { Settings2, Eye, Zap } from 'lucide-react';
import {
  useTasksSettingsStore,
  type TaskDefaultView,
  type TaskCompletedBehavior,
  type TaskSortOrder,
  type TaskViewMode,
} from '../settings-store';
import {
  SettingsSection,
  SettingsRow,
  SettingsToggle,
  SettingsSelect,
} from '../../../components/settings/settings-primitives';
import { Modal, ModalSidebarNavButton } from '../../../components/ui/modal';
import type { CSSProperties } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TasksNavItemId = 'general' | 'appearance' | 'behavior';

interface TasksSidebarNavItem {
  id: TasksNavItemId;
  label: string;
  icon: typeof Settings2;
}

interface TasksSidebarSection {
  title: string;
  items: TasksSidebarNavItem[];
}

// ---------------------------------------------------------------------------
// Panel: General
// ---------------------------------------------------------------------------

const DEFAULT_VIEW_OPTIONS: Array<{ value: TaskDefaultView; label: string }> = [
  { value: 'inbox', label: 'Inbox' },
  { value: 'today', label: 'Today' },
  { value: 'anytime', label: 'Anytime' },
];

const VIEW_MODE_OPTIONS: Array<{ value: TaskViewMode; label: string }> = [
  { value: 'list', label: 'List' },
  { value: 'board', label: 'Board' },
];

export function TasksGeneralPanel() {
  const {
    defaultView, setDefaultView,
    viewMode, setViewMode,
    confirmBeforeDelete, setConfirmBeforeDelete,
    showCalendarInToday, setShowCalendarInToday,
    showEveningSection, setShowEveningSection,
  } = useTasksSettingsStore();

  return (
    <div>
      <SettingsSection title="Navigation" description="Configure default navigation behavior.">
        <SettingsRow label="Default view" description="Which section opens when you navigate to tasks.">
          <SettingsSelect
            value={defaultView}
            options={DEFAULT_VIEW_OPTIONS}
            onChange={setDefaultView}
          />
        </SettingsRow>
        <SettingsRow label="Default view mode" description="List or board layout for the inbox view.">
          <SettingsSelect
            value={viewMode}
            options={VIEW_MODE_OPTIONS}
            onChange={setViewMode}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Today view" description="Customize what appears in the Today section.">
        <SettingsRow label="Show calendar events" description="Display today's schedule above your tasks.">
          <SettingsToggle checked={showCalendarInToday} onChange={setShowCalendarInToday} label="Show calendar events" />
        </SettingsRow>
        <SettingsRow label="Evening section" description="Split Today into daytime and evening groups.">
          <SettingsToggle checked={showEveningSection} onChange={setShowEveningSection} label="Evening section" />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Safety">
        <SettingsRow label="Confirm before deleting" description="Show a confirmation before deleting tasks.">
          <SettingsToggle checked={confirmBeforeDelete} onChange={setConfirmBeforeDelete} label="Confirm before deleting" />
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel: Appearance
// ---------------------------------------------------------------------------

export function TasksAppearancePanel() {
  const {
    showWhenBadges, setShowWhenBadges,
    showProjectInList, setShowProjectInList,
    showNotesIndicator, setShowNotesIndicator,
    compactMode, setCompactMode,
  } = useTasksSettingsStore();

  return (
    <div>
      <SettingsSection title="Task list" description="Control what's visible on each task row.">
        <SettingsRow label="When badges" description="Show star, moon, or calendar icons for task timing.">
          <SettingsToggle checked={showWhenBadges} onChange={setShowWhenBadges} label="When badges" />
        </SettingsRow>
        <SettingsRow label="Project name" description="Show the project name on tasks in project views.">
          <SettingsToggle checked={showProjectInList} onChange={setShowProjectInList} label="Project name" />
        </SettingsRow>
        <SettingsRow label="Notes indicator" description="Show an icon when a task has notes or subtasks.">
          <SettingsToggle checked={showNotesIndicator} onChange={setShowNotesIndicator} label="Notes indicator" />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Density">
        <SettingsRow label="Compact mode" description="Reduce padding for a denser task list.">
          <SettingsToggle checked={compactMode} onChange={setCompactMode} label="Compact mode" />
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel: Behavior
// ---------------------------------------------------------------------------

const COMPLETED_OPTIONS: Array<{ value: TaskCompletedBehavior; label: string }> = [
  { value: 'fade', label: 'Fade out' },
  { value: 'move', label: 'Move to completed' },
  { value: 'hide', label: 'Hide immediately' },
];

const SORT_OPTIONS: Array<{ value: TaskSortOrder; label: string }> = [
  { value: 'manual', label: 'Manual (drag to reorder)' },
  { value: 'priority', label: 'Priority' },
  { value: 'dueDate', label: 'Due date' },
  { value: 'title', label: 'Title (A-Z)' },
  { value: 'created', label: 'Date created' },
];

export function TasksBehaviorPanel() {
  const {
    completedBehavior, setCompletedBehavior,
    defaultSortOrder, setDefaultSortOrder,
  } = useTasksSettingsStore();

  return (
    <div>
      <SettingsSection title="Completion" description="What happens when you check off a task.">
        <SettingsRow label="Completed tasks" description="How completed tasks behave in the list.">
          <SettingsSelect
            value={completedBehavior}
            options={COMPLETED_OPTIONS}
            onChange={setCompletedBehavior}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Sorting" description="Default sort order for task lists.">
        <SettingsRow label="Sort order" description="How tasks are ordered within each section.">
          <SettingsSelect
            value={defaultSortOrder}
            options={SORT_OPTIONS}
            onChange={setDefaultSortOrder}
          />
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel map
// ---------------------------------------------------------------------------

const PANELS: Record<TasksNavItemId, () => ReactElement> = {
  general: TasksGeneralPanel,
  appearance: TasksAppearancePanel,
  behavior: TasksBehaviorPanel,
};

const SIDEBAR_SECTIONS: TasksSidebarSection[] = [
  {
    title: 'Tasks',
    items: [
      { id: 'general', label: 'General', icon: Settings2 },
      { id: 'appearance', label: 'Appearance', icon: Eye },
      { id: 'behavior', label: 'Behavior', icon: Zap },
    ],
  },
];

const PANEL_TITLES: Record<TasksNavItemId, string> = {
  general: 'General',
  appearance: 'Appearance',
  behavior: 'Behavior',
};

const PANEL_DESCRIPTIONS: Record<TasksNavItemId, string> = {
  general: 'Navigation, Today view, and safety options',
  appearance: 'Control what appears on task rows',
  behavior: 'Completion and sorting preferences',
};

// ---------------------------------------------------------------------------
// Main modal
// ---------------------------------------------------------------------------

interface TasksSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function TasksSettingsModal({ open, onClose }: TasksSettingsModalProps) {
  const [activeItem, setActiveItem] = useState<TasksNavItemId>('general');
  const ActivePanel = PANELS[activeItem];

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      width={660}
      height={520}
      title="Tasks settings"
    >
      {/* Left sidebar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: 200,
          flexShrink: 0,
          background: 'var(--color-bg-secondary)',
          borderRight: '1px solid var(--color-border-primary)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          padding: 'var(--spacing-lg) var(--spacing-sm)',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            padding: 'var(--spacing-sm) var(--spacing-md)',
            marginBottom: 'var(--spacing-md)',
          }}
        >
          <span
            style={{
              fontSize: 'var(--font-size-lg)',
              fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-family)',
            }}
          >
            Settings
          </span>
        </div>

        {SIDEBAR_SECTIONS.map((section) => (
          <div key={section.title}>
            <div
              style={{
                padding: 'var(--spacing-xs) var(--spacing-md)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
                color: 'var(--color-text-tertiary)',
                fontFamily: 'var(--font-family)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 2,
              }}
            >
              {section.title}
            </div>

            {section.items.map(({ id, label, icon: Icon }) => (
              <ModalSidebarNavButton
                key={id}
                isActive={activeItem === id}
                onClick={() => setActiveItem(id)}
                label={label}
                icon={<Icon size={16} />}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Right content area */}
      <div
        style={{
          marginLeft: 200,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <Modal.Header title={PANEL_TITLES[activeItem]} subtitle={PANEL_DESCRIPTIONS[activeItem]} />
        <Modal.Body>
          <ActivePanel />
        </Modal.Body>
      </div>
    </Modal>
  );
}

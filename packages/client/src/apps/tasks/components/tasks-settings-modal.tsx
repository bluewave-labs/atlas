import { useState, type ReactElement } from 'react';
import { Settings2, Eye, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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

function useDefaultViewOptions(): Array<{ value: TaskDefaultView; label: string }> {
  const { t } = useTranslation();
  return [
    { value: 'inbox', label: t('tasks.settings.optionInbox') },
    { value: 'today', label: t('tasks.settings.optionToday') },
    { value: 'anytime', label: t('tasks.settings.optionAnytime') },
  ];
}

function useViewModeOptions(): Array<{ value: TaskViewMode; label: string }> {
  const { t } = useTranslation();
  return [
    { value: 'list', label: t('tasks.settings.optionList') },
    { value: 'board', label: t('tasks.settings.optionBoard') },
  ];
}

export function TasksGeneralPanel() {
  const { t } = useTranslation();
  const {
    defaultView, setDefaultView,
    viewMode, setViewMode,
    confirmBeforeDelete, setConfirmBeforeDelete,
    showCalendarInToday, setShowCalendarInToday,
    showEveningSection, setShowEveningSection,
  } = useTasksSettingsStore();
  const defaultViewOptions = useDefaultViewOptions();
  const viewModeOptions = useViewModeOptions();

  return (
    <div>
      <SettingsSection title={t('tasks.settings.navigation')} description={t('tasks.settings.navigationDesc')}>
        <SettingsRow label={t('tasks.settings.defaultView')} description={t('tasks.settings.defaultViewDesc')}>
          <SettingsSelect
            value={defaultView}
            options={defaultViewOptions}
            onChange={setDefaultView}
          />
        </SettingsRow>
        <SettingsRow label={t('tasks.settings.defaultViewMode')} description={t('tasks.settings.defaultViewModeDesc')}>
          <SettingsSelect
            value={viewMode}
            options={viewModeOptions}
            onChange={setViewMode}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title={t('tasks.settings.todayView')} description={t('tasks.settings.todayViewDesc')}>
        <SettingsRow label={t('tasks.settings.showCalendarEvents')} description={t('tasks.settings.showCalendarEventsDesc')}>
          <SettingsToggle checked={showCalendarInToday} onChange={setShowCalendarInToday} label={t('tasks.settings.showCalendarEvents')} />
        </SettingsRow>
        <SettingsRow label={t('tasks.settings.eveningSection')} description={t('tasks.settings.eveningSectionDesc')}>
          <SettingsToggle checked={showEveningSection} onChange={setShowEveningSection} label={t('tasks.settings.eveningSection')} />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title={t('tasks.settings.safety')}>
        <SettingsRow label={t('tasks.settings.confirmBeforeDeleting')} description={t('tasks.settings.confirmBeforeDeletingDesc')}>
          <SettingsToggle checked={confirmBeforeDelete} onChange={setConfirmBeforeDelete} label={t('tasks.settings.confirmBeforeDeleting')} />
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel: Appearance
// ---------------------------------------------------------------------------

export function TasksAppearancePanel() {
  const { t } = useTranslation();
  const {
    showWhenBadges, setShowWhenBadges,
    showProjectInList, setShowProjectInList,
    showNotesIndicator, setShowNotesIndicator,
    compactMode, setCompactMode,
  } = useTasksSettingsStore();

  return (
    <div>
      <SettingsSection title={t('tasks.settings.taskList')} description={t('tasks.settings.taskListDesc')}>
        <SettingsRow label={t('tasks.settings.whenBadges')} description={t('tasks.settings.whenBadgesDesc')}>
          <SettingsToggle checked={showWhenBadges} onChange={setShowWhenBadges} label={t('tasks.settings.whenBadges')} />
        </SettingsRow>
        <SettingsRow label={t('tasks.settings.projectName')} description={t('tasks.settings.projectNameDesc')}>
          <SettingsToggle checked={showProjectInList} onChange={setShowProjectInList} label={t('tasks.settings.projectName')} />
        </SettingsRow>
        <SettingsRow label={t('tasks.settings.notesIndicator')} description={t('tasks.settings.notesIndicatorDesc')}>
          <SettingsToggle checked={showNotesIndicator} onChange={setShowNotesIndicator} label={t('tasks.settings.notesIndicator')} />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title={t('tasks.settings.density')}>
        <SettingsRow label={t('tasks.settings.compactMode')} description={t('tasks.settings.compactModeDesc')}>
          <SettingsToggle checked={compactMode} onChange={setCompactMode} label={t('tasks.settings.compactMode')} />
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel: Behavior
// ---------------------------------------------------------------------------

function useCompletedOptions(): Array<{ value: TaskCompletedBehavior; label: string }> {
  const { t } = useTranslation();
  return [
    { value: 'fade', label: t('tasks.settings.optionFadeOut') },
    { value: 'move', label: t('tasks.settings.optionMoveToCompleted') },
    { value: 'hide', label: t('tasks.settings.optionHideImmediately') },
  ];
}

function useSortOptions(): Array<{ value: TaskSortOrder; label: string }> {
  const { t } = useTranslation();
  return [
    { value: 'manual', label: t('tasks.settings.optionManual') },
    { value: 'priority', label: t('tasks.settings.optionPriority') },
    { value: 'dueDate', label: t('tasks.settings.optionDueDate') },
    { value: 'title', label: t('tasks.settings.optionTitleAZ') },
    { value: 'created', label: t('tasks.settings.optionDateCreated') },
  ];
}

export function TasksBehaviorPanel() {
  const { t } = useTranslation();
  const {
    completedBehavior, setCompletedBehavior,
    defaultSortOrder, setDefaultSortOrder,
  } = useTasksSettingsStore();
  const completedOptions = useCompletedOptions();
  const sortOptions = useSortOptions();

  return (
    <div>
      <SettingsSection title={t('tasks.settings.completion')} description={t('tasks.settings.completionDesc')}>
        <SettingsRow label={t('tasks.settings.completedTasks')} description={t('tasks.settings.completedTasksDesc')}>
          <SettingsSelect
            value={completedBehavior}
            options={completedOptions}
            onChange={setCompletedBehavior}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title={t('tasks.settings.sorting')} description={t('tasks.settings.sortingDesc')}>
        <SettingsRow label={t('tasks.settings.sortOrder')} description={t('tasks.settings.sortOrderDesc')}>
          <SettingsSelect
            value={defaultSortOrder}
            options={sortOptions}
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

// These are now functions using translation hooks - moved into the modal component

// ---------------------------------------------------------------------------
// Main modal
// ---------------------------------------------------------------------------

interface TasksSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function TasksSettingsModal({ open, onClose }: TasksSettingsModalProps) {
  const { t } = useTranslation();
  const [activeItem, setActiveItem] = useState<TasksNavItemId>('general');
  const ActivePanel = PANELS[activeItem];

  const sidebarSections: TasksSidebarSection[] = [
    {
      title: t('tasks.settings.tasksLabel'),
      items: [
        { id: 'general', label: t('tasks.settings.general'), icon: Settings2 },
        { id: 'appearance', label: t('tasks.settings.appearance'), icon: Eye },
        { id: 'behavior', label: t('tasks.settings.behavior'), icon: Zap },
      ],
    },
  ];

  const panelTitles: Record<TasksNavItemId, string> = {
    general: t('tasks.settings.general'),
    appearance: t('tasks.settings.appearance'),
    behavior: t('tasks.settings.behavior'),
  };

  const panelDescriptions: Record<TasksNavItemId, string> = {
    general: t('tasks.settings.generalDesc'),
    appearance: t('tasks.settings.appearanceDesc'),
    behavior: t('tasks.settings.behaviorDesc'),
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      width={660}
      height={520}
      title={t('tasks.settings.modalTitle')}
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
            {t('tasks.settings.title')}
          </span>
        </div>

        {sidebarSections.map((section) => (
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
        <Modal.Header title={panelTitles[activeItem]} subtitle={panelDescriptions[activeItem]} />
        <Modal.Body>
          <ActivePanel />
        </Modal.Body>
      </div>
    </Modal>
  );
}

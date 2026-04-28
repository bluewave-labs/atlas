import { useTranslation } from 'react-i18next';
import {
  SettingsSection,
  SettingsRow,
  SettingsToggle,
  SettingsSelect,
} from '../../../../components/settings/settings-primitives';
import {
  useTasksSettingsStore,
  type TaskDefaultView,
  type TaskCompletedBehavior,
  type TaskSortOrder,
  type TaskViewMode,
} from '../../settings-store';

export function WorkBehaviorPanel() {
  const { t } = useTranslation();
  const s = useTasksSettingsStore();

  const viewOptions: Array<{ value: TaskDefaultView; label: string }> = [
    { value: 'inbox', label: t('work.settings.behavior.viewInbox') },
    { value: 'today', label: t('work.settings.behavior.viewToday') },
    { value: 'anytime', label: t('work.settings.behavior.viewAnytime') },
  ];

  const viewModeOptions: Array<{ value: TaskViewMode; label: string }> = [
    { value: 'list', label: t('work.settings.behavior.viewModeList') },
    { value: 'board', label: t('work.settings.behavior.viewModeBoard') },
    { value: 'table', label: t('work.settings.behavior.viewModeTable') },
  ];

  const sortOptions: Array<{ value: TaskSortOrder; label: string }> = [
    { value: 'manual', label: t('work.settings.behavior.sortManual') },
    { value: 'priority', label: t('work.settings.behavior.sortPriority') },
    { value: 'dueDate', label: t('work.settings.behavior.sortDueDate') },
    { value: 'title', label: t('work.settings.behavior.sortTitle') },
    { value: 'created', label: t('work.settings.behavior.sortCreated') },
  ];

  const completedOptions: Array<{ value: TaskCompletedBehavior; label: string }> = [
    { value: 'fade', label: t('work.settings.behavior.completedFade') },
    { value: 'move', label: t('work.settings.behavior.completedMove') },
    { value: 'hide', label: t('work.settings.behavior.completedHide') },
  ];

  return (
    <div>
      <SettingsSection
        title={t('work.settings.behavior.defaultsTitle')}
        description={t('work.settings.behavior.defaultsDescription')}
      >
        <SettingsRow
          label={t('work.settings.behavior.defaultView')}
          description={t('work.settings.behavior.defaultViewHelp')}
        >
          <SettingsSelect<TaskDefaultView>
            value={s.defaultView}
            options={viewOptions}
            onChange={s.setDefaultView}
          />
        </SettingsRow>
        <SettingsRow
          label={t('work.settings.behavior.viewMode')}
          description={t('work.settings.behavior.viewModeHelp')}
        >
          <SettingsSelect<TaskViewMode>
            value={s.viewMode}
            options={viewModeOptions}
            onChange={s.setViewMode}
          />
        </SettingsRow>
        <SettingsRow
          label={t('work.settings.behavior.defaultSortOrder')}
          description={t('work.settings.behavior.defaultSortOrderHelp')}
        >
          <SettingsSelect<TaskSortOrder>
            value={s.defaultSortOrder}
            options={sortOptions}
            onChange={s.setDefaultSortOrder}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title={t('work.settings.behavior.actionsTitle')}>
        <SettingsRow
          label={t('work.settings.behavior.completedBehavior')}
          description={t('work.settings.behavior.completedBehaviorHelp')}
        >
          <SettingsSelect<TaskCompletedBehavior>
            value={s.completedBehavior}
            options={completedOptions}
            onChange={s.setCompletedBehavior}
          />
        </SettingsRow>
        <SettingsRow
          label={t('work.settings.behavior.confirmBeforeDelete')}
          description={t('work.settings.behavior.confirmBeforeDeleteHelp')}
        >
          <SettingsToggle
            checked={s.confirmBeforeDelete}
            onChange={s.setConfirmBeforeDelete}
            label={t('work.settings.behavior.confirmBeforeDelete')}
          />
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}

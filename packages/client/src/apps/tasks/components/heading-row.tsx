import { ChevronDown, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Task } from '@atlas-platform/shared';
import { useAppActions } from '../../../hooks/use-app-permissions';
import { IconButton } from '../../../components/ui/icon-button';

export function HeadingRow({
  task,
  childCount,
  isCollapsed,
  onToggle,
  onDelete,
}: {
  task: Task;
  childCount: number;
  isCollapsed: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const { canDelete } = useAppActions('tasks');
  return (
    <div className="task-heading-row">
      <button className="task-heading-toggle" onClick={onToggle}>
        <ChevronDown size={13} className={`task-section-chevron${isCollapsed ? ' collapsed' : ''}`} />
      </button>
      <span className="task-heading-title">{task.title}</span>
      <span className="task-heading-count">{childCount}</span>
      {canDelete && (
        <IconButton
          icon={<X size={12} />}
          label={t('tasks.deleteSection')}
          size={24}
          destructive
          className="task-heading-delete"
          onClick={onDelete}
        />
      )}
    </div>
  );
}

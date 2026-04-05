import { Star, Moon, Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TaskWhen } from '@atlasmail/shared';
import { formatDueDate } from '../lib/helpers';

export function WhenBadge({ when, dueDate, showBadge }: { when: TaskWhen; dueDate: string | null; showBadge: boolean }) {
  const { t } = useTranslation();
  if (!showBadge) return null;

  if (when === 'today') {
    return <span className="task-when-badge today" title={t('tasks.todayLabel')}><Star size={12} /></span>;
  }
  if (when === 'evening') {
    return <span className="task-when-badge evening" title={t('tasks.thisEvening')}><Moon size={12} /></span>;
  }
  if (dueDate) {
    return <span className="task-when-badge upcoming" title={formatDueDate(dueDate, t)}><Calendar size={12} /></span>;
  }
  return null;
}

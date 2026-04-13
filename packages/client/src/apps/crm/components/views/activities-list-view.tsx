import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate } from '../../../../lib/format';
import { Clock, Calendar, User, FileText, Tag, Mail, Users } from 'lucide-react';
import type { CrmActivity } from '../../hooks';
import { getActivityIcon, getActivityLabel, getActivityDueStatus, getActivityDueLabel, DUE_STATUS_COLORS } from '../../lib/crm-helpers';
import { DataTable, type DataTableColumn } from '../../../../components/ui/data-table';
import { Badge } from '../../../../components/ui/badge';
import { FeatureEmptyState } from '../../../../components/ui/feature-empty-state';

export function ActivitiesListView({
  activities, searchQuery,
}: {
  activities: CrmActivity[];
  searchQuery: string;
}) {
  const { t } = useTranslation();
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return activities;
    const q = searchQuery.toLowerCase();
    return activities.filter((a) =>
      a.body.toLowerCase().includes(q) ||
      a.type.toLowerCase().includes(q),
    );
  }, [activities, searchQuery]);

  const columns: DataTableColumn<CrmActivity>[] = useMemo(() => [
    {
      key: 'type',
      label: t('crm.activities.type'),
      icon: <Tag size={12} />,
      width: 120,
      sortable: true,
      compare: (a, b) => a.type.localeCompare(b.type),
      searchValue: (item) => getActivityLabel(item.type, t),
      render: (item) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
          {getActivityIcon(item.type)}
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', textTransform: 'capitalize' }}>
            {getActivityLabel(item.type, t)}
          </span>
        </div>
      ),
    },
    {
      key: 'body',
      label: t('crm.activities.description'),
      icon: <FileText size={12} />,
      sortable: true,
      compare: (a, b) => a.body.localeCompare(b.body),
      searchValue: (item) => item.body,
      render: (item) => (
        <span
          style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            ...(item.completedAt ? { textDecoration: 'line-through', opacity: 0.6 } : {}),
          }}
        >
          {item.body}
        </span>
      ),
    },
    {
      key: 'assignedUser',
      label: t('crm.activities.assignedTo'),
      icon: <User size={12} />,
      width: 140,
      sortable: true,
      compare: (a, b) => (a.assignedUserName || '').localeCompare(b.assignedUserName || ''),
      searchValue: (item) => item.assignedUserName || '',
      render: (item) => (
        <span className="dt-cell-secondary">
          {item.assignedUserName || '\u2014'}
        </span>
      ),
    },
    {
      key: 'date',
      label: t('crm.activities.date'),
      icon: <Calendar size={12} />,
      width: 120,
      sortable: true,
      compare: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      searchValue: (item) => formatDate(item.createdAt),
      render: (item) => (
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
          {formatDate(item.createdAt)}
        </span>
      ),
    },
    {
      key: 'status',
      label: t('crm.activities.status'),
      icon: <Clock size={12} />,
      width: 120,
      sortable: true,
      compare: (a, b) => {
        if (a.completedAt && !b.completedAt) return 1;
        if (!a.completedAt && b.completedAt) return -1;
        return 0;
      },
      searchValue: (item) => item.completedAt ? t('crm.activities.completed') : (getActivityDueLabel(item, t) || t('crm.activities.open')),
      render: (item) => {
        if (item.completedAt) {
          return <Badge variant="success">{t('crm.activities.completed')}</Badge>;
        }
        const dueStatus = getActivityDueStatus(item);
        const dueLabel = getActivityDueLabel(item, t);
        if (dueLabel) {
          return (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 'var(--font-size-xs)', color: DUE_STATUS_COLORS[dueStatus],
              fontWeight: 'var(--font-weight-medium)',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: DUE_STATUS_COLORS[dueStatus], flexShrink: 0 }} />
              {dueLabel}
            </span>
          );
        }
        return <Badge variant="default">{t('crm.activities.open')}</Badge>;
      },
    },
  ], [t]);

  if (filtered.length === 0) {
    if (searchQuery) {
      return (
        <div className="crm-empty-state">
          <Clock size={48} className="crm-empty-state-icon" />
          <div className="crm-empty-state-title">{t('crm.empty.noMatchingActivities')}</div>
          <div className="crm-empty-state-desc">{t('crm.empty.tryDifferentSearch')}</div>
        </div>
      );
    }
    return (
      <FeatureEmptyState
        illustration="calendar"
        title={t('crm.activities.noActivities')}
        description={t('crm.empty.logFirstActivity')}
        highlights={[
          { icon: <Clock size={14} />, title: t('crm.activities.call'), description: t('crm.empty.activitiesH1Desc', 'Track calls, meetings, and follow-ups') },
          { icon: <Mail size={14} />, title: t('crm.activities.email'), description: t('crm.empty.activitiesH2Desc', 'Log email interactions with contacts') },
          { icon: <Users size={14} />, title: t('crm.activities.meeting'), description: t('crm.empty.activitiesH3Desc', 'Record meeting notes and outcomes') },
        ]}
      />
    );
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 'var(--spacing-lg)' }}>
      <DataTable
        data={filtered}
        columns={columns}
        storageKey="crm-activities"
        searchable
        columnSelector
        resizableColumns
        exportable
        paginated={filtered.length > 25}
        defaultPageSize={25}
        emptyIcon={<Clock size={40} />}
        emptyTitle={t('crm.activities.noActivities')}
        emptyDescription={t('crm.empty.logFirstActivity')}
      />
    </div>
  );
}

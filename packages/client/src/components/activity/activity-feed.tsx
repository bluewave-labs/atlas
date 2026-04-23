import { useState, useMemo, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { useActivityFeed, type ActivityItem } from '../../hooks/use-notifications';
import { Avatar } from '../ui/avatar';
import { Chip } from '../ui/chip';
import { Button } from '../ui/button';
import { formatRelativeDate } from '../../lib/format';
import { getAppLabel } from '../../lib/app-colors';

// ---------------------------------------------------------------------------
// Date grouping
// ---------------------------------------------------------------------------

type DateGroup = 'today' | 'yesterday' | 'thisWeek' | 'earlier';

function getDateGroup(dateStr: string): DateGroup {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = today.getTime() - target.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return 'thisWeek';
  return 'earlier';
}

// ---------------------------------------------------------------------------
// Filter chips configuration
// ---------------------------------------------------------------------------

const APP_FILTERS = ['all', 'crm', 'sign', 'hr', 'work', 'drive', 'docs'] as const;
type AppFilter = (typeof APP_FILTERS)[number];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ActivityFeedProps {
  limit?: number;
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ActivityFeed({ limit = 20, compact = false }: ActivityFeedProps) {
  const { t } = useTranslation();
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [filter, setFilter] = useState<AppFilter>('all');

  const { data, isLoading } = useActivityFeed(cursor);

  const items = data?.items ?? [];
  const hasMore = data?.hasMore ?? false;

  // Apply client-side filter
  const filteredItems = useMemo(() => {
    const list = filter === 'all' ? items : items.filter((i) => i.appId === filter);
    return compact ? list.slice(0, limit) : list;
  }, [items, filter, compact, limit]);

  // Group by date
  const grouped = useMemo(() => {
    const groups: Record<DateGroup, ActivityItem[]> = {
      today: [],
      yesterday: [],
      thisWeek: [],
      earlier: [],
    };
    for (const item of filteredItems) {
      const group = getDateGroup(item.createdAt);
      groups[group].push(item);
    }
    return groups;
  }, [filteredItems]);

  const groupOrder: DateGroup[] = ['today', 'yesterday', 'thisWeek', 'earlier'];

  const groupLabels: Record<DateGroup, string> = {
    today: t('activity.today'),
    yesterday: t('activity.yesterday'),
    thisWeek: t('activity.thisWeek'),
    earlier: t('activity.earlier'),
  };

  if (isLoading && items.length === 0) {
    return (
      <div
        style={{
          padding: compact ? '12px 0' : 24,
          textAlign: 'center',
          color: compact ? 'rgba(255,255,255,0.5)' : 'var(--color-text-tertiary)',
          fontSize: 'var(--font-size-sm)',
          fontFamily: 'var(--font-family)',
        }}
      >
        {t('common.loading')}
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'var(--font-family)' }}>
      {/* Filter row — only in non-compact mode */}
      {!compact && (
        <div
          style={{
            display: 'flex',
            gap: 6,
            marginBottom: 16,
            flexWrap: 'wrap',
          }}
        >
          {APP_FILTERS.map((f) => (
            <Chip
              key={f}
              active={filter === f}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? t('activity.filterAll') : getAppLabel(f)}
            </Chip>
          ))}
        </div>
      )}

      {/* Empty state */}
      {filteredItems.length === 0 && (
        <div
          style={{
            padding: compact ? '16px 0' : 32,
            textAlign: 'center',
            color: compact ? 'rgba(255,255,255,0.5)' : 'var(--color-text-tertiary)',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          {t('activity.noActivity')}
        </div>
      )}

      {/* Grouped items */}
      {groupOrder.map((group) => {
        const groupItems = grouped[group];
        if (groupItems.length === 0) return null;

        return (
          <div key={group} style={{ marginBottom: compact ? 8 : 16 }}>
            {/* Group header */}
            <div
              style={{
                fontSize: 'var(--font-size-xs)',
                fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
                color: compact ? 'rgba(255,255,255,0.45)' : 'var(--color-text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                padding: compact ? '4px 0' : '8px 0',
              }}
            >
              {groupLabels[group]}
            </div>

            {/* Items */}
            {groupItems.map((item) => (
              <ActivityItemRow key={item.id} item={item} compact={compact} />
            ))}
          </div>
        );
      })}

      {/* Load more */}
      {hasMore && !compact && (
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const lastItem = items[items.length - 1];
              if (lastItem) setCursor(lastItem.createdAt);
            }}
          >
            {t('activity.loadMore')}
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity item row
// ---------------------------------------------------------------------------

function ActivityItemRow({
  item,
  compact,
}: {
  item: ActivityItem;
  compact: boolean;
}) {
  const appColor = 'var(--color-text-tertiary)';
  const appLabel = getAppLabel(item.appId);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: compact ? 8 : 10,
        padding: compact ? '6px 0' : '8px 0',
      }}
    >
      {/* Avatar */}
      {!compact && (
        <Avatar
          name={item.userName}
          size={28}
        />
      )}

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: compact ? 'var(--font-size-sm)' : 'var(--font-size-sm)',
            color: compact ? 'rgba(255,255,255,0.85)' : 'var(--color-text-primary)',
            fontFamily: 'var(--font-family)',
            lineHeight: 1.4,
          }}
        >
          <span
            style={{
              fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
            }}
          >
            {item.userName}
          </span>{' '}
          <span
            style={{
              color: compact ? 'rgba(255,255,255,0.75)' : 'var(--color-text-secondary)',
            }}
          >
            {item.title}
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 3,
          }}
        >
          <Chip
            color={appColor}
            height={18}
            style={{
              fontSize: 12,
              ...(compact && {
                background: 'rgba(255,255,255,0.1)',
                borderColor: 'rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.7)',
              }),
            }}
          >
            {appLabel}
          </Chip>
          <span
            style={{
              fontSize: compact ? 'var(--font-size-xs)' : 'var(--font-size-xs)',
              color: compact ? 'rgba(255,255,255,0.6)' : 'var(--color-text-tertiary)',
              fontFamily: 'var(--font-family)',
            }}
          >
            {formatRelativeDate(item.createdAt)}
          </span>
        </div>
      </div>
    </div>
  );
}

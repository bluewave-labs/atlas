import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { GroupedVirtuoso, type GroupedVirtuosoHandle } from 'react-virtuoso';
import { ArrowLeft, WifiOff, RefreshCw } from 'lucide-react';
import { useEmailStore } from '../../stores/email-store';
import { useSettingsStore } from '../../stores/settings-store';
import { hasActiveFilters } from './content-toolbar';
import { useDraftStore } from '../../stores/draft-store';
import { useMailboxThreads, useToggleStar, useArchiveWithUndo, useTrashWithUndo, useBulkArchiveWithUndo, useBulkTrashWithUndo, useMarkReadUnread, useSnoozeThread, useGmailLabels } from '../../hooks/use-threads';
import { useToastStore } from '../../stores/toast-store';
import { useAutoAdvance } from '../../hooks/use-auto-advance';
import { useMediaQuery } from '../../hooks/use-media-query';
import { queryKeys } from '../../config/query-keys';
import { EmailListItem } from '../email/email-list-item';
import { BulkActions } from '../email/bulk-actions';
import { EmptyState } from '../ui/empty-state';
import { EmailListSkeleton } from '../ui/skeleton';
import { Chip } from '../ui/chip';
import { useSearch } from '../../hooks/use-search';
import type { EmailCategory, Thread } from '@atlasmail/shared';
import type { Mailbox } from '../../stores/email-store';

// ---------------------------------------------------------------------------
// Date grouping (Outlook-style: Today, Yesterday, This week, etc.)
// ---------------------------------------------------------------------------

type DateGroup = 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'older';

function getDateGroup(dateStr: string): DateGroup {
  const date = new Date(dateStr);
  const now = new Date();

  // Strip time for comparison
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  if (date >= todayStart) return 'today';
  if (date >= yesterdayStart) return 'yesterday';

  // Start of this week (Monday)
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const thisWeekStart = new Date(todayStart);
  thisWeekStart.setDate(thisWeekStart.getDate() - mondayOffset);
  if (date >= thisWeekStart) return 'thisWeek';

  // Start of last week
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  if (date >= lastWeekStart) return 'lastWeek';

  // Start of this month
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  if (date >= thisMonthStart) return 'thisMonth';

  return 'older';
}

interface GroupedResult {
  groups: DateGroup[];
  groupCounts: number[];
}

function groupThreadsByDate(threads: Thread[]): GroupedResult {
  const groups: DateGroup[] = [];
  const groupCounts: number[] = [];
  let currentGroup: DateGroup | null = null;

  for (const thread of threads) {
    const group = getDateGroup(thread.lastMessageAt);
    if (group !== currentGroup) {
      groups.push(group);
      groupCounts.push(1);
      currentGroup = group;
    } else {
      groupCounts[groupCounts.length - 1]++;
    }
  }

  return { groups, groupCounts };
}

// ---------------------------------------------------------------------------
// Search filter parsing
// ---------------------------------------------------------------------------

interface SearchFilters {
  from: string | null;
  to: string | null;
  subject: string | null;
  hasAttachment: boolean;
  inMailbox: string | null;
  isFilter: string | null;
  newerThan: string | null;
  olderThan: string | null;
  freeText: string;
}

function parseDuration(value: string): number | null {
  const match = value.match(/^(\d+)([dwm])$/);
  if (!match) return null;
  const num = parseInt(match[1]);
  const unit = match[2];
  const now = Date.now();
  if (unit === 'd') return now - num * 86400000;
  if (unit === 'w') return now - num * 7 * 86400000;
  if (unit === 'm') return now - num * 30 * 86400000;
  return null;
}

function parseSearchQuery(query: string): SearchFilters {
  const filters: SearchFilters = {
    from: null,
    to: null,
    subject: null,
    hasAttachment: false,
    inMailbox: null,
    isFilter: null,
    newerThan: null,
    olderThan: null,
    freeText: '',
  };

  let remaining = query;

  // Extract from:value
  remaining = remaining.replace(/\bfrom:(\S+)/gi, (_, val) => {
    filters.from = val;
    return '';
  });

  // Extract to:value
  remaining = remaining.replace(/\bto:(\S+)/gi, (_, val) => {
    filters.to = val;
    return '';
  });

  // Extract subject:value (supports quoted strings)
  remaining = remaining.replace(/\bsubject:"([^"]+)"/gi, (_, val) => {
    filters.subject = val;
    return '';
  });
  remaining = remaining.replace(/\bsubject:(\S+)/gi, (_, val) => {
    filters.subject = val;
    return '';
  });

  // Extract has:attachment
  remaining = remaining.replace(/\bhas:attachment\b/gi, () => {
    filters.hasAttachment = true;
    return '';
  });

  // Extract in:mailbox (inbox, sent, trash, spam, archive, starred, drafts)
  remaining = remaining.replace(/\bin:(\S+)/gi, (_, val) => {
    filters.inMailbox = val.toLowerCase();
    return '';
  });

  // Extract is:filter (unread, starred, read)
  remaining = remaining.replace(/\bis:(\S+)/gi, (_, val) => {
    filters.isFilter = val.toLowerCase();
    return '';
  });

  // Extract newer_than:value (e.g. 7d, 2w, 1m)
  remaining = remaining.replace(/\bnewer_than:(\S+)/gi, (_, val) => {
    filters.newerThan = val;
    return '';
  });

  // Extract older_than:value
  remaining = remaining.replace(/\bolder_than:(\S+)/gi, (_, val) => {
    filters.olderThan = val;
    return '';
  });

  filters.freeText = remaining.trim();

  return filters;
}

function filterThreadsByParsed(threads: Thread[], filters: SearchFilters): Thread[] {
  return threads.filter((t) => {
    const emails = t.emails ?? [];
    const firstEmail = emails[0];

    if (filters.hasAttachment && !t.hasAttachments) return false;

    if (filters.from) {
      const q = filters.from.toLowerCase();
      const match = firstEmail
        ? firstEmail.fromAddress.toLowerCase().includes(q) ||
          (firstEmail.fromName?.toLowerCase().includes(q) ?? false)
        : false;
      if (!match) return false;
    }

    if (filters.to) {
      const q = filters.to.toLowerCase();
      const match = firstEmail
        ? firstEmail.toAddresses.some(
            (a) => a.address.toLowerCase().includes(q) || (a.name?.toLowerCase().includes(q) ?? false),
          )
        : false;
      if (!match) return false;
    }

    if (filters.subject) {
      const q = filters.subject.toLowerCase();
      if (!(t.subject?.toLowerCase().includes(q) ?? false)) return false;
    }

    // is:unread / is:starred filters
    if (filters.isFilter) {
      if (filters.isFilter === 'unread' && t.unreadCount === 0) return false;
      if (filters.isFilter === 'starred' && !t.isStarred) return false;
      if (filters.isFilter === 'read' && t.unreadCount > 0) return false;
    }

    // newer_than: / older_than: time-based filters
    if (filters.newerThan) {
      const cutoff = parseDuration(filters.newerThan);
      if (cutoff) {
        const threadDate = new Date(t.lastMessageAt).getTime();
        if (threadDate < cutoff) return false;
      }
    }

    if (filters.olderThan) {
      const cutoff = parseDuration(filters.olderThan);
      if (cutoff) {
        const threadDate = new Date(t.lastMessageAt).getTime();
        if (threadDate > cutoff) return false;
      }
    }

    if (filters.freeText) {
      const q = filters.freeText.toLowerCase();
      const matches =
        t.subject?.toLowerCase().includes(q) ||
        t.snippet?.toLowerCase().includes(q) ||
        firstEmail?.fromName?.toLowerCase().includes(q) ||
        firstEmail?.fromAddress?.toLowerCase().includes(q);
      if (!matches) return false;
    }

    return true;
  });
}

export function EmailListPane() {
  const { t } = useTranslation();
  const {
    activeCategory,
    activeMailbox,
    activeThreadId,
    setActiveThread,
    cursorIndex,
    setCursorIndex,
    openCompose,
    selectedThreadIds,
    toggleSelection,
    clearSelection,
    selectThreads,
    filterByLabel,
    setFilterByLabel,
  } = useEmailStore();
  const readingPanePosition = useSettingsStore((s) => s.readingPane);
  const searchQuery = useEmailStore((s) => s.searchQuery);
  const DATE_GROUP_LABELS: Record<DateGroup, string> = {
    today: t('email.groupToday'),
    yesterday: t('email.groupYesterday'),
    thisWeek: t('email.groupThisWeek'),
    lastWeek: t('email.groupLastWeek'),
    thisMonth: t('email.groupThisMonth'),
    older: t('email.groupOlder'),
  };

  const { data: gmailLabels } = useGmailLabels();
  const toggleStar = useToggleStar();
  const snoozeMutation = useSnoozeThread();
  const archiveWithUndo = useArchiveWithUndo();
  const trashWithUndo = useTrashWithUndo();
  const bulkArchiveWithUndo = useBulkArchiveWithUndo();
  const bulkTrashWithUndo = useBulkTrashWithUndo();
  const markReadUnread = useMarkReadUnread();
  const addToast = useToastStore((s) => s.addToast);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const virtuosoRef = useRef<GroupedVirtuosoHandle>(null);

  // Debounce search query for server-side search (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  // Keep a stable ref to the current displayed threads list so the cursor event
  // handler can resolve which thread is at the cursor position without stale closure issues.
  const displayThreadsRef = useRef<Thread[]>([]);

  const isInbox = activeMailbox === 'inbox';
  const {
    data: threads,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useMailboxThreads(
    activeMailbox,
    isInbox ? activeCategory : undefined,
    filterByLabel,
  );

  // Server-side search — fires when user types a free-text query
  const { data: searchResults, isLoading: isSearching } = useSearch(debouncedSearch);
  const isSearchActive = debouncedSearch.length > 0;

  const parsedFilters = useMemo(() => parseSearchQuery(searchQuery), [searchQuery]);

  const displayThreads = useMemo(() => {
    // When search is active, use server-side search results
    const baseThreads = isSearchActive ? (searchResults || []) : (threads || []);

    // Apply local advanced filters (from:, to:, subject:, has:attachment) on top
    let filtered = hasActiveFilters(parsedFilters) && !isSearchActive
      ? filterThreadsByParsed(baseThreads, parsedFilters)
      : baseThreads;

    return filtered;
  }, [threads, searchResults, isSearchActive, parsedFilters]);

  // Keep the ref in sync so the cursor-selection event handler is never stale
  displayThreadsRef.current = displayThreads;

  // Outlook-style date grouping
  const { groups, groupCounts } = useMemo(
    () => groupThreadsByDate(displayThreads),
    [displayThreads],
  );

  // Track newly arrived threads for entrance animation
  const knownThreadIds = useRef<Set<string>>(new Set());
  const isInitialMount = useRef(true);
  const pendingNavigation = useRef(false);
  const [newThreadIds, setNewThreadIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!displayThreads.length) {
      knownThreadIds.current = new Set();
      setNewThreadIds(new Set());
      return;
    }
    const currentIds = new Set(displayThreads.map((t) => t.id));

    // On very first mount, mark all as known (no animation)
    if (isInitialMount.current) {
      isInitialMount.current = false;
      knownThreadIds.current = currentIds;
      return;
    }

    // After a navigation (mailbox/category switch), animate all threads in
    if (pendingNavigation.current) {
      pendingNavigation.current = false;
      knownThreadIds.current = currentIds;
      setNewThreadIds(currentIds);
      const timer = setTimeout(() => setNewThreadIds(new Set()), 500);
      return () => clearTimeout(timer);
    }

    // Normal case: detect newly arrived threads
    const arrivals = new Set<string>();
    for (const id of currentIds) {
      if (!knownThreadIds.current.has(id)) arrivals.add(id);
    }
    knownThreadIds.current = currentIds;
    if (arrivals.size > 0) {
      setNewThreadIds(arrivals);
      const timer = setTimeout(() => setNewThreadIds(new Set()), 500);
      return () => clearTimeout(timer);
    }
  }, [displayThreads]);

  const advanceAfterRemoval = useAutoAdvance(displayThreads);

  // Auto-scroll Virtuoso to keep the keyboard cursor visible
  useEffect(() => {
    if (cursorIndex >= 0 && virtuosoRef.current) {
      virtuosoRef.current.scrollToIndex({ index: cursorIndex, align: 'center', behavior: 'smooth' });
    }
  }, [cursorIndex]);

  // Auto-select first thread when switching categories, mailboxes, or label filters
  const prevCategoryRef = useRef(activeCategory);
  const prevMailboxRef = useRef(activeMailbox);
  const prevFilterByLabelRef = useRef(filterByLabel);
  useEffect(() => {
    const categoryChanged = prevCategoryRef.current !== activeCategory;
    const mailboxChanged = prevMailboxRef.current !== activeMailbox;
    const labelChanged = prevFilterByLabelRef.current !== filterByLabel;
    prevCategoryRef.current = activeCategory;
    prevMailboxRef.current = activeMailbox;
    prevFilterByLabelRef.current = filterByLabel;

    if (categoryChanged || mailboxChanged) {
      setFilterByLabel(null);
      pendingNavigation.current = true;
    }

    if ((categoryChanged || mailboxChanged || labelChanged) && displayThreads.length > 0) {
      setActiveThread(displayThreads[0].id);
      setCursorIndex(0);
    }

    // On initial load (or after clearing active thread), select the first thread.
    // Skip in 'hidden' pane mode — the user navigates list → thread → back explicitly.
    if (!activeThreadId && displayThreads.length > 0 && !categoryChanged && !mailboxChanged && !labelChanged && readingPanePosition !== 'hidden') {
      setActiveThread(displayThreads[0].id);
      setCursorIndex(0);
    }
  }, [activeCategory, activeMailbox, filterByLabel, displayThreads, activeThreadId, setActiveThread, setCursorIndex, setFilterByLabel]);

  // Listen for the cursor-selection event dispatched by inbox.tsx when `x` is pressed
  useEffect(() => {
    const handleSelectCursor = (e: Event) => {
      const { cursorIndex: idx } = (e as CustomEvent<{ cursorIndex: number }>).detail;
      const thread = displayThreadsRef.current[idx];
      if (thread) toggleSelection(thread.id);
    };
    document.addEventListener('atlasmail:select_cursor', handleSelectCursor);
    return () => document.removeEventListener('atlasmail:select_cursor', handleSelectCursor);
  }, [toggleSelection]);

  const handleThreadClick = useCallback(
    (thread: Thread, index: number) => {
      setCursorIndex(index);

      // If we're in the drafts mailbox, open compose to resume editing
      if (activeMailbox === 'drafts') {
        const draft = useDraftStore.getState().getDraft(thread.id);
        if (draft) {
          useDraftStore.getState().setActiveDraftId(draft.id);
          openCompose(draft.composeMode, draft.threadId ?? undefined);
        }
        return;
      }

      setActiveThread(thread.id);
      if (thread.unreadCount > 0) {
        markReadUnread.mutate({ threadId: thread.id, isUnread: false });
      }
    },
    [setCursorIndex, setActiveThread, markReadUnread, activeMailbox, openCompose],
  );

  const handleStarClick = useCallback(
    (threadId: string) => {
      toggleStar.mutate(threadId);
    },
    [toggleStar],
  );

  const handleReplyClick = useCallback(
    (threadId: string) => {
      openCompose('reply', threadId);
    },
    [openCompose],
  );

  // The undo hooks snapshot the cache entry for the currently visible list.
  // When in inbox mode the key is the category list; in other mailboxes it
  // is the mailbox key — so we must pass the right key to each undo hook.
  const categoryFilter = isInbox ? activeCategory : undefined;
  const activeListKey = useMemo(
    () => queryKeys.threads.mailbox(activeMailbox, categoryFilter),
    [activeMailbox, categoryFilter],
  );

  const handleArchiveClick = useCallback(
    (threadId: string) => {
      advanceAfterRemoval(threadId, cursorIndex);
      archiveWithUndo(threadId, activeListKey);
    },
    [advanceAfterRemoval, cursorIndex, archiveWithUndo, activeListKey],
  );

  const handleTrashClick = useCallback(
    (threadId: string) => {
      advanceAfterRemoval(threadId, cursorIndex);
      trashWithUndo(threadId, activeListKey);
    },
    [advanceAfterRemoval, cursorIndex, trashWithUndo, activeListKey],
  );

  const handleSnooze = useCallback(
    (threadId: string, snoozeUntil: Date) => {
      snoozeMutation.mutate({ threadId, snoozeUntil: snoozeUntil.toISOString() });
      addToast({
        type: 'success',
        message: t('email.snooze') + ' — ' + snoozeUntil.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }),
        duration: 3000,
      });
    },
    [snoozeMutation, addToast, t],
  );

  const handleCheckboxClick = useCallback(
    (threadId: string) => {
      toggleSelection(threadId);
    },
    [toggleSelection],
  );

  const handleBulkArchive = useCallback(() => {
    bulkArchiveWithUndo(selectedThreadIds, activeListKey);
    clearSelection();
  }, [selectedThreadIds, bulkArchiveWithUndo, activeListKey, clearSelection]);

  const handleBulkTrash = useCallback(() => {
    bulkTrashWithUndo(selectedThreadIds, activeListKey);
    clearSelection();
  }, [selectedThreadIds, bulkTrashWithUndo, activeListKey, clearSelection]);

  const handleBulkStar = useCallback(() => {
    selectedThreadIds.forEach((id) => toggleStar.mutate(id));
    clearSelection();
  }, [selectedThreadIds, toggleStar, clearSelection]);

  const handleBulkMarkRead = useCallback(() => {
    selectedThreadIds.forEach((id) => markReadUnread.mutate({ threadId: id, isUnread: false }));
    clearSelection();
  }, [selectedThreadIds, markReadUnread, clearSelection]);

  const handleBulkMarkUnread = useCallback(() => {
    selectedThreadIds.forEach((id) => markReadUnread.mutate({ threadId: id, isUnread: true }));
    clearSelection();
  }, [selectedThreadIds, markReadUnread, clearSelection]);

  const handleSelectAll = useCallback(() => {
    const allSelected =
      selectedThreadIds.size === displayThreadsRef.current.length &&
      displayThreadsRef.current.length > 0;
    if (allSelected) {
      clearSelection();
    } else {
      selectThreads(displayThreadsRef.current.map((t) => t.id));
    }
  }, [selectedThreadIds.size, clearSelection, selectThreads]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Mobile back button — only shown on mobile when a thread is active */}
      {isMobile && activeThreadId && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: 'var(--spacing-sm) var(--spacing-md)',
            borderBottom: '1px solid var(--color-border-primary)',
            background: 'var(--color-bg-secondary)',
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => setActiveThread(null)}
            aria-label="Back to inbox"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-sm)',
              padding: 'var(--spacing-xs) var(--spacing-sm)',
              background: 'transparent',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text-secondary)',
              fontSize: 'var(--font-size-sm)',
              fontFamily: 'var(--font-family)',
              cursor: 'pointer',
              transition: 'background var(--transition-normal), color var(--transition-normal)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--color-surface-hover)';
              e.currentTarget.style.color = 'var(--color-text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--color-text-secondary)';
            }}
          >
            <ArrowLeft size={15} />
            Back
          </button>
        </div>
      )}

      {/* Bulk actions row — only visible when threads are selected */}
      {selectedThreadIds.size > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)',
            padding: 'var(--spacing-xs) var(--spacing-md)',
            borderBottom: '1px solid var(--color-border-primary)',
            flexShrink: 0,
            minHeight: 34,
          }}
        >
          <BulkActions
            selectedCount={selectedThreadIds.size}
            totalCount={displayThreads.length}
            onSelectAll={handleSelectAll}
            onArchive={handleBulkArchive}
            onTrash={handleBulkTrash}
            onStar={handleBulkStar}
            onMarkRead={handleBulkMarkRead}
            onMarkUnread={handleBulkMarkUnread}
            onClearSelection={clearSelection}
          />
        </div>
      )}

      {/* Active label filter chip */}
      {filterByLabel && (() => {
        const label = gmailLabels?.find((l) => l.id === filterByLabel);
        const fullName = label?.name ?? filterByLabel;
        const labelName = fullName.includes('/') ? fullName.split('/').pop()! : fullName;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', padding: 'var(--spacing-xs) var(--spacing-md)', borderBottom: '1px solid var(--color-border-primary)', flexShrink: 0 }}>
            <Chip color={label?.color?.background ?? 'var(--color-accent-primary)'} onRemove={() => setFilterByLabel(null)} aria-label="Remove label filter">
              {labelName}
            </Chip>
          </div>
        );
      })()}

      {/* Thread list */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {isError && !isLoading ? (
          <div
            role="alert"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: 'var(--spacing-md)',
              fontFamily: 'var(--font-family)',
              userSelect: 'none',
              animation: 'atlasmail-empty-fade-in 220ms ease both',
            }}
          >
            <WifiOff size={36} style={{ color: 'var(--color-text-tertiary)' }} />
            <span
              style={{
                fontSize: 'var(--font-size-md)',
                fontWeight: 500,
                color: 'var(--color-text-secondary)',
                textAlign: 'center',
              }}
            >
              {t('connection.unableToLoad')}
            </span>
            <span
              style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-tertiary)',
                textAlign: 'center',
                maxWidth: 280,
                lineHeight: 'var(--line-height-normal)',
              }}
            >
              {t('connection.checkAndRetry')}
            </span>
            <button
              onClick={() => refetch()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--spacing-xs)',
                marginTop: 'var(--spacing-xs)',
                padding: 'var(--spacing-sm) var(--spacing-lg)',
                background: 'var(--color-accent-primary)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 'var(--radius-lg)',
                fontSize: 'var(--font-size-sm)',
                fontFamily: 'var(--font-family)',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'opacity var(--transition-normal)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
            >
              <RefreshCw size={13} />
              {t('common.retry')}
            </button>
          </div>
        ) : (isLoading || (isSearchActive && (isSearching || !searchResults))) ? (
          <EmailListSkeleton />
        ) : displayThreads.length === 0 ? (
          <EmptyState
            type={searchQuery ? 'search' : activeMailbox === 'trash' ? 'trash' : activeMailbox === 'archive' ? 'archive' : 'inbox'}
            description={
              searchQuery
                ? `No conversations match "${searchQuery}"`
                : activeMailbox === 'sent' ? 'Sent messages will appear here'
                : activeMailbox === 'drafts' ? 'No drafts yet'
                : activeMailbox === 'spam' ? 'No spam — your inbox is clean'
                : undefined
            }
          />
        ) : (
          <GroupedVirtuoso
            ref={virtuosoRef}
            style={{ height: '100%', paddingTop: 4 }}
            groupCounts={groupCounts}
            endReached={() => {
              if (hasNextPage && !isFetchingNextPage && !isSearchActive) {
                fetchNextPage();
              }
            }}
            overscan={200}
            groupContent={(index) => (
              <div
                style={{
                  padding: '6px var(--spacing-lg)',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  fontFamily: 'var(--font-family)',
                  color: 'var(--color-text-tertiary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  background: 'var(--color-bg-primary)',
                  borderBottom: '1px solid var(--color-border-secondary)',
                  position: 'sticky',
                  top: 0,
                  zIndex: 2,
                }}
              >
                {DATE_GROUP_LABELS[groups[index]]}
              </div>
            )}
            itemContent={(index) => {
              const thread = displayThreads[index];
              if (!thread) return null;
              return (
                <EmailListItem
                  key={thread.id}
                  thread={thread}
                  isSelected={thread.id === activeThreadId}
                  isCursor={index === cursorIndex}
                  isMultiSelected={selectedThreadIds.has(thread.id)}
                  isNew={newThreadIds.has(thread.id)}
                  onClick={() => handleThreadClick(thread, index)}
                  onStarClick={() => handleStarClick(thread.id)}
                  onCheckboxClick={() => handleCheckboxClick(thread.id)}
                  onReplyClick={() => handleReplyClick(thread.id)}
                  onArchiveClick={() => handleArchiveClick(thread.id)}
                  onTrashClick={() => handleTrashClick(thread.id)}
                  onSnooze={handleSnooze}
                />
              );
            }}
            components={{
              Footer: () =>
                isFetchingNextPage ? (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      padding: 'var(--spacing-md)',
                      color: 'var(--color-text-tertiary)',
                      fontSize: 'var(--font-size-sm)',
                      fontFamily: 'var(--font-family)',
                    }}
                  >
                    {t('common.loading')}
                  </div>
                ) : null,
            }}
          />
        )}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AppLayout } from '../components/layout/app-layout';
import { EmailListPane } from '../components/layout/email-list-pane';
import { ReadingPane } from '../components/layout/reading-pane';
import { ComposeModal } from '../components/compose/compose-modal';
import { ToastContainer } from '../components/ui/toast';
import { SendAnimation } from '../components/ui/send-animation';
import { SettingsModal } from '../components/settings/settings-modal';
import { useEmailStore } from '../stores/email-store';
import { useUIStore } from '../stores/ui-store';
import { useShortcut, useShortcutEngine } from '../providers/shortcut-provider';
import { queryKeys } from '../config/query-keys';
import {
  useArchiveWithUndo,
  useTrashWithUndo,
  useBulkArchiveWithUndo,
  useBulkTrashWithUndo,
  useToggleStar,
  useMarkReadUnread,
  useMailboxThreads,
} from '../hooks/use-threads';
import { useAutoAdvance } from '../hooks/use-auto-advance';

export function InboxPage() {
  const {
    moveCursor,
    activeThreadId,
    activeCategory,
    activeMailbox,
    cursorIndex,
    setActiveThread,
    openCompose,
    setActiveCategory,
    selectedThreadIds,
    clearSelection,
    filterByLabel,
  } = useEmailStore();
  const { toggleCommandPalette, toggleSidebar, toggleSettings } = useUIStore();
  const archiveWithUndo = useArchiveWithUndo();
  const trashWithUndo = useTrashWithUndo();
  const bulkArchiveWithUndo = useBulkArchiveWithUndo();
  const bulkTrashWithUndo = useBulkTrashWithUndo();
  const starMutation = useToggleStar();
  const markReadUnread = useMarkReadUnread();
  const isInbox = activeMailbox === 'inbox';
  const categoryFilter = isInbox ? activeCategory : undefined;
  const { data: threads } = useMailboxThreads(activeMailbox, categoryFilter, filterByLabel);
  const maxCursorIndex = Math.max(0, (threads?.length ?? 1) - 1);
  const displayThreads = useMemo(() => threads ?? [], [threads]);
  const advanceAfterRemoval = useAutoAdvance(displayThreads);

  const activeListKey = useMemo(
    () => queryKeys.threads.mailbox(activeMailbox, categoryFilter),
    [activeMailbox, categoryFilter],
  );

  // Keep the shortcut engine context in sync with whether a thread is open
  const shortcutEngine = useShortcutEngine();
  useEffect(() => {
    shortcutEngine.setContext(activeThreadId ? 'thread' : 'inbox');
  }, [activeThreadId, shortcutEngine]);

  // Sync cursor movement (keyboard j/k) to active thread selection.
  // Only react to cursorIndex changes — clicks already call setActiveThread directly.
  const prevCursorRef = useRef(cursorIndex);
  useEffect(() => {
    if (prevCursorRef.current === cursorIndex) return;
    prevCursorRef.current = cursorIndex;
    const thread = displayThreads[cursorIndex];
    if (thread) {
      setActiveThread(thread.id);
    }
  }, [cursorIndex, displayThreads, setActiveThread]);

  // Navigation shortcuts
  const handleMoveDown = useCallback(() => moveCursor(1, maxCursorIndex), [moveCursor, maxCursorIndex]);
  const handleMoveUp = useCallback(() => moveCursor(-1, maxCursorIndex), [moveCursor, maxCursorIndex]);
  const handleOpenThread = useCallback(() => {
    const thread = displayThreads[cursorIndex];
    if (thread) {
      setActiveThread(thread.id);
      markReadUnread.mutate({ threadId: thread.id, isUnread: false });
    }
  }, [cursorIndex, displayThreads, setActiveThread, markReadUnread]);
  const handleGoBack = useCallback(() => setActiveThread(null), [setActiveThread]);

  // Category navigation
  const handleGoAll = useCallback(() => setActiveCategory('all'), [setActiveCategory]);
  const handleGoImportant = useCallback(() => setActiveCategory('important'), [setActiveCategory]);
  const handleGoOther = useCallback(() => setActiveCategory('other'), [setActiveCategory]);
  const handleGoNewsletters = useCallback(() => setActiveCategory('newsletters'), [setActiveCategory]);
  const handleGoNotifications = useCallback(() => setActiveCategory('notifications'), [setActiveCategory]);

  // Action shortcuts — use undo-aware variants so the user can recover.
  // Pass the correct list key so optimistic updates target the right cache.
  // advanceAfterRemoval runs first (deferred one tick) so it fires after the
  // optimistic removal has propagated and the list has re-rendered.
  const handleArchive = useCallback(() => {
    if (selectedThreadIds.size > 0) {
      bulkArchiveWithUndo(selectedThreadIds, activeListKey);
      clearSelection();
      return;
    }
    if (!activeThreadId) return;
    advanceAfterRemoval(activeThreadId, cursorIndex);
    archiveWithUndo(activeThreadId, activeListKey);
  }, [selectedThreadIds, activeThreadId, cursorIndex, activeListKey, advanceAfterRemoval, archiveWithUndo, bulkArchiveWithUndo, clearSelection]);

  const handleTrash = useCallback(() => {
    if (selectedThreadIds.size > 0) {
      bulkTrashWithUndo(selectedThreadIds, activeListKey);
      clearSelection();
      return;
    }
    if (!activeThreadId) return;
    advanceAfterRemoval(activeThreadId, cursorIndex);
    trashWithUndo(activeThreadId, activeListKey);
  }, [selectedThreadIds, activeThreadId, cursorIndex, activeListKey, advanceAfterRemoval, trashWithUndo, bulkTrashWithUndo, clearSelection]);

  const handleStar = useCallback(() => {
    if (activeThreadId) starMutation.mutate(activeThreadId);
  }, [activeThreadId, starMutation]);

  // Compose shortcuts
  const handleCompose = useCallback(() => openCompose('new'), [openCompose]);
  const handleReply = useCallback(() => {
    if (activeThreadId) openCompose('reply', activeThreadId);
  }, [activeThreadId, openCompose]);
  const handleReplyAll = useCallback(() => {
    if (activeThreadId) openCompose('reply_all', activeThreadId);
  }, [activeThreadId, openCompose]);
  const handleForward = useCallback(() => {
    if (activeThreadId) openCompose('forward', activeThreadId);
  }, [activeThreadId, openCompose]);

  // Mark read/unread shortcuts
  const handleMarkRead = useCallback(() => {
    if (activeThreadId) markReadUnread.mutate({ threadId: activeThreadId, isUnread: false });
  }, [activeThreadId, markReadUnread]);

  const handleMarkUnread = useCallback(() => {
    if (activeThreadId) markReadUnread.mutate({ threadId: activeThreadId, isUnread: true });
  }, [activeThreadId, markReadUnread]);

  // UI shortcuts
  const handleCommandPalette = useCallback(() => toggleCommandPalette(), [toggleCommandPalette]);
  const handleToggleSidebar = useCallback(() => toggleSidebar(), [toggleSidebar]);
  const handleShortcutHelp = useCallback(() => {
    toggleSettings();
    // Navigate to shortcuts panel after settings opens
    setTimeout(() => {
      document.dispatchEvent(new CustomEvent('atlasmail:settings_navigate', { detail: { panel: 'shortcuts' } }));
    }, 50);
  }, [toggleSettings]);

  // Search shortcut — dispatches event so SearchBar can focus itself
  const handleSearchFocus = useCallback(() => {
    document.dispatchEvent(new CustomEvent('atlasmail:focus_search'));
  }, []);

  // Snooze shortcut — dispatches a custom event so the SnoozePopover can open itself
  const handleSnooze = useCallback(() => {
    if (!activeThreadId) return;
    document.dispatchEvent(
      new CustomEvent('atlasmail:snooze', { detail: { threadId: activeThreadId } }),
    );
  }, [activeThreadId]);

  // Selection shortcuts
  // `x` toggles the selection state of whichever thread the cursor is on
  const handleSelectToggle = useCallback(() => {
    // The thread list in email-list-pane filters by searchQuery, so we need the
    // cursored thread id. We derive it from the store's thread query via a
    // custom event so we don't duplicate query logic here.
    document.dispatchEvent(
      new CustomEvent('atlasmail:select_cursor', { detail: { cursorIndex } }),
    );
  }, [cursorIndex]);

  // Shift+j / Shift+k / Shift+Arrow — add current thread to selection then move cursor
  const handleSelectDown = useCallback(() => {
    document.dispatchEvent(
      new CustomEvent('atlasmail:add_to_selection', { detail: { cursorIndex } }),
    );
    moveCursor(1, maxCursorIndex);
  }, [cursorIndex, moveCursor, maxCursorIndex]);

  const handleSelectUp = useCallback(() => {
    document.dispatchEvent(
      new CustomEvent('atlasmail:add_to_selection', { detail: { cursorIndex } }),
    );
    moveCursor(-1, maxCursorIndex);
  }, [cursorIndex, moveCursor, maxCursorIndex]);

  // Escape clears multi-selection when threads are selected (inbox context only)
  const handleClearSelection = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  // Register Shift+Arrow variants directly — these complement Shift+j/k
  useEffect(() => {
    shortcutEngine.register('select_down_arrow', 'shift+ArrowDown', handleSelectDown, 'global');
    shortcutEngine.register('select_up_arrow', 'shift+ArrowUp', handleSelectUp, 'global');
    return () => {
      shortcutEngine.unregister('select_down_arrow');
      shortcutEngine.unregister('select_up_arrow');
    };
  }, [shortcutEngine, handleSelectDown, handleSelectUp]);

  // Register Escape to clear selection directly — only fires when there are selections.
  // `go_back` already owns Escape in 'thread' context so there's no conflict.
  useEffect(() => {
    if (selectedThreadIds.size === 0) {
      shortcutEngine.unregister('clear_selection');
      return;
    }
    shortcutEngine.register('clear_selection', 'Escape', handleClearSelection, 'inbox');
    return () => shortcutEngine.unregister('clear_selection');
  }, [selectedThreadIds.size, handleClearSelection, shortcutEngine]);

  // Register all shortcuts — most use 'global' so they work in both inbox and thread views
  useShortcut('move_down', handleMoveDown, 'global');
  useShortcut('move_up', handleMoveUp, 'global');
  useShortcut('open_thread', handleOpenThread, 'global');
  useShortcut('go_back', handleGoBack, 'thread');
  useShortcut('go_all', handleGoAll, 'global');
  useShortcut('go_important', handleGoImportant, 'global');
  useShortcut('go_other', handleGoOther, 'global');
  useShortcut('go_newsletters', handleGoNewsletters, 'global');
  useShortcut('go_notifications', handleGoNotifications, 'global');
  useShortcut('archive', handleArchive, 'global');
  useShortcut('trash', handleTrash, 'global');
  useShortcut('star', handleStar, 'global');
  useShortcut('mark_read', handleMarkRead, 'global');
  useShortcut('mark_unread', handleMarkUnread, 'global');
  useShortcut('compose_new', handleCompose, 'global');
  useShortcut('reply', handleReply, 'global');
  useShortcut('reply_all', handleReplyAll, 'global');
  useShortcut('forward', handleForward, 'global');
  useShortcut('snooze', handleSnooze, 'global');
  useShortcut('select_toggle', handleSelectToggle, 'global');
  useShortcut('select_down', handleSelectDown, 'global');
  useShortcut('select_up', handleSelectUp, 'global');
  useShortcut('command_palette', handleCommandPalette, 'global');
  useShortcut('toggle_sidebar', handleToggleSidebar, 'global');
  useShortcut('search', handleSearchFocus, 'global');
  useShortcut('shortcut_help', handleShortcutHelp, 'global');

  return (
    <>
      <AppLayout
        emailList={<EmailListPane />}
        readingPane={<ReadingPane />}
      />
      <ComposeModal />
      <SettingsModal />
      <ToastContainer />
      <SendAnimation />
    </>
  );
}

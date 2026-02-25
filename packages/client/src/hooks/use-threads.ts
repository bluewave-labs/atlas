import { useCallback, useMemo, useEffect, useRef } from 'react';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import { queryKeys } from '../config/query-keys';
import { getMockThreads, getMockThread, getMockThreadsByMailbox, draftToThread } from '../lib/mock-data';
import { useToastStore } from '../stores/toast-store';
import { useDraftStore } from '../stores/draft-store';
import type { Thread } from '@atlasmail/shared';
import i18n from '../i18n';

const PAGE_SIZE = 50;

const USE_MOCK = import.meta.env.DEV && !import.meta.env.VITE_GOOGLE_CLIENT_ID;

interface ThreadCounts {
  categories: Record<string, { total: number; unread: number }>;
  mailboxes: Record<string, { total: number; unread: number }>;
}

export function useThreadCounts() {
  return useQuery({
    queryKey: queryKeys.threads.counts,
    queryFn: async () => {
      if (USE_MOCK) {
        return {
          categories: {
            all: { total: 29, unread: 6 },
            important: { total: 12, unread: 3 },
            other: { total: 5, unread: 1 },
            newsletters: { total: 8, unread: 2 },
            notifications: { total: 4, unread: 0 },
          },
          mailboxes: {
            inbox: { total: 29, unread: 6 },
            archive: { total: 50, unread: 0 },
            trash: { total: 3, unread: 0 },
            spam: { total: 2, unread: 0 },
          },
        } as ThreadCounts;
      }
      const { data } = await api.get('/threads/counts');
      return data.data as ThreadCounts;
    },
    refetchInterval: 60_000, // refresh counts every minute
  });
}

export function useThreads(category?: string) {
  return useQuery({
    queryKey: queryKeys.threads.list(category),
    queryFn: async () => {
      if (USE_MOCK) return getMockThreads(category);
      const { data } = await api.get('/threads', { params: { category } });
      return data.data as Thread[];
    },
  });
}

export function useMailboxThreads(mailbox: string, category?: string, gmailLabel?: string | null) {
  // Subscribe to the drafts array so the query key updates on any draft change.
  const draftsCacheKey = useDraftStore((s) => {
    if (mailbox !== 'drafts') return null;
    return s.drafts.map((d) => d.savedAt).join(',');
  });

  const isDrafts = mailbox === 'drafts';

  const infiniteQuery = useInfiniteQuery({
    queryKey: [
      ...queryKeys.threads.mailbox(mailbox, category),
      ...(isDrafts ? [draftsCacheKey] : []),
      ...(gmailLabel ? [gmailLabel] : []),
    ],
    queryFn: async ({ pageParam = 0 }) => {
      if (isDrafts) {
        return useDraftStore.getState().drafts.map((d) => draftToThread(d));
      }
      if (USE_MOCK) {
        if (mailbox === 'inbox') return getMockThreads(category);
        return getMockThreadsByMailbox(mailbox);
      }
      const { data } = await api.get('/threads', {
        params: { mailbox, category, limit: PAGE_SIZE, offset: pageParam, gmailLabel: gmailLabel || undefined },
      });
      return data.data as Thread[];
    },
    getNextPageParam: (lastPage, allPages) => {
      // If drafts or mock, no pagination
      if (isDrafts || USE_MOCK) return undefined;
      // If we got fewer than PAGE_SIZE results, there are no more pages
      if (lastPage.length < PAGE_SIZE) return undefined;
      // Next offset is total items fetched so far
      return allPages.reduce((sum, page) => sum + page.length, 0);
    },
    initialPageParam: 0,
  });

  // Flatten pages into a single Thread[] for backward compatibility
  const data = useMemo(
    () => infiniteQuery.data?.pages.flat() ?? undefined,
    [infiniteQuery.data],
  );

  // #6 — Prefetch exactly one page ahead so scrolling is instant.
  // Track which page count we already prefetched for to avoid a recursive loop.
  const prefetchedForRef = useRef(0);

  // Reset prefetch tracking when mailbox/category changes (query key changes)
  useEffect(() => {
    prefetchedForRef.current = 0;
  }, [mailbox, category, gmailLabel]);

  useEffect(() => {
    const pageCount = infiniteQuery.data?.pages.length ?? 0;
    if (
      !isDrafts && !USE_MOCK &&
      infiniteQuery.hasNextPage &&
      !infiniteQuery.isFetchingNextPage &&
      pageCount > 0 &&
      prefetchedForRef.current < pageCount
    ) {
      prefetchedForRef.current = pageCount;
      const timer = setTimeout(() => {
        if (infiniteQuery.hasNextPage && !infiniteQuery.isFetchingNextPage) {
          infiniteQuery.fetchNextPage();
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [infiniteQuery.data?.pages.length, infiniteQuery.hasNextPage, infiniteQuery.isFetchingNextPage, isDrafts]);

  return {
    data,
    isLoading: infiniteQuery.isLoading,
    isFetching: infiniteQuery.isFetching,
    isError: infiniteQuery.isError,
    refetch: infiniteQuery.refetch,
    fetchNextPage: infiniteQuery.fetchNextPage,
    hasNextPage: infiniteQuery.hasNextPage,
    isFetchingNextPage: infiniteQuery.isFetchingNextPage,
  };
}

export function useThread(id: string | null) {
  return useQuery({
    queryKey: queryKeys.threads.detail(id!),
    queryFn: async () => {
      if (USE_MOCK) return getMockThread(id!);
      const { data } = await api.get(`/threads/${id}`);
      return data.data as Thread;
    },
    enabled: !!id,
  });
}

// #5 — Selective invalidation: only invalidate affected mailbox keys + counts
function invalidateForArchive(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys.threads.counts });
  // Invalidate all mailbox lists since archive affects inbox → archive
  queryClient.invalidateQueries({ queryKey: ['threads', 'mailbox'] });
}

function invalidateForTrash(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys.threads.counts });
  queryClient.invalidateQueries({ queryKey: ['threads', 'mailbox'] });
}

function invalidateForStar(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys.threads.counts });
  // Star only affects the current list and the starred mailbox
  queryClient.invalidateQueries({ queryKey: queryKeys.threads.mailbox('starred') });
}

function invalidateForReadStatus(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys.threads.counts });
  // Read/unread changes badge counts but threads stay in the same list
}

export function useArchiveThread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (threadId: string) => {
      if (USE_MOCK) return;
      await api.post(`/threads/${threadId}/archive`);
    },
    onSuccess: () => {
      invalidateForArchive(queryClient);
    },
  });
}

export function useTrashThread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (threadId: string) => {
      if (USE_MOCK) return;
      await api.post(`/threads/${threadId}/trash`);
    },
    onSuccess: () => {
      invalidateForTrash(queryClient);
    },
  });
}

// ─── Infinite query cache helpers ─────────────────────────────────────
//
// The mailbox thread list uses useInfiniteQuery, so the cache shape is
// { pages: Thread[][], pageParams: number[] } rather than Thread[].

interface InfiniteData {
  pages: Thread[][];
  pageParams: number[];
}

function removeFromInfiniteCache(old: InfiniteData | undefined, threadId: string): InfiniteData | undefined {
  if (!old) return old;
  return { ...old, pages: old.pages.map((page) => page.filter((t) => t.id !== threadId)) };
}

function removeManyFromInfiniteCache(old: InfiniteData | undefined, threadIds: Set<string>): InfiniteData | undefined {
  if (!old) return old;
  return { ...old, pages: old.pages.map((page) => page.filter((t) => !threadIds.has(t.id))) };
}

function mapInfiniteCache(
  old: InfiniteData | undefined,
  fn: (thread: Thread) => Thread,
): InfiniteData | undefined {
  if (!old) return old;
  return { ...old, pages: old.pages.map((page) => page.map(fn)) };
}

// ─── Undo-aware archive ───────────────────────────────────────────────
//
// Pattern:
//   1. Optimistically remove the thread from the TanStack Query cache.
//   2. Show an undo toast with a countdown.
//   3a. Undo clicked  → restore the thread in the cache (no API call).
//   3b. Timer expires → call the real archive API, then invalidate.

export function useArchiveWithUndo() {
  const queryClient = useQueryClient();
  const archiveMutation = useArchiveThread();
  const { addToast } = useToastStore();

  return useCallback(
    (threadId: string, listKey: readonly unknown[]) => {
      // Snapshot the current infinite data so we can restore it on undo
      const previousData = queryClient.getQueryData<InfiniteData>(listKey);

      // Optimistically remove the thread from all pages
      queryClient.setQueryData<InfiniteData>(listKey, (old) =>
        removeFromInfiniteCache(old, threadId),
      );

      addToast({
        type: 'undo',
        message: i18n.t('toast.conversationArchived'),
        duration: 5000,
        undoAction: () => {
          queryClient.setQueryData<InfiniteData>(listKey, previousData);
        },
        commitAction: () => {
          archiveMutation.mutate(threadId);
        },
      });
    },
    [queryClient, archiveMutation, addToast],
  );
}

// ─── Undo-aware trash ─────────────────────────────────────────────────

export function useTrashWithUndo() {
  const queryClient = useQueryClient();
  const trashMutation = useTrashThread();
  const { addToast } = useToastStore();

  return useCallback(
    (threadId: string, listKey: readonly unknown[]) => {
      const previousData = queryClient.getQueryData<InfiniteData>(listKey);

      queryClient.setQueryData<InfiniteData>(listKey, (old) =>
        removeFromInfiniteCache(old, threadId),
      );

      addToast({
        type: 'undo',
        message: i18n.t('toast.conversationTrashed'),
        duration: 5000,
        undoAction: () => {
          queryClient.setQueryData<InfiniteData>(listKey, previousData);
        },
        commitAction: () => {
          trashMutation.mutate(threadId);
        },
      });
    },
    [queryClient, trashMutation, addToast],
  );
}

// ─── Bulk undo-aware archive ──────────────────────────────────────────

export function useBulkArchiveWithUndo() {
  const queryClient = useQueryClient();
  const archiveMutation = useArchiveThread();
  const { addToast } = useToastStore();

  return useCallback(
    (threadIds: Set<string>, listKey: readonly unknown[]) => {
      const previousData = queryClient.getQueryData<InfiniteData>(listKey);

      queryClient.setQueryData<InfiniteData>(listKey, (old) =>
        removeManyFromInfiniteCache(old, threadIds),
      );

      const count = threadIds.size;
      addToast({
        type: 'undo',
        message: i18n.t('toast.conversationArchived') + (count > 1 ? ` (${count})` : ''),
        duration: 5000,
        undoAction: () => {
          queryClient.setQueryData<InfiniteData>(listKey, previousData);
        },
        commitAction: () => {
          threadIds.forEach((id) => archiveMutation.mutate(id));
        },
      });
    },
    [queryClient, archiveMutation, addToast],
  );
}

// ─── Bulk undo-aware trash ────────────────────────────────────────────

export function useBulkTrashWithUndo() {
  const queryClient = useQueryClient();
  const trashMutation = useTrashThread();
  const { addToast } = useToastStore();

  return useCallback(
    (threadIds: Set<string>, listKey: readonly unknown[]) => {
      const previousData = queryClient.getQueryData<InfiniteData>(listKey);

      queryClient.setQueryData<InfiniteData>(listKey, (old) =>
        removeManyFromInfiniteCache(old, threadIds),
      );

      const count = threadIds.size;
      addToast({
        type: 'undo',
        message: i18n.t('toast.conversationTrashed') + (count > 1 ? ` (${count})` : ''),
        duration: 5000,
        undoAction: () => {
          queryClient.setQueryData<InfiniteData>(listKey, previousData);
        },
        commitAction: () => {
          threadIds.forEach((id) => trashMutation.mutate(id));
        },
      });
    },
    [queryClient, trashMutation, addToast],
  );
}

export function useToggleStar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (threadId: string) => {
      if (USE_MOCK) return;
      await api.post(`/threads/${threadId}/star`);
    },
    onMutate: async (threadId: string) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.threads.all });

      const toggleFn = (t: Thread) =>
        t.id === threadId ? { ...t, isStarred: !t.isStarred } : t;

      // Optimistically toggle isStarred in all matching thread list caches.
      // These are now infinite query caches with { pages, pageParams } shape.
      const allQueries = queryClient.getQueriesData<InfiniteData>({ queryKey: queryKeys.threads.all });
      const previousData: Array<[readonly unknown[], unknown]> = [];
      for (const [key, data] of allQueries) {
        if (data && 'pages' in data) {
          previousData.push([key, data]);
          queryClient.setQueryData<InfiniteData>(key, (old) => mapInfiniteCache(old, toggleFn));
        }
      }

      // Also toggle in the detail cache
      const detailKey = queryKeys.threads.detail(threadId);
      const previousDetail = queryClient.getQueryData<Thread>(detailKey);
      if (previousDetail) {
        previousData.push([detailKey, previousDetail]);
        queryClient.setQueryData<Thread>(detailKey, {
          ...previousDetail,
          isStarred: !previousDetail.isStarred,
        });
      }

      return { previousData };
    },
    onError: (_err, _threadId, context) => {
      if (context?.previousData) {
        for (const [key, data] of context.previousData) {
          queryClient.setQueryData(key, data);
        }
      }
    },
    onSettled: () => {
      if (!USE_MOCK) {
        invalidateForStar(queryClient);
      }
    },
  });
}

export function useSnoozeThread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ threadId, snoozeUntil }: { threadId: string; snoozeUntil: string }) => {
      if (USE_MOCK) return;
      await api.post(`/threads/${threadId}/snooze`, { snoozeUntil });
    },
    onSuccess: () => {
      invalidateForArchive(queryClient);
    },
  });
}

export function useSendEmail() {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  return useMutation({
    mutationFn: async (payload: {
      to: string[];
      cc?: string[];
      bcc?: string[];
      subject: string;
      bodyHtml: string;
      threadId?: string;
      inReplyTo?: string;
      referencesHeader?: string;
      trackingEnabled?: boolean;
    }) => {
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 500));
        return;
      }
      await api.post('/threads/send', payload);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.threads.counts });
      queryClient.invalidateQueries({ queryKey: queryKeys.threads.mailbox('sent') });
      // Refresh the active thread so the sent reply appears immediately
      if (variables.threadId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.threads.detail(variables.threadId) });
      }
      addToast({ type: 'success', message: i18n.t('toast.messageSent'), duration: 3000 });
    },
    onError: () => {
      addToast({ type: 'error', message: i18n.t('toast.failedToSend'), duration: 5000 });
    },
  });
}

export function useMarkReadUnread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ threadId, isUnread }: { threadId: string; isUnread: boolean }) => {
      if (USE_MOCK) return;
      await api.post(`/threads/${threadId}/read`, { isUnread });
    },
    onMutate: async ({ threadId, isUnread }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.threads.all });

      const readFn = (t: Thread) =>
        t.id === threadId
          ? { ...t, unreadCount: isUnread ? Math.max(1, t.unreadCount) : 0 }
          : t;

      // Update every infinite query cache under the 'threads' prefix.
      const allQueries = queryClient.getQueriesData<InfiniteData>({ queryKey: queryKeys.threads.all });
      for (const [key, data] of allQueries) {
        if (data && 'pages' in data) {
          queryClient.setQueryData<InfiniteData>(key, (old) => mapInfiniteCache(old, readFn));
        }
      }

      // Update the individual thread detail cache entry separately.
      const detailKey = queryKeys.threads.detail(threadId);
      const prevDetail = queryClient.getQueryData<Thread>(detailKey);
      if (prevDetail) {
        queryClient.setQueryData<Thread>(detailKey, {
          ...prevDetail,
          unreadCount: isUnread ? Math.max(1, prevDetail.unreadCount) : 0,
          emails: prevDetail.emails?.map((e) => ({ ...e, isUnread })),
        });
      }
    },
    onSuccess: () => {
      invalidateForReadStatus(queryClient);
    },
  });
}

export function useSpamThread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (threadId: string) => {
      if (USE_MOCK) return;
      await api.post(`/threads/${threadId}/spam`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.threads.counts });
      queryClient.invalidateQueries({ queryKey: ['threads', 'mailbox'] });
    },
  });
}

export function useBlockSender() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ threadId, senderEmail }: { threadId: string; senderEmail: string }) => {
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 300));
        return;
      }
      await api.post('/block-sender', { threadId, senderEmail });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.threads.counts });
      queryClient.invalidateQueries({ queryKey: ['threads', 'mailbox'] });
    },
  });
}


export function useUnsubscribe() {
  return useMutation({
    mutationFn: async (threadId: string) => {
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 400));
        return;
      }
      await api.post(`/threads/${threadId}/unsubscribe`);
    },
  });
}

export function useScheduleSend() {
  return useMutation({
    mutationFn: async (payload: {
      to: string[];
      cc?: string[];
      bcc?: string[];
      subject: string;
      bodyHtml: string;
      threadId?: string;
      inReplyTo?: string;
      trackingEnabled?: boolean;
      scheduledFor: string; // ISO 8601
    }) => {
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 400));
        return;
      }
      await api.post('/threads/schedule', payload);
    },
  });
}

export interface GmailLabel {
  id: string;
  name: string;
  type: 'system' | 'user';
  color: { background: string; text: string } | null;
}

export function useGmailLabels() {
  return useQuery({
    queryKey: queryKeys.labels.gmail,
    queryFn: async () => {
      if (USE_MOCK) return [] as GmailLabel[];
      const { data } = await api.get('/threads/labels');
      return data.data as GmailLabel[];
    },
    staleTime: 5 * 60_000, // cache for 5 minutes
  });
}

export function useCreateGmailLabel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data } = await api.post('/threads/labels', { name });
      return data.data as GmailLabel;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.labels.gmail });
    },
  });
}

export function useUpdateGmailLabel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ labelId, name }: { labelId: string; name: string }) => {
      const { data } = await api.patch(`/threads/labels/${encodeURIComponent(labelId)}`, { name });
      return data.data as GmailLabel;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.labels.gmail });
    },
  });
}

export function useDeleteGmailLabel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (labelId: string) => {
      await api.delete(`/threads/labels/${encodeURIComponent(labelId)}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.labels.gmail });
    },
  });
}

export function useSpamWithUndo() {
  const queryClient = useQueryClient();
  const spamMutation = useSpamThread();
  const { addToast } = useToastStore();

  return useCallback(
    (threadId: string, listKey: readonly unknown[]) => {
      const previousData = queryClient.getQueryData<InfiniteData>(listKey);

      queryClient.setQueryData<InfiniteData>(listKey, (old) =>
        removeFromInfiniteCache(old, threadId),
      );

      addToast({
        type: 'undo',
        message: i18n.t('toast.conversationSpammed'),
        duration: 5000,
        undoAction: () => {
          queryClient.setQueryData<InfiniteData>(listKey, previousData);
        },
        commitAction: () => {
          spamMutation.mutate(threadId);
        },
      });
    },
    [queryClient, spamMutation, addToast],
  );
}

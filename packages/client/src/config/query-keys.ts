export const queryKeys = {
  threads: {
    all: ['threads'] as const,
    counts: ['threads', 'counts'] as const,
    list: (category?: string) => ['threads', 'list', category] as const,
    detail: (id: string) => ['threads', 'detail', id] as const,
    mailbox: (mailbox: string, category?: string) =>
      ['threads', 'mailbox', mailbox, category] as const,
  },
  labels: {
    all: ['labels'] as const,
    gmail: ['labels', 'gmail'] as const,
  },
  search: {
    all: ['search'] as const,
    results: (query: string) => ['search', query] as const,
  },
  settings: {
    all: ['settings'] as const,
    tasks: ['settings', 'tasks'] as const,
  },
  account: {
    all: ['account'] as const,
  },
  tracking: {
    all: ['tracking'] as const,
    thread: (threadId: string) => ['tracking', 'thread', threadId] as const,
  },
  contacts: {
    all: ['contacts'] as const,
    search: (query: string) => ['contacts', 'search', query] as const,
    byEmail: (email: string) => ['contacts', 'byEmail', email] as const,
  },
  calendar: {
    all: ['calendar'] as const,
    calendars: ['calendar', 'calendars'] as const,
    events: (timeMin: string, timeMax: string) => ['calendar', 'events', timeMin, timeMax] as const,
    freeBusy: (emails: string, timeMin: string, timeMax: string) =>
      ['calendar', 'freebusy', emails, timeMin, timeMax] as const,
    search: (query: string) => ['calendar', 'search', query] as const,
  },
  docs: {
    all: ['docs'] as const,
    list: ['docs', 'list'] as const,
    tree: ['docs', 'tree'] as const,
    detail: (id: string) => ['docs', 'detail', id] as const,
    comments: (docId: string) => ['docs', 'comments', docId] as const,
    backlinks: (docId: string) => ['docs', 'backlinks', docId] as const,
  },
  drawings: {
    all: ['drawings'] as const,
    list: ['drawings', 'list'] as const,
    detail: (id: string) => ['drawings', 'detail', id] as const,
  },
  tasks: {
    all: ['tasks'] as const,
    list: (filters?: string) => ['tasks', 'list', filters] as const,
    detail: (id: string) => ['tasks', 'detail', id] as const,
    counts: ['tasks', 'counts'] as const,
    projects: ['tasks', 'projects'] as const,
    subtasks: (taskId: string) => ['tasks', 'subtasks', taskId] as const,
    activities: (taskId: string) => ['tasks', 'activities', taskId] as const,
    templates: ['tasks', 'templates'] as const,
  },
  tables: {
    all: ['tables'] as const,
    list: ['tables', 'list'] as const,
    detail: (id: string) => ['tables', 'detail', id] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    unreadCount: ['notifications', 'unread-count'] as const,
  },
  platform: {
    all: ['platform'] as const,
    catalog: (category?: string) => ['platform', 'catalog', category] as const,
    catalogApp: (manifestId: string) => ['platform', 'catalog-app', manifestId] as const,
    tenants: ['platform', 'tenants'] as const,
    installations: (tenantId: string) => ['platform', 'installations', tenantId] as const,
    assignments: (tenantId: string, installationId: string) =>
      ['platform', 'assignments', tenantId, installationId] as const,
    tenantUsers: (tenantId: string) => ['platform', 'tenant-users', tenantId] as const,
  },
  drive: {
    all: ['drive'] as const,
    items: (parentId?: string | null) => ['drive', 'items', parentId ?? 'root'] as const,
    detail: (id: string) => ['drive', 'detail', id] as const,
    breadcrumbs: (id: string) => ['drive', 'breadcrumbs', id] as const,
    favourites: ['drive', 'favourites'] as const,
    recent: ['drive', 'recent'] as const,
    trash: ['drive', 'trash'] as const,
    search: (q: string) => ['drive', 'search', q] as const,
    folders: ['drive', 'folders'] as const,
    storage: ['drive', 'storage'] as const,
    versions: (id: string) => ['drive', 'versions', id] as const,
    shareLinks: (id: string) => ['drive', 'shareLinks', id] as const,
    byType: (type: string) => ['drive', 'byType', type] as const,
  },
  admin: {
    all: ['admin'] as const,
    overview: ['admin', 'overview'] as const,
    tenants: ['admin', 'tenants'] as const,
    tenant: (id: string) => ['admin', 'tenant', id] as const,
    installations: ['admin', 'installations'] as const,
    containers: ['admin', 'containers'] as const,
  },
};

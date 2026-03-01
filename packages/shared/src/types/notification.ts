export interface Notification {
  id: string;
  userId: string;
  accountId: string;
  type: 'reminder' | 'task' | 'system';
  title: string;
  body: string | null;
  sourceType: 'event' | 'task' | 'document' | null;
  sourceId: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface PushSubscription {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  createdAt: string;
}

import { randomUUID } from 'crypto';
import type { ImportSession } from './types';

const SESSION_TTL_MS = 30 * 60 * 1000;

class SessionStore {
  private sessions = new Map<string, ImportSession>();
  private sweepTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.sweepTimer = setInterval(() => this.sweep(), 60 * 1000);
    if (this.sweepTimer.unref) this.sweepTimer.unref();
  }

  create(tenantId: string, userId: string): ImportSession {
    const session: ImportSession = {
      sessionId: randomUUID(),
      tenantId,
      userId,
      createdAt: Date.now(),
      partners: [],
      leads: [],
      activities: [],
      dropped: [],
      customFields: [],
    };
    this.sessions.set(session.sessionId, session);
    return session;
  }

  get(sessionId: string): ImportSession | undefined {
    const s = this.sessions.get(sessionId);
    if (!s) return undefined;
    if (Date.now() - s.createdAt > SESSION_TTL_MS) {
      this.sessions.delete(sessionId);
      return undefined;
    }
    return s;
  }

  delete(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  private sweep(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.createdAt > SESSION_TTL_MS) {
        this.sessions.delete(id);
      }
    }
  }
}

export const sessionStore = new SessionStore();

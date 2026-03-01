import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { env } from '../config/env';

export interface AuthPayload {
  userId: string;
  accountId: string;
  email: string;
  tenantId?: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

// Lazy import to avoid circular dependency at module load time
let _db: any;
let _accounts: any;
async function getDb() {
  if (!_db) {
    const mod = await import('../config/database');
    _db = mod.db;
    const schema = await import('../db/schema');
    _accounts = schema.accounts;
  }
  return { db: _db, accounts: _accounts };
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  // Support token via query param for resources loaded by <img src> / direct links
  const queryToken = req.query.token as string | undefined;

  let token: string | undefined;
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (queryToken) {
    token = queryToken;
  }

  if (!token) {
    res.status(401).json({ success: false, error: 'Missing or invalid authorization header' });
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload;

    // Backwards compatibility: tokens issued before multi-account won't have userId.
    // Look it up from the database on-the-fly.
    if (!payload.userId) {
      getDb().then(async ({ db, accounts }) => {
        const [acct] = await db.select({ userId: accounts.userId }).from(accounts).where(eq(accounts.id, payload.accountId)).limit(1);
        if (!acct?.userId) {
          res.status(401).json({ success: false, error: 'Account not found or missing user link' });
          return;
        }
        payload.userId = acct.userId;
        req.auth = payload;
        next();
      }).catch(() => {
        res.status(401).json({ success: false, error: 'Failed to resolve user identity' });
      });
      return;
    }

    req.auth = payload;
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

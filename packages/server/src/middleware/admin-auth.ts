import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { env } from '../config/env';
import { db } from '../config/database';
import { users } from '../db/schema';
import type { AuthPayload } from './auth';

export async function adminAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Missing authorization header' });
    return;
  }

  const token = authHeader.slice(7);

  let payload: AuthPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
    return;
  }

  // Fast path: token already carries the flag (new logins after this change).
  let isSuperAdmin = payload.isSuperAdmin === true;

  // Fallback for tokens minted before the flag was added — look up the user.
  if (!isSuperAdmin && payload.isSuperAdmin === undefined) {
    const [row] = await db
      .select({ isSuperAdmin: users.isSuperAdmin })
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);
    isSuperAdmin = row?.isSuperAdmin === true;
  }

  if (!isSuperAdmin) {
    res.status(403).json({ success: false, error: 'Super-admin access required' });
    return;
  }

  req.auth = { ...payload, isSuperAdmin: true };
  next();
}

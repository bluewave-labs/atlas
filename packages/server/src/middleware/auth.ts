import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { TenantMemberRole } from '@atlas-platform/shared';
import { env } from '../config/env';

export interface AuthPayload {
  userId: string;
  tenantId: string;
  email: string;
  tenantRole?: TenantMemberRole;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
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
    req.auth = payload;
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

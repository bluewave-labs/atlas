import type { Request, Response, NextFunction } from 'express';
import { isAppEnabled } from '../services/platform/tenant-app.service';

/**
 * Middleware factory that checks whether the current tenant has an app enabled.
 * If the user has no tenant context (personal account), all apps are available.
 */
export function requireApp(appId: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const tenantId = req.auth?.tenantId;

    // No tenant context — all apps available
    if (!tenantId) return next();

    const enabled = await isAppEnabled(tenantId, appId);
    if (!enabled) {
      res.status(403).json({
        success: false,
        error: `App "${appId}" is not enabled for this organization`,
      });
      return;
    }
    next();
  };
}

import type { Request, Response, NextFunction } from 'express';
import {
  getAppPermission,
  canAccess,
  type AppOperation,
  type ResolvedAppPermission,
} from '../services/app-permissions.service';
import { logger } from '../utils/logger';

// Single global augmentation covering every app's req.{app}Perm property.
// Each app's router attaches its resolved permission under its own key so
// downstream handlers can reuse it without re-querying.
declare global {
  namespace Express {
    interface Request {
      crmPerm?: ResolvedAppPermission;
      docsPerm?: ResolvedAppPermission;
      drawPerm?: ResolvedAppPermission;
      drivePerm?: ResolvedAppPermission;
      hrPerm?: ResolvedAppPermission;
      invoicesPerm?: ResolvedAppPermission;
      projectsPerm?: ResolvedAppPermission;
      signPerm?: ResolvedAppPermission;
      tablesPerm?: ResolvedAppPermission;
      tasksPerm?: ResolvedAppPermission;
      workPerm?: ResolvedAppPermission;
    }
  }
}

/**
 * Express middleware factory that checks the caller's app permission for a
 * given operation. Attaches the resolved permission to `req.{appId}Perm`
 * (e.g. `req.hrPerm`, `req.crmPerm`) so downstream handlers can reuse it
 * without re-querying.
 *
 * Mounted once at the router level for the baseline `view` check — every
 * endpoint then inherits a uniform 403 response when the caller lacks
 * access. Per-endpoint create/update/delete/ownership checks still live
 * inside the individual controllers and read the permission from the
 * attached request property.
 */
export function requireAppPermission(appId: string, operation: AppOperation = 'view') {
  const reqKey = `${appId}Perm`;
  return async function appPermissionMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.auth!.userId;
      const tenantId = req.auth?.tenantId;
      const perm = await getAppPermission(tenantId, userId, appId);
      if (!canAccess(perm.role, operation)) {
        res.status(403).json({ success: false, error: `No permission to access ${appId}` });
        return;
      }
      (req as any)[reqKey] = perm;
      next();
    } catch (error) {
      logger.error({ error, appId }, 'App permission middleware failed');
      res.status(500).json({ success: false, error: `Failed to resolve ${appId} permission` });
    }
  };
}

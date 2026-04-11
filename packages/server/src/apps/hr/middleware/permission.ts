import type { Request, Response, NextFunction } from 'express';
import {
  getAppPermission,
  canAccess,
  type AppOperation,
  type ResolvedAppPermission,
} from '../../../services/app-permissions.service';
import { logger } from '../../../utils/logger';

declare global {
  namespace Express {
    interface Request {
      hrPerm?: ResolvedAppPermission;
    }
  }
}

/**
 * Express middleware factory that checks the caller's HR app permission
 * for a given operation. Attaches the resolved permission to `req.hrPerm`
 * so downstream handlers can reuse it without re-querying.
 *
 * Mounted once at the router level for the baseline `view` check — every
 * HR endpoint then inherits a uniform 403 response when the caller lacks
 * access. Per-endpoint create/update/delete/ownership checks still live
 * inside the individual controllers.
 */
export function requireHrPermission(operation: AppOperation) {
  return async function hrPermissionMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.auth!.userId;
      const tenantId = req.auth?.tenantId;
      const perm = await getAppPermission(tenantId, userId, 'hr');
      if (!canAccess(perm.role, operation)) {
        res.status(403).json({ success: false, error: 'No permission to access HR records' });
        return;
      }
      req.hrPerm = perm;
      next();
    } catch (error) {
      logger.error({ error }, 'HR permission middleware failed');
      res.status(500).json({ success: false, error: 'Failed to resolve HR permission' });
    }
  };
}

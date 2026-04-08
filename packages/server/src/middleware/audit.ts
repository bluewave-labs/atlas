import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Lazy imports to avoid circular dependency at module load time
let _db: any;
let _auditLog: any;
async function getDbAndSchema() {
  if (!_db) {
    const mod = await import('../config/database');
    _db = mod.db;
    const schema = await import('../db/schema');
    _auditLog = schema.auditLog;
  }
  return { db: _db, auditLog: _auditLog };
}

// Map HTTP method to action
function methodToAction(method: string): string | null {
  switch (method) {
    case 'POST': return 'create';
    case 'PUT': case 'PATCH': return 'update';
    case 'DELETE': return 'delete';
    default: return null;
  }
}

// Extract entity from URL path: /api/v1/crm/deals/123 -> 'crm_deal'
function extractEntity(path: string): { entity: string; entityId?: string } {
  const parts = path.replace('/api/v1/', '').split('/').filter(Boolean);
  if (parts.length === 0) return { entity: 'unknown' };

  const app = parts[0]; // 'crm', 'hr', 'tasks', etc.
  const resource = parts[1]; // 'deals', 'employees', etc.

  if (!resource) return { entity: app };

  // Singularize: 'deals' -> 'deal', 'companies' -> 'company'
  const singular = resource.endsWith('ies')
    ? resource.slice(0, -3) + 'y'
    : resource.endsWith('s')
      ? resource.slice(0, -1)
      : resource;

  const entity = `${app}_${singular}`;
  const entityId = parts[2] && !['seed', 'batch', 'search', 'widget', 'dashboard'].includes(parts[2])
    ? parts[2]
    : undefined;

  return { entity, entityId };
}

export function auditMiddleware(req: Request, res: Response, next: NextFunction) {
  const action = methodToAction(req.method);

  // Skip non-mutating requests and non-API paths
  if (!action || !req.path.startsWith('/api/v1/')) {
    next();
    return;
  }

  // Skip health checks, settings reads, auth endpoints
  if (req.path.includes('/health') || req.path.includes('/auth/') || req.path.includes('/seed')) {
    next();
    return;
  }

  // Capture original res.json to get status code
  const originalJson = res.json.bind(res);
  res.json = function (body: any) {
    // Write audit log asynchronously AFTER response
    const { entity, entityId } = extractEntity(req.path);

    getDbAndSchema().then(({ db, auditLog }) => {
      db.insert(auditLog).values({
        userId: req.auth?.userId ?? null,
        tenantId: req.auth?.tenantId ?? null,
        action,
        entity,
        entityId: entityId ?? body?.data?.id ?? null,
        path: req.path,
        method: req.method,
        statusCode: res.statusCode,
        ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || null,
        userAgent: req.headers['user-agent'] || null,
      }).then(() => {
        // audit log written successfully
      }).catch((err: unknown) => {
        logger.debug({ err }, 'Failed to write audit log');
      });
    }).catch((err: unknown) => {
      logger.debug({ err }, 'Failed to load audit log schema');
    });

    return originalJson(body);
  } as any;

  next();
}

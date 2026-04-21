import type { Request, Response, NextFunction } from 'express';

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Reject requests whose named path param is not a UUID.
 * Prevents non-UUID path segments from reaching the DB and
 * triggering SQL 22P02 cast errors on routes like GET /:id.
 */
export function requireUuidParam(paramName: string = 'id') {
  return (req: Request, res: Response, next: NextFunction) => {
    const value = req.params[paramName];
    if (!value || typeof value !== 'string' || !UUID_REGEX.test(value)) {
      res.status(400).json({
        success: false,
        error: `Invalid ${paramName}: not a UUID`,
        code: 'INVALID_UUID',
      });
      return;
    }
    next();
  };
}

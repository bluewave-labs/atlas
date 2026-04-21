import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { z, ZodError, ZodTypeAny, AnyZodObject } from 'zod';

interface ValidateSpec {
  params?: AnyZodObject;
  query?: AnyZodObject;
  body?: ZodTypeAny;
}

function formatIssues(err: ZodError, where: 'params' | 'query' | 'body') {
  return err.issues.map((i) => ({
    where,
    path: i.path.join('.') || '(root)',
    code: i.code,
    message: i.message,
  }));
}

/**
 * Build an Express middleware that validates params/query/body against Zod
 * schemas. On failure, responds with 400 + a structured list of issues.
 * On success, replaces req.body with the parsed (coerced) value.
 *
 * NB: req.params / req.query are read-only on recent Express versions, so
 *     we validate them but don't mutate.
 */
export function validate(spec: ValidateSpec): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const issues: ReturnType<typeof formatIssues> = [];

    if (spec.params) {
      const r = spec.params.safeParse(req.params);
      if (!r.success) issues.push(...formatIssues(r.error, 'params'));
    }
    if (spec.query) {
      const r = spec.query.safeParse(req.query);
      if (!r.success) issues.push(...formatIssues(r.error, 'query'));
    }
    if (spec.body) {
      const r = spec.body.safeParse(req.body);
      if (!r.success) issues.push(...formatIssues(r.error, 'body'));
      else req.body = r.data;
    }

    if (issues.length > 0) {
      res.status(400).json({
        success: false,
        error: 'Request validation failed',
        code: 'VALIDATION_ERROR',
        issues,
      });
      return;
    }
    next();
  };
}

// Re-export z so call-sites import a single thing.
export { z };

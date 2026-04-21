import { OpenAPIRegistry, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export const openApiRegistry = new OpenAPIRegistry();

openApiRegistry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

export const EnvelopeError = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.string().optional(),
});

export function envelope<T extends z.ZodTypeAny>(data: T) {
  return z.object({ success: z.literal(true), data });
}

export const OkEnvelope = z.object({ success: z.literal(true) });

export const Uuid = z.string().uuid();
export const IsoDateTime = z.string().datetime();
export const IsoDate = z.string().date();

export const UnauthorizedResp = {
  description: 'Unauthorized',
  content: { 'application/json': { schema: EnvelopeError } },
};

export const NotFoundResp = {
  description: 'Not found',
  content: { 'application/json': { schema: EnvelopeError } },
};

export const ConflictResp = {
  description: 'Stale resource — reload and retry',
  content: {
    'application/json': {
      schema: EnvelopeError.extend({ code: z.literal('STALE_RESOURCE') }),
    },
  },
};

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

export interface RouteDef {
  method: Method;
  path: string;
  tags: string[];
  summary: string;
  public?: boolean;
  params?: z.AnyZodObject;
  query?: z.AnyZodObject;
  body?: z.ZodTypeAny;
  response?: z.ZodTypeAny;
  concurrency?: boolean;
  extraResponses?: Record<number, { description: string; schema?: z.ZodTypeAny }>;
}

export function register(def: RouteDef) {
  const responses: Record<number, { description: string; content?: any }> = {};
  const okSchema = def.response ?? OkEnvelope;
  responses[200] = {
    description: 'Success',
    content: { 'application/json': { schema: okSchema } },
  };
  if (!def.public) responses[401] = UnauthorizedResp;
  if (def.path.includes('/:')) responses[404] = NotFoundResp;
  if (def.concurrency) responses[409] = ConflictResp;
  if (def.extraResponses) {
    for (const [code, r] of Object.entries(def.extraResponses)) {
      responses[Number(code)] = {
        description: r.description,
        content: r.schema ? { 'application/json': { schema: r.schema } } : undefined,
      };
    }
  }

  const openApiPath = def.path.replace(/:([a-zA-Z0-9_]+)/g, '{$1}');

  const request: any = {};
  if (def.params) request.params = def.params;
  if (def.query) request.query = def.query;
  if (def.body) {
    request.body = { content: { 'application/json': { schema: def.body } } };
  }

  openApiRegistry.registerPath({
    method: def.method,
    path: openApiPath,
    tags: def.tags,
    summary: def.summary,
    security: def.public ? undefined : [{ bearerAuth: [] }],
    request: Object.keys(request).length ? request : undefined,
    responses,
  });
}

// Common reusable schemas
export const User = z.object({
  id: Uuid,
  email: z.string().email(),
  name: z.string().nullable(),
  createdAt: IsoDateTime,
});

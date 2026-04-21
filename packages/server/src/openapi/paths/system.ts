import { z } from 'zod';
import { openApiRegistry } from '../_helpers';

openApiRegistry.registerPath({
  method: 'get',
  path: '/health',
  tags: ['System'],
  summary: 'Health check (no auth)',
  responses: {
    200: {
      description: 'OK',
      content: {
        'application/json': {
          schema: z.object({
            status: z.literal('ok'),
            uptime: z.number(),
            memory: z.object({ rss: z.number(), heapUsed: z.number() }),
            version: z.string(),
          }),
        },
      },
    },
  },
});

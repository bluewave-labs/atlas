import { Router } from 'express';
import { apiReference } from '@scalar/express-api-reference';
import { buildOpenApiDocument } from './registry';

const router = Router();

let cached: ReturnType<typeof buildOpenApiDocument> | null = null;
function getDoc() {
  if (!cached) cached = buildOpenApiDocument();
  return cached;
}

router.get('/openapi.json', (_req, res) => {
  res.json(getDoc());
});

const VALID_THEMES = new Set([
  'default', 'alternate', 'moon', 'purple', 'solarized',
  'bluePlanet', 'saturn', 'kepler', 'mars', 'deepSpace', 'none',
]);

router.get('/reference', (req, res, next) => {
  const requested = typeof req.query.theme === 'string' ? req.query.theme : '';
  const theme = VALID_THEMES.has(requested) ? requested : 'purple';
  return apiReference({
    url: '/api/v1/openapi.json',
    theme: theme as any,
    pageTitle: 'Atlas API',
  })(req as any, res as any, next);
});

export const openApiRoutes = router;

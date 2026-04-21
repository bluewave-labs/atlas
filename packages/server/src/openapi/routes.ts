import { Router } from 'express';
import type { RequestHandler } from 'express';
import { apiReference } from '@scalar/express-api-reference';
import { buildOpenApiDocument } from './registry';

const router = Router();

let cachedJson: string | null = null;
function getDocJson() {
  if (!cachedJson) cachedJson = JSON.stringify(buildOpenApiDocument());
  return cachedJson;
}

router.get('/openapi.json', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.type('application/json').send(getDocJson());
});

const THEMES = [
  'default', 'alternate', 'moon', 'purple', 'solarized',
  'bluePlanet', 'saturn', 'kepler', 'mars', 'deepSpace', 'none',
] as const;
type Theme = typeof THEMES[number];
const THEME_SET: ReadonlySet<string> = new Set(THEMES);

const handlerByTheme = new Map<Theme, RequestHandler>();
function getHandler(theme: Theme): RequestHandler {
  let h = handlerByTheme.get(theme);
  if (!h) {
    h = apiReference({ url: '/api/v1/openapi.json', theme, pageTitle: 'Atlas API' }) as RequestHandler;
    handlerByTheme.set(theme, h);
  }
  return h;
}

router.get('/reference', (req, res, next) => {
  const requested = typeof req.query.theme === 'string' ? req.query.theme : '';
  const theme: Theme = THEME_SET.has(requested) ? (requested as Theme) : 'purple';
  getHandler(theme)(req, res, next);
});

export const openApiRoutes = router;

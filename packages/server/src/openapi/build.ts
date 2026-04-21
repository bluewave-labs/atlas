/**
 * Standalone CI entrypoint: build the OpenAPI document and exit non-zero
 * on any schema registration error. Keeps bad registry entries from
 * sneaking through without a running server.
 *
 * Usage: `npx tsx packages/server/src/openapi/build.ts`
 */
import { buildOpenApiDocument } from './registry';

try {
  const doc = buildOpenApiDocument();
  const paths = Object.keys(doc.paths);
  let ops = 0;
  for (const p of paths) ops += Object.keys((doc.paths as any)[p]).length;
  // eslint-disable-next-line no-console
  console.log(`OpenAPI document built OK — ${paths.length} paths, ${ops} operations.`);
  process.exit(0);
} catch (err) {
  // eslint-disable-next-line no-console
  console.error('OpenAPI document build FAILED:');
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
}

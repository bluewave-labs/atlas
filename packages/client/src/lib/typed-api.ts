/**
 * Typed API helpers built on top of `api` (axios).
 *
 * Uses `paths` from the auto-generated `types/api.generated.ts` so that:
 * - request query/body shapes are enforced at call sites,
 * - response payloads are fully typed.
 *
 * Regenerate types with:  npm run openapi:types --workspace=@atlas-platform/client
 * (the Atlas dev server must be running at :3001).
 *
 * Migration policy: opt-in. Migrate a call site here when you touch it.
 * Hand-maintained call sites in hooks.ts still work unchanged.
 */
import { api } from './api-client';
import type { paths } from '../types/api.generated';

type PathsWith<M extends string> = {
  [P in keyof paths]: paths[P] extends { [K in M]: unknown } ? P : never;
}[keyof paths];

type GetPath = PathsWith<'get'>;
type PostPath = PathsWith<'post'>;
type PatchPath = PathsWith<'patch'>;
type PutPath = PathsWith<'put'>;
type DeletePath = PathsWith<'delete'>;

type Op<P extends keyof paths, M extends string> = paths[P] extends { [K in M]: infer O } ? O : never;

type QueryOf<P extends GetPath> = Op<P, 'get'> extends { parameters: { query?: infer Q } } ? Q : undefined;
type GetResponseBody<P extends GetPath> =
  Op<P, 'get'> extends { responses: { 200: { content: { 'application/json': infer B } } } } ? B : unknown;

type BodyOf<P extends keyof paths, M extends string> =
  Op<P, M> extends { requestBody?: { content: { 'application/json': infer B } } } ? B : undefined;

type ResponseBody<P extends keyof paths, M extends string> =
  Op<P, M> extends { responses: { 200: { content: { 'application/json': infer B } } } } ? B : unknown;

/** Typed GET. Pass the path as a type-level literal; TS infers query + response. */
export async function apiGet<P extends GetPath>(
  path: P,
  query?: QueryOf<P>,
): Promise<GetResponseBody<P>> {
  const { data } = await api.get(path as string, { params: query });
  return data as GetResponseBody<P>;
}

export async function apiPost<P extends PostPath>(
  path: P,
  body: BodyOf<P, 'post'>,
): Promise<ResponseBody<P, 'post'>> {
  const { data } = await api.post(path as string, body);
  return data as ResponseBody<P, 'post'>;
}

export async function apiPatch<P extends PatchPath>(
  path: P,
  body: BodyOf<P, 'patch'>,
): Promise<ResponseBody<P, 'patch'>> {
  const { data } = await api.patch(path as string, body);
  return data as ResponseBody<P, 'patch'>;
}

export async function apiPut<P extends PutPath>(
  path: P,
  body: BodyOf<P, 'put'>,
): Promise<ResponseBody<P, 'put'>> {
  const { data } = await api.put(path as string, body);
  return data as ResponseBody<P, 'put'>;
}

export async function apiDelete<P extends DeletePath>(
  path: P,
): Promise<ResponseBody<P, 'delete'>> {
  const { data } = await api.delete(path as string);
  return data as ResponseBody<P, 'delete'>;
}

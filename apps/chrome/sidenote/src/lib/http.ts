import { apiUrl } from './api.js';
import { refreshAuth, type AuthRecord, type FetchLike } from './auth.js';

export type ApiResult = {
  status: number;
  body: unknown;
  auth: AuthRecord | null;
  reauth: boolean;
};

export async function apiRequest(
  fetchImpl: FetchLike,
  auth: AuthRecord | null,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<ApiResult> {
  const first = await send(fetchImpl, auth, path, init);
  if (first.status !== 401 || !auth) return { status: first.status, body: first.body, auth, reauth: false };
  try {
    const next = await refreshAuth(fetchImpl, auth);
    const second = await send(fetchImpl, next, path, init);
    if (second.status === 401) return { status: 401, body: second.body, auth: null, reauth: true };
    return { status: second.status, body: second.body, auth: next, reauth: false };
  } catch {
    return { status: 401, body: first.body, auth: null, reauth: true };
  }
}

async function send(
  fetchImpl: FetchLike,
  auth: AuthRecord | null,
  path: string,
  init: { method?: string; body?: unknown },
): Promise<{ status: number; body: unknown }> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  if (auth?.accessToken) headers.authorization = `Bearer ${auth.accessToken}`;
  const response = await fetchImpl(apiUrl(path), {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { status: response.status, body };
}

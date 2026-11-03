// The admin's Google ID token, kept for this tab (sessionStorage) until it expires (Google
// tokens last an hour). Every admin call sends it as a Bearer token; the Worker checks it and
// the ADMIN_EMAILS list (apps/worker/src/admin.ts).

import { ApiError, apiUrl } from '../api.js';

const KEY = 'pitwall:admin-token';

function expiry(token: string): number {
  try {
    const body = JSON.parse(
      atob((token.split('.')[1] ?? '').replace(/-/g, '+').replace(/_/g, '/')),
    );
    return typeof body.exp === 'number' ? body.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

export function adminToken(): string | null {
  try {
    const t = sessionStorage.getItem(KEY);
    return t && expiry(t) > Date.now() + 30_000 ? t : null;
  } catch {
    return null;
  }
}

export function setAdminToken(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(KEY, token);
    else sessionStorage.removeItem(KEY);
  } catch {
    // storage blocked: the token lives for this page only
  }
}

/** An admin API call (GET without a body, POST with one). */
export async function adminCall<T>(path: string, body?: unknown): Promise<T> {
  const token = adminToken();
  if (!token) throw new ApiError(401, 'sign-in-required');
  const res = await fetch(apiUrl(path), {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.ok) return res.json() as Promise<T>;
  let code = 'http-error';
  try {
    code = ((await res.json()) as { error?: string }).error ?? code;
  } catch {
    // not JSON
  }
  throw new ApiError(res.status, code);
}

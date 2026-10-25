// API base resolution.
//
// Dev:  VITE_API_BASE is unset -> base is '' -> fetch('/api/daily') is relative and the
//       Vite proxy (see vite.config.ts) forwards it to the local Worker on :8787.
// Prod: set VITE_API_BASE to the deployed Worker origin (e.g.
//       https://pitwall.<account>.workers.dev) at build time. Requests then go
//       cross-origin to the Worker, which allows them via CORS (WEB_ORIGIN).

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

/** Build a full API URL for a path like '/api/daily'. */
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

/** Fetch JSON from the API, throwing on a non-2xx response. */
export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(apiUrl(path));
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

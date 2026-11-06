// API base resolution.
//
// Dev:  VITE_API_BASE is unset -> base is '' -> fetch('/api/daily') is relative and the
//       Vite proxy (see vite.config.ts) forwards it to the Worker.
// Prod: VITE_API_BASE is the deployed Worker origin (https://pitwall.boxboxbox.workers.dev),
//       set at build time. Requests go cross-origin; the Worker allows the site via CORS
//       (WEB_ORIGIN).

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

/** An API error with the server's code (`already-submitted`, `bad-grades`, …) and detail. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly detail?: string,
  ) {
    super(`${status} ${code}`);
  }
}

/** Build a full API URL for a path like '/api/daily'. */
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

async function parse<T>(res: Response): Promise<T> {
  if (res.ok) return res.json() as Promise<T>;
  let code = 'http-error';
  try {
    code = ((await res.json()) as { error?: string }).error ?? code;
  } catch {
    // not JSON
  }
  throw new ApiError(res.status, code);
}

/** Fetch JSON from the API (or an absolute URL, such as a daily's modelUrl). */
export async function apiGet<T>(path: string): Promise<T> {
  return parse<T>(await fetch(path.startsWith('http') ? path : apiUrl(path)));
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return parse<T>(
    await fetch(apiUrl(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

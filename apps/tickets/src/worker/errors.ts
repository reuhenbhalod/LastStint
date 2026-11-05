// The Worker's bindings and its one error type (sent as { error, detail? } JSON by onError in
// index.ts, the same shape as apps/worker).

export interface Env {
  DB: D1Database;
}

export class ApiError extends Error {
  constructor(
    readonly status: 400 | 404 | 413 | 415,
    readonly code: string,
    readonly detail?: string,
  ) {
    super(detail ?? code);
  }
}

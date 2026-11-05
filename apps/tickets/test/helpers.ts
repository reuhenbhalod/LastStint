// API calls against the Worker under test.

import { SELF } from 'cloudflare:test';

/** Call the API. A string body is sent as is; anything else as JSON. */
export function api(method: string, path: string, body?: unknown): Promise<Response> {
  return SELF.fetch(`https://tickets.test${path}`, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
}

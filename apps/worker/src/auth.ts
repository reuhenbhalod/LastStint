// Sign-in (feedback spec D3, docs/auth0-spec.md). The web app gets an ID token, from Auth0
// (its login page: Google, or email and password) or, without Auth0 set up, from Google
// Identity Services; we check it here: an RS256 signature by one of the issuer's current keys,
// our client ID as the audience, the issuer, and not expired. No auth library: WebCrypto does
// the RSA check.

import type { Env } from './index.js';

export interface Identity {
  /** The account key: the bare Google ID for a Google sign-in, else the issuer's `sub`. */
  sub: string;
  email: string;
  name: string;
  /** The issuer has verified the account owns the email (admin access needs it). */
  emailVerified: boolean;
}

/** Kept for the Google-only path's callers. */
export type GoogleIdentity = Identity;

interface Jwk extends JsonWebKey {
  kid: string;
}

const GOOGLE_CERTS = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

/** Who issues the tokens we take: where its keys are, its issuer names, our client ID. */
export interface Issuer {
  jwks: string;
  issuers: string[];
  audience: string;
}

export const googleIssuer = (clientId: string): Issuer => ({
  jwks: GOOGLE_CERTS,
  issuers: GOOGLE_ISSUERS,
  audience: clientId,
});

export const auth0Issuer = (domain: string, clientId: string): Issuer => ({
  jwks: `https://${domain}/.well-known/jwks.json`,
  issuers: [`https://${domain}/`],
  audience: clientId,
});

const cachedKeys = new Map<string, { keys: Jwk[]; until: number }>();

/** An issuer's signing keys, cached for as long as it says they're good (max-age). */
async function issuerKeys(url: string, now: number): Promise<Jwk[]> {
  const hit = cachedKeys.get(url);
  if (hit && hit.until > now) return hit.keys;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`jwks ${url}: ${res.status}`);
  const { keys } = (await res.json()) as { keys: Jwk[] };
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('Cache-Control') ?? '')?.[1] ?? 3600);
  cachedKeys.set(url, { keys, until: now + maxAge * 1000 });
  return keys;
}

function b64urlBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function b64urlJson(s: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(b64urlBytes(s))) as Record<string, unknown>;
}

/**
 * The Google account an ID token proves, or null if the token isn't valid for `clientId`.
 * `keys` overrides Google's published keys (tests sign with their own).
 */
export function verifyGoogleToken(
  token: string,
  clientId: string,
  now: number,
  keys?: Jwk[],
): Promise<Identity | null> {
  return verifyIdToken(token, googleIssuer(clientId), now, keys);
}

/**
 * The account an ID token from `issuer` proves, or null if it isn't valid. `keys` overrides
 * the issuer's published keys (tests sign with their own).
 */
export async function verifyIdToken(
  token: string,
  issuer: Issuer,
  now: number,
  keys?: Jwk[],
): Promise<Identity | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, sig] = parts as [string, string, string];
  let header: Record<string, unknown>;
  let claims: Record<string, unknown>;
  try {
    header = b64urlJson(h);
    claims = b64urlJson(p);
  } catch {
    return null;
  }
  if (header.alg !== 'RS256') return null;
  const jwk = (keys ?? (await issuerKeys(issuer.jwks, now))).find((k) => k.kid === header.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  let ok = false;
  try {
    ok = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      b64urlBytes(sig),
      new TextEncoder().encode(`${h}.${p}`),
    );
  } catch {
    return null;
  }
  if (!ok) return null;
  if (!issuer.issuers.includes(String(claims.iss))) return null;
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(issuer.audience)) return null;
  if (typeof claims.exp !== 'number' || claims.exp * 1000 <= now) return null;
  if (typeof claims.sub !== 'string' || !claims.sub) return null;
  return {
    sub: accountKey(claims.sub),
    email: typeof claims.email === 'string' ? claims.email : '',
    name: typeof claims.name === 'string' ? claims.name : '',
    emailVerified: claims.email_verified === true || claims.email_verified === 'true',
  };
}

/**
 * The account key for a token's `sub`: a Google sign-in through Auth0 (`google-oauth2|<id>`)
 * keeps the bare Google ID, so accounts made with the old Google button are found again
 * (docs/auth0-spec.md A2). Anything else is kept whole (`auth0|...`).
 */
export function accountKey(sub: string): string {
  return sub.startsWith('google-oauth2|') ? sub.slice('google-oauth2|'.length) : sub;
}

/** Sign-in is set up: Auth0 (domain and client ID) or, failing that, Google. */
export function authConfigured(env: Env): boolean {
  return !!((env.AUTH0_DOMAIN && env.AUTH0_CLIENT_ID) || env.GOOGLE_CLIENT_ID);
}

/**
 * The account a sign-in credential proves: an Auth0 ID token when Auth0 is set up, else a
 * Google one (so a deploy before the tenant exists keeps the old sign-in). Null if invalid.
 */
export function verifyCredential(env: Env, token: string, now: number): Promise<Identity | null> {
  if (env.AUTH0_DOMAIN && env.AUTH0_CLIENT_ID) {
    const keys = env.AUTH0_JWKS ? JSON.parse(env.AUTH0_JWKS).keys : undefined;
    return verifyIdToken(token, auth0Issuer(env.AUTH0_DOMAIN, env.AUTH0_CLIENT_ID), now, keys);
  }
  if (env.GOOGLE_CLIENT_ID) {
    const keys = env.GOOGLE_JWKS ? JSON.parse(env.GOOGLE_JWKS).keys : undefined;
    return verifyGoogleToken(token, env.GOOGLE_CLIENT_ID, now, keys);
  }
  return Promise.resolve(null);
}

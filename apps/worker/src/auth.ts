// Google sign-in (feedback spec D3). The web app gets an ID token from Google Identity
// Services; we check it here: an RS256 signature by one of Google's current keys, our client
// ID as the audience, Google as the issuer, and not expired. No Google library: WebCrypto
// does the RSA check.

export interface GoogleIdentity {
  sub: string;
  email: string;
  name: string;
}

interface Jwk extends JsonWebKey {
  kid: string;
}

const GOOGLE_CERTS = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

let cachedKeys: { keys: Jwk[]; until: number } | null = null;

/** Google's signing keys, cached for as long as Google says they're good (max-age). */
async function googleKeys(now: number): Promise<Jwk[]> {
  if (cachedKeys && cachedKeys.until > now) return cachedKeys.keys;
  const res = await fetch(GOOGLE_CERTS);
  if (!res.ok) throw new Error(`google certs: ${res.status}`);
  const { keys } = (await res.json()) as { keys: Jwk[] };
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('Cache-Control') ?? '')?.[1] ?? 3600);
  cachedKeys = { keys, until: now + maxAge * 1000 };
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
export async function verifyGoogleToken(
  token: string,
  clientId: string,
  now: number,
  keys?: Jwk[],
): Promise<GoogleIdentity | null> {
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
  const jwk = (keys ?? (await googleKeys(now))).find((k) => k.kid === header.kid);
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
  if (!ISSUERS.includes(String(claims.iss))) return null;
  if (claims.aud !== clientId) return null;
  if (typeof claims.exp !== 'number' || claims.exp * 1000 <= now) return null;
  if (typeof claims.sub !== 'string' || !claims.sub) return null;
  return {
    sub: claims.sub,
    email: typeof claims.email === 'string' ? claims.email : '',
    name: typeof claims.name === 'string' ? claims.name : '',
  };
}

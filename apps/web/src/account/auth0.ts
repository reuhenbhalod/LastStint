// Auth0 sign-in (docs/auth0-spec.md): Auth0's login page (Google, or email and password),
// loaded on demand. "Sign in" redirects there; on the way back the code in the URL is swapped
// for tokens and the URL cleaned. The ID token goes to the Worker exactly as Google's
// credential did. Without VITE_AUTH0_DOMAIN and VITE_AUTH0_CLIENT_ID there's no Auth0: the
// game falls back to the Google button (account/google.ts), or no sign-in at all.

import type { Auth0Client } from '@auth0/auth0-spa-js';

export const AUTH0_DOMAIN = import.meta.env.VITE_AUTH0_DOMAIN ?? '';
export const AUTH0_CLIENT_ID = import.meta.env.VITE_AUTH0_CLIENT_ID ?? '';
export const AUTH0_ENABLED = !!(AUTH0_DOMAIN && AUTH0_CLIENT_ID);

let client: Promise<Auth0Client> | null = null;

function auth0(): Promise<Auth0Client> {
  client ??= import('@auth0/auth0-spa-js').then(({ createAuth0Client }) =>
    createAuth0Client({
      domain: AUTH0_DOMAIN,
      clientId: AUTH0_CLIENT_ID,
      authorizationParams: { redirect_uri: location.origin },
      // Kept across reloads, and renewed without a redirect (the ID token lasts 10 hours).
      cacheLocation: 'localstorage',
      useRefreshTokens: true,
    }),
  );
  return client;
}

/** Go to Auth0's login page; come back to `returnTo` (this page by default). */
export async function login(returnTo = location.pathname + location.search): Promise<void> {
  const c = await auth0();
  await c.loginWithRedirect({ appState: { returnTo } });
}

let completing: Promise<string | null> | null = null;

/**
 * Back from Auth0's login page (a `code` and `state` in the URL): finish signing in, put the
 * page back where it was, and return the ID token. Null when this isn't a return from Auth0.
 * Runs once per page load, whoever asks first.
 */
export function completeLogin(): Promise<string | null> {
  completing ??= (async () => {
    if (!AUTH0_ENABLED) return null;
    const q = new URLSearchParams(location.search);
    if (!q.has('code') || !q.has('state')) return null;
    const c = await auth0();
    try {
      const { appState } = await c.handleRedirectCallback<{ returnTo?: string }>();
      history.replaceState(null, '', appState?.returnTo ?? location.pathname);
    } catch {
      history.replaceState(null, '', location.pathname);
      return null;
    }
    return (await c.getIdTokenClaims())?.__raw ?? null;
  })();
  return completing;
}

/** The current ID token (renewed if it's expired), or null when not signed in to Auth0. */
export async function idToken(): Promise<string | null> {
  if (!AUTH0_ENABLED) return null;
  const c = await auth0();
  try {
    await c.getTokenSilently();
    return (await c.getIdTokenClaims())?.__raw ?? null;
  } catch {
    return null;
  }
}

/** Sign out of Auth0 too, and come back to the site. */
export async function logout(): Promise<void> {
  if (!AUTH0_ENABLED) return;
  const c = await auth0();
  await c.logout({ logoutParams: { returnTo: location.origin } });
}

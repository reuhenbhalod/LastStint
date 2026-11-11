# Auth0 sign-in spec

Tickets 22 ("Improve auth and its UI") and 33 ("Add username and favourite team to sign-up"). Sign-in moves from Google Identity Services, where the Worker checks Google's ID token, to Auth0. Auth0 runs the login page, and the Worker checks Auth0's ID token instead.

## Decisions (Nov 6, 2026)

| # | Question | Decision |
|---|---|---|
| A1 | Ways to sign in | **Google, or email and password.** These are Auth0's `google-oauth2` and `Username-Password-Authentication` connections. Auth0 handles email verification and password resets. |
| A2 | Existing Google accounts | **Linked automatically.** An Auth0 Google user's `sub` is `google-oauth2\|<Google ID>`. The Worker strips the prefix, so the user finds their existing account (keyed by Google ID), and their streak and runs carry over. |
| A3 | The old Google button | **Replaced.** One "Sign in" button opens Auth0's login page, with Google as one of its options. |
| A4 | Profile | **Display name and favourite team at sign-up.** After a first sign-in, or for an account without a display name, the game asks for both. The name shows on the leaderboard. Both can be changed later from the account bar. (The team's colour used to theme the home page; since Nov 11, 2026 it doesn't: the race's real cars always keep their own teams' colours.) |

## Worker

- **`auth.ts`:** one RS256 ID-token check for any issuer's JWKS. Google's keys come from googleapis; Auth0's from `https://<AUTH0_DOMAIN>/.well-known/jwks.json`, with issuer `https://<AUTH0_DOMAIN>/` and audience `AUTH0_CLIENT_ID`. A missing or false `email_verified` still blocks admin access.
- **Which issuer.** With `AUTH0_DOMAIN` and `AUTH0_CLIENT_ID` set (wrangler vars), the Worker takes Auth0 tokens. Without them it falls back to Google's, so a deploy before the tenant exists changes nothing.
- **Account key** (migration 0008):
  - `players.google_sub` is renamed `account_sub`.
  - For a Google sign-in it holds the bare Google ID, as before; any other login keeps Auth0's full `sub` (`auth0|…`).
  - New columns `display_name` and `favourite_team`.
- **Endpoints:**
  - `POST /api/auth` `{ credential, anonId }`: sign in. `/api/auth/google` stays as an alias. The response adds `displayName`, `favouriteTeam` and `needsProfile`.
  - `POST /api/profile` `{ credential, displayName, favouriteTeam }`: set the profile. The token proves the account.
  - Validation: a display name is 3–20 characters (letters, digits, spaces, `_`, `-`, `.`), unique ignoring case (409 `name-taken`). A team is one of the teams the game knows, or empty.
- **The leaderboard** shows the display name when the run's player has one, and the generated name otherwise.
- **Admin:** unchanged (ADMIN_EMAILS, verified email). It checks the Auth0 token when Auth0 is configured.

## Game

- **`@auth0/auth0-spa-js`:**
  - "Sign in" sends the player to Auth0 with `loginWithRedirect`. On the way back, `handleRedirectCallback` runs and the URL is cleaned.
  - The ID token (`getIdTokenClaims().__raw`) goes to `POST /api/auth` exactly as Google's credential did.
  - Signing out clears the local account, and Auth0's session too (`logout`, back to the site).
  - Config: `VITE_AUTH0_DOMAIN` and `VITE_AUTH0_CLIENT_ID`. Without them there's no sign-in button, as with Google today.
- **Admin page:** its "Sign in" uses the same Auth0 login. The ID token is kept for the tab as the admin token; Auth0 ID tokens last 10 hours.
- **Profile sheet:**
  - Fields: display name and favourite team (the current grid's teams).
  - It opens after a first sign-in or when `needsProfile`, and from "Edit profile" in the account bar.
  - The favourite team's colour becomes the home page accent.

## Setup (the owner, in the Auth0 dashboard)

1. Create a tenant and a Single Page Application.
2. Set Allowed Callback, Logout and Web Origin URLs: `http://localhost:5173`, `https://pitwall-web.boxboxbox.workers.dev`. Add laststint.com once it points here.
3. Switch on the database (email and password) and Google connections for the app.
4. Use the "Pit Wall" Google OAuth client's ID and secret for the Google connection, and add `https://<AUTH0_DOMAIN>/login/callback` to its redirect URIs.
5. Publish the Google consent screen: in Testing, only listed users can sign in.
6. Put the domain and client ID in `apps/worker/wrangler.jsonc` vars, in CI's `VITE_AUTH0_*`, and in the web `dev` script.

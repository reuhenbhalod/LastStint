/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Deployed Worker origin for production API calls. Unset in dev (uses the Vite proxy). */
  readonly VITE_API_BASE?: string;
  /** "1": Eras runs on the in-browser mock API (eras/mockErasApi.ts), not the Worker. */
  readonly VITE_ERAS_MOCK?: string;
  /** Google OAuth client ID for sign-in. Unset: no sign-in button (streaks still show). */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  /** Auth0 tenant domain and SPA client ID (docs/auth0-spec.md). Set: sign-in is Auth0's. */
  readonly VITE_AUTH0_DOMAIN?: string;
  readonly VITE_AUTH0_CLIENT_ID?: string;
  /** "1": a production build keeps Versus (features.ts); otherwise only dev builds have it. */
  readonly VITE_VERSUS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

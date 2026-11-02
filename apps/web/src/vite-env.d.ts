/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Deployed Worker origin for production API calls. Unset in dev (uses the Vite proxy). */
  readonly VITE_API_BASE?: string;
  /** Google OAuth client ID for sign-in. Unset: no sign-in button (streaks still show). */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

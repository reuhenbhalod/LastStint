/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Deployed Worker origin for production API calls. Unset in dev (uses the Vite proxy). */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

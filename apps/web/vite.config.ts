/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Repo-root data/ — race models (and later scripts) shared with the pipeline, not copied.
const repoData = fileURLToPath(new URL('../../data', import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@data': repoData } },
  server: {
    // Allow importing the shared data/ dir (outside the app root) in dev.
    fs: { allow: ['..', repoData] },
    // Forward /api/* to the local Worker (`wrangler dev` on :8787) so dev requests are
    // same-origin and need no CORS. In production the web app calls the Worker's absolute
    // URL via VITE_API_BASE instead (see src/api.ts).
    proxy: {
      // ws: versus mode's match WebSockets (/api/versus/<code>/ws) go through too.
      '/api': { target: 'http://localhost:8787', ws: true },
    },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});

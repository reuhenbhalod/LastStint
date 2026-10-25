import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Forward /api/* to the local Worker (`wrangler dev` on :8787) so dev requests are
    // same-origin and need no CORS. In production the web app calls the Worker's absolute
    // URL via VITE_API_BASE instead (see src/api.ts).
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
});

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The app (src/web). `vite build` writes dist/, which the Worker serves as static assets.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // 5174, so it can run next to the game's dev server (apps/web, on 5173).
    port: 5174,
    // Forward /api/* to the local Worker (scripts/dev.ts runs `wrangler dev` on :8788).
    proxy: { '/api': 'http://localhost:8788' },
  },
});

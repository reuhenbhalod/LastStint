// The web app as the flows play it (playwright.flows.config.ts): the production build, with the
// Google sign-in path on (VITE_GOOGLE_CLIENT_ID, set by the config; Auth0 off), served by
// `vite preview`, which proxies /api to the flows' local Worker (FLOWS_API_PORT), so requests
// stay same-origin as in `vite` dev. Built into its own folder so it never meets the mocked
// suite's dist/.
import { mergeConfig } from 'vite';
import base from '../../vite.config.js';

export const FLOWS_OUT_DIR = 'node_modules/.flows-dist';

export default mergeConfig(base, {
  build: { outDir: FLOWS_OUT_DIR, emptyOutDir: true },
  preview: {
    proxy: { '/api': { target: `http://127.0.0.1:${process.env.FLOWS_API_PORT}` } },
  },
});

// Vitest setup for every web test. Component tests (`*.test.tsx`, each with a
// `// @vitest-environment jsdom` docblock) get Testing Library's DOM matchers and a cleanup
// after each test; the node tests (`*.test.ts`) only load the matchers, which touch no DOM.
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';

// Node 25 ships its own global localStorage/sessionStorage (unusable without
// --localstorage-file), which shadows jsdom's. Point the globals back at the jsdom window's.
const dom = (globalThis as { jsdom?: { window: Window } }).jsdom;
if (dom) {
  for (const key of ['localStorage', 'sessionStorage'] as const) {
    Object.defineProperty(globalThis, key, {
      configurable: true,
      get: () => dom.window[key],
    });
  }
}

afterEach(async () => {
  if (typeof document === 'undefined') return;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
});

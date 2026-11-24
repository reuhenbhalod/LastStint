// Control coverage for the browser tests (docs/test-suite-spec.md S1, D7). Every spec imports
// `test` and `expect` from here instead of '@playwright/test'. An automatic fixture records, per
// test, each interactive control that appeared on screen and each one the test pressed, typed
// into or changed, keyed by where it was (the route), its role and its accessible name, the same
// way `getByRole(role, { name })` finds it. scripts/coverage-report.ts merges the records into
// the coverage report. Recording is on with E2E_COVERAGE=1 and costs nothing otherwise.

import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test as base, expect } from '@playwright/test';

export { expect };

export interface ControlEvent {
  /** 'seen': on screen; 'used': pressed, typed into or changed. */
  kind: 'seen' | 'used';
  route: string;
  role: string;
  /** The accessible name, numbers as '#' (laps, seconds and counts change from run to run). */
  name: string;
  /** No accessible name (D7: every control needs one). */
  unnamed?: boolean;
}

export const COVERAGE_DIR = fileURLToPath(
  new URL('../test-results/control-coverage/', import.meta.url),
);

// Runs in the page: the role and accessible name of each control, and the listeners.
function install() {
  const w = window as unknown as {
    __covReport?: (e: unknown) => void;
    __covSeen?: Set<string>;
  };
  if (w.__covSeen) return;
  w.__covSeen = new Set();
  const SELECTOR =
    'button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [role=link], [role=tab], [role=switch], [role=checkbox], [role=radio], [role=slider], [role=menuitem], [role=option], [contenteditable=true]';
  const roleOf = (el: Element): string => {
    const r = el.getAttribute('role');
    if (r) return r;
    const tag = el.tagName.toLowerCase();
    if (tag === 'a') return 'link';
    if (tag === 'select') return 'combobox';
    if (tag === 'textarea') return 'textbox';
    if (tag === 'summary') return 'button';
    if (tag === 'input') {
      const t = (el.getAttribute('type') ?? 'text').toLowerCase();
      if (t === 'checkbox' || t === 'radio') return t;
      if (t === 'range') return 'slider';
      if (t === 'button' || t === 'submit' || t === 'reset') return 'button';
      return 'textbox';
    }
    return tag;
  };
  const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const nameOf = (el: Element): string => {
    const label = el.getAttribute('aria-label');
    if (label?.trim()) return label;
    const by = el.getAttribute('aria-labelledby');
    if (by)
      return by
        .split(/\s+/)
        .map((id) => text(document.getElementById(id)))
        .join(' ');
    if (
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement
    ) {
      const l = el.labels?.[0];
      if (l) return text(l);
      if (el instanceof HTMLInputElement && ['button', 'submit', 'reset'].includes(el.type))
        return el.value;
      const ph = el.getAttribute('placeholder');
      if (ph) return ph;
    }
    const own = text(el);
    if (own) return own;
    const alt = el.querySelector('img[alt], svg[aria-label]');
    return (
      alt?.getAttribute('alt') ?? alt?.getAttribute('aria-label') ?? el.getAttribute('title') ?? ''
    );
  };
  const routeOf = () =>
    location.pathname
      .replace(/\/[A-Z]{4}(?=\/|$)/g, '/:code')
      .replace(/\/[a-z-]+-\d{4}(?=\/|$)/g, '/:race')
      .replace(/\/\d+(?=\/|$)/g, '/:n') || '/';
  const visible = (el: Element) => {
    const r = (el as HTMLElement).getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none';
  };
  // A control in a long list of its like (a timing tower's rows, a leaderboard, a table's rows)
  // is one control, "a row of <the list>": pressing any row covers it.
  const LIST =
    'ul, ol, table, [role=list], [role=listbox], [role=grid], [role=table], [role=tablist], [role=radiogroup]';
  let counts = new Map<Element, Map<string, number>>(); // per scan: list -> role -> controls
  const listOf = (el: Element): Element | null => {
    const list = el.parentElement?.closest(LIST);
    if (!list) return null;
    let byRole = counts.get(list);
    if (!byRole) {
      byRole = new Map();
      for (const x of list.querySelectorAll(SELECTOR))
        byRole.set(roleOf(x), (byRole.get(roleOf(x)) ?? 0) + 1);
      counts.set(list, byRole);
    }
    return (byRole.get(roleOf(el)) ?? 0) >= 6 ? list : null;
  };
  const listName = (list: Element) => {
    const labelled = list.closest('[aria-label], [aria-labelledby]');
    const by = labelled?.getAttribute('aria-labelledby');
    return (
      labelled?.getAttribute('aria-label') ??
      (by ? text(document.getElementById(by)) : '') ??
      list.tagName.toLowerCase()
    );
  };
  const report = (kind: 'seen' | 'used', el: Element) => {
    const list = listOf(el);
    const raw = list ? `(a row of: ${listName(list) || list.tagName.toLowerCase()})` : nameOf(el);
    const name = raw
      .replace(/\d+([.,]\d+)?/g, '#')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);
    const e = {
      kind,
      route: routeOf(),
      role: roleOf(el),
      name,
      ...(name ? {} : { unnamed: true }),
    };
    const key = `${e.kind}|${e.route}|${e.role}|${e.name}`;
    if (w.__covSeen?.has(key)) return;
    w.__covSeen?.add(key);
    w.__covReport?.(e);
  };
  let timer = 0;
  const scan = () => {
    timer = 0;
    counts = new Map();
    for (const el of document.querySelectorAll(SELECTOR)) if (visible(el)) report('seen', el);
  };
  const soon = () => {
    if (!timer) timer = window.setTimeout(scan, 250);
  };
  const used = (ev: Event) => {
    const el = (ev.target as Element | null)?.closest?.(SELECTOR);
    if (el) {
      counts = new Map();
      report('seen', el);
      report('used', el);
    }
  };
  const start = () => {
    new MutationObserver(soon).observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'disabled', 'aria-hidden'],
    });
    for (const t of ['click', 'input', 'change', 'keydown'])
      document.addEventListener(t, used, true);
    soon();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
}

// biome-ignore lint/suspicious/noConfusingVoidType: Playwright's type for a fixture with no value
export const test = base.extend<{ controlCoverage: void }>({
  controlCoverage: [
    async ({ context }, use, info) => {
      if (process.env.E2E_COVERAGE !== '1') return use();
      const events: ControlEvent[] = [];
      await context.exposeBinding('__covReport', (_src, e: ControlEvent) => {
        events.push(e);
      });
      await context.addInitScript(install);
      await use();
      if (!events.length) return;
      mkdirSync(COVERAGE_DIR, { recursive: true });
      const spec = info.titlePath[0] ?? info.file;
      const line = (e: ControlEvent) =>
        JSON.stringify({ ...e, spec, test: info.title, project: info.project.name });
      appendFileSync(
        join(COVERAGE_DIR, `${info.project.name}-${process.pid}.jsonl`),
        `${events.map(line).join('\n')}\n`,
      );
    },
    { auto: true },
  ],
});

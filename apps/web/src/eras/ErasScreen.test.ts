import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EraMap, Eras } from './ErasScreen.js';
import { erasRoute } from './catalog.js';
import { type EraMapState, eraNodes } from './eraMapState.js';
import { erasResponse } from './erasFixture.js';

function render(path: string): string {
  const route = erasRoute(path);
  if (!route) throw new Error(`${path} is not an Eras path`);
  return renderToStaticMarkup(createElement(Eras, { route }));
}

describe('Eras screens', () => {
  it('starts the map loading', () => {
    const html = render('/eras');
    expect(html).toContain('>Eras</h1>');
    expect(html).toContain('<output');
    expect(html).toContain('Loading the eras');
    expect(html).not.toContain('href="/eras/');
  });

  it("shows an era's name on its detail", () => {
    const html = render('/eras/2');
    expect(html).toContain('Senna vs Prost</h1>');
    expect(html).toContain('1989–1993');
    expect(html).toContain('href="/eras"');
  });

  it('says so for an era that does not exist', () => {
    expect(render('/eras/99')).toContain('No such era');
  });
});

function renderMap(state: EraMapState): string {
  return renderToStaticMarkup(createElement(EraMap, { initial: state }));
}

const ready = (res: ReturnType<typeof erasResponse>): EraMapState => ({
  kind: 'ready',
  testMode: res.testMode,
  nodes: eraNodes(res),
});

/** The era ids the map links to, in page order. */
const links = (html: string) =>
  [...html.matchAll(/href="\/eras\/(\d+)"/g)].map((m) => Number(m[1]));

describe('Era map', () => {
  it('shows every era in play order, 2025 back to 1983, with its stars', () => {
    const html = renderMap(ready(erasResponse(true, { 10: { stars: 24 } })));
    const order = [...html.matchAll(/>Era (\d+)</g)].map((m) => Number(m[1]));
    expect(order).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect(html.indexOf('2022–2025')).toBeLessThan(html.indexOf('1983–1988'));
    expect(html).toContain('24/30<span class="sr-only"> stars</span>');
    expect(html).toContain('Ground-effect era');
  });

  it('in production links only open eras and says what unlocks a locked one', () => {
    const at20 = renderMap(ready(erasResponse(false, { 10: { stars: 20 } })));
    expect(links(at20)).toEqual([10]);
    expect(at20).toContain('21 stars in Era 10 to unlock (1 to go)');
    expect(at20).not.toContain('Test mode');
    expect(at20).not.toContain('open on test');
    expect(at20).toContain('aria-disabled="true"');

    const at21 = renderMap(ready(erasResponse(false, { 10: { stars: 21 } })));
    expect(links(at21)).toEqual([10, 9]);
    expect(at21).toContain('21 stars in Era 9 to unlock (21 to go)');
  });

  it('shows unreleased eras as Coming soon in production, without a link', () => {
    const html = renderMap(
      ready(erasResponse(false, { 10: { stars: 30 }, 9: { released: false } })),
    );
    expect(links(html)).toEqual([10]);
    expect(html).toContain('Coming soon');
  });

  it('on test links every era and still shows the locks', () => {
    const html = renderMap(
      ready(erasResponse(true, { 10: { stars: 20 }, 9: { released: false } })),
    );
    expect(links(html)).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect(html).toContain('Test mode');
    expect(html).not.toContain('Coming soon');
    expect(html.match(/Locked · open on test/g)).toHaveLength(9);
    expect(html.match(/ Unlocked</g)).toHaveLength(1);
  });

  it('shows a load error with a way to try again', () => {
    const html = renderMap({ kind: 'error', message: 'Couldn’t load the eras (offline).' });
    expect(html).toContain('role="alert"');
    expect(html).toContain('Couldn’t load the eras (offline).');
    expect(html).toContain('Try again</button>');
    expect(links(html)).toEqual([]);
  });
});

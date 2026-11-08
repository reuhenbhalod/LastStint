import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RaceStartError } from './EraRace.js';
import { EraDetailScreen, EraMap, Eras } from './ErasScreen.js';
import { type EraInfo, eraById, eraRace, erasRoute } from './catalog.js';
import { type EraDetailState, eraDetailView } from './eraDetailState.js';
import { type EraMapState, eraNodes } from './eraMapState.js';
import { eraDetail, erasResponse, starredRaces } from './erasFixture.js';
import { mockCanStart } from './mockErasApi.js';

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
    expect(html).not.toMatch(/href="\/eras\/\d/);
    expect(html).toContain('href="/eras/history"');
  });

  it("starts an era's detail loading, under its name", () => {
    const html = render('/eras/2');
    expect(html).toContain('Senna vs Prost</h1>');
    expect(html).toContain('1989–1993');
    expect(html).toContain('href="/eras"');
    expect(html).toContain('Loading the era…');
  });

  it('starts a race attempt on a race path', () => {
    expect(render('/eras/9/abu-dhabi-2021')).toContain('Starting Abu Dhabi 2021…');
    expect(render('/eras/9/abu-dhabi-2021/legend')).toContain(
      'Starting Abu Dhabi 2021 at Legend difficulty…',
    );
  });

  it('says so for an era or race that does not exist', () => {
    expect(render('/eras/99')).toContain('No such era');
    expect(render('/eras/9/monaco-2022')).toContain('No such era');
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

const ERA9 = eraById(9) as EraInfo;
const ERA10 = eraById(10) as EraInfo;

function renderDetail(era: EraInfo, state: EraDetailState, initialLegend = false): string {
  return renderToStaticMarkup(
    createElement(EraDetailScreen, { era, initial: state, initialLegend }),
  );
}

const detailReady = (
  res: ReturnType<typeof erasResponse>,
  detail: ReturnType<typeof eraDetail>,
  canStart: (raceId: string) => boolean = () => true,
): EraDetailState => ({ kind: 'ready', view: eraDetailView(res, detail, canStart) });

/** The race paths the detail links to, in page order. */
const raceLinks = (html: string) =>
  [...html.matchAll(/href="(\/eras\/\d+\/[^"]+)"/g)]
    .map((m) => m[1])
    .filter((l) => !l?.includes('/leaderboard'));

/** The leaderboard paths the detail links to, in page order. */
const boardLinks = (html: string) =>
  [...html.matchAll(/href="(\/eras\/\d+\/[^"]+\/leaderboard[^"]*)"/g)].map((m) => m[1]);

describe('Era detail', () => {
  it('shows a loading state, and an error with a way to try again', () => {
    const loading = renderDetail(ERA9, { kind: 'loading' });
    expect(loading).toContain('<output');
    expect(loading).toContain('Loading the era…');
    const error = renderDetail(ERA9, {
      kind: 'error',
      message: 'Couldn’t load this era (offline).',
    });
    expect(error).toContain('role="alert"');
    expect(error).toContain('Couldn’t load this era (offline).');
    expect(error).toContain('Try again</button>');
    expect(raceLinks(error)).toEqual([]);
  });

  it('shows the briefing slot, then ten race cards in order with their dilemmas', () => {
    const html = renderDetail(ERA9, detailReady(erasResponse(true), eraDetail(9)));
    expect(html).toContain('data-todo="era-briefing"');
    expect(html).toContain('Briefing not written yet.');
    expect(html.indexOf('Briefing')).toBeLessThan(html.indexOf('Race 1<'));
    const races = [...html.matchAll(/>Race (\d+)</g)].map((m) => Number(m[1]));
    expect(races).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(html.indexOf('Bahrain 2021')).toBeLessThan(html.indexOf('Abu Dhabi 2021'));
    expect(html).toContain('Track limits and the undercut');
    expect(html).toContain('Mercedes&#x27; extra stop catches Verstappen');
    expect(raceLinks(html)).toHaveLength(10);
    expect(raceLinks(html)[9]).toBe('/eras/9/abu-dhabi-2021');
  });

  it('spells out each star, earned or not, and the best accuracy', () => {
    const detail = eraDetail(9, {
      races: {
        10: {
          stars: { result: true, strategist: true, mastery: false },
          bestAccuracy: 91.24,
        },
      },
    });
    const html = renderDetail(ERA9, detailReady(erasResponse(true), detail));
    // Read out as "Star 1, Result: earned"; the ★1 glyph is hidden from screen readers.
    const earned = (n: number, name: string) =>
      `<span class="sr-only">Star ${n}, </span><span aria-hidden="true">★${n}</span><span class="text-[var(--ink)]">${name}</span><span class="sr-only">: earned</span>`;
    expect(html).toContain(earned(1, 'Result'));
    expect(html).toContain(earned(2, 'Strategist'));
    expect(html).toContain(
      '<span class="">Mastery</span><span class="sr-only">: not earned</span>',
    );
    expect(html.match(/: not earned/g)).toHaveLength(28);
    expect(html.match(/: earned/g)).toHaveLength(2);
    expect(html).toContain('91.2%');
    expect(html.match(/not played yet/g)).toHaveLength(9);
    expect(html).toContain('2/30<span class="sr-only"> stars</span>');
  });

  it('shows the Reconstructed and Draft badges where they apply', () => {
    const detail = eraDetail(1, {
      draft: true,
      races: { 1: { reconstructed: true }, 2: { reconstructed: true } },
    });
    const html = renderDetail(eraById(1) as EraInfo, detailReady(erasResponse(true), detail));
    expect(html.match(/>Reconstructed</g)).toHaveLength(2);
    expect(html.match(/>Draft</g)).toHaveLength(10);
    const none = renderDetail(ERA10, detailReady(erasResponse(true), eraDetail(10)));
    expect(none).not.toContain('>Reconstructed<');
    expect(none).not.toContain('>Draft<');
  });

  it('offers Legend only once the era is Cleared, with its progress shown apart', () => {
    const at9 = renderDetail(
      ERA10,
      detailReady(erasResponse(true), eraDetail(10, { races: starredRaces(9) })),
    );
    expect(at9).not.toContain('aria-pressed');
    expect(at9).toContain('Unlocks once the era is Cleared: a star on every race (9 of 10');
    expect(raceLinks(at9).some((l) => l?.endsWith('/legend'))).toBe(false);

    const cleared = eraDetail(10, {
      races: {
        ...starredRaces(10),
        1: {
          stars: { result: true, strategist: false, mastery: false },
          legend: { stars: { result: true, strategist: false, mastery: false }, bestAccuracy: 64 },
        },
      },
    });
    const off = renderDetail(ERA10, detailReady(erasResponse(true), cleared));
    expect(off).toContain('aria-pressed="false"');
    expect(off).toContain('Legend off</button>');
    expect(off).toContain('1/30<span class="sr-only"> Legend stars</span>');
    expect(off).toContain('10/30<span class="sr-only"> stars</span>');
    expect(raceLinks(off)[0]).toBe('/eras/10/monaco-2022');

    const on = renderDetail(ERA10, detailReady(erasResponse(true), cleared), true);
    expect(on).toContain('aria-pressed="true"');
    expect(on).toContain('Races · Legend difficulty');
    expect(raceLinks(on)).toHaveLength(10);
    expect(raceLinks(on).every((l) => l?.endsWith('/legend'))).toBe(true);
    // The cards show Legend's stars: one earned on race 1, none elsewhere.
    expect(on.match(/: earned/g)).toHaveLength(1);
    expect(on).toContain('64%');
  });

  it('links each race card to its leaderboard, Legend’s with Legend on, even when not playable', () => {
    const html = renderDetail(ERA9, detailReady(erasResponse(false), eraDetail(9)));
    expect(boardLinks(html)).toHaveLength(10);
    expect(boardLinks(html)[9]).toBe('/eras/9/abu-dhabi-2021/leaderboard');
    expect(html).toContain('Leaderboard<span class="sr-only"> for Abu Dhabi 2021</span>');
    // Over the card's covering link, so it can be reached and tapped on its own.
    expect(html).toMatch(/class="relative z-10[^"]*">Leaderboard/);

    const cleared = eraDetail(10, { races: starredRaces(10) });
    const on = renderDetail(ERA10, detailReady(erasResponse(true), cleared), true);
    expect(boardLinks(on)).toHaveLength(10);
    expect(boardLinks(on).every((l) => l?.endsWith('/leaderboard/legend'))).toBe(true);
    expect(on).toContain('Legend leaderboard<span class="sr-only"> for Monaco 2022</span>');
  });

  it('ignores Legend on for an era that is not Cleared', () => {
    const html = renderDetail(ERA10, detailReady(erasResponse(true), eraDetail(10)), true);
    expect(raceLinks(html).some((l) => l?.endsWith('/legend'))).toBe(false);
    expect(html).not.toContain('Races · Legend difficulty');
  });

  it('links only races an attempt can start on, saying why the others cannot', () => {
    // Era 10: it has a race with no race file yet (belgium-2023 isn't built yet).
    const html = renderDetail(ERA10, detailReady(erasResponse(true), eraDetail(10), mockCanStart));
    const playable = eraDetail(10)
      .races.map((r) => r.raceId)
      .filter(mockCanStart);
    expect(playable.length).toBeLessThan(10);
    expect(raceLinks(html)).toEqual(playable.map((id) => `/eras/10/${id}`));
    expect(html.match(/no race file in this build/g)).toHaveLength(10 - playable.length);
    expect(html.match(/aria-disabled="true"/g)).toHaveLength(10 - playable.length);
  });

  it('on test plays a locked era, with the lock shown', () => {
    const html = renderDetail(ERA9, detailReady(erasResponse(true), eraDetail(9)));
    expect(html).toContain('Test mode');
    expect(html).toContain('Locked · open on test');
    expect(html).toContain('21 stars in Era 10 to unlock (21 to go)');
    expect(raceLinks(html)).toHaveLength(10);
  });

  it('in production shows a locked era without letting it be played', () => {
    const html = renderDetail(
      ERA9,
      detailReady(erasResponse(false, { 10: { stars: 20 } }), eraDetail(9)),
    );
    expect(html).not.toContain('Test mode');
    expect(html).toContain('21 stars in Era 10 to unlock (1 to go)');
    expect(html).toContain('not play them until it unlocks');
    expect(raceLinks(html)).toEqual([]);
    expect(html.match(/Unlock this era to play its races/g)).toHaveLength(10);
  });

  it('in production shows an unreleased era as Coming soon, with no races', () => {
    const html = renderDetail(
      ERA9,
      detailReady(
        erasResponse(false, { 10: { stars: 30 }, 9: { released: false } }),
        eraDetail(9, { released: false }),
      ),
    );
    expect(html).toContain('Coming soon');
    expect(html).not.toContain('>Race 1<');
    expect(raceLinks(html)).toEqual([]);
  });

  it('in production does not link Draft races', () => {
    const html = renderDetail(
      ERA10,
      detailReady(erasResponse(false), eraDetail(10, { races: { 4: { draft: true } } })),
    );
    expect(raceLinks(html)).toHaveLength(9);
    expect(html).toContain('Not published yet.');
  });
});

describe('Era race', () => {
  it('says clearly when a race cannot be started, with a way back', () => {
    const race = eraRace('monaco-2022');
    if (!race) throw new Error('no race');
    const html = renderToStaticMarkup(
      createElement(RaceStartError, {
        era: ERA10,
        race,
        message: 'no race file for monaco-2022 in this build yet',
        onRetry: () => {},
      }),
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('Couldn’t start Monaco 2022.');
    expect(html).toContain('no race file for monaco-2022 in this build yet');
    expect(html).toContain('href="/eras/10"');
    expect(html).toContain('Back to Ground-effect era');
  });
});

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Eras, RaceLeaderboardScreen } from './ErasScreen.js';
import { LeaderboardBody, meLine } from './RaceLeaderboard.js';
import type { EraLeaderboard } from './api.js';
import { eraById, eraRace, erasRoute } from './catalog.js';
import { leaderboard } from './erasFixture.js';
import type { LeaderboardState } from './historyState.js';

const render = (state: LeaderboardState, legend = false) =>
  renderToStaticMarkup(createElement(LeaderboardBody, { state, legend, onRetry: () => {} }));
const ready = (board: EraLeaderboard) => render({ kind: 'ready', board }, board.legend);
const text = (html: string) => html.replace(/<[^>]+>/g, '');
const rows = (html: string) => html.match(/<li[^>]*>/g) ?? [];

describe('a race leaderboard', () => {
  it('has Normal and Legend tabs, the chosen one selected and controlling the board', () => {
    const normal = render({ kind: 'loading' }, false);
    expect(normal).toContain('role="tablist"');
    expect(normal).toMatch(/id="board-tab-normal"[^>]*role="tab" aria-selected="true"/);
    expect(normal).toMatch(/id="board-tab-legend"[^>]*role="tab" aria-selected="false"/);
    expect(normal).toContain('role="tabpanel" id="board-panel" aria-labelledby="board-tab-normal"');
    const legend = render({ kind: 'loading' }, true);
    expect(legend).toMatch(/id="board-tab-legend"[^>]*aria-selected="true"[^>]*tabindex="0"/);
    expect(legend).toMatch(/id="board-tab-normal"[^>]*aria-selected="false"[^>]*tabindex="-1"/);
    expect(legend).toContain('aria-labelledby="board-tab-legend"');
  });

  it('shows the top 100 of a bigger board, by best accuracy', () => {
    const html = ready(leaderboard(340, null));
    expect(rows(html)).toHaveLength(100);
    const t = text(html);
    expect(t).toContain('1Strategist 199.8%');
    expect(t).toContain('100Strategist 10080%');
    expect(t).not.toContain('Strategist 101');
    expect(t).toContain('Top 100 by best accuracy');
    expect(t).toContain('340 strategists on this board.');
  });

  it('marks the player’s row in the top 100 as You, in text and highlight', () => {
    const html = ready(leaderboard(340, 12));
    expect(html.match(/data-me="true"/g)).toHaveLength(1);
    const mine = html.match(/<li[^>]*data-me="true"[\s\S]*?<\/li>/)?.[0] ?? '';
    expect(text(mine)).toBe('12Strategist 12You97.6%');
    expect(text(html)).toContain('Your rank: 12 of 340, best accuracy 97.6%.');
    // Not repeated below the list.
    expect(html).not.toContain('Your rank, ');
  });

  it('adds the player’s row below the top 100 when they are further down', () => {
    const html = ready(leaderboard(340, 250));
    expect(rows(html)).toHaveLength(100);
    expect(html.match(/data-me="true"/g)).toHaveLength(1);
    const mine = html.match(/<p data-me="true"[\s\S]*?<\/p>/)?.[0] ?? '';
    expect(text(mine)).toBe('250Your rank, You50%');
    expect(text(html)).toContain('Your rank: 250 of 340');
  });

  it('says when the player is not on the board, normal or Legend', () => {
    const board = leaderboard(3, null);
    expect(text(ready(board))).toContain('You’re not on this board yet');
    expect(ready(board)).not.toContain('data-me');
    expect(meLine({ ...board, legend: true })).toContain('finish a Legend attempt');
  });

  it('says when the board is empty', () => {
    const html = ready(leaderboard(0, null, { legend: true }));
    expect(text(html)).toContain('No one is on this board yet.');
    expect(text(html)).toContain('0 strategists on this board.');
    expect(rows(html)).toHaveLength(0);
  });

  it('says it is loading, and shows an error with a retry', () => {
    expect(render({ kind: 'loading' })).toContain('Loading the leaderboard…');
    const error = render({ kind: 'error', message: 'Couldn’t load the leaderboard (x).' });
    expect(error).toContain('role="alert"');
    expect(error).toContain('Try again');
  });

  it('is the screen at /eras/<eraId>/<raceId>/leaderboard, Legend’s at …/legend', () => {
    const route = erasRoute('/eras/9/abu-dhabi-2021/leaderboard/legend');
    if (route?.kind !== 'leaderboard') throw new Error('not a leaderboard route');
    const html = renderToStaticMarkup(createElement(Eras, { route }));
    expect(html).toContain('Abu Dhabi 2021');
    expect(html).toContain('Era 9 · Race 10 · Leaderboard');
    expect(html).toContain('href="/eras/9"');
    expect(html).toMatch(/id="board-tab-legend"[^>]*aria-selected="true"/);

    const era = eraById(9);
    const race = eraRace('abu-dhabi-2021');
    if (!era || !race) throw new Error('fixture');
    const given = renderToStaticMarkup(
      createElement(RaceLeaderboardScreen, {
        era,
        race,
        legend: false,
        initial: { kind: 'ready', board: leaderboard(2, 1) },
      }),
    );
    expect(text(given)).toContain('Your rank: 1 of 2');
  });
});

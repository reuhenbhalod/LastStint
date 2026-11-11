import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NEUTRAL_REWRITE } from './EraResults.js';
import { Eras, HistoryBookScreen } from './ErasScreen.js';
import { HistoryBookBody } from './HistoryBook.js';
import type { HistoryBook } from './api.js';
import { historyBook, historyEntry } from './erasFixture.js';
import type { HistoryState } from './historyState.js';

const render = (state: HistoryState) =>
  renderToStaticMarkup(createElement(HistoryBookBody, { state, onRetry: () => {} }));
const ready = (book: HistoryBook) => render({ kind: 'ready', book });
/** The markup of one era's card. */
const eraCard = (html: string, eraId: number) =>
  html.match(new RegExp(`<article[^>]*data-era="${eraId}"[\\s\\S]*?</article>`))?.[0] ?? '';
const text = (html: string) => html.replace(/<[^>]+>/g, '');

describe('the history book', () => {
  it('shows nothing collected for a new player, with the full campaign’s 830', () => {
    const html = ready(historyBook());
    expect(html).toContain('data-testid="completion">0%<');
    expect(text(html)).toContain('0 of 830 collected');
    expect(text(html)).toContain('Stars0/300');
    expect(text(html)).toContain('Legend stars0/300');
    expect(text(html)).toContain('Rewrites0/100');
    expect(text(html)).toContain('Hidden objectives0/100');
    expect(text(html)).toContain('Era badges0/30');
    expect(html).toContain('Nothing collected yet.');
    expect(html).toContain('No rewrites yet.');
  });

  it('shows the server’s counts, overall and per era', () => {
    const book = historyBook({
      eras: {
        10: {
          stars: { have: 30, total: 30 },
          legendStars: { have: 4, total: 30 },
          rewrites: { have: 3, total: 10 },
          hidden: { have: 2, total: 10 },
          badges: { cleared: true, mastered: true, legend: false },
        },
        9: { stars: { have: 12, total: 30 } },
      },
    });
    const html = ready(book);
    // 30 + 4 + 3 + 2 + 2 badges in Era 10, 12 stars in Era 9: 53 of 830, 6.4%.
    expect(book.completion.collected).toBe(53);
    expect(text(html)).toContain('53 of 830 collected');
    expect(html).toContain('data-testid="completion">6%<');
    expect(text(html)).toContain('Stars42/300');
    expect(text(html)).toContain('Era badges2/30');
    const era10 = text(eraCard(html, 10));
    expect(era10).toContain('Era 10 · 2022–2025');
    expect(era10).toContain('Ground-effect era');
    expect(era10).toContain('Stars30/30');
    expect(era10).toContain('Legend stars4/30');
    expect(era10).toContain('Rewrites3/10');
    expect(era10).toContain('Hidden2/10');
    // 41 of 83 collectibles in the era.
    expect(era10).toContain('49%');
    expect(text(eraCard(html, 9))).toContain('Stars12/30');
    expect(eraCard(html, 9)).toContain('href="/eras/9"');
  });

  it('lists the eras in play order, Era 10 first', () => {
    const book = historyBook();
    book.eras.reverse();
    const order = [...ready(book).matchAll(/data-era="(\d+)"/g)].map((m) => Number(m[1]));
    expect(order).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
  });

  it('shows each badge as earned or not in words and shape, not colour alone', () => {
    const html = ready(
      historyBook({ eras: { 10: { badges: { cleared: true, mastered: false, legend: false } } } }),
    );
    const era10 = eraCard(html, 10);
    expect(era10).toContain('data-badge="cleared" data-earned="true"');
    expect(era10).toContain('data-badge="mastered" data-earned="false"');
    expect(text(era10)).toContain('Cleared: earned (a star on every race)');
    expect(text(era10)).toContain('Mastered: not earned (every star)');
    expect(text(era10)).toContain('Legend: not earned (every Legend star)');
    // A tick for the earned badge, an open ring for the others.
    expect(era10.match(/<path d="M4 12.5l5 5L20 6.5"/g)).toHaveLength(1);
    expect(era10.match(/<circle cx="12" cy="12" r="8"/g)).toHaveLength(2);
    expect(era10).toMatch(/border-dashed[^"]*"[^>]*>[\s\S]*?Mastered/);
  });

  it('never rounds to 0% with something collected, nor to 100% short of everything', () => {
    const one = historyBook({ eras: { 10: { stars: { have: 1, total: 30 } } } });
    expect(ready(one)).toContain('data-testid="completion">1%<');
    const full = {
      stars: { have: 30, total: 30 },
      legendStars: { have: 30, total: 30 },
      rewrites: { have: 10, total: 10 },
      hidden: { have: 10, total: 10 },
      badges: { cleared: true, mastered: true, legend: true },
    };
    const almost = historyBook({
      eras: Object.fromEntries(
        [10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((id) => [
          id,
          id === 1 ? { ...full, hidden: { have: 9, total: 10 } } : full,
        ]),
      ),
    });
    expect(almost.completion.collected).toBe(829);
    const html = ready(almost);
    expect(html).toContain('data-testid="completion">99%<');
    expect(text(eraCard(html, 1))).toContain('99%');
    expect(text(eraCard(html, 2))).toContain('100%');
  });

  it('shows each rewrite: the race, its headline, what really happened and the community', () => {
    const html = ready(
      historyBook({
        entries: [
          historyEntry({
            headline: 'An authored headline',
            real: 'What the race file says happened',
          }),
          historyEntry({
            raceId: 'emilia-romagna-2024',
            eraId: 10,
            position: 6,
            achievedAt: '2026-11-08T09:00:00.000Z',
            legend: true,
            accuracy: 77.25,
            stars: { result: true, strategist: false, mastery: false },
            community: { players: 40, rewrites: 30, share: 0.75 },
          }),
        ],
      }),
    );
    const t = text(html);
    expect(t).toContain('Abu Dhabi 2021');
    expect(t).toContain('An authored headline');
    expect(t).toContain('What really happened: What the race file says happened');
    expect(t).toContain('Only 9% of strategists rewrote this race.');
    expect(t).toContain('7 Nov 2026');
    expect(t).toContain('91.2%');
    // No headline authored: the neutral line, and no "really happened" made up.
    expect(t).toContain('Emilia Romagna 2024');
    expect(t).toContain(NEUTRAL_REWRITE);
    expect(t).toContain('75% of strategists rewrote this race.');
    expect(t).not.toContain('Only 75%');
    expect(t).toContain('77.3%');
    expect(t.match(/What really happened/g)).toHaveLength(1);
    // Newest first, Legend marked, stars read out, each linking to its board.
    expect(t.indexOf('Emilia Romagna 2024')).toBeLessThan(t.indexOf('Abu Dhabi 2021'));
    expect(t).toContain('Era 10 · Race 6Legend');
    expect(t).toContain('Star 1, Result: earned.');
    expect(t).toContain('Star 2, Strategist: not earned.');
    expect(html).toContain('href="/eras/10/emilia-romagna-2024/leaderboard/legend"');
    expect(html).toContain('href="/eras/9/abu-dhabi-2021/leaderboard"');
    expect(html).not.toContain('No rewrites yet.');
  });

  it('shows no community line when there is no community', () => {
    const html = ready(
      historyBook({
        entries: [historyEntry({ community: { players: 0, rewrites: 0, share: 0 } })],
      }),
    );
    expect(html).not.toContain('strategists rewrote');
  });

  it('says it is loading, and shows an error with a retry', () => {
    expect(render({ kind: 'loading' })).toContain('Loading your history book…');
    const error = render({ kind: 'error', message: 'Couldn’t load your history book (x).' });
    expect(error).toContain('role="alert"');
    expect(error).toContain('Couldn’t load your history book (x).');
    expect(error).toContain('Try again');
  });

  it('is the screen at /eras/history, linked back to the map', () => {
    const html = renderToStaticMarkup(createElement(Eras, { route: { kind: 'history' } }));
    expect(html).toContain('History book');
    expect(html).toContain('href="/eras"');
    expect(html).toContain('Loading your history book…');
    const given = renderToStaticMarkup(
      createElement(HistoryBookScreen, { initial: { kind: 'ready', book: historyBook() } }),
    );
    expect(given).toContain('0 of 830 collected');
  });
});

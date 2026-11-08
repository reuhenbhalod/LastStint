import type { RaceModel } from '@laststint/sim';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it } from 'vitest';
import { StaticDailyProvider } from '../data/provider.js';
import type { Daily } from '../data/types.js';
import type { Game } from '../game/useGame.js';
import { ResultScreen } from '../screens/ResultScreen.js';
import type { GameState, Submission } from '../state/machine.js';
import { GameSession } from '../state/session.js';
import {
  EraResultActions,
  EraResultsPanel,
  type ErasResultInfo,
  NEUTRAL_REWRITE,
  communityLine,
  erasShareLine,
  raceHasRewrite,
  rewriteHeadline,
} from './EraResults.js';
import type { RaceStats } from './api.js';
import { eraById, eraRace } from './catalog.js';
import { attemptResult } from './erasFixture.js';

const ERA = eraById(9);
if (!ERA) throw new Error('Era 9');
const RACE = eraRace('abu-dhabi-2021');
if (!RACE) throw new Error('abu-dhabi-2021');

const ALL = { result: true, strategist: true, mastery: true };

/** The Worker's stats (erasHistory.ts) with a rewrite share; star rates are not read here. */
function stats(share: number, players = 100): RaceStats {
  const rates = { players, result: 0, strategist: 0, mastery: 0, hidden: 0 };
  return {
    raceId: 'abu-dhabi-2021',
    rewrite: { players, rewrites: Math.round(share * players), share },
    stars: rates,
    legendStars: rates,
  };
}

function info(edit: Partial<ErasResultInfo> = {}): ErasResultInfo {
  return {
    era: ERA as NonNullable<typeof ERA>,
    race: RACE as NonNullable<typeof RACE>,
    legend: false,
    difficulty: {
      accuracyThreshold: 72,
      information: 'full',
      rivalPolicy: 'standard',
      decisionTimerSeconds: 45,
    },
    stats: null,
    onNewAttempt: () => {},
    ...edit,
  };
}

let base: RaceModel;
/** Abu Dhabi 2021 with an Eras block: a storyline with its headline, and a hidden objective. */
let model: RaceModel;

beforeAll(async () => {
  base = (await new StaticDailyProvider().today()).model;
  model = {
    ...base,
    eras: {
      eraId: 9,
      order: 10,
      target: { type: 'finish_ahead_of_rival' } as never,
      storyline: {
        real: 'The rival wins the race and the title',
        rewriteCondition: { type: 'finish_ahead_of_rival' } as never,
        headline: 'An authored headline for the rewrite',
      },
      mastery: { type: 'no_neutralized_stop', label: 'No stop under the safety car' },
      hidden: { type: 'margin', seconds: 3, label: 'Win by more than 3 seconds' },
    },
  };
});

const panel = (sub: Submission, edit: Partial<ErasResultInfo> = {}, m: RaceModel | null = model) =>
  renderToStaticMarkup(
    createElement(EraResultsPanel, { sub, model: m, info: info(edit), onRetry: () => {} }),
  );
const done = (edit: Parameters<typeof attemptResult>[0] = {}): Submission => ({
  status: 'eras-done',
  result: attemptResult(edit),
});

describe('the Eras results panel', () => {
  it('shows the stars earned, with the new one marked and animated', () => {
    const html = panel(done());
    expect(html).toContain('Star 1: earned');
    expect(html).toContain('Star 2: earned, new');
    expect(html).toContain('Star 3: not earned');
    expect(html.match(/star-new/g)).toHaveLength(1);
    expect(html.match(/New star/g)).toHaveLength(1);
    expect(html).toMatch(/data-star="strategist" class="[^"]*star-new/);
  });

  it('marks nothing new for stars the race already had', () => {
    const html = panel(done({ newStars: { result: false, strategist: false, mastery: false } }));
    expect(html).not.toContain('star-new');
    expect(html).not.toContain('New star');
  });

  it('shows the accuracy against the era’s threshold, and the rank', () => {
    expect(panel(done())).toContain('82.4%');
    expect(panel(done())).toContain('★2 needs 72: reached');
    expect(panel(done({ accuracy: 70.5 }), { difficulty: { ...info().difficulty } })).toContain(
      '★2 needs 72: 1.5% short',
    );
    expect(panel(done())).toContain('3/41');
  });

  it('shows the authored rewrite headline only when the rewrite condition is met', () => {
    expect(panel(done({ rewrite: true }))).toContain('An authored headline for the rewrite');
    expect(panel(done({ rewrite: true, historyEntry: true }))).toContain(
      'Added to your history book.',
    );
    expect(panel(done({ rewrite: false }))).not.toContain('History rewritten');
    expect(panel(done({ rewrite: null }))).not.toContain('History rewritten');
  });

  it('falls back to a neutral line without an authored headline (never invented copy)', () => {
    const plain = { ...model, eras: { eraId: 9, order: 10 } } as RaceModel;
    expect(rewriteHeadline(plain)).toBe(NEUTRAL_REWRITE);
    expect(rewriteHeadline(null)).toBe(NEUTRAL_REWRITE);
    expect(panel(done({ rewrite: true }), {}, plain)).toContain(NEUTRAL_REWRITE);
  });

  it('shows the community stat when the API sends it, and nothing otherwise', () => {
    expect(communityLine(stats(0.09))).toBe('Only 9% of strategists rewrote this race.');
    expect(communityLine(stats(0.6))).toBe('60% of strategists rewrote this race.');
    expect(communityLine({} as RaceStats)).toBeNull();
    expect(communityLine(null)).toBeNull();
    expect(communityLine(stats(7))).toBeNull();
    expect(communityLine(stats(0, 0))).toBeNull(); // no players yet
    expect(panel(done(), { stats: stats(0.09) })).toContain('Only 9% of strategists');
    expect(panel(done(), { stats: null })).not.toContain('strategists rewrote');
  });

  it('a race the Eras side really won (no rewrite condition) shows no rewrite stat', () => {
    const won = {
      ...model,
      eras: { eraId: 9, order: 10, storyline: { real: 'Verstappen wins' } },
    } as RaceModel;
    expect(raceHasRewrite(won)).toBe(false);
    expect(raceHasRewrite(model)).toBe(true);
    expect(raceHasRewrite(null)).toBe(true);
    expect(panel(done({ rewrite: null }), { stats: stats(0.09) }, won)).not.toContain(
      'strategists rewrote',
    );
  });

  it('reveals the hidden objective once the race has all three stars', () => {
    expect(panel(done())).not.toContain('Win by more than 3 seconds');
    const three = (hidden: boolean | null, hiddenDone = false) =>
      panel(
        done({
          stars: ALL,
          hidden,
          progress: { stars: ALL, hiddenDone, bestAccuracy: 90 },
        }),
      );
    expect(three(false)).toContain('Hidden objective');
    expect(three(false)).toContain('Win by more than 3 seconds');
    expect(three(false)).toContain('A new challenge');
    expect(three(true, true)).toContain('Done on this attempt');
    expect(three(false, true)).toContain('Done.');
    // Three stars over several attempts count too.
    expect(
      panel(
        done({
          stars: { ...ALL, mastery: false },
          progress: { stars: ALL, hiddenDone: false, bestAccuracy: 90 },
        }),
      ),
    ).toContain('Win by more than 3 seconds');
  });

  it('marks an untimed attempt', () => {
    expect(panel(done({ untimed: true }))).toContain('Untimed');
    expect(panel(done({ untimed: false }))).not.toContain('Untimed');
  });

  it('says why there are no stars, with a retry only when it can help', () => {
    const retry = panel({ status: 'error', error: 'Can’t reach the server.' });
    expect(retry).toContain('No stars yet. Can’t reach the server.');
    expect(retry).toContain('>Retry</button>');
    const final = panel({ status: 'error', error: 'Attempts expire.', retry: false });
    expect(final).toContain('Attempts expire.');
    expect(final).not.toContain('Retry');
    const held = panel({ status: 'eras-held', message: 'Your calls are saved.' });
    expect(held).toContain('Your calls are saved.');
    expect(held).not.toContain('Retry');
  });

  it('offers a new attempt and the way back to the era', () => {
    const html = renderToStaticMarkup(createElement(EraResultActions, { info: info() }));
    expect(html).toContain('>New attempt</button>');
    expect(html).toContain('href="/eras/9"');
    expect(html).toContain('Back to era');
  });

  it("links to the race's leaderboard (Legend's after a Legend attempt) and the history book", () => {
    const html = renderToStaticMarkup(createElement(EraResultActions, { info: info() }));
    expect(html).toContain('href="/eras/9/abu-dhabi-2021/leaderboard"');
    expect(html).toContain('>Leaderboard</a>');
    expect(html).toContain('href="/eras/history"');
    const legend = renderToStaticMarkup(
      createElement(EraResultActions, { info: info({ legend: true }) }),
    );
    expect(legend).toContain('href="/eras/9/abu-dhabi-2021/leaderboard/legend"');
    expect(legend).toContain('>Legend leaderboard</a>');
  });

  it('shares the race, its stars and accuracy, not "practice"', () => {
    expect(erasShareLine('abu-dhabi-2021', false, '🟩🟨', attemptResult())).toBe(
      'LastStint Eras: Abu Dhabi 2021 ★★☆ 82% 🟩🟨',
    );
    expect(erasShareLine('abu-dhabi-2021', true, '🟩', null)).toBe(
      'LastStint Eras: Abu Dhabi 2021 (Legend) 🟩',
    );
  });
});

describe('the review screen', () => {
  let finished: GameState;
  let session: GameSession;

  beforeAll(async () => {
    const daily: Daily = await new StaticDailyProvider().today();
    session = new GameSession(daily);
    session.start();
    session.pickPlan('a');
    for (let i = 0; i < 300 && session.state.phase !== 'finished'; i++) {
      const m = session.state.currentMoment;
      if (session.state.phase === 'decision' && m)
        session.choose(m.realOptionId ?? (m.options[0]?.id as string));
      else session.tick();
    }
    await session.allGraded();
    finished = session.state;
  }, 60_000);

  const screen = (submission: Submission, source: Daily['source'], eras?: ErasResultInfo) => {
    const state: GameState = {
      ...finished,
      phase: 'results',
      submission,
      meta: { ...finished.meta, source },
    };
    const game = {
      model,
      localScore: () => session.localScore(),
      notes: () => session.notes,
      submit: () => {},
      reset: () => {},
    } as unknown as Game;
    return renderToStaticMarkup(createElement(ResultScreen, { state, game, eras }));
  };

  it('shows an Eras attempt’s stars, new attempt and back to era, without Play again', () => {
    const html = screen(done({ rewrite: true }), 'eras', info());
    expect(html).toContain('Eras · Era 9');
    expect(html).toContain('aria-label="Stars"');
    expect(html).toContain('An authored headline for the rewrite');
    expect(html).toContain('>New attempt</button>');
    expect(html).toContain('Back to era');
    expect(html).not.toContain('Play again');
    expect(html).not.toContain('(practice)');
    expect(html).not.toContain('Keep racing: Gauntlet');
    expect(html).not.toContain('aria-label="Score"');
    expect(html).toContain('LastStint Eras: Abu Dhabi 2021 ★★☆ 82%');
  });

  it('shows an Eras error once, in the stars panel', () => {
    const html = screen({ status: 'error', error: 'Can’t reach the server.' }, 'eras', info());
    expect(html).toContain('No stars yet.');
    expect(html).not.toContain('Not submitted (');
  });

  it('leaves a practice run’s review as it was', () => {
    const html = screen({ status: 'practice' }, 'practice');
    expect(html).toContain('Practice run');
    expect(html).toContain('Play again');
    expect(html).toContain('LastStint (practice)');
    expect(html).toContain('Keep racing: Gauntlet');
    expect(html).toContain('aria-label="Score"');
    expect(html).not.toContain('New attempt');
    expect(html).not.toContain('aria-label="Stars"');
  });
});

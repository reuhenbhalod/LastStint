// The Gauntlet screen (/gauntlet, src/screens/Survivor.tsx), every control in every state
// (docs/test-suite-spec.md S3): the lobby and its leaderboard, starting a run (busy, errors),
// a run kept across a reload, the start-once fallback, the Menu out of a race and back, each
// race's controls, a won round (the floodlit straight and the next race's brief), a lost round
// and the run's end. The API is mocked (gauntlet.ts); the race runs in the page on the real
// race file, with shorter lap ticks (the app's e2e hook).
import type { Page } from '@playwright/test';
import { expect, test } from '../coverage.js';
import {
  ABU,
  type Answered,
  type Choose,
  SPAIN,
  answerCall,
  fastLaps,
  lapOf,
  lost,
  mockGauntlet,
  phaseOf,
  raceToFlag,
  runState,
  won,
} from './gauntlet.js';

const RUN_KEY = 'pitwall:survivor-run';
const savedRun = (page: Page) => page.evaluate((k) => localStorage.getItem(k), RUN_KEY);
const keepRun = (page: Page, id: string) =>
  page.addInitScript(
    ([k, v]) => {
      // Only on the first load: a test that reloads sees what the page kept.
      if (!sessionStorage.getItem('seeded')) {
        sessionStorage.setItem('seeded', '1');
        localStorage.setItem(k as string, v as string);
      }
    },
    [RUN_KEY, id],
  );

const plan = (page: Page) => page.getByRole('region', { name: 'Race plan' });
const startRun = (page: Page) => page.getByRole('button', { name: 'Start a run' });
const toMenu = (page: Page) => page.getByRole('button', { name: 'Back to the Gauntlet menu' });

const desktop = () => test.info().project.name === 'desktop';

test.describe('lobby', () => {
  test('the rules, the leaderboard tabs and the way into a run', async ({ page }) => {
    await mockGauntlet(page, {
      leaderboard: {
        json: {
          week: [
            { rank: 1, name: 'Quick Pilot', rounds: 4, meanScore: 72.4, live: true, date: '' },
            { rank: 2, name: 'Slow Pilot', rounds: 2, meanScore: 55, live: false, date: '' },
          ],
          allTime: [
            { rank: 1, name: 'Old Legend', rounds: 9, meanScore: 88, live: false, date: '' },
          ],
        },
      },
    });
    await page.goto('/gauntlet');
    await expect(page.getByRole('heading', { name: 'Gauntlet', level: 1 })).toBeVisible();
    await expect(page.getByText('Game mode · Survival')).toBeVisible();
    await expect(page.getByText(/Lose once and the lights go out/)).toBeVisible();
    await expect(page.getByText('Play as many runs as you like.')).toBeVisible();
    await expect(startRun(page)).toBeEnabled();
    // The floodlit straight describes itself for a screen reader.
    await expect(page.getByRole('img', { name: /Round 1's gantry is ahead/ })).toBeVisible();

    const board = page.getByRole('region', { name: 'Gauntlet leaderboard' });
    const week = board.getByRole('button', { name: 'This week' });
    const all = board.getByRole('button', { name: 'All time' });
    await expect(week).toHaveAttribute('aria-pressed', 'true');
    await expect(all).toHaveAttribute('aria-pressed', 'false');
    const rows = board.getByRole('listitem');
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText('Quick Pilot');
    await expect(rows.first()).toContainText('racing');
    await expect(rows.first()).toContainText('Round 4');
    await expect(rows.first()).toContainText('72 pts');
    await expect(rows.nth(1)).not.toContainText('racing');

    await all.click();
    await expect(all).toHaveAttribute('aria-pressed', 'true');
    await expect(week).toHaveAttribute('aria-pressed', 'false');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Old Legend');
    await expect(rows.first()).toContainText('88 pts');
    await week.click();
    await expect(week).toHaveAttribute('aria-pressed', 'true');
    await expect(rows.first()).toContainText('Quick Pilot');
  });

  test('an empty and a failed leaderboard', async ({ page }) => {
    await mockGauntlet(page);
    await page.goto('/gauntlet');
    const board = page.getByRole('region', { name: 'Gauntlet leaderboard' });
    await expect(board.getByText('No runs yet. Be the first down the straight.')).toBeVisible();
    await board.getByRole('button', { name: 'All time' }).click();
    await expect(board.getByText('No runs yet. Be the first down the straight.')).toBeVisible();

    await page.unrouteAll();
    await mockGauntlet(page, { leaderboard: { status: 500, json: { error: 'boom' } } });
    await page.reload();
    await expect(board.getByText('The leaderboard isn’t available.')).toBeVisible();
  });

  test('the top bar and the footer go where they say', async ({ page }) => {
    await mockGauntlet(page);
    await page
      .context()
      .route(/openstreetmap\.org/, (r) =>
        r.fulfill({ contentType: 'text/html', body: '<h1>OSM</h1>' }),
      );
    await page.goto('/gauntlet');
    const nav = page.getByRole('navigation', { name: 'Ways to play' });
    await expect(nav.getByRole('link', { name: 'Gauntlet' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(nav.getByRole('link', { name: 'Daily' })).not.toHaveAttribute('aria-current');
    // Versus isn't in the release: no tab.
    await expect(nav.getByRole('link')).toHaveText(['Daily', 'Gauntlet', 'Eras']);

    for (const [name, path] of [
      ['Eras', '/eras'],
      ['Gauntlet', '/gauntlet'],
      ['Daily', '/'],
    ] as const) {
      await page.goto('/gauntlet');
      await nav.getByRole('link', { name }).click();
      await expect(page).toHaveURL(path);
    }
    await page.goto('/gauntlet');
    await page.getByRole('link', { name: 'LastStint home' }).click();
    await expect(page).toHaveURL('/');

    const footer = page.getByRole('contentinfo');
    for (const [name, heading] of [
      ['Privacy', 'Privacy policy'],
      ['Terms', 'Terms'],
      ['Credits', 'Credits'],
    ] as const) {
      await page.goto('/gauntlet');
      await footer.getByRole('link', { name, exact: true }).click();
      await expect(page).toHaveURL(`/${name.toLowerCase()}`);
      await expect(page.getByRole('heading', { level: 1 })).toContainText(heading);
    }
    // The map credit opens OpenStreetMap's copyright page in a new tab.
    await page.goto('/gauntlet');
    const [osm] = await Promise.all([
      page.waitForEvent('popup'),
      footer.getByRole('link', { name: 'OpenStreetMap contributors' }).click(),
    ]);
    await expect(osm).toHaveURL('https://www.openstreetmap.org/copyright');
  });
});

test.describe('starting a run', () => {
  test('busy while the first round is dealt, then straight into the race', async ({ page }) => {
    const calls = await mockGauntlet(page, {
      start: [{ status: 201, json: runState({ rounds: 0, round: 1 }), delay: 800 }],
    });
    await page.goto('/gauntlet');
    await startRun(page).click();
    const dealing = page.getByRole('button', { name: 'Dealing round 1…' });
    await expect(dealing).toBeDisabled();
    // No race card inside a run: the plan, then the race.
    await expect(plan(page)).toBeVisible();
    expect(calls.starts).toBe(1);
    expect(await savedRun(page)).toBe('run-1');
    // The race screen names the round (wide screens) and offers only the way back, no restart.
    if (desktop()) await expect(page.getByText('Gauntlet · round 1')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Restart the race' })).toHaveCount(0);
    await expect(toMenu(page)).toBeVisible();
  });

  test('each start error is said, and the next try works', async ({ page }) => {
    const calls = await mockGauntlet(page, {
      start: [
        { status: 503, json: { error: 'no-survivor-races' } },
        { status: 429, json: { error: 'rate-limited' } },
        { status: 500, json: { error: 'boom' } },
        'abort',
        { status: 201, json: runState({ rounds: 0, round: 1 }) },
      ],
    });
    await page.goto('/gauntlet');
    for (const said of [
      'Gauntlet races are on their way. Check back soon.',
      'Too many requests. Give it a minute.',
      'The server said boom.',
      'Can’t reach the server. Check your connection and try again.',
    ]) {
      await startRun(page).click();
      await expect(page.getByText(said)).toBeVisible();
      await expect(startRun(page)).toBeEnabled();
      expect(await savedRun(page)).toBeNull();
    }
    await startRun(page).click();
    await expect(plan(page)).toBeVisible();
    expect(calls.starts).toBe(5);
  });
});

test.describe('a run in progress', () => {
  test('a reload lands on the lobby with only the way back to it', async ({ page }) => {
    const calls = await mockGauntlet(page, {
      state: { json: runState({ runId: 'run-7', rounds: 1, round: 2 }) },
    });
    await keepRun(page, 'run-7');
    await page.goto('/gauntlet');
    const back = page.getByRole('button', { name: 'Back to round 2' });
    await expect(back).toBeVisible();
    await expect(
      page.getByText('Your run is still on: 1 round survived. Your race waits where you left it.'),
    ).toBeVisible();
    await expect(startRun(page)).toHaveCount(0);
    await expect(page.getByRole('img', { name: /Round 2's gantry is ahead/ })).toBeVisible();
    expect(calls.states).toEqual(['run-7']);
    await back.click();
    await expect(plan(page)).toBeVisible();
    expect(calls.starts).toBe(0);
  });

  for (const [what, reply] of [
    ['is over', { json: runState({ rounds: 3, round: null, status: 'over' }) }],
    ['is gone', { status: 404, json: { error: 'no-run' } }],
  ] as const) {
    test(`a saved run that ${what} is forgotten`, async ({ page }) => {
      await mockGauntlet(page, { state: reply });
      await keepRun(page, 'run-7');
      await page.goto('/gauntlet');
      await expect(startRun(page)).toBeVisible();
      await expect(page.getByRole('button', { name: /Back to round/ })).toHaveCount(0);
      expect(await savedRun(page)).toBeNull();
    });
  }

  test('the Menu out of a race keeps the race where it was', async ({ page }) => {
    await fastLaps(page, 0.3);
    const calls = await mockGauntlet(page);
    await page.goto('/gauntlet');
    await startRun(page).click();
    // The player's own plan this time (built from the engineer's pick), once it's graded.
    await plan(page).getByRole('button', { name: 'Build your own' }).click();
    const own = plan(page).getByRole('button', { name: 'Go with your plan' });
    await expect(own).toBeEnabled({ timeout: 30_000 });
    await own.click();
    await expect(plan(page)).toHaveCount(0);
    const decisions = await page.evaluate(
      () =>
        (
          window as unknown as {
            __laststintE2E: {
              session: { state: { decisions: Array<{ kind: string; id?: string }> } };
            };
          }
        ).__laststintE2E.session.state.decisions,
    );
    expect(decisions).toContainEqual(expect.objectContaining({ kind: 'plan', id: 'own' }));
    await expect(page.getByRole('button', { name: 'Team radio' }).first()).toBeEnabled();
    const lap = await lapOf(page);
    expect(await phaseOf(page)).toMatch(/racing|decision/);

    await toMenu(page).click();
    // The lobby offers only the way back: no new run, so leaving can't restart it.
    await expect(page.getByRole('heading', { name: 'Gauntlet', level: 1 })).toBeVisible();
    await expect(startRun(page)).toHaveCount(0);
    await expect(page.getByText(/Your run is still on: 0 rounds survived/)).toBeVisible();
    await page.getByRole('button', { name: 'Back to round 1' }).click();
    // The same race, past its plan, at least as far on as it was: it didn't start again.
    await expect(toMenu(page)).toBeVisible();
    await expect(plan(page)).toHaveCount(0);
    expect(await lapOf(page)).toBeGreaterThanOrEqual(lap);
    expect(await phaseOf(page)).toMatch(/racing|decision/);
    expect(calls.starts).toBe(1);

    if (desktop()) {
      // On a wide screen the brand (with the engineer's team) is a way to the menu too.
      await page.getByRole('button', { name: /race engineer/ }).click();
      await expect(page.getByRole('button', { name: 'Back to round 1' })).toBeVisible();
    }
  });
});

test.describe('the start runs once', () => {
  test('a start that throws shows why, and its button starts the round', async ({ page }) => {
    await fastLaps(page, 0.3, true);
    await mockGauntlet(page);
    await page.goto('/gauntlet');
    await startRun(page).click();
    await expect(page.getByText('Round 1 · lights out')).toBeVisible();
    await expect(page.getByText('Round 1 wouldn’t start (engine stalled).')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Gauntlet menu' })).toBeVisible();
    expect(await phaseOf(page)).toBe('intro');
    await page.getByRole('button', { name: 'Start round 1' }).click();
    await expect(plan(page)).toBeVisible();
    expect(await phaseOf(page)).toBe('planning');
  });

  test('the fallback’s menu button goes back to the lobby', async ({ page }) => {
    await fastLaps(page, 0.3, true);
    await mockGauntlet(page);
    await page.goto('/gauntlet');
    await startRun(page).click();
    await page.getByRole('button', { name: 'Gauntlet menu' }).click();
    await expect(page.getByRole('button', { name: 'Back to round 1' })).toBeVisible();
    await expect(startRun(page)).toHaveCount(0);
  });

  test('a race that won’t load offers to try again', async ({ page }) => {
    const nowhere = { ...ABU, race: { ...ABU.race, id: 'nowhere-1999' } };
    await mockGauntlet(page, {
      start: [{ status: 201, json: runState({ rounds: 0, round: 1, race: nowhere }) }],
    });
    await page.goto('/gauntlet');
    await startRun(page).click();
    await expect(page.getByText('no race file nowhere-1999')).toBeVisible();
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByText('no race file nowhere-1999')).toBeVisible();
    await page.getByRole('button', { name: 'Gauntlet menu' }).click();
    await expect(page.getByRole('button', { name: 'Back to round 1' })).toBeVisible();
  });

  test('a race slow to load offers Try again after a few seconds', async ({ page }) => {
    // The race file's chunk held back past the 4 s the screen waits before offering a button.
    let release: () => void = () => {};
    const held = new Promise<void>((ok) => {
      release = ok;
    });
    await page.route(/\/assets\/spain-2020-[^/]*\.js$/, async (r) => {
      await held;
      await r.continue();
    });
    await mockGauntlet(page, {
      start: [{ status: 201, json: runState({ rounds: 0, round: 1, race: SPAIN }) }],
    });
    await page.goto('/gauntlet');
    await startRun(page).click();
    await expect(page.getByText('Round 1 · lights out')).toBeVisible();
    const again = page.getByRole('button', { name: 'Try again' });
    await expect(again).toBeVisible({ timeout: 10_000 });
    await again.click();
    release();
    await expect(plan(page)).toBeVisible();
  });
});

test.describe('rounds', () => {
  test('a won round: the straight, the next race’s brief, then straight into it', async ({
    page,
  }) => {
    await fastLaps(page);
    const calls = await mockGauntlet(page, {
      rounds: [
        won(
          runState({
            rounds: 1,
            round: 2,
            race: SPAIN,
            meanScore: 76.6,
            history: [{ round: 1, raceId: ABU.race.id, won: true, score: 76.6, finishPosition: 1 }],
          }),
        ),
      ],
    });
    await page.goto('/gauntlet');
    await startRun(page).click();
    await plan(page)
      .getByRole('button', { name: /Go with plan/ })
      .click();
    await page.getByRole('button', { name: '2×' }).click();
    const seen = await raceToFlag(page, page.getByText('Round 1 survived'));
    expect(seen.length).toBeGreaterThanOrEqual(3);

    const sent = calls.rounds[0];
    expect(sent?.round).toBe(1);
    expect(sent?.decisions?.length).toBeGreaterThan(0);
    expect(sent?.anonId).toBeTruthy();

    await expect(page.getByRole('heading', { name: '1 round survived' })).toBeVisible();
    await expect(page.getByText('HAM P1, VER P2')).toBeVisible();
    await expect(page.getByText('Through the gantry. Round 2 is lit.')).toBeVisible();
    await expect(page.getByRole('img', { name: /drives under round 1's gantry/ })).toBeVisible();
    // The next race's brief, from its race file (Spain 2020: Verstappen holds P2 from Bottas).
    await expect(page.getByText('Next · round 2')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Spain 2020', level: 2 })).toBeVisible();
    await expect(page.getByText('Verstappen vs Bottas')).toBeVisible();
    await expect(page.getByText(/You take over on lap 18 of 66:/)).toBeVisible();
    await expect(page.getByText('48 laps to run')).toBeVisible();
    await expect(page.getByText(/on the Red Bull Racing pit wall/)).toBeVisible();
    await expect(page.getByText('You run')).toBeVisible();
    await expect(page.getByText('2.7s')).toBeVisible();
    await expect(page.getByText('you lead')).toBeVisible();
    await expect(page.getByText('Hold P2 from Bottas')).toBeVisible();
    await expect(page.getByText('The real pit wall got P2. Keep it.')).toBeVisible();
    await expect(page.getByText('77 pts a call so far.')).toBeVisible();
    expect(await savedRun(page)).toBe('run-1');

    await page.getByRole('button', { name: 'Next race' }).click();
    await expect(plan(page)).toBeVisible();
    // Round 2 is the race the brief described.
    await expect(plan(page)).toContainText('48 laps to go');
    if (desktop()) await expect(page.getByText('Gauntlet · round 2')).toBeVisible();
  });

  test('a lost round ends the run: its rounds, rank and each race', async ({ page }) => {
    await fastLaps(page);
    const history = [
      { round: 1, raceId: SPAIN.race.id, won: true, score: 80, finishPosition: 2 },
      { round: 2, raceId: ABU.race.id, won: false, score: 40, finishPosition: 2 },
    ];
    const calls = await mockGauntlet(page, {
      state: { json: runState({ runId: 'run-7', rounds: 1, round: 2 }) },
      rounds: [
        lost(
          runState({
            runId: 'run-7',
            rounds: 1,
            round: null,
            status: 'over',
            meanScore: 61.5,
            history,
            rank: 3,
            total: 10,
          }),
        ),
      ],
      start: [{ status: 201, json: runState({ runId: 'run-8', rounds: 0, round: 1 }) }],
    });
    await keepRun(page, 'run-7');
    await page.goto('/gauntlet');
    await page.getByRole('button', { name: 'Back to round 2' }).click();
    await plan(page)
      .getByRole('button', { name: /Go with plan/ })
      .click();
    await page.getByRole('button', { name: '2×' }).click();
    // The last answer to every call this time (Keep ours, Stay out...), but never Back.
    await raceToFlag(page, page.getByText('Lights out · run over'), (_k, names) =>
      names.filter((n) => n !== 'Back').at(-1),
    );
    expect(calls.rounds[0]?.round).toBe(2);

    await expect(page.getByRole('heading', { name: '1 round', level: 1 })).toBeVisible();
    await expect(page.getByText('Last race: HAM P2, VER P1')).toBeVisible();
    await expect(page.getByText('#3 of 10 runs all time · 62 pts a call')).toBeVisible();
    await expect(page.getByRole('img', { name: /Round 2's lamps are red/ })).toBeVisible();
    const mine = page.getByRole('region', { name: 'Your run' });
    const rows = mine.getByRole('listitem');
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText('Spain 2020: Verstappen vs Bottas');
    await expect(rows.first()).toContainText('Survived · P2');
    await expect(rows.nth(1)).toContainText('Abu Dhabi 2021: Hamilton vs Verstappen');
    await expect(rows.nth(1)).toContainText('Out · P2');
    // The leaderboard under it.
    await expect(page.getByRole('region', { name: 'Gauntlet leaderboard' })).toBeVisible();
    expect(await savedRun(page)).toBeNull();

    await page.getByRole('button', { name: 'Start a new run' }).click();
    await expect(plan(page)).toBeVisible();
    expect(calls.starts).toBe(1);
    expect(await savedRun(page)).toBe('run-8');
  });

  test('out in round 1: no rank, the leaderboard beside it; a disqualification', async ({
    page,
  }) => {
    await fastLaps(page);
    await mockGauntlet(page, {
      rounds: [
        lost(runState({ rounds: 0, round: null, status: 'over' }), [ABU.rival, ABU.userSide], true),
      ],
    });
    await page.goto('/gauntlet');
    await startRun(page).click();
    await plan(page)
      .getByRole('button', { name: /Go with plan/ })
      .click();
    await page.getByRole('button', { name: '2×' }).click();
    // A middle answer to every call this time.
    await raceToFlag(page, page.getByText('Lights out · run over'), (_k, names) =>
      names.length > 2 ? names[1] : undefined,
    );
    await expect(page.getByRole('heading', { name: '0 rounds', level: 1 })).toBeVisible();
    await expect(page.getByText('Last race: HAM was disqualified')).toBeVisible();
    await expect(page.getByText(/runs all time/)).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Your run' })).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Gauntlet leaderboard' })).toHaveCount(1);
  });

  test('a verdict that fails says so, and Try again sends it again', async ({ page }) => {
    await fastLaps(page);
    const calls = await mockGauntlet(page, {
      rounds: [
        { status: 500, json: { error: 'boom' } },
        won(runState({ rounds: 1, round: 2 }), [ABU.userSide]),
      ],
    });
    await page.goto('/gauntlet');
    await startRun(page).click();
    await plan(page)
      .getByRole('button', { name: /Go with plan/ })
      .click();
    await page.getByRole('button', { name: '2×' }).click();
    // The third answer where a call has one.
    await raceToFlag(page, page.getByText('The server said boom.'), (_k, names) =>
      names.length > 3 ? names[2] : undefined,
    );
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByText('Round 1 survived')).toBeVisible();
    // The rival didn't finish.
    await expect(page.getByText('HAM P1, VER out')).toBeVisible();
    expect(calls.rounds).toHaveLength(2);
    expect(calls.rounds[1]?.round).toBe(1);
  });

  test('a verdict already given (a reload mid-send) carries on from the server', async ({
    page,
  }) => {
    await fastLaps(page);
    const calls = await mockGauntlet(page, {
      rounds: [{ status: 409, json: { error: 'wrong-round' } }],
      state: {
        json: runState({
          rounds: 1,
          round: 2,
          history: [{ round: 1, raceId: ABU.race.id, won: true, score: 70, finishPosition: 1 }],
        }),
      },
    });
    await page.goto('/gauntlet');
    await startRun(page).click();
    await plan(page)
      .getByRole('button', { name: /Go with plan/ })
      .click();
    await page.getByRole('button', { name: '2×' }).click();
    // The last but one answer this time.
    await raceToFlag(page, page.getByText('Round 1 survived'), (_k, names) =>
      names.filter((n) => n !== 'Back').at(-2),
    );
    expect(calls.states).toEqual(['run-1']);
    // No finishing order to show: the server only kept the verdict.
    await expect(page.getByText(/HAM P\d/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Next race' })).toBeVisible();
  });
});

/** How `between` answers a call (its first choice unless a test sets one), and what it did. */
const betweenCalls: { choose?: Choose; seen: Answered[] } = { seen: [] };

/** Waits for the race to be running between calls (answering any call that's up). */
async function between(page: Page) {
  for (let i = 0; i < 60; i++) {
    if (!(await answerCall(page, betweenCalls.seen, betweenCalls.choose))) {
      if ((await phaseOf(page)) === 'racing') return;
      await page.waitForTimeout(100);
    }
  }
}

/** Does `act` while the race runs, again if a call interrupted it. */
async function whileRacing(page: Page, act: () => Promise<void>) {
  for (let i = 0; ; i++) {
    await between(page);
    try {
      await act();
      return;
    } catch (e) {
      if (i >= 4) throw e;
    }
  }
}

test.describe('race controls', () => {
  test('every control of a round’s race, pressed and checked', async ({ page }) => {
    test.setTimeout(300_000);
    // Every call answered a different way where it can be (Box opens the tyres, Back shuts
    // them the first time), whether it comes up while the controls are pressed or after.
    const pressed = new Set<string>();
    const choose: Choose = (_kind, names) => {
      const pick =
        (names.includes('Back') && !pressed.has('Back') && 'Back') ||
        names.find((n) => !pressed.has(n)) ||
        names[0];
      pressed.add(pick as string);
      return pick;
    };
    betweenCalls.choose = choose;
    betweenCalls.seen = [];
    // Spain 2020 (48 laps to run: room for every control): Verstappen holds P2 from Bottas.
    await fastLaps(page, 0.2);
    await mockGauntlet(page, {
      start: [{ status: 201, json: runState({ rounds: 0, round: 1, race: SPAIN }) }],
      rounds: [won(runState({ rounds: 1, round: 2 }), [SPAIN.userSide, SPAIN.rival])],
    });
    await page.goto('/gauntlet');
    await startRun(page).click();

    // The race plan: each card picks, Build your own edits, the engineer's plans go back.
    const card = (id: string) => plan(page).getByRole('button', { name: new RegExp(`^${id} · `) });
    const go = plan(page).getByRole('button', { name: /^Go with/ });
    for (const id of ['B', 'C', 'A']) {
      await card(id).click();
      await expect(card(id)).toHaveAttribute('aria-pressed', 'true');
      await expect(go).toHaveText(`Go with plan ${id}`);
    }
    await expect(card('B')).toHaveAttribute('aria-pressed', 'false');
    await card('C').click();
    await plan(page).getByRole('button', { name: 'Build your own' }).click();
    await expect(go).toHaveText('Go with your plan');
    await expect(card('A')).toHaveCount(0);
    // The editor starts from plan C (two stops); each of its controls changes the draft.
    const stopLap = plan(page).getByRole('slider', { name: 'Stop 1 lap' });
    const lap0 = Number(await stopLap.inputValue());
    await plan(page).getByRole('button', { name: 'Later' }).first().click();
    await expect(stopLap).toHaveValue(String(lap0 + 1));
    await plan(page).getByRole('button', { name: 'Earlier' }).first().click();
    await expect(stopLap).toHaveValue(String(lap0));
    await stopLap.fill(String(lap0 + 3));
    await expect(stopLap).toHaveValue(String(lap0 + 3));
    const hards = plan(page).getByRole('button', { name: 'hards', exact: true }).first();
    await hards.click();
    await expect(hards).toHaveAttribute('aria-pressed', 'true');
    for (const pace of ['Push', 'Manage', 'Standard']) {
      const b = plan(page).getByRole('button', { name: pace, exact: true }).first();
      await b.click();
      await expect(b).toHaveAttribute('aria-pressed', 'true');
    }
    await expect(plan(page).getByRole('slider')).toHaveCount(2);
    await plan(page).getByRole('button', { name: 'Remove' }).last().click();
    await expect(plan(page).getByRole('slider')).toHaveCount(1);
    await plan(page).getByRole('button', { name: '+ Add a stop' }).click();
    await expect(plan(page).getByRole('slider')).toHaveCount(2);
    await plan(page).getByRole('button', { name: 'The engineer’s plans' }).click();
    await expect(card('A')).toBeVisible();

    // The header: speed, and on a wide screen the radio sound.
    const x1 = page.getByRole('button', { name: '1×' });
    const x2 = page.getByRole('button', { name: '2×' });
    await expect(x1).toHaveAttribute('aria-pressed', 'true');
    await x2.click();
    await expect(x2).toHaveAttribute('aria-pressed', 'true');
    await expect(x1).toHaveAttribute('aria-pressed', 'false');
    await x1.click();
    await expect(x1).toHaveAttribute('aria-pressed', 'true');
    if (desktop()) {
      const sound = page.getByRole('button', { name: /^Radio sound (on|off)$/ });
      const before = await sound.getAttribute('aria-pressed');
      await sound.click();
      await expect(sound).not.toHaveAttribute('aria-pressed', before as string);
      await expect(sound).toHaveAccessibleName(
        before === 'true' ? 'Radio sound off' : 'Radio sound on',
      );
      await sound.click();
      await expect(sound).toHaveAttribute('aria-pressed', before as string);
    }

    // The map: follow the car; a car's details from the map and from the leaders.
    const follow = page.getByRole('button', { name: 'Follow car' });
    await follow.click();
    await expect(follow).toHaveAttribute('aria-pressed', 'true');
    await follow.click();
    await expect(follow).toHaveAttribute('aria-pressed', 'false');
    // The dock's buttons wait for the race (no orders during the plan).
    const radioPill = page
      .getByRole('navigation', { name: 'Controls' })
      .getByRole('button', { name: 'Team radio', exact: true });
    await expect(radioPill).toBeDisabled();
    await card('B').click();
    await plan(page).getByRole('button', { name: 'Go with plan B' }).click();
    await expect(plan(page)).toHaveCount(0);

    // A car's details, from the map and from the leaders (they wait while a call is up).
    const details = page.getByRole('region', { name: /details$/ });
    const close = page.getByRole('button', { name: 'Close driver details' });
    const dot = page.getByRole('button', { name: 'BOT: details' });
    await whileRacing(page, async () => {
      await dot.focus({ timeout: 3000 });
      await dot.press('Enter', { timeout: 3000 });
      await expect(details).toContainText('Mercedes · Rival', { timeout: 3000 });
      await expect(dot).toHaveAttribute('aria-pressed', 'true');
      await close.click({ timeout: 3000 });
      await expect(details).toHaveCount(0);
    });
    // Every car on the map has its card.
    const dots = await page
      .locator('[role="button"][aria-label$=": details"]')
      .evaluateAll((gs) => gs.map((g) => g.getAttribute('aria-label') as string));
    // The cars still running.
    expect(dots.length).toBeGreaterThanOrEqual(15);
    for (const name of dots) {
      await whileRacing(page, async () => {
        const d = page.getByRole('button', { name, exact: true });
        if (!(await d.count())) return; // retired since
        await d.focus({ timeout: 3000 });
        await d.press('Enter', { timeout: 3000 });
        await expect(details).toBeVisible({ timeout: 3000 });
        await expect(d).toHaveAttribute('aria-pressed', 'true');
        await close.click({ timeout: 3000 });
      });
    }
    const leaders = page.getByRole('region', { name: 'Leaders' });
    await whileRacing(page, async () => {
      await leaders.getByRole('button', { name: /VER/ }).click({ timeout: 3000 });
      await expect(details).toContainText('Red Bull Racing · Your driver', { timeout: 3000 });
      await close.click({ timeout: 3000 });
      await expect(details).toHaveCount(0);
    });

    // Stats: tabs on a phone, the side panels on a wide screen.
    const controls = page.getByRole('navigation', { name: 'Controls' });
    if (desktop()) {
      const stats = controls.getByRole('button', { name: 'Show stats' });
      await stats.click();
      const focus = controls.getByRole('button', { name: 'Focus view' });
      await expect(focus).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByRole('complementary', { name: 'Stats' })).toHaveAttribute(
        'aria-hidden',
        'false',
      );
      const tower = page.getByRole('region', { name: 'Standings' });
      await whileRacing(page, async () => {
        await tower.getByRole('button', { name: /BOT/ }).click({ timeout: 3000 });
        await expect(details).toContainText('Mercedes · Rival', { timeout: 3000 });
        await close.click({ timeout: 3000 });
      });
      await focus.click();
      await expect(controls.getByRole('button', { name: 'Show stats' })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    } else {
      const dock = page.getByRole('region', { name: 'Race', exact: true });
      for (const [tab, shows] of [
        ['Standings', dock.getByRole('listitem').getByRole('button', { name: /^\d+\s*VER/ })],
        ['Car', dock.getByRole('region', { name: 'Your driver' })],
        ['Calls', dock.getByText('Your calls')],
        ['Radio', dock.locator('ul[aria-live="polite"]')],
      ] as const) {
        await whileRacing(page, async () => {
          const b = controls.getByRole('button', { name: tab, exact: true });
          await b.click({ timeout: 3000 });
          await expect(b).toHaveAttribute('aria-pressed', 'true', { timeout: 3000 });
          await expect(shows).toBeVisible({ timeout: 3000 });
        });
      }
      await whileRacing(page, async () => {
        const b = controls.getByRole('button', { name: 'Radio', exact: true });
        await b.click({ timeout: 3000 });
        await expect(b).toHaveAttribute('aria-pressed', 'false', { timeout: 3000 });
      });
    }

    // The plan, from the control bar: Change opens the editor, Cancel shuts it.
    await whileRacing(page, async () => {
      await controls.getByRole('button', { name: /^Plan · / }).click({ timeout: 3000 });
      const bar = page.getByRole('region', { name: 'Race plan' });
      await bar.getByRole('button', { name: 'Change' }).click({ timeout: 3000 });
      await expect(bar.getByRole('button', { name: 'Run this plan' })).toBeVisible({
        timeout: 3000,
      });
      await bar.getByRole('button', { name: 'Cancel' }).click({ timeout: 3000 });
      await expect(bar.getByRole('button', { name: 'Run this plan' })).toHaveCount(0);
    });
    // Change again, and run the plan as it stands: the editor shuts and the plan carries on.
    await whileRacing(page, async () => {
      const bar = page.getByRole('region', { name: 'Race plan' });
      if (!(await bar.isVisible()))
        await controls.getByRole('button', { name: /^Plan · / }).click({ timeout: 3000 });
      await bar.getByRole('button', { name: 'Change' }).click({ timeout: 3000 });
      const run = bar.getByRole('button', { name: 'Run this plan' });
      await expect(run).toBeEnabled({ timeout: 3000 });
      await run.click({ timeout: 3000 });
      await expect(run).toHaveCount(0, { timeout: 3000 });
      await expect(bar.getByRole('button', { name: 'Change' })).toBeVisible();
    });
    // The map's credit opens OpenStreetMap in a new tab.
    const [osm] = await Promise.all([
      page.waitForEvent('popup'),
      page.getByRole('link', { name: '© OpenStreetMap contributors' }).click(),
    ]);
    await expect(osm).toHaveURL('https://www.openstreetmap.org/copyright');
    await osm.close();

    // Team radio: the headset, team orders and a box call.
    const radio = page.getByRole('region', { name: 'Team radio' });
    await whileRacing(page, async () => {
      if ((await radioPill.getAttribute('aria-pressed')) !== 'true')
        await radioPill.click({ timeout: 3000 });
      await expect(radio).toBeVisible({ timeout: 3000 });
      const head = radio.getByRole('button', { name: 'Team radio orders' });
      await head.click({ timeout: 3000 });
      await expect(head).toHaveAttribute('aria-expanded', 'false');
      await head.click({ timeout: 3000 });
      await expect(head).toHaveAttribute('aria-expanded', 'true');
    });
    // One call of a kind a lap (a mode: one a key), so the orders go a lap at a time: a new
    // mode is booked (pressed at once), and the next lap the usual one books it back.
    const openRadio = async () => {
      if ((await radioPill.getAttribute('aria-pressed')) !== 'true')
        await radioPill.click({ timeout: 3000 });
    };
    const book = async (row: string, value: string) => {
      const group = radio.getByRole('group', { name: row });
      if (!(await group.isVisible())) return;
      const b = group.getByRole('button', { name: value, exact: true });
      await b.click({ timeout: 3000 });
      await expect(b).toHaveAttribute('aria-pressed', 'true', { timeout: 3000 });
    };
    const order = async (name: string, then: string) => {
      if (!(await radio.getByRole('button', { name: then }).isVisible()))
        await radio.getByRole('button', { name }).click({ timeout: 3000 });
    };
    const steps: Array<() => Promise<void>> = [
      async () => {
        await book('Pace', 'push');
        await book('Battle', 'attack');
        await book('ERS', 'harvest');
        await order('Hold up Bottas', 'Release Bottas');
        await expect(radio.getByRole('button', { name: 'Release Bottas' })).toHaveAttribute(
          'aria-pressed',
          'true',
          { timeout: 3000 },
        );
      },
      async () => {
        await book('Pace', 'standard');
        await book('Battle', 'hold');
        await book('ERS', 'balanced');
        await book('Fuel', 'Lift & coast');
        await order('Release Bottas', 'Hold up Bottas');
        await expect(radio.getByRole('button', { name: 'Hold up Bottas' })).toHaveAttribute(
          'aria-pressed',
          'false',
          { timeout: 3000 },
        );
      },
      async () => {
        await book('Pace', 'manage');
        await book('Battle', 'defend');
        await book('ERS', 'deploy');
        await book('Fuel', 'normal');
      },
      async () => {
        await book('ERS', 'overtake');
        await radio.getByRole('button', { name: 'Albon lets you by' }).click({ timeout: 3000 });
        await expect(radio.getByText(/Swap called/)).toBeVisible({ timeout: 3000 });
      },
      async () => {
        await radio.getByRole('button', { name: 'Let Albon by' }).click({ timeout: 3000 });
        await expect(radio.getByText(/Swap called/)).toBeVisible({ timeout: 3000 });
      },
    ];
    // A step waits for a fresh lap, and goes again on the next one if a call got in first (a
    // quick call's answer books a mode too).
    for (const step of steps) {
      await expect(async () => {
        const lap = await lapOf(page);
        while ((await lapOf(page)) <= lap) await between(page);
        await openRadio();
        await step();
      }).toPass({ timeout: 90_000 });
    }
    await radioPill.click().catch(() => {});

    // Then every call to the flag.
    await x2.click();
    const seen = await raceToFlag(page, page.getByText('Round 1 survived'), choose);
    betweenCalls.choose = undefined;
    // Every kind of call came up (some while the controls above were pressed).
    const kinds = new Set([...seen.map((s) => s.kind), ...betweenCalls.seen.map((s) => s.kind)]);
    expect(kinds.has('Your call')).toBe(true);
    expect(kinds.has('Quick call')).toBe(true);
    // Where a call offered Box, it opened the tyres and Back shut them (the call with Box
    // depends on the path the race took; its own test is below).
    const all = [...betweenCalls.seen, ...seen];
    if (all.some((c) => c.names.includes('Box'))) expect(pressed.has('Box')).toBe(true);
  });

  test('a big call: Box opens the tyres, Back shuts them, a tyre boxes', async ({ page }) => {
    await fastLaps(page, 0.1);
    await mockGauntlet(page);
    await page.goto('/gauntlet');
    await startRun(page).click();
    await plan(page).getByRole('button', { name: 'Go with plan A' }).click();
    // Abu Dhabi 2021's first call: stay out or box, with the tyres behind Box.
    const call = page.getByRole('region', { name: 'Your call' });
    await expect(call).toBeVisible({ timeout: 60_000 });
    await expect(call.getByRole('alert')).toContainText(/Engineer · .* · Lap \d+/);
    const options = call.getByRole('button');
    await expect(call.getByRole('button', { name: 'Stay out' })).toBeVisible();
    await call.getByRole('button', { name: 'Box', exact: true }).click();
    await expect(call.getByText(/which tyres\?/)).toBeVisible();
    await expect(call.getByRole('button', { name: 'Stay out' })).toHaveCount(0);
    // The tyres the engineer offers, each with its gain and how long it lasts.
    const tyres = call.getByRole('button', { name: /^(Softs|Mediums|Hards)$/ });
    await expect(tyres).toHaveCount(2);
    await expect(tyres.first()).toHaveAccessibleName('Mediums');
    await expect(tyres.nth(1)).toHaveAccessibleName('Hards');
    await expect(tyres.first()).toContainText(/Drops off ~\d+ laps/);
    await call.getByRole('button', { name: 'Back' }).click();
    await expect(call.getByRole('button', { name: 'Stay out' })).toBeVisible();
    expect(await options.count()).toBeGreaterThanOrEqual(2);
    await call.getByRole('button', { name: 'Box', exact: true }).click();
    await call.getByRole('button', { name: 'Mediums', exact: true }).click();
    await expect(call).toHaveCount(0);
    const decisions = await page.evaluate(
      () =>
        (
          window as unknown as {
            __laststintE2E: {
              session: { state: { decisions: Array<{ kind: string; compound?: string }> } };
            };
          }
        ).__laststintE2E.session.state.decisions,
    );
    expect(decisions).toContainEqual(expect.objectContaining({ kind: 'pit', compound: 'MEDIUM' }));
  });

  test('a box call from team radio books the stop', async ({ page }) => {
    await fastLaps(page, 0.15);
    await mockGauntlet(page);
    await page.goto('/gauntlet');
    await startRun(page).click();
    await plan(page)
      .getByRole('button', { name: /Go with plan/ })
      .click();
    const radioPill = page
      .getByRole('navigation', { name: 'Controls' })
      .getByRole('button', { name: 'Team radio', exact: true });
    const radio = page.getByRole('region', { name: 'Team radio' });
    await whileRacing(page, async () => {
      if ((await radioPill.getAttribute('aria-pressed')) !== 'true')
        await radioPill.click({ timeout: 3000 });
      await expect(radioPill).toHaveAttribute('aria-pressed', 'true', { timeout: 3000 });
      await radio.getByRole('button', { name: /mediums/i }).click({ timeout: 3000 });
      await expect(radio.getByText(/Boxing · mediums/i).first()).toBeVisible({ timeout: 3000 });
    });
    // Once that stop is made, the tyre buttons come back: the other two compounds, in turn.
    for (const tyre of ['Hards', 'Softs']) {
      await expect(async () => {
        await between(page);
        if ((await radioPill.getAttribute('aria-pressed')) !== 'true') await radioPill.click();
        await radio.getByRole('button', { name: tyre }).click({ timeout: 1000 });
        await expect(radio.getByText(new RegExp(`Boxing · ${tyre}`, 'i')).first()).toBeVisible({
          timeout: 1000,
        });
      }).toPass({ timeout: 60_000 });
    }
    const decisions = await page.evaluate(
      () =>
        (
          window as unknown as {
            __laststintE2E: {
              session: { state: { decisions: Array<{ kind: string; compound?: string }> } };
            };
          }
        ).__laststintE2E.session.state.decisions,
    );
    for (const c of ['MEDIUM', 'HARD', 'SOFT'])
      expect(decisions.some((d) => d.kind === 'pit' && d.compound === c)).toBe(true);
    await radioPill.click();
    await expect(radioPill).toHaveAttribute('aria-pressed', 'false');
  });
});

// One authored race per era, from the era map to the results (build plan 10.1), on a desktop
// and a 390 px phone (the `desktop` and `phone` projects), with the Worker mocked (e2e/eras.ts).
// Between them: refuelling (a box call waits for its fuel fill), the 2005 tyre lock, no DRS
// before 2011, a team order, the decision timer running out and the untimed opt-out, Legend,
// reconstructed races with pit-board prompts (Eras 1-2), an avoidable storyline retirement
// (repeated and avoided), the history book and a leaderboard. No authored race has a red flag
// or a car fault yet, so those two are played on the catalog's Draft races that do (italy-2020,
// canada-2014), as test mode serves them.
//
// Each test plays a whole race at five times the normal lap speed (the app's e2e hook); the
// tests run in parallel. Runtime: see docs/eras-build-plan.md step 10.1.
import { expect, test } from '@playwright/test';
import {
  closeTeamRadio,
  finishRace,
  gameDecisions,
  loadEraRace,
  mockEras,
  noSidewaysScroll,
  openRace,
  playRace,
  raceNotes,
  radioLines,
  startRace,
  teamRadio,
} from './eras.js';

test.describe.configure({ mode: 'parallel' });
// A whole race (up to 70 laps after the takeover) at a second a lap, plus the grading.
test.setTimeout(420_000);

/** The intro's era and the race's name, then the results for that race and era. */
async function resultsFor(page: import('@playwright/test').Page, era: number, legend = false) {
  const stars = page.getByRole('region', { name: 'Stars' });
  await expect(stars).toContainText(`${legend ? 'Legend stars' : 'Stars'} · Era ${era}`);
  await expect(page.getByRole('link', { name: 'Back to era' })).toHaveAttribute(
    'href',
    `/eras/${era}`,
  );
  await noSidewaysScroll(page);
  return stars;
}

/** Every call shown in a race without DRS: no DRS line, no wait-for-DRS move. */
function noDrs(calls: string[]) {
  for (const c of calls) {
    expect(c).not.toMatch(/\bDRS\b/);
  }
}

test('Era 9: Turkey 2021 from the map to the results', async ({ page }) => {
  const model = loadEraRace('turkey-2021');
  const eras = await mockEras(page, [model]);
  await openRace(page, 'turkey-2021');
  await expect(page.getByText('Finish P4 or better')).toBeVisible();
  await playRace(page);
  await resultsFor(page, 9);
  expect(eras.submissions).toHaveLength(1);
  expect(eras.submissions[0]?.body.untimed).toBe(false);
});

test('Era 10: Belgium 2023, the decision timer runs out, then the untimed opt-out', async ({
  page,
}) => {
  const model = loadEraRace('belgium-2023');
  // A 4 s timer, so the first call can run out quickly.
  const eras = await mockEras(page, [model], {
    difficulty: () => ({
      accuracyThreshold: 70,
      information: 'full',
      rivalPolicy: 'standard',
      decisionTimerSeconds: 4,
    }),
  });
  await openRace(page, 'belgium-2023');
  await expect(page.getByText('Win the race')).toBeVisible();
  await expect(page.getByText('4 s per call')).toBeVisible();
  await startRace(page);
  // The first call: no answer. The timer counts down and the wall takes the default.
  const card = page.locator('section.decision');
  await expect(card.getByRole('timer')).toBeVisible({ timeout: 120_000 });
  const tag = (await card.getByRole('alert').textContent()) ?? '';
  const lap = Number(tag.match(/Lap (\d+)/)?.[1]);
  const moment = model.decisionMoments.find((m) => m.lap === lap);
  expect(moment, `a decision moment on lap ${lap}`).toBeDefined();
  await expect(card.getByRole('alert').filter({ hasText: `Lap ${lap}` })).toHaveCount(0, {
    timeout: 15_000,
  });
  expect((await radioLines(page)).map((r) => r.text)).toContainEqual(
    expect.stringMatching(/^Out of time, no call from the wall\./),
  );
  // Then the timer off: every call waits, and the attempt is marked untimed.
  await page.getByRole('button', { name: 'Timer on' }).click();
  await expect(page.getByRole('button', { name: 'Timer off' })).toBeVisible();
  const played = await finishRace(page, {
    each: async () => {
      if (await card.isVisible()) await expect(card.getByRole('timer')).toHaveCount(0);
    },
  });
  // A call shown with the timer off (a decision or a quick call) marks the attempt untimed.
  expect(played.moments.size + played.calls.length).toBeGreaterThan(0);
  const stars = await resultsFor(page, 10);
  await expect(stars).toContainText(
    'Untimed: the decision timer was off, so these stars are marked untimed.',
  );
  const sent = eras.submissions[0]?.body;
  expect(sent?.untimed).toBe(true);
  // The run-out call went in (as its default option), and nothing was answered after it on
  // the clock: the timer was off.
  expect(sent?.decisions).toContainEqual(
    expect.objectContaining({ kind: 'radio', momentId: moment?.id }),
  );
});

test('Era 8: Turkey 2020 from the map to the results', async ({ page }) => {
  const eras = await mockEras(page, [loadEraRace('turkey-2020')]);
  await openRace(page, 'turkey-2020');
  await playRace(page);
  await resultsFor(page, 8);
  expect(eras.submissions).toHaveLength(1);
});

test('Era 8 (Draft): Italy 2020’s red flag', async ({ page }) => {
  const model = loadEraRace('italy-2020');
  expect(model.events.some((e) => e.type === 'RED')).toBe(true);
  await mockEras(page, [model]);
  await openRace(page, 'italy-2020');
  await expect(page.getByText('Draft', { exact: true })).toBeVisible();
  const played = await playRace(page);
  expect(played.redFlag, 'the red flag shows on the race screen').toBe(true);
  await resultsFor(page, 8);
});

test('Era 7: Abu Dhabi 2016 from the map to the results', async ({ page }) => {
  const eras = await mockEras(page, [loadEraRace('abu-dhabi-2016')]);
  await openRace(page, 'abu-dhabi-2016');
  await expect(page.getByText('Finish P3 or better')).toBeVisible();
  await playRace(page);
  await resultsFor(page, 7);
  expect(eras.submissions).toHaveLength(1);
});

test('Era 7 (Draft): Canada 2014’s car faults', async ({ page }) => {
  const model = loadEraRace('canada-2014');
  await mockEras(page, [model]);
  await openRace(page, 'canada-2014');
  await playRace(page);
  // Both Mercedes lose power on their real laps; Rosberg is yours.
  const faults = (await raceNotes(page)).filter((n) => n.kind === 'fault');
  expect(faults).toContainEqual(
    expect.objectContaining({ driver: 'ROS', lap: 37, detail: 'power-loss' }),
  );
  expect(faults).toContainEqual(
    expect.objectContaining({ driver: 'HAM', lap: 36, detail: 'power-loss' }),
  );
  await resultsFor(page, 7);
});

test('Era 6: Abu Dhabi 2010 at Legend, no DRS', async ({ page }) => {
  const model = loadEraRace('abu-dhabi-2010');
  expect(model.rules?.drs).toBe(false);
  // Era 6 Cleared (a star on every race), so Legend is open.
  const eras = await mockEras(page, [model], { cleared: [6] });
  await openRace(page, 'abu-dhabi-2010', true);
  await expect(page).toHaveURL(/\/eras\/6\/abu-dhabi-2010\/legend$/);
  await expect(page.getByText('Difficulty · Legend')).toBeVisible();
  await expect(page.getByText('20 s per call')).toBeVisible();
  const played = await playRace(page);
  noDrs(played.calls);
  expect(eras.starts).toEqual([{ raceId: 'abu-dhabi-2010', legend: true }]);
  const stars = await resultsFor(page, 6, true);
  await expect(stars).toBeVisible();
  await expect(page.getByRole('link', { name: 'Legend leaderboard' })).toHaveAttribute(
    'href',
    '/eras/6/abu-dhabi-2010/leaderboard/legend',
  );
  // Expert rivals at Legend: the rival's choices go with the calls.
  expect(eras.submissions[0]?.body).toHaveProperty('rivalClaims');
});

test('Era 5: San Marino 2005, the tyre lock and a refuelling stop', async ({ page }) => {
  const model = loadEraRace('san-marino-2005');
  expect(model.rules).toMatchObject({ tyreChanges: false, refuelling: true, drs: false });
  await mockEras(page, [model]);
  await openRace(page, 'san-marino-2005');
  // Plan A, the no-stop plan, so the box call below is the player's own (the other plans box
  // on lap 21, as soon as the race starts).
  await startRace(page, { plan: 'A' });
  const radio = await teamRadio(page);
  // The 2005 lock: a stop keeps the dry set.
  await expect(radio.getByRole('note')).toContainText('No tyre changes this year');
  await expect(radio.getByRole('img', { name: 'Tyres locked: no tyre changes' })).toBeVisible();
  // Refuelling: the box call waits for a fill.
  const dry = radio.getByRole('button', { name: /^D\s*Dry/ });
  await expect(dry).toBeDisabled();
  await expect(radio).toContainText('Pick a fuel fill, then the tyres.');
  const fills = radio.getByRole('group', { name: 'Fuel fill' });
  await expect(fills.getByRole('button')).toHaveCount(3);
  await fills.getByRole('button', { name: /^Short/ }).click();
  await expect(dry).toBeEnabled();
  await dry.click();
  await expect(radio).toContainText('Boxing');
  await closeTeamRadio(page);
  const played = await finishRace(page);
  noDrs(played.calls);
  await resultsFor(page, 5);
  const pits = (await gameDecisions(page)).filter((d) => d.kind === 'pit');
  expect(pits).toContainEqual(expect.objectContaining({ compound: 'MEDIUM', fill: 'short' }));
  // Every stop states its fill (none goes without), and keeps the dry set.
  for (const p of pits) {
    expect(p.fill).toBeDefined();
    expect(p.compound).toBe('MEDIUM');
  }
});

test('Era 4: Austria 2002, a team order', async ({ page }) => {
  const model = loadEraRace('austria-2002');
  const eras = await mockEras(page, [model]);
  await openRace(page, 'austria-2002');
  await expect(page.getByText(/^Finish P2 or better, with Schumacher/)).toBeVisible();
  await startRace(page);
  const radio = await teamRadio(page);
  const orders = radio.getByText('Team orders · Schumacher');
  await expect(orders).toBeVisible();
  await radio.getByRole('button', { name: 'Let Schumacher by' }).click();
  await closeTeamRadio(page);
  const played = await finishRace(page);
  noDrs(played.calls);
  await resultsFor(page, 4);
  expect(eras.submissions[0]?.body.decisions).toContainEqual(
    expect.objectContaining({ kind: 'teamOrder', order: 'letTeammatePast' }),
  );
});

test('Era 3: Belgium 1995, refuelling stops in the rain', async ({ page }) => {
  const model = loadEraRace('belgium-1995');
  expect(model.rules?.refuelling).toBe(true);
  const eras = await mockEras(page, [model]);
  await openRace(page, 'belgium-1995');
  const played = await playRace(page);
  noDrs(played.calls);
  // Not an Era 1-2 race: team radio, not the pit board.
  for (const tag of played.moments.values()) expect(tag).toMatch(/^Engineer · /);
  await resultsFor(page, 3);
  for (const p of eras.submissions[0]?.body.decisions.filter((d) => d.kind === 'pit') ?? [])
    expect(p.fill).toBeDefined();
});

test('Era 2: Hungary 1992, reconstructed, on the pit board; then the leaderboard and the history book', async ({
  page,
}) => {
  const model = loadEraRace('hungary-1992');
  expect(model.provenance?.kind).toBe('reconstructed');
  await mockEras(page, [model]);
  await page.goto('/eras/2');
  const card = page.getByRole('article').filter({ hasText: 'Hungary 1992' });
  await expect(card.getByText('Reconstructed', { exact: true })).toBeVisible();
  await openRace(page, 'hungary-1992');
  await expect(page.getByText('Reconstructed', { exact: true })).toBeVisible();
  const played = await playRace(page);
  expect(played.moments.size).toBeGreaterThan(0);
  for (const tag of played.moments.values()) expect(tag).toMatch(/^Pit board · /);
  noDrs(played.calls);
  const stars = await resultsFor(page, 2);
  await expect(stars).toContainText('History rewritten');

  await page.getByRole('link', { name: 'Leaderboard', exact: true }).click();
  await expect(page).toHaveURL(/\/eras\/2\/hungary-1992\/leaderboard$/);
  await expect(page.getByTestId('me-line')).toContainText('Your rank:');
  await expect(page.getByTestId('me-line')).toContainText('of 4');
  await noSidewaysScroll(page);

  await page.goto('/eras/history');
  await expect(page.getByRole('heading', { name: 'History book' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Hungary 1992' })).toBeVisible();
  await noSidewaysScroll(page);
});

test('Era 1: Monaco 1988, the avoidable storyline retirement, repeated then avoided', async ({
  page,
}) => {
  const model = loadEraRace('monaco-1988');
  expect(model.eras?.storylineRetirements?.[0]).toMatchObject({ driver: 'SENA' });
  const eras = await mockEras(page, [model], {
    // The server's ★1: Senna wins only if he's still running.
    result: (_id, sub) =>
      !sub.body.decisions.some((d) => d.kind === 'radio' && d.optionId === 'push'),
  });
  await openRace(page, 'monaco-1988');
  // Senna's real call: push from lap 40 and keep pushing. He crashes out on his real lap.
  const repeated = await playRace(page, {
    answer: (lap) => (lap === 40 ? ['PUSH'] : lap === 48 ? ['STAY OUT'] : ['Hold the pace']),
    // And no pace call on the pit board takes him off it.
    quick: (text) =>
      /How do we run it/.test(text)
        ? 'Push'
        : /save the tyres/.test(text)
          ? 'Keep the pace'
          : undefined,
  });
  for (const tag of repeated.moments.values()) expect(tag).toMatch(/^Pit board · /);
  const crashed = (await raceNotes(page)).filter((n) => n.kind === 'storyline');
  expect(crashed).toEqual([expect.objectContaining({ driver: 'SENA', detail: 'retired' })]);
  await resultsFor(page, 1);

  // A new attempt, saving the car instead: he's still running at the flag.
  await page.getByRole('button', { name: 'New attempt' }).click();
  await expect(page.getByRole('button', { name: 'Start the race' })).toBeVisible({
    timeout: 30_000,
  });
  await playRace(page, {
    answer: (lap) => (lap === 40 ? ['EASY - save the car'] : lap === 48 ? ['STAY OUT'] : undefined),
  });
  const avoided = (await raceNotes(page)).filter((n) => n.kind === 'storyline');
  expect(avoided).toEqual([expect.objectContaining({ driver: 'SENA', detail: 'avoided' })]);
  await resultsFor(page, 1);
  expect(eras.starts).toHaveLength(2);
  expect(eras.submissions).toHaveLength(2);
});

// Found by this suite (step 10.1, fixed in A1): San Marino 2005's one-stop race plan filled to
// the flag ({ laps: 41 }), more than a 2005 tank holds, so checkFill threw, no plan was graded
// and the submit failed ("Can’t reach the server."). The planner now caps a fill at the tank.
test('Era 5: San Marino 2005’s plans are graded and the attempt is scored', async ({ page }) => {
  const eras = await mockEras(page, [loadEraRace('san-marino-2005')]);
  await openRace(page, 'san-marino-2005');
  await playRace(page);
  expect(eras.submissions).toHaveLength(1);
});

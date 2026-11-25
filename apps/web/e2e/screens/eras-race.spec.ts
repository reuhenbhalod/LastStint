// An Eras race (/eras/:n/:race, from the start to the flag), every call and control on the race
// screen in an Eras race (docs/test-suite-spec.md S3, D7): the race plan (each plan, your own),
// the top bar (speed, radio sound, the decision timer, home), the views (stats or the phone's
// tabs, follow car, the plan), every car's details, the team radio (box, the headset, team
// orders), a decision (Box, its tyres, Back, a number key), refuelling fills, the pit board of
// Eras 1-2, a car fault, a storyline retirement repeated and avoided, a timed decision running
// out and the untimed opt-out, and a safety car.
//
// The Worker is mocked (e2e/eras.ts). The controls tests hold the laps almost still
// (`lapScale: 100`) so the race stays put while they press; the event tests start the race a
// few laps before its event (`shortRace`) and run it fast. A decision moment only comes up when
// its trigger fires in the race as played, so the tests read the call on screen rather than
// expect a lap.
import type { Locator, Page } from '@playwright/test';
import { expect, test } from '../coverage.js';
import {
  type EraModel,
  type Moment,
  closeTeamRadio,
  finishRace,
  gameDecisions,
  isPhone,
  loadEraRace,
  mockEras,
  raceNotes,
  radioLines,
  radioLog,
  shortRace,
  shownLap,
  startRace,
  teamRadio,
  watchRadio,
} from '../eras.js';

test.describe.configure({ mode: 'parallel' });
test.setTimeout(240_000);

const TURKEY = 'turkey-2021';
/** Laps of 500 s: nothing moves while a test presses. */
const STILL = { lapScale: 100 };

const controls = (page: Page) => page.getByRole('navigation', { name: 'Controls' });
const pill = (page: Page, name: string | RegExp) =>
  controls(page).getByRole('button', { name, exact: typeof name === 'string' });
const decision = (page: Page) => page.getByRole('region', { name: 'Your call' });

/**
 * Press `button` on the call `card`. A call can go before the press lands (a quick call's
 * timer runs out, or the race moves on and takes it away): then there's nothing to press, and
 * false. A press that fails with the card still up is a real failure and throws.
 */
async function pressOn(card: Locator, button: Locator): Promise<boolean> {
  try {
    await button.click({ timeout: 2_000 });
    return true;
  } catch (e) {
    if (await card.isVisible()) throw e;
    return false;
  }
}

/** Open the race at its intro and start it on plan `plan` (default A), without waiting on
 * the grades (which pick the engineer's plan once in). */
async function raceOn(page: Page, path: string, plan = 'A') {
  await page.goto(path);
  await page.getByRole('button', { name: /^Start the race/ }).click();
  const plans = page.getByRole('region', { name: 'Race plan' });
  await plans.getByRole('button', { name: new RegExp(`^${plan} · `) }).click();
  await plans.getByRole('button', { name: `Go with plan ${plan}` }).click();
  await expect(plans).toHaveCount(0);
}

/** Answer whatever holds the race other than a decision: a quick or battle call (its last
 * option, after a fuel fill if it asks), a planned stop (as planned), a new plan (keep ours).
 * True if something was answered. */
async function answerOthers(page: Page): Promise<boolean> {
  const quick = page.locator('section[aria-label="Quick call"], section[aria-label="Battle call"]');
  if (await quick.first().isVisible()) {
    const call = quick.first();
    const fill = call.getByRole('group', { name: 'Fuel fill' });
    if (await fill.isVisible()) await pressOn(call, fill.getByRole('button').first());
    await pressOn(call, call.getByRole('button').last());
    return true;
  }
  const planned = page.getByRole('region', { name: 'Planned stop' });
  if (await planned.isVisible()) {
    await pressOn(planned, planned.getByRole('button', { name: 'Box as planned' }));
    return true;
  }
  const replan = page.getByRole('region', { name: 'New plan' });
  if (await replan.isVisible()) {
    await pressOn(replan, replan.getByRole('button', { name: 'Keep ours' }));
    return true;
  }
  return false;
}

/** Answer everything that holds the race (a decision: its first option) until nothing has
 * for a moment. */
async function settle(page: Page) {
  let quiet = 0;
  while (quiet < 3) {
    const card = decision(page);
    if (await card.isVisible()) {
      await pressOn(card, card.getByRole('button').first());
      quiet = 0;
    } else if (await answerOthers(page)) quiet = 0;
    else quiet += 1;
    await page.waitForTimeout(100);
  }
}

/** Run the race (answering everything else) until a decision is up: its lap and moment. */
async function nextDecision(page: Page, model: EraModel, after = 0) {
  const card = decision(page);
  const deadline = Date.now() + 90_000;
  for (;;) {
    expect(Date.now(), 'a decision comes up').toBeLessThan(deadline);
    if (await card.isVisible()) {
      const tag =
        (await card
          .getByRole('alert')
          .textContent()
          .catch(() => '')) ?? '';
      const lap = Number(tag.match(/Lap (\d+)$/)?.[1] ?? 0);
      if (lap > after) {
        const moment = model.decisionMoments.find((m) => m.lap === lap) as Moment;
        expect(moment, `a moment on lap ${lap}`).toBeDefined();
        return { lap, tag, moment };
      }
    }
    if (!(await answerOthers(page))) await page.waitForTimeout(100);
  }
}

/** The calls answered so far (radio decisions). */
const answered = async (page: Page) =>
  (await gameDecisions(page)).filter((d) => d.kind === 'radio');

/** Press `control` and expect its aria-pressed to flip. */
async function toggles(control: Locator) {
  const before = await control.getAttribute('aria-pressed');
  await control.click();
  await expect(control).toHaveAttribute('aria-pressed', before === 'true' ? 'false' : 'true');
}

test('the race plan: each of the engineer’s plans, then your own', async ({ page }) => {
  await mockEras(page, [loadEraRace(TURKEY)], STILL);
  await page.goto(`/eras/9/${TURKEY}`);
  await page.getByRole('button', { name: 'Start the race' }).click();
  const plans = page.getByRole('region', { name: 'Race plan' });
  await expect(plans).toBeVisible();
  await expect(plans).toContainText('Race plan · lap 39 of 58');
  const go = plans.getByRole('button', { name: /^Go with/ });
  // Graded: the engineer picks one (selected until you pick), and each card picks its plan.
  await expect(plans).not.toContainText('…', { timeout: 90_000 });
  const pick = plans.getByRole('button', { name: /engineer’s pick/i });
  await expect(pick).toHaveCount(1);
  const pickId = ((await pick.textContent()) ?? '').charAt(0);
  await expect(go).toHaveText(`Go with plan ${pickId}`);
  for (const id of ['B', 'C', 'A']) {
    const card = plans.getByRole('button', { name: new RegExp(`^${id} · `) });
    await card.click();
    await expect(card).toHaveAttribute('aria-pressed', 'true');
    await expect(go).toHaveText(`Go with plan ${id}`);
  }
  // Your own, from the picked plan; and back to the engineer's.
  await plans.getByRole('button', { name: 'Build your own' }).click();
  await expect(go).toHaveText('Go with your plan');
  await plans.getByRole('button', { name: 'The engineer’s plans' }).click();
  await expect(plans.getByRole('button', { name: /^A · / })).toBeVisible();
  // Your own from B (one stop): move the stop, its tyres and pace, add a stop and remove one.
  await plans.getByRole('button', { name: /^B · One stop/ }).click();
  await plans.getByRole('button', { name: 'Build your own' }).click();
  const stop = plans.getByRole('slider', { name: 'Stop 1 lap' });
  const lap = Number(await stop.inputValue());
  await plans.getByRole('button', { name: 'Later' }).click();
  await expect(stop).toHaveValue(String(lap + 1));
  await plans.getByRole('button', { name: 'Earlier' }).click();
  await expect(stop).toHaveValue(String(lap));
  await stop.fill(String(lap + 2));
  await expect(stop).toHaveValue(String(lap + 2));
  const other = plans
    .getByRole('button', { name: /^(softs|mediums|hards|inters|wets)$/ })
    .and(page.locator('[aria-pressed="false"]'))
    .last();
  const otherName = (await other.getAttribute('aria-label')) ?? '';
  await other.click();
  await expect(plans.getByRole('button', { name: otherName }).last()).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  // The stint's pace: one of three, pressed (B's last stint pushes).
  const manage = plans.getByRole('button', { name: 'Manage', exact: true }).last();
  await manage.click();
  await expect(manage).toHaveAttribute('aria-pressed', 'true');
  await expect(plans.getByRole('button', { name: 'Push', exact: true }).last()).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  const sliders = await plans.getByRole('slider').count();
  const add = plans.getByRole('button', { name: '+ Add a stop' });
  const added = await add.isEnabled();
  if (added) {
    await add.click();
    await expect(plans.getByRole('slider')).toHaveCount(sliders + 1);
  }
  await plans.getByRole('button', { name: 'Remove' }).last().click();
  await expect(plans.getByRole('slider')).toHaveCount(added ? sliders : sliders - 1);
  if (!added) await add.click(); // back to a plan that stops
  // Graded a moment after the last change, then it goes.
  await expect(go).toBeEnabled({ timeout: 60_000 });
  await go.click();
  await expect(plans).toHaveCount(0);
  expect((await gameDecisions(page)).find((d) => d.kind === 'plan')).toMatchObject({ id: 'own' });
  await expect(pill(page, /^Plan · /)).toBeVisible();
});

test('the top bar: speed, radio sound, the decision timer and home', async ({ page }) => {
  await mockEras(page, [loadEraRace(TURKEY)], STILL);
  await raceOn(page, `/eras/9/${TURKEY}`);
  const one = page.getByRole('button', { name: '1×' });
  const two = page.getByRole('button', { name: '2×' });
  await expect(one).toHaveAttribute('aria-pressed', 'true');
  await two.click();
  await expect(two).toHaveAttribute('aria-pressed', 'true');
  await expect(one).toHaveAttribute('aria-pressed', 'false');
  await one.click();
  await expect(one).toHaveAttribute('aria-pressed', 'true');

  // The decision timer: on by default; off is kept on this device.
  const timer = page.getByRole('button', { name: 'Timer on' });
  await expect(timer).toHaveAttribute('aria-pressed', 'true');
  await timer.click();
  const off = page.getByRole('button', { name: 'Timer off' });
  await expect(off).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => localStorage.getItem('pitwall.decisionTimer'))).toBe('off');
  await off.click();
  await expect(page.getByRole('button', { name: 'Timer on' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('pitwall.decisionTimer'))).toBe('on');

  if (isPhone(page)) {
    // The phone keeps the bar short: no sound toggle and no brand button in it.
    await expect(page.getByRole('button', { name: /^Radio sound/ })).toBeHidden();
    await expect(page.getByRole('button', { name: /^LastStint/ })).toBeHidden();
    return;
  }
  const sound = page.getByRole('button', { name: /^Radio sound (on|off)$/ });
  const was = await sound.getAttribute('aria-pressed');
  await sound.click();
  await expect(sound).toHaveAttribute('aria-pressed', was === 'true' ? 'false' : 'true');
  await expect(sound).toHaveAccessibleName(was === 'true' ? 'Radio sound off' : 'Radio sound on');
  await sound.click();
  await expect(sound).toHaveAttribute('aria-pressed', was ?? 'false');

  // The brand: home is the era (the race waits).
  await page.getByRole('button', { name: /^LastStint.*race engineer/ }).click();
  await expect(page).toHaveURL(/\/eras\/9$/);
});

test('the views: stats or the phone’s tabs, follow car and the plan', async ({ page }) => {
  await mockEras(page, [loadEraRace(TURKEY)], STILL);
  await raceOn(page, `/eras/9/${TURKEY}`);
  await answerOthers(page);
  if (isPhone(page)) {
    // One tab open at a time, each its panel in the dock.
    const panels: Array<[string, Locator]> = [
      ['Standings', page.getByRole('button', { name: /LEC(?!:)/ }).first()],
      ['Car', page.getByRole('region', { name: 'Your driver' })],
      ['Calls', page.getByRole('region', { name: 'Your calls' })],
      ['Radio', page.getByRole('navigation', { name: 'Controls' })],
    ];
    let last: Locator | null = null;
    for (const [name, shows] of panels) {
      const tab = pill(page, name);
      await tab.click();
      await expect(tab).toHaveAttribute('aria-pressed', 'true');
      if (last) await expect(last).toHaveAttribute('aria-pressed', 'false');
      await expect(shows).toBeVisible();
      last = tab;
    }
    await pill(page, 'Radio').click();
    await expect(pill(page, 'Radio')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('button', { name: 'Show stats' })).toBeHidden();
  } else {
    const stats = pill(page, 'Show stats');
    await expect(page.getByRole('region', { name: 'Leaders' })).toBeVisible();
    await stats.click();
    const focus = pill(page, 'Focus view');
    await expect(focus).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('region', { name: 'Standings' })).toBeVisible();
    const side = page.getByRole('complementary', { name: 'Stats' });
    await expect(side.getByRole('region', { name: 'Your driver' })).toBeVisible();
    await expect(side.getByRole('region', { name: 'Your calls' })).toBeVisible();
    await expect(side.getByRole('region', { name: 'Radio' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Leaders' })).toHaveCount(0);
    await focus.click();
    await expect(pill(page, 'Show stats')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('region', { name: 'Leaders' })).toBeVisible();
    // The phone's tabs aren't on a computer.
    await expect(pill(page, 'Standings')).toBeHidden();
  }
  // Follow car: the camera moves with your car, kept for the next race on this device.
  const follow = pill(page, 'Follow car');
  await toggles(follow);
  expect(await page.evaluate(() => localStorage.getItem('pitwall.follow-camera'))).toBe('on');
  await toggles(follow);
  expect(await page.evaluate(() => localStorage.getItem('pitwall.follow-camera'))).toBe('off');

  // The plan pill opens the plan: change it, then cancel.
  const plan = pill(page, /^Plan · /);
  await plan.click();
  await expect(plan).toHaveAttribute('aria-pressed', 'true');
  const bar = page.getByRole('region', { name: 'Race plan' });
  await expect(bar).toBeVisible();
  await bar.getByRole('button', { name: 'Change' }).click();
  await expect(bar.getByRole('button', { name: 'Run this plan' })).toBeVisible();
  await bar.getByRole('button', { name: 'Cancel' }).click();
  await expect(bar.getByRole('button', { name: 'Run this plan' })).toHaveCount(0);
  await plan.click();
  await expect(plan).toHaveAttribute('aria-pressed', 'false');
});

test('every car’s details, from the map and the towers', async ({ page }) => {
  await mockEras(page, [loadEraRace(TURKEY)], STILL);
  // On plan C (the other tests go with A or B).
  await raceOn(page, `/eras/9/${TURKEY}`, 'C');
  await answerOthers(page);
  const card = page.getByRole('region', { name: / details$/ });
  const close = page.getByRole('button', { name: 'Close driver details' });
  // Every car on the map (an SVG group: pressed from the keyboard).
  const dots = page.getByRole('button', { name: /^[A-Z]{3,4}: details$/ });
  await expect(dots.first()).toBeVisible();
  const codes = (await dots.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label'))))
    .map((l) => l?.split(':')[0] ?? '')
    .filter(Boolean);
  expect(codes.length).toBeGreaterThanOrEqual(15);
  for (const code of codes) {
    const dot = page.getByRole('button', { name: `${code}: details`, exact: true });
    await dot.focus();
    await page.keyboard.press('Enter');
    await expect(dot).toHaveAttribute('aria-pressed', 'true');
    await expect(card).toBeVisible();
    await close.click();
    await expect(card).toHaveCount(0);
  }
  // Pressing the selected car again closes it too.
  const lec = page.getByRole('button', { name: 'LEC: details', exact: true });
  await lec.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: 'Charles Leclerc details' })).toContainText(
    'Your driver',
  );
  await page.keyboard.press('Enter');
  await expect(card).toHaveCount(0);

  // A row of the leaders (focus view) and, on a computer, of the timing tower (stats view).
  await page.getByRole('region', { name: 'Leaders' }).getByRole('button').first().click();
  await expect(card).toBeVisible();
  await close.click();
  if (isPhone(page)) return; // the phone's standings tab: the next test
  await pill(page, 'Show stats').click();
  await page
    .getByRole('region', { name: 'Standings' })
    .getByRole('button', { name: /HAM/ })
    .click();
  await expect(page.getByRole('region', { name: 'Lewis Hamilton details' })).toContainText('Rival');
});

test('the phone’s standings tab: a row opens that driver', async ({ page }) => {
  test.skip(!isPhone(page), 'the standings are a tab on a phone only');
  await mockEras(page, [loadEraRace(TURKEY)], STILL);
  await raceOn(page, `/eras/9/${TURKEY}`);
  await answerOthers(page);
  await pill(page, 'Standings').click();
  await page
    .getByRole('button', { name: /HAM(?!:)/ })
    .first()
    .click();
  // The driver's card waits for the dock to close.
  await pill(page, 'Standings').click();
  await expect(page.getByRole('region', { name: 'Lewis Hamilton details' })).toContainText('Rival');
});

test('the team radio: the headset (one call a kind a lap), team orders and a box call', async ({
  page,
}) => {
  await mockEras(page, [loadEraRace(TURKEY)], STILL);
  await raceOn(page, `/eras/9/${TURKEY}`);
  await answerOthers(page);
  const radio = await teamRadio(page);
  await expect(pill(page, 'Team radio')).toHaveAttribute('aria-pressed', 'true');
  // Its header folds the panel away and back.
  const header = radio.getByRole('button', { name: /^Team radio/ });
  await expect(header).toHaveAttribute('aria-expanded', 'true');
  await header.click();
  await expect(header).toHaveAttribute('aria-expanded', 'false');
  await expect(radio.getByRole('group', { name: 'Pace' })).toHaveCount(0);
  await header.click();
  await expect(header).toHaveAttribute('aria-expanded', 'true');

  // The headset: a mode per row, booked for the coming lap (and shown in the header).
  const mode = (group: string, value: string) =>
    radio.getByRole('group', { name: group }).getByRole('button', { name: value, exact: true });
  for (const [group, value] of [
    ['Pace', 'push'],
    ['Battle', 'attack'],
    ['ERS', 'overtake'],
    ['Fuel', 'Lift & coast'],
  ] as const) {
    await mode(group, value).click();
    await expect(mode(group, value)).toHaveAttribute('aria-pressed', 'true');
  }
  // One call of a kind a lap: a second pace call this lap is refused.
  await mode('Pace', 'manage').click();
  await expect(mode('Pace', 'manage')).toHaveAttribute('aria-pressed', 'false');
  await expect(mode('Pace', 'push')).toHaveAttribute('aria-pressed', 'true');
  const modes = (await gameDecisions(page)).filter((d) => d.kind === 'mode');
  expect(modes.map((d) => `${d.key}:${d.value}`).sort()).toEqual([
    'battle:attack',
    'ers:overtake',
    'fuel:liftAndCoast',
    'pace:push',
  ]);

  // Team orders with Sainz.
  await expect(radio.getByText('Team orders · Sainz')).toBeVisible();
  // Each order is booked for the coming lap (the hold-up's Release shows once it's run: the
  // headset test over several laps), one order a lap: the first one stands.
  await radio.getByRole('button', { name: 'Hold up Hamilton' }).click();
  await radio.getByRole('button', { name: 'Sainz lets you by' }).click();
  await radio.getByRole('button', { name: 'Let Sainz by' }).click();
  const orders = (await gameDecisions(page)).filter((d) => d.kind === 'teamOrder');
  expect(orders.map((d) => d.order)).toEqual(['holdUp']);

  // Box: a tyre pressed, and the stop shows as under way.
  // (Turkey 2021 is wet: no two-compound rule, so its two dry tyres both read "Dry". A bug:
  // see the fixme below.)
  const tyre = radio.getByRole('button', { name: /(Dry|Softs|Mediums|Hards|Inters|Wets)$/ });
  await tyre.first().click();
  await expect(radio).toContainText(/· boxing (this|next) lap/);
  const pits = (await gameDecisions(page)).filter((d) => d.kind === 'pit');
  expect(pits).toHaveLength(1);
  await expect(header).toContainText('Boxing · ');
  // One stop at a time: the tyre buttons give way to the stop under way.
  await expect(tyre).toHaveCount(0);
  await closeTeamRadio(page);
  await expect(pill(page, 'Team radio')).toHaveAttribute('aria-pressed', 'false');
});

// Found by this suite: in a race with no two-compound rule (a wet 2021 race, turkey-2021, the
// only such Eras race) every dry tyre reads "Dry" (raceRules.ts `tyres: 'single-dry'` follows
// `twoCompound`, meant for the one-tyre years before 2007). The team radio then shows two
// "D Dry" buttons, softs and hards, that look and read the same; the decision card on the same
// screen says "Softs" and "Hards". Owner call: key the single-dry look on the race offering one
// dry tyre (pre-2007 races do; the raceRules unit test builds a 2005 race from a modern file).
test.fixme('every tyre the team radio offers has its own name', async ({ page }) => {
  await mockEras(page, [loadEraRace(TURKEY)], STILL);
  await raceOn(page, `/eras/9/${TURKEY}`);
  const radio = await teamRadio(page);
  const names = await radio
    .getByRole('button', { name: /(Dry|Softs|Mediums|Hards|Inters|Wets)$/ })
    .allTextContents();
  expect(new Set(names).size).toBe(names.length);
});

test('the headset over several laps: every mode, and release the hold-up', async ({ page }) => {
  await mockEras(page, [loadEraRace(TURKEY)], { lapScale: 0.3 });
  await raceOn(page, `/eras/9/${TURKEY}`);
  const rounds = [
    ['manage', 'defend', 'harvest', 'normal'],
    ['standard', 'hold', 'deploy', null],
    [null, null, 'balanced', null],
  ] as const;
  const groups = ['Pace', 'Battle', 'ERS', 'Fuel'] as const;
  let lap = await shownLap(page);
  for (const [r, round] of rounds.entries()) {
    await settle(page);
    const radio = await teamRadio(page);
    for (const [i, value] of round.entries()) {
      if (!value) continue;
      const b = radio
        .getByRole('group', { name: groups[i] })
        .getByRole('button', { name: value, exact: true });
      await b.click();
      await expect(b).toHaveAttribute('aria-pressed', 'true');
    }
    if (r === 0) await radio.getByRole('button', { name: 'Hold up Hamilton' }).click();
    if (r === 1) await radio.getByRole('button', { name: 'Release Hamilton' }).click();
    // On to the next lap (anything that holds the race answered on the way).
    const from = lap;
    while (lap <= from) {
      await settle(page);
      lap = await shownLap(page);
    }
  }
  const sent = (await gameDecisions(page)).filter((d) => d.kind === 'mode');
  for (const v of [
    'manage',
    'standard',
    'defend',
    'hold',
    'harvest',
    'deploy',
    'balanced',
    'normal',
  ])
    expect(sent.map((d) => d.value)).toContain(v);
  expect(
    (await gameDecisions(page)).filter((d) => d.kind === 'teamOrder').map((d) => d.order),
  ).toEqual(expect.arrayContaining(['holdUp', 'release']));
});

test('a decision: Box opens the tyres, Back, then a tyre; the next by its number key', async ({
  page,
}) => {
  const model = loadEraRace(TURKEY);
  await mockEras(page, [model], { lapScale: 0.1 });
  await raceOn(page, `/eras/9/${TURKEY}`);
  // Turkey 2021 on plan A (no stop): its lap 43 and 47 calls offer Box on two tyres.
  const card = decision(page);
  const call = await nextDecision(page, model);
  expect(call.moment.id).toBe('stop-43');
  expect(call.tag).toMatch(/^Engineer · .* · Lap 43$/);
  await expect(card.getByRole('timer')).toHaveAccessibleName(
    /^Time to make the call: \d+ seconds$/,
  );
  // The race holds while the call is up, and the bar's panels wait.
  // (Laps of 0.5 s here: two of the timer's seconds going by would be several laps.)
  const lap = await shownLap(page);
  const timerSeconds = async () =>
    Number(
      ((await card.getByRole('timer').getAttribute('aria-label')) ?? '').match(
        /(\d+) seconds/,
      )?.[1],
    );
  const from = await timerSeconds();
  await expect.poll(timerSeconds, { timeout: 10_000 }).toBeLessThanOrEqual(from - 2);
  expect(await shownLap(page)).toBe(lap);
  await expect(pill(page, 'Team radio')).toBeDisabled();
  // Box opens the tyre step; Back closes it; then the number key 1 picks Stay out.
  await expect(card.getByRole('button', { name: 'Stay out' })).toBeVisible();
  await card.getByRole('button', { name: 'Box', exact: true }).click();
  await expect(card).toContainText('Box: which tyres?');
  await expect(card.getByRole('button', { name: 'Stay out' })).toHaveCount(0);
  await card.getByRole('button', { name: 'Back' }).click();
  await expect(card.getByRole('button', { name: 'Stay out' })).toBeVisible();
  await page.keyboard.press('1');
  await expect(card.getByRole('alert').filter({ hasText: 'Lap 43' })).toHaveCount(0);
  expect(await answered(page)).toContainEqual(
    expect.objectContaining({ momentId: 'stop-43', optionId: 'stay' }),
  );

  // Lap 47: Box, then a tyre.
  const next = await nextDecision(page, model, 43);
  expect(next.moment.id).toBe('stop-47');
  await card.getByRole('button', { name: 'Box', exact: true }).click();
  await card.getByRole('button', { name: 'Softs' }).click();
  await expect(card.getByRole('alert').filter({ hasText: 'Lap 47' })).toHaveCount(0);
  expect(await answered(page)).toContainEqual(
    expect.objectContaining({ momentId: 'stop-47', optionId: 'box-soft' }),
  );
});

test('a timed call runs out to the default; with the timer off nothing runs out, untimed', async ({
  page,
}) => {
  const model = loadEraRace(TURKEY);
  const eras = await mockEras(page, [model], {
    lapScale: 0.1,
    difficulty: () => ({
      accuracyThreshold: 70,
      information: 'full',
      rivalPolicy: 'standard',
      decisionTimerSeconds: 3,
    }),
  });
  await raceOn(page, `/eras/9/${TURKEY}`);
  const first = await nextDecision(page, model);
  const card = decision(page);
  // No answer: the seconds count down, then the wall takes the default.
  await expect(card.getByRole('timer')).toHaveAccessibleName(/[0-2] seconds$/);
  await expect(card.getByRole('alert').filter({ hasText: `Lap ${first.lap}` })).toHaveCount(0, {
    timeout: 10_000,
  });
  expect((await radioLines(page)).map((r) => r.text)).toContainEqual(
    expect.stringMatching(/^Out of time, no call from the wall\./),
  );
  expect(await answered(page)).toContainEqual(
    expect.objectContaining({ momentId: first.moment.id }),
  );
  // The opt-out: no call shows a timer from here, and the calls wait as long as they take.
  await page.getByRole('button', { name: 'Timer on' }).click();
  await expect(page.getByRole('button', { name: 'Timer off' })).toBeVisible();
  let untimedCards = 0;
  const played = await finishRace(page, {
    each: async () => {
      if (await card.isVisible()) {
        await expect(card.getByRole('timer')).toHaveCount(0);
        untimedCards += 1;
      }
    },
  });
  // A decision was up with the timer off (so the check above ran on a card).
  expect(untimedCards, 'a decision card seen with the timer off').toBeGreaterThan(0);
  // A call shown with the timer off (a decision or a quick call) marks the attempt untimed.
  expect(played.moments.size + played.calls.length).toBeGreaterThan(1);
  expect(eras.submissions[0]?.body.untimed).toBe(true);
  await expect(page.getByRole('region', { name: 'Stars' })).toContainText(
    'Untimed: the decision timer was off, so these stars are marked untimed.',
  );
});

test('refuelling (Era 4): the box call waits for a fill, and the stop carries it', async ({
  page,
}) => {
  const model = loadEraRace('austria-2001');
  expect(model.rules?.refuelling).toBe(true);
  await mockEras(page, [model], STILL);
  // Plan B: its stop is on lap 51, so none is under way yet.
  await raceOn(page, '/eras/4/austria-2001', 'B');
  const radio = await teamRadio(page);
  await expect(radio.getByRole('meter', { name: /^Fuel to / })).toBeVisible();
  const tyre = radio.getByRole('button', { name: /(Dry|Softs|Mediums|Hards)$/ }).first();
  await expect(tyre).toBeDisabled();
  await expect(radio).toContainText('Pick a fuel fill, then the tyres.');
  const fills = radio.getByRole('group', { name: 'Fuel fill' });
  await expect(fills.getByRole('button')).toHaveCount(3);
  for (const name of ['Short', 'Standard', 'Long']) {
    const fill = fills.getByRole('button', { name: new RegExp(`^${name}`) });
    await fill.click();
    await expect(fill).toHaveAttribute('aria-pressed', 'true');
  }
  await expect(tyre).toBeEnabled();
  await tyre.click();
  await expect(radio).toContainText('boxing');
  expect((await gameDecisions(page)).filter((d) => d.kind === 'pit')).toContainEqual(
    expect.objectContaining({ fill: 'long' }),
  );
});

test('refuelling: the plan editor asks each stop’s fill', async ({ page }) => {
  await mockEras(page, [loadEraRace('austria-2001')], STILL);
  await page.goto('/eras/4/austria-2001');
  await page.getByRole('button', { name: 'Start the race' }).click();
  const plans = page.getByRole('region', { name: 'Race plan' });
  await plans.getByRole('button', { name: 'Build your own' }).click();
  const fill = plans.getByRole('group', { name: 'Stop 1 fuel fill' });
  await expect(fill).toBeVisible();
  // Short, Standard, Long.
  await expect(fill.getByRole('button')).toHaveCount(3);
  for (const b of await fill.getByRole('button').all()) {
    await b.click();
    await expect(b).toHaveAttribute('aria-pressed', 'true');
  }
});

test('the pit board (Era 2): every call reads as a board, each answered', async ({ page }) => {
  // Monaco 1992: ten laps from the takeover.
  const model = loadEraRace('monaco-1992');
  await mockEras(page, [model], { lapScale: 0.1 });
  await raceOn(page, '/eras/2/monaco-1992');
  const card = decision(page);
  const done = page.getByRole('button', { name: 'See how you did' });
  let after = 0;
  const seen: string[] = [];
  while (!(await done.isVisible())) {
    if (!(await card.isVisible())) {
      if (!(await answerOthers(page))) await page.waitForTimeout(100);
      continue;
    }
    const call = await nextDecision(page, model, after);
    after = call.lap;
    expect(call.tag).toMatch(/^Pit board · .* · Lap \d+$/);
    // Its last option (one that boxes folds into the IN button: then the first).
    const last = card.getByRole('button', { name: call.moment.options.at(-1)?.label, exact: true });
    await ((await last.isVisible()) ? last : card.getByRole('button').first()).click();
    await expect(card.getByRole('alert').filter({ hasText: `Lap ${call.lap}` })).toHaveCount(0);
    seen.push(call.moment.id);
  }
  expect(seen.length).toBeGreaterThan(0);
  expect((await answered(page)).map((d) => d.momentId)).toEqual(expect.arrayContaining(seen));
});

test('a car fault (Brazil 2019): the contact damage on its lap, on the radio', async ({ page }) => {
  await mockEras(page, [shortRace(loadEraRace('brazil-2019'), 3)], { lapScale: 0.2 });
  await raceOn(page, '/eras/8/brazil-2019');
  const hit = 'Something’s wrong with the car!';
  const radio = watchRadio(page, [hit]);
  await finishRace(page, { each: radio.each });
  expect(radio.seen.get(hit), 'the fault line in the radio log').toMatch(/^L70 · Hamilton/);
  expect((await raceNotes(page)).filter((n) => n.kind === 'fault')).toContainEqual(
    expect.objectContaining({ driver: 'HAM', lap: 70, detail: 'damage' }),
  );
});

// Monaco 1988: Senna crashes out if he keeps pushing from lap 55, as he really did. The race
// starts on lap 56 here, with the call that decides it still to make.
const MONACO_88 = () => shortRace(loadEraRace('monaco-1988'), 22);
const optionLike = (m: Moment | undefined, re: RegExp) => m?.options.find((o) => re.test(o.label));

test('a storyline retirement, repeated: push on and Senna crashes out', async ({ page }) => {
  const model = MONACO_88();
  await mockEras(page, [model], { lapScale: 0.1 });
  await raceOn(page, '/eras/1/monaco-1988');
  const radio = await teamRadio(page);
  await radio.getByRole('group', { name: 'Pace' }).getByRole('button', { name: 'push' }).click();
  await closeTeamRadio(page);
  const stopped = 'has stopped. That’s our race.';
  const log = watchRadio(page, [stopped]);
  await finishRace(page, {
    each: log.each,
    answer: (lap) => {
      const m = model.decisionMoments.find((x) => x.lap === lap);
      const push = optionLike(m, /^PUSH/) ?? optionLike(m, /^STAY OUT/);
      return push ? [push.label] : undefined;
    },
    quick: (text) =>
      /How do we run it/.test(text) ? 'Push' : /save/.test(text) ? 'Keep' : undefined,
  });
  const notes = (await raceNotes(page)).filter((n) => n.kind === 'storyline');
  expect(notes).toEqual([expect.objectContaining({ driver: 'SENA', detail: 'retired' })]);
  expect(log.seen.get(stopped)).toMatch(/Pit wall/);
});

test('a storyline retirement, avoided: easy, and Senna is still running', async ({ page }) => {
  const model = MONACO_88();
  await mockEras(page, [model], { lapScale: 0.1 });
  // Every plan offered pushes to the flag (Senna's real call): your own, at standard pace.
  await page.goto('/eras/1/monaco-1988');
  await page.getByRole('button', { name: 'Start the race' }).click();
  const plans = page.getByRole('region', { name: 'Race plan' });
  await plans.getByRole('button', { name: /^A · No stop/ }).click();
  await plans.getByRole('button', { name: 'Build your own' }).click();
  const standard = plans.getByRole('button', { name: 'Standard', exact: true }).first();
  await standard.click();
  await expect(standard).toHaveAttribute('aria-pressed', 'true');
  await plans.getByRole('button', { name: 'Go with your plan' }).click({ timeout: 90_000 });
  await page.getByRole('button', { name: '2×' }).click();
  const log = radioLog(page);
  await finishRace(page, {
    each: log.read,
    answer: (lap) => {
      const m = model.decisionMoments.find((x) => x.lap === lap);
      const easy = optionLike(m, /^EASY/) ?? optionLike(m, /lift and coast/i);
      return easy ? [easy.label] : undefined;
    },
  });
  const notes = (await raceNotes(page)).filter((n) => n.kind === 'storyline');
  expect(notes).toEqual([expect.objectContaining({ driver: 'SENA', detail: 'avoided' })]);
  // An avoided retirement is a race that goes on: the pit wall says nothing of it.
  expect((await log.lines()).filter((l) => l.from === 'Pit wall')).toEqual([]);
});

test('a safety car (Great Britain 2023): flagged on the map, and the call it brings', async ({
  page,
}) => {
  const model = loadEraRace('great-britain-2023');
  await mockEras(page, [model], { lapScale: 0.2 });
  await raceOn(page, '/eras/10/great-britain-2023');
  const flag = page
    .getByRole('region', { name: 'Race' })
    .getByText(/^(Safety car|Virtual safety car)$/);
  const deadline = Date.now() + 90_000;
  while (!(await flag.first().isVisible())) {
    expect(Date.now(), 'the safety car comes out').toBeLessThan(deadline);
    if (await decision(page).isVisible()) await decision(page).getByRole('button').first().click();
    else if (!(await answerOthers(page))) await page.waitForTimeout(100);
  }
  const call = await nextDecision(page, model);
  expect(call.moment.id).toMatch(/^(sc|battle)-/);
  await decision(page).getByRole('button').first().click();
  expect(await answered(page)).toContainEqual(
    expect.objectContaining({ momentId: call.moment.id }),
  );
});

/** The plan the car is running (through the test hook): its stops. */
const activeStops = (page: Page) =>
  page.evaluate(
    () =>
      (
        window as unknown as {
          __laststintE2E?: {
            session?: {
              state: {
                plan: { active: { stops: Array<{ lap: number; compound: string }> } | null };
              };
            };
          };
        }
      ).__laststintE2E?.session?.state.plan.active?.stops ?? [],
  );

/** Run the race (decisions: their first option) until the planned stop's heads-up is up. */
async function toHeadsUp(page: Page) {
  const planned = page.getByRole('region', { name: 'Planned stop' });
  const deadline = Date.now() + 90_000;
  while (!(await planned.isVisible())) {
    expect(Date.now(), 'the planned stop comes up').toBeLessThan(deadline);
    const card = decision(page);
    if (await card.isVisible()) {
      // Stay out (the first option): the plan's own stop is what this test is after.
      await pressOn(card, card.getByRole('button').first());
      continue;
    }
    const quick = page.locator(
      'section[aria-label="Quick call"], section[aria-label="Battle call"]',
    );
    if (await quick.first().isVisible()) {
      // Never box from a quick call here: the last option keeps the plan.
      await pressOn(quick.first(), quick.first().getByRole('button').last());
      continue;
    }
    const replan = page.getByRole('region', { name: 'New plan' });
    if (await replan.isVisible()) {
      await pressOn(replan, replan.getByRole('button', { name: 'Keep ours' }));
      continue;
    }
    await page.waitForTimeout(100);
  }
  return planned;
}

/** The car's tyres now (through the test hook). */
const myTyres = (page: Page, side: string) =>
  page.evaluate(
    (code) =>
      (
        window as unknown as {
          __laststintE2E?: {
            session?: {
              state: { race: { cars: Record<string, { compound: string; tyreAge: number }> } };
            };
          };
        }
      ).__laststintE2E?.session?.state.race.cars[code],
    side,
  );

/** Start Turkey 2021 on your own plan: B's one stop, moved to lap `lap`. */
async function ownStopAt(page: Page, lap: number) {
  await page.goto(`/eras/9/${TURKEY}`);
  await page.getByRole('button', { name: 'Start the race' }).click();
  const plans = page.getByRole('region', { name: 'Race plan' });
  await plans.getByRole('button', { name: /^B · One stop/ }).click();
  await plans.getByRole('button', { name: 'Build your own' }).click();
  const stop = plans.getByRole('slider', { name: 'Stop 1 lap' });
  await stop.fill(String(lap));
  await expect(stop).toHaveValue(String(lap));
  const go = plans.getByRole('button', { name: 'Go with your plan' });
  await expect(go).toBeEnabled({ timeout: 60_000 });
  await go.click();
  await expect(plans).toHaveCount(0);
  expect((await activeStops(page))[0]?.lap).toBe(lap);
}

test('the planned stop: One more lap moves it, then Box as planned makes it', async ({ page }) => {
  const model = loadEraRace(TURKEY);
  await mockEras(page, [model], { lapScale: 0.1 });
  await ownStopAt(page, 50);
  // The plan pill names the coming stop, and opens the plan.
  const plan = pill(page, 'Plan · box L50');
  await plan.click();
  await expect(plan).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('region', { name: 'Race plan' })).toBeVisible();
  await plan.click();
  await expect(plan).toHaveAttribute('aria-pressed', 'false');
  let planned = await toHeadsUp(page);
  await expect(planned).toContainText('as planned. Still good?');
  // One more lap: the stop goes a lap later, and the heads-up comes again before it.
  await planned.getByRole('button', { name: 'One more lap' }).click();
  await expect(planned).toHaveCount(0);
  expect((await activeStops(page))[0]?.lap).toBe(51);
  await expect(pill(page, 'Plan · box L51')).toBeVisible();
  planned = await toHeadsUp(page);
  // Box as planned: the stop stays where it is, and is made on its lap.
  const { compound } = (await activeStops(page))[0] ?? { compound: '' };
  await planned.getByRole('button', { name: 'Box as planned' }).click();
  await expect(planned).toHaveCount(0);
  expect((await activeStops(page))[0]?.lap).toBe(51);
  await expect
    .poll(async () => (await myTyres(page, model.userSide))?.compound, { timeout: 60_000 })
    .toBe(compound);
});

test('the planned stop: Change plan opens the plan editor', async ({ page }) => {
  await mockEras(page, [loadEraRace(TURKEY)], { lapScale: 0.1 });
  await ownStopAt(page, 50);
  const planned = await toHeadsUp(page);
  await planned.getByRole('button', { name: 'Change plan' }).click();
  await expect(planned).toHaveCount(0);
  const bar = page.getByRole('region', { name: 'Race plan' });
  await expect(bar.getByRole('button', { name: 'Run this plan' })).toBeVisible();
  await expect(pill(page, /^Plan · /)).toHaveAttribute('aria-pressed', 'true');
});

/**
 * Every call of a race answered in turn: the n-th call (a decision, a quick or battle call)
 * gets its option n (mod its options), so over a race each kind of answer is pressed; a new
 * plan is switched to, the next one kept, in turn. Returns what was pressed.
 */
async function playInTurn(page: Page, model: EraModel) {
  const done = page.getByRole('button', { name: 'See how you did' });
  const card = decision(page);
  const calls = page.locator('section[aria-label="Quick call"], section[aria-label="Battle call"]');
  const planned = page.getByRole('region', { name: 'Planned stop' });
  const replan = page.getByRole('region', { name: 'New plan' });
  const nameOf = (b: Locator) =>
    b.evaluate((e) => (e.getAttribute('aria-label') ?? e.textContent ?? '').trim());
  const pressed = {
    decisions: [] as Array<{ lap: number; label: string }>,
    calls: [] as string[],
    switched: 0,
    changed: 0,
    kept: 0,
  };
  let n = 0;
  const deadline = Date.now() + 200_000;
  while (!(await done.isVisible())) {
    expect(Date.now(), 'the race reaches the flag').toBeLessThan(deadline);
    if (await card.isVisible()) {
      const tag =
        (await card
          .getByRole('alert')
          .textContent()
          .catch(() => '')) ?? '';
      const lap = Number(tag.match(/Lap (\d+)$/)?.[1] ?? 0);
      // The tyre step after a Box: one of its tyres, in turn (never Back).
      const buttons = card.getByRole('button').filter({ hasNotText: /^Back$/ });
      const count = await buttons.count();
      if (!count) continue;
      const b = buttons.nth(n % count);
      const label = await nameOf(b).catch(() => '');
      if (await pressOn(card, b)) {
        if (!/^Box$/.test(label)) {
          pressed.decisions.push({ lap, label });
          n += 1;
        }
      }
      continue;
    }
    const call = calls.first();
    if (await call.isVisible()) {
      const fills = call.getByRole('group', { name: 'Fuel fill' });
      if (await fills.isVisible()) {
        const f = fills.getByRole('button');
        await pressOn(call, f.nth(n % (await f.count())));
      }
      // Its answers (not the fills), those it takes now.
      const answers = call.locator(
        'xpath=.//button[not(ancestor::*[@aria-label="Fuel fill"]) and not(@disabled)]',
      );
      const count = await answers.count();
      if (count > 0) {
        const b = answers.nth(n % count);
        const label = await nameOf(b).catch(() => '');
        if (await pressOn(call, b)) {
          pressed.calls.push(label);
          n += 1;
        }
      }
      continue;
    }
    if (await planned.isVisible()) {
      await pressOn(planned, planned.getByRole('button', { name: 'Box as planned' }));
      continue;
    }
    if (await replan.isVisible()) {
      const before = JSON.stringify(await activeStops(page));
      if ((pressed.switched + pressed.kept) % 2 === 0) {
        if (await pressOn(replan, replan.getByRole('button', { name: 'Switch' }))) {
          pressed.switched += 1;
          // The car runs the new plan (unless its stop was already past: then it's kept).
          await expect(replan).toHaveCount(0);
          if (JSON.stringify(await activeStops(page)) !== before) pressed.changed += 1;
        }
      } else if (await pressOn(replan, replan.getByRole('button', { name: 'Keep ours' }))) {
        pressed.kept += 1;
        await expect(replan).toHaveCount(0);
        expect(JSON.stringify(await activeStops(page))).toBe(before);
      }
      continue;
    }
    await page.waitForTimeout(100);
  }
  // Each decision answered went in as the option pressed.
  const sent = await answered(page);
  for (const d of pressed.decisions) {
    const m = model.decisionMoments.find((x) => x.lap === d.lap);
    const o = m?.options.find((x) => d.label.replace(/^\d/, '') === x.label);
    if (m && o)
      expect(sent).toContainEqual(expect.objectContaining({ momentId: m.id, optionId: o.id }));
  }
  return pressed;
}

// The last number: new plans the engineer offers that are switched to (and run).
for (const [era, id, cut, switched] of [
  [9, TURKEY, 0, 0],
  [10, 'great-britain-2023', 0, 0],
  [2, 'monaco-1992', 0, 1],
  [1, 'monaco-1988', 22, 1],
] as const) {
  test(`every call answered in turn: ${id}`, async ({ page }) => {
    const model = cut ? shortRace(loadEraRace(id), cut) : loadEraRace(id);
    const eras = await mockEras(page, [model], { lapScale: 0.1 });
    await raceOn(page, `/eras/${era}/${id}`);
    const pressed = await playInTurn(page, model);
    expect(pressed.decisions.length + pressed.calls.length).toBeGreaterThan(1);
    // More than one answer of each kind of call pressed over the race.
    expect(new Set(pressed.calls).size).toBeGreaterThan(1);
    expect(pressed.changed).toBeGreaterThanOrEqual(switched);
    await page.getByRole('button', { name: 'See how you did' }).click();
    await expect(page.getByRole('region', { name: 'Stars' })).toBeVisible({ timeout: 90_000 });
    expect(eras.submissions).toHaveLength(1);
    test.info().annotations.push({ type: 'pressed', description: JSON.stringify(pressed) });
  });
}

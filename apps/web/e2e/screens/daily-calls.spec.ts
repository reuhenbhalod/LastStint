// The race engineer's calls between the big moments, and the race's events, on the Daily
// (docs/test-suite-spec.md S3): each quick call, radio reply and battle where a race file
// brings it up (race, lap and options from running each race lap by lap with the big calls'
// first options: screens/daily.ts runTo), what each answer does, a battle left to the driver,
// the rain and wet tyres, a VSC, the stop owed under the two-compound rule, and the rival
// retiring. The Worker is mocked (e2e/mock.ts).
import type { Page } from '@playwright/test';
import { expect, test } from '../coverage.js';
import {
  battleCall,
  calls,
  controls,
  decision,
  fastForward,
  loadRace,
  openDaily,
  openPanel,
  quickCall,
  radio,
  raceWith,
  runTo,
  runToOnClock,
  session,
  startRace,
} from './daily.js';

/** A race on the engineer's pick, run to `lap`: the quick call that comes after it. */
async function callAfter(page: Page, id: string, lap: number) {
  const model = loadRace(id);
  await openDaily(page, model);
  await startRace(page);
  await runTo(page, lap);
  return model;
}

/** The same for a battle: the last lap on the race's clock (its corner depends on it). */
async function battleAfter(page: Page, id: string, lap: number) {
  const model = loadRace(id);
  await openDaily(page, model);
  await startRace(page);
  await runToOnClock(page, lap);
  return model;
}

interface Reply {
  race: string;
  /** The lap run when the call comes up (it's for the lap after). */
  lap: number;
  text: RegExp;
  option: string;
  /** The calls the answer books for the next lap (none: no change, "Copy. No change."). */
  call: Array<Record<string, unknown>>;
}

const REPLIES: Reply[] = [
  // Pace and tyres. (Where the plan's stint already pushes, "Push" is no change.)
  {
    race: 'abu-dhabi-2025',
    lap: 39,
    text: /The rears|starting to go/,
    option: 'Manage them',
    call: [{ kind: 'mode', key: 'pace', value: 'manage' }],
  },
  { race: 'abu-dhabi-2025', lap: 39, text: /starting to go/, option: 'Keep pushing', call: [] },
  {
    race: 'abu-dhabi-2025',
    lap: 42,
    text: /Turn it down and save the tyres\?/,
    option: 'Manage',
    call: [{ kind: 'mode', key: 'pace', value: 'manage' }],
  },
  {
    race: 'abu-dhabi-2025',
    lap: 42,
    text: /Turn it down/,
    option: 'Keep the pace',
    call: [],
  },
  {
    race: 'abu-dhabi-2025',
    lap: 44,
    text: /quicker every lap\. Let me push!/,
    option: 'Yes, push',
    call: [
      { kind: 'reply', request: 'push', yes: true },
      { kind: 'mode', key: 'pace', value: 'push' },
    ],
  },
  {
    race: 'abu-dhabi-2025',
    lap: 44,
    text: /Let me push!/,
    option: 'No, save the tyres',
    call: [{ kind: 'reply', request: 'push', yes: false }],
  },
  {
    race: 'abu-dhabi-2025',
    lap: 47,
    text: /Gap to Norris: \+.* to go\. Steady, or push for a few laps\?/,
    option: 'Push',
    call: [],
  },
  {
    race: 'abu-dhabi-2025',
    lap: 47,
    text: /Steady, or push/,
    option: 'Steady',
    call: [{ kind: 'mode', key: 'pace', value: 'standard' }],
  },
  // Track limits.
  {
    race: 'abu-dhabi-2025',
    lap: 53,
    text: /strike 2 for track limits/,
    option: 'Back off at the exits',
    call: [{ kind: 'limits', careful: true }],
  },
  {
    race: 'abu-dhabi-2025',
    lap: 53,
    text: /track limits/,
    option: 'Keep using the kerbs',
    call: [],
  },
  // Fuel.
  {
    race: 'abu-dhabi-2025',
    lap: 46,
    text: /Fuel: we’re .* kg short to the flag/,
    option: 'Lift and coast',
    call: [{ kind: 'mode', key: 'fuel', value: 'liftAndCoast' }],
  },
  { race: 'abu-dhabi-2025', lap: 46, text: /Lift and coast\?/, option: 'Not yet', call: [] },
  // The driver asks to box.
  {
    race: 'mexico-2025',
    lap: 57,
    text: /These mediums are gone\. I want to box!/,
    option: 'Yes, box for softs',
    call: [
      { kind: 'reply', request: 'box', yes: true },
      { kind: 'pit', compound: 'SOFT' },
    ],
  },
  {
    race: 'mexico-2025',
    lap: 57,
    text: /I want to box!/,
    option: 'No, stay out',
    call: [{ kind: 'reply', request: 'box', yes: false }],
  },
  // The safety car makes the stop cheap.
  {
    race: 'mexico-2019',
    lap: 69,
    text: /Safety car! The pit lane is cheap\. Box for softs, or stay out\?/,
    option: 'Box, softs',
    call: [{ kind: 'pit', compound: 'SOFT' }],
  },
  { race: 'mexico-2019', lap: 69, text: /The pit lane is cheap/, option: 'Stay out', call: [] },
  // Blue flags.
  {
    race: 'mexico-2025',
    lap: 58,
    text: /Gasly is a lap down and right in front of me\. Blue flags!/,
    option: 'Wait, we’ll tell race control',
    call: [{ kind: 'blue', action: 'complain' }],
  },
  {
    race: 'mexico-2025',
    lap: 58,
    text: /Blue flags!/,
    option: 'Go round him now',
    call: [{ kind: 'blue', action: 'go-round' }],
  },
  // The rival closing.
  {
    race: 'mexico-2025',
    lap: 61,
    text: /Verstappen is .* quicker over the last laps\. .* Push to answer\?/,
    option: 'Push',
    call: [],
  },
  {
    race: 'mexico-2025',
    lap: 61,
    text: /Push to answer\?/,
    option: 'Stay on plan',
    call: [{ kind: 'mode', key: 'pace', value: 'standard' }],
  },
  // A car close behind, and the rival far up the road.
  {
    race: 'singapore-2025',
    lap: 48,
    text: /Hadjar is right with me, .* behind\. What do you want\?/,
    option: 'Defend',
    call: [{ kind: 'mode', key: 'battle', value: 'defend' }],
  },
  {
    race: 'singapore-2025',
    lap: 48,
    text: /What do you want\?/,
    option: 'Race him normally',
    call: [],
  },
  {
    race: 'singapore-2025',
    lap: 51,
    text: /Hadjar is .* up the road with 11 to go\. Flat out to close it\?/,
    option: 'Flat out',
    call: [],
  },
  {
    race: 'singapore-2025',
    lap: 51,
    text: /Flat out to close it\?/,
    option: 'Save it for later',
    call: [{ kind: 'mode', key: 'pace', value: 'standard' }],
  },
  // Stuck behind a car, and holding one off.
  {
    race: 'australia-2022',
    lap: 42,
    text: /Albon is holding me up/,
    option: 'Keep the pressure on',
    call: [{ kind: 'mode', key: 'battle', value: 'attack' }],
  },
  {
    race: 'australia-2022',
    lap: 42,
    text: /holding me up/,
    option: 'Drop back, cool the tyres',
    call: [{ kind: 'mode', key: 'pace', value: 'manage' }],
  },
  {
    race: 'austria-2024',
    lap: 58,
    text: /Gasly is still .* behind\. My rears are getting hot defending/,
    option: 'Push on the exits',
    call: [{ kind: 'mode', key: 'pace', value: 'push' }],
  },
  {
    race: 'austria-2024',
    lap: 58,
    text: /getting hot defending/,
    option: 'Save them, defend the slow corners',
    call: [{ kind: 'mode', key: 'battle', value: 'defend' }],
  },
];

for (const r of REPLIES) {
  test(`${r.race} lap ${r.lap + 1}: “${r.option}”`, async ({ page }) => {
    await callAfter(page, r.race, r.lap);
    const q = quickCall(page);
    await expect(q).toContainText(r.text);
    await expect(q).toContainText(`Lap ${r.lap + 1}`);
    const before = new Set((await session(page)).decisions.map((d) => JSON.stringify(d)));
    await q.getByRole('button', { name: r.option, exact: true }).click();
    await expect(q).toHaveCount(0);
    const s = await session(page);
    const made = s.decisions.filter((d) => !before.has(JSON.stringify(d)));
    if (r.call.length) {
      // The answer is the wall's order for the next lap, always followed (asked: no refusal).
      expect(made).toEqual(r.call.map((c) => expect.objectContaining({ lap: r.lap + 1, ...c })));
      expect(s.radio.filter((l) => l.refused)).toEqual([]);
    } else {
      expect(made).toEqual([]);
      expect(s.radio.map((l) => l.text)).toContain('Copy. No change.');
    }
  });
}

test('a quick call answered by its number key', async ({ page }) => {
  await callAfter(page, 'mexico-2025', 58);
  await expect(quickCall(page)).toContainText('Blue flags!');
  await page.keyboard.press('2');
  await expect(quickCall(page)).toHaveCount(0);
  expect(await calls(page, 'blue')).toContainEqual(expect.objectContaining({ action: 'go-round' }));
});

test.describe('the two-compound rule: the stop owed', () => {
  test('the engineer asks late on, and boxing makes it legal', async ({ page }) => {
    await callAfter(page, 'mexico-2019', 63);
    const q = quickCall(page);
    await expect(q).toContainText(
      'We haven’t run a second tyre compound. We have to stop before the flag or we’re disqualified. Box for hards?',
    );
    await expect(q.getByRole('button', { name: 'Not yet' })).toHaveAccessibleDescription(
      '8 laps left to do it',
    );
    await q.getByRole('button', { name: 'Box, hards' }).click();
    expect(await calls(page, 'pit')).toContainEqual(expect.objectContaining({ compound: 'HARD' }));
  });

  test('not yet: no stop booked, the wall copies', async ({ page }) => {
    await callAfter(page, 'mexico-2019', 63);
    await quickCall(page).getByRole('button', { name: 'Not yet' }).click();
    await expect(quickCall(page)).toHaveCount(0);
    expect(await calls(page, 'pit')).toEqual([]);
    expect(await radio(page)).toContain('Engineer: Copy. No change.');
  });
});

test.describe('battles', () => {
  test('attacking: the moves, the call, and the result at the corner', async ({ page }) => {
    await battleAfter(page, 'australia-2022', 37);
    const b = battleCall(page);
    // The card comes up as the car nears the corner's braking zone.
    await expect(b).toBeVisible({ timeout: 30_000 });
    await expect(b).toContainText('Attacking Albon');
    await expect(b).toContainText('Tell me where.');
    // Each move is named by itself; its note and risk describe it.
    const dive = b.getByRole('button', { name: 'Dive up the inside' });
    await expect(dive).toHaveAccessibleDescription(/Late on the brakes Risky/i);
    await dive.click();
    await expect(b).toContainText('· watch the corner');
    expect(await calls(page, 'battle')).toContainEqual(
      expect.objectContaining({ move: 'dive-inside', lap: 38 }),
    );
    // The result shows at the corner, then the card goes.
    await expect(b.getByRole('status')).toHaveText(/PAST ALBON!|NO WAY BY|CONTACT!|SPIN!/, {
      timeout: 60_000,
    });
  });

  test('no call at the braking zone: the driver makes his own move', async ({ page }) => {
    await battleAfter(page, 'australia-2022', 37);
    const b = battleCall(page);
    // The card comes up as the car nears the corner's braking zone.
    await expect(b).toBeVisible({ timeout: 30_000 });
    await expect(b).toContainText('Your call: he’s on the brakes', { timeout: 60_000 });
    await expect(b).toContainText('· watch the corner', { timeout: 30_000 });
    expect(await radio(page)).toContain('Engineer: No call from the wall: OCO makes his own move.');
    expect(await calls(page, 'battle')).toContainEqual(expect.objectContaining({ driver: true }));
  });
});

// Every move of a battle, each pressed in its own race: the move it calls for the next lap.
const MOVES: Array<[string, number, string, string]> = [
  ['australia-2022', 37, 'Dive up the inside', 'dive-inside'],
  ['australia-2022', 37, 'Round the outside', 'round-outside'],
  ['australia-2022', 37, 'Wait for DRS, go next lap', 'wait-drs'],
  ['australia-2022', 37, 'Overtake boost', 'overtake-button'],
  // Defending from the rival (Norris), and attacking him into the hairpin.
  ['abu-dhabi-2024', 51, 'Cover the inside under braking', 'cover-inside'],
  ['abu-dhabi-2024', 51, 'Square it off on the exit', 'hold-outside'],
  ['abu-dhabi-2024', 51, 'Brake late, make it wide', 'defend-hard'],
  ['abu-dhabi-2024', 51, 'Let him go', 'let-go'],
  ['abu-dhabi-2024', 54, 'Late-brake up the inside', 'dive-inside'],
  ['abu-dhabi-2024', 54, 'Switchback on the exit', 'round-outside'],
  ['abu-dhabi-2024', 54, 'Get a better exit, go next lap', 'wait-drs'],
];
for (const [race, lap, name, move] of MOVES) {
  test(`${race} lap ${lap + 1} battle: “${name}”`, async ({ page }) => {
    const model = await battleAfter(page, race, lap);
    const b = battleCall(page);
    // The card comes up as the car nears the corner's braking zone.
    await expect(b).toBeVisible({ timeout: 30_000 });
    const before = (await calls(page, 'battle')).length;
    await b.getByRole('button', { name, exact: true }).click();
    const made = (await calls(page, 'battle')).slice(before);
    if (made[0]?.driver) {
      // He may refuse the wall's move and make his own (game/refusal.ts): he says so.
      const s = await session(page);
      expect(s.radio.some((l) => l.refused && l.from === model.userSide)).toBe(true);
      expect(made).toEqual([expect.objectContaining({ lap: lap + 1, driver: true })]);
    } else {
      await expect(b).toContainText(`${name}· watch the corner`);
      expect(made).toEqual([expect.objectContaining({ move, lap: lap + 1 })]);
    }
  });
}

test.describe('race events', () => {
  test('rain: the radar, the rain call’s box and its tyres, and wet tyres on the radio', async ({
    page,
  }) => {
    await openDaily(page, loadRace('russia-2021'));
    await startRace(page);
    await fastForward(page, 39);
    await expect(page.getByText(/Rain in about 6 laps · 60%/)).toBeVisible();
    await runTo(page, 45);
    const card = decision(page);
    await expect(card.getByRole('alert')).toHaveText('Engineer · Rain · Lap 46');
    // Box: which tyres (inters and full wets), and Back to the options.
    await card.getByRole('button', { name: 'Box', exact: true }).click();
    await expect(card).toContainText('which tyres?');
    const tyres = await card.getByRole('button').allInnerTexts();
    expect(tyres.join(' ')).toMatch(/Inter/);
    await card.getByRole('button', { name: 'Back' }).click();
    await expect(card.getByRole('button', { name: 'Stay out' })).toBeVisible();
    // Escape backs out of the tyre step too.
    await card.getByRole('button', { name: 'Box', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(card.getByRole('button', { name: 'Stay out' })).toBeVisible();
    await card.getByRole('button', { name: 'Box next lap, inters' }).click();
    await expect(card).toHaveCount(0);
    expect(await calls(page, 'radio')).toContainEqual(
      expect.objectContaining({ momentId: expect.stringContaining('46') }),
    );
    // The track is wet a lap on; the team radio has wet tyres to box for.
    await runTo(page, 48);
    await expect(page.getByText(/^Wet$/i).first()).toBeVisible();
    await openPanel(page, 'Team radio');
    const tr = page.getByRole('region', { name: 'Team radio' });
    await expect(tr).toContainText(/Inter/);
    expect(await calls(page, 'pit')).toContainEqual(
      expect.objectContaining({ compound: 'INTERMEDIATE', lap: 47 }),
    );
  });

  test('the rain call’s Box picks a tyre from the list', async ({ page }) => {
    await openDaily(page, loadRace('russia-2021'));
    await startRace(page);
    await runTo(page, 45);
    const card = decision(page);
    await card.getByRole('button', { name: 'Box', exact: true }).click();
    await card.getByRole('button').first().click();
    await expect(card).toHaveCount(0);
    expect((await calls(page, 'radio')).at(-1)).toEqual(
      expect.objectContaining({ momentId: expect.stringContaining('46') }),
    );
  });

  test('a virtual safety car late on, and its cause', async ({ page }) => {
    await openDaily(page, loadRace('mexico-2025'));
    await startRace(page);
    await runTo(page, 69);
    await expect(page.getByText('Virtual safety car', { exact: true })).toBeVisible();
    await expect(page.getByText('Sainz stopped on track', { exact: true })).toBeVisible();
    expect((await radio(page)).some((l) => l.startsWith('Race control: Virtual safety car'))).toBe(
      true,
    );
  });

  test('the rival retires: out on the tower, no gap, and he isn’t classified', async ({ page }) => {
    // Spain 2025 with Alonso's car failing on lap 55 (a fixture copy; the race file isn't
    // changed).
    const model = raceWith('spain-2025', (m) => {
      (m.events as Array<Record<string, unknown>>).push({
        lap: 55,
        type: 'RETIREMENT',
        driver: 'ALO',
      });
    });
    await openDaily(page, model);
    await startRace(page, 'B');
    await runTo(page, 55);
    expect((await session(page)).cars.ALO?.retired).toBe(true);
    await expect(page.locator('main > header')).not.toContainText(/[+−-]\d+\.\d/);
    await openPanel(page, 'Team radio');
    await expect(
      page
        .getByRole('region', { name: 'Team radio' })
        .getByRole('button', { name: 'Hold up Alonso' }),
    ).toBeVisible();
    await controls(page).getByRole('button', { name: 'Team radio' }).click();
    await runTo(page, 66);
    await page.getByRole('button', { name: 'See how you did' }).click({ timeout: 60_000 });
    await expect(page.getByText('Your calls')).toBeVisible({ timeout: 60_000 });
  });
});

// The big calls that box (Abu Dhabi 2021: the VSC two laps after the takeover, and the lap-44
// tyre call): Box opens the tyres, each tyre and each "Box next lap" is its own option.
const BOXES: Array<[number, string, RegExp | null, string]> = [
  [36, 'Stay out', null, 'stay'],
  [36, 'Box', /mediums/i, 'cover-medium'],
  [36, 'Box', /hards/i, 'cover-hard'],
  [36, 'Box next lap, mediums', null, 'cover-next-medium'],
  [44, 'Box', /softs/i, 'box-soft'],
  [44, 'Box next lap', /mediums/i, 'box-next-medium'],
  [44, 'Box next lap', /hards/i, 'box-next-hard'],
];
for (const [lap, option, tyre, id] of BOXES) {
  test(`abu-dhabi-2021 lap ${lap}: “${option}”${tyre ? ` then ${tyre.source}` : ''}`, async ({
    page,
  }) => {
    const model = loadRace('abu-dhabi-2021');
    await openDaily(page, model);
    await startRace(page);
    await runTo(page, lap - 1);
    if (lap === 36) {
      // The VSC is out at the takeover's second lap, and the map says why.
      await expect(page.getByText('Virtual safety car', { exact: true })).toBeVisible();
      await expect(
        page.getByText('Giovinazzi stopped with a gearbox failure', { exact: true }),
      ).toBeVisible();
    }
    const card = decision(page);
    await expect(card.getByRole('alert')).toContainText(`Lap ${lap}`);
    await card.getByRole('button', { name: option, exact: true }).click();
    if (tyre) {
      await expect(card).toContainText(`${option}: which tyres?`);
      await card.getByRole('button', { name: tyre }).click();
    }
    await expect(card).toHaveCount(0);
    const moment = model.decisionMoments.find((m) => m.lap === lap);
    expect(await calls(page, 'radio')).toContainEqual(
      expect.objectContaining({ momentId: moment?.id, optionId: id }),
    );
  });
}

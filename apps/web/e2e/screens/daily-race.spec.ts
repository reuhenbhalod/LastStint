// The Daily's race screen (docs/test-suite-spec.md S3), on Spain 2025 (Gasly vs Alonso, the
// last 15 laps; seed 86061): the race plan and its editor, the heads-up before a planned stop,
// the engineer's new plan under the lap-54 safety car, the big calls, the top bar, the control
// bar's panels (team radio with every headset mode, pit stop and team orders; the plan; the
// phone's tabs), the driver details from the map, the towers, and a reload mid-race. The race
// runs lap by lap through the test hook (screens/daily.ts), so each state shows on its lap.
import type { Page } from '@playwright/test';
import { expect, test } from '../coverage.js';
import {
  calls,
  controls,
  decision,
  fastForward,
  loadRace,
  openDaily,
  openPanel,
  planCard,
  quickCall,
  radio,
  runTo,
  session,
  startRace,
} from './daily.js';

const model = loadRace('spain-2025');

/** The call was made, or the driver said no to it (he may refuse the wall: game/refusal.ts). */
async function madeOrRefused(page: Page, kind: string, match: Record<string, unknown>) {
  await expect
    .poll(async () => {
      const s = await session(page);
      const made = s.decisions.some(
        (d) => d.kind === kind && Object.entries(match).every(([k, v]) => d[k] === v),
      );
      const refused = s.radio.some((r) => r.refused && r.from === model.userSide);
      return made || refused;
    })
    .toBe(true);
}

test.describe('the race plan at takeover', () => {
  test('the plans, the engineer’s pick, and going with another', async ({ page }) => {
    const { submitted } = await openDaily(page, model);
    await page.getByRole('button', { name: 'Take the Alpine pit wall' }).click();
    const plans = planCard(page);
    await expect(plans).toContainText('15 laps to go · +5.1s on Alonso · 20-lap-old mediums');
    await expect(plans).not.toContainText('…', { timeout: 60_000 });
    const a = plans.getByRole('button', { name: 'A · No stop' });
    const b = plans.getByRole('button', { name: 'B · One stop, engineer’s pick' });
    const c = plans.getByRole('button', { name: 'C · One stop', exact: true });
    // The engineer's pick is picked to start with; each card's chance and line describe it.
    await expect(b).toHaveAttribute('aria-pressed', 'true');
    await expect(b).toHaveAccessibleDescription(/\d+% softs on lap 52/);
    await expect(plans.getByRole('button', { name: 'Go with plan B' })).toBeEnabled();
    await a.click();
    await expect(a).toHaveAttribute('aria-pressed', 'true');
    await expect(b).toHaveAttribute('aria-pressed', 'false');
    await expect(plans.getByRole('button', { name: 'Go with plan A' })).toBeVisible();
    await c.click();
    await expect(c).toHaveAttribute('aria-pressed', 'true');
    await plans.getByRole('button', { name: 'Go with plan C' }).click();
    // Racing on plan C: mediums this lap, said on the radio and on the plan pill.
    await expect(plans).toHaveCount(0);
    await expect(controls(page).getByRole('button', { name: 'Plan · box L52' })).toBeVisible();
    expect(await radio(page)).toContain(
      'Engineer: Box lap 52 for mediums. Pace: standard, then push.',
    );
    expect(await calls(page, 'plan')).toEqual([expect.objectContaining({ id: 'c' })]);
    expect(submitted()).toBeNull();
  });

  test('build your own: stops, laps, tyres, pace, the rule, and going with it', async ({
    page,
  }) => {
    await openDaily(page, model);
    await page.getByRole('button', { name: 'Take the Alpine pit wall' }).click();
    const plans = planCard(page);
    await expect(plans).not.toContainText('…', { timeout: 60_000 });
    await plans.getByRole('button', { name: 'A · No stop' }).click();
    await plans.getByRole('button', { name: 'Build your own' }).click();
    // From plan A (no stop): mediums since lap 31, so no second compound yet.
    await expect(plans).toContainText('Now to the flag, on mediums');
    const add = plans.getByRole('button', { name: '+ Add a stop' });
    await add.click();
    const stop = plans.getByRole('slider', { name: 'Stop 1 lap' });
    await expect(stop).toBeVisible();
    const lap = Number(await stop.inputValue());
    await plans.getByRole('button', { name: 'Later' }).click();
    await expect(stop).toHaveValue(String(lap + 1));
    await plans.getByRole('button', { name: 'Earlier' }).click();
    await plans.getByRole('button', { name: 'Earlier' }).click();
    await expect(stop).toHaveValue(String(lap - 1));
    await stop.fill('56');
    await expect(plans).toContainText('lap 56');
    // The tyres: each pressed in turn, one at a time.
    for (const t of ['softs', 'hards', 'mediums', 'softs']) {
      await plans.getByRole('button', { name: t, exact: true }).click();
      await expect(plans.getByRole('button', { name: t, exact: true })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    }
    // Pace per stint: the first stint's three, then the last stint push.
    const stints = plans.getByRole('listitem');
    for (const p of ['Manage', 'Push', 'Standard']) {
      await stints.nth(0).getByRole('button', { name: p }).click();
      await expect(stints.nth(0).getByRole('button', { name: p })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    }
    await stints.nth(1).getByRole('button', { name: 'Push' }).click();
    // A second stop, then remove it again.
    await add.click();
    await expect(plans.getByRole('slider')).toHaveCount(2);
    await stints.nth(2).getByRole('button', { name: 'Remove' }).click();
    await expect(plans.getByRole('slider')).toHaveCount(1);
    // Graded like the engineer's (the chance appears), then picked.
    await expect(plans).toContainText(/Chance vs ALO: \d+%/, { timeout: 60_000 });
    // Back to the engineer's plans and in again: the draft starts over from the picked plan.
    await plans.getByRole('button', { name: 'The engineer’s plans' }).click();
    await expect(plans.getByRole('button', { name: 'A · No stop' })).toBeVisible();
    await plans.getByRole('button', { name: 'Build your own' }).click();
    // The engineer's pick (B: softs on lap 52) is the draft's start now.
    await expect(plans.getByRole('slider', { name: 'Stop 1 lap' })).toHaveValue('52');
    await plans.getByRole('slider', { name: 'Stop 1 lap' }).fill('56');
    const go = plans.getByRole('button', { name: 'Go with your plan' });
    await expect(go).toBeEnabled({ timeout: 60_000 });
    await go.click();
    await expect(plans).toHaveCount(0);
    expect(await calls(page, 'plan')).toEqual([
      expect.objectContaining({ id: 'own', stops: [{ lap: 56, compound: 'SOFT' }] }),
    ]);
    await expect(controls(page).getByRole('button', { name: 'Plan · box L56' })).toBeVisible();
  });
});

/** Go racing on your own plan: one stop for softs on lap `lap`. */
async function ownPlan(page: Page, lap: number) {
  await page.getByRole('button', { name: 'Take the Alpine pit wall' }).click();
  const plans = planCard(page);
  await expect(plans).not.toContainText('…', { timeout: 60_000 });
  await plans.getByRole('button', { name: 'A · No stop' }).click();
  await plans.getByRole('button', { name: 'Build your own' }).click();
  await plans.getByRole('button', { name: '+ Add a stop' }).click();
  await plans.getByRole('slider', { name: 'Stop 1 lap' }).fill(String(lap));
  await plans.getByRole('button', { name: 'softs', exact: true }).click();
  await plans.getByRole('button', { name: 'Go with your plan' }).click({ timeout: 60_000 });
  await expect(plans).toHaveCount(0);
}

test.describe('the planned stop', () => {
  const headsUp = (page: Page) => page.getByRole('region', { name: 'Planned stop' });

  test('the heads-up the lap before: one more lap, then box as planned', async ({ page }) => {
    await openDaily(page, model);
    await ownPlan(page, 53);
    // Lap 51 run: the stop is on lap 53, so the engineer checks now.
    await expect(headsUp(page)).toContainText('Box next lap for softs, as planned. Still good?');
    await headsUp(page).getByRole('button', { name: 'One more lap' }).click();
    await expect(headsUp(page)).toHaveCount(0);
    expect(await radio(page)).toContain('Engineer: Copy, one more lap. Box lap 54.');
    await expect(controls(page).getByRole('button', { name: 'Plan · box L54' })).toBeVisible();
    // A lap on, the heads-up for lap 54: box as planned, and the stop is made on it.
    await fastForward(page, 52);
    await expect(headsUp(page)).toBeVisible();
    await headsUp(page).getByRole('button', { name: 'Box as planned' }).click();
    await expect(headsUp(page)).toHaveCount(0);
    await fastForward(page, 53);
    expect(await calls(page, 'pit')).toEqual([
      expect.objectContaining({ lap: 54, compound: 'SOFT' }),
    ]);
  });

  test('change plan opens the plan’s editor; run this plan; cancel', async ({ page }) => {
    await openDaily(page, model);
    await ownPlan(page, 53);
    await headsUp(page).getByRole('button', { name: 'Change plan' }).click();
    const bar = page.getByRole('region', { name: 'Race plan' });
    await expect(bar).toBeVisible();
    await expect(controls(page).getByRole('button', { name: /^Plan/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await bar.getByRole('slider', { name: 'Stop 1 lap' }).fill('58');
    await bar.getByRole('button', { name: 'mediums', exact: true }).click();
    await bar.getByRole('button', { name: 'Run this plan' }).click();
    await expect(bar.getByRole('button', { name: 'Run this plan' })).toHaveCount(0);
    await expect(bar).toContainText('Box lap 58 for mediums');
    expect(await radio(page)).toContainEqual(
      expect.stringContaining('Engineer: New plan. Box lap 58 for mediums.'),
    );
    await expect(controls(page).getByRole('button', { name: 'Plan · box L58' })).toBeVisible();
    // Change, then Cancel: the plan stays.
    await bar.getByRole('button', { name: 'Change' }).click();
    await expect(bar.getByRole('button', { name: 'Run this plan' })).toBeVisible();
    await bar.getByRole('button', { name: 'Cancel' }).click();
    await expect(bar.getByRole('button', { name: 'Run this plan' })).toHaveCount(0);
    await expect(bar).toContainText('Box lap 58 for mediums');
    // The plan pill closes the panel again.
    const pill = controls(page).getByRole('button', { name: 'Plan · box L58' });
    await pill.click();
    await expect(pill).toHaveAttribute('aria-pressed', 'false');
  });
});

test.describe('the engineer’s new plan under the safety car', () => {
  const offer = (page: Page) => page.getByRole('region', { name: 'New plan' });

  /** Plan B (softs on lap 52), to the lap-54 safety car, until the engineer offers a plan. */
  async function toOffer(page: Page) {
    await openDaily(page, model);
    await startRace(page, 'B');
    await runTo(page, 54);
    // The flag chip and its cause, and race control on the radio.
    await expect(page.getByText('Safety car', { exact: true })).toBeVisible();
    await expect(page.getByText('Antonelli stopped on track', { exact: true })).toBeVisible();
    expect((await radio(page)).some((l) => l.startsWith('Race control: Safety car'))).toBe(true);
    // The re-rank runs in the worker: the offer comes on one of the safety car laps.
    for (let lap = 55; lap <= 58 && !(await offer(page).isVisible()); lap++) {
      await fastForward(page, lap);
      await offer(page)
        .waitFor({ timeout: 3_000 })
        .catch(() => {});
    }
    await expect(offer(page)).toContainText(
      'The race has moved. One stop, softs on lap 59, standard, then push now looks better',
    );
  }

  test('keep ours: the offer goes and doesn’t come back while nothing changes', async ({
    page,
  }) => {
    await toOffer(page);
    await offer(page).getByRole('button', { name: 'Keep ours' }).click();
    await expect(offer(page)).toHaveCount(0);
    const lap = (await session(page)).lap;
    await fastForward(page, lap + 1);
    await page.waitForTimeout(1_000); // the re-rank's answer, had it been asked again
    await expect(offer(page)).toHaveCount(0);
    expect((await session(page)).decisions.filter((d) => d.kind === 'pit')).toHaveLength(1);
  });

  test('switch: the new plan runs, its stop on lap 59', async ({ page }) => {
    await toOffer(page);
    await offer(page).getByRole('button', { name: 'Switch' }).click();
    await expect(offer(page)).toHaveCount(0);
    expect(await radio(page)).toContain(
      'Engineer: New plan. Box lap 59 for softs. Pace: standard, then push.',
    );
    await expect(controls(page).getByRole('button', { name: 'Plan · box L59' })).toBeVisible();
    await runTo(page, 59, { 60: ['Hold the line'] });
    expect(await calls(page, 'pit')).toContainEqual(expect.objectContaining({ lap: 59 }));
  });
});

test.describe('the big calls', () => {
  test('the restart and the tyres: options by click and by number key', async ({ page }) => {
    await openDaily(page, model);
    await startRace(page, 'B');
    await runTo(page, 59);
    const card = decision(page);
    await expect(card.getByRole('alert')).toHaveText('Engineer · Restart · Lap 60');
    for (const name of ['Defend hard', 'Hold the line', 'Attack'])
      await expect(card.getByRole('button', { name, exact: true })).toBeVisible();
    // The facts row is for a laptop; a phone has the options.
    await card.getByRole('button', { name: 'Hold the line', exact: true }).click();
    await expect(card).toHaveCount(0);
    expect(await calls(page, 'radio')).toContainEqual(
      expect.objectContaining({ momentId: expect.stringContaining('60') }),
    );
    await runTo(page, 62);
    await expect(card.getByRole('alert')).toHaveText('Engineer · Tyres · Lap 63');
    for (const name of ['Push now', 'Standard pace', 'Manage the tyres', 'Push and attack'])
      await expect(card.getByRole('button', { name, exact: true })).toBeVisible();
    // Number keys pick the options in order: 3 is Manage the tyres.
    await page.keyboard.press('3');
    await expect(card).toHaveCount(0);
    const answered = (await calls(page, 'radio')).at(-1) as { optionId: string };
    const moment = model.decisionMoments.find((m) => m.lap === 63);
    const option = moment?.options.find((o) => o.id === answered.optionId) as unknown as {
      label: string;
    };
    expect(option.label).toMatch(/[Mm]anage/);
    // The race is graded against the calls: the result's lines for both calls.
    await runTo(page, 66);
    await page.getByRole('button', { name: 'See how you did' }).click({ timeout: 60_000 });
    await expect(page.getByRole('region', { name: 'Your calls' })).toContainText('L60');
    await expect(page.getByRole('region', { name: 'Your calls' })).toContainText('L63');
  });
});

test.describe('the quick call', () => {
  test('not answered in time: the wall sticks to the plan', async ({ page }) => {
    await openDaily(page, model);
    await startRace(page, 'B');
    await fastForward(page, 52);
    await expect(quickCall(page)).toBeVisible();
    // A moment to read it, then a few seconds to answer (call timing): then it goes.
    await expect(quickCall(page)).toHaveCount(0, { timeout: 20_000 });
    expect(await radio(page)).toContain('Engineer: No answer from the wall. Sticking to the plan.');
    // Only the plan's own call for lap 53 (push, its second stint) is made.
    expect((await calls(page, 'mode')).filter((d) => d.lap === 53)).toEqual([
      expect.objectContaining({ key: 'pace', value: 'push' }),
    ]);
  });
});

test.describe('the top bar and the control bar', () => {
  test('speed, follow car, and (on a laptop) sound and the stats view', async ({ page }, info) => {
    await openDaily(page, model);
    await startRace(page, 'B');
    const one = page.getByRole('button', { name: '1×' });
    const two = page.getByRole('button', { name: '2×' });
    await expect(one).toHaveAttribute('aria-pressed', 'true');
    await two.click();
    await expect(two).toHaveAttribute('aria-pressed', 'true');
    expect((await page.evaluate(() => localStorage.getItem('pitwall:run'))) ?? '').toContain(
      '"speed":2',
    );
    await one.click();
    await expect(one).toHaveAttribute('aria-pressed', 'true');

    const follow = controls(page).getByRole('button', { name: 'Follow car' });
    await expect(follow).toHaveAttribute('aria-pressed', 'false');
    await follow.click();
    await expect(follow).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => localStorage.getItem('pitwall.follow-camera'))).toBe('on');
    await follow.click();
    await expect(follow).toHaveAttribute('aria-pressed', 'false');
    expect(await page.evaluate(() => localStorage.getItem('pitwall.follow-camera'))).toBe('off');

    if (info.project.name !== 'desktop') {
      // On a phone the sound toggle and the stats view aren't there (the tabs are).
      await expect(page.getByRole('button', { name: /^Radio sound/ })).toBeHidden();
      await expect(controls(page).getByRole('button', { name: 'Show stats' })).toBeHidden();
      return;
    }
    const sound = page.getByRole('button', { name: 'Radio sound off' });
    await sound.click();
    await expect(page.getByRole('button', { name: 'Radio sound on' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.getByRole('button', { name: 'Radio sound on' }).click();
    await expect(page.getByRole('button', { name: 'Radio sound off' })).toBeVisible();

    // The stats view: the full timing tower left, your car and the radio right.
    const standings = page.getByRole('region', { name: 'Standings' });
    await expect(standings).toBeHidden();
    await controls(page).getByRole('button', { name: 'Show stats' }).click();
    await expect(standings).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Stats' })).toContainText('Radio');
    await expect(page.getByRole('region', { name: 'Leaders' })).toHaveCount(0);
    await controls(page).getByRole('button', { name: 'Focus view' }).click();
    await expect(standings).toBeHidden();
    await expect(page.getByRole('region', { name: 'Leaders' })).toBeVisible();
  });

  test('the phone’s tabs: standings, car, calls, radio', async ({ page }, info) => {
    test.skip(info.project.name === 'desktop', 'a laptop shows them in the stats view');
    await openDaily(page, model);
    await startRace(page, 'B');
    await openPanel(page, 'Standings');
    await expect(page.getByRole('list', { name: 'Timing tower' })).toBeVisible();
    await openPanel(page, 'Car');
    await expect(page.getByRole('list', { name: 'Timing tower' })).toBeHidden();
    await expect(page.locator('section[aria-label="Race"]')).toContainText(/softs|mediums/i);
    await openPanel(page, 'Calls');
    await openPanel(page, 'Radio');
    await expect(page.locator('section[aria-label="Race"]')).toContainText('Box lap 52 for softs');
    // The open tab closes its panel.
    await controls(page).getByRole('button', { name: 'Radio', exact: true }).click();
    await expect(
      controls(page).getByRole('button', { name: 'Radio', exact: true }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  test('the brand goes home and the race waits; back to the race', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the race’s brand is on a laptop’s top bar');
    await openDaily(page, model);
    await startRace(page, 'B');
    await page.getByRole('button', { name: 'LastStint home (the race waits)' }).click();
    await page.getByRole('button', { name: 'Back to the race · lap 51' }).click();
    await expect(controls(page)).toBeVisible();
    expect((await session(page)).lap).toBe(51);
  });
});

test.describe('the team radio', () => {
  test('every headset mode, booked for the next lap', async ({ page }) => {
    await openDaily(page, model);
    await startRace(page, 'B');
    await openPanel(page, 'Team radio');
    const tr = page.getByRole('region', { name: 'Team radio' });
    await expect(tr).toContainText('Boxing · Softs');
    const rounds = [
      ['push', 'attack', 'harvest', 'Lift & coast'],
      ['manage', 'defend', 'deploy', 'normal'],
      ['standard', 'hold', 'overtake', null],
      [null, null, 'balanced', null],
    ];
    const KEY = ['pace', 'battle', 'ers', 'fuel'];
    const VALUE: Record<string, string> = {
      'Lift & coast': 'liftAndCoast',
    };
    for (const [r, round] of rounds.entries()) {
      const lap = (await session(page)).lap;
      for (const [i, name] of round.entries()) {
        if (!name) continue;
        const group = tr.getByRole('group', { name: ['Pace', 'Battle', 'ERS', 'Fuel'][i] });
        await group.getByRole('button', { name, exact: true }).click();
        await madeOrRefused(page, 'mode', {
          key: KEY[i],
          value: VALUE[name] ?? name.toLowerCase(),
          lap: lap + 1,
        });
      }
      if (r < rounds.length - 1) await fastForward(page, lap + 1);
    }
    // The orders bar folds the orders away and opens them again.
    const fold = tr.getByRole('button', { name: 'Orders for next lap' });
    await fold.click();
    await expect(fold).toHaveAttribute('aria-expanded', 'false');
    await expect(tr.getByRole('group', { name: 'Pace' })).toHaveCount(0);
    await fold.click();
    await expect(tr.getByRole('group', { name: 'Pace' })).toBeVisible();
    // The pill closes the dock.
    const pill = controls(page).getByRole('button', { name: 'Team radio' });
    await pill.click();
    await expect(pill).toHaveAttribute('aria-pressed', 'false');
  });

  test('team orders with Colapinto', async ({ page }) => {
    await openDaily(page, model);
    await startRace(page, 'B');
    await openPanel(page, 'Team radio');
    const tr = page.getByRole('region', { name: 'Team radio' });
    await expect(tr).toContainText('Team orders · Colapinto');
    const lap = (await session(page)).lap;
    await tr.getByRole('button', { name: 'Hold up Alonso' }).click();
    expect(await radio(page)).toContain(
      'Engineer: Team-mate told: hold him up when he gets to you.',
    );
    // In force from the next lap: the button then releases him.
    await fastForward(page, lap + 1);
    await expect(tr.getByRole('button', { name: 'Release Alonso' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await tr.getByRole('button', { name: 'Release Alonso' }).click();
    expect(await radio(page)).toContain('Engineer: Team-mate released: race your own race.');
    // One team order a lap.
    await fastForward(page, lap + 2);
    await expect(tr.getByRole('button', { name: 'Hold up Alonso' })).toBeVisible();
    await tr.getByRole('button', { name: 'Colapinto lets you by' }).click();
    expect(await radio(page)).toContain('Engineer: Team-mate told to let you through.');
    await fastForward(page, lap + 3);
    await tr.getByRole('button', { name: 'Let Colapinto by' }).click();
    expect(await radio(page)).toContain('Engineer: Let your team-mate through, please.');
    const orders = (await calls(page, 'teamOrder')).map((d) => d.order);
    expect(orders).toEqual(['holdUp', 'release', 'teammateLetsYouPast', 'letTeammatePast']);
  });

  for (const tyre of ['Softs', 'Mediums', 'Hards']) {
    test(`box from the team radio for ${tyre.toLowerCase()}`, async ({ page }) => {
      await openDaily(page, model);
      await startRace(page, 'A');
      await openPanel(page, 'Team radio');
      const tr = page.getByRole('region', { name: 'Team radio' });
      await tr.getByRole('button', { name: new RegExp(`${tyre}$`) }).click();
      await madeOrRefused(page, 'pit', { compound: tyre.slice(0, -1).toUpperCase() });
      // Made (not refused): the pit stop shows it booked in place of the tyres.
      if ((await calls(page, 'pit')).length)
        await expect(tr.getByRole('status')).toContainText(new RegExp(`${tyre} · boxing`));
    });
  }
});

test.describe('the cars on the map and in the towers', () => {
  test('the driver details from the map, and close', async ({ page }) => {
    await openDaily(page, model);
    await startRace(page, 'B');
    // The dot never stops moving: the press is dispatched.
    await page.getByRole('button', { name: 'ALO: details' }).dispatchEvent('pointerdown');
    const card = page.getByLabel('Fernando Alonso details');
    await expect(card).toContainText('Aston Martin');
    // The same car again closes it; another opens its own.
    await page.getByRole('button', { name: 'PIA: details' }).dispatchEvent('pointerdown');
    await expect(page.getByLabel('Oscar Piastri details')).toBeVisible();
    await page.getByRole('button', { name: 'Close driver details' }).click();
    await expect(page.getByLabel('Oscar Piastri details')).toHaveCount(0);
  });

  test('a leaders row opens its driver', async ({ page }) => {
    await openDaily(page, model);
    await startRace(page, 'B');
    const leaders = page.getByRole('region', { name: 'Leaders' });
    await leaders.getByRole('button').first().click();
    await expect(page.getByLabel(/ details$/).first()).toBeVisible();
    await page.getByRole('button', { name: 'Close driver details' }).click();
  });

  test('a timing tower row opens its driver', async ({ page }, info) => {
    await openDaily(page, model);
    await startRace(page, 'B');
    if (info.project.name === 'desktop')
      await controls(page).getByRole('button', { name: 'Show stats' }).click();
    else await openPanel(page, 'Standings');
    const tower = page.getByRole('list', { name: 'Timing tower' });
    await tower.getByRole('button', { name: /ALO/ }).click();
    if (info.project.name !== 'desktop')
      await controls(page).getByRole('button', { name: 'Standings' }).click(); // the card waits for the dock
    await expect(page.getByLabel('Fernando Alonso details')).toBeVisible();
    await page.getByRole('button', { name: 'Close driver details' }).click();
    await expect(page.getByLabel('Fernando Alonso details')).toHaveCount(0);
  });
});

test('a reload mid-race comes back on the same lap with the same calls', async ({ page }) => {
  await openDaily(page, model);
  await startRace(page, 'B');
  await runTo(page, 55);
  await openPanel(page, 'Team radio');
  await page
    .getByRole('region', { name: 'Team radio' })
    .getByRole('group', { name: 'Battle' })
    .getByRole('button', { name: 'defend' })
    .click();
  await madeOrRefused(page, 'mode', { key: 'battle', value: 'defend' });
  const before = await session(page);
  await page.reload();
  // Straight back to the race (no daily card, no walkthrough).
  await expect(controls(page)).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const after = await session(page);
  expect(after.lap).toBe(before.lap);
  expect(after.decisions).toEqual(before.decisions);
  await expect(page.getByText('Safety car', { exact: true })).toBeVisible();
  // And it races on from there.
  await fastForward(page, before.lap + 1);
  expect((await session(page)).lap).toBe(before.lap + 1);
});

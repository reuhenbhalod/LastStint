// The pages around the game (docs/test-suite-spec.md S3): the tutorial race (/tutorial), the
// privacy policy, the terms and the credits, every link on them pressed and followed. (Versus
// held back from the release is unit-tested, App.test.ts and TopBar.test.ts: the test build
// has it on, playwright.config.ts.)
// Links off the site are answered by a stand-in page, so nothing leaves the machine.
import type { Page } from '@playwright/test';
import { expect, test } from '../coverage.js';
import { loadRace, mockApi } from '../mock.js';
import { type Answered, answerCall, fastLaps } from './gauntlet.js';

/** The API answers nothing (the pages here need none); off-site links get a stand-in page. */
async function offline(page: Page) {
  await page.route('**/api/**', (r) => r.fulfill({ status: 404, json: { error: 'not-found' } }));
  await page.context().route(
    (url) => url.hostname !== 'localhost',
    async (r) => {
      // A moment's wait, as a real site would take: the press is recorded before the page goes.
      await new Promise((ok) => setTimeout(ok, 150));
      await r.fulfill({ contentType: 'text/html', body: '<h1>Off site</h1>' });
    },
  );
}

const noSideScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

const DONE_KEY = 'laststint:tutorial-done';

test.describe('tutorial', () => {
  test('the intro card, and skipping it', async ({ page }) => {
    await offline(page);
    await page.goto('/tutorial');
    await expect(page.getByRole('heading', { name: 'Canada 2022', level: 1 })).toBeVisible();
    await expect(page.getByText('Tutorial race · not scored')).toBeVisible();
    // Canada 2022: 70 laps, taken over on lap 46.
    await expect(page.getByText(/Take Sainz’s pit wall for the last \d+ laps/)).toBeVisible();
    expect(await page.evaluate((k) => localStorage.getItem(k), DONE_KEY)).toBeNull();
    await page.getByRole('button', { name: 'Skip the tutorial' }).click();
    await expect(page).toHaveURL('/');
    expect(await page.evaluate((k) => localStorage.getItem(k), DONE_KEY)).toBe('1');
  });

  test('the coach walks the race, step by step, to the result', async ({ page }) => {
    test.setTimeout(300_000);
    await fastLaps(page, 0.05);
    await offline(page);
    await page.goto('/tutorial');
    await page.getByRole('button', { name: 'Start the tutorial' }).click();

    const coach = page.getByRole('complementary', { name: 'Tutorial' });
    const title = coach.getByRole('heading', { level: 2 });
    // The opening steps, in order, while the plan waits.
    for (const [i, t] of [
      'Welcome to the pit wall',
      'The leaders',
      'The fight',
      'Pick a race plan',
    ].entries()) {
      await expect(title).toHaveText(t);
      await expect(coach).toContainText(`Tutorial · ${i + 1} of `);
      await coach.getByRole('button', { name: 'Got it' }).click();
    }
    await expect(coach).toHaveCount(0);
    // The race's speed and follow camera work here too.
    const x2 = page.getByRole('button', { name: '2×' });
    await x2.click();
    await expect(x2).toHaveAttribute('aria-pressed', 'true');
    const follow = page.getByRole('button', { name: 'Follow car' });
    await follow.click();
    await expect(follow).toHaveAttribute('aria-pressed', 'true');
    await page
      .getByRole('region', { name: 'Race plan' })
      .getByRole('button', { name: /Go with/ })
      .click();

    // Then each step as its moment comes; the race's calls are answered with their first choice.
    const titles: string[] = [];
    const answered: Answered[] = [];
    const results = page.getByRole('button', { name: 'See how you did' });
    const deadline = Date.now() + 240_000;
    while (!page.url().endsWith('/') || page.url().includes('tutorial')) {
      if (Date.now() > deadline) throw new Error(`stuck after ${titles.join(', ')}`);
      if (await coach.isVisible()) {
        const t = (await title.textContent()) ?? '';
        const next = coach.getByRole('button', { name: /^(Got it|Finish)$/ });
        if (titles.at(-1) !== t) titles.push(t);
        if (t === 'The flag' && (await results.isVisible())) {
          await next.click();
          await results.click();
          continue;
        }
        if (t === 'How you did') {
          // The result: the classification opens, then Finish.
          // (a <summary>: no button role in the accessibility tree, so found by its text)
          const classification = page.locator('summary', { hasText: 'Classification' });
          await classification.click();
          await expect(classification.locator('xpath=..')).toHaveAttribute('open', '');
          await expect(next).toHaveText('Finish');
        }
        await next.click({ timeout: 3000 }).catch(() => {});
        continue;
      }
      if (await results.isVisible().catch(() => false)) {
        await results.click().catch(() => {});
        continue;
      }
      if (await answerCall(page, answered)) continue;
      await page.waitForTimeout(100);
    }
    expect(titles.slice(0, 2)).toEqual(['Team radio', 'Show stats']);
    expect(answered.length).toBeGreaterThan(0);
    for (const t of ['Quick calls', 'A battle', 'The flag', 'How you did'])
      expect(titles).toContain(t);
    // Finish goes home, and the tutorial counts as done.
    await expect(page).toHaveURL('/');
    expect(await page.evaluate((k) => localStorage.getItem(k), DONE_KEY)).toBe('1');
  });

  test('the race’s controls the coach points at, and Restart', async ({ page }) => {
    await fastLaps(page, 0.05);
    await offline(page);
    await page.goto('/tutorial');
    await page.getByRole('button', { name: 'Start the tutorial' }).click();
    const coach = page.getByRole('complementary', { name: 'Tutorial' });
    const title = coach.getByRole('heading', { level: 2 });
    for (let i = 0; i < 4; i++) await coach.getByRole('button', { name: 'Got it' }).click();
    const plan = page.getByRole('region', { name: 'Race plan' });
    // The plan editor and back.
    await plan.getByRole('button', { name: 'Build your own' }).click();
    await expect(plan.getByRole('button', { name: 'Go with your plan' })).toBeVisible();
    await plan.getByRole('button', { name: 'The engineer’s plans' }).click();
    await plan.getByRole('button', { name: /^Go with plan/ }).click();
    await expect(plan).toHaveCount(0);

    const controls = page.getByRole('navigation', { name: 'Controls' });
    const wide = test.info().project.name === 'desktop';
    // The coach stops on team radio, then on stats. (On a phone its card sits over the dock, so
    // the dock's buttons are pressed once it's gone.)
    await expect(title).toHaveText('Team radio', { timeout: 60_000 });
    await coach.getByRole('button', { name: 'Got it' }).click();
    await expect(title).toHaveText('Show stats', { timeout: 60_000 });
    await coach.getByRole('button', { name: 'Got it' }).click();
    await expect(coach).toHaveCount(0);

    // Between calls (answered with their first choice) and later coach steps (passed).
    const seen: Answered[] = [];
    const clear = async () => {
      for (let i = 0; i < 50; i++) {
        if (await coach.isVisible()) {
          await coach
            .getByRole('button', { name: 'Got it' })
            .click({ timeout: 1000 })
            .catch(() => {});
        } else if (!(await answerCall(page, seen))) return;
      }
    };
    // The pill opens and shuts the radio's orders.
    const pill = controls.getByRole('button', { name: 'Team radio', exact: true });
    await expect(async () => {
      await clear();
      if ((await pill.getAttribute('aria-pressed')) !== 'true') await pill.click({ timeout: 1000 });
      await expect(page.getByRole('region', { name: 'Team radio' })).toBeVisible({ timeout: 1000 });
      await clear();
      await pill.click({ timeout: 1000 });
      await expect(pill).toHaveAttribute('aria-pressed', 'false', { timeout: 1000 });
    }).toPass({ timeout: 60_000 });

    // Stats: the side panels on a wide screen, the dock's tabs on a phone.
    if (wide) {
      const stats = controls.getByRole('button', { name: 'Show stats' });
      await expect(async () => {
        await clear();
        await stats.click({ timeout: 1000 });
        await expect(page.getByRole('complementary', { name: 'Stats' })).toHaveAttribute(
          'aria-hidden',
          'false',
          { timeout: 1000 },
        );
        await clear();
        await controls.getByRole('button', { name: 'Focus view' }).click({ timeout: 1000 });
        await expect(stats).toHaveAttribute('aria-pressed', 'false', { timeout: 1000 });
      }).toPass({ timeout: 60_000 });
    } else {
      for (const tab of ['Standings', 'Car', 'Calls', 'Radio']) {
        const b = controls.getByRole('button', { name: tab, exact: true });
        await expect(async () => {
          await clear();
          if ((await b.getAttribute('aria-pressed')) !== 'true') await b.click({ timeout: 1000 });
          await expect(b).toHaveAttribute('aria-pressed', 'true', { timeout: 1000 });
        }).toPass({ timeout: 60_000 });
      }
    }

    if (wide) {
      // Practice can be restarted (a Gauntlet race can't): back to the tutorial's card.
      await clear();
      await page.getByRole('button', { name: 'Restart the race' }).click();
      await expect(page.getByRole('button', { name: 'Start the tutorial' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Canada 2022', level: 1 })).toBeVisible();
    }
  });

  test('Skip tutorial on the coach goes home mid-race', async ({ page }) => {
    await offline(page);
    await page.goto('/tutorial');
    await page.getByRole('button', { name: 'Start the tutorial' }).click();
    const coach = page.getByRole('complementary', { name: 'Tutorial' });
    await coach.getByRole('button', { name: 'Got it' }).click();
    await expect(coach.getByRole('heading', { name: 'The leaders' })).toBeVisible();
    await coach.getByRole('button', { name: 'Skip tutorial' }).click();
    await expect(page).toHaveURL('/');
    expect(await page.evaluate((k) => localStorage.getItem(k), DONE_KEY)).toBe('1');
  });

  test('the race’s own way home leaves the tutorial too', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'the brand button shows on a wide screen');
    await offline(page);
    await page.goto('/tutorial');
    await page.getByRole('button', { name: 'Start the tutorial' }).click();
    await page.getByRole('button', { name: /race engineer/ }).click();
    await expect(page).toHaveURL('/');
    expect(await page.evaluate((k) => localStorage.getItem(k), DONE_KEY)).toBe('1');
  });
});

test.describe('legal and credits', () => {
  for (const [path, heading, updated] of [
    ['/privacy', 'Privacy policy', '6 November 2026'],
    ['/terms', 'Terms of use', '6 November 2026'],
    ['/credits', 'Credits', '8 November 2026'],
  ] as const) {
    test(`${path}: the page, its header and its footer`, async ({ page }) => {
      await offline(page);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
      await expect(page.getByText(`Last updated ${updated}`)).toBeVisible();
      expect(await noSideScroll(page)).toBeLessThanOrEqual(0);

      // The brand goes home.
      await page.getByRole('banner').getByRole('link', { name: 'LastStint' }).click();
      await expect(page).toHaveURL('/');

      const footer = page.getByRole('contentinfo');
      for (const [name, to] of [
        ['Privacy', '/privacy'],
        ['Terms', '/terms'],
        ['Credits', '/credits'],
      ] as const) {
        await page.goto(path);
        await footer.getByRole('link', { name, exact: true }).click();
        await expect(page).toHaveURL(to);
      }
      await page.goto(path);
      const [osm] = await Promise.all([
        page.waitForEvent('popup'),
        footer.getByRole('link', { name: 'OpenStreetMap contributors' }).click(),
      ]);
      await expect(osm).toHaveURL('https://www.openstreetmap.org/copyright');
    });
  }

  test('privacy and terms: contact and cross links', async ({ page }) => {
    await offline(page);
    for (const path of ['/privacy', '/terms']) {
      await page.goto(path);
      const mail = page.getByRole('main').getByRole('link', { name: 'purohit.abhiram@gmail.com' });
      await expect(mail.first()).toHaveAttribute('href', 'mailto:purohit.abhiram@gmail.com');
      // A mail link opens the mail app, so the page stays.
      await mail.first().click();
      await expect(page).toHaveURL(path);
    }
    await page.goto('/terms');
    await page.getByRole('main').getByRole('link', { name: 'privacy policy' }).click();
    await expect(page).toHaveURL('/privacy');
    await expect(page.getByRole('heading', { name: 'Privacy policy' })).toBeVisible();
  });

  test('credits: every source and licence links out', async ({ page }) => {
    await offline(page);
    await page.goto('/credits');
    const main = page.getByRole('main');
    const links = await main
      .getByRole('link')
      .evaluateAll((as) =>
        as.map((a) => ({ name: (a.textContent ?? '').trim(), href: a.getAttribute('href') ?? '' })),
      );
    // Licensed sources with their licences, the courtesy sources, the three licences again in
    // the text, and the terms and privacy links.
    for (const name of ['TUM f1-timing-database', 'Jolpica-F1', 'F1DB', 'OpenF1', 'FastF1'])
      expect(links.map((l) => l.name)).toContain(name);
    const done = new Set<string>();
    for (const { name, href } of links) {
      if (done.has(`${name}|${href}`)) continue;
      done.add(`${name}|${href}`);
      await page.goto('/credits');
      await main.getByRole('link', { name, exact: true }).first().click();
      await expect(page).toHaveURL(href.startsWith('/') ? href : new URL(href).href);
    }
    // Licences are marked as such.
    await page.goto('/credits');
    await expect(main.getByRole('link', { name: 'CC BY 4.0' }).first()).toHaveAttribute(
      'rel',
      'license',
    );
  });
});

test.describe('how it works', () => {
  test('from the Daily card: the rules and grading, and Back to the card', async ({ page }) => {
    await mockApi(page, loadRace('abu-dhabi-2021'));
    await page.goto('/');
    // A signed-out player gets How to play first; Escape shuts it.
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'How it works', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'How it works', level: 1 })).toBeVisible();
    for (const h of ['The race', 'Grading', 'Data'])
      await expect(page.getByRole('heading', { name: h, level: 2 })).toBeVisible();
    await expect(page.getByText('Best call, or within half a point of it')).toBeVisible();
    await expect(page.getByText('A big miss')).toBeVisible();
    expect(await noSideScroll(page)).toBeLessThanOrEqual(0);
    // No race card while it's open.
    await expect(page.getByRole('button', { name: /pit wall/ })).toHaveCount(0);

    await page.getByRole('button', { name: 'Back: close How it works' }).click();
    await expect(page.getByRole('heading', { name: 'How it works', level: 1 })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /pit wall/ })).toBeVisible();
    // The card comes back as it opens (signed out, with How to play over it again).
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    // Opening it again works the same.
    await page.getByRole('button', { name: 'How it works', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'How it works', level: 1 })).toBeVisible();
  });
});

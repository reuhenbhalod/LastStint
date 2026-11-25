// L3: Eras against the real local Worker and D1 (docs/test-suite-spec.md S4), in production
// mode (ERAS_TEST_MODE false: release, publication and the unlock rule apply). The flows' D1
// has Eras 10 and 9 released and published, and the Eras player 20 Era 10 stars on other races
// (stack.mjs), one short of Era 9 (21 of 30). The player races Belgium 2023 from the era map to
// its stars, scored by the Worker (the attempt's seed is the Worker's, the replay and the stars
// too); the new star unlocks Era 9 on the map, and an Era 9 race then starts.
import { expect, test } from '../coverage.js';
import { flowOf, goWithPlan, preparePage, raceToFlag, workerApi } from './helpers.js';

const ERA_9 = 'The 2021 title fight';

interface Stars {
  result: boolean;
  strategist: boolean;
  mastery: boolean;
}

test('Eras: a race to its stars, and the star that unlocks Era 9', async ({ page }, info) => {
  test.setTimeout(480_000);
  const flow = flowOf(info);
  const ERAS_PLAYER = flow.erasPlayer;
  await preparePage(page, { at: flow.now, anonId: ERAS_PLAYER });
  const api = await workerApi(flow.now);

  await test.step('the map: Era 9 locked, one star to go', async () => {
    await page.goto('/eras');
    const era9 = page.getByRole('listitem').filter({ hasText: ERA_9 });
    await expect(era9).toContainText('Locked', { timeout: 30_000 });
    await expect(era9).toContainText('21 stars in Era 10 to unlock (1 to go)');
    // The Worker refuses an Era 9 attempt.
    const refused = await api.post('/api/eras/attempts', {
      data: { anonId: ERAS_PLAYER, raceId: 'turkey-2021' },
    });
    expect(refused.status()).toBe(403);
    expect(await refused.json()).toMatchObject({ error: 'era-locked' });
  });

  let earned: Stars | undefined;
  await test.step('Belgium 2023: from its card to the stars', async () => {
    await page.locator('main a[href="/eras/10"]').click();
    await expect(page).toHaveURL(/\/eras\/10$/);
    const started = page.waitForResponse(
      (r) => r.url().endsWith('/api/eras/attempts') && r.request().method() === 'POST',
    );
    await page.getByRole('link', { name: /^Belgium 2023\s*, play$/ }).click();
    await page.getByRole('button', { name: /^Start the race/ }).click({ timeout: 30_000 });
    const attempt = await started;
    expect(attempt.status()).toBe(201);
    await goWithPlan(page);
    const submitted = page.waitForResponse(
      (r) => /\/api\/eras\/attempts\/[^/]+$/.test(r.url()) && r.request().method() === 'POST',
      { timeout: 300_000 },
    );
    await raceToFlag(page);
    await page.getByRole('button', { name: 'See how you did' }).click();
    const res = await submitted;
    expect(res.status()).toBe(200);
    const body = (await res.json()) as {
      stars: Stars;
      newStars: Stars;
      progress: { stars: Stars };
    };
    earned = body.newStars;
    expect(Object.values(body.stars).some(Boolean)).toBe(true);
    await expect(page.getByRole('region', { name: 'Stars' })).toContainText('Stars · Era 10', {
      timeout: 60_000,
    });
  });

  await test.step('Era 9 unlocked on the map, and its races start', async () => {
    const n = Object.values(earned as Stars).filter(Boolean).length;
    const eras = await (await api.get(`/api/eras?anonId=${ERAS_PLAYER}`)).json();
    const byId = (id: number) => eras.eras.find((e: { eraId: number }) => e.eraId === id);
    expect(byId(10)).toMatchObject({ stars: 20 + n, unlocked: true });
    expect(byId(9)).toMatchObject({ unlocked: true, released: true });

    await page.goto('/eras');
    const open9 = page.getByRole('link', { name: new RegExp(`${ERA_9}[\\s\\S]*Unlocked`) });
    await expect(open9).toBeVisible({ timeout: 30_000 });
    await open9.click();
    await expect(page).toHaveURL(/\/eras\/9$/);
    const started = page.waitForResponse(
      (r) => r.url().endsWith('/api/eras/attempts') && r.request().method() === 'POST',
    );
    await page.getByRole('link', { name: /^Turkey 2021\s*, play$/ }).click();
    await page.getByRole('button', { name: /^Start the race/ }).click({ timeout: 30_000 });
    expect((await started).status()).toBe(201);
  });
});

import { test } from '../coverage.js';
import { decision, fastForward, loadRace, openDaily, session, startRace } from './daily.js';

const races = (process.env.EXPLORE ?? 'spain-2025').split(',');
for (const id of races) {
  test(`explore ${id}`, async ({ page }) => {
    test.setTimeout(300_000);
    const model = loadRace(id);
    await openDaily(page, model);
    await startRace(page, (process.env.PLAN as 'A') ?? undefined);
    const out: string[] = [];
    for (let guard = 0; guard < 200; guard++) {
      const s = await session(page);
      if (s.phase === 'finished' || s.phase === 'results') break;
      if (s.phase === 'decision') {
        const card = decision(page);
        const tag = await card.getByRole('alert').innerText();
        const names = await card.getByRole('button').allInnerTexts();
        out.push(`  DECISION ${tag} :: ${names.map((n) => n.split('\n')[0]).join(' | ')}`);
        await card.getByRole('button').first().click();
        if (await card.isVisible().catch(() => false)) {
          const t = await card
            .getByRole('button')
            .allInnerTexts()
            .catch(() => []);
          out.push(`    tyres: ${t.map((n) => n.split('\n')[0]).join(' | ')}`);
          await card
            .getByRole('button')
            .first()
            .click()
            .catch(() => {});
        }
        continue;
      }
      await fastForward(page, s.lap + 1);
      await page.waitForTimeout(150);
      const s2 = await session(page);
      const chips = await page.locator('section[aria-label="Race"] span.rounded').allInnerTexts();
      const cards = await page
        .locator(
          'section[aria-label="Quick call"], section[aria-label="Battle call"], section[aria-label="New plan"], section[aria-label="Planned stop"]',
        )
        .allInnerTexts();
      const r = s2.cars[model.rival];
      const me = s2.cars[model.userSide];
      out.push(
        `L${s2.lap} ${s2.flag}/${s2.nextFlag} ${me?.compound}${me?.tyreAge} riv:${r?.retired ? 'RET' : r?.compound} chips=[${chips.join(';')}] ${cards.map((c) => c.replace(/\s+/g, ' ').slice(0, 220)).join(' || ')}`,
      );
    }
    console.log(`=== ${id}\n${out.join('\n')}`);
  });
}

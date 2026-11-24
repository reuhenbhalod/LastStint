import { test } from '../coverage.js';
import { loadRace, openDaily, openPanel, startRace } from './daily.js';
test('probe', async ({ page }) => {
  await openDaily(page, loadRace('spain-2025'));
  await startRace(page, 'B');
  await openPanel(page, 'Team radio');
  console.log(await page.getByRole('region', { name: 'Team radio' }).ariaSnapshot());
});

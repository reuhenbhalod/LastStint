// Renders the ground under the 2D map (realistic UI spec): each circuit's SVG from the
// pipeline's basemap step (cache/basemap/<circuit>.svg) to a PNG beside it, at the size
// data/basemap/index.json asks for. `pipeline basemap` runs this, then makes the WebPs.
//
//   node apps/web/scripts/basemap.mjs [circuit...]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const index = JSON.parse(fs.readFileSync(path.join(root, 'data/basemap/index.json'), 'utf8'));
const only = process.argv.slice(2);

const browser = await chromium.launch();
for (const [circuit, c] of Object.entries(index.circuits)) {
  if (only.length && !only.includes(circuit)) continue;
  const svg = path.join(root, 'cache/basemap', `${circuit}.svg`);
  const page = await browser.newPage({
    viewport: { width: Math.ceil(c.w), height: Math.ceil(c.h) },
    deviceScaleFactor: c.px[0] / c.w,
  });
  await page.goto(`file://${svg}`);
  await page.screenshot({
    path: path.join(root, 'cache/basemap', `${circuit}.png`),
    clip: { x: 0, y: 0, width: c.w, height: c.h },
  });
  await page.close();
  console.log(circuit, `${c.px[0]}×${c.px[1]}`);
}
await browser.close();

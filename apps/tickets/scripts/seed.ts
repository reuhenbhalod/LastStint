// Build data/seed.sql from data/tickets.json (an array of { title, description, category,
// status, notes, source }). `pnpm seed:local` / `seed:remote` run this, then load the SQL into
// the local or the real D1 with `wrangler d1 execute`.
//
//   tsx scripts/seed.ts

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { seedSql } from './seedSql.js';

const input = fileURLToPath(new URL('../data/tickets.json', import.meta.url));
const output = fileURLToPath(new URL('../data/seed.sql', import.meta.url));

const entries: unknown = JSON.parse(readFileSync(input, 'utf8'));
const sql = seedSql(entries, Date.now());
writeFileSync(output, sql);
console.log(`wrote ${output} (${Array.isArray(entries) ? entries.length : 0} tickets)`);

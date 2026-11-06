// Build data/tickets-seed.sql from data/tickets.json (an array of { title, description,
// category, status, notes, source }). `pnpm tickets:seed:local` / `tickets:seed:remote` run
// this, then load the SQL into the local or the real pitwall-db with `wrangler d1 execute`.
// Seeding again adds only tickets whose title isn't there yet (scripts/tickets-seed-sql.ts).
//
//   tsx scripts/tickets-seed.ts

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { workerDir } from './d1.js';
import { seedSql } from './tickets-seed-sql.js';

const input = join(workerDir, 'data', 'tickets.json');
const output = join(workerDir, 'data', 'tickets-seed.sql');

const entries: unknown = JSON.parse(readFileSync(input, 'utf8'));
writeFileSync(output, seedSql(entries, Date.now()));
console.log(`wrote ${output} (${Array.isArray(entries) ? entries.length : 0} tickets)`);

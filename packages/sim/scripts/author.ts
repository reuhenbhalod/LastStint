// Moment author (races batch 1): builds a race's decision moments to the Abu Dhabi recipe and
// keeps only real dilemmas.
//   pnpm --filter @laststint/sim author <race-id> [--rival CODE] [--target T] [--eras]
//                                         [--samples N] [--max N] [--write]
// (--max caps the graded calls: survivor races use 2.)
//
// Candidates, all graded from the real race's state at their lap (pauseAt):
//   - the race plan when you take over: run to plan, manage, push, box now (two compounds);
//   - the moment finder's stop calls (SC, VSC, the rival's stops, the undercut window, the
//     tyre cliff), offered as stay out / box per compound / box next lap;
//   - pace calls every few laps: push, standard, manage, push and attack;
//   - battle calls (defend, hold, attack) at a restart, and late in the race when the rival
//     is within reach.
// Kept: the race plan, then up to MAX_MOMENTS more that pass the quality bar (verdict
// "keep"), at least MIN_SPACING laps apart, the most tense first. --rival grades against
// another car (a "defend" race: the car behind); --target grades on win, position:N,
// beat-rival (the default), deny:CODE:N or team:A:B instead; --write saves
// data/moments/<race>.json and puts the moments in the race file.
//
// --eras authors the race as Eras plays it (eras build plan 6.2): from its overlay's
// eras.userSide (data/eras/<race>.json; the hard-call side, the rival the other storyline
// driver). A race in a Daily or Gauntlet pool keeps its race file: --write puts its moments in
// the overlay's decisionMoments instead.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fromSide } from '../src/eras/hard-calls.js';
import type { Target } from '../src/grade.js';
import type { RaceModel } from '../src/types.js';
import { authorMoments } from './authoring.js';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const raceId = args[0];
if (!raceId) {
  console.error(
    'usage: author <race-id> [--rival CODE] [--target T] [--eras] [--samples N] [--write]',
  );
  process.exit(2);
}

/** --target: win | position:N | beat-rival | deny:CODE:N | team:A:B. */
function parseTarget(spec: string | undefined): Target {
  const [kind, a, b] = (spec ?? 'beat-rival').split(':');
  if (kind === 'win') return { kind: 'win' };
  if (kind === 'beat-rival') return { kind: 'beat-rival' };
  if (kind === 'position' && Number(a) >= 1) return { kind: 'position', atBest: Number(a) };
  if (kind === 'deny' && a && Number(b) >= 2)
    return { kind: 'deny', rival: a, position: Number(b) };
  if (kind === 'team' && Number(a) >= 1 && Number(b) >= 1)
    return { kind: 'team', positions: [Number(a), Number(b)] };
  console.error(`author: bad --target ${spec}`);
  process.exit(2);
}

const samples = flag('--samples') ? Number(flag('--samples')) : undefined;
const write = args.includes('--write');
const eras = args.includes('--eras');
const target = parseTarget(flag('--target'));
const racePath = join(repo, 'data', 'races', `${raceId}.json`);
const overlayPath = join(repo, 'data', 'eras', `${raceId}.json`);
const raw = readFileSync(racePath, 'utf8');
const file = JSON.parse(raw) as RaceModel;
const overlay =
  eras && existsSync(overlayPath) ? JSON.parse(readFileSync(overlayPath, 'utf8')) : {};
const side: string | undefined = overlay.eras?.userSide;
const seen = eras && side ? fromSide(file, side) : file;
const model: RaceModel = { ...seen, rival: flag('--rival') ?? seen.rival, decisionMoments: [] };
const max = flag('--max') ? Number(flag('--max')) : undefined;
const picked = authorMoments(model, samples, (line) => console.log(line), max, target);
console.log(`picked ${picked.length} moments: ${picked.map((p) => `${p.id}@${p.lap}`).join(', ')}`);
const pools = JSON.parse(readFileSync(join(repo, 'data', 'pools.json'), 'utf8')) as {
  daily: string[];
  survivor: Record<string, unknown>;
};
const shared = pools.daily.includes(raceId) || Object.hasOwn(pools.survivor, raceId);
if (write && eras && shared) {
  // A Daily/Gauntlet race's file never changes (eras build plan, "Shared races").
  if (model.rival !== seen.rival) {
    console.error('author: --rival must stay the Eras rival on a shared race (--eras --write)');
    process.exit(2);
  }
  const out = { ...overlay, decisionMoments: picked };
  writeFileSync(overlayPath, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`wrote the decisionMoments of data/eras/${raceId}.json (a shared race)`);
} else if (write) {
  if (eras && side && side !== file.userSide) {
    console.error(`author: ${raceId} is built for ${file.userSide}; rebuild it for ${side} first`);
    process.exit(2);
  }
  writeFileSync(
    join(repo, 'data', 'moments', `${raceId}.json`),
    `${JSON.stringify(picked, null, 2)}\n`,
  );
  const out = { ...JSON.parse(raw), rival: model.rival, decisionMoments: picked };
  writeFileSync(racePath, `${JSON.stringify(out, null, 2)}${raw.endsWith('\n') ? '\n' : ''}`);
  console.log(`wrote data/moments/${raceId}.json and the race file`);
}

// Seed tuner (races batch 1): finds the daily seed that makes a race play like Abu Dhabi 2021.
// The moments are graded without hindsight, so they don't depend on the seed; the seed only
// sets the race's luck. For each candidate seed, a fixed sample of answer paths is played the
// way the server replays a run (initRun + the logged calls, no grading), and the seed is
// judged on:
//   - real way: answering every call the way the real team did reaches the real result
//     (P-for-P, or within one place as a fallback, and on the same side of the rival), and
//     the rival finishes within a place of theirs (no luck taking them out), so the race
//     still tells its real story;
//   - good play wins: taking the best-graded option at every call (what the game shows the
//     player) finishes ahead of the rival, the game's goal (game/goal.ts) in both a beat race
//     and a defend race;
//   - careless play mostly loses: the share of random answer paths that win is in BAND,
//     closest to --target. Abu Dhabi's own seed: good play wins, random play wins 1%.
// Between calls, each player uses the BOX button as a real one would (calls made between
// pauses, as in examples/daily-race.ts): the real way boxes on the real team's stop laps, the
// good player when the grader's sensible-strategist plan (planRemainingStop) says now, and
// random play only when the two-compound warning shows (the last 5 laps).
// The current seed is kept when it already passes.
//   pnpm --filter @boxthislap/sim tune <race-id> [--seeds N] [--paths N] [--target 0.15] [--write]

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type DecisionMoment,
  type RaceModel,
  type Run,
  answerMoment,
  classify,
  decide,
  gradeMoment,
  initRun,
  isFinished,
  planRemainingStop,
  ruleSatisfied,
  stepLap,
} from '../src/index.js';
import { mulberry32 } from '../src/rng.js';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const raceId = args[0];
if (!raceId) {
  console.error('usage: tune <race-id> [--seeds N] [--paths N] [--target share] [--write]');
  process.exit(2);
}
const SEEDS = Number(flag('--seeds') ?? 80);
const PATHS = Number(flag('--paths') ?? 120);
const write = args.includes('--write');
const TARGET = Number(flag('--target') ?? 0.15);
/** Random-play win shares a tuned race may have. */
const BAND = [0.03, 0.35] as const;
/** Good-player runs to try (they grade every call, about half a second each). */
const GOOD_TRIES = 15;

const load = (id: string) => {
  const path = join(repo, 'data', 'races', `${id}.json`);
  const raw = readFileSync(path, 'utf8');
  return { path, raw, model: JSON.parse(raw) as RaceModel };
};

/** The answer the real team gave, or the nearest thing to "carry on" when the call wasn't one
 * they faced (a pace or battle call). */
function realPick(m: DecisionMoment): string {
  if (m.realOptionId && m.options.some((o) => o.id === m.realOptionId)) return m.realOptionId;
  for (const id of ['plan-standard', 'stay', 'standard', 'hold']) {
    if (m.options.some((o) => o.id === id)) return id;
  }
  return m.options[0]?.id as string;
}

/** A fixed sample of answer paths (the same for every seed), with the real path first. */
function paths(moments: DecisionMoment[], n: number): string[][] {
  const real = moments.map(realPick);
  const rng = mulberry32(1);
  const out: string[][] = [real];
  const seen = new Set([real.join()]);
  const total = moments.reduce((p, m) => p * m.options.length, 1);
  while (out.length < Math.min(n, total)) {
    const p = moments.map(
      (m) => m.options[Math.floor(rng.next() * m.options.length)]?.id as string,
    );
    if (seen.has(p.join())) continue;
    seen.add(p.join());
    out.push(p);
  }
  return out;
}

type Box = (run: Run) => void;

/** True if the player's car has a stop still to come. */
const stopAhead = (run: Run) =>
  !!run.state.cars[run.model.userSide]?.strategy.some((s) => s.lap > run.state.lap);

/** Box next lap (the in-lap; the stop is charged on the lap after). */
const boxNext = (run: Run, compound: string) =>
  decide(run, { lap: run.state.lap + 1, kind: 'pit', compound });

/** The real way: the real team's stops after the takeover, on their laps. */
const realBox: Box = (run) => {
  const me = run.model.drivers.find((d) => d.code === run.model.userSide);
  const stop = me?.realStrategy.find((s) => s.lap - 1 === run.state.lap + 1);
  if (stop && !stopAhead(run) && stop.lap - 1 < run.model.race.laps) boxNext(run, stop.to);
};

/** The good player: the sensible-strategist plan, boxing when it says now. */
const sensibleBox: Box = (run) => {
  if (stopAhead(run)) return;
  const stop = planRemainingStop(run);
  if (stop && stop.lap <= run.state.lap + 2 && run.state.lap + 1 < run.model.race.laps) {
    boxNext(run, stop.to);
  }
};

/** Random play: boxes only when the two-compound warning shows. */
const warnedBox: Box = (run) => {
  const me = run.state.cars[run.model.userSide];
  if (!me || me.retired || ruleSatisfied(me) || stopAhead(run)) return;
  if (run.model.race.laps - run.state.lap > 5 || run.state.lap + 1 >= run.model.race.laps) return;
  const to =
    planRemainingStop(run)?.to ??
    Object.keys(run.model.compounds).find((c) => !me.compoundsUsed.includes(c));
  if (to) boxNext(run, to);
};

/** Where the user's car finishes, answering each call with `choose`: the server's replay. */
function play(
  model: RaceModel,
  seed: number,
  moments: DecisionMoment[],
  choose: (i: number, run: Run) => string,
  box: Box,
) {
  const run = initRun(model, seed, { decisions: [] });
  while (!isFinished(run)) {
    const i = moments.findIndex((m) => m.lap === run.state.lap + 1);
    if (i >= 0) answerMoment(run, moments[i] as DecisionMoment, choose(i, run));
    stepLap(run);
    const pausing = moments.some((m) => m.lap === run.state.lap + 1);
    if (!isFinished(run) && !pausing) box(run);
  }
  const result = classify(run);
  const out = (code: string) =>
    result.disqualified.includes(code) || !result.order.includes(code)
      ? 99
      : result.order.indexOf(code) + 1;
  const pos = out(model.userSide);
  return { pos, rival: out(model.rival), win: pos < out(model.rival) };
}

/** One answer path, no grading. */
const finish = (
  model: RaceModel,
  seed: number,
  moments: DecisionMoment[],
  path: string[],
  box: Box,
) => play(model, seed, moments, (i) => path[i] as string, box);

/** The good player: the best-graded option at every call. */
const goodPlay = (model: RaceModel, seed: number, moments: DecisionMoment[]) =>
  play(
    model,
    seed,
    moments,
    (i, run) => {
      const m = moments[i] as DecisionMoment;
      const g = gradeMoment(run, m.options, m.target);
      return [...g.options].sort((a, b) => b.probability - a.probability)[0]?.id as string;
    },
    sensibleBox,
  );

interface Trial {
  seed: number;
  share: number;
  realWay: number;
  realWayRival: number;
  realWayWins: boolean;
  best: number;
}

function trial(model: RaceModel, seed: number, sample: string[][]): Trial {
  const moments = [...model.decisionMoments].sort((a, b) => a.lap - b.lap);
  const runs = sample.map((p, k) => finish(model, seed, moments, p, k === 0 ? realBox : warnedBox));
  const real = runs[0] as { pos: number; rival: number; win: boolean };
  return {
    seed,
    share: runs.filter((r) => r.win).length / runs.length,
    realWay: real.pos,
    realWayRival: real.rival,
    realWayWins: real.win,
    best: Math.min(...runs.filter((r) => r.win).map((r) => r.pos)),
  };
}

const { path, raw, model } = load(raceId);
const moments = [...model.decisionMoments].sort((a, b) => a.lap - b.lap);
const sample = paths(moments, PATHS);
const realPos = model.realResult.indexOf(model.userSide) + 1;
const rivalPos = model.realResult.indexOf(model.rival) + 1;
const realWins = realPos > 0 && realPos < rivalPos;

const seeds = [model.race.seed];
const pick = mulberry32(raceId.split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7));
while (seeds.length < SEEDS) {
  const s = 1 + Math.floor(pick.next() * 99_999);
  if (!seeds.includes(s)) seeds.push(s);
}

const t0 = Date.now();
const trials = seeds.map((s) => trial(model, s, sample));
const realWay = (t: Trial, slack: number) =>
  t.realWayWins === realWins &&
  Math.abs(t.realWay - realPos) <= slack &&
  Math.abs(t.realWayRival - rivalPos) <= 1;
const slack = trials.some((t) => t.share > 0 && realWay(t, 0)) ? 0 : 1;
const inBand = (t: Trial) => t.share >= BAND[0] && t.share <= BAND[1];
const now = trials[0] as Trial;
console.log(
  `seeds: ${trials.filter((t) => realWay(t, slack)).length} play the real way (within ${slack}), ${trials.filter((t) => realWay(t, slack) && inBand(t)).length} of them in the band; shares ${trials
    .map((t) => Math.round(t.share * 100))
    .sort((a, b) => a - b)
    .join(' ')}`,
);
// The current seed first (kept if it passes), then the rest, in the band first, closest to
// the target first.
const order = [
  now,
  ...trials
    .slice(1)
    .filter((t) => t.share > 0 && realWay(t, slack))
    .sort(
      (a, b) =>
        Number(inBand(b)) - Number(inBand(a)) ||
        Math.abs(a.share - TARGET) - Math.abs(b.share - TARGET),
    ),
];

const fmt = (t: Trial) =>
  `seed ${String(t.seed).padStart(5)}: random play wins ${(t.share * 100).toFixed(0).padStart(3)}%, real way P${t.realWay} vs ${model.rival} P${t.realWayRival} (real P${realPos})`;
console.log(
  `${raceId}: ${model.userSide} vs ${model.rival} (${realWins ? 'defend' : 'beat'}), ${moments.length} calls, ${sample.length} paths x ${seeds.length} seeds (${((Date.now() - t0) / 1000).toFixed(0)}s), target ${(TARGET * 100).toFixed(0)}%`,
);
let chosen: Trial | undefined;
let tries = 0;
for (const t of order) {
  const passesRealWay = realWay(t, slack);
  if (!passesRealWay || !inBand(t)) {
    if (t === now)
      console.log(`now    ${fmt(t)}: ${passesRealWay ? 'out of the band' : 'real way off'}`);
    continue;
  }
  if (tries++ >= GOOD_TRIES) break;
  const good = goodPlay(model, t.seed, moments);
  console.log(
    `${t === now ? 'now   ' : 'try   '} ${fmt(t)}, good play P${good.pos} ${good.win ? 'wins' : 'loses'}`,
  );
  if (good.win) {
    chosen = t;
    break;
  }
}
if (!chosen) {
  console.log('no seed passes: real way, good play wins, random play in the band');
  process.exit(1);
}
console.log(`chosen ${fmt(chosen)}${chosen === now ? ' (unchanged)' : ''}`);

if (write && chosen.seed !== model.race.seed) {
  // Only the seed line changes: the rest stays as the pipeline wrote it (CI rebuilds the
  // files and checks they match, so a JSON round trip's 0 for 0.0 would fail it).
  const seedLine = new RegExp(`("seed":\\s*)${model.race.seed}\\b`);
  if (!seedLine.test(raw)) throw new Error('no seed line to update');
  writeFileSync(path, raw.replace(seedLine, `$1${chosen.seed}`));
  console.log(`wrote seed ${chosen.seed} to data/races/${raceId}.json`);
}

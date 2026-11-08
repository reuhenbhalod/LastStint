// Expert rival cost benchmark (eras build plan 9.1): what grading the rival's own calls
// (rivals/expert.ts) costs per decision and per race replay, on this machine, with a
// mid-range-phone estimate.
//   pnpm --filter @laststint/sim bench:rival [--race abu-dhabi-2021] [--phone 5]
//
// Expert's decision points aren't defined yet (rivals/policy.ts RIVAL_POLICY_GAPS), so the
// replay uses a proxy: the laps before each of the rival's real stops and each SC/VSC, and the
// lap of each of the user's real stops (the calls a reacting rival answers). Each point grades
// three options (keep its plan, box next lap, stop three laps later).
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GRADE_SAMPLES } from '../src/grade.js';
import { type RivalOption, gradeRivalMoment, rivalPlayout } from '../src/rivals/expert.js';
import { type Run, initRun, isFinished, realDecisions, stepLap } from '../src/sim.js';
import type { PitStop, RaceModel } from '../src/types.js';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback;
};
const raceId = arg('--race', 'abu-dhabi-2021');
const phone = Number(arg('--phone', '5'));
const load = (id: string) =>
  JSON.parse(readFileSync(join(repo, 'data', 'races', `${id}.json`), 'utf8')) as RaceModel;

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] as number;
}
function time(fn: () => void, reps: number): number {
  fn(); // warm up the JIT
  const t: number[] = [];
  for (let i = 0; i < reps; i++) {
    const t0 = performance.now();
    fn();
    t.push(performance.now() - t0);
  }
  return median(t);
}
const ms = (x: number) => (x >= 100 ? x.toFixed(0) : x.toFixed(2));

/** A live run on the real calls, paused after `lap`. */
function pausedAt(model: RaceModel, lap: number): Run {
  const run = initRun(model, model.race.seed, { decisions: realDecisions(model) });
  while (run.state.lap < lap) stepLap(run);
  return run;
}

/** Keep the plan, box next lap, or stop three laps later than planned. */
function rivalOptions(run: Run): RivalOption[] {
  const { model, state } = run;
  const rival = state.cars[model.rival];
  if (!rival) throw new Error('no rival');
  const lap = state.lap;
  const plan = rival.strategy.filter((s) => s.lap > lap).sort((a, b) => a.lap - b.lap);
  const next = plan[0];
  const dry = Object.keys(model.compounds).filter((c) => c !== 'INTERMEDIATE' && c !== 'WET');
  const to = next?.to ?? dry.find((c) => c !== rival.compound) ?? rival.compound;
  const boxNow: PitStop[] = [{ lap: lap + 1, to, added: true }, ...plan.slice(1)];
  const later = Math.min(model.race.laps - 1, (next?.lap ?? lap + 1) + 3);
  const extend: PitStop[] = [{ lap: later, to, added: true }, ...plan.slice(1)];
  return [
    { id: 'keep', stops: plan },
    { id: 'box-now', stops: boxNow.filter((s) => s.lap < model.race.laps) },
    { id: 'extend', stops: extend.filter((s) => s.lap > lap) },
  ];
}

/** Proxy decision points (see the header): laps the rival would grade after. */
function decisionPoints(model: RaceModel): number[] {
  const first = model.race.takeoverLap + 1;
  const last = model.race.laps - 2;
  const pts = new Set<number>();
  const rival = model.drivers.find((d) => d.code === model.rival);
  const user = model.drivers.find((d) => d.code === model.userSide);
  for (const s of rival?.realStrategy ?? []) pts.add(s.lap - 1);
  for (const e of model.events) if (e.type === 'SC' || e.type === 'VSC') pts.add(e.lap - 1);
  for (const s of user?.realStrategy ?? []) pts.add(s.lap);
  return [...pts].filter((l) => l >= first && l <= last).sort((a, b) => a - b);
}

const model = load(raceId);
const { laps, takeoverLap } = model.race;
// From the takeover (the longest playouts) and from halfway through the window.
const froms = [takeoverLap + 1, Math.floor((takeoverLap + 1 + laps) / 2)];
console.log(`race ${raceId}: laps ${takeoverLap + 1}-${laps}, phone factor ${phone}x`);

// 1. A plain live replay (what the server does today to verify an attempt).
const replay = time(() => {
  const run = initRun(model, model.race.seed, { decisions: realDecisions(model) });
  while (!isFinished(run)) stepLap(run);
}, 21);
console.log(`live replay, standard rival: ${ms(replay)} ms`);

// 2. One rival playout to the flag.
for (const from of froms) {
  const run = pausedAt(model, from);
  const [keep] = rivalOptions(run);
  const t = time(() => {
    for (let i = 0; i < 50; i++) {
      const fork = rivalPlayout(run, i, keep as RivalOption);
      while (!isFinished(fork)) stepLap(fork);
    }
  }, 7);
  console.log(`one rival playout from lap ${from} (${laps - from} laps): ${ms(t / 50)} ms`);
}

// 3. One graded rival decision: 3 options x samples.
for (const samples of [GRADE_SAMPLES, 100, 50]) {
  for (const from of froms) {
    const run = pausedAt(model, from);
    const options = rivalOptions(run);
    const t = time(() => gradeRivalMoment(run, options, samples), 3);
    console.log(
      `rival decision, ${options.length} options x ${samples} samples, lap ${from}: ${ms(t)} ms (phone ~${ms(t * phone)} ms)`,
    );
  }
}

// 4. How many decision points races have (the proxy), across every race.
const counts = readdirSync(join(repo, 'data', 'races'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => decisionPoints(load(f.replace(/\.json$/, ''))).length);
console.log(
  `proxy decision points per race over ${counts.length} races: min ${Math.min(...counts)}, median ${median(counts)}, max ${Math.max(...counts)}`,
);

// 5. A whole Expert-style replay: the live replay plus a graded rival call at each point.
const points = decisionPoints(model);
for (const samples of [GRADE_SAMPLES, 100]) {
  const t0 = performance.now();
  const run = initRun(model, model.race.seed, { decisions: realDecisions(model) });
  while (!isFinished(run)) {
    stepLap(run);
    if (points.includes(run.state.lap)) gradeRivalMoment(run, rivalOptions(run), samples);
  }
  const t = performance.now() - t0;
  console.log(
    `expert-style replay, ${points.length} points x 3 options x ${samples} samples: ${ms(t)} ms (phone ~${ms(t * phone)} ms)`,
  );
}

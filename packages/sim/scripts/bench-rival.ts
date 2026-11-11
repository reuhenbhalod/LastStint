// Expert rival cost benchmark (eras build plan 9.1; eras spec §7 "Cost"): what Expert's own
// grader costs per decision and per race at EXPERT_SAMPLES samples, inline and split across
// worker threads (as the background grading Web Workers would), what the server's claims
// replay costs, and a mid-range-phone estimate.
//   pnpm --filter @laststint/sim bench:rival [--race abu-dhabi-2021] [--phone 5] [--workers 3]
//
// The player makes the real team's calls (realDecisions); the rival's decision points are
// Expert's own (rivals/react.ts).
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import type { GradeJobResult } from '../src/grade.js';
import { replayWithRivalClaims } from '../src/rivals/claims.js';
import {
  type RivalGradeJob,
  gradeRivalMoment,
  mergeRivalGradeJobs,
  rivalGradeJob,
} from '../src/rivals/expert.js';
import { EXPERT_SAMPLES } from '../src/rivals/policy.js';
import { resolveRivalDecision, rivalChoices } from '../src/rivals/react.js';
import { initRun, isFinished, realDecisions, stepLap } from '../src/sim.js';
import type { RaceModel } from '../src/types.js';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback;
};
const raceId = arg('--race', 'abu-dhabi-2021');
const phone = Number(arg('--phone', '5'));
const nWorkers = Number(arg('--workers', '3'));
const load = (id: string) =>
  JSON.parse(readFileSync(join(repo, 'data', 'races', `${id}.json`), 'utf8')) as RaceModel;

function quantiles(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))] as number;
  return { min: s[0] as number, median: q(0.5), p90: q(0.9), max: s[s.length - 1] as number };
}
const ms = (x: number) => (x >= 100 ? x.toFixed(0) : x.toFixed(1));
const fmt = (q: ReturnType<typeof quantiles>) =>
  `min ${ms(q.min)}, median ${ms(q.median)}, p90 ${ms(q.p90)}, max ${ms(q.max)}`;

/** An Expert race on the real calls, with each decision graded inline and timed. */
function expertRace(model: RaceModel, samples = EXPERT_SAMPLES) {
  const run = initRun(model, model.race.seed, {
    decisions: realDecisions(model),
    rivalPolicy: 'expert',
    rivalGrading: 'deferred',
  });
  const decisions: Array<{ ms: number; options: number }> = [];
  const t0 = performance.now();
  while (!isFinished(run)) {
    stepLap(run);
    const pending = run.rival?.pending;
    if (!pending) continue;
    const d0 = performance.now();
    const grade = gradeRivalMoment(run, pending.options, samples);
    decisions.push({ ms: performance.now() - d0, options: pending.options.length });
    resolveRivalDecision(run, grade.best as never, grade.probabilities);
  }
  return { run, total: performance.now() - t0, decisions };
}

const model = load(raceId);
console.log(
  `race ${raceId}: laps ${model.race.takeoverLap + 1}-${model.race.laps}, ${EXPERT_SAMPLES} samples, phone factor ${phone}x`,
);

// 1. A plain live replay (what the server does today to verify an attempt).
const plain: number[] = [];
for (let i = 0; i < 21; i++) {
  const t0 = performance.now();
  const run = initRun(model, model.race.seed, { decisions: realDecisions(model) });
  while (!isFinished(run)) stepLap(run);
  plain.push(performance.now() - t0);
}
console.log(`live replay, standard rival: ${ms(quantiles(plain).median)} ms`);

// 2. This race with an Expert rival, graded inline.
expertRace(model); // warm up the JIT
const one = expertRace(model);
console.log(
  `expert race (inline): ${one.decisions.length} decisions, ${ms(one.total)} ms (phone ~${ms(one.total * phone)} ms); per decision ${fmt(quantiles(one.decisions.map((d) => d.ms)))} ms`,
);

// 3. The server's check: the replay with the claimed choices (no grading).
const claims = rivalChoices(one.run);
const sv: number[] = [];
for (let i = 0; i < 21; i++) {
  const t0 = performance.now();
  replayWithRivalClaims(model, model.race.seed, realDecisions(model), claims);
  sv.push(performance.now() - t0);
}
console.log(`server claims replay: ${ms(quantiles(sv).median)} ms`);

// 4. Every race: decisions per race, cost per decision and per race (inline, this machine).
const perRace: number[] = [];
const perDecision: number[] = [];
const counts: number[] = [];
for (const f of readdirSync(join(repo, 'data', 'races')).filter((x) => x.endsWith('.json'))) {
  const r = expertRace(load(f.replace(/\.json$/, '')));
  perRace.push(r.total);
  counts.push(r.decisions.length);
  for (const d of r.decisions) perDecision.push(d.ms);
}
const dq = quantiles(perDecision);
console.log(`over ${perRace.length} races:`);
console.log(`  decisions per race: ${fmt(quantiles(counts))}`);
console.log(`  per decision: ${fmt(dq)} ms`);
console.log(`  per race: ${fmt(quantiles(perRace))} ms`);
console.log(
  `  phone estimate: per decision median ~${ms(dq.median * phone)} ms, worst ~${ms(dq.max * phone)} ms`,
);

// 5. One decision split across worker threads (the background grading path).
if (nWorkers > 0) {
  const workers = Array.from(
    { length: nWorkers },
    () =>
      // Register tsx's TypeScript loader inside the worker, then load the job runner.
      new Worker(
        `import('tsx/esm/api').then(({ register }) => { register(); return import(${JSON.stringify(
          new URL('./bench-rival-worker.ts', import.meta.url).href,
        )}); });`,
        { eval: true },
      ),
  );
  const run = initRun(model, model.race.seed, {
    decisions: realDecisions(model),
    rivalPolicy: 'expert',
    rivalGrading: 'deferred',
  });
  while (!run.rival?.pending) stepLap(run);
  const job: RivalGradeJob = rivalGradeJob(run);
  const once = () =>
    Promise.all(
      workers.map(
        (w, i) =>
          new Promise<GradeJobResult>((resolve) => {
            w.once('message', resolve);
            w.postMessage({
              job,
              from: Math.floor((i * job.samples) / nWorkers),
              to: Math.floor(((i + 1) * job.samples) / nWorkers),
            });
          }),
      ),
    );
  await once(); // warm up
  const wt: number[] = [];
  let merged = mergeRivalGradeJobs(job, await once());
  for (let i = 0; i < 7; i++) {
    const t0 = performance.now();
    merged = mergeRivalGradeJobs(job, await once());
    wt.push(performance.now() - t0);
  }
  const inline = gradeRivalMoment(run, run.rival?.pending?.options ?? [], job.samples);
  console.log(
    `first decision (after lap ${job.pausedAtLap}) on ${nWorkers} workers: median ${ms(quantiles(wt).median)} ms (each worker rebuilds the race first); same grade as inline: ${JSON.stringify(merged) === JSON.stringify(inline)}`,
  );
  for (const w of workers) await w.terminate();
}

// Grader benchmark (spec D7): the plan's budget case, 4 options x 300 samples x 25 laps.
//   pnpm --filter @boxthislap/sim bench
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gradeMoment } from '../src/grade.js';
import { initRun, stepLap } from '../src/sim.js';
import type { Decision, RaceModel } from '../src/types.js';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const model = JSON.parse(
  readFileSync(join(repo, 'data', 'races', 'abu-dhabi-2021.json'), 'utf8'),
) as RaceModel;
const run = initRun(model, model.race.seed, { decisions: [] });
while (run.state.lap < model.race.laps - 25) stepLap(run);
const lap = run.state.lap + 1;
const options: Array<{ id: string; decisions: Decision[] }> = [
  { id: 'stay-out', decisions: [] },
  { id: 'box-hard', decisions: [{ lap, kind: 'pit', compound: 'HARD' }] },
  { id: 'box-medium', decisions: [{ lap, kind: 'pit', compound: 'MEDIUM' }] },
  { id: 'push', decisions: [{ lap, kind: 'mode', key: 'pace', value: 'push' }] },
];
gradeMoment(run, options, { kind: 'win' }, 50); // warm up the JIT
const times: number[] = [];
for (let i = 0; i < 7; i++) {
  const t0 = performance.now();
  gradeMoment(run, options, { kind: 'win' });
  times.push(performance.now() - t0);
}
times.sort((a, b) => a - b);
console.log(
  `budget case: median ${times[3]?.toFixed(0)} ms (min ${times[0]?.toFixed(0)}, max ${times[6]?.toFixed(0)})`,
);

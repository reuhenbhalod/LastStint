// Battle odds per move (race engineer spec): over many battle laps, how often the user's car ends
// the lap ahead of the car it fought, and how often there's contact. For tuning headset.json.
//   pnpm --filter @laststint/sim exec tsx scripts/battle-odds.ts canada-2022
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { battlesFor } from '../src/engineer.js';
import { engineerConfig, forkRun, initRun, isFinished, stepLap } from '../src/sim.js';
import type { BattleMove, Decision, RaceModel } from '../src/types.js';

const id = process.argv[2] ?? 'canada-2022';
const model = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'data', 'races', `${id}.json`),
    'utf8',
  ),
) as RaceModel;
const cfg = engineerConfig(model);
if (!cfg) throw new Error('no engineer config');

for (const side of ['ahead', 'behind'] as const) {
  const moves: Array<BattleMove | null> =
    side === 'ahead'
      ? [null, 'dive-inside', 'round-outside', 'wait-drs', 'overtake-button']
      : [null, 'cover-inside', 'hold-outside', 'defend-hard', 'let-go'];
  for (const move of moves) {
    let ahead = 0;
    let contact = 0;
    let laps = 0;
    for (let seed = 1; laps < 400 && seed < 5000; seed++) {
      const run = initRun(model, seed, { decisions: [] });
      while (!isFinished(run) && run.state.lap < model.race.laps - 2) {
        if (battlesFor(run.state, model, cfg)[side] && run.state.nextFlag === 'green') break;
        stepLap(run);
      }
      const other = battlesFor(run.state, model, cfg)[side]?.code;
      if (!other || run.state.lap >= model.race.laps - 2) continue;
      // Just passed by that car: no re-pass roll for a few laps (REPASS_COOLDOWN).
      const lap0 = run.state.lap;
      if (
        side === 'ahead' &&
        lap0 + 1 - (run.passedBy.get(`${model.userSide}>${other}`) ?? -99) <= 3
      )
        continue;
      const lap = run.state.lap + 1;
      const calls: Decision[] = move ? [{ lap, kind: 'battle', move }] : [];
      const fork = forkRun(run, seed * 7 + 3, calls);
      stepLap(fork);
      if (fork.state.order.indexOf(model.userSide) < fork.state.order.indexOf(other)) ahead++;
      if (fork.notes.some((n) => n.kind === 'contact')) contact++;
      laps++;
    }
    console.log(
      `${side.padEnd(6)} ${(move ?? 'no call').padEnd(16)} ahead after the lap ${((100 * ahead) / laps).toFixed(0).padStart(3)}%  contact ${((100 * contact) / laps).toFixed(1)}%  (${laps} laps)`,
    );
  }
}

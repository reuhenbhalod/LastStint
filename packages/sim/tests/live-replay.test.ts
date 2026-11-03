// The real team's calls replay the real race in live play: a player who makes exactly the
// real calls gets the real stops (their measured times) and the rival doesn't "react" to
// them, because its real answer is already its real strategy. (What-if check, Oct 27 2026:
// before this, Italy 2024's paused state had PIA 10 s off his real race.) A player's BOX call
// is always a stop, so the user's real fastest-lap stop (optional for scripted cars) is
// called only when the replay took it.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { initRun, isFinished, realDecisions, stepLap } from '../src/sim.js';
import type { RaceModel } from '../src/types.js';

const dir = join(__dirname, '..', '..', '..', 'data', 'races');
const races = readdirSync(dir).filter((f) => f.endsWith('.json'));

describe('live play with the real calls', () => {
  it.each(races)('%s matches the replay exactly', (file) => {
    const model = JSON.parse(readFileSync(join(dir, file), 'utf8')) as RaceModel;
    const replay = initRun(model, model.race.seed);
    while (!isFinished(replay)) stepLap(replay);
    const user = model.drivers.find((d) => d.code === model.userSide);
    const skipped = new Set(
      (user?.realStrategy ?? [])
        .filter((s) => s.optional)
        .filter(
          (s) => (replay.state.cars[model.userSide]?.tyreAge ?? 0) > model.race.laps - s.lap + 1,
        )
        .map((s) => s.lap - 1),
    );
    const calls = realDecisions(model).filter((d) => !skipped.has(d.lap));
    const live = initRun(model, model.race.seed, { decisions: calls, incidents: false });
    while (!isFinished(live)) stepLap(live);
    for (const [code, car] of Object.entries(replay.state.cars)) {
      expect(live.state.cars[code]?.totalTime).toBeCloseTo(car.totalTime, 9);
    }
    expect(live.notes).toEqual([]);
  });
});

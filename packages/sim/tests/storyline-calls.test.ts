// Storyline calls (eras.storylineCalls; Eras grader fixes, Nov 8 2026): the rival keeps its
// real plan until its last storyline call, whatever its policy (sim.ts rivalHeld), so an Expert
// rival can't undo the real rival's late call (belgium-1992: Mansell's slicks, in-lap 33).

import { describe, expect, it } from 'vitest';
import belgiumJson from '../../../data/races/belgium-1992.json';
import { erasModel } from '../src/eras/reachability.js';
import { type Run, initRun, isFinished, rivalHeld, stepLap } from '../src/sim.js';
import type { RaceModel, StorylineCall } from '../src/types.js';

const belgium = erasModel(belgiumJson as unknown as RaceModel);
const without: RaceModel = {
  ...belgium,
  eras: { ...(belgium.eras as NonNullable<RaceModel['eras']>), storylineCalls: undefined },
};

/** Mansell's stops, as the run went: the out-laps his car took new tyres on. */
function rivalStops(model: RaceModel, policy: 'smart' | 'expert'): number[] {
  // The player boxes for slicks on Schumacher's real lap (in-lap 30), as early as the real race.
  const run: Run = initRun(model, 1, {
    decisions: [{ lap: 30, kind: 'pit', compound: 'MEDIUM' }],
    rivalPolicy: policy,
    rivalSamples: 8,
  });
  const out: number[] = [];
  while (!isFinished(run)) {
    stepLap(run);
    if (run.state.cars.MAN?.pittedThisLap) out.push(run.state.lap);
  }
  return out;
}

describe('storyline calls', () => {
  it('belgium-1992 flags Mansell, its rival, on his real slick stop', () => {
    expect(belgium.rival).toBe('MAN');
    expect(belgium.eras?.storylineCalls?.map((c) => [c.driver, c.lap])).toEqual([['MAN', 34]]);
    const real = belgium.drivers.find((d) => d.code === 'MAN')?.realStrategy.map((s) => s.lap);
    expect(real).toContain(34);
  });

  it('holds the rival until its last call, then lets the policy run', () => {
    expect(rivalHeld({ model: belgium }, 30)).toBe(true);
    expect(rivalHeld({ model: belgium }, 33)).toBe(true);
    expect(rivalHeld({ model: belgium }, 34)).toBe(false);
    expect(rivalHeld({ model: without }, 30)).toBe(false);
    const until = {
      ...belgium,
      eras: {
        ...(belgium.eras as NonNullable<RaceModel['eras']>),
        storylineCalls: [
          { ...(belgium.eras?.storylineCalls?.[0] as StorylineCall), untilFlag: true },
        ],
      },
    } as RaceModel;
    expect(rivalHeld({ model: until }, 40)).toBe(true);
  });

  it('a race without storyline calls is never held (every Daily and Gauntlet race)', () => {
    const daily = { ...belgium, eras: undefined } as RaceModel;
    for (let lap = 0; lap <= belgium.race.laps; lap++)
      expect(rivalHeld({ model: daily }, lap)).toBe(false);
  });

  it.each(['smart', 'expert'] as const)(
    "a %s rival makes Mansell's real stop on its real lap whatever the player does",
    (policy) => {
      expect(rivalStops(belgium, policy)[0]).toBe(34);
    },
  );

  it("without the flag the rival reacts to the player's early slicks", () => {
    // Smart's overcut, or Expert's own grade, moves Mansell off his real lap.
    const moved = (['smart', 'expert'] as const).some((p) => rivalStops(without, p)[0] !== 34);
    expect(moved).toBe(true);
  });
});

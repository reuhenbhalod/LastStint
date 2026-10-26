// Team orders (product doc decision type; spec D1).

import { describe, expect, it } from 'vitest';
import abuJson from '../../../data/races/abu-dhabi-2021.json';
import { gradeMoment } from '../src/grade.js';
import {
  initRun,
  isFinished,
  simulate,
  stepLap,
  teammateOf,
  validateDecisions,
} from '../src/sim.js';
import type { Decision, RaceModel } from '../src/types.js';

const abu = abuJson as unknown as RaceModel;

/** Abu Dhabi 2021 with the given cars moved to the front, in order, with the given gaps. */
function withFront(
  model: RaceModel,
  front: Array<[string, number]>,
  userSide = model.userSide,
): RaceModel {
  const codes = front.map(([c]) => c);
  const rest = [...model.drivers]
    .sort((a, b) => a.stateAtTakeover.position - b.stateAtTakeover.position)
    .filter((d) => !codes.includes(d.code));
  const reordered = [
    ...front.map(([code, gap]) => {
      const d = model.drivers.find((x) => x.code === code);
      if (!d) throw new Error(code);
      return { ...d, stateAtTakeover: { ...d.stateAtTakeover, gapAhead: gap } };
    }),
    ...rest,
  ].map((d, i) => ({ ...d, stateAtTakeover: { ...d.stateAtTakeover, position: i + 1 } }));
  return { ...model, drivers: reordered, userSide };
}

describe('team orders', () => {
  it('knows each side has a teammate', () => {
    expect(teammateOf(abu)).toBe('BOT');
    expect(teammateOf({ ...abu, userSide: 'VER' })).toBe('PER');
  });

  it('rejects a team order without a teammate in the race', () => {
    const solo = { ...abu, drivers: abu.drivers.filter((d) => d.code !== 'BOT') };
    expect(() =>
      validateDecisions(solo, [{ lap: 40, kind: 'teamOrder', order: 'holdUp' }]),
    ).toThrow();
  });

  it('teammateLetsYouPast: the teammate yields to the user when directly ahead and close', () => {
    // VER (user) 0.5s behind PER at takeover. Either VER gets by on his own on lap 35, or the
    // order makes PER yield; either way VER is ahead and any swap note names PER as yielding.
    const model = withFront(
      abu,
      [
        ['PER', 0],
        ['VER', 0.5],
      ],
      'VER',
    );
    const call: Decision[] = [{ lap: 35, kind: 'teamOrder', order: 'teammateLetsYouPast' }];
    for (let seed = 1; seed <= 5; seed++) {
      const run = initRun(model, seed, { decisions: call });
      while (run.state.lap < 35) stepLap(run);
      const swapped = run.notes.find((n) => n.kind === 'team-swap');
      if (swapped) expect(swapped).toMatchObject({ driver: 'VER', detail: 'PER' });
      expect(run.state.order.indexOf('VER')).toBeLessThan(run.state.order.indexOf('PER'));
    }
  });

  it('letTeammatePast: the user yields, never the reverse', () => {
    const model = withFront(
      abu,
      [
        ['VER', 0],
        ['PER', 0.5],
      ],
      'VER',
    );
    const call: Decision[] = [{ lap: 35, kind: 'teamOrder', order: 'letTeammatePast' }];
    const run = initRun(model, 3, { decisions: call });
    while (run.state.lap < 35) stepLap(run);
    expect(run.notes).toContainEqual({ lap: 35, kind: 'team-swap', driver: 'PER', detail: 'VER' });
    expect(run.state.order.indexOf('PER')).toBeLessThan(run.state.order.indexOf('VER'));
  });

  it('a yield call that never finds the cars together lapses', () => {
    const call: Decision[] = [{ lap: 35, kind: 'teamOrder', order: 'letTeammatePast' }];
    const run = initRun(abu, 1, { decisions: call });
    while (run.state.lap < 40) stepLap(run);
    expect(run.state.teamOrders.swap).toBeNull();
    expect(run.notes.some((n) => n.kind === 'team-swap')).toBe(false);
  });

  it('team orders never affect replays', () => {
    expect(simulate(abu, 2)).toEqual(simulate(abu, 2));
  });

  it('known answer: holding up a faster rival behind your teammate grades best', () => {
    // Controlled scenario: VER (user) leads, teammate PER 0.6s back, rival HAM 0.6s behind PER
    // and 0.3s/lap faster than VER. Without the order HAM gets through to VER eventually;
    // with PER holding him up, VER's chance of finishing ahead must rise.
    const fast = withFront(
      abu,
      [
        ['VER', 0],
        ['PER', 0.6],
        ['HAM', 0.6],
      ],
      'VER',
    );
    const ver = fast.drivers.find((d) => d.code === 'VER')?.basePace as number;
    const model: RaceModel = {
      ...fast,
      rival: 'HAM',
      drivers: fast.drivers.map((d) => (d.code === 'HAM' ? { ...d, basePace: ver - 0.3 } : d)),
    };
    const run = initRun(model, model.race.seed, { decisions: [] });
    const options: Array<{ id: string; decisions: Decision[] }> = [
      { id: 'race', decisions: [] },
      { id: 'hold-up', decisions: [{ lap: 35, kind: 'teamOrder', order: 'holdUp' }] },
    ];
    const g = gradeMoment(run, options, { kind: 'beat-rival' }, 300);
    expect(g.best).toBe('hold-up');
    const race = g.options.find((o) => o.id === 'race');
    const hold = g.options.find((o) => o.id === 'hold-up');
    expect((hold?.probability ?? 0) - (race?.probability ?? 0)).toBeGreaterThan(0.03);
  });

  it('holding up costs the teammate time', () => {
    const model = withFront(abu, [
      ['HAM', 0],
      ['BOT', 2.0],
      ['VER', 0.8],
    ]);
    const time = (d: Decision[]) => {
      const run = initRun(model, 9, { decisions: d });
      while (!isFinished(run)) stepLap(run);
      return run.state.cars.BOT?.totalTime as number;
    };
    expect(time([{ lap: 35, kind: 'teamOrder', order: 'holdUp' }])).toBeGreaterThan(time([]));
  });
});

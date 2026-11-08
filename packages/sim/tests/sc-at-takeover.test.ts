// An SC already running at the takeover lap (pipeline events.from_takeover): the race file
// keeps it from the takeover lap to its end, so the sim runs its remaining laps neutralised and
// treats the SC as already out (the takeover lap itself is marked, so lap 11 is not a deployment
// lap: no green-entry stop price, and the SC bunching of a running SC applies).
// Abu Dhabi 2012: SC laps 9-14, takeover on lap 10 (D3 rule).

import { describe, expect, it } from 'vitest';
import abuJson from '../../../data/races/abu-dhabi-2012.json';
import { initRun, stepLap } from '../src/sim.js';
import type { RaceModel } from '../src/types.js';

const abu = abuJson as unknown as RaceModel;
const takeover = abu.race.takeoverLap;

/** The same race with the running SC dropped, as race files had it before. */
const dropped: RaceModel = {
  ...abu,
  events: abu.events.filter((e) => !(e.type === 'SC' && e.lap === takeover)),
};

function flags(model: RaceModel, upTo: number): string[] {
  const run = initRun(model, 1);
  const out: string[] = [];
  while (run.state.lap < upTo) {
    stepLap(run);
    out.push(run.state.flag);
  }
  return out;
}

describe('an SC running at the takeover', () => {
  it('is in the race file from the takeover lap to its end', () => {
    expect(takeover).toBe(10);
    expect(abu.events.find((e) => e.type === 'SC')).toEqual({ lap: 10, type: 'SC', laps: 5 });
  });

  it('runs laps 11-14 neutralised, then green', () => {
    expect(flags(abu, 15)).toEqual(['sc', 'sc', 'sc', 'sc', 'green']);
    expect(flags(dropped, 15)).toEqual(['green', 'green', 'green', 'green', 'green']);
  });

  it('is known at the takeover: the first lap runs under it', () => {
    expect(initRun(abu, 1).state.nextFlag).toBe('sc');
    expect(initRun(dropped, 1).state.nextFlag).toBe('green');
  });
});

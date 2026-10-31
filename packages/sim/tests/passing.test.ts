// Re-pass cooldown (model v3 spec stage 7, E1): a car that has just been passed gets no pass
// roll against the car that passed it for REPASS_COOLDOWN laps. Real races undo ~4% of passes
// within 3 laps; without the cooldown the sim undid 25-60%.

import { describe, expect, it } from 'vitest';
import abuJson from '../../../data/races/abu-dhabi-2021.json';
import { REPASS_COOLDOWN, initRun, stepLap } from '../src/sim.js';
import type { RaceModel } from '../src/types.js';

const abu = abuJson as unknown as RaceModel;
const lap = abu.race.takeoverLap;

/** VER leads, HAM 0.2s behind and 1s/lap faster, neither stopping. */
function duel(): RaceModel {
  const ver = abu.drivers.find((d) => d.code === 'VER');
  if (!ver) throw new Error('VER');
  const front = ['VER', 'HAM'];
  const drivers = [...abu.drivers]
    .sort((a, b) => a.stateAtTakeover.position - b.stateAtTakeover.position)
    .sort((a, b) => Number(front.includes(b.code)) - Number(front.includes(a.code)))
    .sort((a, b) => (a.code === 'VER' ? -1 : b.code === 'VER' ? 1 : 0))
    .map((d, i) => ({
      ...d,
      realStrategy: front.includes(d.code) ? [] : d.realStrategy,
      basePace: d.code === 'HAM' ? ver.basePace - 1 : d.basePace,
      stateAtTakeover: {
        ...d.stateAtTakeover,
        position: i + 1,
        gapAhead: d.code === 'HAM' ? 0.2 : d.stateAtTakeover.gapAhead,
      },
    }));
  return { ...abu, drivers };
}

function hamAheadAfterOneLap(seed: number, cooling: boolean): boolean {
  const run = initRun(duel(), seed);
  if (cooling) run.passedBy.set('HAM>VER', lap); // VER passed HAM on the takeover lap
  stepLap(run);
  return run.state.order.indexOf('HAM') < run.state.order.indexOf('VER');
}

describe('re-pass cooldown', () => {
  it('is 3 laps', () => expect(REPASS_COOLDOWN).toBe(3));

  it('a much faster car right behind usually passes', () => {
    const passes = Array.from({ length: 40 }, (_, s) => hamAheadAfterOneLap(s, false));
    expect(passes.filter(Boolean).length).toBeGreaterThan(20);
  });

  it('but not the car that has just passed it', () => {
    for (let s = 0; s < 40; s++) expect(hamAheadAfterOneLap(s, true)).toBe(false);
  });
});

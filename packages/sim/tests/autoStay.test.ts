// When the wall answers a stop moment for you (feedback round 3 R1, src/autoStay.ts), on
// Abu Dhabi 2021: VSC lap 36, tyres lap 44, SC lap 53, SC last chance lap 55.

import { describe, expect, it } from 'vitest';
import abuJson from '../../../data/races/abu-dhabi-2021.json';
import { autoStay, boxingAt } from '../src/autoStay.js';
import type { DecisionMoment } from '../src/moments.js';
import { lifeOf } from '../src/sim.js';
import type { Decision, RaceModel } from '../src/types.js';

const abu = abuJson as unknown as RaceModel;
const moment = (id: string) => abu.decisionMoments.find((m) => m.id === id) as DecisionMoment;
const pit = (lap: number, compound: string): Decision => ({
  lap,
  kind: 'pit',
  compound,
  at: lap - 1,
});

describe('autoStay', () => {
  it('asks the real race’s questions when you haven’t stopped', () => {
    for (const m of abu.decisionMoments) expect(autoStay(abu, m, [])).toBeNull();
  });

  it('doesn’t ask about fresh tyres: a stop at the lap-36 VSC, then the lap-44 tyre call', () => {
    const tyres = moment('tyres-going');
    expect(autoStay(abu, tyres, [pit(36, 'HARD')])).toBe('stay');
    // Softs fitted on lap 30 won't reach the flag (13 laps on them at lap 44, 15 to go): asked.
    expect(13 + 15 > lifeOf(abu, 'SOFT')).toBe(true);
    expect(autoStay(abu, tyres, [pit(30, 'SOFT')])).toBeNull();
  });

  it('gives a safety car 8 laps after a stop, other calls 5', () => {
    const sc = moment('sc-stop'); // lap 53
    expect(autoStay(abu, sc, [pit(46, 'HARD')])).toBe('stay'); // 7 laps
    expect(autoStay(abu, sc, [pit(44, 'HARD')])).toBeNull(); // 9 laps: a cheap stop may pay
  });

  it('stays out with a stop booked, and says so', () => {
    const sc = moment('sc-stop');
    const booked: Decision = { lap: 53, kind: 'pit', compound: 'SOFT', at: 50 };
    expect(autoStay(abu, sc, [booked])).toBe('stay');
    expect(boxingAt(sc, [booked])).toBe(true);
  });
});

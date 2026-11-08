// The race screen's era rules (eras build plan 8.5): the screen's checks agree with what the
// sim accepts (`validateDecisions` is the oracle), and a race without rules or an era is
// today's race.

import {
  type BattleMove,
  type Decision,
  type Era,
  type RaceModel,
  type RaceRules,
  validateDecisions,
} from '@laststint/sim';
import { describe, expect, it } from 'vitest';
import abuJson from '../../../../data/races/abu-dhabi-2021.json';
import headset from '../../../../packages/sim/src/headset.json';
import {
  callBlocked,
  moveAllowed,
  pitCompoundAllowed,
  pitCompoundFor,
  pitCompounds,
  pitLaneClosedNow,
  raceScreenEra,
  tyreLabel,
} from './raceRules.js';
import { refuelReading } from './refuel.js';

const abu = abuJson as unknown as RaceModel;
const MOVES: BattleMove[] = [
  'cover-inside',
  'hold-outside',
  'defend-hard',
  'let-go',
  'dive-inside',
  'round-outside',
  'wait-drs',
  'overtake-button',
];
const RULES_2005: RaceRules = {
  twoCompound: false,
  tyreChanges: false,
  pitLaneClosedUnderSC: false,
  vsc: false,
  drs: false,
  ers: 'none',
};

const raced = (era: Era, rules?: RaceRules, eraId?: number): RaceModel => ({
  ...abu,
  era,
  ...(rules ? { rules } : {}),
  ...(eraId ? { eras: { eraId, order: 1 } } : {}),
});

/** True if the sim takes the call (the oracle for the screen's checks). */
function simTakes(model: RaceModel, d: Decision): boolean {
  try {
    validateDecisions(model, [d]);
    return true;
  } catch {
    return false;
  }
}

const lap = abu.race.takeoverLap + 1;

describe('raceScreenEra', () => {
  it('is today’s screen for a race without rules or an era', () => {
    const e = raceScreenEra(abu);
    expect(e).toMatchObject({
      drs: true,
      battery: true,
      eraId: null,
      prompts: 'radio',
      tyres: 'compounds',
      lockedTyre: null,
    });
    expect(e.rules).toMatchObject({ twoCompound: true, tyreChanges: true, refuelling: false });
  });

  it('reads a 2005 race: no DRS, no battery, one dry tyre, locked to the takeover set', () => {
    const e = raceScreenEra(raced('1994-2009', RULES_2005, 5));
    const on = abu.drivers.find((d) => d.code === abu.userSide)?.stateAtTakeover.compound;
    expect(e).toMatchObject({ drs: false, battery: false, eraId: 5, prompts: 'radio' });
    expect(e.tyres).toBe('single-dry');
    expect(e.lockedTyre).toBe(on);
  });

  it('puts prompts on the pit board in Eras 1 and 2 only', () => {
    for (let id = 1; id <= 10; id++) {
      expect(raceScreenEra(raced('2014-2025', undefined, id)).prompts).toBe(
        id <= 2 ? 'board' : 'radio',
      );
    }
  });
});

describe('moveAllowed agrees with the sim', () => {
  const variants: Array<RaceRules | undefined> = [
    undefined,
    { drs: false },
    { drs: true },
    { ers: 'none' },
    { ers: 'kers' },
    { ers: 'hybrid' },
    RULES_2005,
  ];
  for (const era of Object.keys(headset).filter((k) => !k.startsWith('_')) as Era[]) {
    it(`for every move in the ${era} era, with each rule switch`, () => {
      for (const rules of variants) {
        const model = raced(era, rules);
        for (const move of MOVES) {
          const d: Decision = { lap, kind: 'battle', move };
          expect(moveAllowed(model, move), `${era} ${JSON.stringify(rules)} ${move}`).toBe(
            simTakes(model, d),
          );
          expect(callBlocked(model, d) === null).toBe(simTakes(model, d));
        }
        for (const value of ['harvest', 'balanced', 'deploy', 'overtake']) {
          const d = { lap, kind: 'mode', key: 'ers', value } as Decision;
          expect(callBlocked(model, d) === null).toBe(simTakes(model, d));
        }
      }
    });
  }
});

describe('pit compounds', () => {
  const all = [...Object.keys(abu.compounds), 'INTERMEDIATE', 'WET'].filter(
    (c, i, a) => a.indexOf(c) === i,
  );

  it('are every compound in a race with tyre changes', () => {
    expect(pitCompounds(abu)).toEqual(Object.keys(abu.compounds));
    for (const c of all) expect(pitCompoundAllowed(abu, c)).toBe(true);
  });

  it('agree with the sim in a race without tyre changes (2005)', () => {
    const model = raced('1994-2009', RULES_2005);
    const locked = raceScreenEra(model).lockedTyre as string;
    for (const c of Object.keys(model.compounds)) {
      const d: Decision = { lap, kind: 'pit', compound: c };
      expect(pitCompoundAllowed(model, c), c).toBe(simTakes(model, d));
      expect(callBlocked(model, d) === null).toBe(simTakes(model, d));
    }
    expect(pitCompounds(model).filter((c) => c !== 'INTERMEDIATE' && c !== 'WET')).toEqual([
      locked,
    ]);
    // The wall's choice of a fresh dry set becomes the locked one.
    const other = Object.keys(model.compounds).find((c) => c !== locked && c !== 'WET') as string;
    expect(pitCompoundFor(model, other)).toBe(locked);
    expect(pitCompoundFor(abu, other)).toBe(other);
  });

  it('are named "Dry" where the race has no compound rule', () => {
    const model = raced('1994-2009', RULES_2005);
    expect(tyreLabel(model, 'MEDIUM')).toBe('Dry');
    expect(tyreLabel(abu, 'MEDIUM')).toBe('Mediums');
    expect(tyreLabel(model, 'INTERMEDIATE')).toBe('Inters');
  });
});

describe('pitLaneClosedNow', () => {
  const closing = raced('1994-2009', {
    ...RULES_2005,
    tyreChanges: true,
    pitLaneClosedUnderSC: true,
  });
  const race = (flag: 'green' | 'sc', nextFlag: 'green' | 'sc') =>
    ({ lap: 30, flag, nextFlag, cars: {} }) as never;

  it('closes the pit entry on the lap the SC comes out, in a race with the rule', () => {
    expect(pitLaneClosedNow(race('green', 'sc'), closing, 'HARD')).toBe(true);
    // Open again once the field is queued (the SC's second lap), and on green.
    expect(pitLaneClosedNow(race('sc', 'sc'), closing, 'HARD')).toBe(false);
    expect(pitLaneClosedNow(race('green', 'green'), closing, 'HARD')).toBe(false);
    // A stop only for wet tyres is exempt.
    expect(pitLaneClosedNow(race('green', 'sc'), closing, 'INTERMEDIATE')).toBe(false);
  });

  it('never closes it without the rule', () => {
    expect(pitLaneClosedNow(race('green', 'sc'), abu, 'HARD')).toBe(false);
  });
});

describe('refuelReading', () => {
  const reading = { lapsOfFuel: 18, nextStopLap: 40, level: 0.6, fills: [] };
  const race = { lap: 20 } as never;

  it('is null in a race without refuelling, whatever the source', () => {
    expect(refuelReading(race, abu, () => reading)).toBeNull();
  });

  it('is null in a refuelling race until the refuelling model is connected', () => {
    const model = raced('1994-2009', { refuelling: true });
    expect(refuelReading(race, model)).toBeNull();
    expect(refuelReading(race, model, () => reading)).toBe(reading);
  });
});

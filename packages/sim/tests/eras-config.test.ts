// Eras config (eras build plan 1.3; "done when: changing a value in the config changes the
// behaviour, with no code edit"). Pins every eras spec §7 value, and proves each helper
// follows the config it's given rather than numbers in code.

import { describe, expect, it } from 'vitest';
import erasConfigJson from '../src/eras/eras-config.json';
import { BAND_EDGES } from '../src/grade.js';
import {
  ACCURACY_MULTIPLIER,
  ERAS_CONFIG,
  ERA_UNLOCK_SHARE,
  HARD_CALL_EDGE,
  TYRE_AGE_RANGE_LAPS,
  decisionAccuracy,
  difficultyFor,
  difficultyForEra,
  hardCallEdge,
  isHardCall,
  legendDifficulty,
  meetsAccuracyThreshold,
  parseErasConfig,
  unlockThreshold,
  unlocksNextEra,
} from '../src/index.js';

/** A fresh, mutable copy of the shipped JSON, as if the file had been edited. */
function editedJson(): Record<string, unknown> & typeof erasConfigJson {
  return structuredClone(erasConfigJson);
}

describe('eras config: shipped values (eras spec §4–§8)', () => {
  it('holds the unlock share, accuracy multiplier and hard-call edge', () => {
    expect(ERA_UNLOCK_SHARE).toBe(0.7);
    expect(ACCURACY_MULTIPLIER).toBe(2.5);
    expect(ERAS_CONFIG.hardCallEdge).toBe('yellow');
    expect(HARD_CALL_EDGE).toBe(BAND_EDGES.yellow);
    expect(HARD_CALL_EDGE).toBe(5);
  });

  it('holds the tyre-age range width: 5 laps ("15–20 laps", decided Nov 7; §7)', () => {
    expect(ERAS_CONFIG.tyreAgeRangeLaps).toBe(5);
    expect(TYRE_AGE_RANGE_LAPS).toBe(5);
  });

  // Eras spec §7, row for row: play order, era, ★2 threshold, information, rival, timer.
  const SPEC_TABLE = [
    [1, 10, 70, 'full', 'standard', 45],
    [2, 9, 72, 'full', 'standard', 45],
    [3, 8, 75, 'full', 'standard-plus', 45],
    [4, 7, 78, 'reduced', 'standard-plus', 45],
    [5, 6, 80, 'reduced', 'smart', 30],
    [6, 5, 82, 'reduced', 'smart', 30],
    [7, 4, 84, 'limited', 'smart', 30],
    [8, 3, 86, 'limited', 'expert', 20],
    [9, 2, 88, 'minimal', 'expert', 20],
    [10, 1, 90, 'minimal', 'expert', 20],
  ] as const;

  it('has exactly the ten §7 rows', () => {
    expect(ERAS_CONFIG.difficulty).toHaveLength(SPEC_TABLE.length);
  });

  it.each(SPEC_TABLE)(
    'play order %i (era %i): threshold %i, %s information, %s rival, %i s timer',
    (playOrder, era, accuracyThreshold, information, rivalPolicy, decisionTimerSeconds) => {
      const expected = {
        playOrder,
        era,
        accuracyThreshold,
        information,
        rivalPolicy,
        decisionTimerSeconds,
      };
      expect(difficultyFor(playOrder)).toEqual(expected);
      expect(difficultyForEra(era)).toEqual(expected);
    },
  );

  it('holds Legend: threshold 90, minimal information, expert rival, 20 s (§8)', () => {
    expect(legendDifficulty()).toEqual({
      accuracyThreshold: 90,
      information: 'minimal',
      rivalPolicy: 'expert',
      decisionTimerSeconds: 20,
    });
  });
});

describe('eras config: helpers on the shipped values', () => {
  it('unlock threshold is ceil(0.7 × 3 × races): 21 of 30 for ten races (§5, §18)', () => {
    expect(unlockThreshold(10)).toBe(21);
    expect(unlocksNextEra(21, 10)).toBe(true);
    expect(unlocksNextEra(20, 10)).toBe(false);
    // Winning every race once gives 10 stars, not enough (§18).
    expect(unlocksNextEra(10, 10)).toBe(false);
    expect(unlockThreshold(1)).toBe(3); // ceil(2.1)
    expect(unlockThreshold(3)).toBe(7); // ceil(6.3)
    expect(unlockThreshold(5)).toBe(11); // ceil(10.5)
    expect(unlockThreshold(0)).toBe(0);
  });

  it('unlock threshold rejects a bad race count', () => {
    expect(() => unlockThreshold(-1)).toThrow(RangeError);
    expect(() => unlockThreshold(2.5)).toThrow(RangeError);
    expect(() => unlockThreshold(Number.NaN)).toThrow(RangeError);
  });

  it('decision accuracy is max(0, 100 − 2.5 × winChanceLost) (§6)', () => {
    expect(decisionAccuracy(0)).toBe(100);
    expect(decisionAccuracy(4)).toBe(90);
    expect(decisionAccuracy(10)).toBe(75);
    expect(decisionAccuracy(40)).toBe(0);
    expect(decisionAccuracy(55)).toBe(0); // floored at 0
    expect(() => decisionAccuracy(-1)).toThrow(RangeError);
    expect(() => decisionAccuracy(Number.NaN)).toThrow(RangeError);
  });

  it('a hard call has the second-best option within 5 points, inclusive (§4)', () => {
    expect(isHardCall(0)).toBe(true);
    expect(isHardCall(5)).toBe(true);
    expect(isHardCall(5.01)).toBe(false);
    expect(() => isHardCall(-0.1)).toThrow(RangeError);
  });

  it('★2 compares race accuracy with the era threshold, inclusive', () => {
    expect(meetsAccuracyThreshold(70, difficultyFor(1))).toBe(true);
    expect(meetsAccuracyThreshold(69.9, difficultyFor(1))).toBe(false);
    expect(meetsAccuracyThreshold(89.9, legendDifficulty())).toBe(false);
  });

  it('throws on an unknown play order or era', () => {
    expect(() => difficultyFor(0)).toThrow(RangeError);
    expect(() => difficultyFor(11)).toThrow(RangeError);
    expect(() => difficultyForEra(11)).toThrow(RangeError);
  });
});

describe('eras config: changing a value changes the behaviour, with no code edit', () => {
  it('unlock share', () => {
    const json = editedJson();
    json.unlockShare = 0.5;
    const config = parseErasConfig(json);
    expect(unlockThreshold(10, config)).toBe(15);
    expect(unlocksNextEra(15, 10, config)).toBe(true);
    expect(unlocksNextEra(15, 10)).toBe(false);
  });

  it('accuracy multiplier', () => {
    const json = editedJson();
    json.accuracyMultiplier = 4;
    const config = parseErasConfig(json);
    expect(decisionAccuracy(10, config)).toBe(60);
    expect(decisionAccuracy(10)).toBe(75);
  });

  it('hard-call edge, as another band key or as a number', () => {
    const asBand = editedJson();
    asBand.hardCallEdge = 'orange';
    const orange = parseErasConfig(asBand);
    expect(hardCallEdge(orange)).toBe(BAND_EDGES.orange);
    expect(isHardCall(10, orange)).toBe(true);
    expect(isHardCall(10)).toBe(false);

    const asNumber = editedJson();
    (asNumber as Record<string, unknown>).hardCallEdge = 2;
    const two = parseErasConfig(asNumber);
    expect(hardCallEdge(two)).toBe(2);
    expect(isHardCall(3, two)).toBe(false);
    expect(isHardCall(3)).toBe(true);
  });

  it('every difficulty column', () => {
    const json = editedJson();
    const row = json.difficulty[4];
    if (!row) throw new Error('fixture: play order 5 missing');
    row.era = 6;
    row.accuracyThreshold = 81;
    row.information = 'limited';
    row.rivalPolicy = 'expert';
    row.decisionTimerSeconds = 25;
    const config = parseErasConfig(json);
    expect(difficultyFor(5, config)).toEqual({
      playOrder: 5,
      era: 6,
      accuracyThreshold: 81,
      information: 'limited',
      rivalPolicy: 'expert',
      decisionTimerSeconds: 25,
    });
    expect(meetsAccuracyThreshold(80, difficultyFor(5))).toBe(true);
    expect(meetsAccuracyThreshold(80, difficultyFor(5, config))).toBe(false);
  });

  it('tyre-age range width', () => {
    const json = editedJson();
    json.tyreAgeRangeLaps = 3;
    expect(parseErasConfig(json).tyreAgeRangeLaps).toBe(3);
    expect(ERAS_CONFIG.tyreAgeRangeLaps).toBe(5);
  });

  it('Legend settings', () => {
    const json = editedJson();
    json.legend.decisionTimerSeconds = 15;
    json.legend.accuracyThreshold = 95;
    const config = parseErasConfig(json);
    expect(legendDifficulty(config).decisionTimerSeconds).toBe(15);
    expect(meetsAccuracyThreshold(92, legendDifficulty(config))).toBe(false);
    expect(meetsAccuracyThreshold(92, legendDifficulty())).toBe(true);
  });

  it('editing a copy leaves the shipped config alone', () => {
    const json = editedJson();
    json.unlockShare = 0.1;
    parseErasConfig(json);
    expect(unlockThreshold(10)).toBe(21);
  });
});

describe('eras config: validation', () => {
  type Json = Record<string, unknown>;
  const row = (j: Json, i: number) => (j.difficulty as Json[])[i] as Json;
  const bad: [string, (j: Json) => void, RegExp][] = [
    ['unlock share above 1', (j) => Object.assign(j, { unlockShare: 1.2 }), /unlockShare/],
    ['unlock share of 0', (j) => Object.assign(j, { unlockShare: 0 }), /unlockShare/],
    [
      'non-numeric multiplier',
      (j) => Object.assign(j, { accuracyMultiplier: '2.5' }),
      /accuracyMultiplier/,
    ],
    ['unknown band key', (j) => Object.assign(j, { hardCallEdge: 'purple' }), /hardCallEdge/],
    ['negative edge', (j) => Object.assign(j, { hardCallEdge: -1 }), /hardCallEdge/],
    [
      'missing tyre-age range',
      (j) => Object.assign(j, { tyreAgeRangeLaps: undefined }),
      /tyreAgeRangeLaps/,
    ],
    ['zero tyre-age range', (j) => Object.assign(j, { tyreAgeRangeLaps: 0 }), /tyreAgeRangeLaps/],
    [
      'fractional tyre-age range',
      (j) => Object.assign(j, { tyreAgeRangeLaps: 2.5 }),
      /tyreAgeRangeLaps/,
    ],
    ['empty table', (j) => Object.assign(j, { difficulty: [] }), /difficulty/],
    [
      'rows out of play order',
      (j) => (j.difficulty as unknown[]).reverse(),
      /difficulty\[0\]\.playOrder/,
    ],
    [
      'unknown information level',
      (j) => Object.assign(row(j, 0), { information: 'some' }),
      /information/,
    ],
    [
      'unknown rival policy',
      (j) => Object.assign(row(j, 0), { rivalPolicy: 'nice' }),
      /rivalPolicy/,
    ],
    [
      'threshold over 100',
      (j) => Object.assign(row(j, 0), { accuracyThreshold: 101 }),
      /accuracyThreshold/,
    ],
    [
      'zero timer',
      (j) => Object.assign(row(j, 0), { decisionTimerSeconds: 0 }),
      /decisionTimerSeconds/,
    ],
    ['repeated era', (j) => Object.assign(row(j, 1), { era: 10 }), /repeated era/],
    ['missing legend', (j) => Object.assign(j, { legend: undefined }), /legend/],
  ];

  it.each(bad)('rejects %s', (_name, edit, message) => {
    const json = editedJson() as Json;
    edit(json);
    expect(() => parseErasConfig(json)).toThrow(message);
  });

  it('rejects a non-object', () => {
    expect(() => parseErasConfig(null)).toThrow(/eras config/);
    expect(() => parseErasConfig([])).toThrow(/eras config/);
  });
});

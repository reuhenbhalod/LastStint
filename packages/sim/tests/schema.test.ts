// Schema v11 (eras build plan 1.1): the optional eras, provenance and rules blocks,
// events[].storylineEvent and race.scUnlap 'none'. The TS types and the JSON schema list the
// same types and values; valid examples type-check and invalid ones don't (@ts-expect-error,
// checked by `pnpm typecheck`); the pipeline's tests validate examples against the schema
// itself (pipeline/tests/test_schema_v11.py). The sim ignores the new fields until 4.1.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import abuJson from '../../../data/races/abu-dhabi-2021.json';
import schema from '../../../packages/schema/race-model.schema.json';
import { simulate } from '../src/sim.js';
import {
  ERAS_OBJECTIVE_TYPES,
  ERAS_TARGET_TYPES,
  ESTIMATED_FIELDS,
  type ErasBlock,
  type ErasObjective,
  type ErasTarget,
  MODE_VALUES,
  type Provenance,
  type RaceEvent,
  type RaceModel,
  type RaceRules,
  SCHEMA_VERSION,
} from '../src/types.js';

const abu = abuJson as unknown as RaceModel;
const root = join(__dirname, '..', '..', '..');

type Branch = { properties: Record<string, { const?: string; enum?: string[] }> };
type Schema = {
  $defs: { erasTarget: { oneOf: Branch[] }; erasObjective: { oneOf: Branch[] } };
  properties: {
    race: { properties: { scUnlap: { enum: string[] } } };
    provenance: {
      properties: { kind: { enum: string[] }; estimated: { items: { enum: string[] } } };
    };
    rules: { properties: Record<string, unknown> & { ers: { enum: string[] } } };
    eras: { properties: Record<string, unknown> };
  };
};
const s = schema as unknown as Schema;
const consts = (branches: Branch[]) => [...new Set(branches.map((b) => b.properties.type?.const))];

const FULL_ERAS: ErasBlock = {
  eraId: 9,
  order: 10,
  userSide: 'HAM',
  target: { type: 'beat-rival', rival: 'VER' },
  storyline: {
    real: 'Verstappen wins the race and the title',
    rewriteCondition: { type: 'beat-rival', rival: 'VER' },
    headline: 'You won Lewis his eighth title',
  },
  mastery: { type: 'no_neutralized_stop', label: 'Win without pitting under the SC' },
  hidden: { type: 'margin', seconds: 3, label: 'Win by more than 3 seconds' },
  hardCalls: { VER: 6, HAM: 4 },
  briefing: 'Short era-appropriate intro shown before the race.',
};

describe('schema v11', () => {
  it('the TS and pipeline schema versions agree, and every race file is at or below it', () => {
    expect(SCHEMA_VERSION).toBe(11);
    const init = readFileSync(join(root, 'pipeline', 'src', 'pipeline', '__init__.py'), 'utf8');
    expect(init).toMatch(new RegExp(`^SCHEMA_VERSION = ${SCHEMA_VERSION}$`, 'm'));
    const dir = join(root, 'data', 'races');
    const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
    expect(files.length).toBeGreaterThanOrEqual(60);
    for (const f of files) {
      const m = JSON.parse(readFileSync(join(dir, f), 'utf8')) as RaceModel;
      expect(m.schemaVersion).toBeLessThanOrEqual(SCHEMA_VERSION);
    }
  });

  it('the six target types match the schema', () => {
    expect(consts(s.$defs.erasTarget.oneOf).sort()).toEqual([...ERAS_TARGET_TYPES].sort());
  });

  it('the eight objective types match the schema', () => {
    expect(ERAS_OBJECTIVE_TYPES).toHaveLength(8);
    expect(consts(s.$defs.erasObjective.oneOf).sort()).toEqual([...ERAS_OBJECTIVE_TYPES].sort());
  });

  it("mode_rule's modes are every Modes value, as in the schema", () => {
    const modeRule = s.$defs.erasObjective.oneOf.find(
      (b) => b.properties.type?.const === 'mode_rule',
    );
    expect(modeRule?.properties.mode?.enum).toEqual([...MODE_VALUES]);
    expect(new Set(MODE_VALUES).size).toBe(MODE_VALUES.length); // each value names one key
  });

  it('provenance, rules, eras and scUnlap list the same fields and values as the types', () => {
    expect(s.properties.provenance.properties.kind.enum).toEqual(['real', 'reconstructed']);
    expect(s.properties.provenance.properties.estimated.items.enum).toEqual([...ESTIMATED_FIELDS]);
    const rules: Required<RaceRules> = {
      twoCompound: true,
      tyreChanges: true,
      minStops: 2,
      refuelling: false,
      fuelLimit: 150,
      pitLaneClosedUnderSC: false,
      vsc: true,
      drs: true,
      ers: 'hybrid',
    };
    expect(Object.keys(s.properties.rules.properties).sort()).toEqual(Object.keys(rules).sort());
    expect(s.properties.rules.properties.ers.enum).toEqual(['none', 'kers', 'hybrid']);
    expect(Object.keys(s.properties.eras.properties).sort()).toEqual(Object.keys(FULL_ERAS).sort());
    expect(s.properties.race.properties.scUnlap.enum).toEqual(['all', 'duel', 'none']);
  });

  it('the new fields change nothing in a replay yet (rules land in 4.1)', () => {
    const provenance: Provenance = { kind: 'real', estimated: ['safetyCars'] };
    const events: RaceEvent[] = abu.events.map((e) =>
      e.type === 'SC' ? { ...e, storylineEvent: true } : e,
    );
    const tagged: RaceModel = {
      ...abu,
      schemaVersion: SCHEMA_VERSION,
      eras: FULL_ERAS,
      provenance,
      rules: { vsc: false, drs: false, ers: 'none', twoCompound: false },
      events,
    };
    for (const seed of [1, 2, 3]) expect(simulate(tagged, seed)).toEqual(simulate(abu, seed));
  });
});

// Type-level examples: each valid one compiles, each invalid one must fail to (typecheck).
const validTargets: ErasTarget[] = [
  { type: 'win' },
  { type: 'defend' },
  { type: 'position', position: 3 },
  { type: 'beat-rival', rival: 'VER' },
  { type: 'team', positions: [1, 2] },
  { type: 'deny', rival: 'VER', position: 4 },
];
const validObjectives: ErasObjective[] = [
  { type: 'stop_count', max: 1, label: 'One stop' },
  { type: 'stop_count', exact: 2, label: 'Two stops' },
  { type: 'beat_real_call', label: 'Beat the real call' },
  { type: 'finish_position', position: 1, label: 'P1' },
  { type: 'margin', seconds: 5, label: 'By 5 s' },
  { type: 'compound_rule', mustAvoid: 'SOFT', label: 'No softs' },
  { type: 'compound_rule', mustUse: 'HARD', mustAvoid: 'SOFT', label: 'Hards, no softs' },
  { type: 'mode_rule', mode: 'push', maxLaps: 5, label: 'Push 5 laps at most' },
  { type: 'no_neutralized_stop', label: 'No SC stop' },
  { type: 'team_result', positions: [10, 10], label: 'Both in the points' },
];
const invalid = {
  // @ts-expect-error: not one of the six target types
  targetType: { type: 'finish_ahead_of_rival' } satisfies ErasTarget,
  // @ts-expect-error: position needs its position
  position: { type: 'position' } satisfies ErasTarget,
  // @ts-expect-error: deny needs a position
  deny: { type: 'deny', rival: 'VER' } satisfies ErasTarget,
  // @ts-expect-error: team takes two positions
  team: { type: 'team', positions: [1] } satisfies ErasTarget,
  // @ts-expect-error: an objective needs a label
  noLabel: { type: 'beat_real_call' } satisfies ErasObjective,
  // @ts-expect-error: stop_count takes max or exact, not both
  bothCounts: { type: 'stop_count', max: 1, exact: 1, label: 'x' } satisfies ErasObjective,
  // @ts-expect-error: compound_rule needs mustUse or mustAvoid
  noCompound: { type: 'compound_rule', label: 'x' } satisfies ErasObjective,
  // @ts-expect-error: not a mode value
  mode: { type: 'mode_rule', mode: 'flat-out', maxLaps: 5, label: 'x' } satisfies ErasObjective,
  // @ts-expect-error: eraId and order are required
  eras: { target: { type: 'win' } } satisfies ErasBlock,
  // @ts-expect-error: not a provenance kind
  provenance: { kind: 'estimated' } satisfies Provenance,
  // @ts-expect-error: not an estimated field
  estimated: { kind: 'real', estimated: ['lapTimes'] } satisfies Provenance,
  // @ts-expect-error: not an ERS kind
  ers: { ers: 'mguh' } satisfies RaceRules,
  // @ts-expect-error: a boolean rule
  vsc: { vsc: 'no' } satisfies RaceRules,
};

describe('type-level examples', () => {
  it('compile as written (see the @ts-expect-error lines for the invalid ones)', () => {
    expect(validTargets).toHaveLength(6);
    expect(new Set(validObjectives.map((o) => o.type)).size).toBe(8);
    expect(Object.keys(invalid)).toHaveLength(13);
  });
});

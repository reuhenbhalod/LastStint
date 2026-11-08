// Rival policies (eras build plan 9.1, eras spec §7): which policy a live run's rival follows.
// The rule pieces the harder policies are built from are in this folder (wet.ts, expert.ts).
// Mirrored by pipeline/src/pipeline/rival_policy.py (tests/rival-policy.test.ts checks parity).
//
// `standard` is today's rival (sim.ts rivalReacts, rivalGoesLong and the optional fastest-lap
// stop; Implementation Plan 2.5) and the default, so Daily, Gauntlet and every golden file are
// unchanged. Standard+, Smart and Expert are not selectable yet: eras spec §7 doesn't define
// them precisely enough against today's Standard (see RIVAL_POLICY_GAPS), and a run asking
// for one fails loudly rather than quietly racing a Standard rival.
//
// This module imports eras/config.ts for types only: config.ts imports grade.ts, which
// imports sim.ts, so a value import here (sim.ts imports this module) would be a cycle that
// breaks when grade.ts loads first. It imports nothing from sim.ts either, so sim.ts can import
// it without a cycle.

import type { RivalPolicy } from '../eras/config.js';

/** Every policy name, in difficulty order (the same list as eras/config.ts RIVAL_POLICIES). */
export const RIVAL_POLICY_NAMES = [
  'standard',
  'standard-plus',
  'smart',
  'expert',
] as const satisfies readonly RivalPolicy[];

// Compile-time check that the list above names every RivalPolicy.
type MissingPolicy = Exclude<RivalPolicy, (typeof RIVAL_POLICY_NAMES)[number]>;
const allNamed: MissingPolicy extends never ? true : never = true;
void allNamed;

/** The rival a run gets when none is asked for: today's (Daily, Gauntlet, replays). */
export const DEFAULT_RIVAL_POLICY: RivalPolicy = 'standard';

/** The policies the sim can run today. */
export const IMPLEMENTED_RIVAL_POLICIES: readonly RivalPolicy[] = ['standard'];

/**
 * Why each policy that isn't implemented yet is blocked (eras spec §7 against the sim), until
 * the spec defines it: the short reasons.
 */
export const RIVAL_POLICY_GAPS: Readonly<Partial<Record<RivalPolicy, string>>> = {
  'standard-plus':
    'eras spec §7 says Standard+ "also covers undercuts within 3 laps", but today\'s Standard ' +
    'already covers green-flag undercuts when its own stop is within 4 laps (COVER_WINDOW), ' +
    'so Standard+ as written adds nothing',
  smart:
    'builds on Standard+ (undefined), and "extends its stint to overcut when the player pits ' +
    'early" defines neither "early" nor how long the stint is extended',
  expert:
    'builds on Smart (undefined); "reacts one lap earlier" and the options, target and sample ' +
    'count of its own graded calls are not defined',
};

/** A policy name was asked for that doesn't exist, or isn't implemented yet. */
export class RivalPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RivalPolicyError';
  }
}

/**
 * The policy a run uses: `standard` when none is given. Throws RivalPolicyError on an unknown
 * name, or on a policy the sim can't run yet (with the spec gap that blocks it).
 */
export function resolveRivalPolicy(value: unknown): RivalPolicy {
  if (value === undefined) return DEFAULT_RIVAL_POLICY;
  if (typeof value !== 'string' || !(RIVAL_POLICY_NAMES as readonly string[]).includes(value)) {
    throw new RivalPolicyError(
      `unknown rival policy ${JSON.stringify(value)} (expected one of ${RIVAL_POLICY_NAMES.join(', ')})`,
    );
  }
  const policy = value as RivalPolicy;
  if (!IMPLEMENTED_RIVAL_POLICIES.includes(policy)) {
    throw new RivalPolicyError(
      `rival policy ${policy} is not implemented: ${RIVAL_POLICY_GAPS[policy] ?? 'not defined'}`,
    );
  }
  return policy;
}

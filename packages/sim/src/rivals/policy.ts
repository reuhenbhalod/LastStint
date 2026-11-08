// Rival policies (eras build plan 9.1, eras spec §7 "Rival policies", decided Nov 7): which
// policy a live run's rival follows, and the per-policy knobs. The rules are in rules.ts, the
// per-lap hook that runs them in react.ts, Expert's grader in expert.ts.
// Mirrored by pipeline/src/pipeline/rival_policy.py (tests/rival-policy.test.ts checks parity).
//
// - standard: today's rival (sim.ts rivalReacts, rivalGoesLong and the optional fastest-lap
//   stop; Implementation Plan 2.5) and the default, so Daily, Gauntlet and every golden file
//   are unchanged.
// - standard-plus: Standard, covering green-flag undercuts when its own stop is within 7 laps.
// - smart: Standard+, plus the overcut and the wet crossover (rules.ts).
// - expert: Smart, reacting a lap earlier, plus its own grader at its decision points.
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

/** The policies the sim can run (all of them, since the Nov 7 definitions). */
export const IMPLEMENTED_RIVAL_POLICIES: readonly RivalPolicy[] = RIVAL_POLICY_NAMES;

/**
 * Green-flag cover window per policy: the rival covers an undercut when its own next planned
 * stop is within this many laps of the cover (Standard: sim.ts COVER_WINDOW; Standard+ and up:
 * 4 + 3).
 */
export const COVER_WINDOWS: Readonly<Record<RivalPolicy, number>> = {
  standard: 4,
  'standard-plus': 7,
  smart: 7,
  expert: 7,
};

/** The policy's green-flag cover window (COVER_WINDOWS). */
export function coverWindow(policy: RivalPolicy): number {
  return COVER_WINDOWS[policy];
}

/** Policies with Smart's rules (the overcut and the wet crossover). */
export function hasSmartRules(policy: RivalPolicy): boolean {
  return policy === 'smart' || policy === 'expert';
}

/** Expert's own grader: samples per decision (eras spec §7, "Cost"). */
export const EXPERT_SAMPLES = 100;

/**
 * The policy the rival follows inside a grader playout of a run on `policy`: Expert's playouts
 * use Smart rivals (eras spec §7: no grading inside grading); every other policy keeps its own.
 */
export function playoutPolicy(policy: RivalPolicy): RivalPolicy {
  return policy === 'expert' ? 'smart' : policy;
}

/** A policy name was asked for that doesn't exist. */
export class RivalPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RivalPolicyError';
  }
}

/** The policy a run uses: `standard` when none is given. Throws RivalPolicyError on an unknown name. */
export function resolveRivalPolicy(value: unknown): RivalPolicy {
  if (value === undefined) return DEFAULT_RIVAL_POLICY;
  if (typeof value !== 'string' || !(RIVAL_POLICY_NAMES as readonly string[]).includes(value)) {
    throw new RivalPolicyError(
      `unknown rival policy ${JSON.stringify(value)} (expected one of ${RIVAL_POLICY_NAMES.join(', ')})`,
    );
  }
  return value as RivalPolicy;
}

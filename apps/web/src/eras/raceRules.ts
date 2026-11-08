// The race screen's view of the race's era rules (eras build plan 8.5, roadmap R5): which
// battle moves and headset modes the race has, which tyres a stop may fit, the pit lane
// closing under the SC, how tyres are shown and how prompts look. Everything comes from the
// race model, `resolveRules(model)`, the era's headset block (through the sim's `hasMove` and
// `modeEffects`) and the race's `eras.eraId`; never from the race's year. A race without
// `rules` or `eras` gets today's screen: every move, every compound, team radio.

import {
  type BattleMove,
  type Compound,
  type Decision,
  type FlagState,
  type RaceModel,
  type RaceState,
  type ResolvedRules,
  checkFill,
  hasMove,
  isWetTyre,
  modeEffects,
  pitLaneClosed,
  resolveRules,
  stopGoCost,
} from '@laststint/sim';
// The era blocks' own `drs` (read only): `hasMove` needs the race's headset block, which the
// sim builds (`headsetFor`) but doesn't export; the battery comes from `modeEffects`, which is.
import headsetBlocks from '../../../../packages/sim/src/headset.json';
import { tyreName } from '../game/choices.js';

/** The eras whose prompts are pit-board messages (eras spec §7): team radio was limited. */
export const PIT_BOARD_ERAS: readonly number[] = [1, 2];

export interface RaceScreenEra {
  rules: ResolvedRules;
  /** DRS: the `wait-drs` move and the DRS line in a battle call. */
  drs: boolean;
  /** A battery (KERS / hybrid ERS): the ERS modes, the charge and `overtake-button`. */
  battery: boolean;
  /** The race's era (eras spec §4), or null outside Eras mode. */
  eraId: number | null;
  /** How decisions are put: team radio, or pit-board messages (Eras 1-2). */
  prompts: 'radio' | 'board';
  /**
   * How tyre badges read: the compound (S / M / H), or a single dry tyre where the race has no
   * compound rule (before 2007: one dry specification a weekend, so the letter means nothing).
   */
  tyres: 'compounds' | 'single-dry';
  /** No tyre changes (2005): the dry set fitted at the takeover, which every stop keeps. */
  lockedTyre: Compound | null;
}

type Block = { drs?: boolean };
const BLOCKS = headsetBlocks as unknown as Record<string, Block>;
const cache = new WeakMap<RaceModel, RaceScreenEra>();

/** The race's screen rules (cached per model: the model never changes during a race). */
export function raceScreenEra(model: RaceModel): RaceScreenEra {
  const hit = cache.get(model);
  if (hit) return hit;
  const rules = resolveRules(model);
  const eraId = model.eras?.eraId ?? null;
  const out: RaceScreenEra = {
    rules,
    drs: moveAllowed(model, 'wait-drs'),
    battery: moveAllowed(model, 'overtake-button'),
    eraId,
    prompts: eraId !== null && PIT_BOARD_ERAS.includes(eraId) ? 'board' : 'radio',
    tyres: rules.twoCompound ? 'compounds' : 'single-dry',
    lockedTyre: rules.tyreChanges ? null : takeoverDry(model),
  };
  cache.set(model, out);
  return out;
}

/** The user's dry compound at the takeover (what a 2005 stop keeps), or null on wet tyres. */
function takeoverDry(model: RaceModel): Compound | null {
  const on = model.drivers.find((d) => d.code === model.userSide)?.stateAtTakeover.compound;
  return on && !isWetTyre(on) ? on : null;
}

/**
 * True if the race has this battle move (roadmap R5, the sim's `hasMove`): no `wait-drs`
 * without DRS, no `overtake-button` without a battery. The race's headset block as the sim
 * builds it: the race's `rules.drs` over the era's, the battery from the era's modes as the
 * race's `rules.ers` leaves them.
 */
export function moveAllowed(model: RaceModel, move: BattleMove): boolean {
  const ers = modeEffects(model)?.ers;
  const drs = model.rules?.drs ?? BLOCKS[model.era]?.drs;
  return hasMove({ drs, modes: { ers }, ers }, move);
}

/**
 * True if a stop may fit this compound (the sim's `validateDecisions` rejects the rest): any
 * tyre, except in a race without tyre changes, where it's the dry set fitted at the takeover
 * (a stop that only refuels) or a wet tyre.
 */
export function pitCompoundAllowed(model: RaceModel, compound: Compound): boolean {
  const locked = raceScreenEra(model).lockedTyre;
  return locked === null || isWetTyre(compound) || compound === locked;
}

/** The race's compounds a stop may fit, in the model's order. */
export function pitCompounds(model: RaceModel): Compound[] {
  return Object.keys(model.compounds).filter((c) => pitCompoundAllowed(model, c));
}

/** The tyre a stop the wall wants onto `wanted` actually fits: `wanted`, or the locked set. */
export function pitCompoundFor(model: RaceModel, wanted: Compound): Compound {
  return pitCompoundAllowed(model, wanted) ? wanted : (raceScreenEra(model).lockedTyre ?? wanted);
}

/**
 * Why the sim would reject a call the screen is about to make, or null if it's legal under
 * the race's rules: a battle move the race doesn't have, an ERS mode without a battery, a
 * stop onto a tyre it can't fit, or a stop without its fuel fill in a refuelling race. Every offer is checked here before it reaches the sim.
 */
export function callBlocked(model: RaceModel, d: Decision): string | null {
  if (d.kind === 'battle' && !moveAllowed(model, d.move)) return `no ${d.move} in this race`;
  if (d.kind === 'mode' && !modeEffects(model)?.[d.key]?.[d.value]) {
    return `no ${d.key} ${d.value} in this race`;
  }
  if (d.kind === 'pit' && !pitCompoundAllowed(model, d.compound)) {
    return `no tyre changes in this race: ${d.compound}`;
  }
  // A refuelling race: every stop states its fill (the sim's checkFill; no default).
  if (d.kind === 'pit') {
    if (raceScreenEra(model).rules.refuelling && d.fill === undefined) {
      return 'pick a fuel fill first';
    }
    try {
      checkFill(model, d.fill);
    } catch {
      return 'that fuel fill';
    }
  }
  return null;
}

/**
 * The pit lane closes as the SC comes out (2007-08, `rules.pitLaneClosedUnderSC`): true if a
 * stop called now for the coming lap's pit entry would enter it closed (the sim's
 * `pitLaneClosed`, on the flags the screen knows: the lap just run and the one coming).
 */
export function pitLaneClosedNow(race: RaceState, model: RaceModel, compound: Compound): boolean {
  if (!raceScreenEra(model).rules.pitLaneClosedUnderSC) return false;
  const inLap = race.lap + 1;
  const flags = new Map<number, FlagState>([
    [race.lap, race.flag],
    [inLap, race.nextFlag ?? 'green'],
  ]);
  return pitLaneClosed(model, flags, inLap + 1, compound);
}

/** What a stop into the closed pit lane costs (s): the ten-second stop-go and its drive. */
export function closedPitCost(model: RaceModel): number {
  return stopGoCost(model);
}

/** A tyre's name on a pit button: "Dry" for the one dry tyre of a race without the rule. */
export function tyreLabel(model: RaceModel, compound: Compound): string {
  return raceScreenEra(model).tyres === 'single-dry' && !isWetTyre(compound)
    ? 'Dry'
    : tyreName(compound);
}

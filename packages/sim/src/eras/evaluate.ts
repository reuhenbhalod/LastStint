// Eras evaluator (eras build plan 1.4; eras spec §6 and §8). One pure function shared by the
// client's preview and the server: from a finished race, the race's `eras` block and the
// graded calls, it decides the three stars, the hidden objective and the rewrite. No DOM or
// Node-only APIs: the Worker runs it.
//
// ★1 Result: the target (eras.target) is met.
// ★2 Strategist: the race accuracy, the mean decisionAccuracy over the graded calls, is at or
//   above the difficulty's threshold.
// ★3 Mastery: the mastery objective is met and no call was graded orange or red.
//
// Targets and the rewrite condition are graded with the grader's own reachedTarget, so a call
// is graded against exactly the result that earns the star.
//
// Objectives, all from the player's car (the model's userSide), all of them requiring it to
// be classified at the flag (not retired, not disqualified): a car out of the race has no
// result to master. Stops, compounds and modes count from the takeover, the part of the race
// the player runs.
//
// Era rules: a car the rules disqualify (the two-compound rule, a race's minimum of stops,
// rules.minStops) isn't classified, so it meets no target or objective. A stop_count objective
// the minimum makes impossible in a dry race is an authoring error and throws.

import { type MomentGrade, type Target, reachedTarget } from '../grade.js';
import { minStopsRule, stopsBeforeTakeover } from '../rules.js';
import { teammateOf } from '../sim.js';
import type {
  ErasBlock,
  ErasObjective,
  ErasTarget,
  ModeValue,
  RaceModel,
  RaceResult,
} from '../types.js';
import {
  type DifficultySettings,
  ERAS_CONFIG,
  type ErasConfig,
  decisionAccuracy,
  meetsAccuracyThreshold,
} from './config.js';
import type { ErasRaceLog } from './race-log.js';

/** A finished race: the model as played, its classification and the player's car's log. */
export interface FinishedRace {
  /** The race as played: `userSide` is the player's car, `realResult` the real order. */
  model: RaceModel;
  /** classify(run) at the flag. */
  result: RaceResult;
  /** The player's car, lap by lap from the takeover (recordLap / raceLog). */
  log: ErasRaceLog;
}

/** One graded call: the moment's grade and the option the player took (as scoreRun takes). */
export interface GradedCall {
  grade: MomentGrade;
  chosen: string;
}

export interface ErasEvaluationInput {
  race: FinishedRace;
  /** The race's Eras block (usually race.model.eras). */
  eras: ErasBlock;
  /** Every graded call of the race: the moments, then the plan if one was picked. */
  calls: GradedCall[];
  /** The era's difficulty row (difficultyFor) or Legend's (legendDifficulty). */
  difficulty: DifficultySettings;
  /** The decision timer was turned off: the stars still count, marked untimed. */
  untimed: boolean;
  /** The accuracy multiplier's source. Default: eras-config.json. */
  config?: ErasConfig;
}

export interface ErasEvaluation {
  stars: {
    /** ★1: the target was met. */
    result: boolean;
    /** ★2: race accuracy at or above the threshold. */
    strategist: boolean;
    /** ★3: the mastery objective met and no orange or red call. */
    mastery: boolean;
  };
  /** The mastery objective on its own, before the no-orange-or-red condition. */
  masteryObjective: boolean;
  /** No call was graded orange or red. */
  cleanCalls: boolean;
  /** The hidden objective was met; null when the race has none authored. */
  hidden: boolean | null;
  /** The storyline's rewrite condition was met; null when the race has none (no storyline,
   * or the Eras side really won: no rewrite). */
  rewrite: boolean | null;
  /** Mean decisionAccuracy over the graded calls, 0-100 (0 with no graded calls). */
  raceAccuracy: number;
  /** Each call's accuracy, in the order given. */
  decisionAccuracies: number[];
  untimed: boolean;
}

/** An Eras target as the grader's Target. `defend` is `win` (from P1, framed as a defence). */
export function graderTarget(target: ErasTarget): Target {
  switch (target.type) {
    case 'win':
    case 'defend':
      return { kind: 'win' };
    case 'position':
      return { kind: 'position', atBest: target.position };
    case 'beat-rival':
      return { kind: 'beat-rival', rival: target.rival };
    case 'deny':
      return { kind: 'deny', rival: target.rival, position: target.position };
    case 'team':
      return { kind: 'team', positions: [target.positions[0], target.positions[1]] };
  }
}

/** Throws on a target the race can't grade (an unknown rival, no teammate). */
function checkTarget(model: RaceModel, target: ErasTarget, where: string): void {
  if (target.type === 'beat-rival' || target.type === 'deny') {
    if (target.rival === model.userSide)
      throw new Error(`${where}: the rival ${target.rival} is the player's car`);
    if (!model.drivers.some((d) => d.code === target.rival))
      throw new Error(`${where}: rival ${target.rival} is not in the race`);
  }
  if (target.type === 'team' && !teammateOf(model))
    throw new Error(`${where}: ${model.userSide} has no teammate in this race`);
}

/** Whether the race result meets an Eras target or rewrite condition. */
export function targetMet(race: FinishedRace, target: ErasTarget): boolean {
  checkTarget(race.model, target, `target ${target.type}`);
  return reachedTarget(race, race.result, graderTarget(target));
}

/** The player's classified position (1-based), or null if not classified. */
function finishPosition(race: FinishedRace): number | null {
  const user = race.model.userSide;
  return race.result.finishers.includes(user) ? race.result.order.indexOf(user) + 1 : null;
}

function checkLog(race: FinishedRace): void {
  const { log, model } = race;
  if (log.driver !== model.userSide)
    throw new Error(`race log is of ${log.driver}, the player's car is ${model.userSide}`);
  if (log.takeoverLap !== model.race.takeoverLap)
    throw new Error(`race log starts after lap ${log.takeoverLap}, not the takeover`);
  const laps = model.race.laps - model.race.takeoverLap;
  if (log.laps.length !== laps)
    throw new Error(`race log has ${log.laps.length} laps, the race ran ${laps} from takeover`);
}

/** The player's stops since the takeover, by out-lap. */
function stopLaps(race: FinishedRace): number[] {
  return race.log.laps.filter((l) => l.running && l.pitted).map((l) => l.lap);
}

/** The compounds the player's car ran from the takeover on. */
function compoundsRun(race: FinishedRace): Set<string> {
  return new Set(race.log.laps.filter((l) => l.running).map((l) => l.compound));
}

/**
 * Green laps the player's car ran with `mode` set. Under a SC, VSC or red flag no mode has an
 * effect (stepLap), so those laps don't count against the limit.
 */
function modeLaps(race: FinishedRace, mode: ModeValue): number {
  return race.log.laps.filter(
    (l) => l.running && l.flag === 'green' && Object.values(l.modes).includes(mode),
  ).length;
}

/**
 * A stop under the SC or VSC, priced as the sim prices it (stopCost): the out-lap runs under
 * the SC or VSC, and the car entered the pits under it too (the in-lap was neutralized) or it
 * was the real team's stop. A new call boxed at the end of the green lap before a deployment
 * is a green-flag stop. A red flag isn't a SC or VSC (eras spec §6), so it doesn't count.
 */
function neutralizedStop(race: FinishedRace, outLap: number): boolean {
  const flagOn = (lap: number) => race.log.laps.find((l) => l.lap === lap)?.flag ?? 'green';
  const neutral = (lap: number) => {
    const f = flagOn(lap);
    return f === 'sc' || f === 'vsc';
  };
  if (!neutral(outLap)) return false;
  if (neutral(outLap - 1)) return true;
  const compound = race.log.laps.find((l) => l.lap === outLap)?.compound;
  return !!race.model.drivers
    .find((d) => d.code === race.model.userSide)
    ?.realStrategy.some((s) => s.lap === outLap && s.to === compound);
}

/**
 * The real team's result for the player's car: its real classified position, or null if it
 * retired in the real race (a RETIREMENT event).
 */
function realPosition(model: RaceModel): number | null {
  const user = model.userSide;
  if (model.events.some((e) => e.type === 'RETIREMENT' && e.driver === user)) return null;
  const i = model.realResult.indexOf(user);
  if (i < 0) throw new Error(`beat_real_call: ${user} is not in the real result`);
  return i + 1;
}

/** Throws on an objective the race can't evaluate (an unknown compound, no teammate). */
function checkObjective(model: RaceModel, objective: ErasObjective, where: string): void {
  if (objective.type === 'compound_rule') {
    for (const c of [objective.mustUse, objective.mustAvoid]) {
      if (c !== undefined && !model.compounds[c])
        throw new Error(`${where}: compound ${c} is not in the race`);
    }
  }
  if (objective.type === 'team_result' && !teammateOf(model))
    throw new Error(`${where}: ${model.userSide} has no teammate in this race`);
  if (objective.type === 'beat_real_call') realPosition(model);
  if (objective.type === 'stop_count' && !model.weather) {
    // Stops count from the takeover; the minimum counts the whole race.
    const driver = model.drivers.find((d) => d.code === model.userSide);
    const need = minStopsRule(model.rules) - (driver ? stopsBeforeTakeover(driver) : 0);
    const most = objective.exact ?? objective.max;
    if (most < need)
      throw new Error(`${where}: ${most} stops from the takeover can't meet the race's minimum`);
  }
}

/** Whether the finished race meets a mastery or hidden objective (eras spec §6). */
export function objectiveMet(race: FinishedRace, objective: ErasObjective): boolean {
  checkObjective(race.model, objective, `objective ${objective.type}`);
  checkLog(race);
  const pos = finishPosition(race);
  if (pos === null) return false;
  const { result, model } = race;
  switch (objective.type) {
    case 'stop_count': {
      const stops = stopLaps(race).length;
      return objective.exact !== undefined ? stops === objective.exact : stops <= objective.max;
    }
    case 'beat_real_call': {
      const real = realPosition(model);
      // Finishing beats a real retirement; otherwise strictly ahead of the real position.
      return real === null || pos < real;
    }
    case 'finish_position':
      return pos <= objective.position;
    case 'margin': {
      // A win by more than `seconds` over P2 (a lone finisher wins by any margin).
      if (pos !== 1) return false;
      const second = result.finishers[1];
      if (second === undefined) return true;
      const gap = result.gaps[second];
      if (gap === undefined) throw new Error(`margin: no gap for ${second}`);
      return gap > objective.seconds;
    }
    case 'compound_rule': {
      const used = compoundsRun(race);
      if (objective.mustUse !== undefined && !used.has(objective.mustUse)) return false;
      if (objective.mustAvoid !== undefined && used.has(objective.mustAvoid)) return false;
      return true;
    }
    case 'mode_rule':
      return modeLaps(race, objective.mode) <= objective.maxLaps;
    case 'no_neutralized_stop':
      return !stopLaps(race).some((lap) => neutralizedStop(race, lap));
    case 'team_result':
      return reachedTarget(race, result, {
        kind: 'team',
        positions: [objective.positions[0], objective.positions[1]],
      });
  }
}

/** The chosen option's grade at a call. Throws if the option wasn't graded. */
function chosenOption(call: GradedCall) {
  const option = call.grade.options.find((o) => o.id === call.chosen);
  if (!option) throw new Error(`option ${call.chosen} not graded at lap ${call.grade.lap}`);
  return option;
}

/** Evaluate a finished Eras race: the three stars, the hidden objective and the rewrite. */
export function evaluateEras(input: ErasEvaluationInput): ErasEvaluation {
  const { race, eras, calls, difficulty, untimed } = input;
  const config = input.config ?? ERAS_CONFIG;
  if (!eras.target) throw new Error(`race ${race.model.race.id} has no Eras target`);
  if (!eras.mastery) throw new Error(`race ${race.model.race.id} has no mastery objective`);

  const chosen = calls.map(chosenOption);
  const decisionAccuracies = chosen.map((o) => decisionAccuracy(o.behindBest, config));
  const raceAccuracy = decisionAccuracies.length
    ? decisionAccuracies.reduce((a, b) => a + b, 0) / decisionAccuracies.length
    : 0;
  const cleanCalls = chosen.every((o) => o.band !== 'orange' && o.band !== 'red');
  const masteryObjective = objectiveMet(race, eras.mastery);

  return {
    stars: {
      result: targetMet(race, eras.target),
      strategist: decisionAccuracies.length > 0 && meetsAccuracyThreshold(raceAccuracy, difficulty),
      mastery: masteryObjective && cleanCalls,
    },
    masteryObjective,
    cleanCalls,
    hidden: eras.hidden ? objectiveMet(race, eras.hidden) : null,
    rewrite: eras.storyline?.rewriteCondition
      ? targetMet(race, eras.storyline.rewriteCondition)
      : null,
    raceAccuracy,
    decisionAccuracies,
    untimed,
  };
}

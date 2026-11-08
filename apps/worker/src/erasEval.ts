// Eras server evaluation (eras build plan 7.3; eras spec §6, §7, §8). The Worker never trusts
// the client's stars: it replays the attempt from (race file, seed, calls) as the attempt was
// played (Legend from the attempt, the rival policy from the era's difficulty), grades every
// call, and runs the evaluator the client's preview runs (sim evaluateEras). Pure (no Worker
// types), so the nightly re-grade (scripts/reverify.ts) evaluates exactly as a submit does.
//
// On the free plan a request gets 10 ms of CPU, so a submit is graded from the grades the game
// claims, checked for shape, as a Daily run is (runs.ts, verifyRun with `claimed`); the nightly
// job re-grades it with full playouts (reverify.ts recheckAttempt) and corrects it.

import {
  type DifficultySettings,
  type ErasBlock,
  GRADE_SAMPLES,
  type GradedCall,
  type RaceModel,
  type RivalPolicy,
  type VerifiedRun,
  classify,
  difficultyFor,
  emptyLog,
  evaluateEras,
  initRun,
  isFinished,
  legendDifficulty,
  recordLap,
  stepLap,
  verifyRun,
} from '@laststint/sim';
import { type CallResult, type PlanResult, stored } from './results.js';

/** Most Expert-rival claims a submit may carry (more decision points than any race has). */
export const MAX_RIVAL_CLAIMS = 200;

/**
 * The attempt's rival can't be replayed on the server yet: Expert (eras spec §7) needs the
 * sim's claimed-choice replay (packages/sim/src/rivals, not merged), and Standard+ and Smart
 * aren't implemented in the sim (rivals/policy.ts RIVAL_POLICY_GAPS). The submit answers 501.
 */
export class RivalUnavailableError extends Error {
  constructor(
    readonly policy: RivalPolicy,
    message: string,
  ) {
    super(message);
    this.name = 'RivalUnavailableError';
  }
}

/** The race file can't be evaluated as an Eras race (no target or mastery objective yet). */
export class EraRaceNotReadyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EraRaceNotReadyError';
  }
}

/** The Expert-rival claims are malformed, or sent for a rival that isn't Expert. */
export class BadRivalClaimsError extends Error {
  readonly code = 'bad-rival-claims';
  constructor(message: string) {
    super(message);
    this.name = 'BadRivalClaimsError';
  }
}

/** The settings an attempt plays at: its era's row of the difficulty table, or Legend's. */
export function attemptDifficulty(playOrder: number, legend: boolean): DifficultySettings {
  const { accuracyThreshold, information, rivalPolicy, decisionTimerSeconds } = legend
    ? legendDifficulty()
    : difficultyFor(playOrder);
  return { accuracyThreshold, information, rivalPolicy, decisionTimerSeconds };
}

/** What one attempt is replayed and evaluated from. */
export interface AttemptInput {
  model: RaceModel;
  seed: number;
  legend: boolean;
  /** The era's (or Legend's) difficulty row: its threshold and rival policy. */
  difficulty: DifficultySettings;
  /** The call log, as the game logged it (run.decisions). */
  decisions: unknown;
  /** The game's claimed grades (as POST /api/runs). Undefined: re-grade in full (nightly). */
  grades: unknown;
  /** The Expert rival's claimed choice at each of its decision points (eras spec §7). */
  rivalClaims: unknown;
  untimed: boolean;
  samples?: number;
}

/** An evaluated attempt, as era_attempts.result stores it and the submit returns it. */
export interface EraAttemptResult {
  raceId: string;
  legend: boolean;
  untimed: boolean;
  /** Race accuracy, 0-100: the mean decisionAccuracy over the graded calls. */
  accuracy: number;
  stars: { result: boolean; strategist: boolean; mastery: boolean };
  masteryObjective: boolean;
  cleanCalls: boolean;
  /** The hidden objective was met (null: the race has none). */
  hidden: boolean | null;
  /** The storyline's rewrite condition was met (null: the race has no storyline). */
  rewrite: boolean | null;
  decisionAccuracies: number[];
  finishPosition: number;
  disqualified: boolean;
  result: {
    order: string[];
    finishers: string[];
    disqualified: string[];
    gaps: Record<string, number>;
  };
  calls: CallResult[];
  plan?: PlanResult;
}

/** The race's Eras block, if it can be evaluated. Throws EraRaceNotReadyError otherwise. */
export function erasBlockOf(model: RaceModel): ErasBlock {
  const eras = model.eras;
  if (!eras?.target || !eras.mastery) {
    throw new EraRaceNotReadyError(`race ${model.race.id} has no Eras target and mastery yet`);
  }
  // The race file's calls and moments are authored for its userSide; a race whose Eras driver
  // is the other car must be rebuilt for that side (build plan 6.2) before it can be graded.
  if (eras.userSide !== undefined && eras.userSide !== model.userSide) {
    throw new EraRaceNotReadyError(
      `race ${model.race.id} is played as ${eras.userSide} but built for ${model.userSide}`,
    );
  }
  return eras;
}

/**
 * The rival policy the replay runs, through the adapter for the rivals that aren't on the
 * server yet. Expert: TODO(eras build plan 9.1) call the sim's claimed-choice check and replay
 * (packages/sim/src/rivals) with `rivalClaims` once it is merged; until then every Expert
 * attempt (Eras 3-1 by play order 8-10, and every Legend attempt) is refused with a 501.
 */
export function rivalReplay(policy: RivalPolicy, rivalClaims: unknown): RivalPolicy {
  if (rivalClaims !== undefined && rivalClaims !== null) {
    if (policy !== 'expert') {
      throw new BadRivalClaimsError(`a ${policy} rival makes no claimed choices`);
    }
    if (!Array.isArray(rivalClaims) || rivalClaims.length > MAX_RIVAL_CLAIMS) {
      throw new BadRivalClaimsError('rivalClaims must be a list of the rival’s choices');
    }
  }
  if (policy === 'expert') {
    throw new RivalUnavailableError(
      policy,
      'the Expert rival’s claimed choices cannot be checked on the server yet',
    );
  }
  return policy;
}

/** initRun refuses a policy the sim can't run yet (sim rivals/policy.ts RivalPolicyError). */
function unavailable(policy: RivalPolicy, e: unknown): never {
  if (e instanceof Error && e.name === 'RivalPolicyError') {
    throw new RivalUnavailableError(policy, e.message);
  }
  throw e;
}

/**
 * Replay, grade and evaluate an attempt. Throws VerifyError on a tampered or malformed call log
 * or impossible claimed grades (exactly as a Daily run), BadRivalClaimsError, EraRaceNotReadyError
 * and RivalUnavailableError.
 */
export function evaluateAttempt(input: AttemptInput): EraAttemptResult {
  const { model, seed, legend, difficulty, decisions, untimed } = input;
  const samples = input.samples ?? GRADE_SAMPLES;
  const eras = erasBlockOf(model);
  const rivalPolicy = rivalReplay(difficulty.rivalPolicy, input.rivalClaims);
  const replay = { legend, rivalPolicy };

  // Full re-grade (nightly) passes no claim; a submit passes the game's (null fails the shape
  // check, as a Daily run without grades does).
  let verified: VerifiedRun;
  try {
    verified =
      input.grades === undefined
        ? verifyRun(model, seed, decisions, samples, undefined, replay)
        : verifyRun(model, seed, decisions, samples, input.grades ?? null, replay);
  } catch (e) {
    unavailable(rivalPolicy, e);
  }

  // The player's car lap by lap (the objectives need it): the same replay, logged. verifyRun
  // has checked the calls, so this can't throw on them.
  const run = initRun(model, seed, { ...replay, decisions: decisions as never });
  const log = emptyLog(run);
  while (!isFinished(run)) {
    stepLap(run);
    recordLap(log, run);
  }
  const result = classify(run);
  if (JSON.stringify(result) !== JSON.stringify(verified.result)) {
    throw new Error(`race ${model.race.id}: the logged replay disagrees with the verified one`);
  }

  const calls: GradedCall[] = [
    ...verified.moments.map((m) => ({ grade: m.grade, chosen: m.chosen })),
    ...(verified.plan ? [{ grade: verified.plan.grade, chosen: verified.plan.chosen }] : []),
  ];
  const evaluation = evaluateEras({
    race: { model, result, log },
    eras,
    calls,
    difficulty,
    untimed,
  });

  // The calls and plan exactly as a Daily run's result shows them (results.ts).
  const shown = stored({ date: '', number: 0, race_id: model.race.id }, verified);
  return {
    raceId: model.race.id,
    legend,
    untimed,
    accuracy: evaluation.raceAccuracy,
    stars: evaluation.stars,
    masteryObjective: evaluation.masteryObjective,
    cleanCalls: evaluation.cleanCalls,
    hidden: evaluation.hidden,
    rewrite: evaluation.rewrite,
    decisionAccuracies: evaluation.decisionAccuracies,
    finishPosition: shown.finishPosition,
    disqualified: shown.disqualified,
    result: shown.result,
    calls: shown.calls,
    ...(shown.plan ? { plan: shown.plan } : {}),
  };
}

/**
 * The upsert that keeps the best result per star (eras spec §6, §9): each star and the hidden
 * objective are OR'd, the accuracy is the max, so a worse attempt never lowers anything. The
 * hidden objective only counts once the race has all three stars (spec §6: it stays hidden
 * until then), this attempt's included. Legend rows (legend = 1) are their own. Binds: player,
 * race, legend, result, strategist, mastery, hidden, accuracy, updated_at.
 */
export const PROGRESS_UPSERT = `INSERT INTO era_progress (player_id, race_id, legend,
    star_result, star_strategist, star_mastery, hidden_done, best_accuracy, updated_at)
  VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7 * ?4 * ?5 * ?6, ?8, ?9)
  ON CONFLICT (player_id, race_id, legend) DO UPDATE SET
    star_result     = max(star_result, excluded.star_result),
    star_strategist = max(star_strategist, excluded.star_strategist),
    star_mastery    = max(star_mastery, excluded.star_mastery),
    hidden_done     = max(hidden_done, ?7 * max(star_result, ?4) * max(star_strategist, ?5)
                                          * max(star_mastery, ?6)),
    best_accuracy   = max(coalesce(best_accuracy, excluded.best_accuracy), excluded.best_accuracy),
    updated_at      = excluded.updated_at`;

/** The first rewrite of a race is the history book's entry (spec §8); later ones add nothing. */
export const HISTORY_INSERT = `INSERT INTO history_entries (player_id, race_id, attempt_id,
    achieved_at) VALUES (?, ?, ?, ?) ON CONFLICT (player_id, race_id) DO NOTHING`;

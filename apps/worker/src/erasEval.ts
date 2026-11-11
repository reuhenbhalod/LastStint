// Eras server evaluation (eras build plan 7.3; eras spec §6, §7, §8). The Worker never trusts
// the client's stars: it replays the attempt from (race file, seed, calls) as the attempt was
// played (Legend, its moments and safety cars, from the attempt; the rival policy from the
// era's difficulty), grades every call, and runs the evaluator the client's preview runs (sim
// evaluateEras). Pure (no Worker types), so the nightly re-grade (scripts/reverify.ts)
// evaluates exactly as a submit does.
//
// On the free plan a request gets 10 ms of CPU, so a submit is graded from the grades the game
// claims, checked for shape, as a Daily run is (runs.ts, verifyRun with `claimed`); the nightly
// job re-grades it with full playouts (reverify.ts recheckAttempt) and corrects it. An Expert
// rival (eras spec §7, "Server check") is the same pattern: the submit replays the rival's
// claimed choices after checking each is legal (sim replayWithRivalClaims), and the nightly
// job re-grades its decision points (regradeRival) and corrects wrong claims.

import {
  type DifficultySettings,
  EXPERT_SAMPLES,
  type ErasBlock,
  type ErasRaceLog,
  GRADE_SAMPLES,
  type GradedCall,
  type RaceModel,
  type RaceResult,
  type ReplayOptions,
  type RivalChoice,
  RivalClaimError,
  type RivalClaimErrorCode,
  type RivalPolicy,
  type VerifiedRun,
  classify,
  difficultyFor,
  emptyLog,
  evaluateEras,
  initRun,
  isFinished,
  legendDifficulty,
  raceLog,
  recordLap,
  regradeRivalPoints,
  replayWithRivalClaims,
  rivalChoices,
  stepLap,
  verifyRun,
} from '@laststint/sim';
import { type CallResult, type PlanResult, stored } from './results.js';

/** Most Expert-rival claims a submit may carry (more decision points than any race has). */
export const MAX_RIVAL_CLAIMS = 200;

/** The race file can't be evaluated as an Eras race (no target or mastery objective yet). */
export class EraRaceNotReadyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EraRaceNotReadyError';
  }
}

/** Why rival claims were refused: the sim's RivalClaimError code, or claims for a non-Expert. */
export type BadRivalClaimsCode = RivalClaimErrorCode | 'not-expert';

/**
 * The Expert rival's claims don't replay (the sim's RivalClaimError: malformed, duplicated,
 * illegal, off its decision points, or missing one), or were sent for a rival that isn't
 * Expert. The submit answers 400 bad-rival-claims with `claimCode`.
 */
export class BadRivalClaimsError extends Error {
  readonly code = 'bad-rival-claims';
  constructor(
    readonly claimCode: BadRivalClaimsCode,
    message: string,
  ) {
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
  /**
   * The Expert rival's claimed choice at each of its decision points (eras spec §7): the
   * game's on a submit, the honest ones (regradeRival) on the nightly re-grade.
   */
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
 * The rival's claimed choices an attempt replays: the list for an Expert rival (none sent is an
 * empty list, which fails on the race's first decision point), null for any other rival.
 * Throws BadRivalClaimsError on claims for a rival that makes none, or more than
 * MAX_RIVAL_CLAIMS; each claim's shape is the sim's to check (parseRivalChoices).
 */
export function rivalClaimsOf(policy: RivalPolicy, rivalClaims: unknown): RivalChoice[] | null {
  const sent = rivalClaims !== undefined && rivalClaims !== null;
  if (policy !== 'expert') {
    if (sent) throw new BadRivalClaimsError('not-expert', `a ${policy} rival makes no choices`);
    return null;
  }
  if (!sent) return [];
  if (!Array.isArray(rivalClaims) || rivalClaims.length > MAX_RIVAL_CLAIMS) {
    throw new BadRivalClaimsError('bad-claim', 'rivalClaims must be a list of the rival’s choices');
  }
  return rivalClaims as RivalChoice[];
}

/** How the replay runs the attempt's race: Legend, the rival, and Expert's claimed choices. */
export function replayOptions(
  legend: boolean,
  policy: RivalPolicy,
  claims: RivalChoice[] | null,
): ReplayOptions {
  return {
    legend,
    rivalPolicy: policy,
    ...(policy === 'expert' ? { rivalChoices: claims ?? [], rivalGrading: 'claims' as const } : {}),
  };
}

/** The nightly re-grade of an Expert rival's claims (regradeRival). */
export interface RivalRegradeResult {
  /** Every claim was the rival grader's pick. */
  honest: boolean;
  /** The decision laps whose claim the grader wouldn't have picked. */
  wrong: number[];
  /** The claims didn't replay at all (the sim's RivalClaimError code). */
  error: RivalClaimErrorCode | null;
  /** The choices the rival really makes: the claims if they were honest. */
  choices: RivalChoice[];
}

/**
 * Re-grade an Expert rival's decision points in full (sim regradeRivalPoints, `rivalSamples`
 * playouts each, as the game's grader): an honest claim is the grader's best at every point.
 * Claims that don't replay at all (RivalClaimError; e.g. stored before the server could
 * replay Expert, so never checked) are dishonest too. Unless honest, the true choices come
 * from replaying the race with the rival grading every point itself. `decisions` must be a
 * call log the submit checked.
 */
export function regradeRival(
  model: RaceModel,
  seed: number,
  decisions: unknown,
  claims: RivalChoice[],
  legend: boolean,
  rivalSamples = EXPERT_SAMPLES,
): RivalRegradeResult {
  const calls = decisions as never;
  let wrong: number[] = [];
  let error: RivalClaimErrorCode | null = null;
  try {
    wrong = regradeRivalPoints(model, seed, calls, claims, { legend, samples: rivalSamples })
      .filter((r) => r.claimed !== r.best)
      .map((r) => r.lap);
  } catch (e) {
    if (!(e instanceof RivalClaimError)) throw e;
    error = e.code;
  }
  if (wrong.length === 0 && error === null) {
    return { honest: true, wrong, error, choices: claims };
  }
  const honest = initRun(model, seed, {
    decisions: calls,
    legend,
    rivalPolicy: 'expert',
    rivalSamples,
  });
  while (!isFinished(honest)) stepLap(honest);
  return { honest: false, wrong, error, choices: rivalChoices(honest) };
}

/** A claim error out of the sim, as the submit's 400. */
function claimError(e: unknown): never {
  if (e instanceof RivalClaimError) throw new BadRivalClaimsError(e.code, e.message);
  throw e;
}

/**
 * Replay, grade and evaluate an attempt. Throws VerifyError on a tampered or malformed call log
 * or impossible claimed grades (exactly as a Daily run), BadRivalClaimsError (an Expert
 * rival's claims don't replay) and EraRaceNotReadyError. The Expert rival replays the claims
 * as given: the nightly job re-grades them first (regradeRival) and passes the honest ones.
 */
export function evaluateAttempt(input: AttemptInput): EraAttemptResult {
  const { model, seed, legend, difficulty, decisions, untimed } = input;
  const samples = input.samples ?? GRADE_SAMPLES;
  const eras = erasBlockOf(model);
  const policy = difficulty.rivalPolicy;
  const claims = rivalClaimsOf(policy, input.rivalClaims);
  const replay = replayOptions(legend, policy, claims);

  // Full re-grade (nightly) passes no claim; a submit passes the game's (null fails the shape
  // check, as a Daily run without grades does). The Expert rival takes its claimed choices.
  let verified: VerifiedRun;
  let logged: LoggedRace;
  try {
    verified =
      input.grades === undefined
        ? verifyRun(model, seed, decisions, samples, undefined, replay)
        : verifyRun(model, seed, decisions, samples, input.grades ?? null, replay);
    // The player's car lap by lap (the objectives need it): the same replay, logged. verifyRun
    // has checked the calls, so this can't throw on them; for Expert it also refuses a claim
    // off the rival's decision points, which verifyRun's replay doesn't check.
    logged = claims
      ? expertLog(model, seed, decisions, claims, legend)
      : loggedReplay(model, seed, decisions, replay);
  } catch (e) {
    claimError(e);
  }
  if (JSON.stringify(logged.result) !== JSON.stringify(verified.result)) {
    throw new Error(`race ${model.race.id}: the logged replay disagrees with the verified one`);
  }
  const { result, log } = logged;

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

interface LoggedRace {
  result: RaceResult;
  log: ErasRaceLog;
}

/** Any rival but Expert: replay once, recording every lap. */
function loggedReplay(
  model: RaceModel,
  seed: number,
  decisions: unknown,
  replay: ReplayOptions,
): LoggedRace {
  const run = initRun(model, seed, { ...replay, decisions: decisions as never });
  const log = emptyLog(run);
  while (!isFinished(run)) {
    stepLap(run);
    recordLap(log, run);
  }
  return { result: classify(run), log };
}

/**
 * Expert: the sim's check of the claims (every claim legal and at one of the rival's decision
 * points, every point claimed; RivalClaimError otherwise), then the race log of that replay.
 */
function expertLog(
  model: RaceModel,
  seed: number,
  decisions: unknown,
  claims: RivalChoice[],
  legend: boolean,
): LoggedRace {
  const replay = replayWithRivalClaims(model, seed, decisions as never, claims, { legend });
  return { result: replay.result, log: raceLog(replay.run) };
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

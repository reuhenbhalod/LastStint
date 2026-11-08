// The rival policies in a live run (eras spec §7): the per-lap hook sim.ts calls after every
// lap (rivalAfterLap), and Expert's decision state: the choices it made, the claims a replay
// follows, and a decision waiting on the background grading workers.
//
// Standard and Standard+ do everything in sim.ts (rivalReacts with the policy's cover window,
// rivalGoesLong); this hook does nothing for them, so Standard runs are unchanged.
//
// Smart, at the end of lap `lap` (after Standard+'s reactions):
// - overcut: the user's stop was charged on `lap` under green, it wasn't the real team's call,
//   and the rival didn't cover it (nor stop itself): its next planned stop moves to the
//   overcutLap out-lap;
// - wet tyres: on slicks, it boxes on lap + 1 for the wetSwitch tyre, in place of the first wet
//   stop of its plan; a planned wet stop due before the crossover waits for it.
//
// Expert: Smart's rules, a lap earlier (the green cover and the overcut fire at the end of the
// player's in-lap, as soon as the stop is called; the wet switch a lap before the crossover;
// sim.ts skips rivalReacts' green-flag cover for it), then at each decision point its own
// grader (expert.ts gradeRivalMoment, EXPERT_SAMPLES samples, playouts with Smart rivals)
// picks among rivalOptions, and the choice becomes its plan. How the grade is made:
// - 'inline' (the default): graded right here, synchronously;
// - 'deferred': the run waits (run.rival.pending) until resolveRivalDecision is called with
//   the option the grading workers picked (expert.ts rivalGradeJob); stepping on first throws;
// - claims (RunOptions.rivalChoices): a claimed choice for the lap is taken without grading,
//   after checking it is one of the point's options; 'claims' mode also refuses a point with
//   no claim (the server's replay, claims.ts replayWithRivalClaims).

import type { RivalPolicy } from '../eras/config.js';
import { type Run, neutralMap } from '../sim.js';
import type { CarState, Compound, PitStop } from '../types.js';
import { isWetTyre } from '../weather.js';
import { gradeRivalMoment } from './expert.js';
import { EXPERT_SAMPLES, RivalPolicyError, coverWindow, hasSmartRules } from './policy.js';
import {
  RIVAL_OPTION_IDS,
  type RivalDecisionReason,
  type RivalOptionId,
  type RivalPlanOption,
  boxNowCompound,
  decisionReasons,
  isRealUserStop,
  overcutLap,
  plannedAfter,
  rivalOptions,
  sameLapCover,
  wetSwitch,
} from './rules.js';

/** The option Expert's rival took at one of its decision points (a claim, when submitted). */
export interface RivalChoice {
  /** The decision lap: the rival decided at the end of it. */
  lap: number;
  option: RivalOptionId;
}

/** One of Expert's decision points as it was played. */
export interface RivalPoint {
  lap: number;
  reasons: RivalDecisionReason[];
  options: RivalPlanOption[];
  chosen: RivalOptionId;
  /** How the choice was made: graded in the run, by the workers, or from a claim. */
  source: 'inline' | 'deferred' | 'claim';
  /** Each option's chance of the rival finishing ahead (graded points only). */
  probabilities?: Partial<Record<RivalOptionId, number>>;
}

export type RivalGrading = 'inline' | 'deferred' | 'claims';

/** Expert's decision state on a Run (undefined for every other policy). */
export interface RivalRunState {
  grading: RivalGrading;
  samples: number;
  /** Claimed choices by lap (RunOptions.rivalChoices). */
  claims: Map<number, RivalOptionId>;
  /** The decision points played so far, in lap order. */
  points: RivalPoint[];
  /** A decision waiting for resolveRivalDecision ('deferred' grading). */
  pending: { lap: number; reasons: RivalDecisionReason[]; options: RivalPlanOption[] } | null;
}

/** A claimed rival choice that doesn't check out (the server rejects the attempt). */
export type RivalClaimErrorCode =
  | 'bad-claim'
  | 'duplicate-claim'
  | 'not-a-decision-point'
  | 'illegal-option'
  | 'missing-claim';

export class RivalClaimError extends Error {
  constructor(
    readonly code: RivalClaimErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'RivalClaimError';
  }
}

/** Validate claimed choices' shape: integer laps, known option ids, one claim per lap. */
export function parseRivalChoices(value: unknown): Map<number, RivalOptionId> {
  const claims = new Map<number, RivalOptionId>();
  if (value === undefined) return claims;
  if (!Array.isArray(value)) throw new RivalClaimError('bad-claim', 'rival choices must be a list');
  for (const c of value as unknown[]) {
    const lap = (c as RivalChoice | null)?.lap;
    const option = (c as RivalChoice | null)?.option;
    if (!Number.isInteger(lap) || (lap as number) < 0)
      throw new RivalClaimError('bad-claim', `rival choice on lap ${JSON.stringify(lap)}`);
    if (!(RIVAL_OPTION_IDS as readonly unknown[]).includes(option))
      throw new RivalClaimError('bad-claim', `unknown rival option ${JSON.stringify(option)}`);
    if (claims.has(lap as number))
      throw new RivalClaimError('duplicate-claim', `two rival choices on lap ${lap}`);
    claims.set(lap as number, option as RivalOptionId);
  }
  return claims;
}

/** initRun: Expert's decision state, or undefined for a policy without one. */
export function initRivalState(
  policy: RivalPolicy,
  options: { rivalChoices?: RivalChoice[]; rivalGrading?: RivalGrading; rivalSamples?: number },
): RivalRunState | undefined {
  if (policy !== 'expert') {
    if (options.rivalChoices?.length)
      throw new RivalPolicyError(`rival choices given for a ${policy} rival (Expert only)`);
    return undefined;
  }
  const grading = options.rivalGrading ?? 'inline';
  if (!['inline', 'deferred', 'claims'].includes(grading))
    throw new RivalPolicyError(`unknown rival grading ${JSON.stringify(grading)}`);
  const samples = options.rivalSamples ?? EXPERT_SAMPLES;
  if (!Number.isInteger(samples) || samples < 1)
    throw new RivalPolicyError(`rival samples must be a positive integer, got ${samples}`);
  return {
    grading,
    samples,
    claims: parseRivalChoices(options.rivalChoices),
    points: [],
    pending: null,
  };
}

/** forkRun: a playout (blind fork) has a Smart rival and no state; any other fork a copy. */
export function forkRivalState(
  state: RivalRunState | undefined,
  blind: boolean,
): RivalRunState | undefined {
  if (!state || blind) return undefined;
  return {
    ...state,
    claims: new Map(state.claims),
    points: state.points.map((p) => ({ ...p })),
    pending: state.pending ? { ...state.pending } : null,
  };
}

/** stepLap: refuse to run a lap while Expert's decision from the last one is unresolved. */
export function assertRivalReady(run: Run): void {
  const pending = run.rival?.pending;
  if (pending)
    throw new RivalPolicyError(
      `the rival's decision after lap ${pending.lap} is waiting (resolveRivalDecision)`,
    );
}

/** The rival's plan before this lap's reactions (stepLap hands it back to rivalAfterLap). */
export function rivalPlanBefore(run: Run): PitStop[] | null {
  if (!run.live || run.rivalPolicy !== 'expert') return null;
  const rival = run.state.cars[run.model.rival];
  return rival ? rival.strategy.map((s) => ({ ...s })) : null;
}

/** The choices Expert's rival made so far, in lap order: the claims a run submits. */
export function rivalChoices(run: Run): RivalChoice[] {
  return (run.rival?.points ?? []).map((p) => ({ lap: p.lap, option: p.chosen }));
}

function knownFlags(run: Run, lap: number) {
  // Plan only on what is known now: neutralizations that have started by the next lap.
  return neutralMap(run.events.filter((e) => e.lap <= lap + 1));
}

function moveNextStop(rival: CarState, lap: number, to: number): void {
  const next = plannedAfter(rival.strategy, lap)[0];
  if (!next) return;
  rival.strategy = rival.strategy.filter((s) => s !== next);
  rival.strategy.push({ lap: to, to: next.to, added: true });
}

function overcut(run: Run, lap: number, rival: CarState): void {
  const to = overcutLap(run.model, rival, lap, knownFlags(run, lap), run.wetness);
  if (to === null) return;
  const from = plannedAfter(rival.strategy, lap)[0]?.lap ?? to;
  moveNextStop(rival, lap, to);
  if (to > from)
    run.notes.push({ lap, kind: 'rival-stays-out', driver: rival.code, detail: `until lap ${to}` });
}

/** Smart's wet rule (both policies); the tyre it switched to, or null. */
function wetRule(run: Run, lap: number, rival: CarState, lead: 0 | 1): Compound | null {
  const { model } = run;
  if (!model.weather || lap >= model.race.laps) return null;
  const wet = wetSwitch(model, rival, lap, lead, run.wetness);
  const firstWet = (stops: PitStop[]) => plannedAfter(stops, lap).find((s) => isWetTyre(s.to));
  if (!wet) {
    // On slicks, a planned wet stop waits for the crossover.
    const due = rival.strategy.find((s) => s.lap === lap + 1 && isWetTyre(s.to));
    if (due && !isWetTyre(rival.compound)) rival.strategy = rival.strategy.filter((s) => s !== due);
    return null;
  }
  const replaced = firstWet(rival.strategy);
  rival.strategy = rival.strategy.filter((s) => s !== replaced && s.lap !== lap + 1);
  rival.strategy.push({ lap: lap + 1, to: wet, added: true });
  return wet;
}

/**
 * Run the rival policy's rules after `lap` (sim.ts stepLap, once the lap is complete and
 * state.lap === lap). `before`: the rival's plan before this lap's reactions (rivalPlanBefore).
 */
export function rivalAfterLap(run: Run, lap: number, before: PitStop[] | null): void {
  const { model, state } = run;
  if (!run.live || !hasSmartRules(run.rivalPolicy)) return;
  const rival = state.cars[model.rival];
  const user = state.cars[model.userSide];
  if (!rival || rival.retired || !user) return;

  if (run.rivalPolicy === 'smart') {
    const covered = run.notes.some((n) => n.lap === lap && n.kind === 'rival-cover');
    if (
      user.pittedThisLap &&
      !run.neutral.get(lap) &&
      !covered &&
      !rival.pittedThisLap &&
      !isRealUserStop(model, lap, user.compound)
    )
      overcut(run, lap, rival);
    wetRule(run, lap, rival, 0);
    return;
  }

  // Expert: the player's stop is visible once called (due on lap + 1).
  const userStop = user.retired ? undefined : user.strategy.find((s) => s.lap === lap + 1);
  const flagNext = run.neutral.get(lap + 1);
  if (userStop && !flagNext && !isRealUserStop(model, lap + 1, userStop.to)) {
    const to = sameLapCover(model, rival, {
      lap,
      gap: user.totalTime - rival.totalTime,
      userStop,
      nextFlag: flagNext,
      window: coverWindow('expert'),
    });
    if (to) {
      const next = plannedAfter(rival.strategy, lap)[0];
      rival.strategy = rival.strategy.filter((s) => s !== next);
      rival.strategy.push({ lap: lap + 1, to, added: true });
      run.notes.push({ lap, kind: 'rival-cover', driver: rival.code, detail: to });
    } else if (!rival.strategy.some((s) => s.lap === lap + 1)) {
      overcut(run, lap, rival);
    }
  }
  const wet = wetRule(run, lap, rival, 1);

  const reasons = decisionReasons({
    lap,
    laps: model.race.laps,
    userStopsNext: !!userStop,
    flagNow: run.neutral.get(lap),
    flagNext,
    rivalStopsNext: rival.strategy.some((s) => s.lap === lap + 1),
    wetSwitch: !!wet,
  });
  if (reasons.length === 0) return;
  const boxTo = boxNowCompound(model, rival, lap, wet, knownFlags(run, lap), run.wetness);
  const options = rivalOptions({
    lap,
    laps: model.race.laps,
    before: before ?? rival.strategy,
    after: rival.strategy,
    boxTo,
  });
  if (options.length < 2) return; // nothing to choose
  decide(run, lap, reasons, options);
}

function apply(run: Run, point: RivalPoint): void {
  const rival = run.state.cars[run.model.rival] as CarState;
  const option = point.options.find((o) => o.id === point.chosen) as RivalPlanOption;
  rival.strategy = option.stops.map((s) => ({ ...s }));
  (run.rival as RivalRunState).points.push(point);
}

function decide(
  run: Run,
  lap: number,
  reasons: RivalDecisionReason[],
  options: RivalPlanOption[],
): void {
  const state = run.rival;
  if (!state) throw new RivalPolicyError('an Expert run has no rival state');
  const claim = state.claims.get(lap);
  if (claim !== undefined) {
    if (!options.some((o) => o.id === claim))
      throw new RivalClaimError(
        'illegal-option',
        `rival choice ${claim} after lap ${lap} is not one of ${options.map((o) => o.id).join(', ')}`,
      );
    state.claims.delete(lap);
    apply(run, { lap, reasons, options, chosen: claim, source: 'claim' });
    return;
  }
  if (state.grading === 'claims')
    throw new RivalClaimError('missing-claim', `no rival choice for its decision after lap ${lap}`);
  if (state.grading === 'deferred') {
    state.pending = { lap, reasons, options };
    return;
  }
  const grade = gradeRivalMoment(run, options, state.samples);
  apply(run, {
    lap,
    reasons,
    options,
    chosen: grade.best as RivalOptionId,
    source: 'inline',
    probabilities: grade.probabilities,
  });
}

/**
 * Resolve a 'deferred' decision with the option the grading workers picked (or any legal
 * option). `probabilities`: the merged grade's, kept on the point for the results screen.
 */
export function resolveRivalDecision(
  run: Run,
  option: RivalOptionId,
  probabilities?: Partial<Record<RivalOptionId, number>>,
): void {
  const pending = run.rival?.pending;
  if (!pending) throw new RivalPolicyError('no rival decision is waiting');
  if (!pending.options.some((o) => o.id === option))
    throw new RivalClaimError(
      'illegal-option',
      `rival option ${option} after lap ${pending.lap} is not one of ${pending.options.map((o) => o.id).join(', ')}`,
    );
  (run.rival as RivalRunState).pending = null;
  apply(run, {
    ...pending,
    chosen: option,
    source: 'deferred',
    ...(probabilities ? { probabilities } : {}),
  });
}

// Verifying a finished daily run from its call log (Phase 4 spec, "Verifying a run").
//
// The Worker never trusts a client's score: it rebuilds the race from (model, seed, calls),
// rebuilds each decision moment's grade exactly as the player's game computed it at the pause,
// and scores the run. The game answers a moment with answerMoment(), which logs the radio
// answer and the chosen option's calls; that is the shape verifyRun() checks.
//
// On Cloudflare's free plan a request gets 10 ms of CPU and full grading takes ~100 ms, so the
// Worker scores a run from the grades the game claims (beta spec B6): verifyRun() with
// `claimed` checks everything but the playouts and rebuilds each grade from the claimed
// chances. Grading is deterministic, so a nightly job re-runs verifyRun() without `claimed`
// and any difference means the claimed grades were edited.

import {
  type Band,
  GRADE_SAMPLES,
  type MomentGrade,
  type RunScore,
  bandFor,
  gradeFromHits,
  gradeMoment,
  realOption,
  scoreRun,
} from './grade.js';
import type { DecisionMoment } from './moments.js';
import {
  type Run,
  classify,
  decide,
  initRun,
  isFinished,
  stepLap,
  validateDecisions,
} from './sim.js';
import type { Decision, RaceModel, RaceResult } from './types.js';

/** The most calls a run may log (a 70-lap race with a call every lap fits easily). */
export const MAX_DECISIONS = 500;

export type VerifyErrorCode = 'invalid-calls' | 'missing-answer' | 'bad-answer' | 'bad-grades';

/**
 * The grades the game computed for one moment at its pause: each option's chance of the
 * target in the moment's option order (`grade.options[i].probability`), and the real team's
 * call's chance when it took none of the options (realOptionId null), else omitted.
 */
export interface ClaimedGrade {
  momentId: string;
  probabilities: number[];
  real?: number;
}

export class VerifyError extends Error {
  constructor(
    readonly code: VerifyErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'VerifyError';
  }
}

/**
 * Answer a decision moment: call it while paused at the moment (run.state.lap === lap - 1).
 * Logs the radio answer and the chosen option's calls.
 */
export function answerMoment(run: Run, moment: DecisionMoment, optionId: string): void {
  const option = moment.options.find((o) => o.id === optionId);
  if (!option) throw new Error(`moment ${moment.id} has no option ${optionId}`);
  if (run.state.lap !== moment.lap - 1) {
    throw new Error(`moment ${moment.id} is answered after lap ${moment.lap - 1}`);
  }
  decide(run, { lap: moment.lap, kind: 'radio', momentId: moment.id, optionId });
  for (const call of option.decisions) decide(run, call);
}

/**
 * The game's grades for a moment, as POST /api/runs takes them: call at the pause, with the
 * moment's grade, BEFORE answerMoment(). When the real team took none of the options, this
 * grades its call too (one more option's playouts).
 */
export function claimGrade(
  run: Run,
  moment: DecisionMoment,
  grade: MomentGrade,
  samples = GRADE_SAMPLES,
): ClaimedGrade {
  const claim: ClaimedGrade = {
    momentId: moment.id,
    probabilities: moment.options.map(
      (o) => grade.options.find((g) => g.id === o.id)?.probability as number,
    ),
  };
  if (!moment.options.some((o) => o.id === moment.realOptionId)) {
    const real = gradeMoment(run, [realOption(run, moment.lap)], moment.target, samples);
    claim.real = real.options[0]?.probability as number;
  }
  return claim;
}

/** The real team's call at a moment, graded against the moment's best option. */
export interface RealCall {
  /** The moment option the real team took, or null if it took none of them. */
  optionId: string | null;
  probability: number;
  band: Band;
}

export interface VerifiedMoment {
  momentId: string;
  lap: number;
  chosen: string;
  /** The moment's options graded at the pause, exactly as the player's game graded them. */
  grade: MomentGrade;
  real: RealCall;
  /** The player made the real team's call. */
  matchedReal: boolean;
}

export interface VerifiedRun {
  result: RaceResult;
  score: RunScore;
  moments: VerifiedMoment[];
  /** The user's car's classified position (1-based; a disqualified car is last). */
  finishPosition: number;
  disqualified: boolean;
}

/** A call without its timestamp, for comparing a logged call with an option's call. */
function callKey(d: Decision): string {
  const { at: _at, ...call } = d;
  return JSON.stringify(call, Object.keys(call).sort());
}

function checkLog(model: RaceModel, decisions: unknown): asserts decisions is Decision[] {
  if (!Array.isArray(decisions)) throw new VerifyError('invalid-calls', 'calls must be an array');
  if (decisions.length > MAX_DECISIONS) {
    throw new VerifyError('invalid-calls', `more than ${MAX_DECISIONS} calls`);
  }
  let last = model.race.takeoverLap;
  for (const d of decisions as Decision[]) {
    if (typeof d !== 'object' || d === null || !Number.isInteger(d.at)) {
      throw new VerifyError('invalid-calls', 'every call needs the lap it was made at');
    }
    if ((d.at as number) < last) throw new VerifyError('invalid-calls', 'calls out of order');
    last = d.at as number;
  }
  try {
    validateDecisions(model, decisions as Decision[]);
  } catch (e) {
    throw new VerifyError('invalid-calls', (e as Error).message);
  }
}

/** The option chosen at each moment, checked against the log. */
function answers(model: RaceModel, decisions: Decision[]): Map<string, string> {
  const ids = new Set(model.decisionMoments.map((m) => m.id));
  for (const d of decisions) {
    if (d.kind === 'radio' && !ids.has(d.momentId)) {
      throw new VerifyError('bad-answer', `unknown moment ${d.momentId}`);
    }
  }
  const chosen = new Map<string, string>();
  for (const m of model.decisionMoments) {
    const radio = decisions.filter((d) => d.kind === 'radio' && d.momentId === m.id);
    if (radio.length !== 1) {
      throw new VerifyError('missing-answer', `moment ${m.id} needs exactly one answer`);
    }
    const answer = radio[0] as Extract<Decision, { kind: 'radio' }>;
    const option = m.options.find((o) => o.id === answer.optionId);
    if (!option || answer.lap !== m.lap || answer.at !== m.lap - 1) {
      throw new VerifyError('bad-answer', `moment ${m.id} was answered wrongly`);
    }
    // The moment's lap carries exactly the chosen option's calls, made at the pause.
    const logged = decisions.filter((d) => d.lap === m.lap && d.kind !== 'radio');
    const want = option.decisions.map(callKey).sort();
    const got = logged.map(callKey).sort();
    if (
      logged.some((d) => d.at !== m.lap - 1) ||
      want.length !== got.length ||
      want.some((k, i) => k !== got[i])
    ) {
      throw new VerifyError('bad-answer', `calls for lap ${m.lap} don't match option ${option.id}`);
    }
    chosen.set(m.id, option.id);
  }
  return chosen;
}

/** The run paused before a moment, holding only the calls the player had made by then. */
function pausedBefore(model: RaceModel, seed: number, decisions: Decision[], lap: number): Run {
  const known = decisions.filter((d) => (d.at as number) < lap - 1);
  const run = initRun(model, seed, { decisions: known });
  while (run.state.lap < lap - 1) stepLap(run);
  return run;
}

/** A claimed chance as a whole number of the `samples` playouts, or null if it isn't one. */
function hitsFor(p: unknown, samples: number): number | null {
  if (typeof p !== 'number' || !Number.isFinite(p) || p < 0 || p > 1) return null;
  const hits = Math.round(p * samples);
  return Math.abs(hits - p * samples) < 1e-6 ? hits : null;
}

/** The claimed grade for each moment (by id), checked for shape. Throws `bad-grades`. */
function claimedGrades(
  model: RaceModel,
  claimed: unknown,
  samples: number,
): Map<string, { hits: number[]; real: number | null }> {
  const bad = (why: string): never => {
    throw new VerifyError('bad-grades', why);
  };
  if (!Array.isArray(claimed) || claimed.length !== model.decisionMoments.length) {
    bad('grades must list every moment once');
  }
  const out = new Map<string, { hits: number[]; real: number | null }>();
  for (const c of claimed as ClaimedGrade[]) {
    const m = model.decisionMoments.find((x) => x.id === c?.momentId);
    if (!m || out.has(m.id)) return bad('grades must list every moment once');
    const probs = c.probabilities;
    if (!Array.isArray(probs) || probs.length !== m.options.length) {
      return bad(`moment ${m.id} needs one chance per option`);
    }
    const hits = probs.map((p) => hitsFor(p, samples));
    if (hits.some((h) => h === null)) return bad(`moment ${m.id} has an invalid chance`);
    const needsReal = !m.options.some((o) => o.id === m.realOptionId);
    let real: number | null = null;
    if (needsReal) {
      real = hitsFor(c.real, samples);
      if (real === null) return bad(`moment ${m.id} needs the real call's chance`);
    } else if (c.real !== undefined) {
      return bad(`moment ${m.id}'s real call is one of its options`);
    }
    out.set(m.id, { hits: hits as number[], real });
  }
  return out;
}

/**
 * Verify a finished run: check the call log, replay the race to the flag, grade every moment
 * from the pause the player saw, and score it. Without `claimed`, each moment is re-graded
 * with full playouts; with it (the game's grades, see ClaimedGrade), the claimed chances are
 * checked for shape and used instead. Throws VerifyError on a bad log or bad grades.
 */
export function verifyRun(
  model: RaceModel,
  seed: number,
  decisions: unknown,
  samples = GRADE_SAMPLES,
  claimed?: unknown,
): VerifiedRun {
  checkLog(model, decisions);
  const chosen = answers(model, decisions);
  const claims = claimed === undefined ? null : claimedGrades(model, claimed, samples);

  const run = initRun(model, seed, { decisions });
  while (!isFinished(run)) stepLap(run);
  const result = classify(run);

  const moments = [...model.decisionMoments]
    .sort((a, b) => a.lap - b.lap)
    .map((m): VerifiedMoment => {
      const claim = claims?.get(m.id);
      const paused = claim ? null : pausedBefore(model, seed, decisions, m.lap);
      const grade = claim
        ? gradeFromHits(m.lap - 1, m.options, m.target, samples, claim.hits)
        : gradeMoment(paused as Run, m.options, m.target, samples);
      const best = Math.max(...grade.options.map((o) => o.probability));
      let real: RealCall;
      const taken = grade.options.find((o) => o.id === m.realOptionId);
      if (taken) {
        real = { optionId: taken.id, probability: taken.probability, band: taken.band };
      } else {
        const p = claim
          ? (claim.real as number) / samples
          : (gradeMoment(paused as Run, [realOption(paused as Run, m.lap)], m.target, samples)
              .options[0]?.probability as number);
        real = { optionId: null, probability: p, band: bandFor((best - p) * 100) };
      }
      const pick = chosen.get(m.id) as string;
      return {
        momentId: m.id,
        lap: m.lap,
        chosen: pick,
        grade,
        real,
        matchedReal: pick === m.realOptionId,
      };
    });

  const score = scoreRun(moments.map((m) => ({ grade: m.grade, chosen: m.chosen })));
  const user = model.userSide;
  return {
    result,
    score,
    moments,
    finishPosition: result.order.indexOf(user) + 1,
    disqualified: result.disqualified.includes(user),
  };
}

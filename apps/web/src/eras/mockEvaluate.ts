// MOCK evaluation of a submitted Eras attempt (dev only, `VITE_ERAS_MOCK=1`): the Worker's
// erasEval.ts evaluateAttempt, run in the browser with the same sim functions, so the results
// screen can be worked on without a Worker. Not the real thing: it trusts this browser.

import {
  type Band,
  type DifficultySettings,
  type GradedCall,
  type RaceModel,
  classify,
  emptyLog,
  evaluateEras,
  initRun,
  isFinished,
  recordLap,
  stepLap,
  verifyRun,
} from '@laststint/sim';
import { ApiError } from '../api.js';
import type { CallResult } from '../data/api.js';
import type { AttemptResult, AttemptSubmission } from './api.js';

export type MockEvaluation = Omit<
  AttemptResult,
  'attemptId' | 'newStars' | 'historyEntry' | 'progress' | 'rank' | 'total'
>;

/** Replay, grade (from the claimed grades) and evaluate an attempt, as the Worker does. */
export function mockEvaluate(
  model: RaceModel,
  attempt: { seed: number; legend: boolean; difficulty: DifficultySettings },
  body: AttemptSubmission,
): MockEvaluation {
  const eras = model.eras;
  if (!eras?.target || !eras.mastery) {
    throw new ApiError(503, 'race-not-ready', `race ${model.race.id} has no Eras target yet`);
  }
  const rivalPolicy = attempt.difficulty.rivalPolicy;
  if (rivalPolicy === 'expert') {
    // As the Worker until it replays the Expert rival's claims.
    throw new ApiError(501, 'rival-unavailable', 'the mock can’t check an Expert rival');
  }
  const replay = { legend: attempt.legend, rivalPolicy };
  let verified: ReturnType<typeof verifyRun>;
  try {
    verified = verifyRun(model, attempt.seed, body.decisions, undefined, body.grades, replay);
  } catch (e) {
    const code = (e as { code?: string }).code ?? 'bad-request';
    throw new ApiError(400, code, e instanceof Error ? e.message : String(e));
  }
  const run = initRun(model, attempt.seed, { ...replay, decisions: body.decisions });
  const log = emptyLog(run);
  while (!isFinished(run)) {
    stepLap(run);
    recordLap(log, run);
  }
  const result = classify(run);
  const graded: GradedCall[] = [
    ...verified.moments.map((m) => ({ grade: m.grade, chosen: m.chosen })),
    ...(verified.plan ? [{ grade: verified.plan.grade, chosen: verified.plan.chosen }] : []),
  ];
  const evaluation = evaluateEras({
    race: { model, result, log },
    eras,
    calls: graded,
    difficulty: attempt.difficulty,
    untimed: body.untimed,
  });
  const scored = verified.score.calls;
  const calls: CallResult[] = verified.moments.map((m, i) => ({
    momentId: m.momentId,
    lap: m.lap,
    chosen: m.chosen,
    band: scored[i]?.band as Band,
    points: scored[i]?.points as number,
    probability: scored[i]?.probability as number,
    best: m.grade.best,
    options: m.grade.options,
    real: m.real,
    matchedReal: m.matchedReal,
  }));
  const planCall = scored[scored.length - 1];
  return {
    raceId: model.race.id,
    legend: attempt.legend,
    untimed: body.untimed,
    accuracy: evaluation.raceAccuracy,
    stars: evaluation.stars,
    masteryObjective: evaluation.masteryObjective,
    cleanCalls: evaluation.cleanCalls,
    hidden: evaluation.hidden,
    rewrite: evaluation.rewrite,
    decisionAccuracies: evaluation.decisionAccuracies,
    finishPosition: verified.finishPosition,
    disqualified: verified.disqualified,
    result: {
      order: verified.result.order,
      finishers: verified.result.finishers,
      disqualified: verified.result.disqualified,
      gaps: verified.result.gaps,
    },
    calls,
    ...(verified.plan && planCall
      ? {
          plan: {
            chosen: verified.plan.chosen,
            band: planCall.band,
            points: planCall.points,
            probability: planCall.probability,
            best: verified.plan.grade.best,
            options: verified.plan.grade.options,
          },
        }
      : {}),
  };
}

// A verified run as stored in D1 and shown on the results screen. Pure (no Worker types), so
// the nightly re-grading script (scripts/reverify.ts) builds results exactly as the Worker does.

import type { Band, OptionGrade, RealCall, VerifiedRun } from '@laststint/sim';

/** One graded call, as the results screen and the share card show it. */
export interface CallResult {
  momentId: string;
  lap: number;
  chosen: string;
  band: Band;
  points: number;
  probability: number;
  /** The best option at that moment. */
  best: string;
  options: OptionGrade[];
  real: RealCall;
  matchedReal: boolean;
}

/** The race plan picked at takeover, graded (strategy planner spec D7). */
export interface PlanResult {
  chosen: string;
  band: Band;
  points: number;
  probability: number;
  /** The best plan offered. */
  best: string;
  options: OptionGrade[];
}

/** What a stored run holds; the response adds the live standing. */
export interface StoredResult {
  date: string;
  number: number;
  raceId: string;
  score: number;
  meanProbability: number;
  finishPosition: number;
  disqualified: boolean;
  result: {
    order: string[];
    finishers: string[];
    disqualified: string[];
    gaps: Record<string, number>;
  };
  calls: CallResult[];
  /** Absent for runs without a plan (before the planner). */
  plan?: PlanResult;
}

/** The daily fields a stored result carries. */
export interface ResultDaily {
  date: string;
  number: number;
  race_id: string;
}

export function stored(daily: ResultDaily, v: VerifiedRun): StoredResult {
  return {
    date: daily.date,
    number: daily.number,
    raceId: daily.race_id,
    score: v.score.score,
    meanProbability: v.score.meanProbability,
    finishPosition: v.finishPosition,
    disqualified: v.disqualified,
    result: {
      order: v.result.order,
      finishers: v.result.finishers,
      disqualified: v.result.disqualified,
      gaps: v.result.gaps,
    },
    calls: v.moments.map((m, i) => {
      const call = v.score.calls[i];
      return {
        momentId: m.momentId,
        lap: m.lap,
        chosen: m.chosen,
        band: call?.band as Band,
        points: call?.points as number,
        probability: call?.probability as number,
        best: m.grade.best,
        options: m.grade.options,
        real: m.real,
        matchedReal: m.matchedReal,
      };
    }),
    ...(v.plan ? { plan: planResult(v) } : {}),
  };
}

/** The plan's grade; its call is the score's last (sim verifyRun). */
function planResult(v: VerifiedRun): PlanResult {
  const plan = v.plan as NonNullable<VerifiedRun['plan']>;
  const call = v.score.calls[v.score.calls.length - 1];
  return {
    chosen: plan.chosen,
    band: call?.band as Band,
    points: call?.points as number,
    probability: call?.probability as number,
    best: plan.grade.best,
    options: plan.grade.options,
  };
}

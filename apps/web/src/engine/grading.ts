// Grading a decision moment off the render thread. At the pause the game describes the moment
// as a plain-JSON GradeJob (the sim's `gradeJob`), a Web Worker counts each option's successes
// (`runGradeJob`, ~300 playouts per option), and the hits become the moment's grade plus the
// claim the server scores from (POST /api/runs `grades`, docs/api.md). When the real team took
// none of the moment's options, its call rides along as one more option, so the claim carries
// its chance too (exactly what `claimGrade` would compute: options share sample seeds).

import {
  type ClaimedGrade,
  type DecisionMoment,
  GRADE_SAMPLES,
  type GradeJob,
  type MomentGrade,
  type RivalGrade,
  type RivalGradeJob,
  type Run,
  gradeFromHits,
  gradeJob,
  mergeRivalGradeJobs,
  realOption,
  runGradeJob,
  runRivalGradeJob,
} from '@laststint/sim';
import type { GradeReply, GradeRequest } from './gradeMessage.js';

export interface MomentJob {
  momentId: string;
  job: GradeJob;
  /** The job grades the real team's call as an extra, last option. */
  withReal: boolean;
}

/** A graded moment: the grade shown on the results screen and the claim sent with the run. */
export interface GradedMoment {
  grade: MomentGrade;
  claim: ClaimedGrade;
}

/** Describe a run paused at `moment` (state.lap === moment.lap - 1) for a grading worker. */
export function momentJob(run: Run, moment: DecisionMoment, samples = GRADE_SAMPLES): MomentJob {
  const withReal = !moment.options.some((o) => o.id === moment.realOptionId);
  const options = withReal ? [...moment.options, realOption(run, moment.lap)] : moment.options;
  return { momentId: moment.id, job: gradeJob(run, options, moment.target, samples), withReal };
}

/** Turn a job's per-option hits into the moment's grade and its claim. */
export function gradedFromHits(
  moment: DecisionMoment,
  { job, withReal }: MomentJob,
  hits: number[],
): GradedMoment {
  const samples = job.samples ?? GRADE_SAMPLES;
  const n = moment.options.length;
  const grade = gradeFromHits(
    job.pausedAtLap,
    moment.options,
    moment.target,
    samples,
    hits.slice(0, n),
  );
  const claim: ClaimedGrade = {
    momentId: moment.id,
    probabilities: grade.options.map((o) => o.probability),
  };
  if (withReal) claim.real = (hits[n] ?? 0) / samples;
  return { grade, claim };
}

/**
 * Counts a job's hits. The browser uses a Web Worker; tests and fallbacks run inline.
 * `rivalHits`: an Expert rival's decision (eras spec §7), each of its options' hits over the
 * job's samples (the sim's `runRivalGradeJob`); absent, it is counted inline.
 */
export interface Grader {
  hits(job: GradeJob): Promise<number[]>;
  rivalHits?(job: RivalGradeJob): Promise<number[]>;
}

export const inlineGrader: Grader = {
  hits: async (job) => runGradeJob(job).hits,
  rivalHits: async (job) => runRivalGradeJob(job).hits,
};

/** Grade an Expert rival's waiting decision with a grader: its best option and chances. */
export async function gradeRival(grader: Grader, job: RivalGradeJob): Promise<RivalGrade> {
  const hits = await (grader.rivalHits ?? inlineGrader.rivalHits)?.(job);
  if (!hits) throw new Error('no grader for the rival');
  return mergeRivalGradeJobs(job, [{ from: 0, to: job.samples, hits }]);
}

/** One module Worker, jobs answered in order. Falls back to inline if Workers are missing. */
export function browserGrader(): Grader {
  if (typeof Worker === 'undefined') return inlineGrader;
  const worker = new Worker(new URL('./grader.worker.ts', import.meta.url), { type: 'module' });
  let next = 0;
  const pending = new Map<
    number,
    { resolve: (hits: number[]) => void; reject: (e: Error) => void }
  >();
  worker.onmessage = (e: MessageEvent<GradeReply>) => {
    const waiting = pending.get(e.data.id);
    pending.delete(e.data.id);
    if (!waiting) return;
    if ('error' in e.data) waiting.reject(new Error(e.data.error));
    else waiting.resolve(e.data.hits);
  };
  const send = (request: Omit<GradeRequest, 'id'>) =>
    new Promise<number[]>((resolve, reject) => {
      const id = next++;
      pending.set(id, { resolve, reject });
      worker.postMessage({ ...request, id } as GradeRequest);
    });
  return {
    hits: (job) => send({ kind: 'moment', job }),
    rivalHits: (job) => send({ kind: 'rival', job }),
  };
}

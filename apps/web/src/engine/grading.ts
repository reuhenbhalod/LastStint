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
  type Run,
  gradeFromHits,
  gradeJob,
  realOption,
  runGradeJob,
} from '@laststint/sim';

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

/** Counts a job's hits. The browser uses a Web Worker; tests and fallbacks run inline. */
export interface Grader {
  hits(job: GradeJob): Promise<number[]>;
}

export const inlineGrader: Grader = {
  hits: async (job) => runGradeJob(job).hits,
};

/** One module Worker, jobs answered in order. Falls back to inline if Workers are missing. */
export function browserGrader(): Grader {
  if (typeof Worker === 'undefined') return inlineGrader;
  const worker = new Worker(new URL('./grader.worker.ts', import.meta.url), { type: 'module' });
  let next = 0;
  const pending = new Map<number, (hits: number[]) => void>();
  worker.onmessage = (e: MessageEvent<{ id: number; hits: number[] }>) => {
    pending.get(e.data.id)?.(e.data.hits);
    pending.delete(e.data.id);
  };
  return {
    hits: (job) =>
      new Promise((resolve) => {
        const id = next++;
        pending.set(id, resolve);
        worker.postMessage({ id, job });
      }),
  };
}

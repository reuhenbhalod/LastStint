// The grading worker's messages (grader.worker.ts): a decision moment's or plan's GradeJob, or
// an Expert rival's RivalGradeJob (eras spec §7: the rival's own grader runs in the background
// workers, not on the UI thread). Kept apart from the worker file so it can be tested.

import { type GradeJob, type RivalGradeJob, runGradeJob, runRivalGradeJob } from '@laststint/sim';

export type GradeRequest =
  | { id: number; kind?: 'moment'; job: GradeJob }
  | { id: number; kind: 'rival'; job: RivalGradeJob };

export type GradeReply = { id: number; hits: number[] } | { id: number; error: string };

/** Answer one request: the job's hits per option, or the error (never thrown at the worker). */
export function answerGradeRequest(request: GradeRequest): GradeReply {
  try {
    const hits =
      request.kind === 'rival' ? runRivalGradeJob(request.job).hits : runGradeJob(request.job).hits;
    return { id: request.id, hits };
  } catch (e) {
    return { id: request.id, error: e instanceof Error ? e.message : String(e) };
  }
}

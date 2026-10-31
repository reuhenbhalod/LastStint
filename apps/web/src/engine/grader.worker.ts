// Grading worker: counts a decision moment's successes per option off the render thread.
import { type GradeJob, runGradeJob } from '@boxthislap/sim';

self.onmessage = (e: MessageEvent<{ id: number; job: GradeJob }>) => {
  const { id, job } = e.data;
  self.postMessage({ id, hits: runGradeJob(job).hits });
};

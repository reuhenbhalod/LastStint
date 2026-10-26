// Worker-thread job for scripts/bench.ts --workers: grade one sample range of a GradeJob.
import { parentPort } from 'node:worker_threads';
import { type GradeJob, runGradeJob } from '../src/grade.js';

parentPort?.on('message', (msg: { job: GradeJob; from: number; to: number }) => {
  parentPort?.postMessage(runGradeJob(msg.job, msg.from, msg.to));
});

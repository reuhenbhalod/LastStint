// Worker-thread job for scripts/bench-rival.ts: count one sample range of an Expert rival's
// decision (RivalGradeJob), as a background grading Web Worker would.
import { parentPort } from 'node:worker_threads';
import { type RivalGradeJob, runRivalGradeJob } from '../src/rivals/expert.js';

parentPort?.on('message', (msg: { job: RivalGradeJob; from: number; to: number }) => {
  parentPort?.postMessage(runRivalGradeJob(msg.job, msg.from, msg.to));
});

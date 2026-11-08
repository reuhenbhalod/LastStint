import abuDhabi2021 from '@data/races/abu-dhabi-2021.json';
import {
  type RaceModel,
  type RivalGradeJob,
  decide,
  initRun,
  rivalGradeJob,
  runRivalGradeJob,
  stepLap,
} from '@laststint/sim';
import { describe, expect, it } from 'vitest';
import { GameEngine, decisionMoments } from './engine.js';
import { answerGradeRequest } from './gradeMessage.js';
import { gradeRival, inlineGrader } from './grading.js';

const MODEL = abuDhabi2021 as unknown as RaceModel;

/** An Expert run paused at its first decision, as a job (the player boxes at the SC). */
function expertJob(): RivalGradeJob {
  const sc = MODEL.decisionMoments.find((m) => m.id === 'sc-stop');
  if (!sc) throw new Error('Abu Dhabi has an SC moment');
  const run = initRun(MODEL, MODEL.race.seed, {
    decisions: [],
    rivalPolicy: 'expert',
    rivalGrading: 'deferred',
    rivalSamples: 12,
  });
  for (let i = 0; i < MODEL.race.laps && !run.rival?.pending; i++) {
    if (run.state.lap === sc.lap - 1) decide(run, { lap: sc.lap, kind: 'pit', compound: 'SOFT' });
    stepLap(run);
  }
  if (!run.rival?.pending) throw new Error('no Expert decision');
  return rivalGradeJob(run);
}

describe('the grading worker’s messages', () => {
  it('answers a moment job with its hits, as before', () => {
    const engine = new GameEngine(MODEL, MODEL.race.seed, { decisions: [] });
    const moment = decisionMoments(MODEL)[0];
    if (!moment) throw new Error('a moment');
    while (engine.lap < moment.lap - 1) engine.step();
    const { job } = engine.gradingJob(moment, 8);
    const reply = answerGradeRequest({ id: 3, job });
    expect(reply).toMatchObject({ id: 3 });
    expect('hits' in reply && reply.hits.length).toBe(job.options.length);
  });

  it('routes a rival job to runRivalGradeJob', () => {
    const job = expertJob();
    expect(answerGradeRequest({ id: 7, kind: 'rival', job })).toEqual({
      id: 7,
      hits: runRivalGradeJob(job).hits,
    });
  });

  it('answers an error instead of throwing in the worker', () => {
    const job = { ...expertJob(), pausedAtLap: 1 };
    const reply = answerGradeRequest({ id: 9, kind: 'rival', job });
    expect(reply).toMatchObject({ id: 9, error: expect.any(String) });
  });

  it('merges a rival grade from a grader into its best option', async () => {
    const job = expertJob();
    const grade = await gradeRival(inlineGrader, job);
    expect(grade.samples).toBe(job.samples);
    expect(Object.keys(grade.probabilities)).toContain(grade.best);
    // A grader without rivalHits is counted here instead.
    const plain = await gradeRival({ hits: inlineGrader.hits }, job);
    expect(plain).toEqual(grade);
  });
});

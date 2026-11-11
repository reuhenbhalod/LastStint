import {
  type GradeJob,
  type RivalGradeJob,
  legendMoments,
  replayWithRivalClaims,
  runGradeJob,
  runRivalGradeJob,
} from '@laststint/sim';
import { describe, expect, it } from 'vitest';
import { StaticDailyProvider } from '../data/provider.js';
import type { Daily } from '../data/types.js';
import type { Grader } from '../engine/grading.js';
import { GameSession, liveOptions, momentsOf } from './session.js';

const base = () => new StaticDailyProvider().today();

/** A grader whose Expert-rival jobs wait until the test answers them (as a slow worker). */
function heldGrader() {
  const waiting: Array<{ job: RivalGradeJob; answer: () => void }> = [];
  const rivalJobs: RivalGradeJob[] = [];
  const grader: Grader = {
    hits: async (job: GradeJob) => runGradeJob(job).hits,
    rivalHits: (job) =>
      new Promise((resolve) => {
        rivalJobs.push(job);
        waiting.push({ job, answer: () => resolve(runRivalGradeJob(job).hits) });
      }),
  };
  return { grader, waiting, rivalJobs };
}

/** Answer each moment with the real call, except box at the SC (an Expert decision point). */
function pick(session: GameSession): void {
  const m = session.state.currentMoment;
  if (!m) return;
  session.choose(
    m.id === 'sc-stop' ? 'box-soft' : (m.realOptionId ?? (m.options[0]?.id as string)),
  );
}

describe('Expert rival graded in the background (eras spec §7)', () => {
  it('runs an Expert race with deferred grading, waiting for the worker at each rival decision', async () => {
    const today: Daily = { ...(await base()), source: 'eras', run: { rivalPolicy: 'expert' } };
    expect(liveOptions(today)).toEqual({ rivalPolicy: 'expert', rivalGrading: 'deferred' });
    const { grader, waiting, rivalJobs } = heldGrader();
    const session = new GameSession(today, { grader });
    session.start();
    session.pickPlan('a');
    let held = 0;
    for (let i = 0; i < 400 && session.state.phase !== 'finished'; i++) {
      if (session.state.phase === 'decision') {
        pick(session);
        continue;
      }
      const next = waiting.shift();
      if (next) {
        // The rival's call is with the worker: the race holds.
        const lap = session.state.race.lap;
        session.tick();
        expect(session.state.race.lap).toBe(lap);
        held += 1;
        next.answer();
        await session.rivalGraded();
        // The waiting lap ran once the grade was in.
        expect(session.state.race.lap).toBe(lap + 1);
        continue;
      }
      session.tick();
    }
    expect(session.state.phase).toBe('finished');
    expect(rivalJobs.length).toBeGreaterThan(0);
    expect(held).toBe(rivalJobs.length);
    const choices = session.rivalChoices();
    expect(choices.map((c) => c.lap)).toEqual(rivalJobs.map((j) => j.pausedAtLap));

    // The server replays the same race from the calls and the rival's claimed choices.
    const body = await session.submission('');
    const replay = replayWithRivalClaims(today.model, today.seed, body.decisions, choices);
    expect(replay.result.order).toEqual(session.state.result?.order);
  }, 120_000);

  it('resumes an Expert race with the rival’s choices so far', async () => {
    const today: Daily = { ...(await base()), source: 'eras', run: { rivalPolicy: 'expert' } };
    const { grader, waiting } = heldGrader();
    const session = new GameSession(today, { grader });
    session.start();
    session.pickPlan('a');
    for (let i = 0; i < 400 && session.rivalChoices().length === 0; i++) {
      if (session.state.phase === 'decision') pick(session);
      const next = waiting.shift();
      if (next) {
        next.answer();
        await session.rivalGraded();
      } else session.tick();
    }
    expect(session.rivalChoices().length).toBeGreaterThan(0);
    const saved = JSON.parse(JSON.stringify(session.persist()));
    expect(saved.rivalChoices).toEqual(session.rivalChoices());
    const back = GameSession.restore(today, saved, grader);
    expect(back?.rivalChoices()).toEqual(session.rivalChoices());
    expect(back?.state.race).toEqual(session.state.race);
  }, 120_000);

  it('leaves Daily runs on today’s rival', async () => {
    expect(liveOptions(await base())).toEqual({});
  });
});

describe('Legend decision moments (eras spec §8)', () => {
  it('asks the moments of the attempt’s own safety cars, from its seed', async () => {
    const today = await base();
    // A seed whose Legend safety cars give moments the real race doesn't have.
    let seed = 1;
    const real = JSON.stringify(today.model.decisionMoments.map((m) => m.id).sort());
    while (
      JSON.stringify(
        legendMoments(today.model, seed)
          .map((m) => m.id)
          .sort(),
      ) === real
    )
      seed++;
    const legend: Daily = { ...today, seed, source: 'eras', run: { legend: true } };
    const want = legendMoments(today.model, seed);
    expect(momentsOf(legend)).toEqual(want);
    const session = new GameSession(legend);
    expect(session.state.moments).toEqual(want);
    expect(session.state.moments.map((m) => m.id)).not.toEqual(
      today.model.decisionMoments.map((m) => m.id),
    );
    // A restored Legend run asks the same moments.
    const back = GameSession.restore(legend, JSON.parse(JSON.stringify(session.persist())));
    expect(back?.state.moments).toEqual(want);
    // Not Legend: the race's own moments.
    expect(momentsOf({ ...legend, run: {} }).map((m) => m.id)).toEqual(
      [...today.model.decisionMoments].sort((a, b) => a.lap - b.lap).map((m) => m.id),
    );
  });
});

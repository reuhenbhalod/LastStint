// The engineer's new plan mid-race (strategy planner spec D5): "Switch" takes it even when its
// first stop is on the coming lap (a plan from the live re-rank can box straight away). Before,
// that plan was refused and the offer sat on screen doing nothing.

import { type GradeJob, runGradeJob } from '@laststint/sim';
import { describe, expect, it } from 'vitest';
import { StaticDailyProvider } from '../data/provider.js';
import type { Grader } from '../engine/grading.js';
import { GameSession } from './session.js';

const grader: Grader = {
  hits: async (job: GradeJob) => runGradeJob(job).hits,
  rivalHits: async () => [],
};

/** A session racing on its plan, a few laps in, not paused for a moment. */
async function racing() {
  const today = await new StaticDailyProvider().today();
  const session = new GameSession(today, { grader });
  session.start();
  session.pickPlan('a');
  for (let i = 0; i < 3 || session.state.phase !== 'racing'; i++) {
    if (session.state.phase === 'decision') {
      const m = session.state.currentMoment;
      session.choose(m?.realOptionId ?? (m?.options[0]?.id as string));
    } else session.tick();
  }
  return session;
}

describe('changePlan', () => {
  it('takes a plan that boxes on the coming lap, and makes that pit call now', async () => {
    const session = await racing();
    const lap = session.state.race.lap;
    const me = session.state.race.cars[session.state.meta.userSide];
    const compound = me?.compound === 'HARD' ? 'MEDIUM' : 'HARD';
    const ok = session.changePlan({
      id: 'a',
      stops: [{ lap: lap + 1, compound }],
      pace: ['standard', 'standard'],
    });
    expect(ok).toBe(true);
    expect(session.state.plan.active?.stops[0]?.lap).toBe(lap + 1);
    expect(session.state.decisions.some((d) => d.kind === 'pit' && d.lap === lap + 1)).toBe(true);
  });

  it('still refuses a stop on a lap already run', async () => {
    const session = await racing();
    const lap = session.state.race.lap;
    expect(
      session.changePlan({
        id: 'a',
        stops: [{ lap, compound: 'HARD' }],
        pace: ['standard', 'standard'],
      }),
    ).toBe(false);
  });
});

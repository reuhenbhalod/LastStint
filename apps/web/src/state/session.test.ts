import { type RaceState, battlesFor, engineerConfig, verifyRun } from '@boxthislap/sim';
import { describe, expect, it } from 'vitest';
import { StaticDailyProvider } from '../data/provider.js';
import { GameSession } from './session.js';

const daily = () => new StaticDailyProvider().today();

/** Off the daily card with the engineer's first plan (at Abu Dhabi: no stop, standard pace). */
function begin(session: GameSession, plan: 'a' | 'b' | 'c' = 'a'): void {
  session.start();
  session.pickPlan(plan);
}

function answer(session: GameSession): void {
  const moment = session.state.currentMoment;
  if (moment) session.choose(moment.realOptionId ?? (moment.options[0]?.id as string));
}

function autoplay(session: GameSession, maxSteps = 300): void {
  begin(session);
  for (let i = 0; i < maxSteps && session.state.phase !== 'finished'; i++) {
    if (session.state.phase === 'decision') answer(session);
    else if (session.state.phase === 'racing') session.tick();
    else break;
  }
}

describe('GameSession', () => {
  it('exposes the Abu Dhabi VSC moment with the real call marked', async () => {
    const session = new GameSession(await daily());
    const vsc = session.state.moments.find((m) => m.trigger === 'VSC');
    expect(vsc?.lap).toBe(36);
    expect(vsc?.realOptionId).toBe('stay');
  });

  it('plays from intro to results choosing the real options', async () => {
    const session = new GameSession(await daily());
    expect(session.state.phase).toBe('intro');
    autoplay(session);
    expect(session.state.phase).toBe('finished');
    session.beginSubmit();
    await session.allGraded();
    session.finish({ status: 'practice' });
    expect(session.state.phase).toBe('results');
    expect(session.state.result?.finishers).toContain('HAM');
    expect(Object.keys(session.state.grades)).toHaveLength(6);
  });

  it('submits a run the server accepts and scores exactly as full grading does', async () => {
    const today = await daily();
    const session = new GameSession(today);
    autoplay(session);
    const body = await session.submission('11111111-1111-4111-8111-111111111111');
    const wire = JSON.parse(JSON.stringify(body));
    const live = verifyRun(today.model, today.seed, wire.decisions, undefined, wire.grades);
    const full = verifyRun(today.model, today.seed, body.decisions);
    expect(live).toEqual(full);
    expect(session.localScore()).toEqual(full.score);
  });

  it('does not ask for a stop again right after one (and the server accepts it)', async () => {
    const today = await daily();
    const session = new GameSession(today);
    begin(session);
    const asked: string[] = [];
    for (let i = 0; i < 300 && session.state.phase !== 'finished'; i++) {
      const m = session.state.currentMoment;
      if (session.state.phase === 'decision' && m) {
        asked.push(m.id);
        session.choose(
          m.id === 'sc-stop' ? 'box-soft' : (m.realOptionId ?? (m.options[0]?.id as string)),
        );
      } else session.tick();
    }
    expect(asked).toContain('sc-stop');
    expect(asked).not.toContain('sc-last-chance');
    const radio = session.state.decisions.find(
      (d) => d.kind === 'radio' && d.momentId === 'sc-last-chance',
    );
    expect(radio).toMatchObject({ optionId: 'stay' });
    expect(session.state.radio.some((r) => r.text.includes('Staying out'))).toBe(true);
    const body = await session.submission('11111111-1111-4111-8111-111111111111');
    expect(() => verifyRun(today.model, today.seed, body.decisions)).not.toThrow();
  });

  it('boxes on the lap called, one stop at a time, never on the last lap', async () => {
    const today = await daily();
    const session = new GameSession(today);
    begin(session);
    if (session.state.phase === 'decision') answer(session);
    const lap = session.state.race.lap;
    // A BOX for the lap being shown: the stop is charged on the lap after it.
    session.call({ lap: lap + 1, kind: 'pit', compound: 'HARD' }, { asked: true });
    // A second stop while it's under way is ignored (BOX twice, a quick call's box...).
    session.call({ lap: lap + 2, kind: 'pit', compound: 'MEDIUM' }, { asked: true });
    expect(session.state.decisions.filter((d) => d.kind === 'pit')).toHaveLength(1);
    session.tick(); // the in-lap
    expect(session.state.race.cars.HAM?.strategy).toEqual([
      expect.objectContaining({ lap: lap + 2, to: 'HARD' }),
    ]);
    session.call({ lap: lap + 2, kind: 'pit', compound: 'MEDIUM' }, { asked: true });
    expect(session.state.decisions.filter((d) => d.kind === 'pit')).toHaveLength(1);
    session.tick(); // the out-lap: the stop is made
    expect(session.state.race.cars.HAM?.pittedThisLap).toBe(true);
    expect(session.state.race.cars.HAM?.compound).toBe('HARD');
    // The last lap: too late.
    const last = today.model.race.laps;
    session.call({ lap: last, kind: 'pit', compound: 'SOFT' }, { asked: true });
    expect(session.state.decisions.filter((d) => d.kind === 'pit')).toHaveLength(1);
  });

  it('does not ask about a stop already booked (Abu Dhabi: box on the radio, then the SC call)', async () => {
    const today = await daily();
    const session = new GameSession(today);
    begin(session);
    const asked: string[] = [];
    let booked = false;
    for (let i = 0; i < 300 && session.state.phase !== 'finished'; i++) {
      const m = session.state.currentMoment;
      if (session.state.phase === 'decision' && m) {
        asked.push(m.id);
        session.choose(m.realOptionId ?? (m.options[0]?.id as string));
        continue;
      }
      // Two laps before the late safety car's stop call, BOX from the team radio for the lap
      // after the one being shown (past pit entry): booked, not yet made, at the pause.
      if (!booked && session.state.race.lap === 51) {
        session.call({ lap: 53, kind: 'pit', compound: 'HARD' });
        booked = session.state.decisions.some((d) => d.kind === 'pit' && d.lap === 53);
      }
      session.tick();
    }
    expect(booked).toBe(true);
    // Neither SC stop call is asked: the wall stays out for you, and the booked stop happens.
    expect(asked).not.toContain('sc-stop');
    expect(asked).not.toContain('sc-last-chance');
    expect(session.state.radio.some((r) => r.text.includes('boxing already'))).toBe(true);
    const stops = session.state.decisions.filter((d) => d.kind === 'pit' && d.lap >= 52);
    expect(stops).toEqual([expect.objectContaining({ lap: 53, compound: 'HARD' })]);
    const body = await session.submission('11111111-1111-4111-8111-111111111111');
    expect(() => verifyRun(today.model, today.seed, body.decisions)).not.toThrow();
  });

  it('previews a battle lap exactly: the lap then runs to the same result', async () => {
    const today = await daily();
    const model = today.model;
    const cfg = engineerConfig(model) as NonNullable<ReturnType<typeof engineerConfig>>;
    let checked = 0;
    for (let seed = 1; seed < 60 && checked < 5; seed++) {
      const s = new GameSession({ ...today, seed });
      begin(s);
      for (let i = 0; i < 200 && s.state.phase !== 'finished'; i++) {
        if (s.state.phase === 'decision') {
          answer(s);
          continue;
        }
        const b = battlesFor(s.state.race, model, cfg);
        if (b.ahead || b.behind) {
          const lap = s.state.race.lap + 1;
          s.call({ lap, kind: 'battle', move: b.ahead ? 'dive-inside' : 'cover-inside' });
          const preview = s.previewLap();
          s.tick();
          expect(preview?.race.order).toEqual(s.state.race.order);
          const times = (r: RaceState) => r.order.map((c) => r.cars[c]?.totalTime);
          expect(times(preview?.race as RaceState)).toEqual(times(s.state.race));
          expect(preview?.notes).toEqual(s.notes.filter((n) => n.lap === lap));
          checked++;
          break;
        }
        s.tick();
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('reports incidents on the radio, and plays on to the flag if your car is out', async () => {
    const today = await daily();
    // A seed where HAM's race ends early (a crash or a failure), found by playing it.
    const out = (seed: number) => {
      const s = new GameSession({ ...today, seed });
      autoplay(s);
      return s;
    };
    let session: GameSession | null = null;
    for (let seed = 1; seed < 400 && !session; seed++) {
      const s = out(seed);
      if (s.state.race.cars.HAM?.retired) session = s;
    }
    if (!session) throw new Error('HAM never retired in 400 seeds');
    expect(session.state.phase).toBe('finished');
    expect(session.state.resolved).toHaveLength(session.state.moments.length);
    expect(session.state.radio.some((r) => r.from === 'HAM')).toBe(true);
    const body = await session.submission('11111111-1111-4111-8111-111111111111');
    const { seed } = (session as unknown as { daily: { seed: number } }).daily;
    expect(() => verifyRun(today.model, seed, body.decisions)).not.toThrow();
  });

  it('pauses at a moment and never re-pauses on it after a choice', async () => {
    const session = new GameSession(await daily());
    begin(session);
    for (let i = 0; i < 100 && session.state.phase === 'racing'; i++) session.tick();
    expect(session.state.phase).toBe('decision');
    const moment = session.state.currentMoment;
    expect(moment?.lap).toBe(session.state.race.lap + 1);
    answer(session);
    expect(session.state.resolved).toContain(moment?.id);
    expect(session.state.phase).not.toBe('decision');
    if (session.state.phase === 'racing') session.tick();
    expect(session.state.currentMoment?.id).not.toBe(moment?.id);
  });

  it('resumes to the same lap, decisions and order after a refresh', async () => {
    const session = new GameSession(await daily());
    begin(session);
    for (let i = 0; i < 100 && session.state.phase === 'racing'; i++) session.tick();
    answer(session); // resolve the first moment
    for (let i = 0; i < 3 && session.state.phase === 'racing'; i++) session.tick();

    const saved = session.persist();
    const resumed = GameSession.restore(await daily(), saved);
    expect(resumed).not.toBeNull();
    expect(resumed?.state.phase).toBe(session.state.phase);
    expect(resumed?.state.race.lap).toBe(session.state.race.lap);
    expect(resumed?.state.decisions).toEqual(session.state.decisions);
    expect(resumed?.state.resolved).toEqual(session.state.resolved);
    expect(resumed?.state.race.order).toEqual(session.state.race.order);
    // Grades survive the refresh, or are rebuilt from a replay to the pause.
    await resumed?.allGraded();
    await session.allGraded();
    expect(resumed?.state.grades).toEqual(session.state.grades);
  });

  it('re-grades a moment missing from the save, identically', async () => {
    const session = new GameSession(await daily());
    begin(session);
    for (let i = 0; i < 100 && session.state.phase === 'racing'; i++) session.tick();
    answer(session);
    await session.allGraded();
    const saved = { ...session.persist(), grades: {} };
    const resumed = GameSession.restore(await daily(), saved);
    await resumed?.allGraded();
    expect(resumed?.state.grades).toEqual(session.state.grades);
  });

  it('rejects a save from a different race', async () => {
    const session = new GameSession(await daily());
    const saved = { ...session.persist(), raceId: 'spain-2021' };
    expect(GameSession.restore(await daily(), saved)).toBeNull();
  });

  it('drops refused live calls from the log and keeps accepted ones', async () => {
    const session = new GameSession(await daily());
    begin(session);
    let refused = 0;
    let accepted = 0;
    for (let i = 0; i < 300 && session.state.phase !== 'finished'; i++) {
      if (session.state.phase === 'decision') answer(session);
      else {
        const lap = session.state.race.lap + 1;
        const before = session.state.decisions.length;
        const booked = session.state.decisions.some(
          (d) => d.lap === lap && d.kind === 'mode' && d.key === 'pace',
        );
        session.call({ lap, kind: 'mode', key: 'pace', value: lap % 2 ? 'push' : 'manage' });
        const said = session.state.radio.at(-1);
        if (booked) {
          // A moment's answer already set the pace for this lap: the call is ignored.
          expect(session.state.decisions).toHaveLength(before);
        } else if (said?.lap !== lap) {
          throw new Error(`no radio reply on lap ${lap}`);
        } else if (said.refused) {
          refused++;
          expect(session.state.decisions).toHaveLength(before);
        } else {
          accepted++;
          expect(session.state.decisions).toHaveLength(before + 1);
          // A second pace call for the same lap is already booked: ignored.
          session.call({ lap, kind: 'mode', key: 'pace', value: 'standard' });
          expect(session.state.decisions).toHaveLength(before + 1);
        }
        session.tick();
      }
    }
    expect(refused).toBeGreaterThan(0);
    expect(accepted).toBeGreaterThan(refused);
  });
});

describe('the race plan (strategy planner spec)', () => {
  const ID = '11111111-1111-4111-8111-111111111111';
  const own = (lap: number) => ({
    id: 'own' as const,
    stops: [{ lap, compound: 'SOFT' }],
    pace: ['standard' as const, 'push' as const],
  });

  /** Race on from wherever the session is, answering moments with the real call. */
  function playOn(session: GameSession, until = Number.POSITIVE_INFINITY): void {
    for (let i = 0; i < 300 && session.state.phase !== 'finished'; i++) {
      if (session.state.race.lap >= until) return;
      if (session.state.phase === 'decision') answer(session);
      else session.tick();
    }
  }

  it('waits for a plan, logs it, and makes its calls on their laps', async () => {
    const today = await daily();
    const session = new GameSession(today);
    session.start();
    expect(session.state.phase).toBe('planning');
    expect(session.state.plan.offered.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    session.tick();
    expect(session.state.race.lap).toBe(today.model.race.takeoverLap);
    const b = session.state.plan.offered[1];
    session.pickPlan('b');
    expect(session.state.phase).not.toBe('planning');
    expect(session.state.decisions[0]).toMatchObject({ kind: 'plan', id: 'b' });
    playOn(session);
    const stops = session.state.decisions.filter((d) => d.kind === 'pit');
    expect(stops.map((d) => d.lap)).toEqual(b?.stops.map((s) => s.lap));
    const body = await session.submission(ID);
    const wire = JSON.parse(JSON.stringify(body));
    const live = verifyRun(today.model, today.seed, wire.decisions, undefined, wire.grades);
    const full = verifyRun(today.model, today.seed, body.decisions);
    expect(live).toEqual(full);
    expect(full.plan?.chosen).toBe('b');
    expect(session.localScore()).toEqual(full.score);
  });

  it('grades the player’s own plan beside the engineer’s, and the server agrees', async () => {
    const today = await daily();
    const session = new GameSession(today);
    session.start();
    expect(session.buildPlan(own(45))).toBe(true);
    expect(session.buildPlan({ ...own(45), pace: ['standard'] })).toBe(false);
    await session.allGraded();
    expect(session.state.plan.chances.own).toBeDefined();
    session.pickPlan('own');
    playOn(session);
    expect(session.state.decisions.some((d) => d.kind === 'pit' && d.lap === 45)).toBe(true);
    const body = await session.submission(ID);
    const live = verifyRun(today.model, today.seed, body.decisions, undefined, body.grades);
    expect(live).toEqual(verifyRun(today.model, today.seed, body.decisions));
    expect(live.plan?.grade.options.map((o) => o.id)).toEqual(['a', 'b', 'c', 'own']);
  });

  it('a stop off the plan takes out the planned stop it replaced', async () => {
    const session = new GameSession(await daily());
    session.start();
    session.buildPlan(own(45));
    session.pickPlan('own');
    playOn(session, 41);
    while (session.state.phase === 'decision') answer(session);
    // Answered (the driver follows it): a refusal isn't what this checks.
    session.call({ lap: 43, kind: 'pit', compound: 'HARD' }, { asked: true });
    expect(session.state.decisions.some((d) => d.kind === 'pit' && d.lap === 43)).toBe(true);
    playOn(session);
    expect(session.state.plan.active?.stops).toEqual([]);
    const stops = session.state.decisions.filter((d) => d.kind === 'pit').map((d) => d.lap);
    expect(stops).toEqual([43]);
  });

  it('stays out one more lap when asked', async () => {
    const session = new GameSession(await daily());
    session.start();
    session.buildPlan(own(45));
    session.pickPlan('own');
    playOn(session, 43);
    expect(session.delayPlannedStop(45)).toBe(true);
    playOn(session);
    const stops = session.state.decisions.filter((d) => d.kind === 'pit').map((d) => d.lap);
    expect(stops).toEqual([46]);
  });

  it('keeps the plan through a refresh', async () => {
    const today = await daily();
    const session = new GameSession(today);
    session.start();
    session.buildPlan(own(45));
    await session.allGraded();
    session.pickPlan('own');
    playOn(session, 40);
    const resumed = GameSession.restore(today, JSON.parse(JSON.stringify(session.persist())));
    expect(resumed?.state.plan.active).toEqual(session.state.plan.active);
    if (!resumed) throw new Error('no resume');
    playOn(resumed);
    const stops = resumed.state.decisions.filter((d) => d.kind === 'pit').map((d) => d.lap);
    expect(stops).toEqual([45]);
    const body = await resumed.submission(ID);
    expect(() =>
      verifyRun(today.model, today.seed, body.decisions, undefined, body.grades),
    ).not.toThrow();
  });
});

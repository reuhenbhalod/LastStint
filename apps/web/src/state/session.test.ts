import { verifyRun } from '@boxthislap/sim';
import { describe, expect, it } from 'vitest';
import { StaticDailyProvider } from '../data/provider.js';
import { GameSession } from './session.js';

const daily = () => new StaticDailyProvider().today();

function answer(session: GameSession): void {
  const moment = session.state.currentMoment;
  if (moment) session.choose(moment.realOptionId ?? (moment.options[0]?.id as string));
}

function autoplay(session: GameSession, maxSteps = 300): void {
  session.start();
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
    expect(Object.keys(session.state.grades)).toHaveLength(4);
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

  it('pauses at a moment and never re-pauses on it after a choice', async () => {
    const session = new GameSession(await daily());
    session.start();
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
    session.start();
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
    session.start();
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
    session.start();
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

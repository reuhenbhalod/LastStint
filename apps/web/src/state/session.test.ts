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
    expect(vsc?.realOptionId).toBe('stay-out');
  });

  it('plays from intro to results choosing the real options', async () => {
    const session = new GameSession(await daily());
    expect(session.state.phase).toBe('intro');
    autoplay(session);
    expect(session.state.phase).toBe('finished');
    session.submit();
    expect(session.state.phase).toBe('results');
    expect(session.state.result?.finishers).toContain('HAM');
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
  });

  it('rejects a save from a different race', async () => {
    const session = new GameSession(await daily());
    const saved = { ...session.persist(), raceId: 'spain-2021' };
    expect(GameSession.restore(await daily(), saved)).toBeNull();
  });
});

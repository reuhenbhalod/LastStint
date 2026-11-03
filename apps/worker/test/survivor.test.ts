// Survivor mode (src/survivor.ts): a run deals races from the survivor pool, verifies each
// finished race from its call log, carries on after a win and ends at the first loss, and
// ranks runs by rounds survived.

import { SELF } from 'cloudflare:test';
import { type Decision, type RaceModel, decide } from '@boxthislap/sim';
import { describe, expect, it } from 'vitest';
import canadaJson from '../../../data/races/canada-2022.json';
import spainJson from '../../../data/races/spain-2020.json';
import { playDailyRace } from '../../../packages/sim/examples/daily-race.js';
import { ids } from './helpers.js';

const races: Record<string, RaceModel> = {
  'spain-2020': spainJson as unknown as RaceModel,
  'canada-2022': canadaJson as unknown as RaceModel,
};

/** The real team's race: its call at every moment, and BOX on its real stop laps. */
function realWay(model: RaceModel, seed: number) {
  const me = model.drivers.find((d) => d.code === model.userSide);
  return playDailyRace(model, seed, (m) => m.realOptionId ?? (m.options[0]?.id as string), {
    samples: 20,
    between: (run) => {
      const stop = me?.realStrategy.find((s) => s.lap - 1 === run.state.lap + 1);
      const booked = run.decisions.some((d) => d.kind === 'pit' && d.lap > run.state.lap);
      if (stop && !booked && stop.lap - 1 < model.race.laps) {
        decide(run, { lap: run.state.lap + 1, kind: 'pit', compound: stop.to });
      }
    },
  });
}

let ip = 0;
function api(path: string, body?: unknown) {
  ip++;
  return SELF.fetch(`https://api.test${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': `10.9.0.${ip % 250}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

interface State {
  runId: string;
  status: string;
  rounds: number;
  current: { round: number; raceId: string; seed: number } | null;
  history: Array<{ round: number; raceId: string; won: boolean }>;
  rank?: number;
}

async function playRound(anonId: string, state: State) {
  const cur = state.current as NonNullable<State['current']>;
  const played = realWay(races[cur.raceId] as RaceModel, cur.seed);
  const res = await api(`/api/survivor/${state.runId}/round`, {
    anonId,
    round: cur.round,
    decisions: played.decisions,
    grades: played.grades,
  });
  return { res, played };
}

describe('survivor', () => {
  it('runs until the first loss: wins carry on, a loss ends it and ranks it', async () => {
    const start = await api('/api/survivor/start', { anonId: ids.a });
    expect(start.status).toBe(201);
    let state = (await start.json()) as State;
    expect(state).toMatchObject({ status: 'live', rounds: 0, current: { round: 1 } });
    expect(Object.keys(races)).toContain(state.current?.raceId);

    let wins = 0;
    for (let i = 0; i < 6 && state.status === 'live'; i++) {
      const { res } = await playRound(ids.a, state);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { won: boolean; state: State };
      const raceId = state.current?.raceId;
      // The real calls win Spain 2020 and lose Canada 2022.
      expect(body.won).toBe(raceId === 'spain-2020');
      if (body.won) wins++;
      state = body.state;
    }
    expect(state.status).toBe('over');
    expect(state.rounds).toBe(wins);
    expect(state.current).toBeNull();
    expect(state.history.at(-1)?.won).toBe(false);
    expect(state.rank).toBeGreaterThanOrEqual(1);

    // The run is over: no more rounds, and the state reads back the same.
    const again = await api(`/api/survivor/${state.runId}/round`, {
      anonId: ids.a,
      round: state.history.length,
      decisions: [],
      grades: [],
    });
    expect(again.status).toBe(409);
    const read = (await (
      await api(`/api/survivor/${state.runId}?anonId=${ids.a}`)
    ).json()) as State;
    expect(read).toMatchObject({ status: 'over', rounds: wins });

    const board = (await (await api('/api/survivor/leaderboard')).json()) as {
      allTime: Array<{ rounds: number }>;
      week: unknown[];
    };
    // Only runs that survived a round are listed.
    if (wins > 0) {
      expect(board.allTime[0]?.rounds).toBeGreaterThanOrEqual(wins);
      expect(board.week.length).toBeGreaterThan(0);
    }
    expect(board.allTime.every((r) => r.rounds > 0)).toBe(true);
  });

  it('refuses another player, the wrong round, a tampered log, and a second submit', async () => {
    const state = (await (await api('/api/survivor/start', { anonId: ids.b })).json()) as State;
    const cur = state.current as NonNullable<State['current']>;
    const played = realWay(races[cur.raceId] as RaceModel, cur.seed);
    const body = { anonId: ids.b, round: 1, decisions: played.decisions, grades: played.grades };
    const url = `/api/survivor/${state.runId}/round`;

    expect((await api(url, { ...body, anonId: ids.c })).status).toBe(404);
    expect((await api(url, { ...body, round: 2 })).status).toBe(409);
    const tampered = [...played.decisions, { lap: 999, at: 998, kind: 'pit', compound: 'SOFT' }];
    expect((await api(url, { ...body, decisions: tampered as Decision[] })).status).toBe(400);
    expect((await api(url, body)).status).toBe(200);
    expect((await api(url, body)).status).toBe(409);
  });

  it('needs a valid anonId', async () => {
    expect((await api('/api/survivor/start', { anonId: 'nope' })).status).toBe(400);
    expect((await api('/api/survivor/whatever?anonId=nope')).status).toBe(400);
  });
});

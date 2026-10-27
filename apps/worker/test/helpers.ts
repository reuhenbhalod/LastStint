import { SELF, env } from 'cloudflare:test';
import type { Decision, RaceModel } from '@boxthislap/sim';
import abuJson from '../../../data/races/abu-dhabi-2021.json';
import { playDailyRace } from '../../../packages/sim/examples/daily-race.js';
import { todayUtc } from '../src/dates.js';
import { modelHash } from '../src/races.js';

export const abu = abuJson as unknown as RaceModel;
export const SEED = 4242;
export const today = () => todayUtc(Date.now());

/** Put a daily in D1 the way the schedule script does. */
export async function schedule(
  date: string,
  options: { raceId?: string; seed?: number; number?: number; hash?: string } = {},
): Promise<void> {
  const raceId = options.raceId ?? 'abu-dhabi-2021';
  await env.DB.prepare(
    `INSERT INTO daily (date, race_id, seed, side, published_at, number, model_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      date,
      raceId,
      options.seed ?? SEED,
      abu.userSide,
      new Date().toISOString(),
      options.number ?? 1,
      options.hash ?? (await modelHash(abu)),
    )
    .run();
}

/** Play today's Abu Dhabi daily as the game does, choosing `optionId` at the moment. */
export function play(optionId: string) {
  return playDailyRace(abu, SEED, () => optionId);
}

let ip = 0;

export function post(body: unknown, headers: Record<string, string> = {}) {
  ip++;
  return SELF.fetch('https://api.test/api/runs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'cf-connecting-ip': `10.0.${Math.floor(ip / 250)}.${ip % 250}`,
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

export function get(path: string) {
  return SELF.fetch(`https://api.test${path}`);
}

export function submit(anonId: string, decisions: Decision[], date = today()) {
  return post({ date, anonId, decisions });
}

export const ids = {
  a: '11111111-1111-4111-8111-111111111111',
  b: '22222222-2222-4222-8222-222222222222',
  c: '33333333-3333-4333-8333-333333333333',
};

// Daily providers. ApiDailyProvider serves today's daily from the Worker (GET /api/daily, then
// the pinned model URL). StaticDailyProvider is the bundled Abu Dhabi 2021 model, imported
// from the repo's shared data/ dir (via the @data alias): practice mode when there's no daily
// or no connection.

import abuDhabi2021 from '@data/races/abu-dhabi-2021.json';
import type { RaceModel } from '@laststint/sim';
import { ApiError, type DailyResponse, api } from './api.js';
import { localDate } from './player.js';
import type { Daily, DailyProvider } from './types.js';

const FIXTURE = abuDhabi2021 as unknown as RaceModel;

export class StaticDailyProvider implements DailyProvider {
  constructor(
    private readonly model: RaceModel = FIXTURE,
    private readonly reason?: string,
  ) {}

  async today(): Promise<Daily> {
    return {
      date: localDate(),
      raceId: this.model.race.id,
      seed: this.model.race.seed,
      model: this.model,
      source: 'practice',
      practiceReason: this.reason,
    };
  }
}

/**
 * Why today's daily couldn't be loaded, in words a player can act on. Shown on the daily card
 * and in the race header when the game falls back to a practice run.
 */
export function practiceReason(e: unknown): string {
  if (e instanceof ApiError) {
    switch (e.code) {
      case 'no-daily':
        return 'No daily race is scheduled for today.';
      case 'model-changed':
        return 'Today’s race is being updated on the server.';
      case 'rate-limited':
        return 'The server is busy right now (too many requests).';
      case 'no-race':
        return 'The server doesn’t have today’s race file.';
      default:
        return e.status >= 500
          ? `The server hit an error loading today’s race (${e.status} ${e.code}).`
          : `The server refused today’s race (${e.status} ${e.code}).`;
    }
  }
  if (e instanceof ModelError) return `Today’s race file didn’t download (${e.message}).`;
  // fetch() itself failed: offline, DNS, or the request was blocked.
  if (e instanceof TypeError) return 'Can’t reach the server. Check your connection.';
  return `Couldn’t load today’s race (${(e as Error)?.message ?? String(e)}).`;
}

/** The race file download failed (its HTTP status). */
export class ModelError extends Error {}

export class ApiDailyProvider implements DailyProvider {
  constructor(
    private readonly fetchDaily: (date: string) => Promise<DailyResponse> = api.daily,
    private readonly fetchModel: (url: string) => Promise<RaceModel> = (url) =>
      fetch(url).then((r) => {
        if (!r.ok) throw new ModelError(`HTTP ${r.status}`);
        return r.json() as Promise<RaceModel>;
      }),
    private readonly date: () => string = () => localDate(),
  ) {}

  /** Today's daily, or practice mode on the bundled race if there is none or no connection. */
  async today(): Promise<Daily> {
    let daily: DailyResponse;
    let model: RaceModel;
    try {
      daily = await this.fetchDaily(this.date());
      model = await this.fetchModel(daily.modelUrl);
    } catch (e) {
      return new StaticDailyProvider(FIXTURE, practiceReason(e)).today();
    }
    return {
      date: daily.date,
      raceId: daily.raceId,
      seed: daily.seed,
      model,
      number: daily.number,
      source: 'live',
    };
  }
}

/** Every race file, loaded on demand (practice on any playable race, `?race=` on localhost). */
const RACE_FILES = import.meta.glob<{ default: RaceModel }>('../../../../data/races/*.json');

/** A race of a survivor run: the race the server dealt, on its seed (`number`: the round). */
export class SurvivorProvider implements DailyProvider {
  constructor(
    private readonly runId: string,
    private readonly round: number,
    private readonly raceId: string,
    private readonly seed: number,
  ) {}

  async today(): Promise<Daily> {
    const load = RACE_FILES[`../../../../data/races/${this.raceId}.json`];
    if (!load) throw new Error(`no race file ${this.raceId}`);
    const model = (await load()).default;
    return {
      // Unique per round: the save slot only restores this round's race.
      date: `${this.runId}#${this.round}`,
      raceId: this.raceId,
      seed: this.seed,
      model,
      number: this.round,
      source: 'survivor',
    };
  }
}

/** Practice on a chosen race file (`?race=canada-2022&seed=…`: localhost, or an admin). */
export class RaceFileProvider implements DailyProvider {
  constructor(
    private readonly raceId: string,
    private readonly seed?: number,
  ) {}

  async today(): Promise<Daily> {
    const load = RACE_FILES[`../../../../data/races/${this.raceId}.json`];
    if (!load) throw new Error(`no race file ${this.raceId}`);
    const model = (await load()).default;
    const daily = await new StaticDailyProvider(
      model,
      `Practice on ${model.race.name ?? this.raceId}`,
    ).today();
    return this.seed !== undefined && Number.isInteger(this.seed)
      ? { ...daily, seed: this.seed }
      : daily;
  }
}

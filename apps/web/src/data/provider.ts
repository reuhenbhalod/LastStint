// Daily providers. ApiDailyProvider serves today's daily from the Worker (GET /api/daily, then
// the pinned model URL). StaticDailyProvider is the bundled Abu Dhabi 2021 model, imported
// from the repo's shared data/ dir (via the @data alias): practice mode when there's no daily
// or no connection.

import type { RaceModel } from '@boxthislap/sim';
import abuDhabi2021 from '@data/races/abu-dhabi-2021.json';
import { type DailyResponse, api } from './api.js';
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

export class ApiDailyProvider implements DailyProvider {
  constructor(
    private readonly fetchDaily: (date: string) => Promise<DailyResponse> = api.daily,
    private readonly fetchModel: (url: string) => Promise<RaceModel> = (url) =>
      fetch(url).then((r) => {
        if (!r.ok) throw new Error(`model ${r.status}`);
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
      const none = (e as { code?: string }).code === 'no-daily';
      return new StaticDailyProvider(
        FIXTURE,
        none ? 'No daily race is scheduled today.' : 'Can’t reach the server.',
      ).today();
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

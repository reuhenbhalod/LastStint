// StaticDailyProvider: the bundled dev fixture (Abu Dhabi 2021). The race model is imported
// from the repo's shared data/ dir (via the @data alias) so it stays the single source of
// truth. Phase 4 adds an ApiDailyProvider backed by GET /api/daily behind the same interface.

import type { RaceModel } from '@boxthislap/sim';
import abuDhabi2021 from '@data/races/abu-dhabi-2021.json';
import type { Daily, DailyProvider } from './types.js';

const FIXTURE = abuDhabi2021 as unknown as RaceModel;

export class StaticDailyProvider implements DailyProvider {
  constructor(private readonly model: RaceModel = FIXTURE) {}

  async today(): Promise<Daily> {
    return {
      date: '2021-12-12',
      raceId: this.model.race.id,
      seed: this.model.race.seed,
      model: this.model,
    };
  }
}

// The data the game needs to run one Daily Race. The decision moments are the race model's
// approved moments (`model.decisionMoments`), the same ones the server grades.

import type { RaceModel } from '@boxthislap/sim';

export interface Daily {
  /** The date this race is served for: the player's local date for a live daily. */
  date: string;
  raceId: string;
  /** Daily seed: fixes the race for everyone and lets the Worker replay the run. */
  seed: number;
  model: RaceModel;
  /** Puzzle number for the share line ("Pit Wall #12"); absent in practice mode. */
  number?: number;
  /**
   * `live`: today's daily from the Worker, submitted and ranked. `practice`: the bundled race,
   * played locally when there's no daily (or no connection); not submitted. `survivor`: a race
   * of a survivor run (`number` is its round), submitted by the survivor screen.
   */
  source: 'live' | 'practice' | 'survivor';
  /** Why the game fell back to practice, for the banner. */
  practiceReason?: string;
}

/** Source of today's race. */
export interface DailyProvider {
  today(): Promise<Daily>;
}

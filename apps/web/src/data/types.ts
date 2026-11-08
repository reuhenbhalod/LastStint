// The data the game needs to run one Daily Race. The decision moments are the race model's
// approved moments (`model.decisionMoments`), the same ones the server grades.

import type { RaceModel, RivalPolicy } from '@laststint/sim';

/** Where a race comes from, which decides how its run is submitted (state/machine.ts). */
export type RaceSource = 'live' | 'practice' | 'survivor' | 'eras';

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
   * of a survivor run (`number` is its round), submitted by the survivor screen. `eras`: an
   * Eras attempt (eras/EraProvider.ts), graded on this device and submitted as an attempt
   * (build plan 8.7), never as a daily run.
   */
  source: RaceSource;
  /** Why the game fell back to practice, for the banner. */
  practiceReason?: string;
  /**
   * How the live run is played, as the server replays it (Eras attempts: the era's rival
   * policy and Legend, eras spec §7, §8). Absent: today's rival, the real race's events.
   */
  run?: LiveRules;
}

/** The rules a live run is played to (sim RunOptions `rivalPolicy`, `legend`). */
export interface LiveRules {
  rivalPolicy?: RivalPolicy;
  legend?: boolean;
}

/** Source of today's race. */
export interface DailyProvider {
  today(): Promise<Daily>;
}

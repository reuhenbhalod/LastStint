// What an Eras race passes the race screen (build plan 8.6): its difficulty and its attempt.
// Without it the race screen is exactly the Daily / Gauntlet / Survivor / practice one: no
// timer, everything shown.

import type { DifficultySettings } from '@laststint/sim';

export interface ErasRace {
  /** The era's row of the difficulty table (`difficultyForEra`) or Legend's settings. */
  difficulty: DifficultySettings;
  /** The attempt (POST /api/eras/attempts `attemptId`): the untimed mark is kept per attempt. */
  attemptId: string;
  /** The attempt was just marked untimed (a decision shown with the timer off). Once. */
  onUntimed?: () => void;
}

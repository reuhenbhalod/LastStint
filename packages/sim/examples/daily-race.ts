// A Daily Race end to end, as the game runs it (docs/sim-api.md walks through this file).
// It is a test too (tests/example.test.ts), so CI keeps it working.

import {
  type DecisionMoment,
  type MomentGrade,
  type RaceModel,
  type RaceResult,
  type Run,
  type RunScore,
  classify,
  decide,
  gradeMoment,
  initRun,
  isFinished,
  ruleSatisfied,
  scoreRun,
  stepLap,
} from '../src/index.js';

export interface PlayedCall {
  moment: DecisionMoment;
  grade: MomentGrade;
  chosen: string;
}

export interface DailyRaceResult {
  result: RaceResult;
  score: RunScore;
  calls: PlayedCall[];
}

/**
 * Play a daily race: tick laps, pause at each decision moment, grade its options, apply the
 * player's choice, then classify and score at the flag.
 *
 * `choose` stands in for the player (the UI's decision prompt). `onLap` is where the UI
 * redraws the timing tower and reads run.notes (rival covers, team swaps) to narrate.
 */
export function playDailyRace(
  model: RaceModel,
  seed: number,
  choose: (moment: DecisionMoment, run: Run) => string,
  options: {
    samples?: number;
    onLap?: (run: Run) => void;
    onRuleWarning?: (run: Run) => void;
  } = {},
): DailyRaceResult {
  // `decisions: []` makes the user's car player-controlled and the rival reactive.
  const run = initRun(model, seed, { decisions: [] });
  const moments = [...model.decisionMoments].sort((a, b) => a.lap - b.lap);
  const calls: PlayedCall[] = [];

  while (!isFinished(run)) {
    const moment = moments.find((m) => m.lap === run.state.lap + 1);
    if (moment) {
      // Pause. In the browser this grade runs in Web Workers (gradeJob / runGradeJob /
      // mergeGradeJobs) while the player reads the options.
      const grade = gradeMoment(run, moment.options, moment.target, options.samples);
      const chosen = choose(moment, run);
      const option = moment.options.find((o) => o.id === chosen);
      if (!option) throw new Error(`unknown option ${chosen}`);
      for (const call of option.decisions) decide(run, call);
      calls.push({ moment, grade, chosen });
    }
    // Between moments the BOX button and headset modes call decide() for a future lap.
    stepLap(run);
    options.onLap?.(run);
    // Two-compound rule: warn the player in the last laps if their car still needs a stop
    // (classify() disqualifies a car that reaches the flag without one).
    const user = run.state.cars[model.userSide];
    if (user && !ruleSatisfied(user) && model.race.laps - run.state.lap <= 5) {
      options.onRuleWarning?.(run);
    }
  }

  return {
    result: classify(run),
    score: scoreRun(calls.map(({ grade, chosen }) => ({ grade, chosen }))),
    calls,
  };
}

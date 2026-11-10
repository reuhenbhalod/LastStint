// A Daily Race end to end, as the game runs it (docs/sim-api.md walks through this file).
// It is a test too (tests/example.test.ts), so CI keeps it working.

import {
  type ClaimedGrade,
  type Decision,
  type DecisionMoment,
  type MomentGrade,
  type RaceModel,
  type RaceResult,
  type Run,
  type RunScore,
  answerMoment,
  autoStay,
  claimGrade,
  classify,
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
  /** The game answered it ("stay out") without asking: not scored. */
  auto: boolean;
}

export interface DailyRaceResult {
  result: RaceResult;
  score: RunScore;
  calls: PlayedCall[];
  /** The full call log (run.decisions), as sent to POST /api/runs. */
  decisions: Decision[];
  /** The game's grade for each moment, sent with the calls (POST /api/runs `grades`). */
  grades: ClaimedGrade[];
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
    /** Calls between moments (the BOX button, headset), made after each lap is drawn. */
    between?: (run: Run) => void;
    onLap?: (run: Run) => void;
    onRuleWarning?: (run: Run) => void;
  } = {},
): DailyRaceResult {
  // `decisions: []` makes the user's car player-controlled and the rival reactive.
  const run = initRun(model, seed, { decisions: [] });
  const moments = [...model.decisionMoments].sort((a, b) => a.lap - b.lap);
  const calls: PlayedCall[] = [];
  const grades: ClaimedGrade[] = [];

  while (!isFinished(run)) {
    const moment = moments.find((m) => m.lap === run.state.lap + 1);
    if (moment) {
      // Pause. In the browser this grade runs in Web Workers (gradeJob / runGradeJob /
      // mergeGradeJobs) while the player reads the options.
      const grade = gradeMoment(run, moment.options, moment.target, options.samples);
      // What the server scores from (it re-grades every run overnight); before the answer.
      grades.push(claimGrade(run, moment, grade, options.samples));
      // A stop just made or booked, or fresh tyres for a tyre call: the game answers "stay out"
      // itself (autoStay) and that answer isn't scored.
      const auto = autoStay(model, moment, run.decisions);
      const chosen = auto ?? choose(moment, run);
      // Logs the radio answer and the option's calls: the server checks both (verifyRun).
      answerMoment(run, moment, chosen);
      calls.push({ moment, grade, chosen, auto: auto !== null });
    }
    // Between moments the BOX button and headset modes call decide() for a future lap.
    stepLap(run);
    // A moment pauses the game as soon as the lap before it is drawn: it is graded before any
    // other call, so the server can rebuild that grade (calls made at the pause come after).
    const pausing = moments.some((m) => m.lap === run.state.lap + 1);
    if (!isFinished(run) && !pausing) options.between?.(run);
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
    score: scoreRun(calls.map(({ grade, chosen, auto }) => ({ grade, chosen, auto }))),
    calls,
    decisions: run.decisions,
    grades,
  };
}

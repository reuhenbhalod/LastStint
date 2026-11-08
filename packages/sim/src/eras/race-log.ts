// The player's car, lap by lap (eras build plan 1.4). A finished Run keeps only the end
// state: which compounds the car ran, when it stopped and which modes it ran on each lap are
// gone by the flag, and Eras objectives (stop_count, compound_rule, mode_rule,
// no_neutralized_stop) need them. This records them from outside the sim: call recordLap
// after every stepLap, or rebuild the log of a finished run with raceLog (a deterministic
// replay). Nothing in sim.ts changes.

import { rivalChoices } from '../rivals/react.js';
import { type Run, classify, initRun, isFinished, stepLap } from '../sim.js';
import type { Compound, FlagState, Modes } from '../types.js';

/** One lap of the player's car, as it was run. */
export interface ErasLap {
  lap: number;
  /** The flag the lap ran under. */
  flag: FlagState;
  /** The car ran this lap (false once it has retired). */
  running: boolean;
  /** The car stopped on this lap (its out-lap: the stop is charged here). */
  pitted: boolean;
  /** The tyres run on this lap. */
  compound: Compound;
  /** The standing modes on this lap. */
  modes: Modes;
}

/** Every lap from the takeover to the flag, in order. */
export interface ErasRaceLog {
  /** The player's car (the model's userSide). */
  driver: string;
  takeoverLap: number;
  laps: ErasLap[];
}

export function emptyLog(run: Run): ErasRaceLog {
  return { driver: run.model.userSide, takeoverLap: run.model.race.takeoverLap, laps: [] };
}

/**
 * Record the lap just run. Call once after each stepLap, from the takeover on; throws if a
 * lap was skipped or recorded twice, so a gap can't pass as a quiet lap.
 */
export function recordLap(log: ErasRaceLog, run: Run): void {
  const lap = run.state.lap;
  const expected = log.takeoverLap + log.laps.length + 1;
  if (lap !== expected) {
    throw new Error(`race log: recorded lap ${lap}, expected lap ${expected}`);
  }
  const car = run.state.cars[log.driver];
  if (!car) throw new Error(`race log: ${log.driver} is not in the race`);
  // A car retiring on this lap still ran it; pittedThisLap is stale on a car already out.
  const running = !car.retired || car.retiredLap === lap;
  log.laps.push({
    lap,
    flag: run.state.flag,
    running,
    pitted: running && car.pittedThisLap,
    compound: car.compound,
    modes: { ...car.modes },
  });
}

/**
 * The log of a finished run, rebuilt by replaying it from its model, seed, calls, rival
 * policy and Legend (replays are deterministic). An Expert rival replays the choices it made
 * (rivals/react.ts rivalChoices) rather than grading its decision points again. Throws if the
 * replay doesn't reproduce the run, e.g. a run built with scripted strategy overrides, which a
 * Run doesn't keep.
 */
export function raceLog(run: Run): ErasRaceLog {
  if (!isFinished(run)) throw new Error('race log: the run has not reached the flag');
  // incidents: false turns off both the incidents and the race engineer (initRun), so a run
  // that has either was built with the default.
  const replay = initRun(run.model, run.seed, {
    ...(run.live ? { decisions: run.decisions } : {}),
    rivalPolicy: run.rivalPolicy,
    legend: run.legend,
    ...(run.rival ? { rivalChoices: rivalChoices(run), rivalGrading: 'claims' as const } : {}),
    incidents: run.incidents || run.state.engineer !== undefined,
  });
  const log = emptyLog(replay);
  while (!isFinished(replay)) {
    stepLap(replay);
    recordLap(log, replay);
  }
  const want = classify(run);
  const got = classify(replay);
  if (JSON.stringify(want) !== JSON.stringify(got)) {
    throw new Error('race log: replaying the run did not reproduce its result');
  }
  return log;
}

// The real team's calls replay the real race in live play: a player who makes exactly the
// real calls gets the real stops (their measured times) and the rival doesn't "react" to
// them, because its real answer is already its real strategy. (What-if check, Oct 27 2026:
// before this, Italy 2024's paused state had PIA 10 s off his real race.) A player's BOX call
// is always a stop, so the user's real fastest-lap stop (optional for scripted cars) is
// called only when the replay took it. The rival's own optional stop is taken in live play only
// if the gap behind covers it (sim.ts); when it's skipped, the replay is compared without it.
//
// Refuelling (owner decision, Nov 7 2026: every pit call states its fill): the real calls
// carry the real fills (realDecisions, refuel.ts realFill), so they replay the real race there
// too, with no car running dry. No race file on this branch refuels, so every race is
// re-tagged in memory (rules.refuelling, with a fitted fill model and with the prior).
//
// Pace by stint (Eras model fix M2, DriverModel.stintPace): the player's car runs at 0 in live
// play (its effort is the pace modes'), while a replay runs it at its real stints' offsets. So
// live play with the real calls is compared with the replay of the race less the user's offsets.
//
// Scripted events (Eras model fixes M4): the real calls include complying with a TEAM_ORDER to
// the player's car (a `team-order` note, as the replay's swap). A storyline retirement on a
// passive condition (tyre age, pressure) comes back on its lap with the real calls (a
// `storyline` note); one whose real call is a standing mode (it changes the car's pace) or the
// fuel model's can't replay exactly, so those races are left to tests/scripted.test.ts.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { type Run, initRun, isFinished, realDecisions, stepLap } from '../src/sim.js';
import type { Decision, RaceModel, RefuelModel } from '../src/types.js';

const dir = join(__dirname, '..', '..', '..', 'data', 'races');
const races = readdirSync(dir).filter((f) => f.endsWith('.json'));

const load = (file: string) => JSON.parse(readFileSync(join(dir, file), 'utf8')) as RaceModel;

/** A race whose player's storyline retirement needs a call that changes the car's pace (a
 * standing mode) or is left to the fuel model: live play can't replay it exactly. */
const activeStoryline = (model: RaceModel) =>
  (model.eras?.storylineRetirements ?? []).some(
    (r) =>
      r.driver === model.userSide && (r.condition.type === 'fuel' || r.condition.type === 'mode'),
  );
const replayable = races.filter((f) => !activeStoryline(load(f)));

/** The real calls: the real stops, plus complying with each team order to the player's car. */
function realCalls(model: RaceModel): Decision[] {
  const calls: Decision[] = [...realDecisions(model)];
  const orderLaps = new Set(
    model.events
      .filter((e) => e.type === 'TEAM_ORDER' && e.driver === model.userSide)
      .map((e) => e.lap),
  );
  for (const lap of orderLaps) calls.push({ lap, kind: 'teamOrder', order: 'comply' });
  return calls.sort((a, b) => a.lap - b.lap);
}

/** The race with the user's stint offsets removed (live play runs the player's car at 0). */
function withoutUserStintPace(model: RaceModel): RaceModel {
  return {
    ...model,
    drivers: model.drivers.map((d) =>
      d.code === model.userSide && d.stintPace ? { ...d, stintPace: [] } : d,
    ),
  };
}

/** Replay `model`, then play it live with the real calls: every car's time must match. */
function realCallsReplay(model: RaceModel): { live: Run; replay: Run } {
  const replayed = withoutUserStintPace(model);
  const replay = initRun(replayed, model.race.seed);
  while (!isFinished(replay)) stepLap(replay);
  const user = model.drivers.find((d) => d.code === model.userSide);
  const skipped = new Set(
    (user?.realStrategy ?? [])
      .filter((s) => s.optional)
      .filter(
        (s) => (replay.state.cars[model.userSide]?.tyreAge ?? 0) > model.race.laps - s.lap + 1,
      )
      .map((s) => s.lap - 1),
  );
  const calls = realCalls(model).filter((d) => d.kind !== 'pit' || !skipped.has(d.lap));
  const live = initRun(model, model.race.seed, { decisions: calls, incidents: false });
  while (!isFinished(live)) stepLap(live);
  const rival = model.drivers.find((d) => d.code === model.rival);
  let expected = replay;
  if (live.state.cars[model.rival]?.tyreAge !== replay.state.cars[model.rival]?.tyreAge) {
    expected = initRun(replayed, model.race.seed, {
      strategies: { [model.rival]: (rival?.realStrategy ?? []).filter((s) => !s.optional) },
    });
    while (!isFinished(expected)) stepLap(expected);
  }
  for (const [code, car] of Object.entries(expected.state.cars)) {
    expect(live.state.cars[code]?.totalTime).toBeCloseTo(car.totalTime, 9);
  }
  // A real car fault (step 4.4) is a frozen event: its note comes in the replay too.
  const frozen = (run: typeof live) => run.notes.filter((n) => n.kind === 'fault');
  expect(frozen(live)).toEqual(frozen(replay));
  // A storyline retirement on the real call, and a complied team order, as in the replay.
  const retired = (n: (typeof live.notes)[number]) =>
    (n.kind === 'storyline' && n.detail === 'retired') || n.kind === 'team-order';
  expect(live.notes.filter((n) => n.kind !== 'fault' && !retired(n))).toEqual([]);
  return { live, replay };
}

describe('live play with the real calls', () => {
  it.each(replayable)('%s matches the replay exactly', (file) => {
    realCallsReplay(load(file));
  });
});

// A fill model steep enough that a wrong fill shows in the times (refuel.test.ts's).
const FIT: RefuelModel = { secondsPerLap: 0.3, laneBase: 18, refFill: 15, tankLaps: 30, stops: 20 };

describe('live play with the real calls in a refuelling race', () => {
  const retag = (model: RaceModel, refuel?: RefuelModel): RaceModel => ({
    ...model,
    rules: { ...model.rules, refuelling: true },
    track: { ...model.track, ...(refuel ? { refuel } : {}) },
  });
  it.each(replayable)('%s matches the replay exactly, with no car running dry', (file) => {
    for (const model of [retag(load(file), FIT), retag(load(file))]) {
      const calls = realCalls(model);
      // Every real call states its fill: the real next stint.
      for (const d of calls) if (d.kind === 'pit') expect(d.fill).toBeTruthy();
      // The low point of every car's tank, lap by lap, in the live run (which matches the
      // replay's times exactly, checked inside).
      const live = initRun(model, model.race.seed, { decisions: calls, incidents: false });
      let low = Number.POSITIVE_INFINITY;
      while (!isFinished(live)) {
        stepLap(live);
        for (const c of Object.values(live.state.cars)) {
          if (!c.retired && c.tank !== undefined) low = Math.min(low, c.tank);
        }
      }
      expect(low).toBeGreaterThanOrEqual(0);
      realCallsReplay(model);
      // With live play's chaos on, the player's tank burns live: the real fills still reach.
      const chaos = initRun(model, model.race.seed, { decisions: calls });
      while (!isFinished(chaos)) stepLap(chaos);
      expect(chaos.notes.filter((n) => n.kind === 'fuel' && n.detail === 'out')).toEqual([]);
    }
  });
});

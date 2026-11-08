// Eras evaluator (eras build plan 1.4; "done when: it supports all 8 mastery types, and unit
// tests cover every type with retirements, red flags and ties"). Most cases build a finished
// race by hand on the Abu Dhabi 2021 model (HAM the player, VER the rival, BOT the teammate,
// laps 35-58 from the takeover); the last block plays real runs through the sim.

import { describe, expect, it } from 'vitest';
import abuJson from '../../../data/races/abu-dhabi-2021.json';
import {
  ERAS_CONFIG,
  type ErasBlock,
  type ErasObjective,
  type ErasRaceLog,
  type ErasTarget,
  type FinishedRace,
  type FlagState,
  type GradedCall,
  type MomentGrade,
  type RaceModel,
  type RaceResult,
  bandFor,
  classify,
  decide,
  difficultyFor,
  emptyLog,
  evaluateEras,
  gradeMoment,
  graderTarget,
  initRun,
  isFinished,
  legendDifficulty,
  objectiveMet,
  raceLog,
  reachedTarget,
  recordLap,
  stepLap,
  targetMet,
} from '../src/index.js';

const abu = abuJson as unknown as RaceModel;
const TAKEOVER = abu.race.takeoverLap; // 34
const LAPS = abu.race.laps; // 58

/** Classification: finishers in order, then retirees, then disqualified cars. */
function resultOf(
  finishers: string[],
  opts: { retired?: string[]; dq?: string[]; gaps?: Record<string, number> } = {},
): RaceResult {
  const gaps: Record<string, number> = {};
  const times: Record<string, number> = {};
  finishers.forEach((c, i) => {
    gaps[c] = opts.gaps?.[c] ?? i * 2;
    times[c] = 5000 + (gaps[c] as number);
  });
  return {
    order: [...finishers, ...(opts.retired ?? []), ...(opts.dq ?? [])],
    finishers,
    disqualified: opts.dq ?? [],
    gaps,
    times,
  };
}

const FIELD = ['VER', 'HAM', 'SAI', 'TSU', 'GAS', 'BOT', 'NOR', 'ALO', 'OCO', 'LEC', 'VET'];
/** The field with `order` moved to the front, in that order. */
function front(...order: string[]): string[] {
  return [...order, ...FIELD.filter((c) => !order.includes(c))];
}

interface LogSpec {
  start?: string;
  /** Stops by out-lap. */
  stops?: Array<{ lap: number; compound: string }>;
  flags?: Record<number, FlagState>;
  /** Mode ranges, inclusive. */
  modes?: Array<{
    from: number;
    to: number;
    key: 'pace' | 'fuel' | 'battle' | 'ers';
    value: string;
  }>;
  retiredLap?: number;
}

function logOf(spec: LogSpec = {}): ErasRaceLog {
  let compound = spec.start ?? 'HARD';
  const laps = [];
  for (let lap = TAKEOVER + 1; lap <= LAPS; lap++) {
    const running = spec.retiredLap === undefined || lap <= spec.retiredLap;
    const stop = running ? spec.stops?.find((s) => s.lap === lap) : undefined;
    if (stop) compound = stop.compound;
    const modes = { pace: 'standard', fuel: 'normal', battle: 'hold', ers: 'balanced' } as Record<
      string,
      string
    >;
    for (const m of spec.modes ?? []) if (lap >= m.from && lap <= m.to) modes[m.key] = m.value;
    laps.push({
      lap,
      flag: spec.flags?.[lap] ?? 'green',
      running,
      pitted: !!stop,
      compound,
      modes: modes as unknown as ErasRaceLog['laps'][number]['modes'],
    });
  }
  return { driver: 'HAM', takeoverLap: TAKEOVER, laps };
}

/** SC laps 53-57 and the VSC on 36-38, as in the real race. */
const REAL_FLAGS: Record<number, FlagState> = {
  36: 'vsc',
  37: 'vsc',
  38: 'vsc',
  53: 'sc',
  54: 'sc',
  55: 'sc',
  56: 'sc',
  57: 'sc',
};

function race(result: RaceResult, log: ErasRaceLog = logOf(), model = abu): FinishedRace {
  return { model, result, log };
}

/** A graded call whose chosen option is `behind` points behind the best. */
function call(behind: number, lap = 40): GradedCall {
  const grade: MomentGrade = {
    lap,
    samples: 100,
    target: { kind: 'win' },
    best: behind === 0 ? 'mine' : 'best',
    options: [
      { id: 'best', probability: 0.6, behindBest: 0, band: 'green' },
      { id: 'mine', probability: 0.6 - behind / 100, behindBest: behind, band: bandFor(behind) },
    ],
  };
  return { grade, chosen: 'mine' };
}

const label = 'x';
const met = (r: FinishedRace, o: Record<string, unknown>) =>
  objectiveMet(r, { label, ...o } as ErasObjective);
const hit = (r: FinishedRace, t: ErasTarget) => targetMet(r, t);

describe('targets (★1): the six types', () => {
  it('win: P1 classified; a tie on time is decided by the classification order', () => {
    expect(hit(race(resultOf(front('HAM', 'VER'))), { type: 'win' })).toBe(true);
    expect(hit(race(resultOf(front('VER', 'HAM'))), { type: 'win' })).toBe(false);
    const tie = resultOf(front('HAM', 'VER'), { gaps: { HAM: 0, VER: 0 } });
    expect(hit(race(tie), { type: 'win' })).toBe(true);
    // The player retired: never a win, even if listed first (a lone car would be).
    expect(
      hit(
        race(
          resultOf(
            FIELD.filter((c) => c !== 'HAM'),
            { retired: ['HAM'] },
          ),
        ),
        { type: 'win' },
      ),
    ).toBe(false);
  });

  it('defend is win', () => {
    expect(graderTarget({ type: 'defend' })).toEqual({ kind: 'win' });
    expect(hit(race(resultOf(front('HAM'))), { type: 'defend' })).toBe(true);
    expect(hit(race(resultOf(front('SAI', 'HAM'))), { type: 'defend' })).toBe(false);
  });

  it('position: at or better; retired or disqualified fails', () => {
    const t: ErasTarget = { type: 'position', position: 3 };
    expect(hit(race(resultOf(front('VER', 'SAI', 'HAM'))), t)).toBe(true);
    expect(hit(race(resultOf(front('VER', 'SAI', 'BOT', 'HAM'))), t)).toBe(false);
    const others = FIELD.filter((c) => c !== 'HAM');
    expect(hit(race(resultOf(others, { retired: ['HAM'] })), t)).toBe(false);
    expect(hit(race(resultOf(others, { dq: ['HAM'] })), t)).toBe(false);
  });

  it('beat-rival: ahead of the named car, wherever; a retired rival is beaten', () => {
    const t: ErasTarget = { type: 'beat-rival', rival: 'SAI' };
    expect(hit(race(resultOf(front('VER', 'BOT', 'HAM', 'SAI'))), t)).toBe(true);
    expect(hit(race(resultOf(front('SAI', 'HAM'))), t)).toBe(false);
    const noSai = FIELD.filter((c) => c !== 'SAI');
    expect(hit(race(resultOf(noSai, { retired: ['SAI'] })), t)).toBe(true);
    // Both out: the player isn't classified.
    const neither = FIELD.filter((c) => c !== 'SAI' && c !== 'HAM');
    expect(hit(race(resultOf(neither, { retired: ['HAM', 'SAI'] })), t)).toBe(false);
  });

  it('beat-rival on the race rival keeps the grader default', () => {
    const r = resultOf(front('HAM', 'VER'));
    expect(reachedTarget({ model: abu }, r, { kind: 'beat-rival' })).toBe(true);
    expect(reachedTarget({ model: abu }, r, { kind: 'beat-rival', rival: 'VER' })).toBe(true);
  });

  it('team: both cars at or better; a teammate retirement fails', () => {
    const t: ErasTarget = { type: 'team', positions: [1, 2] };
    expect(hit(race(resultOf(front('HAM', 'BOT'))), t)).toBe(true);
    // The wrong order: HAM must be P1 or better, BOT P2 or better.
    expect(hit(race(resultOf(front('BOT', 'HAM'))), t)).toBe(false);
    expect(hit(race(resultOf(front('HAM', 'VER', 'BOT'))), t)).toBe(false);
    const noBot = FIELD.filter((c) => c !== 'BOT');
    expect(hit(race(resultOf(noBot, { retired: ['BOT'] })), t)).toBe(false);
    // At exactly the set positions passes.
    expect(
      hit(race(resultOf(front('VER', 'HAM', 'SAI', 'BOT'))), { type: 'team', positions: [2, 4] }),
    ).toBe(true);
  });

  it("deny: the rival at or below the position, or out; the player needn't finish", () => {
    const t: ErasTarget = { type: 'deny', rival: 'VER', position: 4 };
    expect(hit(race(resultOf(front('HAM', 'SAI', 'BOT', 'VER'))), t)).toBe(true); // exactly P4
    expect(hit(race(resultOf(front('HAM', 'SAI', 'VER'))), t)).toBe(false);
    const noVer = FIELD.filter((c) => c !== 'VER');
    expect(hit(race(resultOf(noVer, { retired: ['VER'] })), t)).toBe(true);
    expect(hit(race(resultOf(noVer, { dq: ['VER'] })), t)).toBe(true);
    const neither = FIELD.filter((c) => c !== 'VER' && c !== 'HAM');
    expect(hit(race(resultOf(neither, { retired: ['HAM', 'VER'] })), t)).toBe(true);
    // The player out, the rival P4: still denied.
    const hamOut = front('SAI', 'BOT', 'NOR', 'VER').filter((c) => c !== 'HAM');
    expect(hit(race(resultOf(hamOut, { retired: ['HAM'] })), t)).toBe(true);
  });

  it('throws on a target the race cannot grade', () => {
    const r = race(resultOf(front('HAM')));
    expect(() => hit(r, { type: 'beat-rival', rival: 'XXX' })).toThrow(/not in the race/);
    expect(() => hit(r, { type: 'deny', rival: 'HAM', position: 3 })).toThrow(/player's car/);
    const noMate: RaceModel = { ...abu, drivers: abu.drivers.filter((d) => d.code !== 'BOT') };
    expect(() =>
      hit(race(resultOf(front('HAM')), logOf(), noMate), { type: 'team', positions: [1, 2] }),
    ).toThrow(/no teammate/);
  });
});

describe('objectives: the eight types', () => {
  const winning = resultOf(front('HAM', 'VER'));
  const retired = resultOf(
    FIELD.filter((c) => c !== 'HAM'),
    { retired: ['HAM'] },
  );
  const dq = resultOf(
    FIELD.filter((c) => c !== 'HAM'),
    { dq: ['HAM'] },
  );

  it('every objective needs the player classified (retired or disqualified fails)', () => {
    const all: Array<Record<string, unknown>> = [
      { type: 'stop_count', max: 3 },
      { type: 'beat_real_call' },
      { type: 'finish_position', position: 20 },
      { type: 'margin', seconds: 0.1 },
      { type: 'compound_rule', mustAvoid: 'SOFT' },
      { type: 'mode_rule', mode: 'push', maxLaps: 99 },
      { type: 'no_neutralized_stop' },
      { type: 'team_result', positions: [20, 20] },
    ];
    for (const o of all) {
      expect(met(race(winning), o)).toBe(true);
      expect(met(race(retired, logOf({ retiredLap: 45 })), o)).toBe(false);
      expect(met(race(dq), o)).toBe(false);
    }
  });

  it('stop_count: max and exact, counting stops from the takeover', () => {
    const two = logOf({
      stops: [
        { lap: 40, compound: 'MEDIUM' },
        { lap: 54, compound: 'SOFT' },
      ],
    });
    expect(met(race(winning, two), { type: 'stop_count', max: 2 })).toBe(true);
    expect(met(race(winning, two), { type: 'stop_count', max: 1 })).toBe(false);
    expect(met(race(winning, two), { type: 'stop_count', exact: 2 })).toBe(true);
    expect(met(race(winning, two), { type: 'stop_count', exact: 1 })).toBe(false);
    expect(met(race(winning), { type: 'stop_count', exact: 0 })).toBe(true);
    // A red-flag lap's stop still counts as a stop.
    const red = logOf({ flags: { 45: 'red' }, stops: [{ lap: 45, compound: 'MEDIUM' }] });
    expect(met(race(winning, red), { type: 'stop_count', exact: 1 })).toBe(true);
  });

  it('beat_real_call: strictly ahead of the real result (HAM was P2)', () => {
    expect(met(race(winning), { type: 'beat_real_call' })).toBe(true);
    // A tie with the real result isn't better.
    expect(met(race(resultOf(front('VER', 'HAM'))), { type: 'beat_real_call' })).toBe(false);
    // The rival retiring hands the player P1, which beats P2.
    const noVer = resultOf(
      FIELD.filter((c) => c !== 'VER'),
      { retired: ['VER'] },
    );
    expect(met(race(noVer), { type: 'beat_real_call' })).toBe(true);
  });

  it('beat_real_call: any finish beats a real retirement; throws if the car has no real result', () => {
    const perModel: RaceModel = { ...abu, userSide: 'PER', rival: 'HAM' };
    const perLog = { ...logOf(), driver: 'PER' };
    const perLast = resultOf([...FIELD.filter((c) => c !== 'PER'), 'PER']);
    expect(met(race(perLast, perLog, perModel), { type: 'beat_real_call' })).toBe(true);
    const missing: RaceModel = { ...abu, realResult: abu.realResult.filter((c) => c !== 'HAM') };
    expect(() => met(race(winning, logOf(), missing), { type: 'beat_real_call' })).toThrow(
      /real result/,
    );
  });

  it('finish_position: at or better', () => {
    expect(
      met(race(resultOf(front('VER', 'SAI', 'HAM'))), { type: 'finish_position', position: 3 }),
    ).toBe(true);
    expect(
      met(race(resultOf(front('VER', 'SAI', 'HAM'))), { type: 'finish_position', position: 2 }),
    ).toBe(false);
  });

  it('margin: a win by more than the seconds over P2; a tie on the margin fails', () => {
    const by = (gap: number) => resultOf(front('HAM', 'VER'), { gaps: { HAM: 0, VER: gap } });
    expect(met(race(by(5.01)), { type: 'margin', seconds: 5 })).toBe(true);
    expect(met(race(by(5)), { type: 'margin', seconds: 5 })).toBe(false);
    expect(met(race(by(0)), { type: 'margin', seconds: 0.1 })).toBe(false); // dead heat
    // Not the winner: no margin, however big the gap behind.
    const p2 = resultOf(front('VER', 'HAM', 'SAI'), { gaps: { VER: 0, HAM: 1, SAI: 30 } });
    expect(met(race(p2), { type: 'margin', seconds: 5 })).toBe(false);
    // The only finisher wins by any margin.
    const lone = resultOf(['HAM'], { retired: FIELD.filter((c) => c !== 'HAM') });
    expect(met(race(lone), { type: 'margin', seconds: 60 })).toBe(true);
  });

  it('compound_rule: mustUse, mustAvoid, both; counts the takeover tyres', () => {
    const soft = logOf({ stops: [{ lap: 54, compound: 'SOFT' }] });
    expect(met(race(winning, soft), { type: 'compound_rule', mustUse: 'SOFT' })).toBe(true);
    expect(met(race(winning), { type: 'compound_rule', mustUse: 'SOFT' })).toBe(false);
    expect(met(race(winning, soft), { type: 'compound_rule', mustAvoid: 'SOFT' })).toBe(false);
    expect(met(race(winning), { type: 'compound_rule', mustAvoid: 'SOFT' })).toBe(true);
    expect(met(race(winning), { type: 'compound_rule', mustAvoid: 'HARD' })).toBe(false); // on it at takeover
    expect(
      met(race(winning, soft), { type: 'compound_rule', mustUse: 'SOFT', mustAvoid: 'MEDIUM' }),
    ).toBe(true);
    expect(
      met(race(winning, soft), { type: 'compound_rule', mustUse: 'SOFT', mustAvoid: 'HARD' }),
    ).toBe(false);
    expect(() => met(race(winning), { type: 'compound_rule', mustUse: 'WET' })).toThrow(
      /not in the race/,
    );
  });

  it('mode_rule: green laps on the mode, up to maxLaps inclusive; neutralized laps are free', () => {
    const push5 = logOf({ modes: [{ from: 40, to: 44, key: 'pace', value: 'push' }] });
    expect(met(race(winning, push5), { type: 'mode_rule', mode: 'push', maxLaps: 5 })).toBe(true);
    expect(met(race(winning, push5), { type: 'mode_rule', mode: 'push', maxLaps: 4 })).toBe(false);
    // Pushing through the SC (53-57) and red-flag laps costs nothing against the limit.
    const throughSc = logOf({
      flags: { ...REAL_FLAGS, 50: 'red' },
      modes: [{ from: 50, to: 58, key: 'pace', value: 'push' }],
    });
    // 50 red, 53-57 SC: green laps 51, 52, 58.
    expect(met(race(winning, throughSc), { type: 'mode_rule', mode: 'push', maxLaps: 3 })).toBe(
      true,
    );
    expect(met(race(winning, throughSc), { type: 'mode_rule', mode: 'push', maxLaps: 2 })).toBe(
      false,
    );
    // Any mode key: lift and coast.
    const lico = logOf({ modes: [{ from: 40, to: 41, key: 'fuel', value: 'liftAndCoast' }] });
    expect(met(race(winning, lico), { type: 'mode_rule', mode: 'liftAndCoast', maxLaps: 1 })).toBe(
      false,
    );
    expect(met(race(winning), { type: 'mode_rule', mode: 'push', maxLaps: 0 })).toBe(true);
  });

  it('no_neutralized_stop: SC and VSC stops fail, green and red-flag stops pass', () => {
    const o = { type: 'no_neutralized_stop' };
    const at = (lap: number, compound = 'SOFT', flags = REAL_FLAGS) =>
      race(winning, logOf({ flags, stops: [{ lap, compound }] }));
    expect(met(at(55), o)).toBe(false); // in under the SC, out under it
    expect(met(at(38, 'MEDIUM'), o)).toBe(false); // VSC
    expect(met(at(45), o)).toBe(true); // green
    expect(met(race(winning, logOf({ flags: REAL_FLAGS })), o)).toBe(true); // no stop
    // Boxed on the green lap before the deployment (out-lap = SC lap 53): a green stop...
    expect(met(at(53), o)).toBe(true);
    // ...unless it's the real team's stop, which the sim prices under the SC.
    const verModel: RaceModel = { ...abu, userSide: 'VER', rival: 'HAM' };
    const verLog = {
      ...logOf({ flags: { ...REAL_FLAGS, 53: 'green' }, stops: [{ lap: 54, compound: 'SOFT' }] }),
      driver: 'VER',
    };
    // VER's real stop is out-lap 54 on softs: with lap 53 green the real stop still counts.
    expect(met(race(winning, verLog, verModel), o)).toBe(false);
    // A red flag isn't a SC or VSC.
    expect(met(at(46, 'SOFT', { 45: 'red', 46: 'red' }), o)).toBe(true);
  });

  it('team_result: both cars at or better; the teammate retiring fails', () => {
    const o = { type: 'team_result', positions: [10, 10] };
    expect(met(race(resultOf(front('VER', 'HAM', 'BOT'))), o)).toBe(true);
    const noBot = resultOf(
      FIELD.filter((c) => c !== 'BOT'),
      { retired: ['BOT'] },
    );
    expect(met(race(noBot), o)).toBe(false);
    expect(
      met(race(resultOf(front('VER', 'HAM'))), { type: 'team_result', positions: [2, 5] }),
    ).toBe(false); // BOT P6
    expect(
      met(race(resultOf(front('VER', 'HAM'))), { type: 'team_result', positions: [2, 6] }),
    ).toBe(true); // tie at the line
  });

  it('throws on a log that does not match the race', () => {
    const short = { ...logOf(), laps: logOf().laps.slice(1) };
    expect(() => met(race(winning, short), { type: 'stop_count', max: 1 })).toThrow(/laps/);
    expect(() =>
      met(race(winning, { ...logOf(), driver: 'VER' }), { type: 'stop_count', max: 1 }),
    ).toThrow(/player's car/);
  });
});

describe('evaluateEras: stars, hidden objective, rewrite', () => {
  const eras: ErasBlock = {
    eraId: 9,
    order: 10,
    target: { type: 'beat-rival', rival: 'VER' },
    storyline: {
      real: 'Verstappen wins the race and the title',
      rewriteCondition: { type: 'beat-rival', rival: 'VER' },
      headline: 'You won Lewis his eighth title',
    },
    mastery: { type: 'no_neutralized_stop', label: 'Win without pitting under the safety car' },
    hidden: { type: 'margin', seconds: 3, label: 'Win by more than 3 seconds' },
  };
  const normal = difficultyFor(2); // Era 9: threshold 72
  const win = race(resultOf(front('HAM', 'VER'), { gaps: { HAM: 0, VER: 4 } }));
  const evalWith = (over: Partial<Parameters<typeof evaluateEras>[0]>) =>
    evaluateEras({
      race: win,
      eras,
      calls: [call(0), call(4)],
      difficulty: normal,
      untimed: false,
      ...over,
    });

  it('a clean win earns all three stars, the hidden objective and the rewrite', () => {
    const e = evalWith({});
    expect(e.stars).toEqual({ result: true, strategist: true, mastery: true });
    expect(e.hidden).toBe(true);
    expect(e.rewrite).toBe(true);
    // (100 + (100 - 2.5 * 4)) / 2
    expect(e.raceAccuracy).toBeCloseTo(95);
    expect(e.decisionAccuracies).toEqual([100, 90]);
    expect(e.untimed).toBe(false);
    expect(evalWith({ untimed: true }).untimed).toBe(true);
  });

  it('★3 fails on a single orange call, and on a single red one', () => {
    const orange = evalWith({ calls: [call(0), call(0), call(5.01)] });
    expect(bandFor(5.01)).toBe('orange');
    expect(orange.masteryObjective).toBe(true);
    expect(orange.cleanCalls).toBe(false);
    expect(orange.stars.mastery).toBe(false);
    const red = evalWith({ calls: [call(0), call(20)] });
    expect(red.stars.mastery).toBe(false);
    // Yellow at the edge is still clean.
    expect(evalWith({ calls: [call(5)] }).stars.mastery).toBe(true);
  });

  it('★2 at the threshold passes (a tie), just under fails; Legend raises it', () => {
    // One call at 72: 100 - 2.5 * 11.2 = 72.
    expect(evalWith({ calls: [call(11.2)] }).stars.strategist).toBe(true);
    expect(evalWith({ calls: [call(11.21)] }).stars.strategist).toBe(false);
    const legend = evalWith({ calls: [call(4.4)], difficulty: legendDifficulty() }); // 89
    expect(legend.raceAccuracy).toBeCloseTo(89);
    expect(legend.stars.strategist).toBe(false);
    expect(evalWith({ calls: [call(4)], difficulty: legendDifficulty() }).stars.strategist).toBe(
      true,
    );
  });

  it('accuracy follows the config multiplier', () => {
    const config = { ...structuredClone(ERAS_CONFIG), accuracyMultiplier: 10 };
    expect(evalWith({ calls: [call(4)], config }).raceAccuracy).toBeCloseTo(60);
  });

  it('no graded calls: accuracy 0, no ★2', () => {
    const e = evalWith({ calls: [] });
    expect(e.raceAccuracy).toBe(0);
    expect(e.stars.strategist).toBe(false);
  });

  it('stars are independent: ★1 without ★3 on a SC stop, ★3 needs only its objective', () => {
    const scStop = race(
      win.result,
      logOf({ flags: REAL_FLAGS, stops: [{ lap: 55, compound: 'SOFT' }] }),
    );
    const e = evalWith({ race: scStop });
    expect(e.stars).toEqual({ result: true, strategist: true, mastery: false });
    // Losing to the rival: no ★1, no rewrite, no hidden; ★3 holds (no SC stop, clean calls).
    const lost = evalWith({ race: race(resultOf(front('VER', 'HAM'))) });
    expect(lost.stars).toEqual({ result: false, strategist: true, mastery: true });
    expect(lost.rewrite).toBe(false);
    expect(lost.hidden).toBe(false);
  });

  it('the player retiring: no ★1, no ★3, no rewrite; ★2 still on the calls', () => {
    const out = race(
      resultOf(
        FIELD.filter((c) => c !== 'HAM'),
        { retired: ['HAM'] },
      ),
      logOf({ retiredLap: 50 }),
    );
    const e = evalWith({ race: out });
    expect(e.stars).toEqual({ result: false, strategist: true, mastery: false });
    expect(e.rewrite).toBe(false);
    expect(e.hidden).toBe(false);
  });

  it('the rival retiring: ★1 and the rewrite', () => {
    const noVer = race(
      resultOf(
        FIELD.filter((c) => c !== 'VER'),
        { retired: ['VER'] },
      ),
    );
    const e = evalWith({ race: noVer });
    expect(e.stars.result).toBe(true);
    expect(e.rewrite).toBe(true);
  });

  it('a deny target and a different rewrite condition are evaluated separately', () => {
    const deny: ErasBlock = {
      ...eras,
      target: { type: 'deny', rival: 'VER', position: 3 },
      storyline: {
        ...(eras.storyline as NonNullable<ErasBlock['storyline']>),
        rewriteCondition: { type: 'win' },
      },
    };
    const e = evalWith({ eras: deny, race: race(resultOf(front('SAI', 'HAM', 'VER'))) });
    expect(e.stars.result).toBe(true);
    expect(e.rewrite).toBe(false);
  });

  it('unauthored hidden objective and storyline are null; a missing target or mastery throws', () => {
    const { hidden: _h, storyline: _s, ...bare } = eras;
    const e = evalWith({ eras: bare });
    expect(e.hidden).toBeNull();
    expect(e.rewrite).toBeNull();
    const { target: _t, ...noTarget } = eras;
    expect(() => evalWith({ eras: noTarget })).toThrow(/no Eras target/);
    const { mastery: _m, ...noMastery } = eras;
    expect(() => evalWith({ eras: noMastery })).toThrow(/no mastery/);
  });

  it('throws when the chosen option was not graded', () => {
    const bad = { ...call(0), chosen: 'nope' };
    expect(() => evalWith({ calls: [bad] })).toThrow(/not graded/);
  });
});

describe('grader: deny and team targets in playouts', () => {
  it('grades a moment against deny and team (reproducible, chances in range)', () => {
    const run = initRun(abu, abu.race.seed, { decisions: [] });
    while (run.state.lap < 52) stepLap(run);
    const options = [
      { id: 'stay-out', decisions: [] },
      { id: 'box-soft', decisions: [{ lap: 53, kind: 'pit' as const, compound: 'SOFT' }] },
    ];
    for (const target of [
      { kind: 'deny' as const, rival: 'VER', position: 2 },
      { kind: 'team' as const, positions: [2, 6] as [number, number] },
    ]) {
      const g = gradeMoment(run, options, target, 20);
      expect(g).toEqual(gradeMoment(run, options, target, 20));
      for (const o of g.options) expect(o.probability).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('race log on real runs', () => {
  /** Play Abu Dhabi as HAM with the given pit calls, recording every lap. */
  function play(model: RaceModel, pits: Array<{ at: number; lap: number; compound: string }>) {
    const run = initRun(model, model.race.seed, { decisions: [] });
    const log = emptyLog(run);
    while (!isFinished(run)) {
      for (const p of pits)
        if (p.at === run.state.lap) decide(run, { lap: p.lap, kind: 'pit', compound: p.compound });
      stepLap(run);
      recordLap(log, run);
    }
    return { run, log };
  }

  it('recordLap and raceLog agree, and the log shows the stop and flags', () => {
    const { run, log } = play(abu, [{ at: 52, lap: 53, compound: 'SOFT' }]);
    expect(raceLog(run)).toEqual(log);
    expect(log.laps).toHaveLength(LAPS - TAKEOVER);
    const out = log.laps.find((l) => l.lap === 54);
    expect(out?.pitted).toBe(true);
    expect(out?.compound).toBe('SOFT');
    expect(out?.flag).toBe('sc');
    expect(log.laps.filter((l) => l.pitted)).toHaveLength(1);
    const fin: FinishedRace = { model: abu, result: classify(run), log };
    // In under the SC (lap 53) and out under it (54).
    expect(objectiveMet(fin, { type: 'no_neutralized_stop', label })).toBe(false);
    expect(fin.result.finishers).toContain('HAM');
    expect(objectiveMet(fin, { type: 'stop_count', exact: 1, label })).toBe(true);
    expect(objectiveMet(fin, { type: 'compound_rule', mustUse: 'SOFT', label })).toBe(true);
  });

  it('records a red flag, and a red-flag stop is not neutralized', () => {
    const redModel: RaceModel = {
      ...abu,
      events: [...abu.events.filter((e) => e.type !== 'SC'), { lap: 45, type: 'RED', laps: 2 }],
    };
    const { run, log } = play(redModel, [{ at: 44, lap: 45, compound: 'MEDIUM' }]);
    expect(log.laps.find((l) => l.lap === 45)?.flag).toBe('red');
    expect(log.laps.find((l) => l.lap === 46)).toMatchObject({
      flag: 'red',
      pitted: true,
      compound: 'MEDIUM',
    });
    const fin: FinishedRace = { model: redModel, result: classify(run), log };
    expect(fin.result.finishers).toContain('HAM');
    expect(objectiveMet(fin, { type: 'no_neutralized_stop', label })).toBe(true);
    expect(objectiveMet(fin, { type: 'stop_count', exact: 1, label })).toBe(true);
  });

  it('a recorded lap out of order throws', () => {
    const run = initRun(abu, 1, { decisions: [] });
    const log = emptyLog(run);
    stepLap(run);
    stepLap(run);
    expect(() => recordLap(log, run)).toThrow(/expected lap 35/);
  });

  it('raceLog refuses an unfinished run, and a run it cannot reproduce', () => {
    const run = initRun(abu, 1, { decisions: [] });
    expect(() => raceLog(run)).toThrow(/flag/);
    const scripted = initRun(abu, 1, { decisions: [], strategies: { VER: [] } });
    while (!isFinished(scripted)) stepLap(scripted);
    expect(() => raceLog(scripted)).toThrow(/reproduce/);
  });

  it('evaluates a real run end to end', () => {
    const { run, log } = play(abu, []);
    const result = classify(run);
    const e = evaluateEras({
      race: { model: abu, result, log },
      eras: {
        eraId: 9,
        order: 10,
        target: { type: 'beat-rival', rival: 'VER' },
        mastery: { type: 'stop_count', max: 0, label },
      },
      calls: [call(0)],
      difficulty: difficultyFor(2),
      untimed: true,
    });
    // The real calls replay the real result: VER wins, HAM P2 on no stops.
    expect(result.order.slice(0, 2)).toEqual(['VER', 'HAM']);
    expect(e.stars).toEqual({ result: false, strategist: true, mastery: true });
    expect(e.untimed).toBe(true);
  });
});

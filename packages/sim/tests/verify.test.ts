// Server-side verification (Phase 4 spec stage 1): a run rebuilt from its call log must grade
// and score exactly as the player's game did, and tampered logs must be rejected.

import { describe, expect, it } from 'vitest';
import abuJson from '../../../data/races/abu-dhabi-2021.json';
import { playDailyRace } from '../examples/daily-race.js';
import { battlesFor } from '../src/engineer.js';
import { gradeMoment } from '../src/grade.js';
import { legendMoments } from '../src/moments.js';
import { type Run, decide, engineerConfig, initRun, isFinished, stepLap } from '../src/sim.js';
import type { Decision, RaceModel } from '../src/types.js';
import {
  type ClaimedGrade,
  VerifyError,
  answerMoment,
  claimGrade,
  verifyRun,
} from '../src/verify.js';

const fullAbu = abuJson as unknown as RaceModel;
const SAMPLES = 40;

// The verification rules are exercised on Abu Dhabi with only its lap-53 SC moment; the
// shipped six-moment race is checked end to end at the bottom.
const scStop = fullAbu.decisionMoments.find((m) => m.id === 'sc-stop');
if (!scStop) throw new Error('Abu Dhabi 2021 has no sc-stop moment');
const abu: RaceModel = { ...fullAbu, decisionMoments: [scStop] };

// Abu Dhabi with a second, earlier moment whose real call is none of its options, so a run
// carries two graded moments and the real team's call is graded separately.
const twoMoments: RaceModel = {
  ...abu,
  decisionMoments: [
    {
      id: 'undercut-44',
      lap: 44,
      trigger: 'undercut',
      target: { kind: 'beat-rival' },
      options: [
        { id: 'stay-out', label: 'Stay out', decisions: [] },
        {
          id: 'box-hard',
          label: 'Box for hards',
          decisions: [{ lap: 44, kind: 'pit', compound: 'HARD' }],
        },
        {
          id: 'push',
          label: 'Stay out and push',
          decisions: [{ lap: 44, kind: 'mode', key: 'pace', value: 'push' }],
        },
      ],
      realOptionId: null,
    },
    scStop,
  ],
};

function play(model: RaceModel, choices: Record<string, string>, between?: (run: never) => void) {
  return playDailyRace(model, model.race.seed, (m) => choices[m.id] as string, {
    samples: SAMPLES,
    between: between as never,
  });
}

function reasonFor(model: RaceModel, decisions: unknown): string {
  try {
    verifyRun(model, model.race.seed, decisions, SAMPLES);
  } catch (e) {
    if (e instanceof VerifyError) return e.code;
    throw e;
  }
  return 'ok';
}

describe('decide() timestamps', () => {
  it('stamps each call with the last completed lap', () => {
    const run = initRun(abu, abu.race.seed, { decisions: [] });
    decide(run, { lap: 40, kind: 'pit', compound: 'HARD' });
    expect(run.decisions[0]?.at).toBe(abu.race.takeoverLap);
  });

  it('rejects a call stamped at or after its own lap', () => {
    expect(() =>
      initRun(abu, abu.race.seed, {
        decisions: [{ lap: 40, at: 40, kind: 'pit', compound: 'HARD' }],
      }),
    ).toThrow(/made at lap 40/);
  });
});

describe('verifyRun', () => {
  it('reproduces a played run: result, grades and score', () => {
    const played = play(abu, { 'sc-stop': 'box-soft' });
    const v = verifyRun(abu, abu.race.seed, played.decisions, SAMPLES);
    expect(v.result).toEqual(played.result);
    expect(v.score).toEqual(played.score);
    expect(v.moments.map((m) => m.grade)).toEqual(played.calls.map((c) => c.grade));
    expect(v.moments[0]?.chosen).toBe('box-soft');
    expect(v.moments[0]?.matchedReal).toBe(false);
    expect(v.moments[0]?.real.optionId).toBe('stay');
    expect(v.finishPosition).toBe(played.result.order.indexOf('HAM') + 1);
    expect(v.disqualified).toBe(false);
  });

  it('survives a JSON round trip (what the Worker receives)', () => {
    const played = play(abu, { 'sc-stop': 'stay' });
    const wire = JSON.parse(JSON.stringify(played.decisions));
    const v = verifyRun(abu, abu.race.seed, wire, SAMPLES);
    expect(v.score).toEqual(played.score);
    expect(v.moments[0]?.matchedReal).toBe(true);
  });

  it('rebuilds each grade from the calls known at its pause, including queued ones', () => {
    // A stop queued early for a lap after both moments, and headset calls made later: the
    // early one is part of both grades, the late ones of neither.
    const between = (run: { state: { lap: number } }) => {
      const r = run as Parameters<typeof decide>[0];
      if (r.state.lap === 36) decide(r, { lap: 56, kind: 'pit', compound: 'MEDIUM' });
      if (r.state.lap === 50) decide(r, { lap: 51, kind: 'mode', key: 'pace', value: 'push' });
      if (r.state.lap === 54) decide(r, { lap: 55, kind: 'mode', key: 'pace', value: 'manage' });
    };
    const played = play(twoMoments, { 'undercut-44': 'push', 'sc-stop': 'stay' }, between as never);
    expect(played.decisions.map((d) => d.at)).toEqual(
      [...played.decisions.map((d) => d.at)].sort((a, b) => (a as number) - (b as number)),
    );
    const v = verifyRun(twoMoments, twoMoments.race.seed, played.decisions, SAMPLES);
    expect(v.moments.map((m) => m.grade)).toEqual(played.calls.map((c) => c.grade));
    expect(v.score).toEqual(played.score);
    expect(v.result).toEqual(played.result);
    // The second moment's real call (stay out) is one of its options; the first's is not.
    expect(v.moments[0]?.real.optionId).toBeNull();
    expect(v.moments[0]?.real.probability).toBeGreaterThanOrEqual(0);
    expect(v.moments[1]?.matchedReal).toBe(true);
  });

  describe('rejects tampered logs', () => {
    const played = play(abu, { 'sc-stop': 'box-soft' });
    const log = played.decisions;
    const radio = log.findIndex((d) => d.kind === 'radio');
    const edit = (f: (l: Decision[]) => void) => {
      const copy = JSON.parse(JSON.stringify(log)) as Decision[];
      f(copy);
      return copy;
    };

    it('accepts the untouched log', () => expect(reasonFor(abu, log)).toBe('ok'));
    it('not an array', () => expect(reasonFor(abu, { calls: [] })).toBe('invalid-calls'));
    it('a call without its timestamp', () =>
      expect(
        reasonFor(
          abu,
          edit((l) => {
            l[0] = { ...(l[0] as Decision), at: undefined };
          }),
        ),
      ).toBe('invalid-calls'));
    it('calls out of order', () =>
      expect(
        reasonFor(
          abu,
          edit((l) => l.push({ lap: 57, at: 40, kind: 'pit', compound: 'HARD' })),
        ),
      ).toBe('invalid-calls'));
    it('a call for a lap that had already run', () =>
      expect(
        reasonFor(
          abu,
          edit((l) => l.push({ lap: 55, at: 56, kind: 'pit', compound: 'HARD' })),
        ),
      ).toBe('invalid-calls'));
    it('an unknown compound', () =>
      expect(
        reasonFor(
          abu,
          edit((l) => l.push({ lap: 56, at: 55, kind: 'pit', compound: 'WET' })),
        ),
      ).toBe('invalid-calls'));
    it('no answer to a moment', () =>
      expect(
        reasonFor(
          abu,
          edit((l) => l.splice(radio, 1)),
        ),
      ).toBe('missing-answer'));
    it('two answers to a moment', () =>
      expect(
        reasonFor(
          abu,
          edit((l) => l.splice(radio, 0, { ...(l[radio] as Decision) })),
        ),
      ).toBe('missing-answer'));
    it('an answer that claims a different option than the calls made', () =>
      expect(
        reasonFor(
          abu,
          edit((l) => {
            // Calls made for soft tyres, answer claims mediums. (Claiming "stay" with a stop
            // after it reads as answering stay, then pressing BOX: a legal run.)
            (l[radio] as { optionId: string }).optionId = 'box-medium';
          }),
        ),
      ).toBe('bad-answer'));
    it("a call slipped between the answer and its option's calls", () =>
      expect(
        reasonFor(
          abu,
          edit((l) =>
            l.splice(radio + 1, 0, { lap: 53, at: 52, kind: 'mode', key: 'pace', value: 'push' }),
          ),
        ),
      ).toBe('bad-answer'));
    it('an option call missing after the answer', () =>
      expect(
        reasonFor(
          abu,
          edit((l) => l.splice(radio + 1, 1)),
        ),
      ).toBe('bad-answer'));
    it('an answer to a moment that does not exist', () =>
      expect(
        reasonFor(
          abu,
          edit((l) => l.push({ lap: 57, at: 56, kind: 'radio', momentId: 'x', optionId: 'y' })),
        ),
      ).toBe('bad-answer'));
  });

  it('accepts live calls the player makes on a moment lap after answering it', () => {
    // BOX or a headset flip in the lap right after a pause lands on the moment's lap, after
    // the answer and its option's calls.
    const log = play(abu, { 'sc-stop': 'box-soft' }).decisions;
    const radio = log.findIndex((d) => d.kind === 'radio');
    const withLive = [...log];
    withLive.splice(radio + 2, 0, {
      lap: 53,
      at: 52,
      kind: 'mode',
      key: 'battle',
      value: 'defend',
    });
    const v = verifyRun(abu, abu.race.seed, withLive, SAMPLES);
    expect(v.moments[0]?.chosen).toBe('box-soft');
  });

  it('replays and re-grades a run full of race engineer calls exactly', () => {
    // A battle move every lap there's a car within a second, track-limit care, a lapped car,
    // and a turned-down request: the server's replay (full re-grade, no claimed grades) must
    // match the game's result, grades and score, trust and all.
    const cfg = engineerConfig(abu);
    if (!cfg) throw new Error('no engineer config');
    const between = (run: Run) => {
      const next = run.state.lap + 1;
      const b = battlesFor(run.state, abu, cfg);
      if (b.ahead) decide(run, { lap: next, kind: 'battle', move: 'dive-inside' });
      else if (b.behind) decide(run, { lap: next, kind: 'battle', move: 'defend-hard' });
      if (next === 40) decide(run, { lap: next, kind: 'limits', careful: true });
      if (next === 42) decide(run, { lap: next, kind: 'reply', request: 'push', yes: false });
      if (next % 3 === 0) decide(run, { lap: next, kind: 'blue', action: 'go-round' });
    };
    const played = play(abu, { 'sc-stop': 'box-soft' }, between as never);
    expect(played.decisions.some((d) => d.kind === 'battle')).toBe(true);
    const wire = JSON.parse(JSON.stringify(played.decisions));
    const v = verifyRun(abu, abu.race.seed, wire, SAMPLES);
    expect(v.result).toEqual(played.result);
    expect(v.score).toEqual(played.score);
    expect(v.moments.map((m) => m.grade)).toEqual(played.calls.map((c) => c.grade));
  });

  it('verifies the shipped six-moment Abu Dhabi run', () => {
    const choices = {
      'vsc-cover': 'cover-hard',
      'tyres-going': 'box-medium',
      'manage-or-push': 'manage',
      'sc-stop': 'box-soft',
      'sc-last-chance': 'stay',
      'restart-stance': 'defend',
    };
    const played = play(fullAbu, choices);
    const v = verifyRun(fullAbu, fullAbu.race.seed, played.decisions, SAMPLES);
    expect(v.moments.map((m) => [m.momentId, m.chosen])).toEqual(Object.entries(choices));
    expect(v.moments.map((m) => m.grade)).toEqual(played.calls.map((c) => c.grade));
    expect(v.score).toEqual(played.score);
  });

  describe("with the game's claimed grades (free-plan scoring)", () => {
    const choices = {
      'vsc-cover': 'stay',
      'tyres-going': 'stay',
      'manage-or-push': 'push',
      'sc-stop': 'box-soft',
      'sc-last-chance': 'stay',
      'restart-stance': 'defend',
    };
    const played = play(fullAbu, choices);
    const claimed = (grades: unknown) =>
      verifyRun(fullAbu, fullAbu.race.seed, played.decisions, SAMPLES, grades);
    const reason = (grades: unknown) => {
      try {
        claimed(grades);
      } catch (e) {
        if (e instanceof VerifyError) return e.code;
        throw e;
      }
      return 'ok';
    };
    const edit = (f: (g: Array<{ probabilities: number[]; real?: number }>) => void) => {
      const copy = JSON.parse(JSON.stringify(played.grades));
      f(copy);
      return copy;
    };

    it('scores an honest run exactly as full grading does, real calls included', () => {
      const full = verifyRun(fullAbu, fullAbu.race.seed, played.decisions, SAMPLES);
      expect(claimed(JSON.parse(JSON.stringify(played.grades)))).toEqual(full);
      // Laps 49 and 57: the real team took none of the options, so their chance is claimed.
      expect(played.grades.map((g) => g.real !== undefined)).toEqual([
        false,
        false,
        true,
        false,
        false,
        true,
      ]);
    });

    it('an edited chance passes the live check but not full grading (the nightly check)', () => {
      const cheat = edit((g) => {
        const sc = g[3] as { probabilities: number[] };
        sc.probabilities = sc.probabilities.map((_, i) => (i === 1 ? 1 : 0)); // box-soft best
      });
      const full = verifyRun(fullAbu, fullAbu.race.seed, played.decisions, SAMPLES);
      expect(claimed(cheat).score).not.toEqual(full.score);
    });

    it('rejects grades of the wrong shape', () => {
      expect(reason(played.grades)).toBe('ok');
      expect(reason({})).toBe('bad-grades');
      expect(reason(played.grades.slice(1))).toBe('bad-grades');
      expect(reason(edit((g) => g.push({ ...(g[0] as { probabilities: number[] }) })))).toBe(
        'bad-grades',
      );
      expect(reason(edit((g) => (g[0] as { probabilities: number[] }).probabilities.pop()))).toBe(
        'bad-grades',
      );
      const firstChance = (p: number) =>
        edit((g) => {
          (g[0] as { probabilities: number[] }).probabilities[0] = p;
        });
      expect(reason(firstChance(0.333))).toBe('bad-grades'); // not a whole number of samples
      expect(reason(firstChance(2))).toBe('bad-grades');
      const realChance = (i: number, p: number | undefined) =>
        edit((g) => {
          (g[i] as { real?: number }).real = p;
        });
      expect(reason(JSON.parse(JSON.stringify(realChance(2, undefined))))).toBe('bad-grades');
      expect(reason(realChance(0, 0.5))).toBe('bad-grades');
    });

    it('still checks the call log first', () => {
      const log = JSON.parse(JSON.stringify(played.decisions)) as Decision[];
      log.push({ lap: 55, at: 56, kind: 'pit', compound: 'HARD' });
      expect(() => verifyRun(fullAbu, fullAbu.race.seed, log, SAMPLES, played.grades)).toThrow(
        VerifyError,
      );
    });
  });
});

describe('Legend', () => {
  // Seed 4242: Legend removes the real VSC, SC and restart moments and draws a VSC on lap 35,
  // so the player is asked legend-vsc-35, then the two green-flag calls.
  const seed = 4242;
  const moments = legendMoments(fullAbu, seed);
  const run = initRun(fullAbu, seed, { decisions: [], legend: true });
  const grades: ClaimedGrade[] = [];
  while (!isFinished(run)) {
    const m = moments.find((x) => x.lap === run.state.lap + 1);
    if (m) {
      const grade = gradeMoment(run, m.options, m.target, SAMPLES);
      grades.push(claimGrade(run, m, grade, SAMPLES));
      answerMoment(run, m, m.options[1]?.id as string);
    }
    stepLap(run);
  }

  it('checks and grades the moments the Legend attempt was asked', () => {
    expect(moments.map((m) => m.id)).toContain('legend-vsc-35');
    expect(moments.map((m) => m.id)).not.toEqual(fullAbu.decisionMoments.map((m) => m.id));
    const claimed = verifyRun(fullAbu, seed, run.decisions, SAMPLES, grades, { legend: true });
    expect(claimed.moments.map((m) => m.momentId)).toEqual(moments.map((m) => m.id));
    const full = verifyRun(fullAbu, seed, run.decisions, SAMPLES, undefined, { legend: true });
    expect(full).toEqual(claimed);
  });

  it('refuses the Legend log as a normal run, and a normal log as Legend', () => {
    expect(() => verifyRun(fullAbu, seed, run.decisions, SAMPLES, grades)).toThrow(VerifyError);
    const normal = playDailyRace(fullAbu, seed, (m) => m.options[0]?.id as string, {
      samples: SAMPLES,
    });
    expect(() =>
      verifyRun(fullAbu, seed, normal.decisions, SAMPLES, normal.grades, {
        legend: true,
      }),
    ).toThrow(VerifyError);
  });
});

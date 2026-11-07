import type { DecisionMoment, RaceResult, RaceState } from '@laststint/sim';
import { describe, expect, it } from 'vitest';
import { NO_PLAN } from '../game/plans.js';
import { type GameState, type Phase, reducer } from './machine.js';

const race: RaceState = {
  lap: 34,
  flag: 'green',
  order: ['HAM', 'VER'],
  cars: {},
  teamOrders: { holdUp: false, swap: null },
};
const moment: DecisionMoment = {
  id: 'vsc-36',
  lap: 36,
  trigger: 'VSC',
  target: { kind: 'beat-rival' },
  options: [],
  realOptionId: null,
};
const result = {
  order: ['VER', 'HAM'],
  finishers: ['VER', 'HAM'],
  gaps: {},
  times: {},
} as unknown as RaceResult;

function base(phase: Phase): GameState {
  return {
    phase,
    speed: 1,
    race,
    moments: [moment],
    currentMoment: null,
    resolved: [],
    decisions: [],
    result: null,
    grades: {},
    submission: { status: 'none' },
    meta: {
      source: 'live',
      raceId: 'abu-dhabi-2021',
      date: '2021-12-12',
      totalLaps: 58,
      takeoverLap: 34,
      userSide: 'HAM',
      rival: 'VER',
    },
    radio: [],
    plan: NO_PLAN,
  };
}

describe('reducer', () => {
  it('START only leaves intro', () => {
    expect(reducer(base('intro'), { type: 'START' }).phase).toBe('planning');
    expect(reducer(base('racing'), { type: 'START' }).phase).toBe('racing');
    expect(reducer(base('results'), { type: 'START' }).phase).toBe('results');
  });

  it('SYNC resolves to finished / decision / racing', () => {
    const fin = reducer(base('racing'), {
      type: 'SYNC',
      race,
      moment: null,
      finished: true,
      result,
    });
    expect(fin.phase).toBe('finished');
    expect(fin.result).toBe(result);

    const dec = reducer(base('racing'), {
      type: 'SYNC',
      race,
      moment,
      finished: false,
      result: null,
    });
    expect(dec.phase).toBe('decision');
    expect(dec.currentMoment).toBe(moment);

    const run = reducer(base('decision'), {
      type: 'SYNC',
      race,
      moment: null,
      finished: false,
      result: null,
    });
    expect(run.phase).toBe('racing');
    expect(run.currentMoment).toBeNull();
  });

  it('SYNC is ignored outside racing/decision', () => {
    expect(
      reducer(base('intro'), { type: 'SYNC', race, moment, finished: false, result: null }).phase,
    ).toBe('intro');
  });

  it('RESOLVE records the moment and calls, only from decision, without duplicates', () => {
    const decisions = [{ lap: 36, kind: 'pit', compound: 'HARD' }] as GameState['decisions'];
    const after = reducer(base('decision'), { type: 'RESOLVE', momentId: 'vsc-36', decisions });
    expect(after.resolved).toEqual(['vsc-36']);
    expect(after.decisions).toBe(decisions);
    const again = reducer(after, { type: 'RESOLVE', momentId: 'vsc-36', decisions });
    expect(again.resolved).toEqual(['vsc-36']);
    expect(
      reducer(base('racing'), { type: 'RESOLVE', momentId: 'vsc-36', decisions }).resolved,
    ).toEqual([]);
  });

  it('CALL updates the run only while racing', () => {
    const decisions = [
      { lap: 40, kind: 'mode', key: 'pace', value: 'push' },
    ] as GameState['decisions'];
    expect(reducer(base('racing'), { type: 'CALL', race, decisions }).decisions).toBe(decisions);
    expect(reducer(base('decision'), { type: 'CALL', race, decisions }).decisions).toEqual([]);
  });

  it('SET_SPEED changes speed in any phase', () => {
    expect(reducer(base('racing'), { type: 'SET_SPEED', speed: 2 }).speed).toBe(2);
  });

  it('SUBMIT then RESULT only along finished -> submitting -> results', () => {
    const submitting = reducer(base('finished'), { type: 'SUBMIT' });
    expect(submitting.phase).toBe('submitting');
    expect(submitting.submission).toEqual({ status: 'sending' });
    const done = reducer(submitting, {
      type: 'RESULT',
      result,
      submission: { status: 'practice' },
    });
    expect(done.phase).toBe('results');
    expect(done.submission).toEqual({ status: 'practice' });
    expect(reducer(base('racing'), { type: 'SUBMIT' }).phase).toBe('racing');
    expect(
      reducer(base('finished'), { type: 'RESULT', result, submission: { status: 'practice' } })
        .phase,
    ).toBe('finished');
  });

  it('a failed submission can be retried from the results', () => {
    const failed = { ...base('results'), submission: { status: 'error', error: 'x' } as const };
    expect(reducer(failed, { type: 'SUBMIT' }).phase).toBe('submitting');
    expect(reducer(base('results'), { type: 'SUBMIT' }).phase).toBe('results');
  });

  it('GRADED stores a grade in any phase', () => {
    const graded = { grade: {} as never, claim: { momentId: 'm', probabilities: [1] } };
    const s = reducer(base('racing'), { type: 'GRADED', momentId: 'm', graded });
    expect(s.grades.m).toBe(graded);
  });

  it('HYDRATE replaces the whole state', () => {
    const target = base('decision');
    expect(reducer(base('intro'), { type: 'HYDRATE', state: target })).toBe(target);
  });
});

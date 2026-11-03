import type { CarState } from '@boxthislap/sim';
import { describe, expect, it } from 'vitest';
import { attitudeOf } from '../data/drivers.js';
import { type LiveCall, QUESTION, REFUSE, respond, roll } from './refusal.js';

const car = (tyreAge: number) => ({ tyreAge }) as CarState;
const box: LiveCall = { lap: 40, kind: 'pit', compound: 'SOFT' };
const hold: LiveCall = { lap: 40, kind: 'mode', key: 'battle', value: 'hold' };

function rates(call: LiveCall, age: number, attitude: Parameters<typeof respond>[4]) {
  const n = 4000;
  const count = { ok: 0, refuse: 0, question: 0 };
  for (let seed = 0; seed < n; seed++) count[respond(seed, 40, call, car(age), attitude).kind]++;
  return { ok: count.ok / n, refuse: count.refuse / n, question: count.question / n };
}

describe('driver answers', () => {
  it('rolls in [0, 1) and is deterministic', () => {
    expect(roll('a')).toBe(roll('a'));
    expect(roll('a')).not.toBe(roll('b'));
    for (const s of ['', 'x', '64|40|pit:SOFT']) {
      expect(roll(s)).toBeGreaterThanOrEqual(0);
      expect(roll(s)).toBeLessThan(1);
    }
  });

  it('gives the same answer to the same call on the same lap', () => {
    for (let lap = 34; lap < 58; lap++) {
      expect(respond(64, lap, box, car(20), 'questions')).toEqual(
        respond(64, lap, box, car(20), 'questions'),
      );
    }
  });

  it('an always-listens driver does every call', () => {
    expect(rates(box, 2, 'always').ok).toBe(1);
  });

  it('a sometimes-listens driver refuses about one in four, more with a reason', () => {
    const r = rates(box, 20, 'sometimes');
    expect(r.refuse).toBeGreaterThan(REFUSE.sometimes[0] - 0.03);
    expect(r.refuse).toBeLessThan(REFUSE.sometimes[0] + 0.03);
    expect(r.question).toBe(0);
    expect(rates(box, 2, 'sometimes').refuse).toBeGreaterThan(0.45);
  });

  it('a questions driver mostly asks rather than refuses', () => {
    const r = rates(box, 20, 'questions');
    expect(r.refuse).toBeLessThan(REFUSE.questions[0] + 0.02);
    expect(r.question).toBeGreaterThan(QUESTION[0] - 0.03);
    expect(r.question).toBeLessThan(QUESTION[0] + 0.03);
    expect(rates(box, 2, 'questions').question).toBeGreaterThan(0.55);
    // Routine calls aren't questioned.
    expect(rates(hold, 20, 'questions').question).toBe(0);
  });

  it('says why when the tyres are new', () => {
    const seed = Array.from({ length: 200 }, (_, i) => i).find(
      (s) => respond(s, 40, box, car(2), 'questions').kind === 'question',
    );
    const r = respond(seed as number, 40, box, car(2), 'questions');
    expect(r.kind === 'question' && r.text).toMatch(/brand new/);
  });

  it('HAM listens with questions', () => {
    expect(attitudeOf('HAM')).toBe('questions');
    expect(attitudeOf('BOT')).toBe('always');
  });
});

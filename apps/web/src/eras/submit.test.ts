import type { RivalChoice } from '@laststint/sim';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api.js';
import type { RunSubmission } from '../data/api.js';
import { reducer } from '../state/machine.js';
import type { EraDaily } from './EraProvider.js';
import type { AttemptSubmission, ErasApi } from './api.js';
import { memoryStorage } from './difficulty/memoryStorage.test-util.js';
import { attemptUntimed, markUntimed } from './difficulty/untimed.js';
import { attemptResult } from './erasFixture.js';
import { mockErasApi } from './mockErasApi.js';
import { type FinishedAttempt, attemptBody, submitAttempt, submitFailure } from './submit.js';

const RUN: RunSubmission = {
  date: 'eras:att-1',
  anonId: '',
  decisions: [{ lap: 35, kind: 'radio', momentId: 'vsc', optionId: 'stay', at: 34 }],
  grades: [{ momentId: 'vsc', probabilities: [0.4, 0.3] }],
};
const CHOICES: RivalChoice[] = [{ lap: 40, option: 'box-now' }];

const game: FinishedAttempt = { submission: async () => RUN, rivalChoices: () => CHOICES };

function attempt(edit: Partial<EraDaily> = {}): EraDaily {
  return {
    date: 'eras:att-1',
    raceId: 'abu-dhabi-2021',
    seed: 7,
    model: {} as EraDaily['model'],
    source: 'eras',
    attemptId: 'att-1',
    legend: false,
    difficulty: {
      accuracyThreshold: 72,
      information: 'full',
      rivalPolicy: 'standard',
      decisionTimerSeconds: 45,
    },
    draft: false,
    ...edit,
  };
}

/** An API whose submit answers in turn from `answers` (an Error is thrown). */
function api(...answers: unknown[]) {
  const sent: Array<{ id: string; body: AttemptSubmission }> = [];
  const client: ErasApi = {
    ...mockErasApi,
    submitAttempt: async (id, body) => {
      sent.push({ id, body });
      const a = answers.shift();
      if (a instanceof Error) throw a;
      return a as ReturnType<typeof attemptResult>;
    },
  };
  return { client, sent };
}

beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));
afterEach(() => vi.unstubAllGlobals());

describe('the Eras submit body', () => {
  it('sends the calls, the claimed grades and the untimed mark', async () => {
    expect(await attemptBody(game, attempt(), false)).toEqual({
      decisions: RUN.decisions,
      grades: RUN.grades,
      untimed: false,
    });
  });

  it('adds the Expert rival’s choices and the pinned model hash', async () => {
    const expert = attempt({
      difficulty: { ...attempt().difficulty, rivalPolicy: 'expert' },
      modelHash: 'abc',
    });
    expect(await attemptBody(game, expert, true)).toEqual({
      decisions: RUN.decisions,
      grades: RUN.grades,
      untimed: true,
      rivalClaims: CHOICES,
      modelHash: 'abc',
    });
  });
});

describe('submitAttempt', () => {
  it('posts to the attempt and shows the server’s stars', async () => {
    const result = attemptResult();
    const { client, sent } = api(result);
    markUntimed('att-1');
    expect(await submitAttempt(game, attempt(), client)).toEqual({ status: 'eras-done', result });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ id: 'att-1', body: { untimed: true } });
    // Submitted: the untimed mark is done with.
    expect(attemptUntimed('att-1')).toBe(false);
  });

  it('sends once more when the request failed in transit', async () => {
    const result = attemptResult();
    const net = api(new TypeError('Failed to fetch'), result);
    expect(await submitAttempt(game, attempt(), net.client)).toMatchObject({ status: 'eras-done' });
    expect(net.sent).toHaveLength(2);
    const server = api(new ApiError(500, 'http-error'), result);
    expect(await submitAttempt(game, attempt(), server.client)).toMatchObject({
      status: 'eras-done',
    });
    expect(server.sent).toHaveLength(2);
  });

  it('gives up after a second transit failure, with a retry, keeping the untimed mark', async () => {
    const { client, sent } = api(new TypeError('x'), new TypeError('x'));
    markUntimed('att-1');
    const out = await submitAttempt(game, attempt(), client);
    expect(out).toMatchObject({ status: 'error', error: expect.stringContaining('Can’t reach') });
    expect(out).not.toHaveProperty('retry', false);
    expect(sent).toHaveLength(2);
    expect(attemptUntimed('att-1')).toBe(true);
  });

  it.each([
    [501, 'rival-unavailable'],
    [503, 'race-not-ready'],
    [409, 'model-changed'],
    [409, 'attempt-expired'],
    [409, 'already-submitted'],
    [400, 'bad-grades'],
  ])('doesn’t resend a deliberate %i %s', async (status, code) => {
    const { client, sent } = api(new ApiError(status, code));
    await submitAttempt(game, attempt(), client);
    expect(sent).toHaveLength(1);
  });
});

describe('what each failure tells the player', () => {
  const fail = (status: number, code: string) => submitFailure(new ApiError(status, code));

  it('501 rival-unavailable: the calls are kept, stars to follow', () => {
    expect(fail(501, 'rival-unavailable')).toEqual({
      status: 'eras-held',
      message: expect.stringContaining('Your calls are saved'),
    });
  });

  it('503 race-not-ready: no stars on this race yet, no retry', () => {
    expect(fail(503, 'race-not-ready')).toMatchObject({
      status: 'error',
      retry: false,
      error: expect.stringContaining('can’t award stars yet'),
    });
  });

  it('409 model-changed and attempt-expired: start a new attempt, no retry', () => {
    for (const code of ['model-changed', 'attempt-expired']) {
      expect(fail(409, code)).toMatchObject({
        status: 'error',
        retry: false,
        error: expect.stringContaining('Start a new attempt'),
      });
    }
    expect(fail(409, 'attempt-expired')).toMatchObject({
      error: expect.stringContaining('24 hours'),
    });
    expect(fail(409, 'model-changed')).toMatchObject({ error: expect.stringContaining('updated') });
  });

  it('409 already-submitted: the stars are on the era page', () => {
    expect(fail(409, 'already-submitted')).toEqual({
      status: 'eras-held',
      message: expect.stringContaining('already submitted'),
    });
  });

  it('404 no-attempt and 400 verification failures: no retry', () => {
    expect(fail(404, 'no-attempt')).toMatchObject({ status: 'error', retry: false });
    expect(fail(400, 'bad-decisions')).toMatchObject({
      status: 'error',
      retry: false,
      error: expect.stringContaining('bad-decisions'),
    });
  });

  it('429 and server errors: retry', () => {
    expect(fail(429, 'rate-limited')).toEqual({
      status: 'error',
      error: expect.stringContaining('Wait a moment'),
    });
    expect(fail(502, 'http-error')).toEqual({
      status: 'error',
      error: expect.stringContaining('server had a problem'),
    });
    expect(submitFailure(new TypeError('Failed to fetch'))).toEqual({
      status: 'error',
      error: expect.stringContaining('Can’t reach the server'),
    });
  });

  it('only a retryable error can be submitted again from the results', () => {
    const at = (submission: Parameters<typeof reducer>[0]['submission']) =>
      reducer({ phase: 'results', submission } as Parameters<typeof reducer>[0], {
        type: 'SUBMIT',
      }).phase;
    expect(at({ status: 'error', error: 'x' })).toBe('submitting');
    expect(at({ status: 'error', error: 'x', retry: false })).toBe('results');
    expect(at({ status: 'eras-held', message: 'x' })).toBe('results');
  });
});

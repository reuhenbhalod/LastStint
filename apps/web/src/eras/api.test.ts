import { describe, expect, it } from 'vitest';
import { canStartWith, erasApi, erasClient, erasMockOn } from './api.js';
import { httpErasApi } from './httpErasApi.js';
import { mockCanStart, mockErasApi } from './mockErasApi.js';

describe('which Eras API the app uses', () => {
  it('is the Worker by default, the mock only with VITE_ERAS_MOCK=1', () => {
    expect(erasMockOn({})).toBe(false);
    expect(erasMockOn({ VITE_ERAS_MOCK: '0' })).toBe(false);
    expect(erasMockOn({ VITE_ERAS_MOCK: '1' })).toBe(true);
    // The test run sets no flag: the app's client is the HTTP one.
    expect(erasApi).toBe(httpErasApi);
  });

  it('can start any race on the Worker (it refuses what it must), bundled ones on the mock', () => {
    const real = erasClient(false);
    expect(real.api).toBe(httpErasApi);
    expect(real.canStart('monaco-1988')).toBe(true);
    const mock = erasClient(true);
    expect(mock.api).toBe(mockErasApi);
    expect(mock.canStart).toBe(mockCanStart);
    expect(mock.canStart('monaco-1988')).toBe(false);
    expect(canStartWith(httpErasApi)('monaco-1988')).toBe(true);
    expect(canStartWith(mockErasApi)).toBe(mockCanStart);
  });
});

describe('the mock’s submit (VITE_ERAS_MOCK=1)', () => {
  it('refuses an unknown attempt, and a race without its Eras objectives yet', async () => {
    await expect(
      mockErasApi.submitAttempt('nope', { decisions: [], grades: [], untimed: false }),
    ).rejects.toMatchObject({ status: 404, code: 'no-attempt' });
    const { attemptId } = await mockErasApi.startAttempt({
      raceId: 'abu-dhabi-2021',
      legend: false,
    });
    // No bundled race has its Eras target and mastery yet: the Worker's 503, as on the server.
    await expect(
      mockErasApi.submitAttempt(attemptId, { decisions: [], grades: [], untimed: false }),
    ).rejects.toMatchObject({ status: 503, code: 'race-not-ready' });
    expect(await mockErasApi.raceStats('abu-dhabi-2021')).toEqual({});
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { blockedStorage, memoryStorage } from './memoryStorage.test-util.js';
import { setTimerOn, timerOn } from './settings.js';

describe('decision timer setting', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is on by default and remembers being turned off and on', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    expect(timerOn()).toBe(true);
    setTimerOn(false);
    expect(timerOn()).toBe(false);
    expect(localStorage.getItem('pitwall.decisionTimer')).toBe('off');
    setTimerOn(true);
    expect(timerOn()).toBe(true);
  });

  it('stays on, without throwing, when storage is blocked', () => {
    vi.stubGlobal('localStorage', blockedStorage());
    expect(() => setTimerOn(false)).not.toThrow();
    expect(timerOn()).toBe(true);
  });
});

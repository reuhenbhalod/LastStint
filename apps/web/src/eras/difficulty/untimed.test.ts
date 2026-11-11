import { afterEach, describe, expect, it, vi } from 'vitest';
import { blockedStorage, memoryStorage } from './memoryStorage.test-util.js';
import { attemptUntimed, clearUntimed, markUntimed, noteDecisionShown } from './untimed.js';

describe('untimed attempts', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('marks an attempt untimed only when a decision shows with the timer off', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    expect(noteDecisionShown('att-1', true)).toBe(false);
    expect(attemptUntimed('att-1')).toBe(false);
    expect(noteDecisionShown('att-1', false)).toBe(true);
    expect(attemptUntimed('att-1')).toBe(true);
    // Once: later decisions, timed or not, don't mark it again, and nothing un-marks it.
    expect(noteDecisionShown('att-1', false)).toBe(false);
    expect(noteDecisionShown('att-1', true)).toBe(false);
    expect(attemptUntimed('att-1')).toBe(true);
    expect(attemptUntimed('att-2')).toBe(false);
  });

  it('survives a reload (kept in storage) and clears', () => {
    const storage = memoryStorage();
    vi.stubGlobal('localStorage', storage);
    markUntimed('att-3');
    expect(storage.getItem('pitwall:eras-untimed:att-3')).toBe('1');
    clearUntimed('att-3');
    expect(attemptUntimed('att-3')).toBe(false);
    storage.setItem('pitwall:eras-untimed:att-4', '1'); // marked before a reload
    expect(attemptUntimed('att-4')).toBe(true);
  });

  it('keeps the mark for the page when storage is blocked', () => {
    vi.stubGlobal('localStorage', blockedStorage());
    expect(() => markUntimed('att-5')).not.toThrow();
    expect(attemptUntimed('att-5')).toBe(true);
    clearUntimed('att-5');
    expect(attemptUntimed('att-5')).toBe(false);
  });

  it('needs an attempt id', () => {
    expect(() => markUntimed('')).toThrow();
    expect(() => attemptUntimed('')).toThrow();
  });
});

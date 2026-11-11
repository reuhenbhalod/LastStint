import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Countdown, timerAnnouncement } from './countdown.js';

describe('Countdown', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const make = (key: string, seconds: number) => {
    const ticks: number[] = [];
    const onExpire = vi.fn();
    const c = new Countdown({
      key,
      seconds,
      onTick: (s) => ticks.push(s),
      onExpire,
      now: Date.now,
    });
    return { c, ticks, onExpire };
  };

  it('counts whole seconds down and expires once at zero', () => {
    const { c, ticks, onExpire } = make('a:1', 3);
    c.start();
    expect(ticks).toEqual([3]);
    vi.advanceTimersByTime(1000);
    expect(ticks).toEqual([3, 2]);
    vi.advanceTimersByTime(1000);
    expect(onExpire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(ticks).toEqual([3, 2, 1, 0]);
    expect(onExpire).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5000);
    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('runs the difficulty’s full time (45 s)', () => {
    const { c, onExpire } = make('a:45', 45);
    c.start();
    vi.advanceTimersByTime(44_900);
    expect(onExpire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('stopped, keeps the moment’s time left and resumes from it', () => {
    const first = make('a:resume', 20);
    first.c.start();
    vi.advanceTimersByTime(12_000);
    first.c.stop();
    expect(Countdown.remaining('a:resume', 20)).toBeCloseTo(8, 1);
    vi.advanceTimersByTime(60_000); // away on the home page: the race (and the timer) hold
    expect(first.onExpire).not.toHaveBeenCalled();
    const again = make('a:resume', 20);
    again.c.start();
    expect(again.ticks).toEqual([8]);
    vi.advanceTimersByTime(8_000);
    expect(again.onExpire).toHaveBeenCalledTimes(1);
    expect(Countdown.remaining('a:resume', 20)).toBe(20); // done: nothing kept
  });

  it('keeps no time for a moment that was answered before it started', () => {
    expect(Countdown.remaining('never', 30)).toBe(30);
  });

  it('rejects a non-positive time', () => {
    expect(() => make('bad', 0)).toThrow(RangeError);
    expect(() => make('bad', Number.NaN)).toThrow(RangeError);
  });
});

describe('timerAnnouncement', () => {
  it('says the time at the start, then at 10 and 5 seconds, and nothing in between', () => {
    expect(timerAnnouncement(45, true)).toBe('45 seconds to make the call.');
    expect(timerAnnouncement(17, true)).toBe('17 seconds to make the call.');
    expect(timerAnnouncement(44, false)).toBeNull();
    expect(timerAnnouncement(10, false)).toBe('10 seconds left.');
    expect(timerAnnouncement(5, false)).toBe('5 seconds left.');
    expect(timerAnnouncement(3, false)).toBeNull();
  });
});

// The decision timer's clock (eras spec §7), apart from React so it can be tested with fake
// timers. It counts whole seconds down from the difficulty's timer and calls `onExpire` once
// when it runs out. Stopping it (the call was made, or the race screen closed for the home
// page, which holds the race) keeps what's left for that moment, so coming back resumes the
// countdown rather than starting it over.

/** How often the clock checks the time (the number shown changes once a second). */
const CHECK_MS = 200;

// Seconds left on the moments stopped mid-countdown, by moment key.
const left = new Map<string, number>();

export interface CountdownOptions {
  /** The moment this is (attempt and moment id): its time left is kept by this key. */
  key: string;
  /** The full time, in seconds (the difficulty's `decisionTimerSeconds`). */
  seconds: number;
  /** The whole seconds left, each time it changes (and once at the start). */
  onTick: (secondsLeft: number) => void;
  onExpire: () => void;
  now?: () => number;
}

export class Countdown {
  private readonly opts: CountdownOptions;
  private readonly now: () => number;
  private deadline = 0;
  private shown = -1;
  private id: ReturnType<typeof setInterval> | null = null;
  private done = false;

  constructor(opts: CountdownOptions) {
    if (!Number.isFinite(opts.seconds) || opts.seconds <= 0)
      throw new RangeError(`Countdown: seconds must be positive, got ${opts.seconds}`);
    this.opts = opts;
    this.now = opts.now ?? (() => performance.now());
  }

  /** The time a moment has left (the full time if it never started or ran out). */
  static remaining(key: string, seconds: number): number {
    return left.get(key) ?? seconds;
  }

  start(): void {
    if (this.id !== null || this.done) return;
    const from = Countdown.remaining(this.opts.key, this.opts.seconds);
    this.deadline = this.now() + from * 1000;
    this.check();
    if (!this.done) this.id = setInterval(() => this.check(), CHECK_MS);
  }

  /** Stop counting; the time left is kept for the moment's key. */
  stop(): void {
    if (this.id === null) return;
    clearInterval(this.id);
    this.id = null;
    if (!this.done) left.set(this.opts.key, Math.max(0, (this.deadline - this.now()) / 1000));
  }

  private check(): void {
    const ms = this.deadline - this.now();
    const secs = Math.max(0, Math.ceil(ms / 1000));
    if (secs !== this.shown) {
      this.shown = secs;
      this.opts.onTick(secs);
    }
    if (ms > 0) return;
    this.done = true;
    left.delete(this.opts.key);
    if (this.id !== null) clearInterval(this.id);
    this.id = null;
    this.opts.onExpire();
  }
}

/** What the timer says to a screen reader: the time left when it first shows (the full time,
 * or what's left on a resumed moment), then at 10 and 5 seconds left; not every second, which
 * would drown out the call. Null in between. */
export function timerAnnouncement(secondsLeft: number, first: boolean): string | null {
  if (first) return `${secondsLeft} seconds to make the call.`;
  if (secondsLeft === 10 || secondsLeft === 5) return `${secondsLeft} seconds left.`;
  return null;
}

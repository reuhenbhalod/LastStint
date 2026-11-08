// The decision timer on an Eras call (eras spec §7): the seconds left as a number (never
// colour alone), a bar that empties (decorative), and a screen reader line at the start and
// at 10 and 5 seconds left. With reduced motion the bar steps instead of sliding (the
// stylesheet stops transitions). When it runs out, `onExpire` takes the default option.

import { useEffect, useRef, useState } from 'react';
import { Countdown, timerAnnouncement } from './countdown.js';

/** Seconds left at which the timer turns urgent (the word "Hurry" shows, not just colour). */
const URGENT = 10;

export function DecisionTimer({
  momentKey,
  seconds,
  onExpire,
}: {
  /** The moment (attempt and moment id): its time left survives leaving the screen. */
  momentKey: string;
  seconds: number;
  onExpire: () => void;
}) {
  const [left, setLeft] = useState(() => Math.ceil(Countdown.remaining(momentKey, seconds)));
  const [said, setSaid] = useState('');
  const expire = useRef(onExpire);
  expire.current = onExpire;

  useEffect(() => {
    let first = true;
    const c = new Countdown({
      key: momentKey,
      seconds,
      onTick: (s) => {
        setLeft(s);
        const line = timerAnnouncement(s, first);
        first = false;
        if (line) setSaid(line);
      },
      onExpire: () => expire.current(),
    });
    c.start();
    return () => c.stop();
  }, [momentKey, seconds]);

  const urgent = left <= URGENT;
  return (
    <div className="flex items-center gap-2">
      <div
        role="timer"
        aria-label={`Time to make the call: ${left} seconds`}
        className={`flex items-baseline gap-1 rounded px-2 py-0.5 ${urgent ? 'bg-[var(--box)] text-white' : 'bg-[#1A1F1D] text-[#EEF1EF]'}`}
      >
        <span className="text-[10px] font-bold uppercase tracking-[0.12em]">
          {urgent ? 'Hurry' : 'Time'}
        </span>
        <span className="mono text-[15px] font-bold tabular-nums">{left}</span>
        <span className="text-[11px] font-semibold">s</span>
      </div>
      <span
        aria-hidden="true"
        className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-[#262C2A] sm:block"
      >
        <span
          className={`block h-full transition-[width] duration-1000 ease-linear motion-reduce:transition-none ${urgent ? 'bg-[var(--box)]' : 'bg-[#EEF1EF]'}`}
          style={{ width: `${(left / seconds) * 100}%` }}
        />
      </span>
      <span className="sr-only" aria-live="polite">
        {said}
      </span>
    </div>
  );
}

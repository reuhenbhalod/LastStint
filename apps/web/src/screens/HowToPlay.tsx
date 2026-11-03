// How to play (feedback round 2, A4): a short walkthrough over the daily card. It opens by
// itself on a player's first visit, and "How to play" reopens it. Remembered per browser; if
// storage is blocked it just shows again next time.

import { useEffect, useState } from 'react';

const SEEN = 'pitwall:how-to-play';

export function seenHowToPlay(): boolean {
  try {
    return localStorage.getItem(SEEN) === '1';
  } catch {
    return false;
  }
}

function markSeen(): void {
  try {
    localStorage.setItem(SEEN, '1');
  } catch {
    // ignore: storage blocked
  }
}

interface Step {
  title: string;
  body: string[];
}

function steps(team: string, user: string, rival: string, realPos: number, laps: number): Step[] {
  return [
    {
      title: `You’re the ${team} team manager`,
      body: [
        `A real race, as it really was, until you take over the pit wall with ${laps} laps to go.`,
        `Your goal: finish ahead of ${rival}${realPos ? `, and do better than the real ${team} pit wall did (P${realPos})` : ''}.`,
      ],
    },
    {
      title: 'Watch the race',
      body: [
        'Laps tick by on their own. Every car is a dot on the map; the ring is its tyre. Tap any car for its details.',
        `${user} is your driver, ${rival} is your rival. Go 2× if you want it quicker.`,
      ],
    },
    {
      title: 'Make the big calls',
      body: [
        'At the key moments the race stops and the radio asks you: box or stay out, which tyres, push or manage, attack or defend.',
        'Each option says what it does. Pick one and the race carries on.',
      ],
    },
    {
      title: 'Quick calls and your controls',
      body: [
        'Between the big calls the radio asks quick questions. Answer before the timer runs out.',
        'BOX (under the map) and the headset (on the map: pace, battle, ERS, fuel) are always yours. Drivers don’t always listen: each one ignores a share of calls, from their real team-radio history.',
      ],
    },
    {
      title: 'How you’re graded',
      body: [
        'At each big call the simulator plays every option hundreds of times. Your call is graded against the best one, not on luck.',
        '🟩 best call · 🟨 close · 🟧 costly · 🟥 big miss. One race a day; come back tomorrow to build your streak.',
      ],
    },
  ];
}

export function HowToPlay({
  team,
  user,
  rival,
  realPos,
  laps,
  onClose,
}: {
  team: string;
  user: string;
  rival: string;
  realPos: number;
  laps: number;
  onClose: () => void;
}) {
  const all = steps(team, user, rival, realPos, laps);
  const [i, setI] = useState(0);
  const step = all[i] as Step;
  const last = i === all.length - 1;
  const close = () => {
    markSeen();
    onClose();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <dialog
        open
        aria-labelledby="how-to-play-title"
        className="relative m-0 flex w-full max-w-md flex-col gap-4 rounded-2xl border border-[var(--rule)] bg-[var(--card)] p-5 text-[var(--ink)] shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <span className="eyebrow">
            How to play · {i + 1} of {all.length}
          </span>
          <button
            type="button"
            onClick={close}
            className="text-[13px] text-[var(--muted)] underline hover:text-[var(--ink)]"
          >
            Skip
          </button>
        </div>
        <h2 id="how-to-play-title" className="disp m-0 text-[24px] leading-none">
          {step.title}
        </h2>
        {step.body.map((p) => (
          <p key={p} className="m-0 text-[15px] leading-relaxed text-[var(--muted)]">
            {p}
          </p>
        ))}
        <div className="flex justify-center gap-1.5" aria-hidden="true">
          {all.map((s, k) => (
            <span
              key={s.title}
              className={`h-1.5 rounded-full transition-all ${k === i ? 'w-6 bg-[var(--you)]' : 'w-1.5 bg-[var(--rule)]'}`}
            />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setI(i - 1)}
            disabled={i === 0}
            className="rounded-lg border border-[var(--rule)] py-2.5 font-semibold text-[var(--muted)] disabled:opacity-30"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => (last ? close() : setI(i + 1))}
            className="rounded-lg bg-[var(--you)] py-2.5 font-bold text-[#08231f]"
          >
            {last ? 'Got it' : 'Next'}
          </button>
        </div>
      </dialog>
    </div>
  );
}

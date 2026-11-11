// How to play: a short walkthrough over the daily card. It opens every time the daily card
// shows (Skip closes it), and "How to play" reopens it.

import { useEffect, useState } from 'react';
import { surname } from '../data/names.js';

interface Step {
  title: string;
  body: string[];
}

function steps(
  team: string,
  user: string,
  rival: string,
  realPos: number,
  laps: number,
  goal: string,
): Step[] {
  return [
    {
      title: `You’re ${user}’s race engineer`,
      body: [
        `A real race, as it really was, until you take over ${user}’s radio at ${team} with ${laps} laps to go.`,
        `Your goal: ${goal}${realPos ? `, and do better than the real ${team} pit wall did (P${realPos})` : ''}.`,
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
      title: 'Run the car, lap by lap',
      body: [
        'Between the big calls the radio keeps coming: a car within a second and a half means a battle: the race stops at the braking zone while you pick a line (cover the inside, go round the outside, wait for DRS), and there’s damage, track limits, lapped cars, and your driver asking for things. Answer before the timer runs out, or he decides himself.',
        'BOX and the team radio (pace, battle, ERS, fuel) are always yours.',
      ],
    },
    {
      title: 'Keep your driver on side',
      body: [
        'Your driver’s trust in you rises when your calls work and drops when they don’t: a failed dive, contact, letting the rival go, saying no when he was right.',
        'Calm, he listens. Frustrated, he overdrives and makes mistakes. Furious, he ignores you and races his own way.',
      ],
    },
    {
      title: 'How you’re graded',
      body: [
        'At each big call the simulator plays every option hundreds of times. Your call is graded against the best one, not on luck.',
        'Each call gets a grade: best call, close, costly or big miss. One race a day; come back tomorrow to build your streak.',
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
  goal,
  onClose,
}: {
  team: string;
  user: string;
  rival: string;
  realPos: number;
  laps: number;
  /** What you race for, as a phrase ("finish ahead of VER"). */
  goal: string;
  onClose: () => void;
}) {
  const all = steps(team, surname(user), surname(rival), realPos, laps, goal);
  const [i, setI] = useState(0);
  const step = all[i] as Step;
  const last = i === all.length - 1;
  const close = onClose;
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
        {last && (
          <a
            href="/tutorial"
            className="rounded-lg border border-[var(--you)] py-2.5 text-center font-bold text-[var(--you)] hover:bg-[color-mix(in_srgb,var(--you)_12%,transparent)]"
          >
            Play the tutorial race (5 min)
          </a>
        )}
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
            className="rounded-lg bg-[var(--you)] py-2.5 font-bold text-[var(--you-ink)]"
          >
            {last ? 'Got it' : 'Next'}
          </button>
        </div>
      </dialog>
    </div>
  );
}

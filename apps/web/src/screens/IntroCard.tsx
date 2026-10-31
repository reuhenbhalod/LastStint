// The daily card: what race, which side, how long, the situation, and Start.

import type { RaceModel } from '@boxthislap/sim';
import type { GameState } from '../state/machine.js';

export function IntroCard({
  state,
  model,
  onStart,
  onHelp,
}: {
  state: GameState;
  model: RaceModel;
  onStart: () => void;
  onHelp: () => void;
}) {
  const { userSide, rival, takeoverLap, totalLaps, number, source, practiceReason } = state.meta;
  const lapsLeft = totalLaps - takeoverLap;
  const userTeam = model.drivers.find((d) => d.code === userSide)?.team;
  const me = state.race.cars[userSide];
  const them = state.race.cars[rival];
  const gap = me && them ? them.totalTime - me.totalTime : null;
  const situation =
    gap === null
      ? null
      : `${gap >= 0 ? `${userSide} leads ${rival} by ${gap.toFixed(1)}s` : `${rival} leads ${userSide} by ${(-gap).toFixed(1)}s`}${
          me && them && me.compound === them.compound && me.tyreAge === them.tyreAge
            ? `, both on ${me.tyreAge}-lap-old ${me.compound.toLowerCase()}s`
            : ''
        }.`;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      {source === 'practice' && (
        <p className="rounded-lg border border-yellow-700/60 bg-yellow-950/40 p-3 text-sm text-yellow-200">
          {practiceReason ?? 'Practice mode.'} You can play a practice run; it won’t be submitted.
        </p>
      )}
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-neutral-500">
          {number ? `Daily Race #${number}` : 'Daily Race'}
        </p>
        <h1 className="mt-1 text-3xl font-bold leading-tight">
          {model.race.name ?? model.race.id}
        </h1>
      </div>
      <dl className="grid grid-cols-2 gap-3 font-mono text-sm">
        <div className="rounded-lg bg-neutral-900 p-3">
          <dt className="text-xs uppercase tracking-wide text-neutral-500">You run</dt>
          <dd className="text-lg font-bold text-sky-300">
            {userSide} {userTeam ? `· ${userTeam}` : ''}
          </dd>
        </div>
        <div className="rounded-lg bg-neutral-900 p-3">
          <dt className="text-xs uppercase tracking-wide text-neutral-500">Laps left</dt>
          <dd className="text-lg font-bold">{lapsLeft}</dd>
        </div>
      </dl>
      {situation && <p className="font-mono text-sm text-neutral-300">{situation}</p>}
      <p className="text-neutral-400">
        Beat <span className="font-semibold text-orange-300">{rival}</span> to the flag. Make the
        calls; every one is graded.
      </p>
      <button
        type="button"
        onClick={onStart}
        className="rounded-xl bg-sky-500 py-4 text-lg font-bold text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
      >
        Take the pit wall
      </button>
      <footer className="flex justify-center gap-4 text-xs text-neutral-500">
        <button type="button" onClick={onHelp} className="underline">
          How it works
        </button>
        <span>Not affiliated with Formula 1.</span>
      </footer>
    </main>
  );
}

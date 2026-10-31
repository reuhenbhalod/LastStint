// The daily card: what race, which side, how long, and Start.

import type { RaceModel } from '@boxthislap/sim';
import type { GameState } from '../state/machine.js';

export function IntroCard({
  state,
  model,
  onStart,
}: {
  state: GameState;
  model: RaceModel;
  onStart: () => void;
}) {
  const lapsLeft = state.meta.totalLaps - state.meta.takeoverLap;
  const userTeam = model.drivers.find((d) => d.code === state.meta.userSide)?.team;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-neutral-500">Daily Race</p>
        <h1 className="mt-1 text-3xl font-bold leading-tight">
          {model.race.name ?? model.race.id}
        </h1>
      </div>
      <dl className="grid grid-cols-2 gap-3 font-mono text-sm">
        <div className="rounded-lg bg-neutral-900 p-3">
          <dt className="text-xs uppercase tracking-wide text-neutral-500">You run</dt>
          <dd className="text-lg font-bold text-sky-300">
            {state.meta.userSide} {userTeam ? `· ${userTeam}` : ''}
          </dd>
        </div>
        <div className="rounded-lg bg-neutral-900 p-3">
          <dt className="text-xs uppercase tracking-wide text-neutral-500">Laps left</dt>
          <dd className="text-lg font-bold">{lapsLeft}</dd>
        </div>
      </dl>
      <p className="text-neutral-400">
        Beat <span className="font-semibold text-orange-300">{state.meta.rival}</span> to the flag.
        Make the calls; every one is graded.
      </p>
      <button
        type="button"
        onClick={onStart}
        className="rounded-xl bg-sky-500 py-4 text-lg font-bold text-neutral-950"
      >
        Take the pit wall
      </button>
      <footer className="text-center text-[10px] text-neutral-600">
        Not affiliated with Formula 1.
      </footer>
    </main>
  );
}

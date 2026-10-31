// End of race: classification and the user's finishing position. Grades, percentile, persona
// and the share card land in 3.5; this is the plain result for now.

import type { GameState } from '../state/machine.js';

export function ResultScreen({
  state,
  onSubmit,
  onReset,
}: {
  state: GameState;
  onSubmit: () => void;
  onReset: () => void;
}) {
  const order = state.result?.order ?? state.race.order;
  const gaps = state.result?.gaps ?? {};
  const { userSide } = state.meta;
  const pos = order.indexOf(userSide) + 1;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-5 p-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-neutral-500">
          Chequered flag
        </p>
        <h1 className="mt-1 text-3xl font-bold">You finished P{pos || '—'}</h1>
      </div>

      <ol className="flex flex-col gap-0.5 font-mono text-sm">
        {order.slice(0, 10).map((code, i) => (
          <li
            key={code}
            className={`flex justify-between rounded px-2 py-1 ${
              code === userSide ? 'bg-sky-500/20 text-sky-200' : 'bg-neutral-900'
            }`}
          >
            <span>
              <span className="mr-2 text-neutral-500">{i + 1}</span>
              {code}
            </span>
            <span className="text-neutral-400">
              {i === 0 ? '—' : gaps[code] != null ? `+${gaps[code]?.toFixed(1)}` : ''}
            </span>
          </li>
        ))}
      </ol>

      {state.phase === 'finished' && (
        <button
          type="button"
          onClick={onSubmit}
          className="rounded-xl bg-sky-500 py-4 text-lg font-bold text-neutral-950"
        >
          See how you did
        </button>
      )}
      {(state.phase === 'submitting' || state.phase === 'results') && (
        <p className="text-center text-neutral-400">
          Call grades, percentile and the share card arrive in the next step.
        </p>
      )}

      <button
        type="button"
        onClick={onReset}
        className="rounded-xl border border-neutral-700 py-3 font-semibold text-neutral-300"
      >
        Play again
      </button>
    </main>
  );
}

// The race view: timing tower + the user's controls, with the decision overlay when paused.

import type { RaceModel } from '@boxthislap/sim';
import { BoxButton } from '../components/BoxButton.js';
import { DecisionModal } from '../components/DecisionModal.js';
import { HeadsetPanel } from '../components/HeadsetPanel.js';
import { LapClock } from '../components/LapClock.js';
import { SpeedControl } from '../components/SpeedControl.js';
import { TimingTower } from '../components/TimingTower.js';
import { TyreBadge } from '../components/TyreBadge.js';
import type { Game } from '../game/useGame.js';
import type { GameState } from '../state/machine.js';

export function RaceScreen({
  game,
  state,
  model,
}: { game: Game; state: GameState; model: RaceModel }) {
  const { userSide, rival } = state.meta;
  const me = state.race.cars[userSide];
  const rivalCar = state.race.cars[rival];
  const paused = state.phase === 'decision';
  const compounds = Object.keys(model.compounds);

  const toRival =
    me && rivalCar && !me.retired && !rivalCar.retired ? me.totalTime - rivalCar.totalTime : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-4">
      <header className="flex flex-col gap-2">
        <LapClock lap={state.race.lap} total={state.meta.totalLaps} flag={state.race.flag} />
        <div className="flex items-center justify-between">
          {toRival !== null ? (
            <p className="font-mono text-sm">
              <span className="text-orange-300">{rival}</span>{' '}
              <span className={toRival > 0 ? 'text-red-400' : 'text-green-400'}>
                {toRival > 0 ? `+${toRival.toFixed(1)}s ahead` : `${(-toRival).toFixed(1)}s behind`}
              </span>
            </p>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={game.reset}
              title="Restart"
              className="rounded-full border border-neutral-700 px-2 py-1 text-xs text-neutral-400"
            >
              ↺
            </button>
            <SpeedControl speed={state.speed} onChange={game.setSpeed} />
          </div>
        </div>
      </header>

      <section className="min-h-0 flex-1 overflow-y-auto">
        <TimingTower race={state.race} userSide={userSide} rival={rival} />
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-950/60 p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-neutral-400">Your tyres</span>
          {me && !me.retired ? (
            <TyreBadge compound={me.compound} age={me.tyreAge} />
          ) : (
            <span className="text-neutral-600">—</span>
          )}
        </div>
        {me && (
          <HeadsetPanel
            modes={me.modes}
            disabled={paused}
            onFlip={(key, value) =>
              game.call({ lap: state.race.lap + 1, kind: 'mode', key, value })
            }
          />
        )}
        <BoxButton
          compounds={compounds}
          disabled={paused}
          onBox={(compound) => game.call({ lap: state.race.lap + 1, kind: 'pit', compound })}
        />
      </section>

      {paused && state.currentMoment && (
        <DecisionModal moment={state.currentMoment} rival={rival} onChoose={game.choose} />
      )}
    </main>
  );
}

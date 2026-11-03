// The daily card: what race, whose pit wall you're running, how long, the situation, the bar
// to beat (the real team's result), and Start.

import type { RaceModel } from '@boxthislap/sim';
import { useState } from 'react';
import type { AccountState } from '../account/useAccount.js';
import { AccountBar } from '../components/AccountBar.js';
import { driverInfo } from '../data/drivers.js';
import type { GameState } from '../state/machine.js';
import { HowToPlay } from './HowToPlay.js';

export function IntroCard({
  state,
  model,
  onStart,
  onHelp,
  account,
}: {
  state: GameState;
  model: RaceModel;
  onStart: () => void;
  onHelp: () => void;
  account?: AccountState;
}) {
  const { userSide, rival, takeoverLap, totalLaps, number, source, practiceReason } = state.meta;
  // The walkthrough opens every time the daily card does.
  const [howTo, setHowTo] = useState(true);
  const lapsLeft = totalLaps - takeoverLap;
  const userTeam = model.drivers.find((d) => d.code === userSide)?.team;
  const realPos = model.realResult.indexOf(userSide) + 1;
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
      {howTo && (
        <HowToPlay
          team={userTeam ?? userSide}
          user={userSide}
          rival={rival}
          realPos={realPos}
          laps={lapsLeft}
          onClose={() => setHowTo(false)}
        />
      )}
      {source === 'practice' && (
        <p className="rounded-lg border border-yellow-700/60 bg-yellow-950/40 p-3 text-sm text-yellow-200">
          {practiceReason ?? 'Practice mode.'} You can play a practice run; it won’t be submitted.
        </p>
      )}
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-neutral-500">
          {number ? `Daily Race #${number}` : 'Daily Race'}
        </p>
        <h1 className="mt-1 disp text-[30px] leading-none leading-tight">
          {model.race.name ?? model.race.id}
        </h1>
      </div>
      <dl className="grid grid-cols-2 gap-3 font-mono text-sm">
        <div className="rounded-lg bg-[var(--card)] p-3">
          <dt className="text-xs uppercase tracking-wide text-neutral-500">You’re running</dt>
          <dd className="text-lg font-bold text-[var(--you)]">
            {userSide} {userTeam ? `· ${userTeam}` : ''}
          </dd>
        </div>
        <div className="rounded-lg bg-[var(--card)] p-3">
          <dt className="text-xs uppercase tracking-wide text-neutral-500">Laps left</dt>
          <dd className="text-lg font-bold">{lapsLeft}</dd>
        </div>
      </dl>
      {situation && <p className="font-mono text-sm text-neutral-300">{situation}</p>}
      <p className="text-neutral-300">
        You’re the {userTeam ?? userSide} team manager. Every strategy call is yours: when to box,
        which tyres, how hard to push, how to race{' '}
        <span className="font-semibold text-[var(--rival)]">{rival}</span>.
        {realPos > 0 && (
          <>
            {' '}
            The real {userTeam ?? 'team'} pit wall finished{' '}
            <span className="font-semibold text-[var(--ink)]">P{realPos}</span>. Beat that.
          </>
        )}
      </p>
      <p className="text-[13px] text-neutral-500">
        Every big call is graded against the race model. {userSide} ignores about{' '}
        {driverInfo(userSide)?.ignores ?? 0}% of your live calls.
      </p>
      <button
        type="button"
        onClick={onStart}
        className="rounded-xl bg-[var(--you)] py-4 text-lg font-bold text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
      >
        Take the {userTeam ? `${userTeam} ` : ''}pit wall
      </button>
      {account && <AccountBar account={account} />}
      <footer className="flex justify-center gap-4 text-xs text-neutral-500">
        <button type="button" onClick={() => setHowTo(true)} className="underline">
          How to play
        </button>
        <button type="button" onClick={onHelp} className="underline">
          How it works
        </button>
        <span>Not affiliated with Formula 1.</span>
      </footer>
    </main>
  );
}

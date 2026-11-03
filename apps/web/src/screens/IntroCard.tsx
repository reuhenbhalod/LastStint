// The daily card: a top bar (the brand; your streak and sign-in), then the race. On the left,
// what you're doing (the race, whose pit wall you run, the bar to beat) and Start; on the
// right, the situation you take over: your driver against the rival, the gap, the tyres, the
// laps left. The how-to-play walkthrough opens over it.

import type { RaceModel } from '@boxthislap/sim';
import { useState } from 'react';
import type { AccountState } from '../account/useAccount.js';
import { AccountBar } from '../components/AccountBar.js';
import { TyreBadge } from '../components/TyreBadge.js';
import { TIER_LABEL, driverInfo } from '../data/drivers.js';
import type { GameState } from '../state/machine.js';
import { HowToPlay } from './HowToPlay.js';

function Driver({
  code,
  team,
  accent,
  compound,
  age,
  right,
}: {
  code: string;
  team?: string;
  accent: string;
  compound?: string;
  age?: number;
  right?: boolean;
}) {
  const info = driverInfo(code);
  return (
    <div className={`flex flex-col gap-1.5 ${right ? 'items-end text-right' : ''}`}>
      <span className="disp wide text-[34px] leading-none" style={{ color: accent }}>
        {code}
      </span>
      <span className="text-[13px] font-semibold">{info?.name ?? code}</span>
      <span className="text-[12px] text-[var(--muted)]">{team}</span>
      {compound && age !== undefined && <TyreBadge compound={compound} age={age} />}
    </div>
  );
}

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
  const rivalTeam = model.drivers.find((d) => d.code === rival)?.team;
  const realPos = model.realResult.indexOf(userSide) + 1;
  const me = state.race.cars[userSide];
  const them = state.race.cars[rival];
  const gap = me && them ? them.totalTime - me.totalTime : null;
  const info = driverInfo(userSide);
  const [title, subtitle] = (model.race.name ?? model.race.id).split(': ');

  return (
    <div className="flex min-h-screen flex-col">
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

      {/* Top bar: the brand on the left, your streak and sign-in on the right. */}
      <header className="border-b border-[var(--rule)]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <span className="flex items-baseline gap-2">
            <span className="disp wide text-[20px] leading-none">Pit Wall</span>
            <span className="eyebrow hidden sm:inline">Daily F1 strategy</span>
          </span>
          {account && <AccountBar account={account} compact />}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-6 px-6 py-8">
        {source === 'practice' && (
          <p className="m-0 flex items-center gap-2 rounded-lg border border-yellow-700/60 bg-yellow-950/40 px-3 py-2 text-[13px] text-yellow-200">
            <span className="rounded-full bg-[var(--flag)] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#141716]">
              Practice
            </span>
            {practiceReason ?? 'Practice mode.'} You can play a practice run; it won’t be submitted.
          </p>
        )}

        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          {/* What you're doing, and Start. */}
          <section className="flex flex-col gap-5">
            <p className="eyebrow m-0">{number ? `Daily race #${number}` : 'Daily race'}</p>
            <h1 className="m-0 flex flex-col gap-2">
              <span className="disp wide text-[44px] leading-[0.95]">{title}</span>
              {subtitle && (
                <span className="disp text-[22px] leading-tight text-[var(--muted)]">
                  {subtitle}
                </span>
              )}
            </h1>
            <p className="m-0 max-w-[52ch] text-[16px] leading-relaxed text-[var(--ink)]">
              You’re the {userTeam ?? userSide} team manager. Every strategy call is yours: when to
              box, which tyres, how hard to push, how to race{' '}
              <span className="font-semibold text-[var(--rival)]">{rival}</span>.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={onStart}
                className="rounded-xl bg-[var(--you)] px-8 py-4 text-[17px] font-bold text-[#08231f] hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
              >
                Take the {userTeam ? `${userTeam} ` : ''}pit wall
              </button>
              <span className="flex gap-4 text-[13px] text-[var(--muted)]">
                <button
                  type="button"
                  onClick={() => setHowTo(true)}
                  className="underline hover:text-[var(--ink)]"
                >
                  How to play
                </button>
                <button
                  type="button"
                  onClick={onHelp}
                  className="underline hover:text-[var(--ink)]"
                >
                  How it works
                </button>
              </span>
            </div>
          </section>

          {/* The situation you take over. */}
          <section aria-label="The situation" className="card flex flex-col gap-5 !p-5">
            <div className="flex items-center justify-between">
              <span className="eyebrow">You take over</span>
              <span className="eyebrow">
                Lap {takeoverLap} of {totalLaps}
              </span>
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <Driver
                code={userSide}
                team={userTeam}
                accent="var(--you)"
                compound={me?.compound}
                age={me?.tyreAge}
              />
              <div className="flex flex-col items-center gap-1 text-center">
                <span className="eyebrow">Gap</span>
                <span className="disp wide text-[26px] normal-case leading-none">
                  {gap === null ? '-' : `${Math.abs(gap).toFixed(1)}s`}
                </span>
                <span className="text-[12px] text-[var(--muted)]">
                  {gap === null ? '' : gap >= 0 ? `${userSide} leads` : `${rival} leads`}
                </span>
              </div>
              <Driver
                code={rival}
                team={rivalTeam}
                accent="var(--rival)"
                compound={them?.compound}
                age={them?.tyreAge}
                right
              />
            </div>
            <dl className="m-0 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-[var(--card-2)] px-2 py-2.5">
                <dt className="eyebrow">Laps left</dt>
                <dd className="disp m-0 text-[22px] leading-none">{lapsLeft}</dd>
              </div>
              <div className="rounded-lg bg-[var(--card-2)] px-2 py-2.5">
                <dt className="eyebrow">Real result</dt>
                <dd className="disp m-0 text-[22px] leading-none">
                  {realPos ? `P${realPos}` : '-'}
                </dd>
              </div>
              <div className="rounded-lg bg-[var(--card-2)] px-2 py-2.5">
                <dt className="eyebrow">{userSide}</dt>
                <dd className="m-0 pt-0.5 text-[13px] font-semibold leading-tight text-[var(--you)]">
                  {info ? TIER_LABEL[info.tier] : '-'}
                </dd>
              </div>
            </dl>
            <p className="m-0 text-[13px] leading-snug text-[var(--muted)]">
              {realPos > 0
                ? `The real ${userTeam ?? 'team'} pit wall finished P${realPos}. Beat that. `
                : ''}
              Every big call is graded against the race model.
            </p>
          </section>
        </div>
      </main>

      <footer className="px-6 pb-6 text-center text-[12px] text-[var(--muted)]">
        Not affiliated with Formula 1.
      </footer>
    </div>
  );
}

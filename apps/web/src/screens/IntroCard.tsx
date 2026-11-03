// The home page (the daily card). A full-width hero: the day's circuit drawn large behind the
// race's name and the duel, with your driver and the rival placed where they are when you take
// over; the goal and Start. Under it, the duel in numbers and what your job is tonight. The top
// bar has the brand, your streak and sign-in. The how-to-play walkthrough opens over it on a
// fresh visit; coming back mid-race (the Pit Wall brand), Start becomes "Back to the race".

import type { RaceModel } from '@boxthislap/sim';
import { useMemo, useState } from 'react';
import type { AccountState } from '../account/useAccount.js';
import { AccountBar } from '../components/AccountBar.js';
import { HeadsetIcon, OvertakeIcon, TyreIcon } from '../components/Icons.js';
import { TyreBadge } from '../components/TyreBadge.js';
import { TIER_LABEL, driverInfo } from '../data/drivers.js';
import { goalOf } from '../game/goal.js';
import type { GameState } from '../state/machine.js';
import { carsOnTrack, pointAt, polyline } from '../track/geometry.js';
import { outlineFor } from '../track/outlines.js';
import { HowToPlay } from './HowToPlay.js';

/** The circuit as a glowing line, with the two cars where they are at the takeover. */
function Circuit({ state, model }: { state: GameState; model: RaceModel }) {
  const outline = outlineFor(model.race.id);
  const { userSide, rival } = state.meta;
  const drawn = useMemo(() => {
    if (!outline) return null;
    const line = polyline(outline.points);
    const d = `M${outline.points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L')}Z`;
    const cars = carsOnTrack(state.race, model, 'green');
    const at = (code: string) => {
      const c = cars.find((x) => x.code === code);
      return c ? pointAt(line, -c.behind) : null;
    };
    return { d, me: at(userSide), them: at(rival) };
  }, [outline, state.race, model, userSide, rival]);
  if (!outline || !drawn) return null;
  return (
    <svg
      viewBox={`-40 -40 ${outline.width + 80} ${outline.height + 80}`}
      className="h-full w-full"
      aria-hidden="true"
    >
      <defs>
        <filter id="home-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>
      <path
        d={drawn.d}
        fill="none"
        stroke="var(--you)"
        strokeWidth={34}
        opacity={0.22}
        filter="url(#home-glow)"
      />
      <path
        d={drawn.d}
        fill="none"
        stroke="var(--tarmac-edge)"
        strokeWidth={30}
        strokeLinejoin="round"
      />
      <path
        d={drawn.d}
        fill="none"
        stroke="var(--tarmac)"
        strokeWidth={22}
        strokeLinejoin="round"
      />
      <path
        d={drawn.d}
        fill="none"
        stroke="var(--track-line)"
        strokeWidth={1.5}
        strokeDasharray="10 14"
        opacity={0.35}
      />
      {(
        [
          [drawn.them, 'var(--rival)', rival],
          [drawn.me, 'var(--you)', userSide],
        ] as const
      ).map(([p, color, code]) =>
        p ? (
          <g key={code} transform={`translate(${p[0].toFixed(1)},${p[1].toFixed(1)})`}>
            <circle r={26} fill={color} opacity={0.25} className="battle-ring" />
            <circle r={13} fill={color} stroke="var(--paper)" strokeWidth={3} />
            <text
              y={-24}
              textAnchor="middle"
              fill="#fff"
              fontSize={22}
              fontWeight={800}
              fontFamily="var(--display)"
            >
              {code}
            </text>
          </g>
        ) : null,
      )}
    </svg>
  );
}

function Side({
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
    <div
      className={`flex min-w-0 items-center gap-3 ${right ? 'flex-row-reverse text-right' : ''}`}
    >
      <span
        className="disp hidden h-14 w-14 shrink-0 items-center justify-center rounded-xl text-[24px] leading-none text-[#0b0e0d] sm:flex"
        style={{ background: accent }}
      >
        {info?.number ?? code}
      </span>
      <span className={`flex min-w-0 flex-col gap-1 ${right ? 'items-end' : ''}`}>
        <span
          className="disp wide text-[24px] leading-none sm:text-[26px]"
          style={{ color: accent }}
        >
          {code}
        </span>
        <span className="hidden truncate text-[13px] font-semibold sm:block">
          {info?.name ?? code}
        </span>
        <span className="flex items-center gap-1.5 text-[12px] text-[var(--muted)]">
          <span className="hidden truncate sm:inline">{team}</span>
          {compound && age !== undefined && <TyreBadge compound={compound} age={age} />}
        </span>
      </span>
    </div>
  );
}

const JOBS = [
  {
    icon: OvertakeIcon,
    title: 'Call the battles',
    body: 'A car within a second? Dive up the inside, go round the outside, or wait for DRS. You see the odds; the corner decides.',
  },
  {
    icon: TyreIcon,
    title: 'Make the pit calls',
    body: 'Box or stay out, which tyres, when the safety car makes the stop cheap. Each big call is graded on hundreds of simulated races.',
  },
  {
    icon: HeadsetIcon,
    title: 'Keep your driver on side',
    body: 'Good calls earn his trust. Bad ones and he overdrives, argues on the radio, and starts racing his own way.',
  },
];

export function IntroCard({
  state,
  model,
  onStart,
  onHelp,
  account,
  resume,
}: {
  state: GameState;
  model: RaceModel;
  onStart: () => void;
  onHelp: () => void;
  account?: AccountState;
  /** Back home mid-race: the label for getting back to it (Start then resumes). */
  resume?: string;
}) {
  const { userSide, rival, takeoverLap, totalLaps, number, source, practiceReason } = state.meta;
  // The walkthrough opens with the daily card, not when coming back mid-race.
  const [howTo, setHowTo] = useState(!resume);
  const lapsLeft = totalLaps - takeoverLap;
  const userTeam = model.drivers.find((d) => d.code === userSide)?.team;
  const rivalTeam = model.drivers.find((d) => d.code === rival)?.team;
  const realPos = model.realResult.indexOf(userSide) + 1;
  const realRival = model.realResult.indexOf(rival) + 1;
  const me = state.race.cars[userSide];
  const them = state.race.cars[rival];
  const gap = me && them ? them.totalTime - me.totalTime : null;
  const info = driverInfo(userSide);
  const goal = goalOf(model);
  const [title, subtitle] = (model.race.name ?? model.race.id).split(': ');
  const defend = goal.kind === 'defend';

  return (
    <div className="flex min-h-screen flex-col">
      {howTo && (
        <HowToPlay
          team={userTeam ?? userSide}
          user={userSide}
          rival={rival}
          realPos={realPos}
          laps={lapsLeft}
          goal={goal.line}
          onClose={() => setHowTo(false)}
        />
      )}

      <header className="relative z-10 border-b border-[var(--rule)] bg-[var(--paper)]/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <a href="/" className="flex items-baseline gap-2">
            <span className="disp wide text-[20px] leading-none">Pit Wall</span>
            <span className="eyebrow hidden sm:inline">Daily F1 strategy</span>
          </a>
          {account && <AccountBar account={account} compact />}
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {/* The hero: the circuit behind the race's name. */}
        <section className="relative overflow-hidden border-b border-[var(--rule)]">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse at 75% 40%, color-mix(in srgb, var(--you) 12%, transparent), transparent 60%), radial-gradient(ellipse at 10% 90%, color-mix(in srgb, var(--rival) 8%, transparent), transparent 55%)',
            }}
          />
          <div className="checker pointer-events-none absolute inset-x-0 top-0 h-2 opacity-60" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-6 px-4 py-8 sm:px-6 lg:min-h-[540px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:py-12">
            <div className="flex flex-col gap-5">
              {source === 'practice' && (
                <p className="m-0 flex w-fit items-center gap-2 rounded-full border border-yellow-700/60 bg-yellow-950/40 py-1 pl-1 pr-3 text-[12px] text-yellow-200">
                  <span className="rounded-full bg-[var(--flag)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#141716]">
                    Practice
                  </span>
                  {practiceReason ?? 'Practice mode'} · not submitted
                </p>
              )}
              <p className="eyebrow m-0 flex items-center gap-2 !text-[var(--you)]">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--you)]" />
                {number ? `Daily race #${number}` : 'Daily race'} · lap {takeoverLap} of {totalLaps}
              </p>
              <h1 className="m-0 flex flex-col gap-3">
                <span className="disp wide text-[52px] leading-[0.9] sm:text-[76px]">{title}</span>
                {subtitle && (
                  <span className="disp text-[24px] leading-tight sm:text-[30px]">
                    <span className="text-[var(--you)]">{subtitle.split(' vs ')[0]}</span>
                    {subtitle.includes(' vs ') && (
                      <>
                        <span className="text-[var(--muted)]"> vs </span>
                        <span className="text-[var(--rival)]">{subtitle.split(' vs ')[1]}</span>
                      </>
                    )}
                  </span>
                )}
              </h1>
              <p className="m-0 max-w-[50ch] text-[17px] leading-relaxed text-[var(--ink)]">
                You’re {userSide}’s race engineer at {userTeam ?? 'the team'}, on the radio for the
                last {lapsLeft} laps. Every call is yours.{' '}
                <span className="font-semibold">
                  {defend ? `Keep ${rival} behind.` : `Get ${userSide} ahead of ${rival}.`}
                </span>
              </p>
              <div className="flex flex-wrap items-center gap-2 text-[14px]">
                <span
                  className={`rounded-full px-3 py-1 font-bold ${defend ? 'bg-[color-mix(in_srgb,var(--rival)_20%,transparent)] text-[var(--rival)]' : 'bg-[color-mix(in_srgb,var(--you)_20%,transparent)] text-[var(--you)]'}`}
                >
                  {goal.short}
                </span>
                {realPos > 0 && (
                  <span className="text-[var(--muted)]">
                    The real {userTeam ?? 'team'} pit wall: P{realPos}.{' '}
                    {defend ? 'Keep it.' : 'Beat it.'}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={onStart}
                  className="group flex items-center justify-center gap-3 rounded-xl bg-[var(--you)] px-8 py-4 text-[18px] font-bold text-[#08231f] shadow-[0_10px_40px_-10px_var(--you)] hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
                >
                  {resume ?? `Take the ${userTeam ? `${userTeam} ` : ''}pit wall`}
                  <span
                    aria-hidden="true"
                    className="transition-transform group-hover:translate-x-1"
                  >
                    →
                  </span>
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
            </div>

            {/* The circuit, with the duel card over its lower edge. */}
            <div className="relative flex flex-col">
              <div
                className="mx-auto w-full max-w-[640px] lg:!aspect-auto lg:h-[420px]"
                style={(() => {
                  const o = outlineFor(model.race.id);
                  return o ? { aspectRatio: `${o.width + 80} / ${o.height + 80}` } : undefined;
                })()}
              >
                <Circuit state={state} model={model} />
              </div>
              <section
                aria-label="The situation"
                className="card relative -mt-6 flex flex-col gap-4 !border-[var(--tarmac-edge)] !bg-[var(--card)]/95 !p-4 shadow-2xl backdrop-blur sm:mx-6"
              >
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <Side
                    code={userSide}
                    team={userTeam}
                    accent="var(--you)"
                    compound={me?.compound}
                    age={me?.tyreAge}
                  />
                  <div className="flex flex-col items-center text-center">
                    <span className="eyebrow">Gap</span>
                    <span className="disp wide text-[24px] leading-none">
                      {gap === null ? '-' : `${Math.abs(gap).toFixed(1)}s`}
                    </span>
                    <span className="text-[11px] text-[var(--muted)]">
                      {gap === null ? '' : gap >= 0 ? `${userSide} leads` : `${rival} leads`}
                    </span>
                  </div>
                  <Side
                    code={rival}
                    team={rivalTeam}
                    accent="var(--rival)"
                    compound={them?.compound}
                    age={them?.tyreAge}
                    right
                  />
                </div>
              </section>
            </div>
          </div>
        </section>

        {/* The numbers, then the job. */}
        <section className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-8 sm:px-6">
          <dl className="m-0 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Laps to run', String(lapsLeft)],
              [`${userSide} really finished`, realPos ? `P${realPos}` : '-'],
              [`${rival} really finished`, realRival ? `P${realRival}` : '-'],
              [
                `${userSide}'s attitude`,
                info ? TIER_LABEL[info.tier].replace(' attitude', '') : '-',
              ],
            ].map(([label, value]) => (
              <div key={label} className="card flex flex-col gap-1 !p-4">
                <dt className="eyebrow">{label}</dt>
                <dd className="disp m-0 text-[28px] leading-none">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="grid gap-3 md:grid-cols-3">
            {JOBS.map((j) => (
              <article key={j.title} className="card flex flex-col gap-2 !p-5">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--tarmac-edge)] bg-[var(--card-2)] text-[var(--you)]">
                  <j.icon size={22} />
                </span>
                <h2 className="disp m-0 text-[18px] leading-tight">{j.title}</h2>
                <p className="m-0 text-[14px] leading-relaxed text-[var(--muted)]">{j.body}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="px-6 pb-6 text-center text-[12px] text-[var(--muted)]">
        One race a day · Not affiliated with Formula 1.
      </footer>
    </div>
  );
}

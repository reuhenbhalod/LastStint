// The home page (the daily card). A full-width hero: the day's circuit drawn large behind the
// race's name and the duel, with your driver and the rival placed where they are when you take
// over; the goal and Start. Under it, the duel in numbers and what your job is tonight. The top
// bar has the brand, the Gauntlet and Eras pills, your streak and sign-in. The how-to-play
// walkthrough opens over it on a fresh visit; coming back mid-race (the Pit Wall brand), Start
// becomes "Back to the race".

import type { RaceModel } from '@laststint/sim';
import { useEffect, useMemo, useRef, useState } from 'react';
import { takeHowToPending } from '../account/howTo.js';
import type { AccountState } from '../account/useAccount.js';
import { AccountBar } from '../components/AccountBar.js';
import { Disclaimer } from '../components/Disclaimer.js';
import { HeadsetIcon, OvertakeIcon, TyreIcon } from '../components/Icons.js';
import { TopBar } from '../components/TopBar.js';
import { TyreBadge } from '../components/TyreBadge.js';
import { TIER_LABEL, driverInfo } from '../data/drivers.js';
import { surname } from '../data/names.js';
import { goalOf } from '../game/goal.js';
import type { GameState } from '../state/machine.js';
import { carsOnTrack, pointAt, polyline } from '../track/geometry.js';
import { groundFor } from '../track/ground.js';
import { outlineFor } from '../track/outlines.js';
import { HowToPlay } from './HowToPlay.js';

/** The circuit on its real ground (track/ground.ts), with the two cars where they are at the
 * takeover. It covers its box; the hero's gradient fades it into the page. */
function Circuit({ state, model }: { state: GameState; model: RaceModel }) {
  const outline = outlineFor(model.race.id);
  const ground = useMemo(() => groundFor(model.race.id), [model.race.id]);
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
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full"
      style={{ background: ground?.base ?? 'var(--ground)' }}
      aria-hidden="true"
    >
      {ground && (
        <image
          href={ground.src}
          x={0}
          y={0}
          width={ground.w}
          height={ground.h}
          preserveAspectRatio="none"
          transform={`matrix(${ground.matrix.join(' ')})`}
        />
      )}
      <path
        d={drawn.d}
        fill="none"
        stroke="#000"
        strokeOpacity={0.35}
        strokeWidth={30}
        strokeLinejoin="round"
        transform="translate(1.5,2)"
      />
      <path
        d={drawn.d}
        fill="none"
        stroke="var(--track-line)"
        strokeWidth={24}
        strokeLinejoin="round"
      />
      <path
        d={drawn.d}
        fill="none"
        stroke="var(--tarmac-lane)"
        strokeWidth={21}
        strokeLinejoin="round"
      />
      {(
        [
          [drawn.them, 'var(--rival)', rival],
          [drawn.me, 'var(--you)', userSide],
        ] as const
      ).map(([p, color, code]) =>
        p ? (
          <g key={code} transform={`translate(${p[0].toFixed(1)},${p[1].toFixed(1)})`}>
            <circle r={26} fill={color} opacity={0.3} className="battle-ring" />
            <circle r={12} fill={color} stroke="#fff" strokeWidth={3} />
            <text
              y={-24}
              textAnchor="middle"
              fill="#fff"
              stroke="rgba(8,11,12,0.85)"
              strokeWidth={5}
              strokeLinejoin="round"
              paintOrder="stroke"
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
        className="disp hidden h-14 w-14 shrink-0 items-center justify-center rounded-xl text-[24px] leading-none sm:flex"
        // The team colour, and its readable text (--you-ink / --rival-ink).
        style={{ background: accent, color: accent.replace(')', '-ink)') }}
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
        <span
          className={`flex min-w-0 max-w-full items-center gap-1.5 text-[12px] text-[var(--muted)] ${right ? 'flex-row-reverse' : ''}`}
        >
          <span className="hidden min-w-0 truncate sm:inline">{team}</span>
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
    body: 'A car within a second and a half? The race stops at the braking zone for your call: dive up the inside, go round the outside, or wait for DRS. You see the odds; the corner decides.',
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
  // The walkthrough opens with the daily card on its own for a signed-out player, and for a
  // signed-in one only the first time after the account is created (account/howTo.ts); never
  // when coming back mid-race. It waits for the account lookup, so a signed-in player doesn't
  // see it flash open. Without an account system (tests), it opens as before.
  const [howTo, setHowTo] = useState(!resume && !account);
  const signedIn = account?.player?.account?.playerId ?? null;
  const decided = useRef<string | null>(null);
  useEffect(() => {
    if (resume || !account?.loaded) return;
    const who = signedIn ?? 'signed-out';
    if (decided.current === who) return;
    decided.current = who;
    if (!signedIn || takeHowToPending(signedIn)) setHowTo(true);
  }, [account?.loaded, signedIn, resume]);
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

      <TopBar
        active={source === 'survivor' ? 'gauntlet' : 'daily'}
        right={account && <AccountBar account={account} compact />}
      />

      <main className="flex flex-1 flex-col">
        {/* The hero: the circuit behind the race's name. */}
        <section className="relative overflow-hidden border-b border-[var(--rule)]">
          {/* On a computer the circuit's real ground fills the right of the hero and fades
              into the page under the words. */}
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[68%] lg:block">
            <Circuit state={state} model={model} />
          </div>
          <div
            className="pointer-events-none absolute inset-0 hidden lg:block"
            style={{
              background:
                'linear-gradient(90deg, var(--paper) 0%, var(--paper) 34%, color-mix(in srgb, var(--paper) 55%, transparent) 50%, transparent 70%), linear-gradient(0deg, var(--paper) 0%, transparent 18%)',
            }}
          />
          <div className="relative mx-auto grid max-w-7xl items-center gap-6 px-4 py-8 sm:px-6 lg:min-h-[600px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:py-14">
            <div className="flex flex-col gap-5">
              {source === 'practice' && (
                <p className="m-0 flex w-fit items-center gap-2 rounded-full border border-yellow-700/60 bg-yellow-950/40 py-1 pl-1 pr-3 text-[12px] text-yellow-200">
                  <span className="rounded-full bg-[var(--flag)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#151A1D]">
                    Practice
                  </span>
                  {practiceReason ?? 'Practice mode'} · not submitted
                </p>
              )}
              <p className="eyebrow m-0 flex items-center gap-2 !text-[var(--you)]">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--you)]" />
                {source === 'survivor'
                  ? `Gauntlet · round ${number}`
                  : number
                    ? `Daily race #${number}`
                    : 'Daily race'}{' '}
                · lap {takeoverLap} of {totalLaps}
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
                You’re {surname(userSide)}’s race engineer at {userTeam ?? 'the team'}, on the radio
                for the last {lapsLeft} laps. Every call is yours.{' '}
                <span className="font-semibold">
                  {defend
                    ? `Keep ${surname(rival)} behind.`
                    : `Get ${surname(userSide)} ahead of ${surname(rival)}.`}
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
              {/* The start button, with how to play and how it works under it. */}
              <div className="flex w-full flex-col items-stretch gap-2.5 pt-1 sm:w-fit">
                <button
                  type="button"
                  onClick={onStart}
                  className="group flex items-center justify-center gap-3 rounded-xl bg-[var(--ink)] px-8 py-4 text-[18px] font-extrabold text-[var(--paper)] shadow-[0_10px_40px_-14px_rgba(255,255,255,0.5)] hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--you)]"
                >
                  {resume ?? `Take the ${userTeam ? `${userTeam} ` : ''}pit wall`}
                </button>
                <a
                  href="/tutorial"
                  className="flex items-center justify-center gap-2 rounded-xl border border-[var(--rule)] px-6 py-2.5 text-[14px] font-semibold text-[var(--ink)] hover:border-[var(--you)] hover:bg-[color-mix(in_srgb,var(--you)_10%,transparent)]"
                >
                  New here? Play the tutorial race
                  <span className="text-[12px] font-normal text-[var(--muted)]">· 5 min</span>
                </a>
                <span className="flex justify-center gap-5 text-[13px] text-[var(--muted)]">
                  <button
                    type="button"
                    onClick={() => setHowTo(true)}
                    className="underline hover:text-[var(--ink)]"
                  >
                    How to play
                  </button>
                  {source !== 'survivor' && (
                    <button
                      type="button"
                      onClick={onHelp}
                      className="underline hover:text-[var(--ink)]"
                    >
                      How it works
                    </button>
                  )}
                </span>
              </div>
            </div>

            {/* The duel card, over the circuit's lower edge (on a phone, the circuit is drawn
                above it). */}
            <div className="relative flex flex-col lg:justify-end lg:self-stretch">
              <div
                className="mx-auto w-full max-w-[640px] overflow-hidden rounded-2xl lg:hidden"
                style={(() => {
                  const o = outlineFor(model.race.id);
                  return o ? { aspectRatio: `${o.width + 80} / ${o.height + 80}` } : undefined;
                })()}
              >
                <Circuit state={state} model={model} />
              </div>
              <section
                aria-label="The situation"
                className="glass relative -mt-6 flex flex-col gap-4 p-4 shadow-2xl sm:mx-6 lg:mx-0 lg:mt-0 lg:ml-auto lg:w-[600px]"
              >
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <Side
                    code={userSide}
                    team={userTeam}
                    accent="var(--you)"
                    compound={me?.compound}
                    age={me?.tyreAge}
                  />
                  <div className="flex w-[96px] flex-col items-center text-center">
                    <span className="eyebrow">Gap</span>
                    <span className="disp wide text-[24px] leading-none">
                      {gap === null ? '-' : `${Math.abs(gap).toFixed(1)}s`}
                    </span>
                    <span className="text-[11px] leading-tight text-[var(--muted)]">
                      {gap === null
                        ? ''
                        : gap >= 0
                          ? `${surname(userSide)} leads`
                          : `${surname(rival)} leads`}
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
              [`${surname(userSide)} really finished`, realPos ? `P${realPos}` : '-'],
              [`${surname(rival)} really finished`, realRival ? `P${realRival}` : '-'],
              [
                `${surname(userSide)}'s attitude`,
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

      <Disclaimer />
    </div>
  );
}

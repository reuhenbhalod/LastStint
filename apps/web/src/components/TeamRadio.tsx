// Team radio: every order the pit wall can give at any time, under the map. Closed it's one
// bar (what's set now, and any stop booked); open it lays out the orders side by side: the
// pit stop (box for a tyre), the headset (pace, battle, ERS with its battery, fuel) and, when
// your driver has a team-mate in the race, team orders. Every order is for the coming lap,
// and the driver may refuse a pit or headset call (game/refusal.ts).

import type { Decision, Modes, RaceModel, RaceState, TeamOrder } from '@boxthislap/sim';
import { teammateOf } from '@boxthislap/sim';
import { useState } from 'react';
import { tyreName } from '../game/choices.js';
import { HeadsetPanel } from './HeadsetPanel.js';

const LETTER: Record<string, string> = { SOFT: 'S', MEDIUM: 'M', HARD: 'H' };

type Call = Decision;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-2 rounded-lg bg-[var(--card-2)] p-3">
      <span className="eyebrow">{title}</span>
      {children}
    </section>
  );
}

export function TeamRadio({
  race,
  model,
  userSide,
  rival,
  pending,
  boxing,
  disabled,
  describe,
  onCall,
}: {
  race: RaceState;
  model: RaceModel;
  userSide: string;
  rival: string;
  /** Mode calls booked for the coming lap. */
  pending: Partial<Modes>;
  /** The compound of a stop booked for the end of this lap, if any. */
  boxing: string | null;
  disabled: boolean;
  describe: (key: keyof Modes, value: string) => string | null;
  onCall: (call: Call) => void;
}) {
  // Open on a laptop; one bar on a phone, where the map and the calls come first.
  const [open, setOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 768);
  const me = race.cars[userSide];
  const next = race.lap + 1;
  const mate = teammateOf(model);
  const mateCar = mate ? race.cars[mate] : undefined;
  const orders = race.teamOrders;
  const order = (o: TeamOrder) => onCall({ lap: next, kind: 'teamOrder', order: o });
  if (!me) return null;

  const btn =
    'rounded-lg px-2 py-2 text-[13px] font-semibold disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--you)]';

  return (
    <section aria-label="Team radio" className="card flex flex-col gap-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 text-left"
      >
        <span className="disp text-[17px] leading-none">📻 Team radio</span>
        <span className="text-[12px] text-[var(--muted)]">Orders for next lap</span>
        <span className="ml-auto flex flex-wrap items-center gap-1.5 text-[12px] capitalize">
          {boxing && (
            <span className="rounded bg-[var(--box)] px-1.5 py-0.5 font-semibold text-white">
              Boxing · {tyreName(boxing)}
            </span>
          )}
          <span className="rounded bg-[var(--card-2)] px-1.5 py-0.5">Pace {me.modes.pace}</span>
          <span className="rounded bg-[var(--card-2)] px-1.5 py-0.5">ERS {me.modes.ers}</span>
          <span className="text-[16px] leading-none text-[var(--muted)]" aria-hidden="true">
            {open ? '▴' : '▾'}
          </span>
        </span>
      </button>

      {open && (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]">
          <div className="flex min-w-0 flex-col gap-3">
            <Section title="Pit stop · box this lap">
              {boxing ? (
                <output className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[var(--box)] py-2.5 text-[14px] font-bold">
                  <span className={`tyre ${boxing} bg-[var(--tarmac)]`}>
                    {LETTER[boxing] ?? boxing[0]}
                  </span>
                  Boxing this lap · {tyreName(boxing)}
                </output>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {Object.keys(model.compounds).map((c) => (
                    <button
                      key={c}
                      type="button"
                      disabled={disabled || me.retired}
                      onClick={() => onCall({ lap: next, kind: 'pit', compound: c })}
                      className={`${btn} flex flex-col items-center justify-center gap-1 bg-[var(--box)] text-white hover:brightness-110`}
                    >
                      <span className={`tyre ${c} bg-[var(--tarmac)]`}>{LETTER[c] ?? c[0]}</span>
                      {tyreName(c)}
                    </button>
                  ))}
                </div>
              )}
            </Section>
            {mate && (
              <Section title={`Team orders · ${mate}`}>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={disabled || !mateCar || mateCar.retired}
                    aria-pressed={orders.holdUp}
                    onClick={() => order(orders.holdUp ? 'release' : 'holdUp')}
                    title={`${mate} defends against ${rival} whenever he's right ahead of him`}
                    className={`${btn} ${orders.holdUp ? 'bg-[var(--you)] text-[#08231f]' : 'bg-[var(--card)] hover:bg-[var(--rule)]'}`}
                  >
                    {orders.holdUp ? `Release ${rival}` : `Hold up ${rival}`}
                  </button>
                  <button
                    type="button"
                    disabled={disabled || !mateCar || mateCar.retired}
                    onClick={() => order('teammateLetsYouPast')}
                    title={`${mate} lets ${userSide} through if he's right ahead`}
                    className={`${btn} bg-[var(--card)] hover:bg-[var(--rule)]`}
                  >
                    {mate} lets you by
                  </button>
                  <button
                    type="button"
                    disabled={disabled || !mateCar || mateCar.retired}
                    onClick={() => order('letTeammatePast')}
                    title={`${userSide} lets ${mate} through if he's right behind`}
                    className={`${btn} col-span-2 bg-[var(--card)] hover:bg-[var(--rule)]`}
                  >
                    Let {mate} by
                  </button>
                </div>
                {orders.swap && (
                  <p className="m-0 text-[12px] text-[var(--muted)]">
                    Swap called: {orders.swap.yielder} yields when they're together.
                  </p>
                )}
              </Section>
            )}
          </div>
          <Section title="Headset">
            <HeadsetPanel
              modes={me.modes}
              pending={pending}
              battery={me.battery}
              describe={describe}
              disabled={disabled || me.retired}
              onFlip={(key, value) => onCall({ lap: next, kind: 'mode', key, value })}
            />
          </Section>
        </div>
      )}
    </section>
  );
}

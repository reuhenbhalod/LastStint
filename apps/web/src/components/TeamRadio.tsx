// Team radio: every order the pit wall can give at any time, under the map. Closed it's one
// bar (what's set now, and any stop booked); open it lays out the orders side by side: the
// pit stop (box for a tyre), the headset (pace, battle, ERS with its battery, fuel) and, when
// your driver has a team-mate in the race, team orders. Every order is for the coming lap,
// and the driver may refuse a pit or headset call (game/refusal.ts).

import type { Decision, Modes, RaceModel, RaceState, TeamOrder } from '@laststint/sim';
import { teammateOf } from '@laststint/sim';
import { useState } from 'react';
import { surname } from '../data/names.js';
import { tyreName } from '../game/choices.js';
import { HeadsetPanel } from './HeadsetPanel.js';
import { RadioMark } from './Marks.js';

const LETTER: Record<string, string> = { SOFT: 'S', MEDIUM: 'M', HARD: 'H' };

type Call = Decision;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-1.5 rounded-lg bg-[var(--card-2)] p-2.5">
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
  /** A stop under way: its tyres, and when ("at the end of this lap", "in the pits"...). */
  boxing: { compound: string; when: string } | null;
  disabled: boolean;
  describe: (key: keyof Modes, value: string) => string | null;
  onCall: (call: Call) => void;
}) {
  // Open on a laptop; one bar on a phone, where the map and the calls come first.
  const [open, setOpen] = useState(true);
  const me = race.cars[userSide];
  const next = race.lap + 1;
  const mate = teammateOf(model);
  const mateCar = mate ? race.cars[mate] : undefined;
  const orders = race.teamOrders;
  const order = (o: TeamOrder) => onCall({ lap: next, kind: 'teamOrder', order: o });
  if (!me) return null;

  const btn =
    'rounded-lg px-2 py-1.5 text-[13px] font-semibold disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--you)]';

  return (
    <section aria-label="Team radio" className="card flex flex-col gap-2.5">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 text-left"
      >
        <span className="disp flex items-center gap-2 text-[17px] leading-none">
          <RadioMark size={20} className="text-[var(--you)]" /> Team radio
        </span>
        <span className="text-[12px] text-[var(--muted)]">Orders for next lap</span>
        <span className="ml-auto flex flex-wrap items-center gap-1.5 text-[12px] capitalize">
          {boxing && (
            <span className="rounded bg-[var(--box)] px-1.5 py-0.5 font-semibold text-white">
              Boxing · {tyreName(boxing.compound)}
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
        <div className="grid gap-2.5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]">
          <div className="flex min-w-0 flex-col gap-2.5">
            <Section title="Pit stop · box">
              {boxing ? (
                <output className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[var(--box)] py-2.5 text-[14px] font-bold">
                  <span className={`tyre ${boxing.compound} bg-[var(--tarmac)]`}>
                    {LETTER[boxing.compound] ?? boxing.compound[0]}
                  </span>
                  {tyreName(boxing.compound)} · {boxing.when}
                </output>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {Object.keys(model.compounds).map((c) => (
                    <button
                      key={c}
                      type="button"
                      disabled={disabled || me.retired}
                      onClick={() => onCall({ lap: next, kind: 'pit', compound: c })}
                      className={`${btn} flex items-center justify-center gap-1 whitespace-nowrap !px-1 !text-[12px] bg-[var(--box)] text-white hover:brightness-110`}
                    >
                      <span className={`tyre ${c} bg-[var(--tarmac)]`}>{LETTER[c] ?? c[0]}</span>
                      {tyreName(c)}
                    </button>
                  ))}
                </div>
              )}
            </Section>
            {mate && (
              <Section title={`Team orders · ${surname(mate)}`}>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={disabled || !mateCar || mateCar.retired}
                    aria-pressed={orders.holdUp}
                    onClick={() => order(orders.holdUp ? 'release' : 'holdUp')}
                    title={`${surname(mate)} defends against ${surname(rival)} whenever he's right ahead of him`}
                    className={`${btn} ${orders.holdUp ? 'bg-[var(--you)] text-[var(--you-ink)]' : 'bg-[var(--card)] hover:bg-[var(--rule)]'}`}
                  >
                    {orders.holdUp ? `Release ${surname(rival)}` : `Hold up ${surname(rival)}`}
                  </button>
                  <button
                    type="button"
                    disabled={disabled || !mateCar || mateCar.retired}
                    onClick={() => order('teammateLetsYouPast')}
                    title={`${surname(mate)} lets ${surname(userSide)} through if he's right ahead`}
                    className={`${btn} bg-[var(--card)] hover:bg-[var(--rule)]`}
                  >
                    {surname(mate)} lets you by
                  </button>
                  <button
                    type="button"
                    disabled={disabled || !mateCar || mateCar.retired}
                    onClick={() => order('letTeammatePast')}
                    title={`${surname(userSide)} lets ${surname(mate)} through if he's right behind`}
                    className={`${btn} col-span-2 bg-[var(--card)] hover:bg-[var(--rule)]`}
                  >
                    Let {surname(mate)} by
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

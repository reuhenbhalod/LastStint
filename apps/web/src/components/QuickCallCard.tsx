// A call between the big moments (crew-chief spec D3, race engineer spec): the engineer or the
// driver asks; you have a few seconds while the race runs on. A battle is red and runs the lap
// in slow motion. Number keys answer. No answer: no change, or the driver's own move.
// In Eras (`eras`, eras spec §7) the era's decision timer takes the place of the card's own
// short one: the race screen holds the race while the card is up, and the timer running out
// answers it (the same no-answer outcome). Without it, exactly as before. In Eras 1-2 (the
// race's era, eras/PitBoard.ts) the call reads as a pit-board message.

import { type ReactNode, useEffect, useRef } from 'react';
import { named, surname } from '../data/names.js';
import { BOARD_ACCENT, PIT_BOARD_CLASS, boardTag } from '../eras/PitBoard.js';
import { useRaceEra } from '../eras/RaceEraContext.js';
import type { QuickCall } from '../game/quickCalls.js';
import { FlagIcon, HeadsetIcon, OvertakeIcon } from './Icons.js';

export function QuickCallCard({
  call,
  ms,
  onAnswer,
  onTimeout,
  eras,
}: {
  call: QuickCall;
  /** How long there is to answer. */
  ms: number;
  onAnswer: (optionId: string) => void;
  onTimeout: () => void;
  /** An Eras race: the era's decision timer (null with the timer turned off: the card waits).
   * The card's own countdown (`ms`) then doesn't run. */
  eras?: { timer: ReactNode };
}) {
  const timeout = useRef(onTimeout);
  timeout.current = onTimeout;
  const ownTimer = !eras;
  useEffect(() => {
    if (!ownTimer) return;
    const id = setTimeout(() => timeout.current(), ms);
    return () => clearTimeout(id);
  }, [ms, ownTimer]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const o = call.options[Number(e.key) - 1];
      if (o) onAnswer(o.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [call, onAnswer]);

  const board = useRaceEra().prompts === 'board';
  const battle = call.kind === 'battle';
  const accent = battle ? 'var(--box)' : 'var(--you)';
  const radioTag = battle
    ? `Battle${call.other ? ` with ${surname(call.other)}` : ''} · slow motion`
    : call.kind === 'trouble'
      ? 'Trouble'
      : call.kind === 'request'
        ? `${named(call.from)} is asking`
        : `${call.from === 'Engineer' ? 'Engineer' : `${named(call.from)} on the radio`} · quick call`;
  const tag = board ? boardTag(call) : radioTag;
  const TagIcon = battle ? OvertakeIcon : call.kind === 'trouble' ? FlagIcon : HeadsetIcon;
  return (
    <section
      aria-label={battle ? 'Battle call' : 'Quick call'}
      className={`quick-call call-plate${board ? ` ${PIT_BOARD_CLASS}` : ''}`}
      style={
        {
          '--accent': board ? BOARD_ACCENT : battle ? 'var(--box-ink)' : accent,
        } as React.CSSProperties
      }
    >
      <div className="flex items-center justify-between gap-2">
        <span className="call-tag">
          <TagIcon size={14} /> {tag}
        </span>
        <span className="call-tag !text-[#8D9692]">Lap {call.lap + 1}</span>
      </div>
      <p
        className={
          board
            ? 'board-line m-0 text-[16px] font-bold leading-snug md:text-[18px]'
            : 'm-0 text-[16px] font-bold leading-snug text-white md:text-[18px]'
        }
      >
        {call.from !== 'Engineer' && (
          <span className="mr-1 font-semibold text-[#8D9692]">{named(call.from)}:</span>
        )}
        {named(call.text)}
      </p>
      {call.stats && (
        <dl className="m-0 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
          {call.stats.map((s) => (
            <div key={s.label} className="flex items-baseline gap-1.5">
              <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8D9692]">
                {s.label}
              </dt>
              <dd className="m-0 font-semibold text-[#D5DAD7]">{named(s.value)}</dd>
            </div>
          ))}
        </dl>
      )}
      {eras ? (
        eras.timer
      ) : (
        <div className="h-1 overflow-hidden bg-[#232927]">
          <div
            className="quick-timer h-full"
            style={{ animationDuration: `${ms}ms`, background: accent }}
          />
        </div>
      )}
      <div
        className={`grid gap-2 ${call.options.length > 2 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2'}`}
      >
        {call.options.map((o, i) => (
          <button key={o.id} type="button" onClick={() => onAnswer(o.id)} className="call-opt">
            <span className="flex w-full items-center justify-between gap-2">
              <span className="label">{named(o.label)}</span>
              <span aria-hidden="true" className="call-key">
                {i + 1}
              </span>
            </span>
            {o.note && <span className="note">{named(o.note)}</span>}
          </button>
        ))}
      </div>
    </section>
  );
}

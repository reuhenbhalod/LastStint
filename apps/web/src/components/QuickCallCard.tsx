// A call between the big moments (crew-chief spec D3, race engineer spec): the engineer or the
// driver asks, the race runs on in slow motion, and after a moment to read it you have a few
// seconds to answer. Number keys answer. No answer: no change, or the driver's own move.
// In Eras (`eras`, eras spec §7) the era's decision timer takes the place of the card's own
// short one: the race screen holds the race while the card is up, and the timer running out
// answers it (the same no-answer outcome). Without it, exactly as before. In Eras 1-2 (the
// race's era, eras/PitBoard.ts) the call reads as a pit-board message.
// A refuelling race (`fuel`, a refuelling reading): an answer that boxes needs a fuel fill
// (owner decision, Nov 7 2026). The card shows the fills with none picked, and its box answers
// wait until one is; the timer running out still answers "no change" (stay out).

import { type ReactNode, useEffect, useRef, useState } from 'react';
import { named, surname } from '../data/names.js';
import { BOARD_ACCENT, PIT_BOARD_CLASS, boardTag } from '../eras/PitBoard.js';
import { useRaceEra } from '../eras/RaceEraContext.js';
import { FuelFillChoice } from '../eras/RefuelControls.js';
import type { FuelFill, RefuelReading } from '../eras/refuel.js';
import type { QuickCall, QuickOption } from '../game/quickCalls.js';
import { FlagIcon, HeadsetIcon, OvertakeIcon } from './Icons.js';

/** True if the answer boxes (its order, or one of the orders it also gives). */
export function answerBoxes(o: QuickOption): boolean {
  return [o.call, ...(o.also ?? [])].some((d) => d?.kind === 'pit');
}

export function QuickCallCard({
  call,
  ms,
  read = 0,
  onAnswer,
  onTimeout,
  eras,
  fuel,
}: {
  call: QuickCall;
  /** How long there is to answer, once the reading time is up. */
  ms: number;
  /** Time to read the call before its clock starts (the bar stays full). */
  read?: number;
  /** `fill`: the fuel fill picked for an answer that boxes (a refuelling race). */
  onAnswer: (optionId: string, fill?: FuelFill) => void;
  onTimeout: () => void;
  /** An Eras race: the era's decision timer (null with the timer turned off: the card waits).
   * The card's own countdown (`ms`) then doesn't run. */
  eras?: { timer: ReactNode };
  /** A refuelling race's reading: an answer that boxes waits for a fill. */
  fuel?: RefuelReading | null;
}) {
  const [fill, setFill] = useState<FuelFill | null>(null);
  const needsFill = !!fuel && call.options.some(answerBoxes);
  const waiting = (o: QuickOption) => needsFill && !fill && answerBoxes(o);
  const answer = (o: QuickOption) => {
    if (waiting(o)) return;
    if (needsFill && fill && answerBoxes(o)) onAnswer(o.id, fill);
    else onAnswer(o.id);
  };
  const answerRef = useRef(answer);
  answerRef.current = answer;
  const timeout = useRef(onTimeout);
  timeout.current = onTimeout;
  const ownTimer = !eras;
  useEffect(() => {
    if (!ownTimer) return;
    const id = setTimeout(() => timeout.current(), read + ms);
    return () => clearTimeout(id);
  }, [ms, read, ownTimer]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const o = call.options[Number(e.key) - 1];
      if (o) answerRef.current(o);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [call]);

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
        <span className="call-tag !text-[#9AA5A0]">Lap {call.lap + 1}</span>
      </div>
      <p
        className={
          board
            ? 'board-line m-0 text-[16px] font-bold leading-snug md:text-[18px]'
            : 'm-0 text-[16px] font-bold leading-snug text-white md:text-[18px]'
        }
      >
        {call.from !== 'Engineer' && (
          <span className="mr-1 font-semibold text-[#9AA5A0]">{named(call.from)}:</span>
        )}
        {named(call.text)}
      </p>
      {call.stats && (
        <dl className="m-0 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
          {call.stats.map((s) => (
            <div key={s.label} className="flex items-baseline gap-1.5">
              <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9AA5A0]">
                {s.label}
              </dt>
              <dd className="m-0 font-semibold text-[#D5DBD7]">{named(s.value)}</dd>
            </div>
          ))}
        </dl>
      )}
      {eras ? (
        eras.timer
      ) : (
        <div className="h-1 overflow-hidden bg-[#252D31]">
          <div
            className="quick-timer h-full"
            style={{
              animationDuration: `${ms}ms`,
              animationDelay: `${read}ms`,
              background: accent,
            }}
          />
        </div>
      )}
      {needsFill && fuel && (
        <FuelFillChoice reading={fuel} value={fill} disabled={false} onPick={setFill} />
      )}
      <div
        className={`grid gap-2 ${call.options.length > 2 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2'}`}
      >
        {call.options.map((o, i) => (
          <button
            key={o.id}
            type="button"
            disabled={waiting(o)}
            title={waiting(o) ? 'Pick a fuel fill first' : undefined}
            onClick={() => answer(o)}
            className={needsFill ? 'call-opt disabled:opacity-40' : 'call-opt'}
          >
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

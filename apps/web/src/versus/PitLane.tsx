// The Versus waiting room (/versus/<CODE> before the car pick): standing in the pit lane, looking
// at the two garages. Your car (the setup from the garage, versus/setup.ts) is parked head-on in
// your pit box; your rival's garage has its shutter down until they join. When they do, the
// shutter rolls up and their car drives into its box (`arriving`, held for a moment by Versus.tsx
// before the car pick). Below, the pit wall holds the race code on a pit board, with the link to
// send. Same look as the garage (Lobby.tsx, the `gp-` classes in index.css).

import { type RoomSeat, VERSUS_CARS, VERSUS_LAPS, versusTrack } from '@laststint/sim';
import { useState } from 'react';
import { CAR_SHAPES, type Shape } from '../components/CarIcon.js';
import { FrontCar, GREY, RED } from './FrontCar.js';
import { loadSetup } from './setup.js';
import type { VersusView } from './useVersus.js';

const MONO = 'mono font-bold';
const TYRE_WORD: Record<string, string> = { SOFT: 'softs', MEDIUM: 'mediums', HARD: 'hards' };
const carName = (id: string) => VERSUS_CARS.find((c) => c.id === id)?.name ?? 'car';
const TYRE_COLOUR: Record<string, string> = {
  SOFT: 'var(--soft)',
  MEDIUM: 'var(--medium)',
  HARD: 'var(--hard)',
};
/** Where each garage and its pit box sit in the scene (its centre on x). */
const BAY_X = [470, 1130] as const;

export function PitLane({
  code,
  view,
  arriving,
  lockedIn,
}: {
  code: string;
  view: VersusView;
  /** The car driving into its box right now: the rival's (you were waiting) or yours (you
   * joined). */
  arriving?: 'me' | 'them';
  /** Your garage setup is locked in (Versus.tsx Match): no car pick, lights out once both are. */
  lockedIn?: boolean;
}) {
  const [copied, setCopied] = useState<'yes' | 'no' | null>(null);
  const link = `${location.origin}/versus/${code}`;
  const track = view.room ? versusTrack(view.room.track) : null;
  const seats = view.room?.seats ?? [null, null];
  const me = view.seat ?? 0;
  const mine = seats[me] ?? null;
  const rival = seats[me === 0 ? 1 : 0] ?? null;
  const setup = loadSetup();
  const myShape = CAR_SHAPES[setup.car] ?? (CAR_SHAPES.balanced as Shape);
  const rivalShape = CAR_SHAPES.balanced as Shape;
  return (
    <div className="gp gp-body flex flex-1 flex-col bg-[#111316] text-[#EDEDED]">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col items-center gap-1 px-4 pt-7 pb-4 text-center sm:px-6">
        <span className={`${MONO} text-[12px] tracking-[0.22em] text-[#FF5A50]`}>
          PIT LANE · {track?.name?.toUpperCase()} · {VERSUS_LAPS} LAPS
        </span>
        <h1 className="gp-display m-0 px-[0.06em] text-[34px] leading-none sm:text-[48px]">
          {rival ? 'Your rival is in' : 'Waiting for your rival'}
        </h1>
        <p aria-live="polite" className="m-0 max-w-[56ch] text-[15px] text-[#B4B7BC]">
          {rival
            ? lockedIn
              ? `Both cars are in their boxes. Your ${carName(setup.car)} on ${TYRE_WORD[setup.tyre] ?? 'mediums'} is locked in: lights out as soon as your rival is ready.`
              : 'Both cars are in their boxes. Off to the car pick.'
            : 'Send them the code or the link below. The car pick starts as soon as they join.'}
        </p>
      </div>

      <section aria-label="The pit lane" className="relative">
        <svg
          viewBox="0 0 1600 760"
          role="img"
          aria-label={
            rival
              ? 'The pit lane: both garages open, both cars in their pit boxes'
              : 'The pit lane: your car in its pit box in front of garage 1; garage 2 has its shutter down and its box is empty'
          }
          className="block h-auto w-full"
        >
          <defs>
            <linearGradient id="pl-floor" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#2E3236" />
              <stop offset="1" stopColor="#3A3E43" />
            </linearGradient>
            <linearGradient id="pl-inside" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#3A3D42" />
              <stop offset="0.35" stopColor="#24272B" />
              <stop offset="1" stopColor="#1A1C1F" />
            </linearGradient>
            <radialGradient id="pl-pool" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#FFF6E1" stopOpacity={0.16} />
              <stop offset="1" stopColor="#FFF6E1" stopOpacity={0} />
            </radialGradient>
            <filter id="pl-glow" x="-20%" y="-200%" width="140%" height="500%">
              <feGaussianBlur stdDeviation="4" />
            </filter>
          </defs>

          {/* The building: wall, gantry with its lights. */}
          <rect x={0} y={0} width={1600} height={372} fill="#121417" />
          {Array.from({ length: 21 }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed wall seams
            <rect key={i} x={i * 80} y={0} width={2} height={372} fill="#0C0D0F" />
          ))}
          <rect x={0} y={22} width={1600} height={28} fill="#1C1E21" />
          {[120, 470, 820, 1170].map((x) => (
            <g key={x}>
              <rect
                x={x}
                y={56}
                width={300}
                height={6}
                rx={3}
                fill="#F6F2E8"
                filter="url(#pl-glow)"
              />
              <rect x={x} y={56} width={300} height={6} rx={3} fill="#F6F2E8" />
            </g>
          ))}

          {/* The garages. */}
          {[0, 1].map((i) => {
            const x = BAY_X[i] as number;
            const open = i === 0 ? !!mine : !!rival;
            const name = i === 0 ? (mine?.name ?? '') : (rival?.name ?? '');
            return (
              <g key={i}>
                <rect x={x - 300} y={96} width={600} height={276} fill="url(#pl-inside)" />
                <ellipse cx={x} cy={110} rx={260} ry={40} fill="url(#pl-pool)" />
                {Array.from({ length: 7 }, (_, j) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: fixed panel seams
                  <rect key={j} x={x - 300 + j * 86} y={96} width={2} height={200} fill="#15171A" />
                ))}
                {/* Tool chests and a monitor rack along the back. */}
                {[-270, -190, 130, 210].map((dx) => (
                  <g key={dx}>
                    <rect x={x + dx} y={300} width={64} height={72} rx={3} fill="#2A0E0D" />
                    {[312, 330, 348].map((y) => (
                      <rect key={y} x={x + dx + 6} y={y} width={52} height={3} fill="#4A1715" />
                    ))}
                  </g>
                ))}
                <rect x={x - 70} y={150} width={140} height={70} rx={4} fill="#0D0E10" />
                <rect x={x - 62} y={158} width={60} height={26} fill="#1F3A4A" opacity={0.8} />
                <rect x={x + 2} y={158} width={60} height={26} fill="#1F3A4A" opacity={0.8} />
                <rect
                  x={x - 300}
                  y={96}
                  width={600}
                  height={276}
                  fill="none"
                  stroke="#08090A"
                  strokeWidth={8}
                />
                {/* The sign over the door. */}
                <rect x={x - 150} y={66} width={300} height={26} rx={3} fill="#0A0B0C" />
                <text
                  x={x}
                  y={85}
                  textAnchor="middle"
                  fill="#EDEDED"
                  fontFamily="IBM Plex Mono, monospace"
                  fontWeight={700}
                  fontSize={14}
                  letterSpacing={3}
                >
                  {`GARAGE ${i + 1}${name ? ` · ${name.toUpperCase().slice(0, 16)}` : ''}`}
                </text>
                {/* The shutter: down while the garage is empty, rolling up as the rival arrives. */}
                {(!open || (i === 1 && arriving === 'them')) && (
                  <g className={open ? 'pl-shutter-up' : undefined}>
                    <rect x={x - 296} y={100} width={592} height={272} fill="#202326" />
                    {Array.from({ length: 22 }, (_, j) => (
                      <rect
                        // biome-ignore lint/suspicious/noArrayIndexKey: fixed shutter slats
                        key={j}
                        x={x - 296}
                        y={100 + j * 12.4}
                        width={592}
                        height={3}
                        fill="#15171A"
                      />
                    ))}
                  </g>
                )}
              </g>
            );
          })}

          {/* The pit lane floor: apron line, the two pit boxes, the fast lane. */}
          <rect x={0} y={372} width={1600} height={388} fill="url(#pl-floor)" />
          <rect x={0} y={372} width={1600} height={6} fill="#E9E9E6" opacity={0.85} />
          {BAY_X.map((x) => (
            <g key={x} stroke="#E8B500" strokeOpacity={0.85} strokeWidth={6} fill="none">
              <path d={`M${x - 240},392 L${x - 320},708 M${x + 240},392 L${x + 320},708`} />
              <path d={`M${x - 60},690 L${x + 60},690`} />
            </g>
          ))}
          <rect x={0} y={722} width={1600} height={6} fill="#E9E9E6" opacity={0.85} />
          <rect x={0} y={728} width={1600} height={32} fill="#24272A" />

          {/* The cars. */}
          <g transform={`translate(${BAY_X[0]},670) scale(1.3)`}>
            <g className={arriving === 'me' ? 'pl-arrive-left' : undefined}>
              <FrontCar
                shape={myShape}
                livery={RED}
                tyre={TYRE_COLOUR[setup.tyre] ?? 'var(--medium)'}
              />
            </g>
          </g>
          {rival && (
            <g transform={`translate(${BAY_X[1]},670) scale(1.3)`}>
              <g className={arriving === 'them' ? 'pl-arrive-right' : undefined}>
                <FrontCar shape={rivalShape} livery={GREY} tyre="#8E9196" />
              </g>
            </g>
          )}
        </svg>

        {/* The two boxes, in words (and for small screens, where the scene's signs are tiny). */}
        <div className="mx-auto grid w-full max-w-[1100px] grid-cols-2 gap-3 px-4 pt-3 sm:px-6">
          <BoxLabel number={1} seat={mine} you />
          <BoxLabel number={2} seat={rival} you={false} />
        </div>
      </section>

      <section aria-labelledby="gp-board" className="gp-wall mt-4 flex-1 px-4 pt-8 pb-12 sm:px-6">
        <div className="mx-auto flex w-full max-w-[560px] flex-col items-center gap-5">
          <div className="flex flex-col items-center">
            <div className="flex flex-col items-center gap-1 rounded-md border-[6px] border-[#2A2B2D] bg-[#121314] px-8 pt-3 pb-4 shadow-[0_18px_40px_rgba(0,0,0,0.5)]">
              <h2
                id="gp-board"
                className={`${MONO} m-0 text-[13px] tracking-[0.24em] text-[#B4B7BC]`}
              >
                RACE CODE
              </h2>
              <span className="gp-display text-[64px] leading-none tracking-[0.18em] text-[#FFD400] sm:text-[84px]">
                {code}
              </span>
            </div>
            <span aria-hidden="true" className="h-8 w-2 bg-[#8E8F8B]" />
          </div>
          {!rival && (
            <div className="flex w-full flex-col gap-2 rounded-2xl border border-white/10 bg-[#0E0F11]/90 p-4">
              <label htmlFor="gp-link" className="text-[14px] font-semibold text-[#C9CBCF]">
                Or send the link
              </label>
              <div className="flex gap-2">
                <input
                  id="gp-link"
                  readOnly
                  value={link}
                  onFocus={(e) => e.currentTarget.select()}
                  className={`${MONO} h-12 min-w-0 flex-1 rounded-md border-2 border-[#3A3D43] bg-black px-3 text-[14px] text-white`}
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard
                      .writeText(link)
                      .then(() => setCopied('yes'))
                      .catch(() => setCopied('no'));
                  }}
                  className="gp-display h-12 rounded-md bg-[var(--gp-red)] px-5 text-[17px] text-white hover:brightness-110"
                >
                  {copied === 'yes' ? 'Copied' : 'Copy link'}
                </button>
              </div>
              <p aria-live="polite" className="m-0 min-h-[20px] text-[13px] text-[#B4B7BC]">
                {copied === 'no'
                  ? "Couldn't copy here: select the link and copy it yourself."
                  : copied === 'yes'
                    ? 'Link copied.'
                    : ''}
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function BoxLabel({ number, seat, you }: { number: number; seat: RoomSeat | null; you: boolean }) {
  return (
    <div className="flex min-w-0 flex-col items-center text-center">
      <span className={`${MONO} text-[11px] tracking-[0.2em] text-[#B4B7BC] sm:text-[12px]`}>
        GARAGE {number}
        {you ? ' · YOU' : ''}
      </span>
      <span className="gp-display max-w-full truncate text-[20px] leading-tight sm:text-[28px]">
        {seat ? seat.name : 'Shutter down'}
      </span>
      <span className="text-[13px] text-[#C9CBCF]">
        {seat ? (seat.connected ? 'In' : 'Dropped') : 'Opens when your rival joins'}
      </span>
    </div>
  );
}

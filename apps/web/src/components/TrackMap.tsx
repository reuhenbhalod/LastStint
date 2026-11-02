// The circuit, centre stage: the race's real outline (data/tracks) with a dot per running car,
// placed by its gap to the leader (track/geometry.ts). The field runs round the lap with the
// lap clock; when a lap's new gaps arrive, cars glide to them (overtakes happen on screen
// rather than in a jump). A car that stopped drives down the real pit lane. The safety car
// leads the field while it's out. Click any car for its card.

import type { RaceModel, RaceState } from '@boxthislap/sim';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { LapClock } from '../game/useGame.js';
import {
  type TrackOutline,
  carsOnTrack,
  ease,
  pitLane,
  pointAlong,
  pointAt,
  polyline,
} from '../track/geometry.js';

const REDUCED =
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Share of a lap tick the cars take to glide to the new gaps (and to drive the pit lane). */
const GLIDE = 0.45;

const TYRE_RING: Record<string, string> = {
  SOFT: 'var(--soft)',
  MEDIUM: 'var(--medium)',
  HARD: 'var(--hard)',
};

export function TrackMap({
  outline,
  race,
  model,
  userSide,
  rival,
  clock,
  selected,
  onSelect,
  dim,
}: {
  outline: TrackOutline;
  race: RaceState;
  model: RaceModel;
  userSide: string;
  rival: string;
  /** The running lap tick (null while paused): the map animates from it. */
  clock: LapClock | null;
  /** The car whose card is open. */
  selected: string | null;
  onSelect: (code: string) => void;
  /** Dim the circuit (a decision is waiting). */
  dim: boolean;
}) {
  const line = useMemo(() => polyline(outline.points), [outline]);
  const lane = useMemo(() => pitLane(outline, line), [outline, line]);
  const path = useMemo(() => `M${outline.points.map((p) => p.join(',')).join('L')}Z`, [outline]);
  const lanePath = useMemo(
    () => (outline.pit ? `M${outline.pit.map((p) => p.join(',')).join('L')}` : null),
    [outline],
  );
  const cars = carsOnTrack(race, model);

  // Progress of the lap tick, from the shared lap clock.
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (!clock || REDUCED) return;
    let raf = 0;
    const frame = (now: number) => {
      setProgress(Math.min(0.995, Math.max(0, (now - clock.start) / clock.ms)));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [clock]);

  // Gaps glide from where each car was shown to the new lap's gaps. While paused there is no
  // glide: the map shows the exact gaps the decision card quotes.
  const glideRef = useRef<{ lap: number; from: Map<string, number>; to: Map<string, number> }>({
    lap: race.lap,
    from: new Map(),
    to: new Map(),
  });
  const to = new Map(cars.map((c) => [c.code, c.behind]));
  const g = glideRef.current;
  if (g.lap !== race.lap) {
    glideRef.current = { lap: race.lap, from: g.to, to };
  } else {
    g.to = to;
  }
  const raw = clock && !REDUCED ? Math.min(1, progress / GLIDE) : 1;
  if (raw >= 1) glideRef.current.from = to;
  const t = ease(raw);
  const behindOf = (code: string, now: number) => {
    const was = glideRef.current.from.get(code);
    return was === undefined ? now : was + (now - was) * t;
  };
  // At the start of a tick the leader is still crossing the line from the last one.
  const lead = clock ? progress : 0;

  const [sx, sy] = outline.points[0] ?? [0, 0];
  // Draw the field first, then the rival, then the player's car on top.
  const drawOrder = [...cars].sort(
    (a, b) => rank(a.code, userSide, rival) - rank(b.code, userSide, rival),
  );
  const sc = race.flag === 'sc' ? pointAt(line, lead + 0.018) : null;

  return (
    <svg
      viewBox={`0 0 ${outline.width} ${outline.height}`}
      className="block h-auto w-full"
      aria-labelledby="track-map-title"
    >
      <title id="track-map-title">{`Track map, lap ${race.lap}. Select a car for its details.`}</title>
      <path
        d={path}
        fill="none"
        stroke="var(--tarmac-edge)"
        strokeWidth={34}
        strokeLinejoin="round"
      />
      <path
        d={path}
        fill="none"
        stroke="var(--tarmac-lane)"
        strokeWidth={26}
        strokeLinejoin="round"
      />
      <path d={path} fill="none" stroke="#5b6662" strokeWidth={1.5} strokeDasharray="6 10" />
      {lanePath && (
        <path
          d={lanePath}
          fill="none"
          stroke="var(--tarmac-lane)"
          strokeWidth={10}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      {lanePath && (
        <path
          d={lanePath}
          fill="none"
          stroke="var(--box)"
          strokeWidth={1.5}
          strokeDasharray="4 6"
        />
      )}
      {lane && outline.pit?.[0] && (
        <text
          x={(outline.pit[Math.floor(outline.pit.length / 2)] as [number, number])[0]}
          y={(outline.pit[Math.floor(outline.pit.length / 2)] as [number, number])[1] - 14}
          fill="var(--box)"
          fontSize={12}
          fontWeight={700}
          fontFamily="var(--mono)"
          textAnchor="middle"
          opacity={0.85}
        >
          PIT
        </text>
      )}
      <rect x={sx - 3} y={sy - 17} width={6} height={34} fill="var(--hard)" />
      {outline.corners.map(([n, x, y]) => (
        <text key={n} x={x + 16} y={y - 12} fill="#7e8985" fontSize={13} fontFamily="var(--mono)">
          T{n}
        </text>
      ))}
      {dim && <rect width={outline.width} height={outline.height} fill="#000" opacity={0.35} />}
      {sc && (
        <g transform={`translate(${sc[0].toFixed(1)},${sc[1].toFixed(1)})`}>
          <rect x={-15} y={-9} width={30} height={18} rx={4} fill="var(--flag)" />
          <text
            y={4.5}
            textAnchor="middle"
            fill="#141716"
            fontSize={12}
            fontWeight={800}
            fontFamily="var(--mono)"
          >
            SC
          </text>
        </g>
      )}
      {drawOrder.map((c) => {
        const car = race.cars[c.code];
        const inLane = lane && car?.pittedThisLap && raw < 1;
        const [x, y] = inLane
          ? pointAlong(lane.path, t)
          : pointAt(line, lead - behindOf(c.code, c.behind));
        const you = c.code === userSide;
        const isRival = c.code === rival;
        const key = you || isRival;
        const fill = you ? 'var(--you)' : isRival ? 'var(--rival)' : 'var(--field)';
        const lit = c.code === selected;
        const ring = TYRE_RING[car?.compound ?? ''] ?? 'var(--tarmac)';
        const lapped = c.lapped && !key;
        return (
          <g
            key={c.code}
            transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`}
            // biome-ignore lint/a11y/useSemanticElements: an SVG group can't be a <button>.
            role="button"
            tabIndex={0}
            aria-label={`${c.code}: details`}
            aria-pressed={lit}
            className="cursor-pointer outline-none [&:focus-visible>circle:first-of-type]:stroke-[var(--ink)]"
            onClick={() => onSelect(c.code)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(c.code);
              }
            }}
          >
            <circle r={24} fill="transparent" stroke="none" />
            {lit && <circle r={21} fill="none" stroke="var(--ink)" strokeWidth={2.5} />}
            <circle
              r={key ? 13 : 9.5}
              fill={lapped ? 'var(--tarmac)' : fill}
              stroke={lapped ? 'var(--field)' : ring}
              strokeWidth={lapped ? 2 : 3}
              strokeDasharray={lapped ? '3 2' : undefined}
            />
            {key ? (
              <text
                y={-20}
                textAnchor="middle"
                fill="#ffffff"
                fontSize={17}
                fontWeight={800}
                fontFamily="var(--display)"
              >
                {c.code}
                {inLane ? ' · PIT' : ''}
              </text>
            ) : (
              <text
                y={3.5}
                textAnchor="middle"
                fill={c.lapped ? 'var(--field)' : 'var(--tarmac)'}
                fontSize={8}
                fontWeight={700}
                fontFamily="var(--mono)"
              >
                {c.code}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function rank(code: string, userSide: string, rival: string): number {
  return code === userSide ? 2 : code === rival ? 1 : 0;
}

// The circuit, centre stage: the race's real outline (data/tracks) with a dot per running car,
// placed by its gap to the leader (track/geometry.ts). Between lap ticks the whole field moves
// round the lap together, so the map reads as a live race; when the game pauses, it stops.

import type { RaceModel, RaceState } from '@boxthislap/sim';
import { useEffect, useMemo, useRef, useState } from 'react';
import { type TrackOutline, carsOnTrack, pointAt, polyline } from '../track/geometry.js';

const REDUCED =
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function TrackMap({
  outline,
  race,
  model,
  userSide,
  rival,
  running,
  lapMs,
  highlight,
}: {
  outline: TrackOutline;
  race: RaceState;
  model: RaceModel;
  userSide: string;
  rival: string;
  /** Laps are ticking: animate the field between ticks. */
  running: boolean;
  /** How long one lap tick lasts on screen. */
  lapMs: number;
  /** A car to call out (tapped in the standings). */
  highlight: string | null;
}) {
  const line = useMemo(() => polyline(outline.points), [outline]);
  const path = useMemo(() => `M${outline.points.map((p) => p.join(',')).join('L')}Z`, [outline]);
  const cars = carsOnTrack(race, model);

  // The leader crosses the line as each lap completes, then runs round toward the next tick.
  const [progress, setProgress] = useState(0);
  const tickStart = useRef(performance.now());
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new lap restarts the leader's run.
  useEffect(() => {
    tickStart.current = performance.now();
    setProgress(0);
  }, [race.lap]);
  useEffect(() => {
    if (!running || REDUCED) return;
    let raf = 0;
    const frame = (now: number) => {
      setProgress(Math.min(0.97, (now - tickStart.current) / lapMs));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [running, lapMs]);

  const [sx, sy] = outline.points[0] ?? [0, 0];
  // Draw the field first, then the rival, then the player's car on top.
  const drawOrder = [...cars].sort(
    (a, b) => rank(a.code, userSide, rival) - rank(b.code, userSide, rival),
  );

  return (
    <svg
      viewBox={`0 0 ${outline.width} ${outline.height}`}
      className="block h-auto w-full"
      role="img"
      aria-label={`Track map, lap ${race.lap}: ${cars.map((c) => c.code).join(', ')}`}
    >
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
      <rect x={sx - 3} y={sy - 17} width={6} height={34} fill="var(--hard)" />
      {outline.corners.map(([n, x, y]) => (
        <text key={n} x={x + 16} y={y - 12} fill="#7e8985" fontSize={13} fontFamily="var(--mono)">
          T{n}
        </text>
      ))}
      {drawOrder.map((c) => {
        const [x, y] = pointAt(line, progress - c.behind);
        const you = c.code === userSide;
        const isRival = c.code === rival;
        const key = you || isRival;
        const fill = you ? 'var(--you)' : isRival ? 'var(--rival)' : 'var(--field)';
        const lit = c.code === highlight;
        return (
          <g key={c.code} transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`}>
            {lit && <circle r={22} fill="none" stroke="var(--ink)" strokeWidth={2} opacity={0.9} />}
            <circle
              r={key ? 13 : 9.5}
              fill={c.lapped && !key ? 'var(--tarmac)' : fill}
              stroke={c.lapped && !key ? 'var(--field)' : 'var(--tarmac)'}
              strokeWidth={c.lapped && !key ? 2 : 2.5}
              strokeDasharray={c.lapped && !key ? '3 2' : undefined}
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

// The circuit, centre stage: the race's real outline (data/tracks) with a dot per running car,
// placed by its gap to the leader (track/geometry.ts). The field runs round the lap with the
// lap clock; when a lap's new gaps arrive, cars glide to them (overtakes happen on screen
// rather than in a jump). A car that stopped drives down the real pit lane. The safety car
// leads the field while it's out. Click any car for its card.

import type { RaceModel, RaceState } from '@boxthislap/sim';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { LapClock } from '../game/useGame.js';
import {
  type PitLane,
  type Polyline,
  type TrackOutline,
  angleAlong,
  carsOnTrack,
  ease,
  flagOn,
  nearestFraction,
  pitLane,
  pitPosition,
  pointAlong,
  pointAt,
  polyline,
  runToFlag,
  spaceOut,
} from '../track/geometry.js';

const REDUCED =
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Share of a lap tick the cars take to glide to the new gaps (and to drive the pit lane). */
const GLIDE = 0.45;

/** Track width in map units (the asphalt band). */
const TRACK = 30;

/** Garage order along the pit lane, entry to exit (2021's, by 2020 constructors' standings
 * in reverse: the champions sit nearest the exit). Short names for the box labels. */
const GARAGES: Array<[string, string]> = [
  ['Williams', 'WIL'],
  ['Haas F1 Team', 'HAA'],
  ['Alfa Romeo Racing', 'ALF'],
  ['AlphaTauri', 'AT'],
  ['Ferrari', 'FER'],
  ['Alpine', 'ALP'],
  ['Aston Martin', 'AM'],
  ['McLaren', 'MCL'],
  ['Red Bull Racing', 'RBR'],
  ['Mercedes', 'MER'],
];
/** Where the garages sit along the drawn lane (fractions of its length). */
const GARAGE_FROM = 0.22;
const GARAGE_TO = 0.62;

function garageAt(team: string | undefined): number {
  const i = GARAGES.findIndex(([t]) => t === team);
  const k = i < 0 ? 0.5 : i / (GARAGES.length - 1);
  return GARAGE_FROM + (GARAGE_TO - GARAGE_FROM) * k;
}

const pathOf = (pts: Array<[number, number]>, closed: boolean) =>
  `M${pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L')}${closed ? 'Z' : ''}`;

/** Points of the lap from fraction a to b (a short stretch: a kerb). */
function stretch(line: Polyline, a: number, b: number, n = 8): Array<[number, number]> {
  return Array.from({ length: n + 1 }, (_, i) => pointAt(line, a + ((b - a) * i) / n));
}

/** The circuit itself: drawn once per outline (cars move over it). */
const TrackArt = memo(function TrackArt({
  outline,
  line,
  lane,
  userTeam,
  rivalTeam,
}: {
  outline: TrackOutline;
  line: Polyline;
  lane: PitLane | null;
  userTeam?: string;
  rivalTeam?: string;
}) {
  const lap = pathOf(outline.points, true);
  const lanePts = lane?.path.points ?? [];
  const lanePath = lanePts.length ? pathOf(lanePts, false) : null;
  // Centre of the circuit, to put corner badges on the outside.
  const cx = outline.points.reduce((t, p) => t + p[0], 0) / outline.points.length;
  const cy = outline.points.reduce((t, p) => t + p[1], 0) / outline.points.length;
  const kerbs = outline.corners.map(([n, x, y]) => {
    const f = nearestFraction(line, [x, y]);
    return { n, d: pathOf(stretch(line, f - 0.012, f + 0.012), false) };
  });
  // Start/finish: across the track at the first point.
  const [sx, sy] = outline.points[0] ?? [0, 0];
  const [nx, ny] = outline.points[1] ?? [sx + 1, sy];
  const startAngle = (Math.atan2(ny - sy, nx - sx) * 180) / Math.PI;
  // Garages, on the side of the lane away from the track.
  const garages = lane
    ? GARAGES.map(([team, short]) => {
        const t = garageAt(team);
        const [gx, gy] = pointAlong(lane.path, t);
        const a = angleAlong(lane.path, t);
        const ox = -Math.sin(a);
        const oy = Math.cos(a);
        // Pick the side further from the track.
        const far = (s: number): number => {
          const p: [number, number] = [gx + ox * s * 12, gy + oy * s * 12];
          const [qx, qy] = pointAt(line, nearestFraction(line, p));
          return Math.hypot(p[0] - qx, p[1] - qy);
        };
        const s = far(1) >= far(-1) ? 1 : -1;
        return {
          team,
          short,
          x: gx + ox * s * 13,
          y: gy + oy * s * 13,
          deg: (a * 180) / Math.PI,
        };
      })
    : [];
  const laneEnd = (t: number) => {
    const [x, y] = pointAlong(lane?.path as Polyline, t);
    return { x, y, deg: (angleAlong(lane?.path as Polyline, t) * 180) / Math.PI };
  };
  const pitIn = lane ? laneEnd(0.12) : null;
  const pitOut = lane ? laneEnd(0.72) : null;

  return (
    <g>
      {/* Run-off */}
      <path
        d={lap}
        fill="none"
        stroke="var(--runoff)"
        strokeWidth={TRACK + 34}
        strokeLinejoin="round"
      />
      {/* Pit lane: under the track, so the exit tunnel passes beneath it */}
      {lanePath && (
        <>
          <path
            d={lanePath}
            fill="none"
            stroke="var(--pit-edge)"
            strokeWidth={16}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path
            d={lanePath}
            fill="none"
            stroke="var(--pit-lane)"
            strokeWidth={12}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path
            d={lanePath}
            fill="none"
            stroke="var(--box)"
            strokeWidth={1.2}
            strokeDasharray="5 5"
            opacity={0.8}
          />
        </>
      )}
      {/* Kerbs: red and white, just wider than the track at each corner */}
      {kerbs.map((k) => (
        <g key={k.n}>
          <path d={k.d} fill="none" stroke="#f3f4f2" strokeWidth={TRACK + 7} strokeLinecap="butt" />
          <path
            d={k.d}
            fill="none"
            stroke="#d63a2f"
            strokeWidth={TRACK + 7}
            strokeDasharray="5 5"
            strokeLinecap="butt"
          />
        </g>
      ))}
      {/* Track edges, then the asphalt */}
      <path
        d={lap}
        fill="none"
        stroke="var(--track-line)"
        strokeWidth={TRACK + 3}
        strokeLinejoin="round"
      />
      <path
        d={lap}
        fill="none"
        stroke="var(--tarmac-lane)"
        strokeWidth={TRACK}
        strokeLinejoin="round"
      />
      <path
        d={lap}
        fill="none"
        stroke="#56615d"
        strokeWidth={1.2}
        strokeDasharray="10 14"
        opacity={0.7}
      />
      {/* Start/finish: a chequered band */}
      <g transform={`translate(${sx},${sy}) rotate(${startAngle})`}>
        {Array.from({ length: 10 }, (_, i) =>
          [0, 1].map((col) => (
            <rect
              key={`${i}-${col}`}
              x={-4 + col * 4}
              y={-TRACK / 2 + i * (TRACK / 10)}
              width={4}
              height={TRACK / 10}
              fill={(i + col) % 2 ? '#141716' : '#f3f4f2'}
            />
          )),
        )}
      </g>
      {/* Pit building and garages */}
      {garages.map((g) => {
        const mine = g.team === userTeam;
        const theirs = g.team === rivalTeam;
        return (
          <g
            key={g.team}
            transform={`translate(${g.x.toFixed(1)},${g.y.toFixed(1)}) rotate(${g.deg.toFixed(1)})`}
          >
            <rect
              x={-8}
              y={-5}
              width={16}
              height={10}
              rx={1.5}
              fill={mine ? 'var(--you)' : theirs ? 'var(--rival)' : 'var(--garage)'}
              stroke="var(--pit-edge)"
              strokeWidth={1}
            />
          </g>
        );
      })}
      {garages
        .filter((g) => g.team === userTeam || g.team === rivalTeam)
        .map((g) => (
          <text
            key={`${g.team}-label`}
            x={g.x}
            y={g.y - 11}
            textAnchor="middle"
            fontSize={10}
            fontWeight={800}
            fontFamily="var(--mono)"
            fill={g.team === userTeam ? 'var(--you)' : 'var(--rival)'}
          >
            {g.short}
          </text>
        ))}
      {[pitIn && { ...pitIn, label: 'PIT IN' }, pitOut && { ...pitOut, label: 'PIT OUT' }].map(
        (m) =>
          m && (
            <g
              key={m.label}
              transform={`translate(${m.x.toFixed(1)},${m.y.toFixed(1)}) rotate(${m.deg.toFixed(1)})`}
            >
              <rect x={-1.5} y={-8} width={3} height={16} fill="var(--flag)" />
              <text
                y={-11}
                textAnchor="middle"
                fontSize={9}
                fontWeight={800}
                fontFamily="var(--mono)"
                fill="var(--flag)"
              >
                {m.label}
              </text>
            </g>
          ),
      )}
      {/* Corner numbers, in badges on the outside */}
      {outline.corners.map(([n, x, y]) => {
        const dx = x - cx;
        const dy = y - cy;
        const len = Math.hypot(dx, dy) || 1;
        const bx = x + (dx / len) * 34;
        const by = y + (dy / len) * 34;
        return (
          <g key={n} transform={`translate(${bx.toFixed(1)},${by.toFixed(1)})`}>
            <circle r={9} fill="var(--paper)" stroke="var(--tarmac-edge)" strokeWidth={1.5} />
            <text
              y={3.5}
              textAnchor="middle"
              fontSize={9.5}
              fontWeight={700}
              fontFamily="var(--mono)"
              fill="#9aa39f"
            >
              {n}
            </text>
          </g>
        );
      })}
    </g>
  );
});

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
  finishing = null,
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
  /** The race is over: run the field to the flag, and say when your car crosses the line. */
  finishing?: { lapMs: number; onCrossed: () => void } | null;
}) {
  const line = useMemo(() => polyline(outline.points), [outline]);
  const lane = useMemo(() => pitLane(outline, line, TRACK), [outline, line]);
  // Gaps become distance at the pace of the lap being driven (the restart lap at racing
  // speed); at the flag, the final gaps at racing speed.
  // (Live play adds neutralizations after crashes: the state knows the next lap's flag.)
  const driven = finishing ? race.flag : (race.nextFlag ?? flagOn(model, race.lap + 1));
  const cars = carsOnTrack(race, model, driven);
  const minGap = 24 / line.length;

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
  // `prev` keeps the last lap's gaps for the whole tick (a stopping car drives to pit entry at
  // its old gap).
  const glideRef = useRef<{
    lap: number;
    from: Map<string, number>;
    prev: Map<string, number>;
    to: Map<string, number>;
  }>({
    lap: race.lap,
    from: new Map(),
    prev: new Map(),
    to: new Map(),
  });
  const to = new Map(cars.map((c) => [c.code, c.behind]));
  const g = glideRef.current;
  if (g.lap !== race.lap) {
    glideRef.current = { lap: race.lap, from: g.to, prev: g.to, to };
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

  // The run to the flag, timed from when the race finished.
  const [sinceFlag, setSinceFlag] = useState(0);
  const crossed = useRef(false);
  const onCrossed = finishing?.onCrossed;
  const finishMs = finishing?.lapMs;
  useEffect(() => {
    if (!finishMs) return;
    const start = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      setSinceFlag((now - start) / finishMs);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [finishMs]);
  // A car that stopped on the lap just run drives the pit lane this tick (not at the flag).
  const stopping = (code: string) =>
    !finishing && !!lane && !REDUCED && !!race.cars[code]?.pittedThisLap;
  const pitAt = (code: string, after: number) =>
    pitPosition(
      lead,
      glideRef.current.prev.get(code) ?? after,
      after,
      lane as PitLane,
      garageAt(race.cars[code]?.team),
    );
  const shown = spaceOut(
    new Map(
      cars
        .filter((c) => !stopping(c.code))
        .map((c) => [c.code, finishing ? c.behind : behindOf(c.code, c.behind)]),
    ),
    minGap,
  );
  const atFlag = finishing ? runToFlag(shown, REDUCED ? 99 : sinceFlag) : null;
  // Your car crossing the line ends it; if it's out of the race, the winner does.
  const you = atFlag?.get(userSide);
  const youDone = you ? you.finished : !!atFlag && [...atFlag.values()].some((c) => c.finished);
  useEffect(() => {
    if (youDone && !crossed.current) {
      crossed.current = true;
      onCrossed?.();
    }
  }, [youDone, onCrossed]);
  const positionOf = (code: string): number =>
    atFlag ? (atFlag.get(code)?.at ?? 0) : lead - (shown.get(code) ?? 0);

  // Draw the field first, then the rival, then the player's car on top.
  const drawOrder = [...cars].sort(
    (a, b) => rank(a.code, userSide, rival) - rank(b.code, userSide, rival),
  );
  const sc = !finishing && driven === 'sc' ? pointAt(line, lead + 0.018) : null;

  return (
    <svg
      viewBox={`0 0 ${outline.width} ${outline.height}`}
      className="block h-auto max-h-[52vh] w-full"
      aria-labelledby="track-map-title"
    >
      <title id="track-map-title">{`Track map, lap ${race.lap}. Select a car for its details.`}</title>
      <TrackArt
        outline={outline}
        line={line}
        lane={lane}
        userTeam={race.cars[userSide]?.team}
        rivalTeam={race.cars[rival]?.team}
      />
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
        const pit = stopping(c.code) ? pitAt(c.code, c.behind) : null;
        const inLane = pit?.lane != null;
        const [x, y] =
          pit && pit.lane !== null && lane
            ? pointAlong(lane.path, pit.lane)
            : pointAt(line, pit && pit.at !== null ? pit.at : positionOf(c.code));
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
            {key && <circle r={20} fill={fill} opacity={0.22} />}
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

// The circuit, centre stage: the race's real outline (data/tracks) with a dot per running car,
// placed by its gap on the field's clock (track/motion.ts). The field runs round the lap with
// the lap clock; when a lap's new gaps arrive, cars glide to them (overtakes happen on screen
// rather than in a jump). A car that stops drives down the real pit lane. The safety car
// leads the field while it's out. Click any car for its card.

import { type RaceModel, type RaceState, engineerConfig } from '@boxthislap/sim';
import { type MutableRefObject, memo, useEffect, useMemo, useRef, useState } from 'react';
import type { LapClock } from '../game/useGame.js';
import { cornerPoint } from '../track/corners.js';
import { garagesFor, seasonOf } from '../track/garages.js';
import {
  type PitLane,
  type Polyline,
  type TrackOutline,
  angleAlong,
  carsOnTrack,
  flagOn,
  nearestFraction,
  pitLane,
  pointAlong,
  pointAt,
  polyline,
} from '../track/geometry.js';
import { MapMotion } from '../track/motion.js';

const REDUCED =
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Track width in map units (the asphalt band). */
const TRACK = 30;

/** Where the garages sit along the drawn lane (fractions of its length). */
const GARAGE_FROM = 0.22;
const GARAGE_TO = 0.62;

/** Where a team's garage sits on the drawn lane (track/garages.ts has each season's order). */
function garageAt(team: string | undefined, garages: Array<[string, string]>): number {
  const i = garages.findIndex(([t]) => t === team);
  const k = i < 0 ? 0.5 : i / (garages.length - 1);
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
  garageList,
  line,
  lane,
  userTeam,
  rivalTeam,
}: {
  outline: TrackOutline;
  garageList: Array<[string, string]>;
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
    ? garageList.map(([team, short]) => {
        const t = garageAt(team, garageList);
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
          <g key={`${n}-${x}-${y}`} transform={`translate(${bx.toFixed(1)},${by.toFixed(1)})`}>
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
  fight = null,
  flash = null,
  userBox = null,
  motionRef,
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
  /** A battle this lap (race engineer spec): the other car, and the corner it's fought into. */
  fight?: { other: string; corner: number } | null;
  /** A battle's result, shown at its corner for a moment. */
  flash?: { text: string; good: boolean; corner: number } | null;
  /** Your BOX not yet in the race model: its lap (the car turns in at the end of it). */
  userBox?: number | null;
  /** Filled with the map's motion (the race screen asks it whether a BOX makes this lap). */
  motionRef?: MutableRefObject<MapMotion | null>;
}) {
  const line = useMemo(() => polyline(outline.points), [outline]);
  const lane = useMemo(() => pitLane(outline, line, TRACK), [outline, line]);
  const garages = useMemo(
    () =>
      garagesFor(
        seasonOf(model.race.id),
        model.drivers.map((d) => d.team),
      ),
    [model],
  );
  // Gaps become distance at the pace of the lap being driven (the restart lap at racing
  // speed); at the flag, the final gaps at racing speed.
  // (Live play adds neutralizations after crashes: the state knows the next lap's flag.)
  const driven = finishing ? race.flag : (race.nextFlag ?? flagOn(model, race.lap + 1));
  const cars = carsOnTrack(race, model, driven);

  // Where every car is drawn, frame by frame (track/motion.ts: the field's clock, the glide to
  // each lap's gaps, and each stop down the pit lane).
  const teams = useMemo(() => new Map(model.drivers.map((d) => [d.code, d.team])), [model]);
  const motion = useMemo(
    () => new MapMotion(line, lane, (code) => garageAt(teams.get(code), garages), 24 / line.length),
    [line, lane, teams, garages],
  );
  if (motionRef) motionRef.current = motion;

  // Progress of the lap tick, from the shared lap clock. While paused, frames keep coming until
  // every car has eased into place.
  const [progress, setProgress] = useState(0);
  const [, setFrame] = useState(0);
  useEffect(() => {
    if (REDUCED) return;
    let raf = 0;
    const frame = (now: number) => {
      if (clock) setProgress(Math.min(0.995, Math.max(0, (now - clock.start) / clock.ms)));
      else if (motion.moving) setFrame((n) => n + 1);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [clock, motion]);

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

  // Worked out from the clock at render time: the stored progress only drives re-renders, and
  // on the first frame of a new lap tick it still holds the last tick's value.
  const now = clock
    ? Math.min(0.995, Math.max(0, (performance.now() - clock.start) / clock.ms))
    : 0;
  void progress;
  const places = motion.frame({
    race,
    model,
    flag: driven,
    progress: now,
    smooth: !REDUCED,
    userSide,
    userBox,
    userExtra: (race.engineer?.damage ?? 0) > 0 ? (engineerConfig(model)?.noseCost ?? 0) : 0,
    sinceFlag: finishing ? sinceFlag : null,
  });
  // Your car crossing the line ends it; if it's out of the race, the winner does.
  const youDone = finishing
    ? (places.get(userSide)?.finished ?? [...places.values()].some((c) => c.finished === true))
    : false;
  useEffect(() => {
    if (youDone && !crossed.current) {
      crossed.current = true;
      onCrossed?.();
    }
  }, [youDone, onCrossed]);

  // Draw the field first, then the rival, then the player's car on top.
  const drawOrder = [...cars].sort(
    (a, b) => rank(a.code, userSide, rival) - rank(b.code, userSide, rival),
  );
  // The safety car runs just ahead of the leader on track.
  const leader = race.order.find((c) => places.get(c) && !places.get(c)?.lane);
  const leadAt = leader ? places.get(leader)?.at : undefined;
  const sc =
    !finishing && driven === 'sc' && leadAt !== undefined ? pointAt(line, leadAt + 0.018) : null;

  return (
    <svg
      viewBox={`0 0 ${outline.width} ${outline.height}`}
      // Phone/tablet: full width at the outline's shape. Laptop: fills its box (the rest of the
      // column), keeping the shape.
      className="block h-auto w-full xl:absolute xl:inset-0 xl:h-full"
      aria-labelledby="track-map-title"
    >
      <title id="track-map-title">{`Track map, lap ${race.lap}. Select a car for its details.`}</title>
      <TrackArt
        outline={outline}
        garageList={garages}
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
        const place = places.get(c.code);
        if (!place) return null;
        const { x, y } = place;
        const inLane = place.lane;
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
      {fight &&
        (() => {
          const at = cornerPoint(outline, fight.corner);
          const other = motion.xyOf(fight.other);
          const me = motion.xyOf(userSide);
          // "NOW" as your car reaches the corner.
          const cornerF = at ? nearestFraction(line, at) : null;
          const mine = motion.atOf(userSide);
          const d =
            cornerF !== null && mine !== undefined
              ? ((((cornerF - mine + 0.5) % 1) + 1) % 1) - 0.5
              : 1;
          const now = Math.abs(d) < 0.04;
          return (
            <g pointerEvents="none">
              {other && me && (
                <line
                  x1={me[0]}
                  y1={me[1]}
                  x2={other[0]}
                  y2={other[1]}
                  stroke="var(--box)"
                  strokeWidth={4}
                  strokeDasharray="6 4"
                  className="battle-ring"
                />
              )}
              {other && (
                <circle
                  cx={other[0]}
                  cy={other[1]}
                  r={18}
                  fill="none"
                  stroke="var(--box)"
                  strokeWidth={3.5}
                  className="battle-ring"
                />
              )}
              {at && (
                <g transform={`translate(${at[0].toFixed(1)},${at[1].toFixed(1)})`}>
                  <circle
                    r={now ? 34 : 26}
                    fill="var(--box)"
                    opacity={now ? 0.35 : 0.18}
                    className="battle-ring"
                  />
                  <circle r={6} fill="var(--box)" />
                  <rect x={-46} y={-46} width={92} height={24} rx={6} fill="var(--box)" />
                  <text
                    y={-29}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize={14}
                    fontWeight={800}
                    fontFamily="var(--display)"
                  >
                    {now ? 'NOW' : `T${fight.corner} · MOVE`}
                  </text>
                </g>
              )}
            </g>
          );
        })()}
      {flash &&
        (() => {
          const at = cornerPoint(outline, flash.corner) ?? motion.xyOf(userSide);
          if (!at) return null;
          const w = Math.max(90, flash.text.length * 11 + 24);
          return (
            <g
              transform={`translate(${at[0].toFixed(1)},${at[1].toFixed(1)})`}
              pointerEvents="none"
              className="battle-flash"
            >
              <rect
                x={-w / 2}
                y={-62}
                width={w}
                height={34}
                rx={8}
                fill={flash.good ? 'var(--you)' : 'var(--box)'}
              />
              <text
                y={-39}
                textAnchor="middle"
                fill={flash.good ? '#08231f' : '#fff'}
                fontSize={19}
                fontWeight={800}
                fontFamily="var(--display)"
              >
                {flash.text}
              </text>
            </g>
          );
        })()}
    </svg>
  );
}

function rank(code: string, userSide: string, rival: string): number {
  return code === userSide ? 2 : code === rival ? 1 : 0;
}

// The circuit, centre stage: the race's real outline (data/tracks) with a dot per running car,
// placed by its gap on the field's clock (track/motion.ts). The field runs round the lap with
// the lap clock; when a lap's new gaps arrive, cars glide to them (overtakes happen on screen
// rather than in a jump). A car that stops drives down the real pit lane. The safety car
// leads the field while it's out. Click any car for its card.

import { type RaceModel, type RaceNote, type RaceState, engineerConfig } from '@boxthislap/sim';
import { type MutableRefObject, memo, useEffect, useMemo, useRef, useState } from 'react';
import { neutralCar } from '../game/neutral.js';
import type { BattleLine } from '../game/quickCalls.js';
import { outReason, realRetirement, shortWhy } from '../game/retired.js';
import { type LapClock, clockProgress } from '../game/useGame.js';
import {
  BRAKE_BEFORE,
  type Box,
  LINE_COLOR,
  cameraBox,
  insideSide,
  lineSide,
  lineStretch,
  normalAt,
  offsetPath,
} from '../track/battle.js';
import { cornerPoint } from '../track/corners.js';
import type { MapFeed } from '../track/feed.js';
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
import { CarIcon } from './CarIcon.js';

const REDUCED =
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Track width in map units (the asphalt band). */
const TRACK = 30;

/** Share of the way to its target the battle cam moves each frame. */
const CAM_EASE = 0.08;

/** A battle on the map (battles and trust spec D1). */
export interface BattleView {
  other: string;
  /** The corner's number, and where it is (a fraction of the lap). */
  corner: number;
  at: number;
  /** The options drawn: their number on the card, and their line. */
  options: Array<{ n: number; line: BattleLine }>;
  /** The line called (null until then). */
  chosen: BattleLine | null;
  /** The camera is on the battle. */
  zoom: boolean;
  /** The result: from tick progress `at`, the two cars take their places after the lap. */
  swap: { at: number } | null;
}

/** The battle drawn on the track: the braking zone, the corner, and a numbered, coloured line
 * per option (inside, outside...); once called, only the chosen line stays lit. */
function BattleLines({
  line,
  battle,
  glyph,
}: {
  line: Polyline;
  battle: BattleView;
  glyph: number;
}) {
  const inside = insideSide(line, battle.at);
  const [from, to] = lineStretch(battle.at);
  const [cx, cy] = pointAt(line, battle.at);
  const brake = battle.at - BRAKE_BEFORE;
  const [bx, by] = pointAt(line, brake);
  const [bnx, bny] = normalAt(line, brake);
  const half = TRACK / 2 + 3;
  // Options with no line of their own (wait, let him by) sit as tags beside the braking zone,
  // on the outside of the track.
  const tagAt: [number, number] = [
    bx - bnx * inside * (half + 44),
    by - bny * inside * (half + 44) + 24 * glyph,
  ];
  return (
    <g pointerEvents="none">
      {/* The braking zone: a stripe across the track */}
      <line
        x1={bx - bnx * half}
        y1={by - bny * half}
        x2={bx + bnx * half}
        y2={by + bny * half}
        stroke="#ffffff"
        strokeWidth={5}
      />
      <line
        x1={bx - bnx * half}
        y1={by - bny * half}
        x2={bx + bnx * half}
        y2={by + bny * half}
        stroke="#d63a2f"
        strokeWidth={5}
        strokeDasharray="4 4"
      />
      <text
        x={bx + bnx * (half + 14) * -inside}
        y={by + bny * (half + 14) * -inside + 4}
        textAnchor="middle"
        fontSize={11 * glyph}
        fontWeight={800}
        fontFamily="var(--mono)"
        fill="#ffffff"
      >
        BRAKE
      </text>
      {/* One line a side into the corner, in the colour of the option called (or the first
          on that side); each option's number sits beside the track on its side. */}
      {([1, -1] as const).map((sideSign) => {
        const opts = battle.options.filter(
          (o) => Math.sign(lineSide(o.line, inside)) === sideSign * inside,
        );
        if (!opts.length) return null;
        const called = opts.find((o) => o.line === battle.chosen);
        const lit = battle.chosen === null || !!called;
        const color = LINE_COLOR[(called ?? opts[0])?.line ?? 'inside'];
        const pts = offsetPath(line, from, to, sideSign * inside * TRACK * 0.32);
        const d = `M${pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L')}`;
        const end = pts[pts.length - 1] as [number, number];
        const prev = pts[pts.length - 2] as [number, number];
        const a = Math.atan2(end[1] - prev[1], end[0] - prev[0]);
        const shown = battle.chosen === null ? opts : called ? [called] : [];
        return (
          <g key={sideSign} opacity={lit ? 1 : 0.15}>
            <path
              d={d}
              fill="none"
              stroke={color}
              strokeWidth={called ? 6 : 4}
              strokeLinecap="round"
              strokeDasharray={called?.line === 'boost' ? '7 5' : undefined}
            />
            <polygon
              points="0,0 -11,-6 -11,6"
              fill={color}
              transform={`translate(${end[0].toFixed(1)},${end[1].toFixed(1)}) rotate(${((a * 180) / Math.PI).toFixed(1)})`}
            />
            {shown.map((o, k) => {
              const [bx2, by2] = offsetPath(
                line,
                from + 0.004 + k * 0.009,
                from + 0.004 + k * 0.009,
                sideSign * inside * (TRACK / 2 + 14),
                1,
              )[0] as [number, number];
              return (
                <g key={o.line} transform={`translate(${bx2.toFixed(1)},${by2.toFixed(1)})`}>
                  <circle
                    r={11 * glyph}
                    fill={LINE_COLOR[o.line]}
                    stroke="#141716"
                    strokeWidth={2}
                  />
                  <text
                    y={4.5 * glyph}
                    textAnchor="middle"
                    fontSize={13 * glyph}
                    fontWeight={800}
                    fontFamily="var(--display)"
                    fill="#141716"
                  >
                    {o.n}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })}
      {/* Options with no line: tags before the braking zone. */}
      {battle.options
        .filter((o) => lineSide(o.line, inside) === 0)
        .filter((o) => battle.chosen === null || battle.chosen === o.line)
        .map((o, k) => (
          <g
            key={o.line}
            transform={`translate(${tagAt[0].toFixed(1)},${(tagAt[1] - k * 24 * glyph).toFixed(1)})`}
          >
            <rect
              x={-38 * glyph}
              y={-34 * glyph}
              width={76 * glyph}
              height={20 * glyph}
              rx={6 * glyph}
              fill={LINE_COLOR[o.line]}
            />
            <text
              y={-19.5 * glyph}
              textAnchor="middle"
              fontSize={12 * glyph}
              fontWeight={800}
              fontFamily="var(--display)"
              fill="#141716"
            >
              {o.n} · {o.line === 'let' ? 'LET BY' : 'WAIT'}
            </text>
          </g>
        ))}
      {/* The corner */}
      <circle
        cx={cx}
        cy={cy}
        r={26}
        fill="none"
        stroke="var(--box)"
        strokeWidth={3}
        className="battle-ring"
      />
      <g transform={`translate(${cx.toFixed(1)},${(cy - 34).toFixed(1)})`}>
        <rect
          x={-22 * glyph}
          y={-12 * glyph}
          width={44 * glyph}
          height={22 * glyph}
          rx={6 * glyph}
          fill="var(--box)"
        />
        <text
          y={4.5 * glyph}
          textAnchor="middle"
          fontSize={14 * glyph}
          fontWeight={800}
          fontFamily="var(--display)"
          fill="#ffffff"
        >
          T{battle.corner}
        </text>
      </g>
    </g>
  );
}

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
  battle = null,
  flash = null,
  ahead = null,
  userBox = null,
  motionRef,
  carShapes,
  feedRef,
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
  /** A battle this lap (battles and trust spec): drawn on the track, the camera on it. */
  battle?: BattleView | null;
  /** The lap being shown, run ahead (GameSession.previewLap): cars move toward its gaps all
   * lap, a car that retires on it stops on track, a puncture shows. */
  ahead?: { race: RaceState; notes: RaceNote[] } | null;
  /** A battle's result, shown at its corner for a moment. */
  flash?: { text: string; good: boolean; corner: number } | null;
  /** Your BOX not yet in the race model: its lap (the car turns in at the end of it). */
  userBox?: number | null;
  /** Filled with the map's motion (the race screen asks it whether a BOX makes this lap). */
  motionRef?: MutableRefObject<MapMotion | null>;
  /** Versus: each player's car shape (CarIcon). */
  carShapes?: Record<string, string>;
  /** Filled each frame with where every car is (the 3D view follows it). */
  feedRef?: MutableRefObject<MapFeed | null>;
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
  // The battle cam's view, easing toward its target each frame.
  const camRef = useRef<Box>({ x: 0, y: 0, w: outline.width, h: outline.height });
  const camMoving = useRef(false);
  // Which way each main car points: along the track, or (in the pit lane) the way it last moved.
  const headings = useRef(new Map<string, { x: number; y: number; deg: number }>());
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
      if (clock && clock.frozen === undefined) setProgress(clockProgress(clock, now));
      else if (motion.moving || camMoving.current) setFrame((n) => n + 1);
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
  const now = clock ? clockProgress(clock) : 0;
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
    ahead: finishing ? null : (ahead?.race ?? null),
    hold: battle ? { codes: [userSide, battle.other], until: battle.swap?.at ?? null } : null,
    stopAt: (code) => {
      const real = realRetirement(model.race.id, code, race.lap + 1);
      const pt = real?.turn ? cornerPoint(outline, real.turn) : null;
      return pt ? nearestFraction(line, pt) : null;
    },
    outWhy: (code) => outReason(model.race.id, code, race.lap + 1, ahead?.notes ?? []),
  });
  // A puncture on the lap being shown: the car limps round with it.
  const punctured = new Set(
    (ahead?.notes ?? [])
      .filter((n) => n.lap === race.lap + 1 && n.detail === 'puncture' && n.driver)
      .map((n) => n.driver as string),
  );
  // Cars stopped on track (out of the race), drawn where they stopped; and the car behind a
  // neutralization the model doesn't run, parked where it stopped while the SC or VSC is out.
  const stopped: Array<[string, { x: number; y: number; out?: string }]> = [
    ...places.entries(),
  ].filter(([, p]) => p.out !== undefined);
  const phantom = finishing ? null : neutralCar(model, race.lap + 1, driven);
  if (phantom) {
    const corner = phantom.turn ? cornerPoint(outline, phantom.turn) : null;
    const [x, y] = corner
      ? pointAt(line, nearestFraction(line, corner))
      : pointAt(line, 0.2 + (0.6 * ((phantom.driver.charCodeAt(0) * 7 + phantom.from) % 97)) / 97);
    stopped.push([phantom.driver, { x, y, out: shortWhy(phantom.status) }]);
  }
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
  if (feedRef) {
    feedRef.current = {
      places,
      team: teams,
      compound: new Map(Object.entries(race.cars).map(([code, c]) => [code, c.compound])),
      userSide,
      rival,
      sc: sc && leadAt !== undefined ? leadAt + 0.018 : null,
      battle: battle?.zoom ? { codes: [userSide, battle.other], at: battle.at } : null,
      selected,
      shapes: carShapes ?? null,
    };
  }

  // The battle cam (battles and trust spec D1): the view eases onto the two cars and the
  // corner, and back out to the whole circuit after.
  const full: Box = { x: 0, y: 0, w: outline.width, h: outline.height };
  const meXY = places.get(userSide);
  const otherXY = battle ? places.get(battle.other) : undefined;
  const cornerXY = battle ? pointAt(line, battle.at) : null;
  const want =
    battle?.zoom && meXY && cornerXY && !REDUCED
      ? cameraBox(
          [
            [meXY.x, meXY.y],
            cornerXY,
            ...(otherXY ? [[otherXY.x, otherXY.y] as [number, number]] : []),
          ],
          outline,
        )
      : full;
  const cam = camRef.current;
  const next = {
    x: cam.x + (want.x - cam.x) * CAM_EASE,
    y: cam.y + (want.y - cam.y) * CAM_EASE,
    w: cam.w + (want.w - cam.w) * CAM_EASE,
    h: cam.h + (want.h - cam.h) * CAM_EASE,
  };
  const settled = Math.abs(next.w - want.w) < 0.5 && Math.abs(next.x - want.x) < 0.5;
  camRef.current = settled ? want : next;
  camMoving.current = !settled;
  const view = camRef.current;
  // Cars and labels shrink a little as the camera closes in, so the corner stays readable.
  const glyph = Math.max(0.55, Math.min(1, view.w / outline.width + 0.15));
  // Two main cars side by side: their names move apart so both read.
  const labelShift = (code: string): number => {
    const a = places.get(userSide);
    const b = places.get(rival);
    if (!a || !b || (code !== userSide && code !== rival)) return 0;
    if (Math.hypot(a.x - b.x, a.y - b.y) > 40 / glyph) return 0;
    const left = a.x <= b.x ? userSide : rival;
    return code === left ? -24 : 24;
  };
  const inBattle = (code: string) => !!battle?.zoom && (code === userSide || code === battle.other);
  // Your car (and the other) on the chosen line through the braking zone and the corner.
  const lateral = (code: string, at: number): [number, number] => {
    if (!battle?.chosen || !inBattle(code)) return [0, 0];
    const d = ((((at - battle.at + 0.5) % 1) + 1) % 1) - 0.5;
    if (d < -0.06 || d > 0.02) return [0, 0];
    const side = lineSide(battle.chosen, insideSide(line, battle.at));
    if (!side) return [0, 0];
    const k = Math.min(1, (d + 0.06) / 0.02) * Math.min(1, (0.02 - d) / 0.01);
    const [nx, ny] = normalAt(line, at);
    const w = TRACK * 0.28 * (code === userSide ? side : -side) * k;
    return [nx * w, ny * w];
  };

  return (
    <svg
      viewBox={`${view.x.toFixed(1)} ${view.y.toFixed(1)} ${view.w.toFixed(1)} ${view.h.toFixed(1)}`}
      // Phone/tablet: full width at the outline's shape. Laptop: fills its box (the rest of the
      // column), keeping the shape.
      className="absolute inset-0 block h-full w-full"
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
      {battle?.zoom && (
        <rect width={outline.width} height={outline.height} fill="#000" opacity={0.3} />
      )}
      {battle && <BattleLines line={line} battle={battle} glyph={glyph} />}
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
      {/* Cars stopped on track: a yellow-flag glow, the car greyed, a warning sign and why. */}
      {stopped.map(([code, p]) => (
        <g
          key={`out-${code}`}
          transform={`translate(${p.x.toFixed(1)},${p.y.toFixed(1)}) scale(${glyph.toFixed(3)})`}
          pointerEvents="none"
        >
          <circle r={26} fill="var(--flag)" opacity={0.22} className="battle-ring" />
          <circle r={10} fill="var(--tarmac)" stroke="var(--box)" strokeWidth={3} />
          <path d="M-6,5 L6,-5 M-6,-5 L6,5" stroke="var(--box)" strokeWidth={2.5} />
          <g transform="translate(0,-24)">
            <polygon points="0,-9 9,7 -9,7" fill="var(--flag)" stroke="#141716" strokeWidth={1.5} />
            <text y={5} textAnchor="middle" fontSize={11} fontWeight={900} fill="#141716">
              !
            </text>
          </g>
          <g transform="translate(0,22)">
            <rect x={-46} y={-9} width={92} height={18} rx={5} fill="#141716" opacity={0.9} />
            <text
              y={4}
              textAnchor="middle"
              fontSize={11}
              fontWeight={800}
              fontFamily="var(--mono)"
              fill="#ffffff"
            >
              {code} OUT · {p.out}
            </text>
          </g>
        </g>
      ))}
      {drawOrder.map((c) => {
        const car = race.cars[c.code];
        const place = places.get(c.code);
        if (!place || place.out !== undefined) return null;
        const [lx, ly] = place.lane ? [0, 0] : lateral(c.code, place.at);
        const x = place.x + lx;
        const y = place.y + ly;
        const inLane = place.lane;
        const you = c.code === userSide;
        const isRival = c.code === rival;
        const fighting = inBattle(c.code);
        const key = you || isRival || fighting;
        const faded = !!battle?.zoom && !fighting;
        const fill = you
          ? 'var(--you)'
          : isRival
            ? 'var(--rival)'
            : fighting
              ? 'var(--box)'
              : 'var(--field)';
        const lit = c.code === selected;
        const ring = TYRE_RING[car?.compound ?? ''] ?? 'var(--tarmac)';
        const lapped = c.lapped && !key;
        let deg = 0;
        if (key) {
          const last = headings.current.get(c.code);
          if (!inLane) {
            const [ax, ay] = pointAt(line, place.at - 0.004);
            const [bx, by] = pointAt(line, place.at + 0.004);
            deg = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
          } else if (last && Math.hypot(x - last.x, y - last.y) > 0.4) {
            deg = (Math.atan2(y - last.y, x - last.x) * 180) / Math.PI;
          } else deg = last?.deg ?? 0;
          headings.current.set(c.code, { x, y, deg });
        }
        return (
          <g
            key={c.code}
            transform={`translate(${x.toFixed(1)},${y.toFixed(1)}) scale(${glyph.toFixed(3)})`}
            opacity={faded ? 0.35 : 1}
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
            {key ? (
              <g transform={`rotate(${deg.toFixed(1)}) scale(0.82)`}>
                <CarIcon color={fill} tyre={ring} shape={carShapes?.[c.code]} />
              </g>
            ) : (
              <circle
                r={9.5}
                fill={lapped ? 'var(--tarmac)' : fill}
                stroke={lapped ? 'var(--field)' : ring}
                strokeWidth={lapped ? 2 : 3}
                strokeDasharray={lapped ? '3 2' : undefined}
              />
            )}
            {key ? (
              <text
                x={labelShift(c.code)}
                y={-24}
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
            {punctured.has(c.code) && !inLane && (
              <g transform={`translate(0,${key ? -44 : -22})`}>
                <rect x={-36} y={-9} width={72} height={17} rx={5} fill="var(--box)" />
                <text
                  y={4}
                  textAnchor="middle"
                  fontSize={10.5}
                  fontWeight={800}
                  fontFamily="var(--mono)"
                  fill="#ffffff"
                >
                  PUNCTURE
                </text>
              </g>
            )}
          </g>
        );
      })}
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
                fill={flash.good ? 'var(--good)' : 'var(--box)'}
              />
              <text
                y={-39}
                textAnchor="middle"
                fill={flash.good ? 'var(--good-ink)' : '#fff'}
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

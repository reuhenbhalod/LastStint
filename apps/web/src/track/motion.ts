// Where each car is drawn on the track map, frame by frame (pit fix 2).
//
// The map's clock runs at the pace of the field: each lap tick it moves on by the median lap of
// the cars that didn't stop, drifting a little toward the leader. One car's slow lap (a stop, a
// puncture, a spin) or a change of leader then moves only that car, never the whole field. Each
// car sits `offset` laps behind the clock, a distance: each lap it moves by the time it gained
// or lost on the clock at that lap's pace (so a safety car closes the field up lap by lap, not
// at a stroke). A new lap's offsets glide in over the first part of the tick, so an overtake
// happens on screen.
//
// A stop is drawn on its own timeline: the car reaches pit entry when its old gap puts it there,
// drives down the lane (in to its garage, a pause, out) and rejoins at pit exit just as its new
// gap puts it there, however the stop falls across lap ticks (a car well behind the leader is
// still on its in-lap when the leader starts the next lap).

import { type RaceModel, type RaceState, rivalCover } from '@boxthislap/sim';
import {
  type PitLane,
  type Polyline,
  carsOnTrack,
  ease,
  flagOn,
  lapTime,
  pointAlong,
  pointAt,
  runToFlag,
  spaceOut,
} from './geometry.js';

/** Share of a lap tick the cars take to glide to the new lap's gaps. */
const GLIDE = 0.45;
/** Share of the way to its target gap a drawn car moves each frame (eases out small jumps:
 * spacing, a pause). It eases the gap, not the position, so a car never trails the clock. */
const EASE_PER_FRAME = 0.18;
/** On-screen move (map units) beyond a frame's driving that is spread over a few frames. */
const JUMP_PX = 24;
/** Share of its lead over the map's clock the leader pulls the clock each lap. */
const ANCHOR = 0.2;
/** A BOX this close (in ticks) to your car reaching pit entry is too late for this lap. */
export const ENTRY_MARGIN = 0.03;

/** Lane timeline: in to the garage over this share, paused at it until OUT, then out. */
const LANE_IN = 0.4;
const LANE_OUT = 0.55;

const frac = (x: number) => ((x % 1) + 1) % 1;

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
}

/** A car's place along the lane during its stop (0 entry, 1 exit): it brakes in to its
 * garage, waits there, then pulls away. */
export function laneAt(raw: number, garage: number): number {
  const r = Math.min(1, Math.max(0, raw));
  if (r < LANE_IN) {
    const u = r / LANE_IN;
    return garage * (1 - (1 - u) * (1 - u));
  }
  if (r < LANE_OUT) return garage;
  const u = (r - LANE_OUT) / (1 - LANE_OUT);
  return garage + (1 - garage) * u * u;
}

export interface MotionInput {
  race: RaceState;
  model: RaceModel;
  /** The flag of the lap being driven (gaps become distance at its pace). */
  flag: RaceState['flag'];
  /** How far through the lap tick the clock is (0 while paused). */
  progress: number;
  /** Animate: false places every car exactly (reduced motion). */
  smooth: boolean;
  userSide: string;
  /** Your BOX not yet in the race model: its decision lap (in at the end of that lap). */
  userBox: number | null;
  /** Extra time your car's stop takes (a new nose). */
  userExtra?: number;
  /** The run to the flag: laps since the leader finished (null while racing). */
  sinceFlag?: number | null;
  /**
   * The lap being shown, run ahead to its end (GameSession.previewLap). With it every car
   * moves toward its end-of-lap gap all lap long (overtakes happen through the lap, not at the
   * line), a car that retires on it stops on track, and its stops are seen a lap early.
   */
  ahead?: RaceState | null;
  /**
   * A battle (battles and trust spec): its two cars keep their order until tick progress
   * `until` (your car at the corner), then take their places after the lap. Null `until`:
   * held all lap (no call yet).
   */
  hold?: { codes: string[]; until: number | null } | null;
  /** Where a car that retires this lap stops (a fraction of the lap), when known. */
  stopAt?: (code: string) => number | null;
  /** Why a car is out ("crash", "engine"...), shown where it's parked. */
  outWhy?: (code: string) => string;
}

/** Progress over which a battle's new order slides in after the corner. */
const SWAP_SPAN = 0.04;
/** A car that stops on track brakes over this much of the lap. */
const HALT_SPAN = 0.03;
/** Laps a stopped car stays on the map before it's cleared away. */
const PARK_LAPS = 3;

/** The map's clock and each car's gap on it, at the end of a lap. */
interface ClockState {
  lap: number;
  clock: number;
  times: Map<string, number>;
  offsets: Map<string, number>;
  /** What the lap after takes (s). */
  lapSec: number;
}

/** One lap on: the clock moves by the median lap of the cars that didn't stop (drifting toward
 * the leader), each car by what it gained or lost at that lap's pace. Null `prev`, or a jump:
 * start again at the leader. `continuous` is false after such a restart. */
function advance(
  prev: ClockState | null,
  race: RaceState,
  model: RaceModel,
  flag: RaceState['flag'],
): { state: ClockState; continuous: boolean } {
  const running = race.order.filter((c) => race.cars[c] && !race.cars[c]?.retired);
  const leader = race.cars[running[0] ?? ''];
  const time = (c: string) => race.cars[c]?.totalTime ?? 0;
  let med: number | null = null;
  if (prev && race.lap === prev.lap + 1) {
    med = median(
      running
        .filter((c) => !race.cars[c]?.pittedThisLap && prev.times.has(c))
        .map((c) => time(c) - (prev.times.get(c) ?? 0)),
    );
    const ran = lapTime(model, race.flag);
    if (med !== null && (med < ran * 0.5 || med > ran * 2.5)) med = null;
  }
  const lapSec = med !== null && race.flag === flag ? med : lapTime(model, flag);
  const times = new Map(running.map((c) => [c, time(c)]));
  if (prev && med !== null && leader) {
    const t = prev.clock + med;
    const clock = t + ANCHOR * (leader.totalTime - t);
    const moved = clock - prev.clock;
    const offsets = new Map(
      running.map((c) => {
        const before = prev.offsets.get(c);
        const was = prev.times.get(c);
        return [
          c,
          before !== undefined && was !== undefined
            ? before + (time(c) - was - moved) / (med as number)
            : (time(c) - clock) / lapTime(model, flag),
        ];
      }),
    );
    return { state: { lap: race.lap, clock, times, offsets, lapSec }, continuous: true };
  }
  const clock = leader?.totalTime ?? 0;
  const offsets = new Map(running.map((c) => [c, (time(c) - clock) / lapTime(model, flag)]));
  return { state: { lap: race.lap, clock, times, offsets, lapSec }, continuous: false };
}

/** A number in [0, 1) from a string (a stable spot on the lap for a car's stop). */
function hash01(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

export interface CarPlace {
  x: number;
  y: number;
  /** Where it is round the lap (fraction), or its rejoin point while in the lane. */
  at: number;
  /** In the pit lane. */
  lane: boolean;
  /** At the flag: over the line. */
  finished?: boolean;
  /** Out of the race, stopped on track: why ("crash", "engine"...). */
  out?: string;
}

/** A car on the live standings (the map's order and gaps, between laps). */
export interface LiveStanding {
  code: string;
  /** Seconds behind the leader. */
  gap: number;
  pit: boolean;
}

interface Timeline {
  out: number;
  aIn: number;
  aOut: number;
  b0: number;
  b1: number;
}

/** A stop being drawn: its out-lap, what it costs (s, taken once), and its timeline, fixed
 * once the car is in the lane (a later lap's gaps don't move a car already in it). */
interface Stop {
  out: number;
  loss?: number;
  /** The gap it was drawn at on its in-lap, before the stop was charged. */
  b0?: number;
  fixed?: Timeline;
}

export class MapMotion {
  private lap: number | null = null;
  /** Race time (s) on the map's clock at the line at the start of this tick. */
  private clock = 0;
  /** Seconds the tick stands for. */
  private lapSec = 90;
  private times = new Map<string, number>();
  private offsets = new Map<string, number>();
  /** The offsets cars were drawn at when the last tick ended (the glide starts there). */
  private from = new Map<string, number>();
  /** The offset each car was drawn at in the last frame. */
  private last = new Map<string, number>();
  /** Stops being drawn, by car. */
  private stops = new Map<string, Stop>();
  /** The lap being shown, run ahead: each car's gap at its end. */
  private aheadOf: RaceState | null = null;
  private aheadOffsets = new Map<string, number>();
  /** Cars stopped on track: where, since which lap, and why. */
  private parked = new Map<string, { at: number; lap: number; why: string }>();
  /** The last frame's standings. */
  private standing: LiveStanding[] = [];
  /** Each car's drawn gap (laps behind the clock) and place round the lap. */
  private drawnOff = new Map<string, number>();
  private drawn = new Map<string, number>();
  private xy = new Map<string, [number, number]>();
  /** Cars in the lane in the last frame. */
  private wasInLane = new Set<string>();
  /** The last frame's tick progress (how far a car drives in a frame). */
  private lastProgress: number | null = null;
  /** Some car is still easing to its place (keep frames coming while paused). */
  moving = false;

  constructor(
    private readonly line: Polyline,
    private readonly lane: PitLane | null,
    private readonly garageOf: (code: string) => number,
    private readonly minGap: number,
  ) {}

  /** A new lap's state: move the clock on, take the cars' offsets, note the stops coming. */
  private observe(race: RaceState, model: RaceModel, flag: RaceState['flag']): void {
    if (this.lap === race.lap) return;
    const prev: ClockState | null =
      this.lap === null
        ? null
        : {
            lap: this.lap,
            clock: this.clock,
            times: this.times,
            offsets: this.offsets,
            lapSec: this.lapSec,
          };
    const { state, continuous } = advance(prev, race, model, flag);
    this.clock = state.clock;
    this.offsets = state.offsets;
    this.lapSec = state.lapSec;
    this.times = state.times;
    this.lap = race.lap;
    this.aheadOf = null;
    if (continuous) this.from = new Map(this.last);
    else {
      // The first lap seen (or a jump: a restart, a resume).
      this.from = new Map();
      this.stops.clear();
      this.parked.clear();
    }
    for (const [code, p] of [...this.parked]) {
      if (race.lap - p.lap >= PARK_LAPS) this.parked.delete(code);
    }
    const running = race.order.filter((c) => race.cars[c] && !race.cars[c]?.retired);
    for (const code of [...this.stops.keys()]) if (!this.offsets.has(code)) this.stops.delete(code);
    for (const code of running) {
      const car = race.cars[code];
      if (!car || this.stops.has(code)) continue;
      const next = car.strategy.filter((s) => s.lap > race.lap).sort((a, b) => a.lap - b.lap)[0];
      const sure = !next?.optional || code !== model.rival || this.takes(race, code, next.lap);
      if (next && next.lap <= race.lap + 2 && sure) this.stops.set(code, { out: next.lap });
      else if (car.pittedThisLap) this.stops.set(code, { out: race.lap }); // nobody saw it coming
    }
    this.coverAhead(race, model);
  }

  /**
   * The rival covering your stop (sim.ts rivalCover) pits at the end of the lap your stop is
   * charged on: the race model decides it once that lap is run, but its in-lap is the lap
   * being shown now. Ask the same rule a lap early, so it turns in at pit entry.
   */
  private coverAhead(race: RaceState, model: RaceModel): void {
    const lap = race.lap + 1;
    const user = race.cars[model.userSide];
    const rival = race.cars[model.rival];
    const stop = user?.strategy.find((s) => s.lap === lap);
    if (!user || !rival || !stop || user.retired || rival.retired) return;
    if (this.stops.has(model.rival) || lap >= model.race.laps) return;
    if (rival.strategy.some((s) => s.lap === lap)) return;
    const to = rivalCover(model, rival, {
      lap,
      flag: race.nextFlag ?? flagOn(model, lap),
      nextFlag: flagOn(model, lap + 1),
      startGap: Math.abs(user.totalTime - rival.totalTime),
      userBehind: user.totalTime + this.loss(race, model.userSide, lap, model, 0) - rival.totalTime,
      userCompound: stop.to,
    });
    if (to) this.stops.set(model.rival, { out: lap + 1 });
  }

  /** The rival's optional stop (sim.ts, live play): taken only if the gap behind covers it,
   * decided as its out-lap starts. Until then it isn't drawn. (Every other car takes its.) */
  private takes(race: RaceState, code: string, out: number): boolean {
    if (out !== race.lap + 1) return false;
    const running = race.order.filter((c) => race.cars[c] && !race.cars[c]?.retired);
    const behind = race.cars[running[running.indexOf(code) + 1] ?? ''];
    const me = race.cars[code];
    if (!me || !behind) return !!me;
    return behind.totalTime - me.totalTime > this.loss(race, code, out, null, 0);
  }

  /** The time a stop costs (s): its own measured loss, or the track's for the out-lap's flag. */
  private loss(
    race: RaceState,
    code: string,
    out: number,
    model: RaceModel | null,
    extra: number,
  ): number {
    const stop = race.cars[code]?.strategy.find((s) => s.lap === out);
    if (stop?.loss !== undefined) return stop.loss + extra;
    const f =
      out === race.lap
        ? race.flag
        : out === race.lap + 1
          ? (race.nextFlag ?? (model ? flagOn(model, out) : 'green'))
          : model
            ? flagOn(model, out)
            : 'green';
    const t = model?.track;
    if (!t) return 22 + extra;
    return (f === 'sc' ? t.pitLossUnderSC : f === 'vsc' ? t.pitLossUnderVSC : t.pitLoss) + extra;
  }

  /** A stop's timeline on the map's time axis (race.lap + tick progress). */
  private timeline(code: string, input: MotionInput): Timeline | null {
    const stop = this.stops.get(code);
    const off = this.offsets.get(code);
    if (!stop || off === undefined || !this.lane) return null;
    if (stop.fixed) return stop.fixed;
    const { race, model } = input;
    const out = stop.out;
    const extra = code === input.userSide ? (input.userExtra ?? 0) : 0;
    stop.loss ??= this.loss(race, code, out, model, extra);
    const loss = stop.loss / this.lapSec;
    // Once the stop is charged the car's real gap is known: it rejoins there, from the gap it
    // was drawn at on its in-lap (so it still turns in where it was heading).
    const charged = race.lap >= out;
    const b0 = charged ? (stop.b0 ?? off - loss) : off;
    const b1 = charged ? off : off + loss;
    if (!charged) stop.b0 = off;
    const span = frac(this.lane.exit - this.lane.entry) || 1e-3;
    // The in-lap is lap `out - 1`; the car reaches the entry near the end of it.
    const aIn = out - 2 + b0 + this.lane.entry;
    return { out, aIn, aOut: aIn + span + Math.max(0.05, b1 - b0), b0, b1 };
  }

  /** The lap being shown, run ahead: each car's gap at its end, and the stops it brings (a
   * puncture's, a stop decided on it) a lap early. */
  private see(
    ahead: RaceState | null | undefined,
    model: RaceModel,
    flag: RaceState['flag'],
  ): void {
    if (!ahead || this.lap === null || ahead.lap !== this.lap + 1 || ahead === this.aheadOf) return;
    this.aheadOf = ahead;
    const prev: ClockState = {
      lap: this.lap,
      clock: this.clock,
      times: this.times,
      offsets: this.offsets,
      lapSec: this.lapSec,
    };
    this.aheadOffsets = advance(prev, ahead, model, ahead.nextFlag ?? flag).state.offsets;
    const lap = this.lap;
    for (const code of this.offsets.keys()) {
      const car = ahead.cars[code];
      if (!car || car.retired || this.stops.has(code)) continue;
      const next = car.strategy.filter((s) => s.lap > lap).sort((a, b) => a.lap - b.lap)[0];
      if (next && next.lap <= lap + 2) this.stops.set(code, { out: next.lap });
    }
  }

  /** The standings as the map shows them now: order on track, gaps in seconds, who's in the
   * pit lane (stopped cars aren't listed). */
  standings(): LiveStanding[] {
    return this.standing;
  }

  /**
   * Whether `code` reaches pit entry on the lap being shown, `progress` through its tick (a
   * BOX now turns in this lap); otherwise the BOX is for the next lap.
   */
  reachesEntry(code: string, race: RaceState, progress: number): boolean {
    const off = this.offsets.get(code);
    if (!this.lane || this.lap !== race.lap || off === undefined) return true;
    return progress < off + this.lane.entry - ENTRY_MARGIN;
  }

  /** The tick progress at which `code` reaches `fraction` of the lap on this tick (it may be
   * past 1: not this tick). */
  reach(code: string, fraction: number): number | null {
    const off = this.offsets.get(code);
    return off === undefined ? null : frac(fraction + off);
  }

  /** Where `code` was last drawn: on screen, and round the lap. */
  xyOf(code: string): [number, number] | undefined {
    return this.xy.get(code);
  }
  atOf(code: string): number | undefined {
    return this.drawn.get(code);
  }

  /** Every running car's place this frame. */
  frame(input: MotionInput): Map<string, CarPlace> {
    const { race, model } = input;
    this.observe(race, model, input.flag);
    this.moving = false;
    const running = race.order.filter((c) => race.cars[c] && !race.cars[c]?.retired);
    const out = new Map<string, CarPlace>();
    const step =
      this.lastProgress === null ? 0 : frac(input.progress - this.lastProgress) * this.line.length;
    this.lastProgress = input.progress;
    if (input.sinceFlag !== undefined && input.sinceFlag !== null) {
      // The run to the flag: from the final gaps to the leader, at racing speed.
      const cars = carsOnTrack(race, model, race.flag);
      const shown = spaceOut(new Map(cars.map((c) => [c.code, c.behind])), this.minGap);
      const flagged = runToFlag(shown, input.smooth ? input.sinceFlag : 99);
      for (const [code, f] of flagged) {
        this.drawn.set(code, f.at);
        const [x, y] = this.guard(code, pointAt(this.line, f.at), input.smooth, JUMP_PX + step);
        out.set(code, { x, y, at: f.at, lane: false, finished: f.finished });
      }
      return out;
    }

    const jump = JUMP_PX + 2 * step;
    this.see(input.ahead, model, input.flag);
    const userBox = input.userBox;
    if (userBox !== null && !this.stops.has(input.userSide))
      this.stops.set(input.userSide, { out: userBox + 1 });
    const p = input.progress;
    const now = race.lap + p;
    // A big change (a lapped car unlapping at a restart) takes longer than a small one.
    const glide = (code: string, to: number) => {
      const was = this.from.get(code);
      if (was === undefined) return to;
      const span = Math.min(1, Math.max(GLIDE, Math.abs(to - was) * 0.8));
      return was + (to - was) * (input.smooth ? ease(Math.min(1, p / span)) : 1);
    };
    // Through the lap, toward the gap at its end (when the lap has been run ahead); a battle's
    // two cars keep their order until the corner, then slide into their places.
    const hold = input.hold;
    const toward = (code: string, base: number) => {
      const end = this.aheadOffsets.get(code);
      if (!this.aheadOf || end === undefined) return base;
      const off = this.offsets.get(code) ?? base;
      if (hold?.codes.includes(code)) {
        if (hold.until === null || p < hold.until) return base;
        const k = input.smooth ? ease(Math.min(1, (p - hold.until) / SWAP_SPAN)) : 1;
        return base + (end - off) * k;
      }
      return base + (end - off) * (input.smooth ? p : 1);
    };

    // A car that retires on this lap drives to where it stops, brakes, and stays there.
    const halting = new Map<string, number>();
    if (this.aheadOf) {
      for (const code of running) {
        const car = this.aheadOf.cars[code];
        const off = this.offsets.get(code);
        if (!car?.retired || off === undefined) continue;
        const known = input.stopAt?.(code) ?? null;
        let pStop = known === null ? null : frac(known + off);
        if (pStop === null || pStop > 0.95 || pStop < 0.08) {
          pStop = 0.25 + 0.6 * hash01(`${code}:${race.lap}`);
        }
        const stopAt = pStop - off;
        const pB = pStop - HALT_SPAN / 2;
        const at =
          p < pB
            ? p - off
            : p < pB + HALT_SPAN
              ? stopAt - HALT_SPAN / 2 + (p - pB) - (p - pB) ** 2 / (2 * HALT_SPAN)
              : stopAt;
        halting.set(code, at);
        if (!this.parked.has(code)) {
          this.parked.set(code, {
            at: stopAt,
            lap: race.lap + 1,
            why: input.outWhy?.(code) ?? 'out',
          });
        }
      }
    }

    // Cars on a stop's timeline are placed exactly; the rest glide, then are spaced out.
    const exact = new Map<string, number>();
    const inLane = new Map<string, { u: number; rejoin: number }>();
    const free = new Map<string, number>();
    for (const code of running) {
      const off = this.offsets.get(code);
      if (off === undefined) continue;
      if (halting.has(code)) continue;
      const tl = this.timeline(code, input);
      if (tl && now >= tl.aOut && race.lap >= tl.out) this.stops.delete(code);
      else if (tl && now < tl.aIn) {
        // On its in-lap: the new gap glides in before the car reaches pit entry.
        const by = Math.max(0.05, Math.min(GLIDE, tl.aIn - race.lap));
        const was = this.from.get(code);
        const k = input.smooth ? ease(Math.min(1, p / by)) : 1;
        exact.set(code, was === undefined ? tl.b0 : was + (tl.b0 - was) * k);
        continue;
      } else if (tl && now >= tl.aOut) {
        exact.set(code, tl.b1);
        continue;
      } else if (tl) {
        const stop = this.stops.get(code);
        // A car that should already be in the lane but was drawn on track, just short of the
        // entry (its timeline moved with a new lap's gap), turns in now rather than hopping.
        const lastAt = this.drawn.get(code);
        const inBefore = this.wasInLane.has(code);
        if (
          !stop?.fixed &&
          !inBefore &&
          this.lane &&
          lastAt !== undefined &&
          frac(this.lane.entry - lastAt) < 0.1 &&
          now - tl.aIn > 0.005
        ) {
          tl.aIn = now - 0.001;
        }
        if (stop) stop.fixed = tl;
        const raw = (now - tl.aIn) / (tl.aOut - tl.aIn);
        inLane.set(code, { u: laneAt(raw, this.garageOf(code)), rejoin: tl.b1 });
        continue;
      }
      free.set(code, toward(code, glide(code, off)));
    }
    const spaced = spaceOut(free, this.minGap);

    for (const code of running) {
      const lane = inLane.get(code);
      if (lane && this.lane) {
        this.last.set(code, lane.rejoin);
        this.drawnOff.set(code, lane.rejoin);
        const at = p - lane.rejoin;
        this.drawn.set(code, at);
        const [x, y] = this.guard(code, pointAlong(this.lane.path, lane.u), input.smooth, jump);
        out.set(code, { x, y, at, lane: true });
        continue;
      }
      const ex = exact.get(code);
      const off = ex ?? spaced.get(code);
      if (off === undefined) continue;
      this.last.set(code, ex ?? free.get(code) ?? off);
      const at = p - this.ease(code, off, ex !== undefined || !input.smooth);
      this.drawn.set(code, at);
      const [x, y] = this.guard(code, pointAt(this.line, at), input.smooth, jump);
      out.set(code, { x, y, at, lane: false });
    }
    // Cars stopping on track this lap, and those already stopped.
    for (const [code, at] of halting) {
      this.drawn.set(code, at);
      const [x, y] = this.guard(code, pointAt(this.line, at), input.smooth, jump);
      const parked = this.parked.get(code);
      const stopped = parked !== undefined && Math.abs(at - parked.at) < 1e-6;
      out.set(code, { x, y, at, lane: false, ...(stopped ? { out: parked.why } : {}) });
    }
    for (const [code, parked] of this.parked) {
      if (out.has(code) || running.includes(code)) continue;
      const [x, y] = pointAt(this.line, parked.at);
      this.xy.set(code, [x, y]);
      out.set(code, { x, y, at: parked.at, lane: false, out: parked.why });
    }
    // The standings as drawn: order on track and gaps in seconds.
    const offsetNow = (code: string) =>
      inLane.has(code) ? (inLane.get(code)?.rejoin ?? 0) : (this.last.get(code) ?? 0);
    const shownCodes = running.filter((c) => !halting.has(c) && out.has(c));
    const sorted = shownCodes.sort((a, b) => offsetNow(a) - offsetNow(b));
    const lead = sorted[0] ? offsetNow(sorted[0]) : 0;
    this.standing = sorted.map((code) => ({
      code,
      gap: (offsetNow(code) - lead) * this.lapSec,
      pit: inLane.has(code),
    }));
    for (const code of [...this.xy.keys()]) if (!out.has(code)) this.xy.delete(code);
    this.wasInLane = new Set([...inLane.keys()]);
    return out;
  }

  /** Ease a car's drawn gap toward `want` the short way round the lap (or set it, `exact`). */
  private ease(code: string, want: number, exact = false): number {
    const was = this.drawnOff.get(code);
    const delta = was === undefined ? 0 : frac(want - was + 0.5) - 0.5;
    if (exact || was === undefined || Math.abs(delta) < 0.0005) {
      this.drawnOff.set(code, want);
      return want;
    }
    this.moving = true;
    const next = was + delta * EASE_PER_FRAME;
    this.drawnOff.set(code, next);
    return next;
  }

  /** A last guard on screen: a move far bigger than a frame's driving is spread over a few. */
  private guard(
    code: string,
    to: [number, number],
    smooth: boolean,
    limit: number,
  ): [number, number] {
    const was = this.xy.get(code);
    let [x, y] = to;
    if (was && smooth && Math.hypot(x - was[0], y - was[1]) > limit) {
      x = was[0] + (x - was[0]) * 0.35;
      y = was[1] + (y - was[1]) * 0.35;
      this.moving = true;
    }
    this.xy.set(code, [x, y]);
    return [x, y];
  }
}

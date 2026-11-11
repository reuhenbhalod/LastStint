// Versus mode's live room (docs/versus-spec.md V5): one Durable Object per match, holding a
// WebSocket to each player. It keeps the lap clock, pauses both players for a big call, passes
// each call on before the lap it acts on (lockstep: both browsers run the same race), waits for
// a dropped player, and grades the race at the flag. It runs the race itself too: it raises
// the big calls, and its copy is the one graded.

import {
  type ClientMessage,
  type PlayerIndex,
  type RaceSync,
  type RoomView,
  type ServerMessage,
  VERSUS_CARS,
  type VersusAnswer,
  type VersusCall,
  type VersusMoment,
  type VersusOutcome,
  type VersusPlayer,
  type VersusRun,
  type VersusSetup,
  autoPick,
  callVersus,
  gradeVersus,
  initVersus,
  optionCalls,
  stepVersus,
  validOption,
  versusCallsDue,
  versusFinished,
  versusTrack,
} from '@boxthislap/sim';
import type { Env } from './index.js';
import { getRace } from './races.js';

/** A lap's length (the race runs at one speed: both screens stay in step). */
export const LAP_MS = 8000;
/** Time to answer a big call: 8 s, plus a moment to read it (action spec A3). */
export const CALL_MS = 10_000;
/** A battle's picks: 6 s, plus a moment to read it, once the cars reach the braking zone. */
export const BATTLE_MS = 7000;
/** How far before its corner a battle's braking zone starts (a share of the lap; the map's). */
export const BRAKE_BEFORE = 0.035;
/** The car pick: this long, then whoever hasn't picked gets Balanced on mediums. */
export const PICK_MS = 30_000;
/** A dropped player gets this long to come back before their driver takes over. */
export const RECONNECT_MS = 30_000;
/** The gap between the picks showing and the lights going out. */
export const REVEAL_MS = 3000;

const NAME_MAX = 20;
const START_TYRES = ['SOFT', 'MEDIUM', 'HARD'];

interface Seat {
  name: string;
  key: string;
  ws: WebSocket | null;
  pick: { car: string; startTyre: string } | null;
  /** Dropped out for good: the driver makes the calls. */
  away: boolean;
}

interface Timing {
  lap: number;
  pick: number;
  call: number;
  battle: number;
  reconnect: number;
  reveal: number;
}

function timingOf(env: Env): Timing {
  const n = (v: string | undefined, d: number) => (v ? Number(v) : d);
  return {
    lap: n(env.VERSUS_LAP_MS, LAP_MS),
    pick: n(env.VERSUS_PICK_MS, PICK_MS),
    call: n(env.VERSUS_CALL_MS, CALL_MS),
    battle: n(env.VERSUS_BATTLE_MS, BATTLE_MS),
    reconnect: n(env.VERSUS_RECONNECT_MS, RECONNECT_MS),
    reveal: n(env.VERSUS_REVEAL_MS, REVEAL_MS),
  };
}

const randomKey = () => crypto.randomUUID();

export class VersusRoom implements DurableObject {
  private code = '';
  private track = '';
  private seed = 0;
  private phase: RoomView['phase'] = 'lobby';
  private seats: [Seat | null, Seat | null] = [null, null];
  private pickUntil = 0;
  private run: VersusRun | null = null;
  private setup: VersusSetup | null = null;
  private answers: VersusAnswer[] = [];
  private moments: VersusMoment[] = [];
  private momentsUntil = 0;
  private answered = new Set<PlayerIndex>();
  /** The lap running now and when it started; a battle's holds at `brake` until resolved. */
  private running: {
    lap: number;
    ms: number;
    start: number;
    brake?: number;
    held?: boolean;
  } | null = null;
  /** Answers' calls, sent on when the moments close (blind: nobody sees the other's first). */
  private held: VersusCall[] = [];
  private waitingFor: PlayerIndex | null = null;
  private result: VersusOutcome | null = null;
  private readonly timing: Timing;

  constructor(_state: DurableObjectState, env: Env) {
    this.timing = timingOf(env);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/create') {
      const body = (await request.json()) as { code: string; track: string; seed: number };
      if (this.code) return Response.json({ error: 'exists' }, { status: 409 });
      this.code = body.code;
      this.track = body.track;
      this.seed = body.seed;
      return Response.json(this.view());
    }
    if (url.pathname === '/view') {
      return this.code
        ? Response.json(this.view())
        : Response.json({ error: 'not-found' }, { status: 404 });
    }
    if (url.pathname === '/ws') {
      if (!this.code) return new Response('no such match', { status: 404 });
      if (request.headers.get('Upgrade') !== 'websocket')
        return new Response('expected a WebSocket', { status: 426 });
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
      server.accept();
      server.addEventListener('message', (e) => this.onMessage(server, e.data));
      server.addEventListener('close', () => this.onClose(server));
      server.addEventListener('error', () => this.onClose(server));
      return new Response(null, { status: 101, webSocket: client });
    }
    return new Response('not found', { status: 404 });
  }

  // --- Messages --------------------------------------------------------------------------

  private onMessage(ws: WebSocket, data: unknown): void {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(String(data)) as ClientMessage;
    } catch {
      this.send(ws, { t: 'error', message: 'bad message' });
      return;
    }
    if (msg.t === 'join') {
      this.join(ws, msg.name, msg.key);
      return;
    }
    const seat = this.seatOf(ws);
    if (seat === null) {
      this.send(ws, { t: 'error', message: 'join first' });
      return;
    }
    try {
      if (msg.t === 'pick') this.pick(seat, msg.car, msg.startTyre);
      else if (msg.t === 'call') this.call(seat, { ...msg.call, player: seat } as VersusCall);
      else if (msg.t === 'answer') this.answer(seat, msg.lap, msg.option);
      else if (msg.t === 'leave') this.leave(seat);
    } catch (e) {
      this.send(ws, { t: 'error', message: (e as Error).message });
    }
  }

  private join(ws: WebSocket, rawName: string, key?: string): void {
    // Coming back to a seat (a reload or a dropped connection).
    const back = this.seats.findIndex((s) => s && key && s.key === key);
    if (back >= 0) {
      const seat = this.seats[back] as Seat;
      seat.ws = ws;
      seat.away = false;
      this.send(ws, { t: 'welcome', seat: back as PlayerIndex, key: seat.key, room: this.view() });
      this.send(ws, {
        t: 'sync',
        room: this.view(),
        sync: this.sync(),
        ...(this.result ? { result: this.result } : {}),
      });
      this.broadcast({ t: 'room', room: this.view() });
      if (this.waitingFor === back) this.resume();
      return;
    }
    const free = this.seats.findIndex((s) => s === null);
    if (free < 0 || this.phase !== 'lobby') {
      this.send(ws, { t: 'error', message: 'this match is full' });
      return;
    }
    const name =
      String(rawName ?? '')
        .trim()
        .slice(0, NAME_MAX) || `Player ${free + 1}`;
    const seat: Seat = { name, key: randomKey(), ws, pick: null, away: false };
    this.seats[free] = seat;
    this.send(ws, { t: 'welcome', seat: free as PlayerIndex, key: seat.key, room: this.view() });
    if (this.seats[0] && this.seats[1]) {
      this.phase = 'pick';
      this.pickUntil = Date.now() + this.timing.pick;
      this.later(this.timing.pick, () => this.reveal());
    }
    this.broadcast({ t: 'room', room: this.view() });
  }

  private pick(seat: PlayerIndex, car: string, startTyre: string): void {
    if (this.phase !== 'pick') throw new Error('not picking now');
    if (!VERSUS_CARS.some((c) => c.id === car)) throw new Error(`no car ${car}`);
    if (!START_TYRES.includes(startTyre)) throw new Error(`no tyre ${startTyre}`);
    (this.seats[seat] as Seat).pick = { car, startTyre };
    this.broadcast({ t: 'room', room: this.view() });
    if (this.seats.every((s) => s?.pick)) this.reveal();
  }

  private call(seat: PlayerIndex, call: VersusCall): void {
    if (this.phase !== 'race' || !this.run) throw new Error('no race running');
    // Too late for a lap that's already running: both browsers have stepped it.
    const min = (this.running?.lap ?? this.run.state.lap) + 1;
    if (call.lap < min) throw new Error(`lap ${call.lap} is too late (next is ${min})`);
    callVersus(this.run, call);
    this.broadcast({ t: 'call', call });
  }

  private answer(seat: PlayerIndex, lap: number, option: string): void {
    const moment = this.moments.find((m) => m.player === seat && m.lap === lap);
    if (!moment || this.answered.has(seat)) throw new Error('no call waiting for you');
    if (!validOption(moment, option)) throw new Error(`no option ${option}`);
    this.applyAnswer(moment, option);
    if (this.moments.every((m) => this.answered.has(m.player))) this.closeWhenReady();
  }

  private leave(seat: PlayerIndex): void {
    if (this.phase === 'race') {
      this.finish({ forfeit: seat });
      return;
    }
    const s = this.seats[seat];
    s?.ws?.close();
    this.seats[seat] = null;
    if (this.phase === 'pick') {
      this.clearTimer();
      this.phase = 'lobby';
      for (const x of this.seats) if (x) x.pick = null;
    }
    this.broadcast({ t: 'room', room: this.view() });
  }

  private onClose(ws: WebSocket): void {
    const seat = this.seatOf(ws);
    if (seat === null) return;
    const s = this.seats[seat] as Seat;
    s.ws = null;
    if (this.phase === 'lobby') {
      this.seats[seat] = null;
    } else if (this.phase === 'race' && this.waitingFor === null && !s.away) {
      // Wait for them: the clock holds at the end of the lap running.
      this.waitingFor = seat;
      this.clearTimer('call'); // a big call's clock holds too
      const until = Date.now() + this.timing.reconnect;
      this.broadcast({ t: 'paused', player: seat, until });
      this.later(
        this.timing.reconnect,
        () => {
          s.away = true;
          this.resume();
        },
        'reconnect',
      );
    }
    this.broadcast({ t: 'room', room: this.view() });
  }

  // --- The race --------------------------------------------------------------------------

  private async reveal(): Promise<void> {
    if (this.phase !== 'pick') return;
    this.clearTimer();
    const race = await getRace(versusTrack(this.track).raceFile);
    if (!race) {
      this.broadcast({ t: 'error', message: 'track not available' });
      return;
    }
    const players = this.seats.map((s, i) => ({
      name: s?.name ?? `Player ${i + 1}`,
      car: s?.pick?.car ?? 'balanced',
      startTyre: s?.pick?.startTyre ?? 'MEDIUM',
    })) as [VersusPlayer, VersusPlayer];
    this.setup = { track: this.track, seed: this.seed, players };
    this.run = initVersus(race.model, this.setup);
    this.phase = 'race';
    this.broadcast({ t: 'room', room: this.view() });
    this.broadcast({ t: 'start', sync: this.sync() as RaceSync });
    this.later(this.timing.reveal, () => this.nextLap());
  }

  /** Before each lap: raise any big calls (and pause for them), else run the lap. */
  private nextLap(): void {
    const run = this.run;
    if (!run || this.phase !== 'race') return;
    if (this.waitingFor !== null) return; // resume() picks it up
    if (versusFinished(run)) {
      void this.finish({});
      return;
    }
    const due = versusCallsDue(run);
    if (due.length) {
      this.moments = due;
      this.answered.clear();
      const battle = due[0]?.battle;
      if (battle) {
        // A battle (action spec A1): the lap runs to the braking zone and holds there for the
        // picks.
        const lap = run.state.lap + 1;
        const brake = Math.max(0.02, battle.at - BRAKE_BEFORE);
        const approach = brake * this.timing.lap;
        this.running = { lap, ms: this.timing.lap, start: Date.now(), brake, held: true };
        this.momentsUntil = Date.now() + approach + this.timing.battle;
        this.broadcast({
          t: 'moments',
          moments: due,
          until: this.momentsUntil,
          approach: { lap, ms: this.timing.lap, brake },
        });
      } else {
        this.momentsUntil = Date.now() + this.timing.call;
        this.broadcast({ t: 'moments', moments: due, until: this.momentsUntil });
      }
      // A player who's away has their driver answer at once.
      for (const m of due)
        if (this.seats[m.player]?.away) this.applyAnswer(m, defaultOption(run, m));
      if (due.every((m) => this.answered.has(m.player))) {
        this.closeWhenReady();
        return;
      }
      this.later(Math.max(0, this.momentsUntil - Date.now()), () => this.closeMoments(), 'call');
      return;
    }
    this.runLap();
  }

  /** Everyone's answered: close now, or (a battle) once the cars reach the braking zone. */
  private closeWhenReady(): void {
    const r = this.running;
    const reach = r?.held && r.brake !== undefined ? r.start + r.brake * r.ms - Date.now() : 0;
    if (reach > 0) this.later(reach, () => this.closeMoments(), 'call');
    else this.closeMoments();
  }

  private applyAnswer(moment: VersusMoment, option: string): void {
    const run = this.run as VersusRun;
    const answer: VersusAnswer = {
      player: moment.player,
      lap: moment.lap,
      kind: moment.kind,
      option,
    };
    this.answers.push(answer);
    this.answered.add(moment.player);
    for (const c of optionCalls(moment.player, moment.lap, option)) {
      callVersus(run, c);
      this.held.push(c);
    }
    this.broadcast({ t: 'answered', player: moment.player });
  }

  /** The answer window closed (all in, or time up): unanswered calls stay out (or the
   * driver picks his own battle move). The calls go to both browsers now, then a battle's lap
   * runs on from the braking zone, or (strategy calls) the lap's battle is raised, if any. */
  private closeMoments(): void {
    if (!this.moments.length) return;
    this.clearTimer();
    this.clearTimer('call');
    const run = this.run as VersusRun;
    for (const m of this.moments)
      if (!this.answered.has(m.player)) this.applyAnswer(m, defaultOption(run, m));
    for (const c of this.held.splice(0)) this.broadcast({ t: 'call', call: c });
    this.moments = [];
    this.answered.clear();
    const r = this.running;
    if (r?.held && r.brake !== undefined) this.runLap(r.brake);
    else this.nextLap();
  }

  /** Run the next lap (from `from` of the way round: a battle's, after its picks). */
  private runLap(from = 0): void {
    const run = this.run as VersusRun;
    const lap = run.state.lap + 1;
    const ms = this.timing.lap;
    this.running = { lap, ms, start: Date.now() - from * ms };
    this.broadcast({ t: 'run', lap, ms, ...(from ? { from } : {}) });
    this.later(ms * (1 - from), () => {
      stepVersus(run);
      this.running = null;
      this.nextLap();
    });
  }

  private resume(): void {
    if (this.waitingFor === null) return;
    this.waitingFor = null;
    this.clearTimer('reconnect');
    this.broadcast({ t: 'resumed' });
    // Waiting held the clock between laps (or the big calls): carry on from there.
    if (this.moments.length) {
      for (const m of this.moments)
        if (this.seats[m.player]?.away && !this.answered.has(m.player))
          this.applyAnswer(m, defaultOption(this.run as VersusRun, m));
      if (this.moments.every((m) => this.answered.has(m.player))) this.closeWhenReady();
      else
        this.later(Math.max(0, this.momentsUntil - Date.now()), () => this.closeMoments(), 'call');
    } else if (!this.running) this.nextLap();
  }

  private async finish({ forfeit }: { forfeit?: PlayerIndex }): Promise<void> {
    if (this.phase !== 'race' || !this.run || !this.setup) return;
    this.clearTimer();
    this.clearTimer('call');
    this.clearTimer('reconnect');
    this.phase = 'grading';
    this.broadcast({ t: 'grading' });
    const away = this.seats.flatMap((s, i) => (s?.away ? [i as PlayerIndex] : []));
    const score =
      forfeit === undefined
        ? gradeVersus(this.run.model, this.setup, this.run.calls, this.answers)
        : null;
    this.result = {
      score,
      ...(forfeit !== undefined ? { forfeit } : {}),
      away,
      setup: this.setup,
      calls: this.run.calls,
      answers: this.answers,
      players: this.setup.players,
    };
    this.phase = 'done';
    this.broadcast({ t: 'room', room: this.view() });
    this.broadcast({ t: 'result', result: this.result });
  }

  // --- Plumbing ---------------------------------------------------------------------------

  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  /** One pending timer per slot ('main' for the race clock). */
  private later(ms: number, f: () => void, slot = 'main'): void {
    this.clearTimer(slot);
    this.timers.set(
      slot,
      setTimeout(() => {
        this.timers.delete(slot);
        f();
      }, ms),
    );
  }

  private clearTimer(slot = 'main'): void {
    const t = this.timers.get(slot);
    if (t) clearTimeout(t);
    this.timers.delete(slot);
  }

  private seatOf(ws: WebSocket): PlayerIndex | null {
    const i = this.seats.findIndex((s) => s?.ws === ws);
    return i < 0 ? null : (i as PlayerIndex);
  }

  private view(): RoomView {
    return {
      code: this.code,
      track: this.track,
      phase: this.phase,
      seats: this.seats.map((s) =>
        s ? { name: s.name, connected: !!s.ws, picked: !!s.pick } : null,
      ) as RoomView['seats'],
      ...(this.phase === 'pick' ? { pickUntil: this.pickUntil } : {}),
    };
  }

  private sync(): RaceSync | null {
    if (!this.run || !this.setup) return null;
    return {
      setup: this.setup,
      calls: [...this.run.calls],
      answers: [...this.answers],
      lap: this.run.state.lap,
      running: this.running
        ? {
            lap: this.running.lap,
            ms: this.running.ms,
            elapsed: Date.now() - this.running.start,
            ...(this.running.held ? { brake: this.running.brake as number, held: true } : {}),
          }
        : null,
      moments: this.moments,
      ...(this.moments.length ? { momentsUntil: this.momentsUntil } : {}),
      answered: [...this.answered],
    };
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      // closed: the close handler deals with it
    }
  }

  private broadcast(msg: ServerMessage): void {
    for (const s of this.seats) if (s?.ws) this.send(s.ws, msg);
  }
}

/** No answer: stay out, go normally at the restart, or (a battle) the driver's own move. */
function defaultOption(run: VersusRun, m: VersusMoment): string {
  if (m.battle) return autoPick(run, m.player, m.battle.attacker === m.player);
  return m.options.includes('stay') ? 'stay' : 'normal';
}

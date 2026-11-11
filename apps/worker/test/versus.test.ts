// Versus mode's room (src/versus.ts, docs/versus-spec.md V5): two players create and join a
// match, pick their cars, and race in lockstep. Every call reaches both browsers before the
// lap it acts on, so each browser's own copy of the race ends exactly where the room's does.
// A dropped player gets a moment to come back; leaving mid-race forfeits.

import { SELF } from 'cloudflare:test';
import {
  type RaceModel,
  type ServerMessage,
  VERSUS_LAPS,
  VERSUS_TRACKS,
  type VersusCall,
  callVersus,
  classifyVersus,
  initVersus,
  stepVersus,
} from '@laststint/sim';
import { describe, expect, it } from 'vitest';
import bahrainJson from '../../../data/races/bahrain-2022.json';
import { RACE_FILES } from '../src/races.gen.js';

const bahrain = bahrainJson as unknown as RaceModel;

interface Client {
  ws: WebSocket;
  inbox: ServerMessage[];
  send: (m: object) => void;
  next: (t: ServerMessage['t'], ms?: number) => Promise<ServerMessage>;
}

async function connect(code: string): Promise<Client> {
  const res = await SELF.fetch(`http://x/api/versus/${code}/ws`, {
    headers: { Upgrade: 'websocket' },
  });
  expect(res.status).toBe(101);
  const ws = res.webSocket as WebSocket;
  ws.accept();
  const inbox: ServerMessage[] = [];
  const waiting: Array<() => void> = [];
  ws.addEventListener('message', (e) => {
    inbox.push(JSON.parse(String(e.data)) as ServerMessage);
    for (const w of waiting.splice(0)) w();
  });
  let read = 0;
  const next = async (t: ServerMessage['t'], ms = 20_000) => {
    const end = Date.now() + ms;
    for (;;) {
      while (read < inbox.length) {
        const m = inbox[read++] as ServerMessage;
        if (m.t === t) return m;
      }
      if (Date.now() > end) throw new Error(`no ${t} message`);
      await new Promise<void>((r) => {
        waiting.push(r);
        setTimeout(r, 50);
      });
    }
  };
  return { ws, inbox, send: (m) => ws.send(JSON.stringify(m)), next };
}

async function create(track = 'bahrain'): Promise<string> {
  const res = await SELF.fetch('http://x/api/versus', {
    method: 'POST',
    body: JSON.stringify({ track }),
  });
  expect(res.status).toBe(201);
  return ((await res.json()) as { code: string }).code;
}

/** Replay a browser's view of the race: the setup from `start`, then each `call` and `run`
 * in the order received. */
function replay(inbox: ServerMessage[]) {
  const start = inbox.find((m) => m.t === 'start');
  if (!start || start.t !== 'start') throw new Error('no start');
  const run = initVersus(bahrain, start.sync.setup);
  for (const m of inbox) {
    if (m.t === 'call') callVersus(run, m.call);
    if (m.t === 'run') while (run.state.lap < m.lap - 1) stepVersus(run);
  }
  while (run.state.lap < VERSUS_LAPS) stepVersus(run);
  return run;
}

describe('versus room', () => {
  it('bundles every versus track', () => {
    for (const t of VERSUS_TRACKS) expect(Object.keys(RACE_FILES)).toContain(t.raceFile);
  });

  it('creates matches on known tracks only, and finds them by code', async () => {
    const bad = await SELF.fetch('http://x/api/versus', {
      method: 'POST',
      body: '{"track":"nope"}',
    });
    expect(bad.status).toBe(400);
    const code = await create();
    expect(code).toMatch(/^[A-HJ-NP-Z]{4}$/);
    const view = await SELF.fetch(`http://x/api/versus/${code}`);
    expect(((await view.json()) as { phase: string }).phase).toBe('lobby');
    expect((await SELF.fetch('http://x/api/versus/QQQQ')).status).toBe(404);
  });

  it('races two players in lockstep to a graded result', async () => {
    const code = await create();
    const a = await connect(code);
    a.send({ t: 'join', name: 'Alex' });
    expect((await a.next('welcome')).t).toBe('welcome');
    const b = await connect(code);
    b.send({ t: 'join', name: 'Sam' });
    await b.next('welcome');
    // A third is turned away.
    const c = await connect(code);
    c.send({ t: 'join', name: 'Late' });
    expect(await c.next('error')).toMatchObject({ message: 'this match is full' });

    a.send({ t: 'pick', car: 'bullet', startTyre: 'MEDIUM' });
    b.send({ t: 'pick', car: 'glider', startTyre: 'SOFT' });
    const start = await a.next('start');
    if (start.t !== 'start') throw new Error();
    expect(start.sync.setup.players.map((p) => p.car)).toEqual(['bullet', 'glider']);

    // Alex answers every big call by boxing for hards once; Sam never answers (he stays out
    // by default) but calls a push mid-race.
    let boxed = false;
    let pushed = false;
    for (;;) {
      const m = await a.next(boxed ? 'result' : 'moments', 60_000).catch(() => null);
      if (!m) throw new Error('race stalled');
      if (m.t === 'result') break;
      if (m.t === 'moments') {
        const mine = m.moments.find((x) => x.player === 0);
        if (mine?.options.includes('box')) {
          a.send({ t: 'answer', lap: mine.lap, option: 'box-HARD' });
          boxed = true;
        }
        if (!pushed) {
          b.send({
            t: 'call',
            call: {
              lap: mine ? mine.lap + 1 : VERSUS_LAPS,
              kind: 'mode',
              key: 'pace',
              value: 'push',
            },
          });
          pushed = true;
        }
      }
    }
    const result = await b.next('result', 60_000);
    if (result.t !== 'result') throw new Error();
    const score = result.result.score;
    expect(score?.scores.length).toBe(2);
    expect([0, 1]).toContain(score?.winner);

    // Both browsers' copies of the race end where the room's did.
    const ra = replay(a.inbox);
    const rb = replay(b.inbox);
    expect(ra.state.cars).toEqual(rb.state.cars);
    const room = initVersus(bahrain, result.result.setup, result.result.calls as VersusCall[]);
    while (room.state.lap < VERSUS_LAPS) stepVersus(room);
    expect(ra.state.cars).toEqual(room.state.cars);
    // Sam never stopped: classified last whatever the times (the one-stop rule).
    expect(score?.road).toEqual(classifyVersus(ra));
    expect(score?.road.disqualified).toEqual([1]);
    // First past the flag wins.
    expect(score?.winner).toBe(score?.road.order[0]);

    // Lap 1 is a battle from the grid: its lap runs to the braking zone, holds for the picks
    // (nobody's pick is sent on before both are in), then runs on from there.
    const battle = a.inbox.find((m) => m.t === 'moments' && m.approach);
    if (!battle || battle.t !== 'moments') throw new Error('no battle');
    expect(battle.moments.map((x) => x.kind)).toEqual(['battle', 'battle']);
    const i = a.inbox.indexOf(battle);
    const resumed = a.inbox.findIndex((m, k) => k > i && m.t === 'run');
    const run = a.inbox[resumed];
    expect(run?.t === 'run' && run.from).toBeCloseTo(battle.approach?.brake ?? 0);
    const picks = a.inbox.filter(
      (m, k) => k > i && k < resumed && m.t === 'call' && m.call.kind === 'battle',
    );
    expect(picks.length).toBe(2);
  });

  it('waits for a dropped player, takes them back with their key, and forfeits a leaver', async () => {
    const code = await create('monza');
    const a = await connect(code);
    a.send({ t: 'join', name: 'Alex' });
    const welcome = await a.next('welcome');
    if (welcome.t !== 'welcome') throw new Error();
    const b = await connect(code);
    b.send({ t: 'join', name: 'Sam' });
    await b.next('welcome');
    a.send({ t: 'pick', car: 'balanced', startTyre: 'MEDIUM' });
    b.send({ t: 'pick', car: 'balanced', startTyre: 'MEDIUM' });
    await a.next('start');
    await a.next('moments'); // lap 1's battle
    a.ws.close();
    expect(await b.next('paused')).toMatchObject({ player: 0 });
    const back = await connect(code);
    back.send({ t: 'join', name: 'Alex', key: welcome.key });
    expect(await back.next('welcome')).toMatchObject({ seat: 0 });
    expect((await back.next('sync')).t).toBe('sync');
    await b.next('resumed');
    b.send({ t: 'leave' });
    const r = await back.next('result', 30_000);
    expect(r).toMatchObject({ result: { forfeit: 1, score: null } });
  });
});

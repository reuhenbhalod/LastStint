// A versus match from the browser (docs/versus-spec.md V5): the room's WebSocket, and this
// browser's own copy of the race. The room sends every call before the lap it acts on, so the
// copy steps each lap the moment its `run` arrives (the map then glides from the lap before to
// the lap's end over the lap's clock), and ends where the room's does.

import {
  type ClientMessage,
  type PlayerIndex,
  type RaceModel,
  type RaceSync,
  type RoomView,
  type ServerMessage,
  type VersusCall,
  type VersusMoment,
  type VersusOutcome,
  type VersusRun,
  type VersusState,
  callVersus,
  initVersus,
  stepVersus,
  versusTrack,
} from '@laststint/sim';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiUrl } from '../api.js';
import type { LapClock } from '../game/useGame.js';

const RACE_FILES = import.meta.glob<{ default: RaceModel }>('../../../../data/races/*.json');

async function loadModel(track: string): Promise<RaceModel> {
  const file = versusTrack(track).raceFile;
  const load = RACE_FILES[`../../../../data/races/${file}.json`];
  if (!load) throw new Error(`no race file ${file}`);
  return (await load()).default;
}

const keyStore = (code: string) => `laststint:versus:${code}`;
function savedKey(code: string): string | undefined {
  try {
    return localStorage.getItem(keyStore(code)) ?? undefined;
  } catch {
    return undefined;
  }
}
function saveKey(code: string, key: string): void {
  try {
    localStorage.setItem(keyStore(code), key);
  } catch {
    // private mode: a reload starts a new seat
  }
}

export function wsUrl(code: string): string {
  const http = apiUrl(`/api/versus/${code}/ws`);
  const abs = http.startsWith('http') ? http : `${location.origin}${http}`;
  return abs.replace(/^http/, 'ws');
}

export interface VersusView {
  status: 'connecting' | 'open' | 'closed';
  error: string | null;
  room: RoomView | null;
  seat: PlayerIndex | null;
  model: RaceModel | null;
  run: VersusRun | null;
  /** The state at the start of the lap running (the map glides from it to `run.state`). */
  before: VersusState | null;
  clock: LapClock | null;
  moments: VersusMoment[];
  momentsUntil: number;
  answered: PlayerIndex[];
  /** A dropped player the room is waiting for, and until when. */
  waiting: { player: PlayerIndex; until: number } | null;
  grading: boolean;
  result: VersusOutcome | null;
  /** Bumps on every change to the race (the run is mutated in place). */
  tick: number;
}

const initial: VersusView = {
  status: 'connecting',
  error: null,
  room: null,
  seat: null,
  model: null,
  run: null,
  before: null,
  clock: null,
  moments: [],
  momentsUntil: 0,
  answered: [],
  waiting: null,
  grading: false,
  result: null,
  tick: 0,
};

export function useVersus(code: string, name: string) {
  const [view, setView] = useState<VersusView>(initial);
  const ws = useRef<WebSocket | null>(null);
  const runRef = useRef<VersusRun | null>(null);
  const modelRef = useRef<RaceModel | null>(null);
  // Messages arriving while the race file loads wait in order.
  const queue = useRef<ServerMessage[]>([]);
  const loading = useRef(false);

  const send = useCallback((m: ClientMessage) => {
    if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify(m));
  }, []);

  useEffect(() => {
    let alive = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const patch = (p: Partial<VersusView> | ((v: VersusView) => Partial<VersusView>)) =>
      alive && setView((v) => ({ ...v, ...(typeof p === 'function' ? p(v) : p) }));

    /** Build the race from a sync (start, or a reconnect): the calls so far, the laps run,
     * and the lap running now (its clock part-way through). */
    const rebuild = (sync: RaceSync, model: RaceModel) => {
      const run = initVersus(model, sync.setup);
      for (const c of sync.calls) callVersus(run, c);
      while (run.state.lap < sync.lap) stepVersus(run);
      let before: VersusState | null = null;
      let clock: LapClock | null = null;
      if (sync.running) {
        before = structuredClone(run.state);
        // A battle's lap waiting for its picks isn't resolved yet: it holds at the braking zone.
        if (!sync.running.held) stepVersus(run);
        clock = {
          start: performance.now() - sync.running.elapsed,
          ms: sync.running.ms,
          ...(sync.running.held ? { until: sync.running.brake } : {}),
        };
      }
      runRef.current = run;
      patch((v) => ({
        run,
        before,
        clock,
        moments: sync.moments,
        momentsUntil: sync.momentsUntil ?? 0,
        answered: sync.answered,
        tick: v.tick + 1,
      }));
    };

    const handle = (m: ServerMessage) => {
      const run = runRef.current;
      switch (m.t) {
        case 'welcome':
          saveKey(code, m.key);
          patch({ seat: m.seat, room: m.room });
          break;
        case 'room':
          patch({ room: m.room });
          break;
        case 'start':
        case 'sync': {
          if (m.t === 'sync') patch({ room: m.room, ...(m.result ? { result: m.result } : {}) });
          const sync = m.sync;
          if (!sync) break;
          if (!modelRef.current) {
            // Load the track's race file first; later messages wait for it.
            queue.current.unshift(m);
            if (loading.current) return;
            loading.current = true;
            loadModel(sync.setup.track)
              .then((model) => {
                modelRef.current = model;
                patch({ model });
                loading.current = false;
                const waiting = queue.current.splice(0);
                for (const w of waiting) handle(w);
              })
              .catch((e) => patch({ error: String(e) }));
            return;
          }
          rebuild(sync, modelRef.current);
          break;
        }
        case 'call':
          if (run) {
            callVersus(run, m.call);
            patch((v) => ({ tick: v.tick + 1 }));
          }
          break;
        case 'moments':
          // A battle's lap runs to its braking zone while the picks are made (not stepped: the
          // picks decide it); other calls pause the race between laps.
          patch(
            m.approach && run
              ? {
                  moments: m.moments,
                  momentsUntil: m.until,
                  answered: [],
                  before: structuredClone(run.state),
                  clock: { start: performance.now(), ms: m.approach.ms, until: m.approach.brake },
                }
              : {
                  moments: m.moments,
                  momentsUntil: m.until,
                  answered: [],
                  clock: null,
                  before: null,
                },
          );
          break;
        case 'answered':
          patch((v) => ({ answered: [...v.answered, m.player] }));
          break;
        case 'run':
          if (run) {
            while (run.state.lap < m.lap - 1) stepVersus(run);
            const before = structuredClone(run.state);
            stepVersus(run);
            patch((v) => ({
              before,
              moments: [],
              // After a battle the lap runs on from its braking zone.
              clock: { start: performance.now() - (m.from ?? 0) * m.ms, ms: m.ms },
              tick: v.tick + 1,
            }));
          }
          break;
        case 'paused':
          patch({ waiting: { player: m.player, until: m.until } });
          break;
        case 'resumed':
          patch({ waiting: null });
          break;
        case 'grading':
          patch({ grading: true, clock: null, before: null });
          break;
        case 'result':
          patch({ grading: false, result: m.result, clock: null });
          break;
        case 'error':
          patch({ error: m.message });
          break;
      }
    };

    const open = () => {
      const socket = new WebSocket(wsUrl(code));
      ws.current = socket;
      socket.onopen = () => {
        patch({ status: 'open', error: null });
        const key = savedKey(code);
        socket.send(JSON.stringify({ t: 'join', name, ...(key ? { key } : {}) }));
      };
      socket.onmessage = (e) => {
        const m = JSON.parse(String(e.data)) as ServerMessage;
        if (loading.current) queue.current.push(m);
        else handle(m);
      };
      socket.onclose = () => {
        if (!alive) return;
        patch({ status: 'closed' });
        // Come back to the seat (the room keeps it a while).
        retry = setTimeout(open, 1500);
      };
    };
    open();
    return () => {
      alive = false;
      clearTimeout(retry);
      ws.current?.close();
    };
  }, [code, name]);

  const call = useCallback(
    (c: Omit<VersusCall, 'player'>) => send({ t: 'call', call: c } as ClientMessage),
    [send],
  );
  const answer = useCallback(
    (lap: number, option: string) => send({ t: 'answer', lap, option }),
    [send],
  );
  const pick = useCallback(
    (car: string, startTyre: string) => send({ t: 'pick', car, startTyre }),
    [send],
  );
  const leave = useCallback(() => send({ t: 'leave' }), [send]);
  return { view, call, answer, pick, leave };
}

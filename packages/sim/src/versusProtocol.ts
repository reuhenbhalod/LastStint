// The versus room's WebSocket messages (docs/versus-spec.md V5), shared by the Worker's room
// and the web app. Lockstep: both browsers run the same race from the same setup and calls;
// the room keeps the lap clock, pauses both for a big call, passes the calls on, and grades.
// The room sends every call for a lap before the `run` message that starts that lap, so both
// browsers always step the lap with the same calls.

import type { PlayerIndex, VersusCall, VersusMoment, VersusPlayer, VersusSetup } from './versus.js';
import type { VersusAnswer, VersusScore } from './versusGrade.js';

export type RoomPhase = 'lobby' | 'pick' | 'race' | 'grading' | 'done';

/** What everyone in the room sees of the seats (picks stay hidden until both are in). */
export interface RoomSeat {
  name: string;
  connected: boolean;
  picked: boolean;
}

export interface RoomView {
  code: string;
  track: string;
  phase: RoomPhase;
  seats: [RoomSeat | null, RoomSeat | null];
  /** When the car pick closes (ms since epoch), in the pick phase. */
  pickUntil?: number;
}

/** Everything a browser needs to rebuild the race (on joining late or reconnecting). */
export interface RaceSync {
  setup: VersusSetup;
  calls: VersusCall[];
  answers: VersusAnswer[];
  /** Laps completed. */
  lap: number;
  /** The lap running now (its clock started `elapsed` ms ago), or null while paused. */
  running: { lap: number; ms: number; elapsed: number } | null;
  /** Big calls waiting for answers, and when they close. */
  moments: VersusMoment[];
  momentsUntil?: number;
  /** Players who have answered the moments waiting. */
  answered: PlayerIndex[];
}

export type ClientMessage =
  | { t: 'join'; name: string; key?: string }
  | { t: 'pick'; car: string; startTyre: string }
  | { t: 'call'; call: DistributiveOmit<VersusCall, 'player'> }
  | { t: 'answer'; lap: number; option: string }
  | { t: 'leave' };

export type ServerMessage =
  /** You're in seat `seat`; `key` reclaims it after a disconnect. */
  | { t: 'welcome'; seat: PlayerIndex; key: string; room: RoomView }
  | { t: 'room'; room: RoomView }
  /** Picks revealed: the race starts. */
  | { t: 'start'; sync: RaceSync }
  /** A reconnecting browser's full state. */
  | { t: 'sync'; room: RoomView; sync: RaceSync | null; result?: VersusOutcome }
  | { t: 'call'; call: VersusCall }
  /** Big calls: the race is paused until they're answered or `until`. */
  | { t: 'moments'; moments: VersusMoment[]; until: number }
  | { t: 'answered'; player: PlayerIndex; answer?: VersusAnswer }
  /** Lap `lap` runs now and takes `ms`. */
  | { t: 'run'; lap: number; ms: number }
  /** A player dropped: the race waits for them until `until`. */
  | { t: 'paused'; player: PlayerIndex; until: number }
  | { t: 'resumed' }
  | { t: 'grading' }
  | { t: 'result'; result: VersusOutcome }
  | { t: 'error'; message: string };

export interface VersusOutcome {
  score: VersusScore | null;
  /** A player left mid-race: the other wins. */
  forfeit?: PlayerIndex;
  /** Players whose driver made their calls after they dropped out for good. */
  away: PlayerIndex[];
  setup: VersusSetup;
  calls: VersusCall[];
  answers: VersusAnswer[];
  players: [VersusPlayer, VersusPlayer];
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** Room codes: four letters, no look-alikes (I, O). */
export const ROOM_CODE = /^[A-HJ-NP-Z]{4}$/;

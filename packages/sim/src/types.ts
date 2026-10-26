// Core simulator types (Implementation Plan 2.1).
// A run is fully defined by (race model, seed, list of decisions) — that is what the
// Worker replays to verify a score.

export type Compound = string; // e.g. 'SOFT' | 'MEDIUM' | 'HARD'; era-dependent set

export type Era = '1988-1993' | '1994-2009' | '2010-2013' | '2014-2025' | '2026+';

export type FlagState = 'green' | 'sc' | 'vsc';

export type PaceMode = 'push' | 'standard' | 'manage';
export type BattleMode = 'attack' | 'hold' | 'defend';

export interface CompoundModel {
  offset: number;
  degPerLap: number;
  cliffLap: number;
}

export interface DriverModel {
  code: string;
  team: string;
  basePace: number;
  noise: number;
  stateAtTakeover: {
    position: number;
    gapAhead: number;
    compound: Compound;
    tyreAge: number;
  };
  realStrategy: Array<{ lap: number; to: Compound }>;
}

export interface RaceEvent {
  lap: number;
  type: 'SC' | 'VSC' | 'RED' | 'RAIN' | 'RETIREMENT';
  laps?: number;
  driver?: string;
}

// Parsed + validated race JSON (validated at load time with zod or ajv).
export interface RaceModel {
  schemaVersion: number;
  race: { id: string; name?: string; laps: number; takeoverLap: number; seed: number };
  era: Era;
  track: {
    pitLoss: number;
    pitLossUnderSC: number;
    overtakeDifficulty: number;
    dirtyAirPenalty: number;
    greenLapTime?: number;
    scLapTime?: number;
    vscLapTime?: number;
  };
  compounds: Record<Compound, CompoundModel>;
  drivers: DriverModel[];
  fuelEffectPerLap: number;
  events: RaceEvent[];
  decisionMoments: number[];
  realResult: string[];
  userSide: string;
  reconstructed?: boolean;
}

export interface CarState {
  code: string;
  position: number;
  totalTime: number;
  compound: Compound;
  tyreAge: number;
  lapsOnFuel: number;
  inPitThisLap: boolean;
  retired: boolean;
  modes: { pace: PaceMode; battle: BattleMode };
}

export type Decision =
  | { lap: number; kind: 'pit'; compound: Compound }
  | { lap: number; kind: 'mode'; key: 'pace' | 'battle'; value: string }
  | { lap: number; kind: 'radio'; momentId: string; optionId: string };

export interface RaceState {
  lap: number;
  cars: CarState[];
  flag: FlagState;
}

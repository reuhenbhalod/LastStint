// Who's who for the driver card: full name and race number by timing code. The race model
// carries codes and teams only; these are the 2021 grid's (the one race in the beta).

export interface DriverInfo {
  name: string;
  number: number;
}

const DRIVERS: Record<string, DriverInfo> = {
  VER: { name: 'Max Verstappen', number: 33 },
  HAM: { name: 'Lewis Hamilton', number: 44 },
  BOT: { name: 'Valtteri Bottas', number: 77 },
  PER: { name: 'Sergio Pérez', number: 11 },
  NOR: { name: 'Lando Norris', number: 4 },
  RIC: { name: 'Daniel Ricciardo', number: 3 },
  LEC: { name: 'Charles Leclerc', number: 16 },
  SAI: { name: 'Carlos Sainz', number: 55 },
  GAS: { name: 'Pierre Gasly', number: 10 },
  TSU: { name: 'Yuki Tsunoda', number: 22 },
  ALO: { name: 'Fernando Alonso', number: 14 },
  OCO: { name: 'Esteban Ocon', number: 31 },
  VET: { name: 'Sebastian Vettel', number: 5 },
  STR: { name: 'Lance Stroll', number: 18 },
  RAI: { name: 'Kimi Räikkönen', number: 7 },
  GIO: { name: 'Antonio Giovinazzi', number: 99 },
  RUS: { name: 'George Russell', number: 63 },
  LAT: { name: 'Nicholas Latifi', number: 6 },
  MSC: { name: 'Mick Schumacher', number: 47 },
  MAZ: { name: 'Nikita Mazepin', number: 9 },
};

export function driverInfo(code: string): DriverInfo | null {
  return DRIVERS[code] ?? null;
}

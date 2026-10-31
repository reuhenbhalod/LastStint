import { readFileSync } from 'node:fs';
import { initRun, stepLap } from '../src/sim.js';
const base = JSON.parse(readFileSync('../../data/races/abu-dhabi-2021.json','utf8'));
const m = {...base, race:{...base.race, seed: 1205}};
const run = initRun(m, 1205, { decisions: [{lap:36,kind:'pit',compound:'HARD'}] });
let prev='';
while (run.state.lap < 53) { stepLap(run); const c=run.state.cars as any;
  console.log(run.state.lap, run.state.flag, 'HAM', c.HAM.compound, c.HAM.tyreAge, 'VER', c.VER.compound, c.VER.tyreAge, 'gap', (c.VER.totalTime-c.HAM.totalTime).toFixed(2)); }
console.log(JSON.stringify(run.notes)); console.log('VER strategy', JSON.stringify((run.state.cars as any).VER.strategy));

// What-if check (realism): famous calls with a broad fan consensus, graded from the real race
// state, to see whether the grader agrees.
//   pnpm --filter @boxthislap/sim whatif
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type GradeOption, type Target, gradeMoment } from '../src/grade.js';
import { pauseAt } from '../src/moments.js';
import type { RaceModel } from '../src/types.js';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const load = (id: string) =>
  JSON.parse(readFileSync(join(repo, 'data', 'races', `${id}.json`), 'utf8')) as RaceModel;

interface Case {
  name: string;
  race: string;
  user: string;
  rival: string;
  lap: number;
  options: Array<[string, string | null]>; // [id, compound or null = stay out]
  expect: string[] | null; // ids consensus considers right (null = divided)
  why: string;
}

const CASES: Case[] = [
  {
    name: 'Abu Dhabi 21, VSC lap 36: HAM boxes too?',
    race: 'abu-dhabi-2021',
    user: 'HAM',
    rival: 'VER',
    lap: 36,
    options: [
      ['stay-out', null],
      ['box-hard', 'HARD'],
    ],
    expect: ['box-hard'],
    why: 'VER took a cheap VSC stop; Mercedes is widely said to have missed it',
  },
  {
    name: 'Abu Dhabi 21, SC lap 53: HAM boxes for softs?',
    race: 'abu-dhabi-2021',
    user: 'HAM',
    rival: 'VER',
    lap: 53,
    options: [
      ['stay-out', null],
      ['box-soft', 'SOFT'],
      ['box-hard', 'HARD'],
    ],
    expect: null,
    why: 'divided: boxing hands VER the lead if he stays out',
  },
  {
    name: 'Hungary 19, lap 48: HAM second stop?',
    race: 'hungary-2019',
    user: 'HAM',
    rival: 'VER',
    lap: 48,
    options: [
      ['stay-out', null],
      ['box-medium', 'MEDIUM'],
    ],
    expect: ['box-medium'],
    why: 'the extra stop won the race',
  },
  {
    name: 'Hungary 22, lap 39: LEC on hards or mediums?',
    race: 'hungary-2022',
    user: 'LEC',
    rival: 'VER',
    lap: 39,
    options: [
      ['box-hard', 'HARD'],
      ['box-medium', 'MEDIUM'],
      ['stay-out', null],
    ],
    expect: ['box-medium', 'stay-out'],
    why: 'the hards were the famous Ferrari error',
  },
  {
    name: 'Bahrain 21, lap 13: HAM undercut?',
    race: 'bahrain-2021',
    user: 'HAM',
    rival: 'VER',
    lap: 13,
    options: [
      ['box-hard', 'HARD'],
      ['stay-out', null],
    ],
    expect: ['box-hard'],
    why: 'the early stop undercut VER and set up the win',
  },
  {
    name: 'Canada 22, SC lap 49: SAI boxes?',
    race: 'canada-2022',
    user: 'SAI',
    rival: 'VER',
    lap: 49,
    options: [
      ['box-hard', 'HARD'],
      ['stay-out', null],
    ],
    expect: ['box-hard'],
    why: 'a cheap SC stop for fresh tyres on a 29-lap-old set',
  },
  {
    name: 'Miami 22, SC lap 41: LEC boxes?',
    race: 'miami-2022',
    user: 'LEC',
    rival: 'VER',
    lap: 41,
    options: [
      ['stay-out', null],
      ['box-medium', 'MEDIUM'],
    ],
    expect: ['stay-out'],
    why: 'the top two kept track position',
  },
  {
    name: 'Italy 24, lap 38: PIA second stop?',
    race: 'italy-2024',
    user: 'PIA',
    rival: 'LEC',
    lap: 38,
    options: [
      ['stay-out', null],
      ['box-hard', 'HARD'],
    ],
    expect: ['stay-out'],
    why: "LEC's one-stop beat the two-stoppers",
  },
  {
    name: 'Spain 21, lap 42: HAM second stop?',
    race: 'spain-2021',
    user: 'HAM',
    rival: 'VER',
    lap: 42,
    options: [
      ['stay-out', null],
      ['box-medium', 'MEDIUM'],
    ],
    expect: ['box-medium'],
    why: 'the extra stop ran VER down and won the race',
  },
  {
    name: 'France 21, lap 32: VER second stop?',
    race: 'france-2021',
    user: 'VER',
    rival: 'HAM',
    lap: 32,
    options: [
      ['stay-out', null],
      ['box-medium', 'MEDIUM'],
    ],
    expect: ['box-medium'],
    why: 'the two-stop caught and passed HAM a lap from the end',
  },
  {
    name: 'Saudi 22, SC lap 16: LEC boxes?',
    race: 'saudi-2022',
    user: 'LEC',
    rival: 'VER',
    lap: 16,
    options: [
      ['box-hard', 'HARD'],
      ['stay-out', null],
    ],
    expect: ['box-hard'],
    why: 'a cheap SC stop that jumped PER, who had just pitted',
  },
  {
    name: 'Singapore 23, VSC lap 44: RUS boxes?',
    race: 'singapore-2023',
    user: 'RUS',
    rival: 'SAI',
    lap: 44,
    options: [
      ['stay-out', null],
      ['box-medium', 'MEDIUM'],
    ],
    expect: ['box-medium'],
    why: 'the VSC stop for mediums brought Mercedes back onto the leaders',
  },
];

const SAMPLES = Number(process.argv[2] ?? 1000);
// Options within this many win-probability points of the best are a tie: the grader has no
// real preference, so a tie doesn't count as agreeing.
const TIE = 0.01;
const target: Target = { kind: 'beat-rival' };
let agree = 0;
let scored = 0;
for (const c of CASES) {
  const model = { ...load(c.race), userSide: c.user, rival: c.rival };
  const run = pauseAt(model, c.lap);
  const options: GradeOption[] = c.options.map(([id, compound]) => ({
    id,
    decisions: compound ? [{ lap: c.lap, kind: 'pit', compound }] : [],
  }));
  const g = gradeMoment(run, options, target, SAMPLES);
  const top = Math.max(...g.options.map((o) => o.probability));
  const tied = g.options.filter((o) => top - o.probability < TIE).length > 1;
  const verdict =
    c.expect === null ? 'info' : tied ? 'TIE' : c.expect.includes(g.best) ? 'AGREES' : 'DISAGREES';
  if (c.expect !== null) {
    scored++;
    if (verdict === 'AGREES') agree++;
  }
  const opts = g.options
    .map((o) => `${o.id} ${(o.probability * 100).toFixed(1)}% (${o.band})`)
    .join(', ');
  console.log(`${verdict.padEnd(9)} ${c.name}\n          ${opts}\n          consensus: ${c.why}`);
}
console.log(`\n${agree}/${scored} agree with the consensus (${SAMPLES} samples per option)`);

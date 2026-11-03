// Moment author (races batch 1): builds a race's decision moments to the Abu Dhabi recipe and
// keeps only real dilemmas.
//   pnpm --filter @boxthislap/sim author <race-id> [--rival CODE] [--samples N] [--write]
//
// Candidates, all graded from the real race's state at their lap (pauseAt):
//   - the race plan when you take over: run to plan, manage, push, box now (two compounds);
//   - the moment finder's stop calls (SC, VSC, the rival's stops, the undercut window, the
//     tyre cliff), offered as stay out / box per compound / box next lap;
//   - pace calls every few laps: push, standard, manage, push and attack;
//   - battle calls (defend, hold, attack) at a restart, and late in the race when the rival
//     is within reach.
// Kept: the race plan, then up to MAX_MOMENTS more that pass the quality bar (verdict
// "keep"), at least MIN_SPACING laps apart, the most tense first. --rival grades against
// another car (a "defend" race: the car behind); --write saves data/moments/<race>.json and
// puts the moments in the race file.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gradeMoment } from '../src/grade.js';
import {
  type DecisionMoment,
  type MomentOption,
  candidateMoments,
  pauseAt,
  verdictFor,
} from '../src/moments.js';
import type { Decision, RaceModel } from '../src/types.js';

const MAX_MOMENTS = 6;
const MIN_SPACING = 3;
const PACE_EVERY = 4;

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const raceId = args[0];
if (!raceId) {
  console.error('usage: author <race-id> [--rival CODE] [--samples N] [--write]');
  process.exit(2);
}
const samples = flag('--samples') ? Number(flag('--samples')) : undefined;
const write = args.includes('--write');
const racePath = join(repo, 'data', 'races', `${raceId}.json`);
const raw = readFileSync(racePath, 'utf8');
const file = JSON.parse(raw) as RaceModel;
const model: RaceModel = { ...file, rival: flag('--rival') ?? file.rival, decisionMoments: [] };
const target = { kind: 'beat-rival' } as const;
const first = model.race.takeoverLap + 1;
const last = model.race.laps - 1;

const NAME: Record<string, string> = { SOFT: 'softs', MEDIUM: 'mediums', HARD: 'hards' };
const pit = (lap: number, compound: string): Decision => ({ lap, kind: 'pit', compound });
const mode = (lap: number, key: 'pace' | 'battle', value: string): Decision =>
  ({ lap, kind: 'mode', key, value }) as Decision;

/** Neutralized laps (SC or VSC), from the race's events. */
const neutral = new Set<number>();
for (const e of model.events) {
  if (e.type !== 'SC' && e.type !== 'VSC') continue;
  for (let l = e.lap; l < e.lap + (e.laps ?? 1); l++) neutral.add(l);
}

/** Compounds a fresh set of which reaches the flag from `lap`, hardest last. */
function lasting(lap: number): string[] {
  const byGrip = Object.entries(model.compounds).sort((a, b) => a[1].offset - b[1].offset);
  const ok = byGrip.filter(([, c]) => c.cliffLap >= model.race.laps - lap).map(([k]) => k);
  return ok.length ? ok : byGrip.slice(-2).map(([k]) => k);
}

function racePlan(): DecisionMoment {
  const lap = first;
  const box = lasting(lap).slice(-2);
  const real = (model.drivers.find((d) => d.code === model.userSide)?.realStrategy ?? []).find(
    (s) => s.lap - 1 === lap,
  );
  const options: MomentOption[] = [
    { id: 'plan-standard', label: 'Run to plan', decisions: [] },
    {
      id: 'plan-manage',
      label: 'Manage the tyres to the flag',
      decisions: [mode(lap, 'pace', 'manage')],
    },
    { id: 'plan-push', label: 'Push now, build the gap', decisions: [mode(lap, 'pace', 'push')] },
    ...box.map((c) => ({
      id: `plan-box-${c.toLowerCase()}`,
      label: `Box now, ${NAME[c] ?? c.toLowerCase()}`,
      decisions: [pit(lap, c)],
    })),
  ];
  const realId = real
    ? options.find((o) => o.id === `plan-box-${real.to.toLowerCase()}`)?.id
    : null;
  return {
    id: 'race-plan',
    lap,
    trigger: 'takeover',
    target,
    options,
    realOptionId: realId ?? (real ? null : 'plan-standard'),
  };
}

/** A finder stop call, re-offered the Abu Dhabi way. */
function stopCall(m: DecisionMoment): DecisionMoment {
  const lap = m.lap;
  const compounds = Object.keys(model.compounds);
  const next = lap + 1 < model.race.laps;
  // Box next lap: under a neutralization that runs another lap, or a green call (one more lap
  // on these tyres).
  const nextOk = next && (neutral.has(lap) ? neutral.has(lap + 1) : true);
  const nextCompound = lasting(lap + 1).at(-1) as string;
  const options: MomentOption[] = [
    { id: 'stay', label: 'Stay out', decisions: [] },
    ...compounds.map((c) => ({
      id: `box-${c.toLowerCase()}`,
      label: `Box, ${NAME[c] ?? c.toLowerCase()}`,
      decisions: [pit(lap, c)],
    })),
    ...(nextOk
      ? [
          {
            id: `box-next-${nextCompound.toLowerCase()}`,
            label: `Box next lap, ${NAME[nextCompound] ?? nextCompound.toLowerCase()}`,
            decisions: [pit(lap + 1, nextCompound)],
          },
        ]
      : []),
  ];
  const realOld = m.realOptionId;
  const realCompound = realOld?.startsWith('box-') ? realOld.slice(4) : null;
  return {
    id: `${m.trigger.toLowerCase()}-${lap}`,
    lap,
    trigger: m.trigger,
    target,
    options,
    realOptionId: realOld === 'stay-out' ? 'stay' : realCompound ? `box-${realCompound}` : null,
  };
}

function paceCall(lap: number): DecisionMoment {
  return {
    id: `pace-${lap}`,
    lap,
    trigger: 'cliff',
    target,
    options: [
      { id: 'push', label: 'Push now', decisions: [mode(lap, 'pace', 'push')] },
      { id: 'standard', label: 'Standard pace', decisions: [mode(lap, 'pace', 'standard')] },
      { id: 'manage', label: 'Manage the tyres', decisions: [mode(lap, 'pace', 'manage')] },
      {
        id: 'push-attack',
        label: 'Push and attack',
        decisions: [mode(lap, 'pace', 'push'), mode(lap, 'battle', 'attack')],
      },
    ],
    realOptionId: null,
  };
}

function battleCall(lap: number, trigger: 'SC' | 'cliff'): DecisionMoment {
  return {
    id: `battle-${lap}`,
    lap,
    trigger,
    target,
    options: [
      { id: 'defend', label: 'Defend hard', decisions: [mode(lap, 'battle', 'defend')] },
      { id: 'hold', label: 'Hold the line', decisions: [mode(lap, 'battle', 'hold')] },
      { id: 'attack', label: 'Attack', decisions: [mode(lap, 'battle', 'attack')] },
    ],
    realOptionId: null,
  };
}

// The candidates.
const candidates: DecisionMoment[] = [];
for (const m of candidateMoments(model, target)) candidates.push(stopCall(m));
for (let lap = first + 3; lap <= last - 2; lap += PACE_EVERY) candidates.push(paceCall(lap));
for (const e of model.events) {
  if (e.type !== 'SC') continue;
  const restart = e.lap + (e.laps ?? 1) - 1;
  if (restart > first && restart <= last) candidates.push(battleCall(restart, 'SC'));
}
// Late in the race, if the rival is within reach in the real race.
{
  const late = Math.max(first + 2, model.race.laps - 6);
  const run = pauseAt(model, late);
  const me = run.state.cars[model.userSide];
  const them = run.state.cars[model.rival];
  if (me && them && !me.retired && !them.retired && Math.abs(them.totalTime - me.totalTime) < 4) {
    candidates.push(battleCall(late, 'cliff'));
  }
}

// Grade them all.
const graded = candidates.map((m) => {
  const grade = gradeMoment(pauseAt(model, m.lap), m.options, m.target, samples);
  const ps = grade.options.map((o) => o.probability * 100).sort((a, b) => b - a);
  return { m, grade, verdict: verdictFor(grade), spread: (ps[0] ?? 0) - (ps.at(-1) ?? 0) };
});
const plan = racePlan();
const planGrade = gradeMoment(pauseAt(model, plan.lap), plan.options, plan.target, samples);

const show = (m: DecisionMoment, g: (typeof graded)[number]['grade'], v: string) =>
  console.log(
    `lap ${String(m.lap).padStart(2)} ${m.id.padEnd(16)} ${v.padEnd(10)} ${g.options
      .map((o) => `${o.id} ${(o.probability * 100).toFixed(0)}% ${o.band}`)
      .join(' | ')}`,
  );
console.log(
  `${raceId}: ${model.userSide} vs ${model.rival}, takeover lap ${model.race.takeoverLap}`,
);
show(plan, planGrade, verdictFor(planGrade));
for (const g of graded) show(g.m, g.grade, g.verdict);

// Pick, for variety like Abu Dhabi's: the race plan, then the passing stop calls, then one
// battle call, then pace calls (at most MAX_PACE, or one more if the race has fewer than
// MIN_CALLS calls otherwise); each group most tense first, all spaced out.
const MAX_PACE = 2;
const MIN_CALLS = 4;
const picked: DecisionMoment[] = [plan];
const keep = graded.filter((x) => x.verdict === 'keep').sort((a, b) => b.spread - a.spread);
// Calls are MIN_SPACING laps apart; the race plan only needs a lap of its own (Abu Dhabi
// has the plan on lap 35 and the VSC call on 36).
const fits = (m: DecisionMoment) =>
  picked.length <= MAX_MOMENTS &&
  m.lap !== plan.lap &&
  !picked.some((p) => p !== plan && Math.abs(p.lap - m.lap) < MIN_SPACING);
const kind = (m: DecisionMoment) =>
  m.id.startsWith('pace-') ? 'pace' : m.id.startsWith('battle-') ? 'battle' : 'stop';
for (const g of keep.filter((x) => kind(x.m) === 'stop')) if (fits(g.m)) picked.push(g.m);
for (const g of keep.filter((x) => kind(x.m) === 'battle').slice(0, 1))
  if (fits(g.m)) picked.push(g.m);
let pace = 0;
for (const g of keep.filter((x) => kind(x.m) === 'pace')) {
  const cap = picked.length - 1 + (MAX_PACE - pace) < MIN_CALLS ? MAX_PACE + 1 : MAX_PACE;
  if (pace >= cap) break;
  if (fits(g.m)) {
    picked.push(g.m);
    pace++;
  }
}
picked.sort((a, b) => a.lap - b.lap);
console.log(
  `picked ${picked.length - 1} moments + the race plan: ${picked.map((p) => `${p.id}@${p.lap}`).join(', ')}`,
);

if (write) {
  writeFileSync(
    join(repo, 'data', 'moments', `${raceId}.json`),
    `${JSON.stringify(picked, null, 2)}\n`,
  );
  const out = { ...JSON.parse(raw), rival: model.rival, decisionMoments: picked };
  writeFileSync(racePath, `${JSON.stringify(out, null, 2)}${raw.endsWith('\n') ? '\n' : ''}`);
  console.log(`wrote data/moments/${raceId}.json and the race file`);
}

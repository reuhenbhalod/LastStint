// The moment-authoring recipe (races batch 1), shared by the author and tune scripts: builds
// a race's decision moments the Abu Dhabi way and keeps only real dilemmas. See author.ts for
// the recipe.

import { gradeMoment } from '../src/grade.js';
import {
  type DecisionMoment,
  type MomentOption,
  candidateMoments,
  pauseAt,
  verdictFor,
} from '../src/moments.js';
import type { Decision, RaceModel } from '../src/types.js';
import { wetnessOn } from '../src/weather.js';

const MAX_MOMENTS = 6;
const MIN_SPACING = 3;
const PACE_EVERY = 4;

/** Up to `max` graded calls (MAX_MOMENTS; survivor races take 2) for `model` (its seed, rival
 * and takeover as given). `log` receives a line per candidate. The plan at takeover is the
 * strategy planner's (docs/strategy-planner-spec.md), not a moment. */
export function authorMoments(
  model: RaceModel,
  samples?: number,
  log: (line: string) => void = () => {},
  max = MAX_MOMENTS,
): DecisionMoment[] {
  const target = { kind: 'beat-rival' } as const;
  const first = model.race.takeoverLap + 1;
  const last = model.race.laps - 1;
  const NAME: Record<string, string> = {
    SOFT: 'softs',
    MEDIUM: 'mediums',
    HARD: 'hards',
    INTERMEDIATE: 'inters',
    WET: 'wets',
  };
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

  /** A finder stop call, re-offered the Abu Dhabi way. */
  function stopCall(m: DecisionMoment): DecisionMoment {
    const lap = m.lap;
    const compounds = Object.keys(model.compounds);
    const next = lap + 1 < model.race.laps;
    // Box next lap: under a neutralization that runs another lap, or a green call (one more lap
    // on these tyres).
    const nextOk = next && (neutral.has(lap) ? neutral.has(lap + 1) : true);
    // A wet race: the tyre for the track next lap (inters as it turns wet, wets when soaked).
    const wetNext = model.weather ? wetnessOn(model.weather.wetness, lap + 1) : 0;
    const nextCompound =
      wetNext >= 0.6 && model.compounds.WET
        ? 'WET'
        : wetNext >= 0.05 && model.compounds.INTERMEDIATE
          ? 'INTERMEDIATE'
          : (lasting(lap + 1).at(-1) as string);
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
  // The real team's own stops (the in-lap): the calls they actually made. Kept even when the
  // answer is clear (verdict no-tension), so a race can always be played the real way.
  const realStops = new Set<number>();
  for (const s of model.drivers.find((d) => d.code === model.userSide)?.realStrategy ?? []) {
    const lap = s.lap - 1;
    if (lap <= first || lap > last || candidates.some((c) => c.lap === lap)) continue;
    realStops.add(lap);
    const call = stopCall({
      id: '',
      lap,
      trigger: neutral.has(lap) ? 'SC' : 'cliff',
      target,
      options: [],
      realOptionId: `box-${s.to.toLowerCase()}`,
    });
    candidates.push({ ...call, id: `stop-${lap}` });
  }
  // Stops that land on an existing candidate's lap mark that one as the real stop call.
  for (const s of model.drivers.find((d) => d.code === model.userSide)?.realStrategy ?? []) {
    const c = candidates.find((x) => x.lap === s.lap - 1 && !x.id.startsWith('pace-'));
    if (c) realStops.add(c.lap);
  }
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

  const show = (m: DecisionMoment, g: (typeof graded)[number]['grade'], v: string) =>
    log(
      `lap ${String(m.lap).padStart(2)} ${m.id.padEnd(16)} ${v.padEnd(10)} ${g.options
        .map((o) => `${o.id} ${(o.probability * 100).toFixed(0)}% ${o.band}`)
        .join(' | ')}`,
    );
  log(
    `${model.race.id}: ${model.userSide} vs ${model.rival}, takeover lap ${model.race.takeoverLap}`,
  );
  for (const g of graded) show(g.m, g.grade, g.verdict);

  // Pick, for variety like Abu Dhabi's: the passing stop calls, then one battle call, then pace
  // calls (at most MAX_PACE, or one more if the race has fewer than
  // MIN_CALLS calls otherwise); each group most tense first, all spaced out.
  const MAX_PACE = 2;
  const MIN_CALLS = 4;
  const picked: DecisionMoment[] = [];
  const keep = graded
    .filter(
      (x) =>
        x.verdict === 'keep' ||
        (realStops.has(x.m.lap) && x.verdict === 'no-tension' && !x.m.id.startsWith('pace-')),
    )
    // The real stops first (a race must be playable the real way), then the most tense.
    .sort(
      (a, b) =>
        Number(realStops.has(b.m.lap)) - Number(realStops.has(a.m.lap)) || b.spread - a.spread,
    );
  // Calls are MIN_SPACING laps apart, and none on the first lap (the plan is picked there).
  const fits = (m: DecisionMoment) =>
    picked.length < max &&
    m.lap !== first &&
    !picked.some((p) => Math.abs(p.lap - m.lap) < MIN_SPACING);
  const kind = (m: DecisionMoment) =>
    m.id.startsWith('pace-') ? 'pace' : m.id.startsWith('battle-') ? 'battle' : 'stop';
  for (const g of keep.filter((x) => kind(x.m) === 'stop')) if (fits(g.m)) picked.push(g.m);
  for (const g of keep.filter((x) => kind(x.m) === 'battle').slice(0, 1))
    if (fits(g.m)) picked.push(g.m);
  let pace = 0;
  for (const g of keep.filter((x) => kind(x.m) === 'pace')) {
    const cap = picked.length + (MAX_PACE - pace) < MIN_CALLS ? MAX_PACE + 1 : MAX_PACE;
    if (pace >= cap) break;
    if (fits(g.m)) {
      picked.push(g.m);
      pace++;
    }
  }
  picked.sort((a, b) => a.lap - b.lap);
  return picked;
}

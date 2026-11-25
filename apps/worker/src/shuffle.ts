// Which race plays on each new daily: a random order, not a rotation. Each race plays once
// before any race repeats (a shuffle bag, counted from the schedule so far), and each pick
// avoids looking like its neighbours: the same circuit first, then the same rival, then the
// same driver. Among the races that clash least, the pick is random.

import { baseRaceId } from '@laststint/sim';
import { addDays } from './dates.js';

export interface RaceFacts {
  id: string;
  userSide?: string;
  rival?: string;
}

// Race ids that name the same circuit differently.
const SAME_CIRCUIT: Record<string, string> = {
  styria: 'austria', // Red Bull Ring
  '70th-anniversary': 'britain', // Silverstone
};

/** The circuit a race id runs at: `mexico-2021` -> `mexico`. */
export function circuitOf(raceId: string): string {
  const name = baseRaceId(raceId).replace(/-\d{4}$/, '');
  return SAME_CIRCUIT[name] ?? name;
}

/** How much `a` playing next to `b` would feel like a repeat (0 = nothing in common). */
export function clash(a: RaceFacts, b: RaceFacts | undefined): number {
  if (!b) return 0;
  let score = 0;
  if (circuitOf(a.id) === circuitOf(b.id)) score += 4;
  if (a.rival && a.rival === b.rival) score += 2;
  if (a.userSide && a.userSide === b.userSide) score += 1;
  return score;
}

/** Pool races already played in the current pass through the pool (the bag's used half). */
export function usedThisPass(pool: readonly RaceFacts[], history: readonly string[]): Set<string> {
  const ids = new Set(pool.map((r) => r.id));
  const used = new Set<string>();
  for (const id of history) {
    if (!ids.has(id)) continue;
    used.add(id);
    if (used.size === ids.size) used.clear();
  }
  return used;
}

/** How many random orders to try; the one with the fewest clashes is kept. */
const ATTEMPTS = 100;
/** A race back within half a pool's length of its last day: worse than any neighbour clash. */
const REPEAT_TOO_SOON = 8;

/**
 * Pick a race for each date in `dates`. `existing` is the schedule so far (any order); its
 * days are never changed, but they count towards the bag and as neighbours. Picking day by
 * day can paint itself into a corner at the end of a pass (the last two races left are both
 * Mexicos), so it draws many random orders and keeps the one with the fewest clashes.
 */
export function pickRaces(
  pool: readonly RaceFacts[],
  existing: ReadonlyArray<{ date: string; raceId: string }>,
  dates: readonly string[],
  random: () => number = Math.random,
): Array<{ date: string; raceId: string }> {
  if (pool.length === 0 || dates.length === 0) return [];
  let best = drawOrder(pool, existing, dates, random);
  for (let i = 1; i < ATTEMPTS && best.cost > 0; i++) {
    const next = drawOrder(pool, existing, dates, random);
    if (next.cost < best.cost) best = next;
  }
  return best.picks;
}

/** One random order, picking day by day the least-clashing fresh race; and its total clash. */
function drawOrder(
  pool: readonly RaceFacts[],
  existing: ReadonlyArray<{ date: string; raceId: string }>,
  dates: readonly string[],
  random: () => number,
): { picks: Array<{ date: string; raceId: string }>; cost: number } {
  const facts = new Map(pool.map((r) => [r.id, r]));
  const byDate = new Map(existing.map((d) => [d.date, d.raceId]));
  const history = [...existing].sort((a, b) => a.date.localeCompare(b.date)).map((d) => d.raceId);
  const used = usedThisPass(pool, history);
  const neighbour = (date: string, days: number) => {
    const id = byDate.get(addDays(date, days));
    return id ? (facts.get(id) ?? { id }) : undefined;
  };

  const spacing = Math.floor(pool.length / 2);
  const picks: Array<{ date: string; raceId: string }> = [];
  let cost = 0;
  for (const date of [...dates].sort()) {
    if (used.size >= pool.length) used.clear();
    const fresh = pool.filter((r) => !used.has(r.id));
    const before = neighbour(date, -1) ?? lastBefore(history, facts, picks);
    const after = neighbour(date, 1);
    // Where one pass meets the next, keep a race from coming straight back.
    const tooSoon = (r: RaceFacts) => {
      for (let d = 1; d <= spacing; d++) {
        if (byDate.get(addDays(date, -d)) === r.id || byDate.get(addDays(date, d)) === r.id) {
          return true;
        }
      }
      return false;
    };
    const score = (r: RaceFacts) =>
      clash(r, before) + clash(r, after) + (tooSoon(r) ? REPEAT_TOO_SOON : 0);
    const least = Math.min(...fresh.map(score));
    const choices = fresh.filter((r) => score(r) === least);
    const pick = choices[Math.floor(random() * choices.length)] ?? choices[0];
    if (!pick) continue;
    cost += least;
    used.add(pick.id);
    byDate.set(date, pick.id);
    picks.push({ date, raceId: pick.id });
  }
  return { picks, cost };
}

function lastBefore(
  history: readonly string[],
  facts: Map<string, RaceFacts>,
  picks: ReadonlyArray<{ raceId: string }>,
): RaceFacts | undefined {
  const id = picks.at(-1)?.raceId ?? history.at(-1);
  return id ? (facts.get(id) ?? { id }) : undefined;
}

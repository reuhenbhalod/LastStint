// What the Eras race intro says (build plan 8.4; eras spec §6, §7, §14): the three stars in
// plain words, from the race's `eras` block and the attempt's difficulty, and the difficulty
// itself. Pure, so every sentence is unit-tested; EraIntro.tsx lays it out. Nothing here is
// made up: a star whose objective isn't authored yet says so (`written: false`).

import {
  type DifficultySettings,
  type ErasTarget,
  type InformationLevel,
  type RaceModel,
  type RivalPolicy,
  teammateOf,
} from '@laststint/sim';
import { surname } from '../data/names.js';

/** "P1", or "P3 or better". */
function atBest(position: number): string {
  return position === 1 ? 'P1' : `P${position} or better`;
}

/**
 * The ★1 target in one plain sentence, from the player's side (`ErasTarget` in the sim's
 * types: `position` and `team` are "or better"; `deny` is "or worse", or out of the race).
 */
export function targetText(target: ErasTarget, model: RaceModel): string {
  switch (target.type) {
    case 'win':
      return 'Win the race';
    case 'defend':
      return 'Keep the lead to the flag and win';
    case 'position':
      return `Finish ${atBest(target.position)}`;
    case 'beat-rival':
      return `Finish ahead of ${surname(target.rival)}`;
    case 'team': {
      const mate = teammateOf(model);
      const [mine, theirs] = target.positions;
      return `Finish ${atBest(mine)}, with ${mate ? surname(mate) : 'your teammate'} ${atBest(theirs)}`;
    }
    case 'deny':
      return `Keep ${surname(target.rival)} at P${target.position} or lower`;
  }
}

/** The ★2 condition: race accuracy at or above the era's threshold. */
export function strategistText(threshold: number): string {
  return `Race accuracy of ${Number(threshold.toFixed(1))}% or more`;
}

/** The ★3 condition: the authored mastery label in full, and the no-orange-or-red rule. */
export function masteryText(label: string): string {
  return `${label.trim().replace(/[.\s]+$/, '')}, and no call graded orange or red`;
}

export const INFORMATION_NAME: Record<InformationLevel, string> = {
  full: 'Full',
  reduced: 'Reduced',
  limited: 'Limited',
  minimal: 'Minimal',
};

/** What each level shows (eras spec §7, "Information levels"). */
export const INFORMATION_DETAIL: Record<InformationLevel, string> = {
  full: 'Exact gaps, the gap trend, every car’s tyre age and the rival’s compound.',
  reduced: 'No gap trend; the rival’s tyre age as a range.',
  limited: 'As Reduced, with gaps rounded to 0.5 s and the rival’s fuel load hidden.',
  minimal: 'Only the gaps to the cars just ahead and behind, once a lap.',
};

export const RIVAL_POLICY_NAME: Record<RivalPolicy, string> = {
  standard: 'Standard',
  'standard-plus': 'Standard+',
  smart: 'Smart',
  expert: 'Expert',
};

/** The decision timer as set: its length, or off by the player's accessibility setting. */
export function timerText(seconds: number, on: boolean): string {
  return on ? `${seconds} s per call` : 'Timer off';
}

export interface StarLine {
  star: 1 | 2 | 3;
  name: 'Result' | 'Strategist' | 'Mastery';
  /** The condition in full; null when the race's objective isn't written yet. */
  text: string | null;
}

/**
 * The race's three stars, or null when the race has no `eras` block yet (its objectives
 * aren't written: content step 6.2), so the intro shows a marked empty slot instead.
 */
export function starLines(model: RaceModel, difficulty: DifficultySettings): StarLine[] | null {
  const eras = model.eras;
  if (!eras) return null;
  return [
    { star: 1, name: 'Result', text: eras.target ? targetText(eras.target, model) : null },
    { star: 2, name: 'Strategist', text: strategistText(difficulty.accuracyThreshold) },
    { star: 3, name: 'Mastery', text: eras.mastery ? masteryText(eras.mastery.label) : null },
  ];
}

/** Rebuilt without full lap timing, by the race file's own flag. */
export function isReconstructed(model: RaceModel): boolean {
  return model.reconstructed === true || model.provenance?.kind === 'reconstructed';
}

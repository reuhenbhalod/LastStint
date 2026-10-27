// Leaderboard names (Phase 4 spec B3): generated from the anonymous ID, so the same player
// always gets the same name and there is nothing to moderate. The ID itself is never shown.

const ADJECTIVES = [
  'Late',
  'Early',
  'Bold',
  'Calm',
  'Brave',
  'Sly',
  'Swift',
  'Cool',
  'Sharp',
  'Steady',
  'Clever',
  'Daring',
  'Patient',
  'Quick',
  'Smooth',
  'Wily',
  'Fearless',
  'Cunning',
  'Gritty',
  'Lucky',
  'Precise',
  'Rapid',
  'Silent',
  'Tactical',
];
const NOUNS = [
  'Braker',
  'Strategist',
  'Undercutter',
  'Overcutter',
  'Pit Wall',
  'Engineer',
  'Racer',
  'Lollipop',
  'Tyre Whisperer',
  'Apex Hunter',
  'Slipstreamer',
  'Racecraft',
  'Stint Planner',
  'Gambler',
  'Defender',
  'Chaser',
  'Fox',
  'Professor',
  'Pilot',
  'Wingman',
];

/** FNV-1a: a stable, fast 32-bit hash. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function displayName(anonId: string): string {
  const h = fnv1a(anonId);
  const adjective = ADJECTIVES[h % ADJECTIVES.length];
  const noun = NOUNS[Math.floor(h / ADJECTIVES.length) % NOUNS.length];
  const number = Math.floor(h / (ADJECTIVES.length * NOUNS.length)) % 1000;
  return `${adjective} ${noun} ${String(number).padStart(3, '0')}`;
}

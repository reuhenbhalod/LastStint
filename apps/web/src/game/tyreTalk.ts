// What the radio says about our tyres (docs/tyre-calls-spec.md): the facts that matter right
// now instead of the tyre age alone, each worked out from the figures the race runs on and left
// out when it isn't true. Wordings vary by lap, so a replay of the same day reads the same.

import { type RaceModel, type RaceState, isWetTyre, tyreLife } from '@laststint/sim';

/** Seconds a lap the tyres have lost to wear against a new set of the same compound. */
export function tyreLoss(model: RaceModel, compound: string, wear: number): number {
  const c = model.compounds[compound];
  if (!c) return 0;
  const past = Math.max(0, wear - c.cliffLap);
  const quad = (c.degQuad ?? 0) * wear * wear; // Eras model fix S4 (absent outside Eras)
  return c.degPerLap * wear + quad + (c.cliffDegPerLap ?? 2 * c.degPerLap) * past;
}

/** A rejoin is only claimed with this much room either side (a stop's cost varies). */
const REJOIN_CLEAR = 1.5;
/** Room ahead on the rejoin that counts as clean air. */
const CLEAN_AIR = 3;
/** A car closer than this behind is fighting us on track (the battle calls), not undercutting. */
const UNDERCUT_MIN = 0.8;
/** Wear loss (s/lap) worth mentioning. */
const LOSS_WORTH = 0.3;

/** One of `lines`, picked by `lap`. */
export function pick<T>(lines: readonly T[], lap: number): T {
  return lines[lap % lines.length] as T;
}

const fmt = (s: number) => s.toFixed(1);

/** The car directly behind ours, and its gap, if it's within reach of a one-lap undercut. */
function undercutThreat(race: RaceState, model: RaceModel): { code: string; gap: number } | null {
  const me = race.cars[model.userSide];
  if (!me || me.retired || isWetTyre(me.compound)) return null;
  const behind = Object.values(race.cars)
    .filter((c) => !c.retired && c.code !== me.code && c.totalTime > me.totalTime)
    .sort((a, b) => a.totalTime - b.totalTime)[0];
  if (!behind || behind.tyreAge < 5) return null; // he's just stopped: no undercut to make
  const gap = behind.totalTime - me.totalTime;
  // What a new set gains on our worn one over the lap he'd make it on.
  const gain = tyreLoss(model, me.compound, me.tyreWear) - (model.freshTyre?.bonus ?? 0);
  // Closer than UNDERCUT_MIN is a fight on track, not a pit-stop play.
  return gap >= UNDERCUT_MIN && gap < gain ? { code: behind.code, gap } : null;
}

/** Where a stop now would put us, when the gaps around that spot are clear enough to say. */
function rejoin(
  race: RaceState,
  model: RaceModel,
  loss: number,
): { place: number; ahead: string | null; gap: number } | null {
  const me = race.cars[model.userSide];
  if (!me || me.retired) return null;
  const at = me.totalTime + loss;
  const others = Object.values(race.cars)
    .filter((c) => !c.retired && c.code !== me.code)
    .sort((a, b) => a.totalTime - b.totalTime);
  const ahead = others.filter((c) => c.totalTime < at);
  const front = ahead[ahead.length - 1];
  const back = others.find((c) => c.totalTime >= at);
  const gapAhead = front ? at - front.totalTime : Number.POSITIVE_INFINITY;
  const gapBehind = back ? back.totalTime - at : Number.POSITIVE_INFINITY;
  if (Math.min(gapAhead, gapBehind) < REJOIN_CLEAR) return null;
  return { place: ahead.length + 1, ahead: front?.code ?? null, gap: gapAhead };
}

/** The tyre facts for the big calls, most pressing first. `loss` is what a stop costs now
 * (null: the call offers no stop, so no rejoin). */
export function tyreFacts(race: RaceState, model: RaceModel, loss: number | null): string[] {
  const me = race.cars[model.userSide];
  if (!me || me.retired) return [];
  const lap = race.lap;
  const left = model.race.laps - lap;
  const facts: string[] = [];

  const threat = undercutThreat(race, model);
  if (threat) {
    facts.push(
      loss === null
        ? pick(
            [
              `${threat.code} is ${fmt(threat.gap)} s behind and close enough to undercut us.`,
              `${threat.code} is only ${fmt(threat.gap)} s back. A quick lap keeps him out of the undercut.`,
            ],
            lap,
          )
        : pick(
            [
              `${threat.code} is ${fmt(threat.gap)} s behind. If he stops first, he can jump us.`,
              `${threat.code} is ${fmt(threat.gap)} s back, in undercut range.`,
            ],
            lap,
          ),
    );
  }

  const spot = loss === null ? null : rejoin(race, model, loss);
  if (spot) {
    facts.push(
      !spot.ahead || spot.gap >= CLEAN_AIR
        ? pick(
            [
              `Box now and we come out P${spot.place} in clean air.`,
              `A stop now puts us out P${spot.place}, with room ahead.`,
            ],
            lap,
          )
        : pick(
            [
              `Box now and we come out P${spot.place}, ${fmt(spot.gap)} s behind ${spot.ahead}.`,
              `A stop now drops us to P${spot.place}, right behind ${spot.ahead}.`,
            ],
            lap,
          ),
    );
  }

  const c = model.compounds[me.compound];
  if (c && !isWetTyre(me.compound)) {
    const life = Math.round(tyreLife(c) - me.tyreWear);
    facts.push(
      life <= 0
        ? pick(
            [
              `These are past their life, ${left} to go.`,
              `We're beyond what these are good for, ${left} laps to go.`,
            ],
            lap,
          )
        : pick(
            [
              `About ${life} ${life === 1 ? 'lap' : 'laps'} left in these, ${left} to go.`,
              `These have about ${life} ${life === 1 ? 'lap' : 'laps'} in them and there are ${left} to go.`,
            ],
            lap,
          ),
    );
  }

  const now = tyreLoss(model, me.compound, me.tyreWear);
  if (now >= LOSS_WORTH && !isWetTyre(me.compound)) {
    const rise = now - tyreLoss(model, me.compound, Math.max(0, me.tyreWear - 3));
    facts.push(
      rise >= 0.15
        ? pick(
            [
              `They're costing us ${fmt(now)} s a lap now, up ${fmt(rise)} in three laps.`,
              `We're ${fmt(now)} s a lap off a new set, and it's getting worse.`,
            ],
            lap,
          )
        : pick(
            [
              `They're costing us ${fmt(now)} s a lap against a new set.`,
              `We're ${fmt(now)} s a lap off a new set.`,
            ],
            lap,
          ),
    );
  }
  return facts;
}

const TYRE: Record<string, string> = {
  SOFT: 'softs',
  MEDIUM: 'mediums',
  HARD: 'hards',
  INTERMEDIATE: 'inters',
  WET: 'wets',
};

/** The driver: the tyres are starting to go. */
export function startingToGo(compound: string, lap: number): string {
  const t = TYRE[compound] ?? 'tyres';
  return pick(
    [
      `These ${t} are starting to go. Do I look after them?`,
      `I'm starting to slide on these ${t}. Manage them?`,
      `The rears are going off. Want me to save the ${t}?`,
    ],
    lap,
  );
}

/** The driver: the tyres are gone, he wants to box. Asked again only as they get worse
 * (engineerCalls requestCall): `level` 2 is past their life, 3 is nothing left at all. */
export function wantToBox(compound: string, lap: number, level: 1 | 2 | 3 = 1): string {
  const t = TYRE[compound] ?? 'tyres';
  if (level === 3) {
    return pick(
      [
        `There's nothing left in these ${t}. I can barely keep it on the road. Box!`,
        `These ${t} are completely finished. I'm a passenger out here. Box me!`,
      ],
      lap,
    );
  }
  if (level === 2) {
    return pick(
      [
        `These ${t} are way past it now. I'm losing seconds every lap. Box?`,
        `It's getting worse. These ${t} are done. Can we stop?`,
      ],
      lap,
    );
  }
  return pick(
    [
      `These ${t} are gone. I want to box!`,
      `I've got nothing left in these ${t}. Box me!`,
      `I'm sliding everywhere. We need to stop!`,
    ],
    lap,
  );
}

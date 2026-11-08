// The race engineer's radio (race engineer spec D2-D5): what the wall is asked, lap by lap,
// between the big graded moments. Most pressing first:
//   1. a safety car the race model doesn't have (a crash): box or stay;
//   2. a battle with the car directly ahead or behind (within 1.5 s): the move for the lap,
//      named by the corner it's fought into; 5 seconds, in slow motion; no answer and the
//      driver picks his own;
//   3. trouble: a broken front wing (box for a nose?), track-limit strikes, a lapped car;
//   4. the driver asking: "the tyres are gone, can I box?", "let me push";
//   5. the battery running low with a car close;
//   6. the engineer's own questions on the quick-call laps (quickCalls.ts).
// Every answer is a call the race model plays, logged for the server's replay. Every offer
// follows the race's rules (eras build plan 8.5, eras/raceRules.ts): no DRS or battery moves
// the race doesn't have, the two-compound warning only where the rule applies, and only tyres
// a stop may fit.
// In Eras (`info`, eras spec §7) what the radio says follows the information level: gaps
// rounded at Limited, at Minimal only the gaps to the cars directly ahead and behind, and the
// other car's tyre age as a range from Reduced down. The calls themselves are picked from the
// race as it is. Without it, exactly as before.

import {
  type BattleMove,
  type Decision,
  type EngineerConfig,
  type RaceModel,
  type RaceNote,
  type RaceState,
  battlesFor,
  cleanLap,
  isWetTyre,
  lappedAhead,
  moodOf,
  passProbability,
  readMove,
  ruleSatisfied,
  tyreLife,
  wetPenalty,
  wetnessOn,
} from '@laststint/sim';
import { driverInfo } from '../data/drivers.js';
import {
  FULL_INFORMATION,
  type InformationView,
  gapShown,
  gapText,
  shownGap,
  tyreAgeText,
} from '../eras/difficulty/information.js';
import { moveAllowed, pitCompoundFor, raceScreenEra } from '../eras/raceRules.js';
import type { CornerKind } from '../track/battle.js';
import { lapTime } from '../track/geometry.js';
import { tyreName } from './choices.js';
import { FUEL_BACK, FUEL_SHORT, fuelReading, liftText, marginText } from './fuel.js';
import {
  type BattleLine,
  type BattleOdds,
  FRESH_TYRES,
  type QuickCall,
  type QuickOption,
  quickCallAt,
  safetyCarCall,
} from './quickCalls.js';
import type { LapEvents } from './raceLog.js';

/** Seconds to answer: a battle is now or never; the rest can wait a little longer. */
export const BATTLE_MS = 12000;
export const CALL_MS = 8000;

/** A gap in seconds as the radio says it ("1.4"), rounded as the information level says. */
const secs = (info: InformationView, gap: number) => shownGap(info, gap).toFixed(1);

/** Laps between two stop questions (a "stay out" answer stands for a while). */
export const STOP_ASK_EVERY = 3;

/** Whether a call puts a stop to the wall. */
export function offersStop(call: QuickCall): boolean {
  return call.options.some((o) => [o.call, ...(o.also ?? [])].some((d) => d?.kind === 'pit'));
}

/** What the tyres cost now against new ones (s a lap): wear, and more past the cliff. */
export function tyreLoss(model: RaceModel, compound: string, wear: number): number {
  const c = model.compounds[compound];
  if (!c) return 0;
  const past = Math.max(0, wear - c.cliffLap);
  const quad = (c.degQuad ?? 0) * wear * wear; // Eras model fix S4
  return c.degPerLap * wear + quad + (c.cliffDegPerLap ?? 2 * c.degPerLap) * past;
}

/** What the director remembers between laps (so it doesn't ask the same thing every lap). */
export interface DirectorMemory {
  /** Lap each kind of call was last asked. */
  last: Partial<Record<string, number>>;
  /** The running battle: the other car and how many laps in a row it's been asked about. */
  fight?: { other: string; streak: number };
}

export const newMemory = (): DirectorMemory => ({ last: {} });

/** A battle is asked about every lap it lasts (battles and trust spec D4); the memory keeps
 * the fight's length for the radio. */
function battleDue(other: string, lap: number, mem: DirectorMemory): boolean {
  const f = mem.fight;
  const running = f && f.other === other && lap - (mem.last.battle ?? -99) <= 1;
  mem.fight = { other, streak: running ? (f as { streak: number }).streak + 1 : 1 };
  mem.last.battle = lap;
  return true;
}

const battle = (lap: number, move: BattleMove, driver?: boolean): Decision =>
  driver ? { lap, kind: 'battle', move, driver: true } : { lap, kind: 'battle', move };

/**
 * The move a driver makes himself, by attitude: the high-attitude ones go for it. Without DRS
 * (`drs` false: the race's rules) the cautious one waits round the outside instead.
 */
export function ownMove(code: string, attacking: boolean, drs = true): BattleMove {
  const tier = driverInfo(code)?.tier ?? 'medium';
  if (attacking)
    return tier === 'high'
      ? 'dive-inside'
      : tier === 'medium' || !drs
        ? 'round-outside'
        : 'wait-drs';
  return tier === 'high' ? 'defend-hard' : tier === 'medium' ? 'cover-inside' : 'hold-outside';
}

/** Average of `them - us` lap times over the last laps (> 0: we're quicker), or null. */
function paceGap(log: LapEvents[], us: string, them: string): number | null {
  const laps = log.slice(-3).filter((l) => l.lapTimes[us] && l.lapTimes[them] && !l.pits.length);
  if (laps.length < 2) return null;
  return (
    laps.reduce((t, l) => t + (l.lapTimes[them] as number) - (l.lapTimes[us] as number), 0) /
    laps.length
  );
}

function battleCall(
  race: RaceState,
  model: RaceModel,
  cfg: EngineerConfig,
  corners: number[],
  mem: DirectorMemory,
  log: LapEvents[],
  info: InformationView,
): QuickCall | null {
  const b = battlesFor(race, model, cfg);
  const me = race.cars[model.userSide];
  if (!me) return null;
  const next = race.lap + 1;
  // The rival first, then the closer car.
  const pick =
    b.ahead && (b.ahead.code === model.rival || !b.behind || b.ahead.gap <= b.behind.gap)
      ? 'ahead'
      : b.behind
        ? 'behind'
        : null;
  if (!pick) return null;
  const other = (b[pick] as { code: string; gap: number }).code;
  const gap = (b[pick] as { code: string; gap: number }).gap;
  const them = race.cars[other];
  // No fight with a car on its out-lap: it's in the pit lane.
  if (!them || them.strategy.some((s) => s.lap === next)) return null;
  if (!battleDue(other, race.lap, mem)) return null;
  // A long fight changes rhythm: every third lap of it is a pressure call, not a corner.
  if ((mem.fight?.streak ?? 1) % 3 === 0)
    return pressureCall(race, model, other, gap, pick === 'ahead', info);
  const us = model.userSide;
  const attacking = pick === 'ahead';
  const eng = race.engineer;
  // Outside DRS range he has to close in first (battles and trust spec D4). A race without
  // DRS (its rules) has no DRS line, no wait-for-DRS move and none in the radio.
  const hasDrs = moveAllowed(model, 'wait-drs');
  const drsRange = gap < 1;

  // The odds the race model will roll this lap (race engineer spec): the track's overtaking
  // curve on the two cars' pace and the gap, shifted by the move. (Approximate: the headset's
  // stance and ERS add their own shifts.)
  const pace = (code: string) =>
    cleanLap(model, race.cars[code] as never, next) + (code === us ? (eng?.damage ?? 0) : 0);
  const follower = attacking ? us : other;
  const leader = attacking ? other : us;
  const advantage = pace(leader) - pace(follower);
  const drs = attacking && eng?.drsLap === next ? cfg.drsLogit : 0;
  // A move tried on him lap after lap, he reads (sim readMove): its odds drop.
  const read = (move: BattleMove) => (eng ? readMove(cfg, eng, move, other, next) : 0);
  const odds = (move: BattleMove): BattleOdds => {
    const m = cfg.moves[move];
    const shift = attacking
      ? (m.attackLogit ?? 0) + drs - read(move)
      : (m.defendLogit ?? 0) + read(move);
    const p = passProbability(model.track.overtakeModel, advantage, gap, shift);
    return {
      good: attacking ? p : 1 - p,
      label: attacking ? 'pass' : 'hold',
      contact: cfg.contactBase * (m.contact ?? 1),
    };
  };
  const opt = (
    id: string,
    label: string,
    move: BattleMove,
    what: string,
    line: BattleLine,
  ): QuickOption => ({
    id,
    label,
    note: read(move) ? `${what} · he’s ${attacking ? 'covering' : 'expecting'} it now` : what,
    odds: odds(move),
    line,
    call: battle(next, move),
  });

  const quicker = paceGap(log, us, other);
  const tyre = (c: { compound: string; tyreAge: number }, own: boolean) =>
    `${c.compound[0]}${c.compound.slice(1).toLowerCase()} ${tyreAgeText(info, c.tyreAge, own)}`;
  const battery = Math.round(me.battery ?? 0);
  const stats = [
    { label: 'Gap', value: `${secs(info, gap)} s ${attacking ? 'ahead' : 'behind'}` },
    {
      label: 'DRS',
      value: drsRange ? `${attacking ? 'You' : other} ${attacking ? 'have' : 'has'} it` : 'No',
    },
    { label: 'Tyres', value: `${us} ${tyre(me, true)} · ${other} ${tyre(them, false)}` },
    {
      label: 'Pace',
      value:
        quicker === null
          ? 'Even'
          : quicker >= 0
            ? `${us} ${quicker.toFixed(1)} s/lap quicker`
            : `${other} ${(-quicker).toFixed(1)} s/lap quicker`,
    },
    ...(me.battery !== undefined ? [{ label: 'Battery', value: `${battery}%` }] : []),
  ].filter((s) => hasDrs || s.label !== 'DRS');
  const corner = corners[0] ?? 1;
  const rival = other === model.rival ? ' (the rival)' : '';

  if (attacking) {
    const options: QuickOption[] = [
      opt('dive', 'Dive up the inside', 'dive-inside', 'Late on the brakes', 'inside'),
      opt(
        'outside',
        'Round the outside',
        'round-outside',
        'Cleaner, harder to make stick',
        'outside',
      ),
      opt(
        'drs',
        'Wait for DRS, go next lap',
        'wait-drs',
        'No risk now, a better shot next lap',
        'wait',
      ),
    ].filter((o) => hasDrs || o.id !== 'drs');
    if (
      moveAllowed(model, 'overtake-button') &&
      battery >= -(cfg.moves['overtake-button'].battery ?? -25)
    ) {
      options.push(
        opt(
          'button',
          'Overtake boost',
          'overtake-button',
          'Inside line, spends 25% battery',
          'boost',
        ),
      );
    }
    return {
      lap: race.lap,
      from: us,
      kind: 'battle',
      other,
      corner,
      attacking: true,
      gap: shownGap(info, gap),
      stats,
      asked: false,
      text: battleLine(
        race.lap,
        other,
        rival,
        secs(info, gap),
        drsRange,
        true,
        eng?.lastMove ?? null,
        hasDrs,
      ),
      options,
      driverChoice: battle(next, ownMove(us, true, hasDrs), true),
    };
  }
  return {
    lap: race.lap,
    from: 'Engineer',
    kind: 'battle',
    other,
    corner,
    attacking: false,
    gap: shownGap(info, gap),
    stats,
    asked: false,
    text: battleLine(
      race.lap,
      other,
      rival,
      secs(info, gap),
      drsRange,
      false,
      eng?.lastMove ?? null,
      hasDrs,
    ),
    options: [
      opt('cover', 'Cover the inside', 'cover-inside', 'Solid, costs a little time', 'inside'),
      opt('outside', 'Hold the outside line', 'hold-outside', 'Quicker, easier to pass', 'outside'),
      opt('hard', 'Defend hard', 'defend-hard', 'Contact and track-limits risk', 'hard'),
      opt('let', 'Let him go', 'let-go', 'Save the tyres', 'let'),
    ],
    driverChoice: battle(next, ownMove(us, false), true),
  };
}

/** One of a few ways to put it, picked by the lap (the same fight never reads the same). */
const pickBy = <T>(lap: number, other: string, list: T[]): T =>
  list[(lap * 7 + other.charCodeAt(0) + other.charCodeAt(2)) % list.length] as T;

/** The battle's radio line: who and how far (`g`, the gap as said), said a few ways, and what
 * he did last time. */
function battleLine(
  lap: number,
  other: string,
  rival: string,
  g: string,
  drs: boolean,
  attacking: boolean,
  last: { move: BattleMove; other: string; lap: number } | null,
  hasDrs = true,
): string {
  const drsOpening = attacking
    ? drs
      ? pickBy(lap, other, [
          `${other}${rival} is ${g} s ahead. I can get him. How do I go?`,
          `I’m right on ${other}’s gearbox, ${g} s. Where do I put it?`,
          `${g} s to ${other}${rival}, DRS is open. Tell me where.`,
          `${other} is struggling for traction, ${g} s ahead. Your call.`,
        ])
      : pickBy(lap, other, [
          `${other}${rival} is ${g} s ahead. I have to close in first, but I can try.`,
          `${g} s to ${other}. Not in DRS yet, but I’m catching.`,
          `${other}${rival} is ${g} s up the road and slowing. Have a go?`,
        ])
    : pickBy(lap, other, [
        `${other}${rival} is ${g} s behind${drs ? ' with DRS' : ', closing'}. How do we defend?`,
        `${other} is filling my mirrors, ${g} s back. What line?`,
        `${g} s to ${other}${rival} behind${drs ? ', and he has DRS' : ''}. Defend or let him by?`,
      ]);
  const opening = hasDrs ? drsOpening : noDrsLine(lap, other, rival, g, attacking);
  if (!last || last.other !== other || lap + 1 - last.lap > 2) return opening;
  const read: Partial<Record<BattleMove, string>> = attacking
    ? {
        'dive-inside': ' He’s covering the inside since last time.',
        'round-outside': ' He’s leaving less room on the outside now.',
        'overtake-button': ' He knows the boost is coming.',
      }
    : {
        'cover-inside': ' He’s seen us cover the inside: he may go round.',
        'hold-outside': ' He’s lining up the inside now.',
        'defend-hard': ' He’s waiting for us to block again.',
      };
  return opening + (read[last.move] ?? '');
}

/** The battle's opening line in a race without DRS: the same facts, no DRS. */
function noDrsLine(lap: number, other: string, rival: string, g: string, attacking: boolean) {
  return attacking
    ? pickBy(lap, other, [
        `${other}${rival} is ${g} s ahead. I can get him. How do I go?`,
        `I’m right with ${other}, ${g} s. Where do I put it?`,
        `${other}${rival} is ${g} s up the road. Have a go?`,
      ])
    : pickBy(lap, other, [
        `${other}${rival} is ${g} s behind, closing. How do we defend?`,
        `${other} is filling my mirrors, ${g} s back. What line?`,
        `${g} s to ${other}${rival} behind. Defend or let him by?`,
      ]);
}

/**
 * Every third lap of a long fight (battle variety): no corner, a call on how to run the fight.
 * Attacking: keep the pressure on (his tyres overheat in your dirty air) or drop back and
 * cool your own. Defending: push on the exits, or save the tyres for the slow corners.
 */
function pressureCall(
  race: RaceState,
  model: RaceModel,
  other: string,
  gap: number,
  attacking: boolean,
  info: InformationView,
): QuickCall {
  const next = race.lap + 1;
  const g = secs(info, gap);
  const mode = (key: 'battle' | 'pace', value: string): Decision =>
    ({ lap: next, kind: 'mode', key, value }) as Decision;
  return attacking
    ? {
        lap: race.lap,
        from: model.userSide,
        kind: 'quick',
        other,
        asked: false,
        text: pickBy(race.lap, other, [
          `Still ${g} s behind ${other}. His tyres are going off in my dirty air, but mine are too. Keep at it?`,
          `${other} is holding me up, ${g} s. Do I keep the pressure on or back off a lap?`,
        ]),
        options: [
          {
            id: 'press',
            label: 'Keep the pressure on',
            note: 'Stay in his gearbox: his tyres overheat',
            call: mode('battle', 'attack'),
          },
          {
            id: 'cool',
            label: 'Drop back, cool the tyres',
            note: 'Back off a second, go again fresh',
            call: mode('pace', 'manage'),
          },
        ],
      }
    : {
        lap: race.lap,
        from: model.userSide,
        kind: 'quick',
        other,
        asked: false,
        text: pickBy(race.lap, other, [
          `${other} is still ${g} s behind. My rears are getting hot defending. What do you want?`,
          `${other} keeps trying, ${g} s back. Push to break the tow, or save the tyres?`,
        ]),
        options: [
          {
            id: 'push',
            label: 'Push on the exits',
            note: 'Break the tow, harder on the tyres',
            call: mode('pace', 'push'),
          },
          {
            id: 'save',
            label: 'Save them, defend the slow corners',
            note: 'Easier on the tyres, he stays close',
            call: mode('battle', 'defend'),
          },
        ],
      };
}

/** The moves in words that suit the corner (a hairpin, a fast sweeper, a chicane). */
const FLAVOUR: Record<CornerKind, Partial<Record<string, { label: string; note?: string }>>> = {
  hairpin: {
    dive: { label: 'Late-brake up the inside', note: 'Classic hairpin lunge' },
    outside: { label: 'Switchback on the exit', note: 'Let him turn in, cut back under him' },
    drs: { label: 'Get a better exit, go next lap', note: 'Slingshot onto the straight next time' },
    cover: { label: 'Cover the inside under braking', note: 'Shut the door, slower exit' },
    outsideD: { label: 'Square it off on the exit', note: 'Normal line, watch the switchback' },
    hard: { label: 'Brake late, make it wide', note: 'Contact and track-limits risk' },
  },
  sweeper: {
    dive: { label: 'Send it up the inside', note: 'Brave through the fast one' },
    outside: { label: 'Around the outside, flat', note: 'Full commitment, no room for error' },
    drs: { label: 'Stay in the tow, DRS next lap', note: 'Follow him through, set it up' },
    cover: { label: 'Hold the inside line', note: 'Cost a little speed through it' },
    outsideD: { label: 'Keep the racing line, full speed', note: 'Quickest, easier to pass' },
    hard: { label: 'Move once on the straight', note: 'Risky at this speed' },
  },
  chicane: {
    dive: { label: 'Lunge into the first apex', note: 'Brake as late as you dare' },
    outside: {
      label: 'Cut back at the second apex',
      note: 'Give him the first part, win the exit',
    },
    drs: { label: 'Clean exit, attack at the next', note: 'Better run out of the chicane' },
    cover: { label: 'Protect the first apex', note: 'Solid, costs a little time' },
    outsideD: { label: 'Defend the second apex', note: 'Watch the cutback' },
    hard: { label: 'Block the lunge on the brakes', note: 'Contact and track-limits risk' },
  },
  corner: {},
};

/** A battle call in the words of the corner it's fought into (the race screen picks it). */
export function flavourBattle(call: QuickCall, kind: CornerKind): QuickCall {
  const words = FLAVOUR[kind];
  return {
    ...call,
    options: call.options.map((o) => {
      const key = !call.attacking && o.id === 'outside' ? 'outsideD' : o.id;
      const w = words[key];
      if (!w) return o;
      const read = o.note?.includes('· he’s') ? ` · ${o.note.split(' · ').at(-1)}` : '';
      return { ...o, label: w.label, note: (w.note ?? o.note ?? '') + read };
    }),
  };
}

/** The softest tyre that lasts to the flag (or the hardest), for a box call. */
function lastingCompound(race: RaceState, model: RaceModel): string {
  // A wet race: the tyre for the track (inters, wets in a downpour) while it's wet.
  const w = model.weather ? wetnessOn(model.weather.wetness, race.lap + 1) : 0;
  if (model.weather && w >= 0.12) return w >= 0.6 && model.compounds.WET ? 'WET' : 'INTERMEDIATE';
  const left = model.race.laps - race.lap;
  const byGrip = Object.entries(model.compounds)
    .filter(([c]) => !isWetTyre(c))
    .sort((a, b) => a[1].offset - b[1].offset);
  const lasts = byGrip.find(([, c]) => tyreLife(c) >= left);
  const pick = (lasts ?? byGrip.at(-1))?.[0] ?? race.cars[model.userSide]?.compound ?? 'HARD';
  // No tyre changes (2005): the stop keeps the dry set.
  return pitCompoundFor(model, pick);
}

function troubleCall(
  race: RaceState,
  model: RaceModel,
  cfg: EngineerConfig,
  notes: RaceNote[],
  mem: DirectorMemory,
  stopping: boolean,
  canStop: boolean,
): QuickCall | null {
  const eng = race.engineer;
  const me = race.cars[model.userSide];
  if (!eng || !me) return null;
  const next = race.lap + 1;
  const left = model.race.laps - race.lap;
  const lapNotes = notes.filter((n) => n.lap === race.lap && n.driver === model.userSide);

  // The two-compound rule: no second dry compound yet and no stop booked, late on.
  if (
    !ruleSatisfied(me, model.rules) &&
    canStop &&
    left <= 8 &&
    left > 1 &&
    race.lap - (mem.last.rule ?? -99) >= 2
  ) {
    mem.last.rule = race.lap;
    const fresh =
      ['MEDIUM', 'HARD', 'SOFT'].find((c) => model.compounds[c] && !me.compoundsUsed.includes(c)) ??
      lastingCompound(race, model);
    return {
      lap: race.lap,
      from: 'Engineer',
      kind: 'trouble',
      asked: false,
      text: `We haven’t run a second tyre compound. We have to stop before the flag or we’re disqualified. Box for ${tyreName(fresh).toLowerCase()}?`,
      options: [
        {
          id: 'box',
          label: `Box, ${tyreName(fresh).toLowerCase()}`,
          note: 'Legal to the flag',
          call: { lap: next, kind: 'pit', compound: fresh },
        },
        { id: 'later', label: 'Not yet', note: `${left} laps left to do it`, call: null },
      ],
    };
  }

  // A broken front wing: asked when it breaks (whatever the tyres), then now and then.
  const wing = lapNotes.find((n) => n.kind === 'contact' && n.detail === 'wing');
  if (
    !stopping &&
    eng.damage > 0 &&
    (wing || (canStop && race.lap - (mem.last.wing ?? -99) >= 5 && eng.damage > 0.4)) &&
    left > 2
  ) {
    mem.last.wing = race.lap;
    const compound = lastingCompound(race, model);
    return {
      lap: race.lap,
      from: 'Engineer',
      kind: 'trouble',
      asked: false,
      text: `Front wing damage. We’re losing about ${eng.damage.toFixed(1)} s a lap. Box for a new nose and ${tyreName(compound).toLowerCase()}?`,
      options: [
        {
          id: 'box',
          label: 'Box for a new nose',
          note: `A slower stop (+${cfg.noseCost.toFixed(0)} s), the pace back`,
          call: { lap: next, kind: 'pit', compound },
        },
        {
          id: 'stay',
          label: 'Carry on',
          note: `${eng.damage.toFixed(1)} s a lap to the flag`,
          call: null,
        },
      ],
    };
  }

  // Track limits.
  if (
    eng.strikes >= 2 &&
    !eng.careful &&
    lapNotes.some((n) => n.kind === 'strike' || n.kind === 'penalty')
  ) {
    const toPenalty = cfg.penaltyAt - eng.strikes;
    return {
      lap: race.lap,
      from: 'Engineer',
      kind: 'trouble',
      asked: false,
      text:
        toPenalty > 0
          ? `That’s strike ${eng.strikes} for track limits. ${toPenalty === 1 ? 'One more' : `${toPenalty} more`} and it’s a ${cfg.penalty}-second penalty. Back off at the exits?`
          : `Another track-limits strike. Every ${cfg.penaltyEvery} more is another ${cfg.penalty} seconds. Back off at the exits?`,
      options: [
        {
          id: 'careful',
          label: 'Back off at the exits',
          note: `About ${cfg.carefulCost.toFixed(1)} s a lap, far fewer strikes`,
          call: { lap: next, kind: 'limits', careful: true },
        },
        {
          id: 'keep',
          label: 'Keep using the kerbs',
          note: 'Faster, risks the penalty',
          call: null,
        },
      ],
    };
  }

  // A lapped car in the way.
  const blue = lappedAhead(race, model, cfg, lapTime(model, 'green'));
  if (blue && race.lap - (mem.last.blue ?? -99) >= 3) {
    mem.last.blue = race.lap;
    return {
      lap: race.lap,
      from: model.userSide,
      kind: 'trouble',
      other: blue.code,
      asked: false,
      text: `${blue.code} is a lap down and right in front of me. Blue flags!`,
      options: [
        {
          id: 'wait',
          label: 'Wait, we’ll tell race control',
          note: 'He’ll move over; no risk',
          call: { lap: next, kind: 'blue', action: 'complain' },
        },
        {
          id: 'round',
          label: 'Go round him now',
          note: `Gains ${cfg.blue.goRoundGain.toFixed(1)} s, a small risk of contact`,
          call: { lap: next, kind: 'blue', action: 'go-round' },
        },
      ],
    };
  }
  return null;
}

function requestCall(
  race: RaceState,
  model: RaceModel,
  log: LapEvents[],
  mem: DirectorMemory,
  canStop: boolean,
): QuickCall | null {
  const me = race.cars[model.userSide];
  const them = race.cars[model.rival];
  if (!me) return null;
  const next = race.lap + 1;
  const left = model.race.laps - race.lap;
  const us = model.userSide;
  // The tyres really are gone: well worn, and losing over a second a lap to new ones.
  const gone = me.tyreAge >= 6 && tyreLoss(model, me.compound, me.tyreWear) >= 1.2;
  if (canStop && gone && left > 4 && race.lap - (mem.last.reqBox ?? -99) >= 6) {
    mem.last.reqBox = race.lap;
    const compound = lastingCompound(race, model);
    return {
      lap: race.lap,
      from: us,
      kind: 'request',
      asked: true,
      text: `These ${tyreName(me.compound).toLowerCase()} are gone, ${me.tyreAge} laps old. I want to box!`,
      options: [
        {
          id: 'yes',
          label: `Yes, box for ${tyreName(compound).toLowerCase()}`,
          call: { lap: next, kind: 'reply', request: 'box', yes: true },
          also: [{ lap: next, kind: 'pit', compound }],
        },
        {
          id: 'no',
          label: 'No, stay out',
          note: 'He’ll remember if he was right',
          call: { lap: next, kind: 'reply', request: 'box', yes: false },
        },
      ],
    };
  }
  const recent = log.slice(-3);
  const losing =
    them &&
    !them.retired &&
    recent.length >= 2 &&
    recent.every((l) => (l.lapTimes[model.rival] ?? 99) < (l.lapTimes[us] ?? 0));
  if (losing && me.modes.pace !== 'push' && race.lap - (mem.last.reqPush ?? -99) >= 6) {
    mem.last.reqPush = race.lap;
    return {
      lap: race.lap,
      from: us,
      kind: 'request',
      asked: true,
      text: `${model.rival} is quicker every lap. Let me push!`,
      options: [
        {
          id: 'yes',
          label: 'Yes, push',
          call: { lap: next, kind: 'reply', request: 'push', yes: true },
          also: [{ lap: next, kind: 'mode', key: 'pace', value: 'push' }],
        },
        {
          id: 'no',
          label: 'No, save the tyres',
          note: 'He’ll remember if he was right',
          call: { lap: next, kind: 'reply', request: 'push', yes: false },
        },
      ],
    };
  }
  return null;
}

function batteryCall(
  race: RaceState,
  model: RaceModel,
  cfg: EngineerConfig,
  mem: DirectorMemory,
): QuickCall | null {
  const me = race.cars[model.userSide];
  if (!me || !raceScreenEra(model).battery || me.battery === undefined || me.battery > 20)
    return null;
  if (me.modes.ers === 'harvest' || race.lap - (mem.last.battery ?? -99) < 5) return null;
  const b = battlesFor(race, model, { ...cfg, battleWindow: 2 });
  const near = b.behind ?? b.ahead;
  if (!near) return null;
  mem.last.battery = race.lap;
  const next = race.lap + 1;
  return {
    lap: race.lap,
    from: 'Engineer',
    kind: 'quick',
    asked: false,
    text: `Battery’s at ${Math.round(me.battery)}% and ${near.code} is close. Harvest now, or keep deploying?`,
    options: [
      {
        id: 'harvest',
        label: 'Harvest this lap',
        note: 'Slower now, battery for the fight',
        call: { lap: next, kind: 'mode', key: 'ers', value: 'harvest' },
      },
      {
        id: 'keep',
        label: 'Keep it balanced',
        call:
          me.modes.ers === 'balanced'
            ? null
            : { lap: next, kind: 'mode', key: 'ers', value: 'balanced' },
      },
    ],
  };
}

/**
 * The fuel call (fuel load spec): short to the flag on the normal fuel mode, the engineer asks
 * to lift and coast; saving with the target met, whether to go back to normal. Asked again
 * after a few laps if the answer was no.
 */
function fuelCall(race: RaceState, model: RaceModel, mem: DirectorMemory): QuickCall | null {
  const me = race.cars[model.userSide];
  const f = fuelReading(race, model);
  if (!me || !f || f.empty || race.lap - (mem.last.fuel ?? -99) < 6) return null;
  const left = model.race.laps - race.lap;
  if (left < 3) return null;
  const next = race.lap + 1;
  const saving = me.modes.fuel === 'liftAndCoast';
  if (!saving && f.margin < FUEL_SHORT) {
    mem.last.fuel = race.lap;
    return {
      lap: race.lap,
      from: 'Engineer',
      kind: 'quick',
      asked: false,
      text: `Fuel: we’re ${marginText(f.margin)} to the flag, ${liftText(f.liftLaps)} to make it up. Lift and coast?`,
      stats: [
        { label: 'Fuel', value: `${f.kg.toFixed(1)} kg` },
        { label: 'Laps left', value: String(left) },
      ],
      options: [
        {
          id: 'lift',
          label: 'Lift and coast',
          note: 'A bit slower, saves fuel and tyres',
          call: { lap: next, kind: 'mode', key: 'fuel', value: 'liftAndCoast' },
        },
        {
          id: 'later',
          label: 'Not yet',
          note: 'Save it later; run dry and it costs seconds a lap',
          call: null,
        },
      ],
    };
  }
  if (saving && f.margin > FUEL_BACK) {
    mem.last.fuel = race.lap;
    return {
      lap: race.lap,
      from: 'Engineer',
      kind: 'quick',
      asked: false,
      text: `Fuel’s back on target, ${marginText(f.margin)}. Back to normal?`,
      options: [
        {
          id: 'normal',
          label: 'Back to normal',
          note: 'Full pace again',
          call: { lap: next, kind: 'mode', key: 'fuel', value: 'normal' },
        },
        { id: 'keep', label: 'Keep saving', note: 'More in hand for the end', call: null },
      ],
    };
  }
  return null;
}

/** The engineer's info line on a quiet lap (no answer needed), or null. At Minimal, with the
 * rival not directly ahead or behind, it's the cars around us (as with the rival out). */
export function infoLine(
  race: RaceState,
  model: RaceModel,
  log: LapEvents[],
  info: InformationView = FULL_INFORMATION,
): string | null {
  const me = race.cars[model.userSide];
  const them = race.cars[model.rival];
  if (!me || me.retired) return null;
  // Under a safety car or VSC: the delta, the tyres, the restart.
  const next = race.nextFlag ?? 'green';
  if (next === 'vsc') return 'VSC. Stay positive to the delta, keep the tyres in the window.';
  if (next === 'sc') {
    return race.flag === 'sc'
      ? 'Still behind the safety car. Weave, keep the tyres and brakes warm.'
      : 'Safety car. Stay above the delta time, close up to the car ahead.';
  }
  if (race.flag === 'sc')
    return 'Safety car in this lap. Get ready for the restart, it’s your call when to go.';
  const timed = gapShown(info, race.order, model.userSide, model.rival);
  if (!them || them.retired || !timed) {
    // The rival is out (or can't be timed): the cars around us.
    const order = race.order.filter((c) => !race.cars[c]?.retired);
    const i = order.indexOf(model.userSide);
    const ahead = order[i - 1];
    const behind = order[i + 1];
    const t = (c: string) => race.cars[c]?.totalTime ?? 0;
    const parts = [`P${i + 1}`];
    if (ahead) parts.push(`${ahead} ${secs(info, me.totalTime - t(ahead))} s ahead`);
    if (behind) parts.push(`${behind} ${secs(info, t(behind) - me.totalTime)} s behind`);
    return `${parts.join(', ')}. ${model.race.laps - race.lap} to go.`;
  }
  const gap = them.totalTime - me.totalTime;
  const last = log.at(-1);
  const ours = last?.lapTimes[model.userSide];
  const theirs = last?.lapTimes[model.rival];
  const left = model.race.laps - race.lap;
  // (A lap with a stop in it isn't a pace comparison.)
  const stopped = last?.pits.some((p) => p.code === model.userSide || p.code === model.rival);
  if (ours && theirs && !stopped && Math.abs(ours - theirs) > 0.25) {
    const quicker = theirs < ours;
    return `${model.rival} ${quicker ? 'was' : 'lost'} ${Math.abs(ours - theirs).toFixed(1)} ${quicker ? 's quicker' : 's to us'} that lap. Gap ${gapText(info, gap, false)}.`;
  }
  return `Gap to ${model.rival} ${gapText(info, gap, false)} s, ${left} to go. ${gap >= 0 ? 'Keep it up.' : 'Keep chipping away.'}`;
}

/**
 * The call for the lap just completed, or null (then maybe an info line). `quickLap`: one of
 * the engineer's quick-call laps.
 */
export function directorCall(
  race: RaceState,
  model: RaceModel,
  cfg: EngineerConfig | null,
  log: LapEvents[],
  notes: RaceNote[],
  corners: number[],
  mem: DirectorMemory,
  quickLap: boolean,
  /** A BOX is called and not yet in the race model. */
  pendingPit = false,
  /** What the Eras information level lets the radio say (everything, otherwise). */
  info: InformationView = FULL_INFORMATION,
): QuickCall | null {
  const me = race.cars[model.userSide];
  if (!me || me.retired) return null;
  // One gate for every stop question (pit fix 2): none while a stop is called or under way,
  // none on fresh tyres, and not again within a few laps of the last one.
  const stopping = pendingPit || me.strategy.some((s) => s.lap > race.lap);
  const canStop =
    !stopping && me.tyreAge >= FRESH_TYRES && race.lap - (mem.last.stop ?? -99) >= STOP_ASK_EVERY;
  const asked = (call: QuickCall | null): QuickCall | null => {
    if (call && offersStop(call)) mem.last.stop = race.lap;
    return call;
  };
  if (!stopping) {
    const sc = safetyCarCall(race, model, false);
    if (sc) return asked(sc);
  }
  // No calls into a big moment's lap (the moment asks).
  const into = race.lap + 1;
  if (into <= model.race.laps && !model.decisionMoments.some((m) => m.lap === into)) {
    // A weather call asks about a stop too: not within a few laps of the last stop question.
    const recent = race.lap - (mem.last.stop ?? -99) < STOP_ASK_EVERY;
    const wx = weatherCall(race, model, mem, stopping || recent);
    if (wx) return asked(wx);
  }
  const next = race.lap + 1;
  if (next > model.race.laps) return null;
  // No calls into a neutralized lap (no racing), or on a big moment's lap.
  if (race.nextFlag !== 'green' || model.decisionMoments.some((m) => m.lap === next)) return null;
  if (cfg && race.engineer) {
    // No battle with a stop booked (your car is about to box), or on its in-lap or out-lap.
    const pitLap = pendingPit || me.strategy.some((s) => s.lap === next || s.lap === next + 1);
    const fight = pitLap ? null : battleCall(race, model, cfg, corners, mem, log, info);
    if (fight) return fight;
    const trouble = troubleCall(race, model, cfg, notes, mem, stopping, canStop);
    if (trouble) return asked(trouble);
    const ask = requestCall(race, model, log, mem, canStop);
    if (ask) return asked(ask);
    const fuel = fuelCall(race, model, mem);
    if (fuel) return fuel;
    const battery = batteryCall(race, model, cfg, mem);
    if (battery) return battery;
  }
  return quickLap ? quickCallAt(race, model, log, info) : null;
}

/** The tyres' names as the radio says them. */
const SAID: Record<string, string> = {
  SOFT: 'softs',
  MEDIUM: 'mediums',
  HARD: 'hards',
  INTERMEDIATE: 'inters',
  WET: 'full wets',
};
const said = (c: string) => SAID[c] ?? `${tyreName(c).toLowerCase()}`;

/** How many laps between asking about the weather again. */
const WEATHER_ASK_EVERY = 3;

/**
 * Weather spec W5: the calls the weather brings. On slicks as the track turns wet, the driver
 * asks for inters (wets in a downpour); on wet tyres as it dries, the engineer offers slicks.
 * Not gated on fresh tyres: rain doesn't wait.
 */
function weatherCall(
  race: RaceState,
  model: RaceModel,
  mem: DirectorMemory,
  stopping: boolean,
): QuickCall | null {
  const weather = model.weather;
  const me = race.cars[model.userSide];
  if (!weather || !me || stopping) return null;
  if (race.lap - (mem.last.weather ?? -99) < WEATHER_ASK_EVERY) return null;
  const next = race.lap + 1;
  if (next >= model.race.laps) return null;
  const w = wetnessOn(weather.wetness, next);
  const onWets = isWetTyre(me.compound);
  const us = model.userSide;
  if (!onWets && w >= 0.1) {
    mem.last.weather = race.lap;
    const want = lastingCompound(race, model);
    const slick = Math.round(wetPenalty(weather, me.compound, w) * 100);
    return {
      lap: race.lap,
      from: us,
      kind: 'request',
      asked: true,
      weather: true,
      text: `It's wet out here, I'm sliding everywhere on these ${said(me.compound)}. I need ${said(want)}!`,
      stats: [
        { label: 'Slicks', value: `${slick}% off the pace` },
        { label: 'Track', value: w >= 0.45 ? 'Soaked' : 'Wet' },
      ],
      options: [
        {
          id: 'yes',
          label: `Yes, box for ${said(want)}`,
          call: { lap: next, kind: 'reply', request: 'box', yes: true },
          also: [{ lap: next, kind: 'pit', compound: want }],
        },
        {
          id: 'no',
          label: 'No, stay out',
          note: 'He’ll remember if he was right',
          call: { lap: next, kind: 'reply', request: 'box', yes: false },
        },
      ],
    };
  }
  if (onWets && w < 0.08 && model.race.laps - race.lap > 3) {
    mem.last.weather = race.lap;
    const slicks = lastingCompound(race, { ...model, weather: undefined });
    return {
      lap: race.lap,
      from: 'Engineer',
      kind: 'quick',
      weather: true,
      text: `The track's drying fast, there's a dry line now. ${said(me.compound)} are overheating. Slicks?`,
      options: [
        {
          id: 'slicks',
          label: `Box for ${said(slicks)}`,
          call: { lap: next, kind: 'pit', compound: slicks },
        },
        { id: 'stay', label: `Stay on ${said(me.compound)}`, call: null },
      ],
    };
  }
  return null;
}

/** The driver's mood as the game shows it. */
export const MOOD_LABEL = {
  calm: { text: 'Calm', color: 'var(--good)' },
  tense: { text: 'Tense', color: 'var(--flag)' },
  frustrated: { text: 'Frustrated', color: 'var(--rival)' },
  furious: { text: 'Furious', color: 'var(--box)' },
} as const;

export function moodNow(race: RaceState, cfg: EngineerConfig | null) {
  return race.engineer && cfg ? moodOf(cfg, race.engineer.trust) : null;
}

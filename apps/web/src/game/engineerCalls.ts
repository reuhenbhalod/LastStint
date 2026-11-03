// The race engineer's radio (race engineer spec D2-D5): what the wall is asked, lap by lap,
// between the big graded moments. Most pressing first:
//   1. a safety car the race model doesn't have (a crash): box or stay;
//   2. a battle with the car directly ahead or behind (within a second): the move for the lap,
//      named by the corner it's fought into; 5 seconds, in slow motion; no answer and the
//      driver picks his own;
//   3. trouble: a broken front wing (box for a nose?), track-limit strikes, a lapped car;
//   4. the driver asking: "the tyres are gone, can I box?", "let me push";
//   5. the battery running low with a car close;
//   6. the engineer's own questions on the quick-call laps (quickCalls.ts).
// Every answer is a call the race model plays, logged for the server's replay.

import {
  type BattleMove,
  type Decision,
  type EngineerConfig,
  type RaceModel,
  type RaceNote,
  type RaceState,
  battlesFor,
  lappedAhead,
  moodOf,
  ruleSatisfied,
} from '@boxthislap/sim';
import { driverInfo } from '../data/drivers.js';
import { lapTime } from '../track/geometry.js';
import { type QuickCall, type QuickOption, quickCallAt, safetyCarCall } from './quickCalls.js';
import type { LapEvents } from './raceLog.js';

/** Seconds to answer: a battle is now or never; the rest can wait a little longer. */
export const BATTLE_MS = 5000;
export const CALL_MS = 8000;

/** What the director remembers between laps (so it doesn't ask the same thing every lap). */
export interface DirectorMemory {
  /** Lap each kind of call was last asked. */
  last: Partial<Record<string, number>>;
  /** The running battle: the other car and how many laps in a row it's been asked about. */
  fight?: { other: string; streak: number };
}

export const newMemory = (): DirectorMemory => ({ last: {} });

/**
 * A long battle with the same car is asked about on its first two laps, then every other lap
 * (on the laps between, the driver races him normally).
 */
function battleDue(other: string, lap: number, mem: DirectorMemory): boolean {
  const f = mem.fight;
  const running = f && f.other === other && lap - (mem.last.battle ?? -99) <= 2;
  if (running && (f as { streak: number }).streak >= 2 && lap - (mem.last.battle ?? -99) < 2) {
    return false;
  }
  mem.fight = { other, streak: running ? (f as { streak: number }).streak + 1 : 1 };
  mem.last.battle = lap;
  return true;
}

const battle = (lap: number, move: BattleMove, driver?: boolean): Decision =>
  driver ? { lap, kind: 'battle', move, driver: true } : { lap, kind: 'battle', move };

/** The move a driver makes himself, by attitude: the high-attitude ones go for it. */
export function ownMove(code: string, attacking: boolean): BattleMove {
  const tier = driverInfo(code)?.tier ?? 'medium';
  if (attacking)
    return tier === 'high' ? 'dive-inside' : tier === 'medium' ? 'round-outside' : 'wait-drs';
  return tier === 'high' ? 'defend-hard' : tier === 'medium' ? 'cover-inside' : 'hold-outside';
}

function battleCall(
  race: RaceState,
  model: RaceModel,
  cfg: EngineerConfig,
  corners: number[],
  mem: DirectorMemory,
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
  if (!battleDue(other, race.lap, mem)) return null;
  const t1 = corners[0] ?? 1;
  const t2 = corners[1] ?? t1;
  const us = model.userSide;
  if (pick === 'ahead') {
    const battery = Math.round(me.battery ?? 0);
    const options: QuickOption[] = [
      {
        id: 'dive',
        label: `Dive up the inside into Turn ${t1}`,
        note: 'Best chance, real risk of contact',
        call: battle(next, 'dive-inside'),
      },
      {
        id: 'outside',
        label: `Round the outside at Turn ${t2}`,
        note: 'Cleaner, harder to make stick',
        call: battle(next, 'round-outside'),
      },
      {
        id: 'drs',
        label: 'Sit in DRS, go next lap',
        note: 'No attack now, a better one next lap',
        call: battle(next, 'wait-drs'),
      },
    ];
    if (battery >= -(cfg.moves['overtake-button'].battery ?? -25)) {
      options.push({
        id: 'button',
        label: `Overtake button (${battery}%)`,
        note: 'Spends battery for a clean run',
        call: battle(next, 'overtake-button'),
      });
    }
    return {
      lap: race.lap,
      from: us,
      kind: 'battle',
      other,
      corner: t1,
      asked: false,
      text: `I’m ${gap.toFixed(1)} s behind ${other}. ${other === model.rival ? 'This is the one. ' : ''}How do I get by?`,
      options,
      driverChoice: battle(next, ownMove(us, true), true),
    };
  }
  return {
    lap: race.lap,
    from: 'Engineer',
    kind: 'battle',
    other,
    corner: t1,
    asked: false,
    text: `${other} is ${gap.toFixed(1)} s behind${gap < 1 ? ' with DRS' : ''}${other === model.rival ? '. It’s the rival.' : '.'} How do we defend?`,
    options: [
      {
        id: 'cover',
        label: `Cover the inside into Turn ${t1}`,
        note: 'Solid, costs a little time',
        call: battle(next, 'cover-inside'),
      },
      {
        id: 'outside',
        label: 'Hold the outside line',
        note: 'Quick, easier to pass',
        call: battle(next, 'hold-outside'),
      },
      {
        id: 'hard',
        label: 'Defend hard',
        note: 'Very hard to pass; contact and track limits',
        call: battle(next, 'defend-hard'),
      },
      {
        id: 'let',
        label: 'Let him go, save the tyres',
        note: 'He’ll be through',
        call: battle(next, 'let-go'),
      },
    ],
    driverChoice: battle(next, ownMove(us, false), true),
  };
}

/** The softest tyre that lasts to the flag (or the hardest), for a box call. */
function lastingCompound(race: RaceState, model: RaceModel): string {
  const left = model.race.laps - race.lap;
  const byGrip = Object.entries(model.compounds).sort((a, b) => a[1].offset - b[1].offset);
  const lasts = byGrip.find(([, c]) => c.cliffLap >= left);
  return (lasts ?? byGrip.at(-1))?.[0] ?? race.cars[model.userSide]?.compound ?? 'HARD';
}

function troubleCall(
  race: RaceState,
  model: RaceModel,
  cfg: EngineerConfig,
  notes: RaceNote[],
  mem: DirectorMemory,
): QuickCall | null {
  const eng = race.engineer;
  const me = race.cars[model.userSide];
  if (!eng || !me) return null;
  const next = race.lap + 1;
  const left = model.race.laps - race.lap;
  const lapNotes = notes.filter((n) => n.lap === race.lap && n.driver === model.userSide);

  // The two-compound rule: no second dry compound yet and no stop booked, late on.
  const booked = me.strategy.some((s) => s.lap > race.lap);
  if (
    !ruleSatisfied(me) &&
    !booked &&
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
      text: `We haven’t run a second tyre compound. We have to stop before the flag or we’re disqualified. Box for ${fresh.toLowerCase()}s?`,
      options: [
        {
          id: 'box',
          label: `Box, ${fresh.toLowerCase()}s`,
          note: 'Legal to the flag',
          call: { lap: next, kind: 'pit', compound: fresh },
        },
        { id: 'later', label: 'Not yet', note: `${left} laps left to do it`, call: null },
      ],
    };
  }

  // A broken front wing.
  const wing = lapNotes.find((n) => n.kind === 'contact' && n.detail === 'wing');
  if (
    eng.damage > 0 &&
    (wing || (race.lap - (mem.last.wing ?? -99) >= 5 && eng.damage > 0.4)) &&
    left > 2
  ) {
    mem.last.wing = race.lap;
    const compound = lastingCompound(race, model);
    return {
      lap: race.lap,
      from: 'Engineer',
      kind: 'trouble',
      asked: false,
      text: `Front wing damage. We’re losing about ${eng.damage.toFixed(1)} s a lap. Box for a new nose and ${compound.toLowerCase()}s?`,
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
): QuickCall | null {
  const me = race.cars[model.userSide];
  const them = race.cars[model.rival];
  if (!me) return null;
  const next = race.lap + 1;
  const left = model.race.laps - race.lap;
  const cliff = model.compounds[me.compound]?.cliffLap ?? 99;
  const boxing = me.strategy.some((s) => s.lap > race.lap);
  const us = model.userSide;
  if (!boxing && me.tyreWear > cliff - 2 && left > 4 && race.lap - (mem.last.reqBox ?? -99) >= 6) {
    mem.last.reqBox = race.lap;
    const compound = lastingCompound(race, model);
    return {
      lap: race.lap,
      from: us,
      kind: 'request',
      asked: true,
      text: `These ${me.compound.toLowerCase()}s are gone, ${me.tyreAge} laps old. I want to box!`,
      options: [
        {
          id: 'yes',
          label: `Yes, box for ${compound.toLowerCase()}s`,
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
  if (!me || me.battery === undefined || me.battery > 20) return null;
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

/** The engineer's info line on a quiet lap (no answer needed), or null. */
export function infoLine(race: RaceState, model: RaceModel, log: LapEvents[]): string | null {
  const me = race.cars[model.userSide];
  const them = race.cars[model.rival];
  if (!me || me.retired) return null;
  if (!them || them.retired) {
    // The rival is out: the cars around us.
    const order = race.order.filter((c) => !race.cars[c]?.retired);
    const i = order.indexOf(model.userSide);
    const ahead = order[i - 1];
    const behind = order[i + 1];
    const t = (c: string) => race.cars[c]?.totalTime ?? 0;
    const parts = [`P${i + 1}`];
    if (ahead) parts.push(`${ahead} ${(me.totalTime - t(ahead)).toFixed(1)} s ahead`);
    if (behind) parts.push(`${behind} ${(t(behind) - me.totalTime).toFixed(1)} s behind`);
    return `${parts.join(', ')}. ${model.race.laps - race.lap} to go.`;
  }
  const gap = them.totalTime - me.totalTime;
  const last = log.at(-1);
  const ours = last?.lapTimes[model.userSide];
  const theirs = last?.lapTimes[model.rival];
  const left = model.race.laps - race.lap;
  if (ours && theirs && Math.abs(ours - theirs) > 0.25) {
    const quicker = theirs < ours;
    return `${model.rival} ${quicker ? 'was' : 'lost'} ${Math.abs(ours - theirs).toFixed(1)} ${quicker ? 's quicker' : 's to us'} that lap. Gap ${gap >= 0 ? '+' : '−'}${Math.abs(gap).toFixed(1)}.`;
  }
  return `Gap to ${model.rival} ${gap >= 0 ? '+' : '−'}${Math.abs(gap).toFixed(1)} s, ${left} to go. ${gap >= 0 ? 'Keep it up.' : 'Keep chipping away.'}`;
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
): QuickCall | null {
  const sc = safetyCarCall(race, model);
  if (sc) return sc;
  const me = race.cars[model.userSide];
  const next = race.lap + 1;
  if (!me || me.retired || next > model.race.laps) return null;
  // No calls into a neutralized lap (no racing), or on a big moment's lap.
  if (race.nextFlag !== 'green' || model.decisionMoments.some((m) => m.lap === next)) return null;
  if (cfg && race.engineer) {
    const fight = battleCall(race, model, cfg, corners, mem);
    if (fight) return fight;
    const trouble = troubleCall(race, model, cfg, notes, mem);
    if (trouble) return trouble;
    const ask = requestCall(race, model, log, mem);
    if (ask) return ask;
    const battery = batteryCall(race, model, cfg, mem);
    if (battery) return battery;
  }
  return quickLap ? quickCallAt(race, model, log) : null;
}

/** The driver's mood as the game shows it. */
export const MOOD_LABEL = {
  calm: { text: 'Calm', icon: '😌' },
  tense: { text: 'Tense', icon: '😐' },
  frustrated: { text: 'Frustrated', icon: '😤' },
  furious: { text: 'Furious', icon: '🤬' },
} as const;

export function moodNow(race: RaceState, cfg: EngineerConfig | null) {
  return race.engineer && cfg ? moodOf(cfg, race.engineer.trust) : null;
}

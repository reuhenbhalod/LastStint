// The race view: the standings on the left; in the middle the scoreboard and the circuit,
// with your calls under it (the big decision as a wide strip, or a quick call) and the team
// radio below (every order the wall can give: box, headset, team orders); on the right the
// stats (your driver, the car, your calls, the radio log). Speed, sound and restart sit in the
// header. On a phone it stacks, and the decision card rises as a bottom sheet. When the race stops for a call, a radio banner drops over the map
// (and chirps, if sound is on). Tap any car, on the map or in the standings, for its card; a
// stop by your car or the rival is called out while it drives the pit lane.
// An Eras race (`eras`, build plan 8.6) adds its difficulty: a timer on every big call (the
// default option when it runs out, unless the player turned the timer off: then the attempt is
// marked untimed), the same timer on quick calls and battles (the race holds while one waits;
// out of time, the same outcome as no answer), and the information level, passed to every
// place a gap or a tyre age shows and to the engineer's radio. Without it, nothing here
// changes.

import {
  type Decision,
  type Modes,
  type RaceModel,
  type RaceNote,
  engineerConfig,
  wetnessOn,
} from '@laststint/sim';
import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BattleCard, type BattleStage } from '../components/BattleCard.js';
import { Brand } from '../components/Brand.js';
import { BroadcastDecision } from '../components/BroadcastDecision.js';
import { CarStats } from '../components/CarStats.js';
import { DriverCard } from '../components/DriverCard.js';
import { DriverProfile } from '../components/DriverProfile.js';
import { GroundBackdrop } from '../components/GroundBackdrop.js';
import { ChequeredIcon, OvertakeIcon, SoundOffIcon, SoundOnIcon } from '../components/Icons.js';
import { LeadersTower } from '../components/LeadersTower.js';
import { LiveGrades } from '../components/LiveGrades.js';
import { MapCredit } from '../components/MapCredit.js';
import { RadioMark, TimingMark } from '../components/Marks.js';
import { Panel } from '../components/Panel.js';
import { PitCard } from '../components/PitCard.js';
import {
  PlanBar,
  PlanHeadsUp,
  ReplanOffer,
  betterPlan,
  headsUpStop,
} from '../components/PlanBar.js';
import { PlanCard } from '../components/PlanCard.js';
import { QuickCallCard } from '../components/QuickCallCard.js';
import { RadioLog } from '../components/RadioLog.js';
import { TeamRadio } from '../components/TeamRadio.js';
import { TimingTower } from '../components/TimingTower.js';
import { type BattleView, TrackMap } from '../components/TrackMap.js';
import { TyreBadge } from '../components/TyreBadge.js';
import { namedUpper, surname } from '../data/names.js';
import { RaceEraContext, type RaceEraLook } from '../eras/RaceEraContext.js';
import { DecisionTimer } from '../eras/difficulty/DecisionTimer.js';
import { NeighbourGaps } from '../eras/difficulty/NeighbourGaps.js';
import { erasCallTimer, holdsForQuickCall } from '../eras/difficulty/callTimer.js';
import type { ErasRace } from '../eras/difficulty/erasRace.js';
import { gapShown, gapText, informationView } from '../eras/difficulty/information.js';
import { setTimerOn, timerOn } from '../eras/difficulty/settings.js';
import { takeDefault } from '../eras/difficulty/timeout.js';
import { attemptUntimed, noteDecisionShown } from '../eras/difficulty/untimed.js';
import { raceScreenEra } from '../eras/raceRules.js';
import { type FuelFill, refuelReading } from '../eras/refuel.js';
import {
  CALL_MS,
  directorCall,
  flavourBattle,
  infoLine,
  newMemory,
  offersStop,
  readMs,
} from '../game/engineerCalls.js';
import { modeLine } from '../game/guide.js';
import { neutralCause } from '../game/neutral.js';
import { delayStop } from '../game/plans.js';
import { type QuickCall, quickCallLaps } from '../game/quickCalls.js';
import { useRaceLog } from '../game/raceLog.js';
import { radioChirp, setSoundOn, soundOn } from '../game/sound.js';
import { type Game, LAP_MS, SLOW_MOTION, clockProgress } from '../game/useGame.js';
import { CONDITION_WORD, conditionsOf, forecast } from '../game/weather.js';
import type { GameState } from '../state/machine.js';
import { RaceStage } from '../three/RaceStage.js';
import { BRAKE_BEFORE, cornerKind } from '../track/battle.js';
import { cornerPoint, overtakingCorners } from '../track/corners.js';
import type { MapFeed } from '../track/feed.js';
import { flagOn, nearestFraction, polyline } from '../track/geometry.js';
import type { LiveStanding, MapMotion } from '../track/motion.js';
import { outlineFor } from '../track/outlines.js';

/** The weather chip's colour by conditions. */
const WEATHER_BG = {
  dry: 'rgba(0,0,0,0.55)',
  damp: 'rgba(38,94,122,0.85)',
  wet: 'rgba(30,72,150,0.9)',
  soaked: 'rgba(24,46,120,0.95)',
} as const;

const FLAG = {
  green: { text: 'Green', cls: 'bg-black/55 text-white' },
  sc: { text: 'Safety car', cls: 'bg-[var(--flag)] text-[#151A1D] animate-pulse' },
  vsc: { text: 'Virtual safety car', cls: 'bg-[var(--flag)] text-[#151A1D] animate-pulse' },
  red: { text: 'Red flag', cls: 'bg-red-600 text-white animate-pulse' },
} as const;

/** A battle on screen (battles and trust spec): its call, its corner (number, and where it is
 * as a fraction of the lap), when your car gets to the braking zone and the corner (tick
 * progress), your call, its result read ahead, and whether the camera is on it. */
interface Battle {
  call: QuickCall;
  lap: number;
  corner: number;
  at: number;
  fromP: number;
  brakeP: number;
  cornerP: number;
  stage: BattleStage;
  chosen: string | null;
  result: { text: string; good: boolean } | null;
  swap: { at: number } | null;
  zoom: boolean;
  /** The card is up (it comes up SHOW_BEFORE ahead of the braking zone). */
  shown: boolean;
}

/** Where the follow camera choice is kept. */
const FOLLOW_KEY = 'pitwall.follow-camera';

/** How often the standings follow the map while the lap runs. */
const LIVE_MS = 400;

/** The race slows this far (tick progress) before the braking zone. */
const SLOW_BEFORE = 0.05;
/** The battle card comes up this far (tick progress) before the braking zone, so it doesn't sit
 * on screen for most of the lap when the corner is late in it. */
const SHOW_BEFORE = 0.12;
/** How long the race waits at the braking zone for your call before the driver goes alone. */
const BATTLE_WAIT_MS = 8000;
/** The tutorial's calls wait for an answer (10 minutes is as good as never). */
const NO_TIMEOUT = 10 * 60_000;

/** What a lap's fight came to for your car, from the race model's notes. */
function battleResult(
  notes: RaceNote[],
  userSide: string,
  call: Decision | null,
): { text: string; good: boolean } | null {
  const mine = notes.filter((n) => n.driver === userSide);
  const contact = mine.find((n) => n.kind === 'contact');
  if (contact) return { text: contact.detail === 'spin' ? 'SPIN!' : 'CONTACT!', good: false };
  const fought = mine.find((n) => n.kind === 'battle');
  if (fought) {
    const good = fought.detail === 'passed' || fought.detail === 'held';
    const text =
      fought.detail === 'passed'
        ? `PAST ${namedUpper(fought.other ?? '')}!`
        : fought.detail === 'held'
          ? 'HELD!'
          : fought.detail === 'lost'
            ? `${namedUpper(fought.other ?? '')} THROUGH`
            : 'NO WAY BY';
    return { text, good };
  }
  if (call?.kind === 'battle' && call.move === 'wait-drs')
    return { text: 'IN DRS FOR NEXT LAP', good: true };
  if (call?.kind === 'battle' && call.move === 'let-go') return { text: 'LET HIM BY', good: true };
  return null;
}

/** What the tutorial asks of the race screen. */
export interface TutorialHooks {
  /** Still raise quick calls / battles (off once each is taught). */
  quick: boolean;
  battle: boolean;
  /** The call on screen changed. */
  onCall: (call: TutorialCall | null) => void;
}

export type TutorialCall =
  | { kind: 'plan' | 'quick' | 'battle' | 'headsUp' | 'replan' }
  | { kind: 'decision'; trigger: string; lap: number };

type RaceScreenProps = Parameters<typeof RaceScreenBody>[0];

/**
 * The race screen in the race's era look (eras build plan 8.5): tyre badges and how prompts
 * look, from its rules and era (eras/raceRules.ts); today's look for every race without them.
 */
export function RaceScreen(props: RaceScreenProps) {
  const { model } = props;
  const look = useMemo<RaceEraLook>(() => {
    const e = raceScreenEra(model);
    return { tyres: e.tyres, lockedTyre: e.lockedTyre, prompts: e.prompts };
  }, [model]);
  return createElement(
    RaceEraContext.Provider,
    { value: look },
    createElement(RaceScreenBody, props),
  );
}

function RaceScreenBody({
  game,
  state,
  model,
  onFinished,
  onHome,
  eras,
  tutorial,
}: {
  game: Game;
  state: GameState;
  model: RaceModel;
  /** An Eras race: its difficulty (timer, information level) and attempt. Absent elsewhere. */
  eras?: ErasRace;
  /** The run to the flag is over (your car crossed the line): show the results. */
  onFinished?: () => void;
  /** The Pit Wall brand: the home page (the race holds). */
  onHome?: () => void;
  /** The tutorial race (screens/Tutorial.tsx): calls never time out, the quick calls and
   * battles it has taught are skipped, and it hears which call is on screen. */
  tutorial?: TutorialHooks;
}) {
  const { userSide, rival, totalLaps, number, source } = state.meta;
  const me = state.race.cars[userSide];
  const them = state.race.cars[rival];
  const paused = state.phase === 'decision';
  const battleWait = tutorial ? NO_TIMEOUT : BATTLE_WAIT_MS;
  const planning = state.phase === 'planning';
  // The race plan: the heads-up before a planned stop (once per stop), the engineer's better
  // plan (kept ours: not again until the race changes, below), and the plan editor.
  const headsUp = headsUpStop(state);
  const [headsUpSeen, setHeadsUpSeen] = useState<number | null>(null);
  const replan = betterPlan(state);
  const [keptAt, setKeptAt] = useState<string | null>(null);
  const [planEdit, setPlanEdit] = useState(false);
  const outline = outlineFor(model.race.id);
  const [selected, setSelected] = useState<string | null>(null);
  const [sound, setSound] = useState(soundOn);
  const log = useRaceLog(state.race);
  const team = model.drivers.find((d) => d.code === userSide)?.team;
  // The flag of the lap being driven, and why it's out.
  const drivenFlag = state.race.nextFlag ?? flagOn(model, state.race.lap + 1);
  const flag = FLAG[drivenFlag];
  const why = neutralCause(model, game.notes(), state.race.lap + 1, drivenFlag);
  // A wet race: the conditions on the lap being driven and the engineer's radar.
  const wetNow = model.weather ? wetnessOn(model.weather.wetness, state.race.lap + 1) : 0;
  const radar = forecast(model, state.race.lap);
  // What the strategy turns on, beyond laps ticking by: either car's tyres changing, a safety
  // car or VSC coming out, rain arriving or going, the rival retiring, and our own plan. After
  // "Keep ours" the engineer asks again only once one of these has changed.
  const neutrals = useRef({ count: 0, last: drivenFlag });
  if (neutrals.current.last !== drivenFlag) {
    if (drivenFlag !== 'green' && neutrals.current.last === 'green') neutrals.current.count++;
    neutrals.current.last = drivenFlag;
  }
  const situation = JSON.stringify([
    me ? state.race.lap - me.tyreAge : null,
    them ? state.race.lap - them.tyreAge : null,
    !!them?.retired,
    neutrals.current.count,
    wetNow >= 0.12,
    state.plan.active ? [state.plan.active.stops, state.plan.active.pace] : null,
  ]);
  const lapsLeft = totalLaps - state.race.lap;
  const gap = me && them && !me.retired && !them.retired ? them.totalTime - me.totalTime : null;
  // The Eras information level (everything, outside Eras): at Minimal the rival's gap shows
  // only when he's the car directly ahead or behind.
  const info = informationView(eras?.difficulty.information);
  const rivalGapShown = gapShown(info, state.race.order, userSide, rival);
  const shownRivalGap = rivalGapShown ? gap : null;

  // The flag: run the field to the line, then hold the chequered flag before the results.
  const finishing = state.phase === 'finished';
  const [crossed, setCrossed] = useState(false);
  const onCrossed = useCallback(() => setCrossed(true), []);
  useEffect(() => {
    if (!finishing) return;
    if (!outline) {
      onFinished?.();
      return;
    }
    if (!crossed) return;
    const id = setTimeout(() => onFinished?.(), 2600);
    return () => clearTimeout(id);
  }, [finishing, crossed, outline, onFinished]);
  const finishPos = state.race.order.indexOf(userSide) + 1;
  const finishMeta = useMemo(
    () => (finishing ? { lapMs: LAP_MS[state.speed], onCrossed } : null),
    [finishing, state.speed, onCrossed],
  );

  // The race engineer's radio (race engineer spec): after every lap the director picks the
  // most pressing call (a battle, trouble, the driver asking, the engineer's question); a quiet
  // lap gets an info line now and then. A battle (battles and trust spec) is fought at a corner
  // on the map: the race runs to the braking zone and waits there for your call, then the move
  // plays out and its result shows at the corner.
  const cfg = useMemo(() => engineerConfig(model), [model]);
  const corners = useMemo(() => overtakingCorners(outline), [outline]);
  const quickLaps = useMemo(() => new Set(quickCallLaps(model)), [model]);
  const line = useMemo(() => (outline ? polyline(outline.points) : null), [outline]);
  const memory = useRef(newMemory());
  // The corner each car was last fought for (the next battle with it goes elsewhere).
  const lastCorner = useRef(new Map<string, number>());
  const asked = useRef(new Set<number>());
  const [quick, setQuick] = useState<QuickCall | null>(null);
  // Time to read a call before its clock runs (call timing).
  const quickRead = quick ? readMs(quick) : 0;
  const [battle, setBattleState] = useState<Battle | null>(null);
  const battleRef = useRef<Battle | null>(null);
  const battleRead = !tutorial && battle ? readMs(battle.call) : 0;
  const setBattle = useCallback((b: Battle | null) => {
    battleRef.current = b;
    setBattleState(b);
  }, []);
  // Calls made after a battle call are for the next lap (the result shown can't change).
  const battleLock = useRef<number | null>(null);
  const [flash, setFlash] = useState<{ text: string; good: boolean; corner: number } | null>(null);
  const motion = useRef<MapMotion | null>(null);
  // Where every car is, for the 3D view (three/RaceStage).
  const feed = useRef<MapFeed | null>(null);
  const clockRef = useRef(game.clock);
  clockRef.current = game.clock;
  const raceLap = state.race.lap;
  const { setPace } = game;
  // Leaving the race screen never leaves the race frozen.
  useEffect(() => () => setPace('normal'), [setPace]);

  /** The battle's corner (battle variety): one of the track's best overtaking corners your
   * car reaches this lap with time to read the card (the map knows where it is), varied lap to
   * lap and never the one fought for last time against the same car when there's another.
   * Null if none can be drawn. */
  const battleAt = useCallback(
    (call: QuickCall): Battle | null => {
      const m = motion.current;
      if (!m || !line || !outline || !call.other) return null;
      const p0 = clockRef.current ? clockProgress(clockRef.current) : 0;
      const reachable = (from: number, list: number[]) =>
        list
          .map((n) => {
            const pt = cornerPoint(outline, n);
            const f = pt ? nearestFraction(line, pt) : null;
            const p = f === null ? null : m.reach(userSide, f);
            return f === null || p === null ? null : { n, f, p };
          })
          .filter(
            (x): x is { n: number; f: number; p: number } => !!x && x.p >= from && x.p <= 0.96,
          )
          .sort((a, b) => a.p - b.p);
      let pool = reachable(p0 + 0.12, corners.slice(0, 4));
      if (!pool.length) pool = reachable(p0 + 0.12, corners);
      if (!pool.length) pool = reachable(p0 + 0.04, corners);
      const fresh = pool.filter((c) => c.n !== lastCorner.current.get(call.other as string));
      const from = fresh.length ? fresh : pool;
      const best = from[(raceLap + (call.other as string).charCodeAt(0)) % from.length];
      if (!best) return null;
      lastCorner.current.set(call.other, best.n);
      const brakeP = Math.max(p0 + 0.02, best.p - BRAKE_BEFORE);
      return {
        call,
        lap: raceLap,
        corner: best.n,
        at: best.f,
        fromP: p0,
        brakeP,
        cornerP: best.p,
        stage: 'approach',
        chosen: null,
        result: null,
        swap: null,
        zoom: true,
        shown: brakeP - p0 <= SHOW_BEFORE,
      };
    },
    [line, outline, corners, userSide, raceLap],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: asked once, when its lap completes.
  useEffect(() => {
    setPace('normal'); // a battle's lap is over
    setQuick(null);
    // A battle whose result never reached its corner on screen shows it now.
    const done = battleRef.current;
    if (done?.result && done.stage !== 'done') setFlash({ ...done.result, corner: done.corner });
    setBattle(null);
    if (state.phase !== 'racing' || asked.current.has(raceLap)) return;
    asked.current.add(raceLap);
    // The last lap's fight, at its corner, unless the battle showed it already.
    if (done?.lap !== raceLap - 1) {
      const corner = corners[0] ?? 1;
      const result = battleResult(
        game.notes().filter((n) => n.lap === raceLap),
        userSide,
        null,
      );
      if (result) setFlash({ ...result, corner });
    }
    const call = directorCall(
      state.race,
      model,
      cfg,
      log,
      game.notes(),
      corners,
      memory.current,
      quickLaps.has(raceLap),
      // A stop called, or the plan's within two laps (its heads-up asks instead).
      state.decisions.some((d) => d.kind === 'pit' && d.lap > raceLap) ||
        !!state.plan.active?.stops.some((s) => s.lap > raceLap && s.lap <= raceLap + 2),
      info,
    );
    // The tutorial skips the kinds of call it has already taught.
    if (call && tutorial && !(call.kind === 'battle' ? tutorial.battle : tutorial.quick)) return;
    if (call?.kind === 'battle') {
      const fight = battleAt(call);
      if (fight) {
        // The moves in the words of the corner it's fought into (hairpin, sweeper, chicane).
        const kind = line ? cornerKind(line, fight.at) : 'corner';
        setBattle({ ...fight, call: flavourBattle({ ...call, corner: fight.corner }, kind) });
        return;
      }
      // No corner to draw it at: the plain card, the race held until you call (BATTLE_WAIT_MS
      // at most), not a whole lap in slow motion.
      setPace('frozen');
    }
    if (call) {
      // The race runs on in slow motion while you read and answer (call timing); a battle
      // with no corner to draw is held still instead (above).
      if (call.kind !== 'battle') setPace('slow');
      setQuick(call);
      return;
    }
    // A quiet lap: the engineer's info, every other lap or so.
    const last = memory.current.last.info ?? -99;
    const neutral = state.race.nextFlag !== 'green' || state.race.flag !== 'green';
    if (raceLap - last >= (neutral ? 1 : 2)) {
      const line = infoLine(state.race, model, log, info);
      if (line) {
        memory.current.last.info = raceLap;
        game.radio(line);
      }
    }
  }, [raceLap, state.phase]);
  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), 4000);
    return () => clearTimeout(id);
  }, [flash]);

  // The battle, lap clock in hand: slow into the braking zone and stop there until you call;
  // once called, slow through the corner and show the result as your car gets there.
  const stage = battle?.stage;
  useEffect(() => {
    if (stage !== 'approach' && stage !== 'move') return;
    let raf = 0;
    const frame = () => {
      const c = clockRef.current;
      const b = battleRef.current;
      if (c && b && c.frozen === undefined) {
        const p = clockProgress(c);
        if (b.stage === 'approach' && p >= b.brakeP) {
          setPace('frozen');
          setBattle({ ...b, stage: 'waiting', shown: true });
          return;
        }
        if (b.stage === 'move' && p >= b.cornerP + 0.012) {
          if (b.result) setFlash({ ...b.result, corner: b.corner });
          setPace('normal');
          setBattle({ ...b, stage: 'done' });
          return;
        }
        if (b.stage === 'approach' && !b.shown && p >= b.brakeP - SHOW_BEFORE) {
          setBattle({ ...b, shown: true });
        }
        if (p >= b.brakeP - SLOW_BEFORE) setPace('slow');
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [stage, setPace, setBattle]);
  // The camera eases back out a moment after the result.
  useEffect(() => {
    if (stage !== 'done') return;
    const id = setTimeout(() => {
      const b = battleRef.current;
      if (b) setBattle({ ...b, zoom: false });
    }, 1800);
    return () => clearTimeout(id);
  }, [stage, setBattle]);

  /** Your call in a battle (or, with none, the driver's own): the move, and its result read
   * ahead from the race model so it shows at the corner. */
  const answerBattle = useCallback(
    (id: string, byDriver = false) => {
      const b = battleRef.current;
      const o = b?.call.options.find((x) => x.id === id);
      if (!b || b.chosen || !o) return;
      const next = state.race.lap + 1;
      if (!byDriver && o.call) game.call({ ...o.call, lap: next }, { asked: b.call.asked });
      battleLock.current = next;
      const preview = game.preview();
      const other = b.call.other as string;
      const result = preview ? battleResult(preview.notes, userSide, o.call) : null;
      const me = preview?.race.cars[userSide];
      const them = preview?.race.cars[other];
      const swap = me && them && !me.retired && !them.retired ? { at: b.cornerP } : null;
      setBattle({
        ...b,
        chosen: id,
        stage: 'move',
        result: result ?? { text: 'NO MOVE', good: true },
        swap,
      });
      // Slow motion only from just before the braking zone: a call made early in the lap
      // doesn't slow the rest of it (the frame loop slows it there).
      const c = clockRef.current;
      const near = b.stage === 'waiting' || (!!c && clockProgress(c) >= b.brakeP - SLOW_BEFORE);
      setPace(near ? 'slow' : 'normal');
    },
    [game, state.race.lap, userSide, setPace, setBattle],
  );
  // No call while the race waits at the braking zone: the driver makes his own move.
  const driverMoves = useCallback(() => {
    const b = battleRef.current;
    const own = b?.call.driverChoice;
    if (!b || !own || own.kind !== 'battle') return;
    game.radio(`No call from the wall: ${userSide} makes his own move.`);
    game.call({ ...own, lap: state.race.lap + 1 }, { quiet: true });
    const match = b.call.options.find((x) => x.call?.kind === 'battle' && x.call.move === own.move);
    if (match) answerBattle(match.id, true);
  }, [game, userSide, state.race.lap, answerBattle]);
  // (In Eras the era's decision timer on the card does this instead.)
  const erasRace = !!eras;
  useEffect(() => {
    if (stage !== 'waiting' || erasRace) return;
    const id = setTimeout(driverMoves, battleWait + battleRead);
    return () => clearTimeout(id);
  }, [stage, erasRace, driverMoves, battleWait, battleRead]);

  // The lap a BOX call turns in at (pit fix): the end of the lap being shown, if your car can
  // still reach pit entry on it (the map knows where it is); otherwise the end of the next one.
  // (Paused, the cars sit at the line with the entry ahead.)
  const boxLap = useCallback((): number => {
    const n = state.race.lap + 1;
    const clock = game.clock;
    if (!clock || !motion.current) return n;
    return motion.current.reachesEntry(userSide, state.race, clockProgress(clock)) ? n : n + 1;
  }, [game.clock, state.race, userSide]);
  const place = useCallback(
    <T extends Decision>(call: T): T => {
      const next = state.race.lap + 1;
      const after = battleLock.current === next ? next + 1 : next;
      return { ...call, lap: call.kind === 'pit' ? Math.max(boxLap(), after) : after };
    },
    [boxLap, state.race.lap],
  );
  const answerQuick = useCallback(
    (id: string, fill?: FuelFill) => {
      const o = quick?.options.find((x) => x.id === id);
      // A stop the wall picks in answer to a question is made (the driver doesn't argue it).
      const asked = (quick?.asked ?? true) || o?.call?.kind === 'pit';
      // A refuelling race: the fill the player picked on the card goes on the stop.
      const fuelled = (c: Decision): Decision => (c.kind === 'pit' && fill ? { ...c, fill } : c);
      if (o?.call) game.call(place(fuelled(o.call)), { asked });
      else game.radio('Copy. No change.');
      for (const c of o?.also ?? []) game.call(place(fuelled(c)), { asked: true });
      setQuick(null);
      setPace('normal');
    },
    [quick, game, place, setPace],
  );
  const quickTimeout = useCallback(() => {
    if (quick?.driverChoice) {
      // No answer: the driver makes his own call (logged like any other).
      game.radio(`No call from the wall: ${userSide} makes his own move.`);
      game.call({ ...quick.driverChoice, lap: state.race.lap + 1 }, { quiet: true });
    } else game.radio('No answer from the wall. Sticking to the plan.');
    setQuick(null);
    setPace('normal');
  }, [game, quick, state.race, userSide, setPace]);

  const select = useCallback((code: string) => setSelected((c) => (c === code ? null : code)), []);
  const close = useCallback(() => setSelected(null), []);
  const driverCard = selected ? (
    <DriverCard
      code={selected}
      race={state.race}
      model={model}
      log={log}
      userSide={userSide}
      rival={rival}
      onClose={close}
      info={info}
    />
  ) : null;

  const momentIdFor = paused ? state.currentMoment?.id : undefined;
  // Chirp when the race stops for a call.
  const momentId = paused ? state.currentMoment?.id : undefined;
  useEffect(() => {
    if (momentId && soundOn()) radioChirp();
  }, [momentId]);

  // The Eras decision timer (eras spec §7). Off by the player's accessibility setting: then
  // every call waits, and an attempt that shows a call that way is marked untimed (kept, and
  // never cleared by turning the timer back on).
  const [timed, setTimed] = useState(timerOn);
  const attemptId = eras?.attemptId;
  const onUntimed = eras?.onUntimed;
  const [untimed, setUntimed] = useState(() => !!attemptId && attemptUntimed(attemptId));
  // The call waiting for an answer: the big call, a quick call, or a battle at the braking zone.
  const waitingFor =
    momentId ??
    (quick && state.phase === 'racing'
      ? `quick-${quick.lap}`
      : battle?.stage === 'waiting'
        ? `battle-${battle.lap}`
        : undefined);
  useEffect(() => {
    if (!attemptId || !waitingFor || !noteDecisionShown(attemptId, timed)) return;
    setUntimed(true);
    onUntimed?.();
  }, [attemptId, waitingFor, timed, onUntimed]);
  const timerSeconds = eras && timed ? eras.difficulty.decisionTimerSeconds : null;
  // Quick calls and battles in Eras: the era's timer, not the cards' own (callTimer.tsx).
  const erasTimer = (key: string, onExpire: () => void) =>
    erasCallTimer(eras, timed, key, onExpire);
  // In Eras a quick call waits for its timer (or, with the timer off, for the call): the race
  // holds while it's up, and runs on once it's answered or out of time.
  const holdForCall = holdsForQuickCall(eras, !!quick, state.phase === 'racing');
  useEffect(() => {
    if (!holdForCall) return;
    setPace('frozen');
    return () => setPace('normal');
  }, [holdForCall, setPace]);
  // Out of time: the wall takes the default (stay out, or keep the current mode).
  const expire = useCallback(() => {
    if (state.currentMoment) takeDefault(game, state.currentMoment, me?.modes);
  }, [game, state.currentMoment, me?.modes]);

  // Calls booked for the coming lap show at once (they act when it's run).
  const next = state.race.lap + 1;
  const pending: Partial<Modes> = {};
  for (const d of state.decisions) {
    if (d.lap === next && d.kind === 'mode') (pending as Record<string, string>)[d.key] = d.value;
  }
  // A stop under way (pit fix). The lap being shown is `next`: a stop called for it turns in at
  // the end of this lap; one called for the lap after, at the end of the next. Once the race
  // model has it (from the in-lap on), it's on the car's plan until the out-lap is run.
  const callPit = state.decisions.find((d) => d.kind === 'pit' && d.lap >= next);
  const planned = me?.strategy.find((s) => s.lap > state.race.lap);
  const boxing =
    callPit?.kind === 'pit'
      ? {
          compound: callPit.compound,
          when: callPit.lap === next ? 'boxing this lap' : 'boxing next lap',
        }
      : planned
        ? {
            compound: planned.to,
            when: planned.lap === next ? 'stop under way' : 'boxing this lap',
          }
        : null;
  const userBox = callPit?.kind === 'pit' ? callPit.lap : null;
  // A stop booked another way (the team radio's BOX) answers a stop question already up.
  const stopQuestion = !!quick && offersStop(quick);
  useEffect(() => {
    if (userBox !== null && stopQuestion) {
      setQuick(null);
      setPace('normal');
    }
  }, [userBox, stopQuestion, setPace]);

  // The battle once its card is up (the map, the camera and the call area wait for it).
  const shownBattle = battle && (battle.shown || battle.chosen !== null) ? battle : null;
  // The battle as the map draws it.
  const battleView: BattleView | null =
    shownBattle?.call.other !== undefined
      ? {
          other: shownBattle.call.other,
          corner: shownBattle.corner,
          at: shownBattle.at,
          options: shownBattle.call.options.map((o, i) => ({ n: i + 1, line: o.line ?? 'wait' })),
          chosen: shownBattle.call.options.find((o) => o.id === shownBattle.chosen)?.line ?? null,
          zoom: shownBattle.zoom,
          swap: shownBattle.swap,
        }
      : null;

  // The lap being shown, run ahead (the map moves the field toward its end, and shows a car
  // stopping or a puncture as it happens). Again after any call: it changes the lap.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the lap, the calls and the phase are what change it.
  const ahead = useMemo(
    () => (state.phase === 'racing' || state.phase === 'decision' ? game.preview() : null),
    [state.race.lap, state.decisions, state.phase],
  );
  // The standings as the map shows them, a few times a second while the lap runs.
  const [live, setLive] = useState<LiveStanding[] | null>(null);
  const running = state.phase === 'racing' && !!game.clock && game.clock.frozen === undefined;
  const racing = state.phase === 'racing';
  const replanUp = !!replan && racing && !quick && situation !== keptAt;
  useEffect(() => {
    if (!racing) setLive(null);
  }, [racing]);
  const liveStandings = info.liveStandings;
  useEffect(() => {
    // Frozen for a battle call: the standings hold where they are. At Minimal they change
    // once per lap.
    if (!running || !liveStandings) return;
    const id = setInterval(() => setLive(motion.current?.standings() ?? null), LIVE_MS);
    return () => clearInterval(id);
  }, [running, liveStandings]);

  // A stop by your car or the rival on the lap just run, while the next lap animates.
  const latest = log.at(-1);
  const stop =
    state.phase === 'racing' && latest?.lap === state.race.lap
      ? latest.pits.find((p) => p.code === userSide || p.code === rival)
      : undefined;

  // Focus view: the map takes the screen, the leaders beside it as on TV. Stats view: the
  // timing tower and the stats come in at the sides and the map shrinks between them. Nothing
  // sits on the track: the calls and the panels (team radio, the plan) open under the map,
  // which shrinks to make room. On a phone the stats are tabs in the control bar.
  type Panel = 'radio' | 'plan' | 'car' | 'calls' | 'log' | 'standings';
  const [stats, setStats] = useState(false);
  // The map's follow camera (kept for the next race on this device).
  const [follow, setFollow] = useState(() => {
    try {
      return localStorage.getItem(FOLLOW_KEY) === 'on';
    } catch {
      return false;
    }
  });
  const toggleFollow = () => {
    try {
      localStorage.setItem(FOLLOW_KEY, follow ? 'off' : 'on');
    } catch {
      // private mode: the choice lasts this page only
    }
    setFollow(!follow);
  };
  // The calls, the dock and the control bar float over the map's lower edge; the circuit's
  // frame stays above them (nothing sits on the track), so their height is measured.
  const stackRef = useRef<HTMLDivElement>(null);
  const [stackH, setStackH] = useState(0);
  useEffect(() => {
    const el = stackRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setStackH(el.offsetHeight));
    ro.observe(el);
    setStackH(el.offsetHeight);
    return () => ro.disconnect();
  }, []);
  const [panelOpen, setPanelOpen] = useState<Panel | null>(null);
  useEffect(() => {
    if (paused || planning) setPanelOpen(null);
  }, [paused, planning]);
  const toggle2 = (p: Panel) => setPanelOpen((c) => (c === p ? null : p));
  // The dock keeps the last panel's content while it slides shut.
  const dockOpen = !!panelOpen && !planning;
  const [shown, setShown] = useState<Panel | null>(null);
  useEffect(() => {
    if (panelOpen) setShown(panelOpen);
  }, [panelOpen]);
  const callUp =
    planning ||
    (paused && !!state.currentMoment) ||
    (!!shownBattle && racing && (shownBattle.stage !== 'done' || shownBattle.zoom)) ||
    (!!headsUp && racing && headsUpSeen !== headsUp.lap) ||
    replanUp ||
    (!!quick && racing);
  const planLabel = (() => {
    const a = state.plan.active;
    if (!a) return 'Plan';
    const next = a.stops.find((st) => st.lap > state.race.lap);
    return next ? `Plan · box L${next.lap}` : 'Plan · to the flag';
  })();
  const pill = (on: boolean) =>
    `flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-[13px] font-bold transition-colors disabled:opacity-40 ${
      on
        ? 'border-[#EEF1EE] bg-[#EEF1EE] text-[#0E1214]'
        : 'border-[var(--glass-edge)] bg-[var(--glass)] text-[#D5DBD7] backdrop-blur-[14px] hover:border-white/30'
    }`;
  const statsPanels = (
    <>
      <DriverProfile
        code={userSide}
        race={state.race}
        model={model}
        log={log}
        notes={game.notes()}
      />
      <CarStats
        race={state.race}
        model={model}
        log={log}
        userSide={userSide}
        rival={rival}
        info={info}
      />
      {/* Eras at Minimal information (eras spec §7): only the cars either side are timed, so
          their gaps get a panel of their own (the scoreboard may not show the rival's). */}
      {info.adjacentGapsOnly && (
        <Panel
          label={`Gap to ${rival}`}
          title={`Gap to ${surname(rival)}`}
          right={
            <span
              className="mono text-[15px] font-bold"
              style={{
                color:
                  shownRivalGap === null
                    ? undefined
                    : shownRivalGap >= 0
                      ? 'var(--you)'
                      : 'var(--rival)',
              }}
            >
              {gapText(info, shownRivalGap)}
            </span>
          }
        >
          <NeighbourGaps race={state.race} userSide={userSide} info={info} />
        </Panel>
      )}
      <LiveGrades state={state} model={model} />
      <Panel title="Radio">
        {state.radio.length ? (
          <RadioLog messages={state.radio} max={8} />
        ) : (
          <p className="m-0 text-[12px] text-[#9AA5A0]">Quiet so far.</p>
        )}
      </Panel>
    </>
  );
  const tower = (
    <TimingTower
      race={state.race}
      model={model}
      userSide={userSide}
      rival={rival}
      onPick={select}
      live={live}
      info={info}
    />
  );

  // The car you tapped: its card floats over the map's bottom-left corner (the map keeps its
  // size). A call under the map, or the chequered flag, comes first: the card waits for it.
  const cardShown = !!driverCard && !callUp && !(finishing && crossed);

  // On a phone the leaders step aside (and the map takes the width) while anything opens under
  // it, or the driver card is over it.
  const tight = dockOpen || callUp || cardShown;

  // The call, one at a time, under the map: the plan, the big decision, a quick call. With
  // none up, the chequered flag.
  const call = planning ? (
    <PlanCard state={state} model={model} onBuild={game.buildPlan} onPick={game.pickPlan} />
  ) : paused && state.currentMoment ? (
    <BroadcastDecision
      key={state.currentMoment.id}
      moment={state.currentMoment}
      race={state.race}
      model={model}
      onChoose={game.choose}
      info={info}
      timer={
        timerSeconds !== null && attemptId ? (
          <DecisionTimer
            momentKey={`${attemptId}:${state.currentMoment.id}`}
            seconds={timerSeconds}
            onExpire={expire}
          />
        ) : undefined
      }
    />
  ) : shownBattle && racing && (shownBattle.stage !== 'done' || shownBattle.zoom) ? (
    <BattleCard
      key={shownBattle.lap}
      call={shownBattle.call}
      corner={shownBattle.corner}
      stage={shownBattle.stage}
      clock={game.clock}
      fromP={shownBattle.fromP}
      brakeP={shownBattle.brakeP}
      waitMs={battleWait}
      readMs={battleRead}
      chosen={shownBattle.chosen}
      result={shownBattle.stage === 'done' ? shownBattle.result : null}
      onAnswer={answerBattle}
      eras={erasTimer(`battle-${shownBattle.lap}`, driverMoves)}
    />
  ) : headsUp && racing && headsUpSeen !== headsUp.lap ? (
    <PlanHeadsUp
      key={`plan-${headsUp.lap}`}
      stop={headsUp}
      onBox={() => setHeadsUpSeen(headsUp.lap)}
      canLater={!!(state.plan.active && delayStop(state.plan.active, headsUp.lap, totalLaps))}
      onLater={() => {
        game.delayPlannedStop(headsUp.lap);
        setHeadsUpSeen(headsUp.lap);
      }}
      onChange={() => {
        setHeadsUpSeen(headsUp.lap);
        setPlanEdit(true);
        setPanelOpen('plan');
      }}
    />
  ) : replan && replanUp ? (
    <ReplanOffer
      offer={replan}
      // A plan the car can't take any more (its stop is past) is kept, not left on screen.
      onSwitch={() => {
        if (!game.changePlan(replan.plan)) setKeptAt(situation);
      }}
      onKeep={() => setKeptAt(situation)}
    />
  ) : quick && racing ? (
    <QuickCallCard
      key={quick.lap}
      call={quick}
      read={tutorial ? 0 : quickRead}
      ms={
        tutorial
          ? NO_TIMEOUT
          : quick.kind === 'battle'
            ? battleWait
            : // The answer lands this lap: the lap runs in slow motion while the call is up.
              Math.min(CALL_MS, LAP_MS[state.speed] * SLOW_MOTION * 0.9 - quickRead)
      }
      onAnswer={answerQuick}
      onTimeout={quickTimeout}
      eras={erasTimer(`quick-${quick.lap}`, quickTimeout)}
      fuel={refuelReading(state.race, model)}
    />
  ) : finishing && crossed ? (
    <output className="flex items-center justify-center gap-3 bg-[#F2F4F2] px-5 py-3 text-[#0E1214]">
      <ChequeredIcon size={24} />
      <span className="disp text-[18px]">
        Chequered flag · {surname(userSide)} P{finishPos}
      </span>
    </output>
  ) : null;
  // The tutorial hears which call is on screen (once per change).
  const onTutorialCall = tutorial?.onCall;
  const shownCall: TutorialCall | null = planning
    ? { kind: 'plan' }
    : paused && state.currentMoment
      ? { kind: 'decision', trigger: state.currentMoment.trigger, lap: state.currentMoment.lap }
      : shownBattle && racing && (shownBattle.stage !== 'done' || shownBattle.zoom)
        ? { kind: 'battle' }
        : headsUp && racing && headsUpSeen !== headsUp.lap
          ? { kind: 'headsUp' }
          : replanUp
            ? { kind: 'replan' }
            : quick && racing
              ? { kind: quick.kind === 'battle' ? 'battle' : 'quick' }
              : null;
  const shownKey = shownCall ? JSON.stringify(shownCall) : '';
  useEffect(() => {
    onTutorialCall?.(shownKey ? (JSON.parse(shownKey) as TutorialCall) : null);
  }, [shownKey, onTutorialCall]);

  const callKey = planning
    ? 'plan'
    : paused && state.currentMoment
      ? state.currentMoment.id
      : (shownBattle && `battle-${shownBattle.lap}`) || (quick && `quick-${quick.lap}`) || 'other';

  return (
    <main className="relative isolate flex h-[100dvh] flex-col overflow-hidden bg-[#0E1214] text-[#EEF1EE]">
      {/* The circuit's ground, dimmed, behind everything: the panels float over it as glass. */}
      <GroundBackdrop raceId={model.race.id} dim={0.36} fill="absolute" />
      {/* The top bar: brand, the duel as a scoreboard, the lap and the clock. Tighter spacing
          below md so the duel fits a 390 px phone next to the Eras timer toggle. */}
      <header className="flex h-14 shrink-0 items-stretch border-b border-[var(--glass-edge)] bg-[var(--paper)]/60 backdrop-blur-[14px] md:h-16">
        {/* A Gauntlet run: back to the mode's menu, on every screen size. The race is saved and
            waits; there's no restart, since a run is one go at each race. */}
        {source === 'survivor' && onHome && (
          <button
            type="button"
            onClick={onHome}
            aria-label="Back to the Gauntlet menu"
            title="Back to the Gauntlet menu (the race waits for you)"
            className="flex shrink-0 items-center gap-1.5 border-r border-[var(--glass-edge)] px-3 text-[13px] font-bold text-[#C9D0CD] hover:text-white md:px-4"
          >
            <svg viewBox="0 0 16 16" width={16} height={16} aria-hidden="true">
              <path
                d="M10 3 5 8l5 5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="hidden sm:inline">Menu</span>
          </button>
        )}
        <button
          type="button"
          onClick={onHome}
          title="Home (the race waits for you)"
          className="hidden min-w-0 flex-col items-start justify-center gap-1 border-r border-[var(--glass-edge)] px-5 text-left md:flex"
        >
          <Brand className="text-[19px] leading-none" />
          {team && (
            <span className="max-w-[260px] truncate text-[11px] font-semibold leading-none text-[#9AA5A0]">
              {surname(userSide)}’s race engineer · {team}
            </span>
          )}
        </button>
        <div
          data-tour="score"
          className="flex min-w-0 flex-1 items-center justify-center-safe gap-1 overflow-hidden px-2 md:justify-start md:gap-4 md:px-6"
        >
          <span className="h-8 w-1.5 shrink-0 -skew-x-12 bg-[var(--you)]" />
          <span className="disp wide shrink-0 text-[15px] md:text-[22px]">
            <span className="md:hidden">{userSide}</span>
            <span className="hidden md:inline">{surname(userSide)}</span>
          </span>
          {me && !me.retired && (
            <span className="hidden lg:inline-flex">
              <TyreBadge compound={me.compound} age={me.tyreAge} />
            </span>
          )}
          <span className="mono shrink-0 rounded bg-[#1A2124] px-2 py-1 text-[16px] font-bold md:px-2.5 md:text-[22px]">
            {gapText(info, shownRivalGap, false)}
          </span>
          {them && !them.retired && (
            <span className="hidden lg:inline-flex">
              <TyreBadge compound={them.compound} age={them.tyreAge} />
            </span>
          )}
          <span className="disp wide shrink-0 text-[15px] md:text-[22px]">
            <span className="md:hidden">{rival}</span>
            <span className="hidden md:inline">{surname(rival)}</span>
          </span>
          <span className="h-8 w-1.5 shrink-0 -skew-x-12 bg-[var(--rival)]" />
        </div>
        <div className="flex shrink-0 items-center gap-1.5 border-l border-[var(--glass-edge)] px-2 md:gap-3 md:px-5">
          {source === 'survivor' && (
            <span className="hidden shrink-0 rounded-full bg-[var(--box)] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white lg:inline">
              Gauntlet · round {number}
            </span>
          )}
          {source === 'practice' && (
            <span
              className="hidden shrink-0 rounded-full bg-[var(--flag)] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#151A1D] lg:inline"
              title={state.meta.practiceReason ?? 'Practice run'}
            >
              Practice · not saved
            </span>
          )}
          {eras && untimed && (
            <span
              className="hidden shrink-0 rounded-full border border-[#5A625F] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#D5DAD7] lg:inline"
              title="The decision timer was off: this attempt’s stars are marked untimed"
            >
              Untimed
            </span>
          )}
          <span className="mono text-[16px] font-bold md:text-[22px]">
            {state.race.lap}
            <span className="text-[13px] text-[#9AA5A0] md:text-[15px]">/{totalLaps}</span>
          </span>
          <span className="flex overflow-hidden rounded-full border border-[#343D42]">
            {([1, 2] as const).map((sp) => (
              <button
                key={sp}
                type="button"
                aria-pressed={state.speed === sp}
                onClick={() => game.setSpeed(sp)}
                className={`h-9 px-2 text-[13px] font-bold md:px-3 ${
                  state.speed === sp ? 'bg-[#EEF1EE] text-[#0E1214]' : 'text-[#9AA5A0]'
                }`}
              >
                {sp}×
              </button>
            ))}
          </span>
          <button
            type="button"
            aria-pressed={sound}
            aria-label={sound ? 'Radio sound on' : 'Radio sound off'}
            title="Radio chirp at decisions"
            onClick={() => {
              setSoundOn(!sound);
              setSound(!sound);
              if (!sound) radioChirp();
            }}
            className="hidden h-9 w-9 items-center justify-center rounded-full border border-[#343D42] text-[#9AA5A0] md:flex"
          >
            {sound ? <SoundOnIcon size={16} /> : <SoundOffIcon size={16} />}
          </button>
          {eras && (
            <button
              type="button"
              aria-pressed={timed}
              title={
                timed
                  ? 'Turn the decision timer off (this attempt’s stars are marked untimed)'
                  : 'Turn the decision timer on'
              }
              onClick={() => {
                setTimerOn(!timed);
                setTimed(!timed);
              }}
              className="flex h-9 shrink-0 items-center rounded-full border border-[#333A37] px-1.5 text-[11px] font-bold text-[#8D9692] md:px-3 md:text-[12px]"
            >
              {timed ? 'Timer on' : 'Timer off'}
            </button>
          )}
          {source === 'practice' && (
            <button
              type="button"
              onClick={game.reset}
              aria-label="Restart the race"
              title="Restart the race"
              className="hidden h-9 w-9 items-center justify-center rounded-full border border-[#343D42] text-[#9AA5A0] md:flex"
            >
              ↺
            </button>
          )}
        </div>
      </header>

      {/* Tower | race | stats. In focus view the sides are closed and the race takes it all. */}
      <div
        className={`grid min-h-0 flex-1 grid-cols-1 gap-0 transition-[grid-template-columns] duration-500 ease-out md:[grid-template-columns:var(--cols)] ${stats ? 'md:gap-3 md:p-3' : ''}`}
        style={
          {
            '--cols': stats
              ? 'minmax(0,240px) minmax(0,1fr) minmax(0,330px)'
              : '0px minmax(0,1fr) 0px',
          } as React.CSSProperties
        }
      >
        <section
          aria-label="Standings"
          aria-hidden={!stats}
          className={`hidden min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--glass-edge)] bg-[var(--glass)] backdrop-blur-[14px] transition-opacity duration-300 md:flex ${stats ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        >
          <div className="flex items-baseline justify-between border-b border-[var(--glass-edge)] px-3 py-2.5">
            <span className="eyebrow flex items-center gap-1.5">
              <TimingMark size={14} className="text-[var(--you)]" />
              Lap {state.race.lap}
            </span>
            <span className="mono text-[11px] font-semibold text-[var(--muted)]">
              {lapsLeft} to go
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{tower}</div>
        </section>

        {/* The map fills the race's box (in focus view, the whole screen under the header); the
            call, the dock and the control bar float over its lower edge. */}
        <section aria-label="Race" className="relative flex min-h-0 flex-col">
          <div
            data-tour="map"
            className={`absolute inset-0 flex flex-col overflow-hidden bg-[var(--ground)] ${stats ? 'md:rounded-xl' : ''} ${paused ? 'map-alert' : ''}`}
          >
            {wetNow >= 0.03 && (
              <div
                aria-hidden="true"
                className="map-rain pointer-events-none absolute inset-0"
                style={{ opacity: Math.min(0.85, 0.25 + wetNow * 1.2) }}
              />
            )}
            {/* The strip over the circuit: flag, weather, a battle and a pit stop. */}
            <div className="relative z-10 flex shrink-0 flex-wrap items-center gap-2 px-3 pt-3">
              <span
                className={`rounded px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] ${flag.cls}`}
              >
                {flag.text}
              </span>
              {radar && (
                <span
                  className="rounded px-2.5 py-1 text-[12px] font-semibold"
                  style={{ background: WEATHER_BG[conditionsOf(wetNow)] }}
                >
                  <span className="font-extrabold uppercase tracking-wider">
                    {CONDITION_WORD[conditionsOf(wetNow)]}
                  </span>
                  <span className="opacity-90">
                    {' '}
                    · {radar.text}
                    {radar.sure !== null ? ` · ${radar.sure}%` : ''}
                  </span>
                </span>
              )}
              {why && (
                <span className="rounded bg-black/75 px-2.5 py-1 text-[12px] font-semibold">
                  {why}
                </span>
              )}
              {shownBattle && !paused && shownBattle.stage !== 'done' && (
                <output
                  className={`flex items-center gap-1.5 rounded bg-[var(--box)] px-2.5 py-1 text-[12px] font-bold text-white ${shownBattle.stage === 'waiting' ? 'animate-pulse' : ''}`}
                >
                  <OvertakeIcon size={14} />
                  {shownBattle.stage === 'waiting'
                    ? `Braking for T${shownBattle.corner}: your call`
                    : shownBattle.call.attacking
                      ? `${surname(userSide)} on ${surname(shownBattle.call.other ?? '')} · T${shownBattle.corner}`
                      : `${surname(shownBattle.call.other ?? '')} on ${surname(userSide)} · T${shownBattle.corner}`}
                </output>
              )}
              {stop && (
                <span className="ml-auto min-w-0">
                  <PitCard
                    key={`${stop.code}-${stop.lap}`}
                    stop={stop}
                    race={state.race}
                    userSide={userSide}
                    rival={rival}
                  />
                </span>
              )}
            </div>
            <div className="relative min-h-0 flex-1">
              {/* Focus view: the leaders, TV style (stats view has the full tower instead). */}
              {!stats && (
                <div
                  data-tour="leaders"
                  className={`absolute left-3 top-2 z-10 origin-top-left scale-[0.82] md:block md:scale-100 ${tight ? 'hidden' : ''}`}
                >
                  <LeadersTower
                    race={state.race}
                    model={model}
                    userSide={userSide}
                    rival={rival}
                    live={live}
                    onPick={select}
                    info={info}
                  />
                </div>
              )}
              {/* The circuit's frame, as before: clear of the leaders' panel and the edges. The
                  ground is drawn beyond it, so it still fills the whole box. */}
              <div
                className={`absolute top-2 right-2 transition-[left,bottom] duration-500 ${stats ? 'left-2' : tight ? 'left-2 md:left-[190px]' : 'left-[150px] md:left-[190px]'}`}
                style={{ bottom: stackH + 8 }}
              >
                {outline ? (
                  <RaceStage
                    raceId={model.race.id}
                    feedRef={feed}
                    mapAspect={outline.width / outline.height}
                    onSelect={select}
                  >
                    <TrackMap
                      outline={outline}
                      race={state.race}
                      model={model}
                      userSide={userSide}
                      rival={rival}
                      clock={game.clock}
                      selected={selected}
                      onSelect={select}
                      dim={paused}
                      finishing={finishMeta}
                      battle={battleView}
                      follow={follow}
                      ahead={ahead}
                      flash={flash}
                      userBox={userBox}
                      motionRef={motion}
                      feedRef={feed}
                    />
                  </RaceStage>
                ) : (
                  <p className="p-8 text-center text-[var(--muted)]">
                    No track map for this race yet.
                  </p>
                )}
              </div>
              {cardShown && (
                <div className="bc-slide absolute bottom-2 left-2 z-20 md:bottom-3 md:left-3">
                  {driverCard}
                </div>
              )}
            </div>
            {/* The map's OpenStreetMap credit: bottom right, just above the call and the dock
                (the strip over the circuit takes the top). */}
            <MapCredit
              raceId={model.race.id}
              className="absolute right-2 z-20"
              style={{ bottom: stackH + 6 }}
            />
          </div>

          <div
            ref={stackRef}
            className="pointer-events-none relative z-20 mt-auto flex max-h-full flex-col gap-2 px-3 pb-3 md:gap-3 [&>*]:pointer-events-auto"
          >
            {/* The call, over the map's lower edge (never on the track). */}
            {call && (
              <div
                key={callKey}
                data-tour="call"
                className="bc-slide max-h-[52vh] shrink-0 overflow-y-auto"
              >
                {call}
              </div>
            )}

            {/* The dock: a panel opened from the control bar slides up under the map, which
              shrinks to make room. */}
            <div
              className="grid shrink-0 transition-[grid-template-rows] duration-300 ease-out"
              style={{ gridTemplateRows: dockOpen ? '1fr' : '0fr' }}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="max-h-[38vh] overflow-y-auto rounded-xl border border-[var(--glass-edge)] bg-[var(--glass-strong)] p-3 backdrop-blur-[14px] md:mx-0">
                  {shown === 'radio' && (
                    <TeamRadio
                      race={state.race}
                      model={model}
                      userSide={userSide}
                      rival={rival}
                      pending={pending}
                      boxing={boxing}
                      disabled={!racing}
                      describe={(key, value) => modeLine(model, key, value)}
                      onCall={(c) => game.call(place(c))}
                    />
                  )}
                  {shown === 'plan' &&
                    (state.plan.active ? (
                      <PlanBar
                        state={state}
                        model={model}
                        onChange={game.changePlan}
                        editing={planEdit}
                        setEditing={setPlanEdit}
                      />
                    ) : (
                      <p className="m-0 text-[13px] text-[var(--muted)]">No plan yet.</p>
                    ))}
                  {shown === 'standings' && tower}
                  {shown === 'car' && (
                    <div className="flex flex-col gap-3">
                      <DriverProfile
                        code={userSide}
                        race={state.race}
                        model={model}
                        log={log}
                        notes={game.notes()}
                      />
                      <CarStats
                        race={state.race}
                        model={model}
                        log={log}
                        userSide={userSide}
                        rival={rival}
                        info={info}
                      />
                    </div>
                  )}
                  {shown === 'calls' && <LiveGrades state={state} model={model} />}
                  {shown === 'log' && <RadioLog messages={state.radio} max={12} />}
                </div>
              </div>
            </div>

            {/* The control bar, under it all: the plan and team radio left, stats right. */}
            <nav aria-label="Controls" className="flex shrink-0 items-center gap-2 overflow-x-auto">
              <button
                type="button"
                data-tour="radio"
                aria-pressed={panelOpen === 'radio'}
                disabled={planning || paused}
                onClick={() => toggle2('radio')}
                className={pill(panelOpen === 'radio')}
              >
                <RadioMark size={16} className="text-[var(--you)]" />
                Team radio
              </button>
              <button
                type="button"
                data-tour="plan"
                aria-pressed={panelOpen === 'plan'}
                disabled={planning || paused || !state.plan.active}
                onClick={() => toggle2('plan')}
                className={pill(panelOpen === 'plan')}
              >
                {planLabel}
              </button>
              {/* On a phone the stats are these tabs. */}
              {(
                [
                  ['standings', 'Standings'],
                  ['car', 'Car'],
                  ['calls', 'Calls'],
                  ['log', 'Radio'],
                ] as Array<[Panel, string]>
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={panelOpen === id}
                  disabled={planning || paused}
                  onClick={() => toggle2(id)}
                  className={`${pill(panelOpen === id)} md:hidden`}
                >
                  {label}
                </button>
              ))}
              <span className="min-w-[8px] flex-1" />
              {outline && (
                <button
                  type="button"
                  aria-pressed={follow}
                  title={follow ? 'Back to the whole lap' : 'Move with your car'}
                  onClick={toggleFollow}
                  className={pill(follow)}
                >
                  <svg
                    aria-hidden="true"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="2" y="7" width="14" height="11" rx="2" />
                    <path d="M16 11l6-3v9l-6-3" />
                  </svg>
                  Follow car
                </button>
              )}
              <button
                type="button"
                data-tour="stats"
                aria-pressed={stats}
                onClick={() => setStats(!stats)}
                className={`${pill(stats)} hidden md:flex`}
              >
                <svg
                  aria-hidden="true"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <path d="M9 4v16M15 4v16" />
                </svg>
                {stats ? 'Focus view' : 'Show stats'}
              </button>
            </nav>
          </div>
        </section>

        <aside
          aria-label="Stats"
          aria-hidden={!stats}
          className={`hidden min-h-0 flex-col gap-3 overflow-y-auto transition-opacity duration-300 md:flex ${stats ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        >
          {statsPanels}
        </aside>
      </div>
    </main>
  );
}

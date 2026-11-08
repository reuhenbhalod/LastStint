// The era-adaptive race screen (eras build plan 8.5), rendered to markup from real sessions
// (the web tests run in node: effects don't run). A 2005-tagged race offers no DRS or battery
// and never crashes the sim; the two-compound warning is off before 2007; the 2005 tyre lock;
// the pit lane closing under a 2007-08 SC; pit-board prompts in Eras 1-2; the refuelling
// controls; and every race without rules or an era renders exactly as before.

import {
  type Decision,
  type Era,
  type RaceModel,
  type RaceRules,
  type RaceState,
  engineerConfig,
  validateDecisions,
} from '@laststint/sim';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import china2007 from '../../../../data/eras/china-2007.json';
import japan2005 from '../../../../data/eras/japan-2005.json';
import abuJson from '../../../../data/races/abu-dhabi-2021.json';
import { HeadsetPanel } from '../components/HeadsetPanel.js';
import { PlanEditor, twoCompounds } from '../components/PlanEditor.js';
import { QuickCallCard } from '../components/QuickCallCard.js';
import { TeamRadio } from '../components/TeamRadio.js';
import { TyreBadge } from '../components/TyreBadge.js';
import type { Daily } from '../data/types.js';
import type { Grader } from '../engine/grading.js';
import { directorCall, newMemory } from '../game/engineerCalls.js';
import { type QuickCall, safetyCarCall } from '../game/quickCalls.js';
import type { Game } from '../game/useGame.js';
import { RaceScreen } from '../screens/RaceScreen.js';
import { GameSession } from '../state/session.js';
import { RaceEraContext, TODAY_LOOK } from './RaceEraContext.js';
import { FuelFillChoice, FuelGauge } from './RefuelControls.js';
import { memoryStorage } from './difficulty/memoryStorage.test-util.js';
import { closedPitCost, raceScreenEra } from './raceRules.js';
import type { RefuelReading } from './refuel.js';

const abu = abuJson as unknown as RaceModel;
const RULES_2005 = japan2005.rules as RaceRules;
const RULES_2007 = china2007.rules as RaceRules;

beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));
afterEach(() => vi.unstubAllGlobals());

/** Abu Dhabi 2021 run under another era's block, rules and era id. */
const tagged = (era: Era, rules?: RaceRules, eraId?: number): RaceModel => ({
  ...abu,
  era,
  ...(rules ? { rules } : {}),
  ...(eraId ? { eras: { eraId, order: 1 } } : {}),
});
const MODEL_2005 = tagged('1994-2009', RULES_2005, 5);

const dailyOf = (model: RaceModel): Daily => ({
  date: '2026-11-07',
  raceId: model.race.id,
  seed: model.race.seed,
  model,
  source: 'practice',
});

/**
 * No playouts: the screen is under test, not the grades. (The sim's planner and the race's
 * moments don't follow `tyreChanges` yet, so grading Abu Dhabi's plans under 2005 rules would
 * reject their tyre changes: a sim follow-up, see the step's report.)
 */
const noGrades: Grader = { hits: () => new Promise<number[]>(() => {}) };

function session(model: RaceModel, to: 'decision' | 'racing' = 'racing'): GameSession {
  const s = new GameSession(dailyOf(model), { grader: noGrades });
  s.start();
  s.pickPlan('a');
  for (let i = 0; to === 'decision' && i < 300 && s.state.phase === 'racing'; i++) s.tick();
  expect(s.state.phase).toBe(to);
  return s;
}

function screen(s: GameSession, model: RaceModel): string {
  const game = {
    state: s.state,
    model,
    clock: null,
    notes: () => s.notes,
    preview: () => s.previewLap(),
    setPace: () => {},
  } as unknown as Game;
  return renderToStaticMarkup(createElement(RaceScreen, { game, state: s.state, model }));
}

const teamRadio = (race: RaceState, model: RaceModel) =>
  renderToStaticMarkup(
    createElement(TeamRadio, {
      race,
      model,
      userSide: model.userSide,
      rival: model.rival,
      pending: {},
      boxing: null,
      disabled: false,
      describe: () => null,
      onCall: () => {},
    }),
  );

/** Every call an offer would make. */
const callsOf = (call: QuickCall): Decision[] =>
  [
    ...call.options.flatMap((o) => [o.call, ...(o.also ?? [])]),
    ...(call.driverChoice ? [call.driverChoice] : []),
  ].filter((d): d is Decision => d !== null);

describe('a 2005-tagged race', () => {
  it('runs to the flag with every engineer call answered, none rejected by the sim', () => {
    const s = session(MODEL_2005);
    const cfg = engineerConfig(MODEL_2005);
    const mem = newMemory();
    let offered = 0;
    let battles = 0;
    for (let i = 0; i < 400 && s.state.phase !== 'finished'; i++) {
      if (s.state.phase === 'decision') {
        // An option the race allows (Abu Dhabi's moments are authored for today's rules).
        const legal = s.state.currentMoment?.options.find((o) =>
          o.decisions.every((d) => {
            try {
              validateDecisions(MODEL_2005, [d]);
              return true;
            } catch {
              return false;
            }
          }),
        );
        s.choose(legal?.id as string);
        continue;
      }
      const race = s.state.race;
      const call = directorCall(race, MODEL_2005, cfg, [], s.notes, [1], mem, race.lap % 2 === 0);
      if (call) {
        if (call.kind === 'battle') battles++;
        for (const d of callsOf(call)) {
          offered++;
          expect(d.kind === 'battle' && ['wait-drs', 'overtake-button'].includes(d.move)).toBe(
            false,
          );
          expect(d.kind === 'mode' && d.key === 'ers').toBe(false);
          // The sim takes it (it throws on a call the race doesn't allow).
          expect(() => validateDecisions(MODEL_2005, [d])).not.toThrow();
          expect(JSON.stringify(call)).not.toContain('DRS');
        }
        const first = call.options[0]?.call;
        if (first) expect(() => s.call(first, { asked: true, quiet: true })).not.toThrow();
      }
      expect(() => s.tick()).not.toThrow();
    }
    expect(s.state.phase).toBe('finished');
    expect(offered).toBeGreaterThan(0);
    expect(battles).toBeGreaterThan(0);
  });

  it('turns a call the race doesn’t have into a radio line, not a crash', () => {
    const s = session(MODEL_2005);
    const lap = s.state.race.lap + 1;
    expect(() => s.call({ lap, kind: 'battle', move: 'wait-drs' }, { asked: true })).not.toThrow();
    expect(() =>
      s.call({ lap, kind: 'mode', key: 'ers', value: 'deploy' }, { asked: true }),
    ).not.toThrow();
    expect(s.state.decisions.some((d) => d.kind === 'battle' || d.kind === 'mode')).toBe(false);
    expect(s.state.radio.filter((m) => m.text.startsWith('We can’t make that call'))).toHaveLength(
      2,
    );
  });

  it('shows no battery or ERS controls', () => {
    const s = session(MODEL_2005);
    const me = s.state.race.cars[MODEL_2005.userSide];
    if (!me) throw new Error('no car');
    const html = teamRadio(s.state.race, MODEL_2005);
    expect(html).not.toContain('aria-label="ERS"');
    expect(html).not.toContain('aria-label="Battery"');
    expect(html).not.toContain('ERS ');
    expect(html).toContain('aria-label="Pace"');
    expect(html).toContain('aria-label="Fuel"');
    // Today's race keeps them.
    expect(teamRadio(session(abu).state.race, abu)).toContain('aria-label="ERS"');
  });

  it('has HeadsetPanel’s ERS row only with a battery', () => {
    const modes = { pace: 'standard', fuel: 'normal', battle: 'hold', ers: 'balanced' } as never;
    const panel = (ers?: boolean) =>
      renderToStaticMarkup(
        createElement(HeadsetPanel, { modes, battery: 50, disabled: false, onFlip: () => {}, ers }),
      );
    expect(panel()).toContain('aria-label="ERS"');
    expect(panel()).toContain('aria-label="Battery"');
    expect(panel(false)).not.toContain('aria-label="ERS"');
    expect(panel(false)).not.toContain('aria-label="Battery"');
  });
});

describe('the two-compound warning', () => {
  /** Late in the race on the one dry compound, alone on the road, no stop booked. */
  function lateOnOneCompound(model: RaceModel): { race: RaceState; model: RaceModel } {
    const m: RaceModel = { ...model, decisionMoments: [] };
    const s = session(m);
    const race = structuredClone(s.state.race);
    race.lap = m.race.laps - 5;
    race.flag = 'green';
    race.nextFlag = 'green';
    const me = race.cars[m.userSide];
    if (!me) throw new Error('no car');
    me.compoundsUsed = [me.compound];
    me.strategy = [];
    me.tyreAge = 12;
    me.tyreWear = 1;
    let gap = 100;
    for (const [code, car] of Object.entries(race.cars)) {
      if (code === m.userSide) continue;
      car.totalTime = me.totalTime + gap;
      gap += 100;
    }
    return { race, model: m };
  }
  const warning = (model: RaceModel) => {
    const { race, model: m } = lateOnOneCompound(model);
    const call = directorCall(race, m, engineerConfig(m), [], [], [1], newMemory(), false);
    return call?.text.includes('second tyre compound') ?? false;
  };

  it('warns in a race with the rule (today’s races, 2007 on)', () => {
    expect(warning(abu)).toBe(true);
    expect(warning(tagged('1994-2009', RULES_2007))).toBe(true);
  });

  it('is off before 2007 (no rule in the race)', () => {
    expect(warning(MODEL_2005)).toBe(false);
    expect(warning(tagged('1994-2009', { twoCompound: false }))).toBe(false);
  });

  it('is off in the plan editor too', () => {
    const car = { compound: 'HARD', compoundsUsed: ['HARD'] };
    const plan = { id: 'own' as const, stops: [{ lap: 40, compound: 'HARD' }], pace: [] };
    expect(twoCompounds(car, plan as never)).toBe(false);
    expect(twoCompounds(car, plan as never, abu.rules)).toBe(false);
    expect(twoCompounds(car, plan as never, { twoCompound: false })).toBe(true);
    const editor = (model: RaceModel) =>
      renderToStaticMarkup(
        createElement(PlanEditor, {
          model,
          from: 30,
          car,
          value: {
            id: 'own',
            stops: [{ lap: 40, compound: 'HARD' }],
            pace: ['standard', 'standard'],
          },
          onChange: () => {},
        }),
      );
    expect(editor(abu)).toContain('Two dry compounds are compulsory');
    expect(editor(tagged('1994-2009', { twoCompound: false }))).not.toContain(
      'Two dry compounds are compulsory',
    );
  });
});

describe('the 2005 tyre lock', () => {
  const locked = raceScreenEra(MODEL_2005).lockedTyre as string;

  it('offers only the locked dry set (and wet tyres) on the pit buttons, and says why', () => {
    const html = teamRadio(session(MODEL_2005).state.race, MODEL_2005);
    expect(html).toContain('No tyre changes this year');
    expect(html).toContain('>Dry</button>');
    const dry = Object.keys(MODEL_2005.compounds).filter(
      (c) => c !== 'INTERMEDIATE' && c !== 'WET',
    );
    expect(dry.length).toBeGreaterThan(1);
    expect(html.match(/>Dry<\/button>/g)).toHaveLength(1);
    // Today's race offers every compound, no notice.
    const today = teamRadio(session(abu).state.race, abu);
    expect(today).not.toContain('No tyre changes');
    for (const c of dry) expect(today).toContain(`tyre ${c} bg-[var(--tarmac)]`);
  });

  it('shows the dry tyre as one "D", with a padlock', () => {
    const badge = (model: RaceModel | null, compound: string) => {
      const look = model ? raceScreenEra(model) : TODAY_LOOK;
      return renderToStaticMarkup(
        createElement(
          RaceEraContext.Provider,
          { value: look },
          createElement(TyreBadge, { compound, age: 7 }),
        ),
      );
    };
    expect(badge(MODEL_2005, locked)).toContain('class="tyre DRY"');
    expect(badge(MODEL_2005, locked)).toContain('Tyres locked');
    expect(badge(MODEL_2005, 'INTERMEDIATE')).toContain('class="tyre INTERMEDIATE"');
    expect(badge(MODEL_2005, 'INTERMEDIATE')).not.toContain('Tyres locked');
    // Before 2007 with tyre changes (1988): one dry tyre, no lock.
    const y1988 = tagged('1988-1993', { twoCompound: false });
    expect(badge(y1988, 'HARD')).toContain('class="tyre DRY"');
    expect(badge(y1988, 'HARD')).not.toContain('Tyres locked');
    // Outside Eras, as before.
    expect(badge(null, 'HARD')).toBe(
      renderToStaticMarkup(createElement(TyreBadge, { compound: 'HARD', age: 7 })),
    );
    expect(badge(abu, 'HARD')).toContain('class="tyre HARD"');
  });

  it('keeps the set on a stop the plan or the wall calls for another tyre', () => {
    const s = session(MODEL_2005);
    const lap = s.state.race.lap + 1;
    const other = Object.keys(MODEL_2005.compounds).find((c) => c !== locked) as string;
    expect(() => s.call({ lap, kind: 'pit', compound: other }, { asked: true })).not.toThrow();
    const pit = s.state.decisions.find((d) => d.kind === 'pit' && d.lap === lap);
    expect(pit).toMatchObject({ kind: 'pit', compound: locked });
  });

  it('lets the plan editor pick only the locked set', () => {
    const html = renderToStaticMarkup(
      createElement(PlanEditor, {
        model: MODEL_2005,
        from: 30,
        car: { compound: locked, compoundsUsed: [locked] },
        value: {
          id: 'own',
          stops: [{ lap: 40, compound: locked }],
          pace: ['standard', 'standard'],
        },
        onChange: () => {},
      }),
    );
    const picks = [...html.matchAll(/aria-label="(softs|mediums|hards)"/g)].map((m) => m[1]);
    expect(picks).toHaveLength(1);
  });
});

describe('the pit lane closed under the SC (2007-08)', () => {
  const MODEL_2007 = tagged('1994-2009', RULES_2007, 5);
  const scOut = (model: RaceModel, flag: 'green' | 'sc' = 'green'): RaceState => {
    const race = structuredClone(session(model).state.race);
    race.flag = flag;
    race.nextFlag = 'sc';
    return race;
  };

  it('shows the notice and the stop-go cost on the pit options as the SC comes out', () => {
    const html = teamRadio(scOut(MODEL_2007), MODEL_2007);
    const cost = Math.round(closedPitCost(MODEL_2007));
    expect(html).toContain('Pit lane closed');
    expect(html).toContain('10-second stop-go');
    expect(html).toContain(`+${cost}s</span>`);
    expect(cost).toBe(Math.round(MODEL_2007.track.pitLoss + 10));
  });

  it('puts the cost on the safety-car call’s box option', () => {
    const race = scOut(MODEL_2007);
    const me = race.cars[MODEL_2007.userSide];
    if (!me) throw new Error('no car');
    me.tyreAge = 10;
    me.strategy = [];
    const m = { ...MODEL_2007, decisionMoments: [] };
    const call = safetyCarCall(race, m);
    expect(call?.options[0]?.note).toContain('Pit lane closed: stop-go');
    expect(call?.text).toContain('closed');
    expect(safetyCarCall(race, { ...abu, decisionMoments: [] })?.options[0]?.note).toBeUndefined();
  });

  it('is gone once the field is queued, and never shown without the rule', () => {
    expect(teamRadio(scOut(MODEL_2007, 'sc'), MODEL_2007)).not.toContain('Pit lane closed');
    expect(teamRadio(scOut(abu), abu)).not.toContain('Pit lane closed');
    expect(teamRadio(scOut(tagged('1994-2009', RULES_2005)), MODEL_2005)).not.toContain(
      'Pit lane closed',
    );
  });
});

describe('pit-board prompts (Eras 1-2)', () => {
  const call: QuickCall = {
    lap: 30,
    from: 'Engineer',
    kind: 'quick',
    text: '20 laps to go. How do we run it?',
    options: [
      { id: 'push', label: 'Push', call: null },
      { id: 'steady', label: 'Steady', call: null },
    ],
  };
  const card = (model: RaceModel) =>
    renderToStaticMarkup(
      createElement(
        RaceEraContext.Provider,
        { value: raceScreenEra(model) },
        createElement(QuickCallCard, { call, ms: 8000, onAnswer: () => {}, onTimeout: () => {} }),
      ),
    );

  it('shows a quick call as a pit-board message in Eras 1 and 2, with the same words', () => {
    for (const id of [1, 2]) {
      const html = card(tagged('1988-1993', { twoCompound: false }, id));
      expect(html).toContain('pit-board');
      expect(html).toContain('Pit board');
      expect(html).not.toContain('quick call');
      expect(html).toContain(call.text);
      expect(html).toContain('>Push<');
      expect(html).toContain('>Steady<');
    }
  });

  it('keeps team radio from Era 3, and outside Eras', () => {
    expect(card(tagged('1994-2009', undefined, 3))).not.toContain('pit-board');
    expect(card(abu)).not.toContain('Pit board');
    expect(card(abu)).toContain('Engineer · quick call');
  });

  it('puts the big call on the pit board in the race screen', () => {
    const model = tagged('2014-2025', undefined, 2);
    const html = screen(session(model, 'decision'), model);
    expect(html).toContain('decision call-plate pit-board');
    expect(html).toContain('Pit board · ');
    const today = screen(session(abu, 'decision'), abu);
    expect(today).toContain('Engineer · ');
    expect(today).not.toContain('pit-board');
  });
});

describe('the refuelling controls', () => {
  const reading: RefuelReading = {
    lapsOfFuel: 17.6,
    nextStopLap: 41,
    level: 0.55,
    fills: [
      { fill: 'long', laps: 26, seconds: 9.8 },
      { fill: 'short', laps: 12, seconds: 4.6 },
      { fill: 'standard', laps: 19, seconds: 7.1 },
    ],
  };

  it('offers the fills short first, the chosen one pressed', () => {
    const html = renderToStaticMarkup(
      createElement(FuelFillChoice, {
        reading,
        value: 'standard',
        disabled: false,
        onPick: () => {},
      }),
    );
    expect(html).toContain('aria-label="Fuel fill"');
    const order = [...html.matchAll(/<span>(Short|Standard|Long)<\/span>/g)].map((m) => m[1]);
    expect(order).toEqual(['Short', 'Standard', 'Long']);
    expect(html).toContain('12 laps · 4.6s');
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-pressed="true"[^>]*><span>Standard/);
  });

  it('draws nothing without fills', () => {
    const html = renderToStaticMarkup(
      createElement(FuelFillChoice, {
        reading: { ...reading, fills: [] },
        value: 'standard',
        disabled: false,
        onPick: () => {},
      }),
    );
    expect(html).toBe('');
  });

  it('gauges the fuel to the next stop, or to the flag', () => {
    const html = renderToStaticMarkup(createElement(FuelGauge, { reading }));
    expect(html).toContain('aria-label="Fuel to lap 41"');
    expect(html).toContain('aria-valuenow="55"');
    expect(html).toContain('17 laps · to lap 41');
    const flag = renderToStaticMarkup(
      createElement(FuelGauge, { reading: { ...reading, nextStopLap: null } }),
    );
    expect(flag).toContain('to the flag');
  });

  it('stays hidden in a refuelling race until the refuelling model is connected', () => {
    const refuels = tagged('2014-2025', { refuelling: true });
    const race = session(abu).state.race;
    expect(teamRadio(race, refuels)).toBe(teamRadio(race, abu));
    expect(teamRadio(race, refuels)).not.toContain('Fuel fill');
  });
});

describe('a race without rules or an era', () => {
  /** Today's rules spelt out: every default, and the era block's DRS and battery. */
  const explicit: RaceRules = {
    twoCompound: true,
    tyreChanges: true,
    refuelling: false,
    pitLaneClosedUnderSC: false,
    vsc: true,
    drs: true,
    ers: 'hybrid',
  };

  it('renders the race screen byte for byte as with its defaults written out', () => {
    for (const to of ['racing', 'decision'] as const) {
      const html = screen(session(abu, to), abu);
      for (const model of [
        { ...abu, rules: {} },
        { ...abu, rules: explicit },
        tagged('2014-2025', undefined, 10),
      ]) {
        expect(screen(session(model, to), model)).toBe(html);
      }
    }
  });

  it('renders the team radio identically', () => {
    const race = session(abu).state.race;
    expect(teamRadio(race, { ...abu, rules: explicit })).toBe(teamRadio(race, abu));
  });
});

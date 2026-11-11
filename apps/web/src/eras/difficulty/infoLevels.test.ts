// The information levels on every place a gap or a tyre age shows (eras spec §7, decided
// Nov 7): the standings, the leaders, the driver card, the car stats, the big call and the
// engineer's radio; and the era's decision timer on quick calls and battles. Rendered to
// markup from a real Daily session with the field staged at known gaps and tyre ages (the web
// tests run in node: effects don't run, so the countdown itself is tested in countdown.test.ts).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type DifficultySettings,
  type InformationLevel,
  type RaceModel,
  type RaceState,
  difficultyFor,
  engineerConfig,
  legendDifficulty,
} from '@laststint/sim';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it } from 'vitest';
import { BattleCard } from '../../components/BattleCard.js';
import { BroadcastDecision } from '../../components/BroadcastDecision.js';
import { CarStats } from '../../components/CarStats.js';
import { DriverCard } from '../../components/DriverCard.js';
import { LeadersTower } from '../../components/LeadersTower.js';
import { QuickCallCard } from '../../components/QuickCallCard.js';
import { TimingTower } from '../../components/TimingTower.js';
import { StaticDailyProvider } from '../../data/provider.js';
import type { Daily } from '../../data/types.js';
import { GameEngine } from '../../engine/engine.js';
import { directorCall, infoLine, newMemory } from '../../game/engineerCalls.js';
import { type QuickCall, quickCallAt, quickCallLaps } from '../../game/quickCalls.js';
import { RaceLog } from '../../game/raceLog.js';
import type { Game } from '../../game/useGame.js';
import { RaceScreen } from '../../screens/RaceScreen.js';
import { GameSession } from '../../state/session.js';
import { overtakingCorners } from '../../track/corners.js';
import { outlineFor } from '../../track/outlines.js';
import { erasCallTimer, holdsForQuickCall } from './callTimer.js';
import type { ErasRace } from './erasRace.js';
import { FULL_INFORMATION, type InformationView, informationView } from './information.js';

const LEVELS: InformationLevel[] = ['full', 'reduced', 'limited', 'minimal'];

let daily: Daily;
let model: RaceModel;
beforeAll(async () => {
  daily = await new StaticDailyProvider().today();
  model = daily.model;
});

/** Seconds behind the leader, by place. */
const GAPS = [0, 1.23, 3.37, 4.12, 6.81];
const gapAt = (i: number) => GAPS[i] ?? i * 1.37 + 0.11;
/** Every other car's tyres are 17 laps old; yours, 9. */
const THEIR_AGE = 17;
const MY_AGE = 9;

/**
 * The Daily a few laps in, its field restaged: `beside` puts the rival directly ahead of you
 * (P2, you P3); `apart` puts another car between you (rival P2, you P4). Green flag, all
 * running, tyres fresh enough that nobody asks about them.
 */
function staged(layout: 'beside' | 'apart'): { race: RaceState; me: string; rival: string } {
  const s = new GameSession(daily);
  s.start();
  s.pickPlan('a');
  for (let i = 0; i < 3 && s.state.phase === 'racing'; i++) s.tick();
  const race = structuredClone(s.state.race);
  const me = model.userSide;
  const rival = model.rival;
  const others = race.order.filter((c) => c !== me && c !== rival);
  const order =
    layout === 'beside'
      ? [others[0], rival, me, ...others.slice(1)]
      : [others[0], rival, others[1], me, ...others.slice(2)];
  race.order = order as string[];
  const base = 1000;
  race.order.forEach((code, i) => {
    const car = race.cars[code];
    if (!car) throw new Error(`fixture: no car ${code}`);
    car.retired = false;
    car.totalTime = base + gapAt(i);
    car.tyreAge = code === me ? MY_AGE : THEIR_AGE;
    car.tyreWear = 1;
  });
  race.flag = 'green';
  race.nextFlag = 'green';
  return { race, me, rival };
}

const view = (level: InformationLevel) => informationView(level);
const strip = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** The standings' rows: code, tyre age and the gap column. */
function towerRows(html: string): Record<string, { age: string; text: string }> {
  const rows: Record<string, { age: string; text: string }> = {};
  for (const li of html.split('<li>').slice(1)) {
    const code = li.match(/leading-none">([^<]+)</)?.[1] ?? '';
    const age = li.match(/text-\[11px\] text-\[var\(--muted\)\]">([^<]*)</)?.[1] ?? '';
    // (The place and the gap share a style: the gap is the last.)
    const cells = [...li.matchAll(/text-right text-\[12px\] text-\[var\(--muted\)\]">([^<]*)</g)];
    const text = cells.at(-1)?.[1] ?? '';
    rows[code] = { age, text };
  }
  return rows;
}

/** The leaders' rows: code and the gap column. */
function leaderRows(html: string): Record<string, string> {
  const rows: Record<string, string> = {};
  for (const li of html.split('<li>').slice(1)) {
    const code = li.match(/font-extrabold">([^<]+)</)?.[1] ?? '';
    rows[code] = li.match(/text-\[#C9CFCC\]">([^<]*)</)?.[1] ?? '';
  }
  return rows;
}

/** A card's facts, label to value (as text). */
function facts(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of html.matchAll(/<dt[^>]*>([^<]*)<\/dt><dd[^>]*>(.*?)<\/dd>/g))
    out[m[1] as string] = strip(m[2] as string);
  return out;
}

describe('the standings (TimingTower) at each level', () => {
  const tower = (level: InformationLevel, layout: 'beside' | 'apart' = 'beside') => {
    const { race, me, rival } = staged(layout);
    const html = renderToStaticMarkup(
      createElement(TimingTower, {
        race,
        model,
        userSide: me,
        rival,
        info: view(level),
      }),
    );
    return { rows: towerRows(html), race, me, rival };
  };

  it('Full: exact gaps to the leader and exact tyre ages', () => {
    const { rows, race, me, rival } = tower('full');
    expect(rows[race.order[0] as string]?.text).toBe('LEADER');
    expect(rows[rival]).toEqual({ age: '17', text: '+1.2' });
    expect(rows[me]).toEqual({ age: '9', text: '+3.4' });
    expect(rows[race.order[3] as string]).toEqual({ age: '17', text: '+4.1' });
  });

  it('Reduced: exact gaps; every other car’s tyre age as a 5-lap range, yours exact', () => {
    const { rows, race, me, rival } = tower('reduced');
    expect(rows[rival]).toEqual({ age: '15–20', text: '+1.2' });
    expect(rows[me]).toEqual({ age: '9', text: '+3.4' });
    for (const code of race.order) if (code !== me) expect(rows[code]?.age).toBe('15–20');
  });

  it('Limited: as Reduced, gaps to the leader rounded to 0.5 s', () => {
    const { rows, me, rival, race } = tower('limited');
    expect(rows[rival]).toEqual({ age: '15–20', text: '+1.0' });
    expect(rows[me]).toEqual({ age: '9', text: '+3.5' });
    expect(rows[race.order[3] as string]?.text).toBe('+4.0');
    for (const code of race.order.slice(1)) {
      const g = Number(rows[code]?.text.slice(1));
      expect(g * 2).toBe(Math.round(g * 2));
    }
  });

  it('Minimal: as Limited, only your interval to the car ahead and the car behind’s to you', () => {
    const { rows, race, me, rival } = tower('minimal');
    expect(rows[race.order[0] as string]?.text).toBe('LEADER');
    // You P3: 3.37 − 1.23 = 2.14 → 2.0; the car behind: 4.12 − 3.37 = 0.75 → 1.0.
    expect(rows[me]).toEqual({ age: '9', text: '+2.0' });
    expect(rows[race.order[3] as string]).toEqual({ age: '15–20', text: '+1.0' });
    expect(rows[rival]).toEqual({ age: '15–20', text: '' });
    for (const code of race.order.slice(4)) expect(rows[code]?.text).toBe('');
  });

  it('Minimal follows the cars either side of you, wherever the rival is', () => {
    const { rows, race, me, rival } = tower('minimal', 'apart');
    // You P4: 4.12 − 3.37 = 0.75 → 1.0 to the car ahead (not the rival).
    expect(rows[me]?.text).toBe('+1.0');
    expect(rows[rival]?.text).toBe('');
    expect(rows[race.order[2] as string]?.text).toBe('');
    expect(rows[race.order[4] as string]?.text).toBe('+2.5'); // 6.81 − 4.12 = 2.69
  });
});

describe('the race screen passes the level on', () => {
  it('to the leaders beside the map', () => {
    const s = new GameSession(daily);
    s.start();
    s.pickPlan('a');
    for (let i = 0; i < 3 && s.state.phase === 'racing'; i++) s.tick();
    const { race } = staged('apart');
    const state = { ...s.state, race };
    const game = {
      state,
      model,
      clock: null,
      notes: () => s.notes,
      preview: () => s.previewLap(),
      setPace: () => {},
    } as unknown as Game;
    const leaders = (level?: InformationLevel) => {
      const eras: ErasRace | undefined = level
        ? { difficulty: { ...difficultyFor(1), information: level }, attemptId: 'att' }
        : undefined;
      const html = renderToStaticMarkup(createElement(RaceScreen, { game, state, model, eras }));
      const tower = html.match(/<section aria-label="Leaders".*?<\/section>/)?.[0] ?? '';
      return leaderRows(tower);
    };
    expect(leaders()[model.rival]).toBe('+1.2');
    expect(leaders('full')).toEqual(leaders());
    expect(leaders('limited')[model.rival]).toBe('+1.0');
    expect(leaders('minimal')[model.rival]).toBe('');
    expect(leaders('minimal')[model.userSide]).toBe('+1.0');
  });
});

describe('the leaders (LeadersTower) at each level', () => {
  const leaders = (level: InformationLevel) => {
    const { race, me, rival } = staged('beside');
    const html = renderToStaticMarkup(
      createElement(LeadersTower, {
        race,
        model,
        userSide: me,
        rival,
        live: null,
        onPick: () => {},
        info: view(level),
      }),
    );
    return { rows: leaderRows(html), race, me, rival };
  };

  it('Full and Reduced: exact gaps', () => {
    for (const level of ['full', 'reduced'] as const) {
      const { rows, race, me, rival } = leaders(level);
      expect(rows[race.order[0] as string]).toBe('Leader');
      expect(rows[rival]).toBe('+1.2');
      expect(rows[me]).toBe('+3.4');
    }
  });

  it('Limited: gaps rounded to 0.5 s', () => {
    const { rows, me, rival, race } = leaders('limited');
    expect(rows[rival]).toBe('+1.0');
    expect(rows[me]).toBe('+3.5');
    expect(rows[race.order[4] as string]).toBe('+7.0'); // 6.81
  });

  it('Minimal: only the intervals either side of you', () => {
    const { rows, race, me, rival } = leaders('minimal');
    expect(rows[me]).toBe('+2.0');
    expect(rows[race.order[3] as string]).toBe('+1.0');
    expect(rows[rival]).toBe('');
    expect(rows[race.order[4] as string]).toBe('');
  });
});

describe('the driver card at each level', () => {
  const card = (level: InformationLevel, which: 'rival' | 'me' | 'far') => {
    const { race, me, rival } = staged('beside');
    const code = which === 'rival' ? rival : which === 'me' ? me : (race.order[5] as string);
    const html = renderToStaticMarkup(
      createElement(DriverCard, {
        code,
        race,
        model,
        log: [],
        userSide: me,
        rival,
        onClose: () => {},
        info: view(level),
      }),
    );
    return facts(html);
  };

  it('Full: exact gaps and tyre age', () => {
    const f = card('full', 'rival');
    expect(f['To leader']).toBe('+1.2s');
    expect(f['To you']).toBe('−2.1s');
    expect(f.Tyres).toContain('17');
  });

  it('Reduced: the other car’s tyre age as a range; yours exact', () => {
    const f = card('reduced', 'rival');
    expect(f['To leader']).toBe('+1.2s');
    expect(f['To you']).toBe('−2.1s');
    expect(f.Tyres).toContain('15–20');
    expect(card('reduced', 'me').Tyres).toContain('9');
    expect(card('reduced', 'me').Tyres).not.toContain('–');
  });

  it('Limited: gaps rounded to 0.5 s', () => {
    const f = card('limited', 'rival');
    expect(f['To leader']).toBe('+1.0s');
    expect(f['To you']).toBe('−2.0s');
    expect(f.Tyres).toContain('15–20');
    expect(card('limited', 'me')['To leader']).toBe('+3.5s');
  });

  it('Minimal: no gap to the leader; the gap to you only beside you', () => {
    const f = card('minimal', 'rival');
    expect(f['To leader']).toBe('-');
    expect(f['To you']).toBe('−2.0s');
    expect(card('minimal', 'far')['To you']).toBe('-');
    expect(card('limited', 'far')['To you']).not.toBe('-');
    expect(card('minimal', 'me')['To leader']).toBe('-');
  });
});

describe('the car stats at each level', () => {
  const gap = (level: InformationLevel, layout: 'beside' | 'apart' = 'beside') => {
    const { race, me, rival } = staged(layout);
    const html = renderToStaticMarkup(
      createElement(CarStats, { race, model, log: [], userSide: me, rival, info: view(level) }),
    );
    return { f: facts(html), html };
  };

  it('Full and Reduced: the exact gap; your own tyre age exact', () => {
    for (const level of ['full', 'reduced'] as const) {
      const { f, html } = gap(level);
      expect(f.Gap).toBe('−2.1s');
      expect(html).toContain(`>${MY_AGE}</span>`);
    }
  });

  it('Limited: the gap rounded to 0.5 s', () => {
    expect(gap('limited').f.Gap).toBe('−2.0s');
  });

  it('Minimal: the gap only when the rival is directly ahead or behind', () => {
    expect(gap('minimal').f.Gap).toBe('−2.0s');
    expect(gap('minimal', 'apart').f.Gap).toBe('-');
    expect(gap('limited', 'apart').f.Gap).not.toBe('-');
  });
});

describe('the big call: the rival’s tyre age', () => {
  it('is exact at Full and a 5-lap range from Reduced down', () => {
    const s = new GameSession(daily);
    s.start();
    s.pickPlan('a');
    for (let i = 0; i < 300 && s.state.phase === 'racing'; i++) s.tick();
    const moment = s.state.currentMoment;
    if (!moment) throw new Error('no moment');
    const rival = s.state.race.cars[model.rival];
    if (!rival) throw new Error('no rival');
    const age = rival.tyreAge;
    const lo = Math.floor(age / 5) * 5;
    const card = (info: InformationView) =>
      facts(
        renderToStaticMarkup(
          createElement(BroadcastDecision, {
            moment,
            race: s.state.race,
            model,
            onChoose: () => {},
            info,
          }),
        ),
      );
    const label = Object.keys(card(FULL_INFORMATION)).find(
      (k) => k !== 'Tyres' && card(FULL_INFORMATION)[k]?.match(/ · \d+$/),
    );
    if (!label) throw new Error('no rival tyre fact');
    expect(card(FULL_INFORMATION)[label]).toMatch(new RegExp(` · ${age}$`));
    for (const level of ['reduced', 'limited', 'minimal'] as const)
      expect(card(view(level))[label]).toMatch(new RegExp(` · ${lo}–${lo + 5}$`));
    // Your own tyres stay exact at every level.
    const mine = card(FULL_INFORMATION).Tyres;
    expect(card(view('minimal')).Tyres).toBe(mine);
  });
});

describe('the engineer’s radio: info lines at each level', () => {
  const line = (level: InformationLevel, layout: 'beside' | 'apart') => {
    const { race } = staged(layout);
    return infoLine(race, model, [], view(level));
  };
  const left = () => model.race.laps - staged('beside').race.lap;

  it('Full and Reduced: the exact gap to the rival', () => {
    expect(line('full', 'beside')).toBe(
      `Gap to ${model.rival} −2.1 s, ${left()} to go. Keep chipping away.`,
    );
    expect(line('reduced', 'beside')).toBe(line('full', 'beside'));
    expect(infoLine(staged('beside').race, model, [])).toBe(line('full', 'beside'));
  });

  it('Limited: rounded to 0.5 s', () => {
    expect(line('limited', 'beside')).toBe(
      `Gap to ${model.rival} −2.0 s, ${left()} to go. Keep chipping away.`,
    );
  });

  it('Minimal: the rival’s gap beside you; otherwise the cars either side', () => {
    expect(line('minimal', 'beside')).toBe(line('limited', 'beside'));
    const { race } = staged('apart');
    const [, , ahead, , behind] = race.order;
    // P4: 4.12 − 3.37 = 0.75 → 1.0 ahead; 6.81 − 4.12 = 2.69 → 2.5 behind.
    expect(line('minimal', 'apart')).toBe(
      `P4, ${ahead} 1.0 s ahead, ${behind} 2.5 s behind. ${left()} to go.`,
    );
    expect(line('limited', 'apart')).toMatch(/^Gap to /);
  });
});

describe('the engineer’s radio: quick calls at each level', () => {
  /** The rival 12.34 s behind (no tyre worries, no pace log): the "turn it down" call. */
  function clear(layout: 'beside' | 'apart') {
    const { race, me, rival } = staged(layout);
    const t = (race.cars[me] as { totalTime: number }).totalTime;
    (race.cars[rival] as { totalTime: number }).totalTime = t + 12.34;
    race.order = [...race.order.filter((c) => c !== rival)];
    const i = race.order.indexOf(me);
    race.order.splice(layout === 'beside' ? i + 1 : i + 2, 0, rival);
    return race;
  }

  it('says the gap exactly at Full and Reduced, rounded at Limited', () => {
    const text = (level: InformationLevel) =>
      quickCallAt(clear('beside'), model, [], view(level))?.text;
    expect(text('full')).toMatch(new RegExp(`^Gap to ${model.rival} is 12\\.3 s with`));
    expect(text('reduced')).toBe(text('full'));
    expect(quickCallAt(clear('beside'), model, [])?.text).toBe(text('full'));
    expect(text('limited')).toMatch(new RegExp(`^Gap to ${model.rival} is 12\\.5 s with`));
    expect(text('minimal')).toBe(text('limited'));
  });

  it('at Minimal, with the rival not beside you, asks without a gap', () => {
    const call = quickCallAt(clear('apart'), model, [], view('minimal'));
    expect(call?.text).not.toMatch(/\d+\.\d s/);
    expect(quickCallAt(clear('apart'), model, [], view('limited'))?.text).toMatch(/12\.5 s/);
  });
});

describe('the engineer’s radio over a whole race at each level', () => {
  const file = (id: string) =>
    JSON.parse(
      readFileSync(
        join(__dirname, '..', '..', '..', '..', '..', 'data', 'races', `${id}.json`),
        'utf8',
      ),
    ) as RaceModel;

  /** Every director call and info line over a race with no answers, at a level. */
  function radio(m: RaceModel, info: InformationView) {
    const engine = new GameEngine(m, m.race.seed, { decisions: [] });
    const cfg = engineerConfig(m);
    const corners = overtakingCorners(outlineFor(m.race.id));
    const quick = new Set(quickCallLaps(m));
    const memory = newMemory();
    const log = new RaceLog();
    log.see(engine.state);
    const calls: QuickCall[] = [];
    const lines: string[] = [];
    while (!engine.isFinished()) {
      engine.step();
      const events = log.see(engine.state);
      const c = directorCall(
        engine.state,
        m,
        cfg,
        events,
        engine.notes,
        corners,
        memory,
        quick.has(engine.lap),
        false,
        info,
      );
      if (c) calls.push(c);
      const l = infoLine(engine.state, m, events, info);
      if (l) lines.push(l);
    }
    return { calls, lines };
  }

  /** The gaps a line says, in seconds: "1.5 s" and "Gap +1.5" (not lap-time differences:
   * "0.8 s quicker", "0.4 s a lap", "s/lap", which aren't gaps). */
  const halfSeconds = (text: string) =>
    [
      ...text.matchAll(/(\d+\.\d) s(?!\/lap| a lap| quicker| to us)/g),
      ...text.matchAll(/Gap [+−](\d+\.\d)/g),
    ].map((x) => Number(x[1]));

  it.each(['abu-dhabi-2021', 'bahrain-2021'])(
    '%s: battle gaps and tyres, and info-line gaps, follow the level',
    (id) => {
      const m = file(id);
      const full = radio(m, FULL_INFORMATION);
      const battles = (r: ReturnType<typeof radio>) => r.calls.filter((c) => c.kind === 'battle');
      expect(battles(full).length).toBeGreaterThan(0);
      for (const level of LEVELS.slice(1)) {
        const r = radio(m, view(level));
        // The calls are picked from the race as it is: the same battles at every level.
        expect(battles(r).map((c) => [c.lap, c.other])).toEqual(
          battles(full).map((c) => [c.lap, c.other]),
        );
        for (const c of battles(r)) {
          const tyres = c.stats?.find((x) => x.label === 'Tyres')?.value ?? '';
          // Yours exact, the other car's a range.
          expect(tyres).toMatch(/^\S+ \S+ \d+ · \S+ \S+ \d+–\d+$/);
          if (level === 'reduced') continue;
          const gap = c.stats?.find((x) => x.label === 'Gap')?.value ?? '';
          for (const g of [...halfSeconds(gap), ...halfSeconds(c.text), c.gap ?? 0])
            expect(g * 2, `${level}: ${c.text} / ${gap}`).toBeCloseTo(Math.round(g * 2), 9);
        }
        if (level !== 'reduced')
          for (const l of r.lines)
            for (const g of halfSeconds(l))
              expect(g * 2, `${level}: ${l}`).toBeCloseTo(Math.round(g * 2), 9);
      }
      for (const c of battles(full)) {
        const tyres = c.stats?.find((x) => x.label === 'Tyres')?.value ?? '';
        expect(tyres).not.toContain('–');
      }
    },
  );
});

describe('the era’s decision timer on quick calls and battles (decided Nov 7)', () => {
  const eras = (difficulty: DifficultySettings = difficultyFor(1)): ErasRace => ({
    difficulty,
    attemptId: 'att',
  });
  const quick: QuickCall = {
    lap: 12,
    from: 'Engineer',
    kind: 'quick',
    text: 'Push?',
    options: [
      { id: 'push', label: 'Push', call: null },
      { id: 'stay', label: 'Stay steady', call: null },
    ],
  };
  const battle: QuickCall = {
    ...quick,
    kind: 'battle',
    other: 'VER',
    attacking: true,
    gap: 0.8,
    options: [
      { id: 'dive', label: 'Dive up the inside', line: 'inside', call: null },
      { id: 'drs', label: 'Wait for DRS', line: 'wait', call: null },
    ],
  };
  const quickCard = (timer?: ReturnType<typeof erasCallTimer>) =>
    renderToStaticMarkup(
      createElement(QuickCallCard, {
        call: quick,
        ms: 8000,
        onAnswer: () => {},
        onTimeout: () => {},
        eras: timer,
      }),
    );
  const battleCard = (
    stage: 'approach' | 'waiting' | 'move',
    timer?: ReturnType<typeof erasCallTimer>,
  ) =>
    renderToStaticMarkup(
      createElement(BattleCard, {
        call: battle,
        corner: 4,
        stage,
        clock: null,
        fromP: 0.2,
        brakeP: 0.5,
        waitMs: 8000,
        chosen: stage === 'move' ? 'dive' : null,
        result: null,
        onAnswer: () => {},
        eras: timer,
      }),
    );

  it('outside Eras there is no era timer: the cards keep their own', () => {
    expect(erasCallTimer(undefined, true, 'quick-12', () => {})).toBeUndefined();
    expect(quickCard()).toContain('animation-duration:8000ms');
    expect(quickCard()).not.toContain('role="timer"');
    expect(battleCard('waiting')).toContain('animation-duration:8000ms');
  });

  it('a quick call counts down from the era’s timer: 45, 30 and 20 s', () => {
    const cases = [
      [difficultyFor(1), 45],
      [difficultyFor(5), 30],
      [difficultyFor(8), 20],
      [legendDifficulty(), 20],
    ] as const;
    for (const [difficulty, seconds] of cases) {
      const html = quickCard(erasCallTimer(eras(difficulty), true, 'quick-12', () => {}));
      expect(html).toContain('role="timer"');
      expect(html).toContain(`Time to make the call: ${seconds} seconds`);
      // Its own short bar is gone.
      expect(html).not.toContain('quick-timer');
    }
  });

  it('a battle waits at the braking zone on the era’s timer', () => {
    const timer = erasCallTimer(eras(difficultyFor(5)), true, 'battle-12', () => {});
    const waiting = battleCard('waiting', timer);
    expect(waiting).toContain('Time to make the call: 30 seconds');
    expect(waiting).not.toContain('quick-timer');
    // On the approach it's the bar to the braking zone, as ever; no timer yet.
    expect(battleCard('approach', timer)).not.toContain('role="timer"');
    expect(battleCard('approach', timer)).toBe(battleCard('approach'));
    // Called: no timer.
    expect(battleCard('move', timer)).not.toContain('role="timer"');
  });

  it('with the timer turned off, the call shows no countdown at all (it waits)', () => {
    const off = erasCallTimer(eras(), false, 'quick-12', () => {});
    expect(off).toEqual({ timer: null });
    expect(quickCard(off)).not.toContain('role="timer"');
    expect(quickCard(off)).not.toContain('quick-timer');
    expect(battleCard('waiting', off)).not.toContain('quick-timer');
  });

  it('holds the race while a quick call is up in Eras, never outside it', () => {
    expect(holdsForQuickCall(eras(), true, true)).toBe(true);
    expect(holdsForQuickCall(eras(), false, true)).toBe(false);
    expect(holdsForQuickCall(eras(), true, false)).toBe(false);
    expect(holdsForQuickCall(undefined, true, true)).toBe(false);
  });
});

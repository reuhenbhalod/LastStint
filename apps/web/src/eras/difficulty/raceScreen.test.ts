// The race screen with and without an Eras difficulty (build plan 8.6), rendered to markup
// from a real Daily session (the web tests run in node: effects don't run, so the timer's
// clock and the untimed mark are tested in countdown.test.ts and untimed.test.ts).

import { type DifficultySettings, difficultyFor, legendDifficulty } from '@laststint/sim';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { BroadcastDecision } from '../../components/BroadcastDecision.js';
import { StaticDailyProvider } from '../../data/provider.js';
import type { Daily } from '../../data/types.js';
import type { Game } from '../../game/useGame.js';
import { RaceScreen } from '../../screens/RaceScreen.js';
import type { GameState } from '../../state/machine.js';
import { GameSession } from '../../state/session.js';
import { DecisionTimer } from './DecisionTimer.js';
import { Countdown } from './countdown.js';
import type { ErasRace } from './erasRace.js';
import { FULL_INFORMATION, informationView } from './information.js';
import { memoryStorage } from './memoryStorage.test-util.js';
import { setTimerOn } from './settings.js';
import { takeDefault } from './timeout.js';
import { markUntimed } from './untimed.js';

let daily: Daily;
beforeAll(async () => {
  daily = await new StaticDailyProvider().today();
});
beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));
afterEach(() => vi.unstubAllGlobals());

/** A session racing from the Daily's takeover lap, or run on to its first decision. */
function session(to: 'decision' | 'racing'): GameSession {
  const s = new GameSession(daily);
  s.start();
  s.pickPlan('a');
  for (let i = 0; to === 'decision' && i < 300 && s.state.phase === 'racing'; i++) s.tick();
  expect(s.state.phase).toBe(to);
  return s;
}

function render(s: GameSession, eras?: ErasRace, state: GameState = s.state): string {
  const game = {
    state,
    model: daily.model,
    clock: null,
    notes: () => s.notes,
    preview: () => s.previewLap(),
    setPace: () => {},
  } as unknown as Game;
  return renderToStaticMarkup(createElement(RaceScreen, { game, state, model: daily.model, eras }));
}

const eras = (difficulty: DifficultySettings, attemptId = 'att'): ErasRace => ({
  difficulty,
  attemptId,
});
const at = (information: DifficultySettings['information']): ErasRace =>
  eras({ ...difficultyFor(1), information });

/** The header scoreboard's gap (the number between the two drivers). */
const scoreboard = (html: string) =>
  html.match(/rounded bg-\[#1A1F1D\] px-2 py-1 text-\[16px\][^>]*>([^<]*)</)?.[1];

describe('race screen without an Eras difficulty', () => {
  it('has no timer, no timer setting, no untimed badge, and the full gap panel', () => {
    for (const s of [session('decision'), session('racing')]) {
      const html = render(s);
      expect(html).not.toContain('role="timer"');
      expect(html).not.toContain('Timer on');
      expect(html).not.toContain('Timer off');
      expect(html).not.toContain('Untimed');
      expect(html).not.toContain('No gap trace');
      expect(html).toContain('The trace builds as laps go by.');
    }
  });

  it('ignores a turned-off timer setting and an untimed mark (they are Eras only)', () => {
    const s = session('decision');
    const before = render(s);
    setTimerOn(false);
    markUntimed('att');
    expect(render(s)).toBe(before);
  });

  it('draws the decision card as before when no information level is passed', () => {
    const s = session('decision');
    const moment = s.state.currentMoment;
    if (!moment) throw new Error('no moment');
    const props = { moment, race: s.state.race, model: daily.model, onChoose: () => {} };
    expect(renderToStaticMarkup(createElement(BroadcastDecision, props))).toBe(
      renderToStaticMarkup(createElement(BroadcastDecision, { ...props, info: FULL_INFORMATION })),
    );
  });
});

describe('the decision timer', () => {
  it('counts down from the era’s timer on the big call', () => {
    const html = render(session('decision'), eras(difficultyFor(1)));
    expect(html).toContain('role="timer"');
    expect(html).toContain('aria-label="Time to make the call: 45 seconds"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('Timer on');
  });

  it('follows the difficulty: 30 s mid-campaign, 20 s at Legend', () => {
    expect(render(session('decision'), eras(difficultyFor(5)))).toContain('call: 30 seconds');
    expect(render(session('decision'), eras(legendDifficulty()))).toContain('call: 20 seconds');
  });

  it('shows only at a decision, not while the race runs', () => {
    const html = render(session('racing'), eras(difficultyFor(1)));
    expect(html).not.toContain('role="timer"');
    expect(html).toContain('Timer on');
  });

  it('is off when the player turned it off, and the setting says so', () => {
    setTimerOn(false);
    const html = render(session('decision'), eras(difficultyFor(1)));
    expect(html).not.toContain('role="timer"');
    expect(html).toContain('Timer off');
    expect(html).toContain('aria-pressed="false"');
  });

  it('shows the attempt as untimed once it is marked', () => {
    const s = session('decision');
    expect(render(s, eras(difficultyFor(1), 'att-u'))).not.toContain('Untimed');
    markUntimed('att-u');
    expect(render(s, eras(difficultyFor(1), 'att-u'))).toContain('>Untimed<');
  });

  it('takes the default option when it runs out: staying out', () => {
    const s = session('decision');
    const moment = s.state.currentMoment;
    if (!moment) throw new Error('no moment');
    const stay = moment.options.find((o) => o.decisions.length === 0);
    expect(stay).toBeDefined();
    const game = { radio: (t: string) => s.radio(t), choose: (id: string) => s.choose(id) };
    expect(takeDefault(game, moment, s.state.race.cars[daily.model.userSide]?.modes)).toBe(
      stay?.id,
    );
    expect(s.state.resolved).toContain(moment.id);
    expect(s.state.phase).not.toBe('decision');
    expect(s.state.radio.some((m) => m.text.startsWith('Out of time'))).toBe(true);
  });
});

describe('DecisionTimer', () => {
  it('shows the seconds as a number, labelled, with a screen reader line', () => {
    const html = renderToStaticMarkup(
      createElement(DecisionTimer, { momentKey: 'k:1', seconds: 45, onExpire: () => {} }),
    );
    expect(html).toContain('role="timer"');
    expect(html).toMatch(/>Time<.*>45<.*>s</);
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('motion-reduce:transition-none');
    expect(html).toContain('aria-hidden="true"'); // the bar is decoration
  });

  it('turns urgent in words, not colour alone, with 10 s or less', () => {
    vi.useFakeTimers();
    try {
      const c = new Countdown({
        key: 'k:urgent',
        seconds: 20,
        onTick: () => {},
        onExpire: () => {},
        now: Date.now,
      });
      c.start();
      vi.advanceTimersByTime(12_000);
      c.stop();
    } finally {
      vi.useRealTimers();
    }
    const html = renderToStaticMarkup(
      createElement(DecisionTimer, { momentKey: 'k:urgent', seconds: 20, onExpire: () => {} }),
    );
    expect(html).toMatch(/>Hurry<.*>8</);
  });
});

describe('information levels on the race screen', () => {
  it('Full shows the gap trace and the exact gap', () => {
    const s = session('racing');
    const html = render(s, at('full'));
    expect(html).not.toContain('No gap trace');
    expect(scoreboard(html)).toBe(scoreboard(render(s)));
  });

  it('Reduced drops the gap trace and keeps the exact gap', () => {
    const s = session('racing');
    const html = render(s, at('reduced'));
    expect(html).toContain('No gap trace at this difficulty.');
    expect(html).not.toContain('The trace builds');
    expect(scoreboard(html)).toBe(scoreboard(render(s)));
  });

  it('Limited rounds the gap to 0.5 s', () => {
    const s = session('racing');
    const { userSide, rival } = s.state.meta;
    const gapNow = () => {
      const me = s.state.race.cars[userSide];
      const them = s.state.race.cars[rival];
      if (!me || !them) throw new Error('no cars');
      return them.totalTime - me.totalTime;
    };
    // Run on (answering any call) to a lap whose exact gap shows differently rounded.
    const off = () => Math.abs(gapNow() - Math.round(gapNow() * 2) / 2) > 0.05;
    for (let i = 0; i < 60 && !off(); i++) {
      const m = s.state.currentMoment;
      if (s.state.phase === 'decision' && m) s.choose(m.options[0]?.id as string);
      else if (s.state.phase === 'racing') s.tick();
      else break;
    }
    expect(off()).toBe(true);
    const rounded = Math.round(gapNow() * 2) / 2;
    const html = render(s, at('limited'));
    expect(html).toContain('No gap trace at this difficulty.');
    expect(scoreboard(html)).toBe(`${rounded >= 0 ? '+' : '−'}${Math.abs(rounded).toFixed(1)}`);
    expect(scoreboard(html)).not.toBe(scoreboard(render(s)));
  });

  it('Minimal shows only the cars either side, and the rival’s gap only when he is one', () => {
    const s = session('racing');
    const { userSide, rival } = s.state.meta;
    const html = render(s, at('minimal'));
    expect(html).toContain('Only the cars either side of you are timed, once a lap.');
    expect(html).toContain('Ahead');
    expect(html).toContain('Behind');
    // Put another car between your car and the rival: his gap is no longer shown.
    const others = s.state.race.order.filter((c) => c !== userSide && c !== rival);
    const apart = {
      ...s.state,
      race: {
        ...s.state.race,
        order: [userSide, ...others.slice(0, 2), rival, ...others.slice(2)],
      },
    };
    expect(scoreboard(render(s, at('minimal'), apart))).toBe('-');
    expect(scoreboard(render(s, at('limited'), apart))).not.toBe('-');
    const beside = {
      ...s.state,
      race: { ...s.state.race, order: [userSide, rival, ...others] },
    };
    expect(scoreboard(render(s, at('minimal'), beside))).not.toBe('-');
  });

  it('Minimal leaves the rival’s gap off the decision card when he isn’t beside you', () => {
    const s = session('decision');
    const moment = s.state.currentMoment;
    if (!moment) throw new Error('no moment');
    const { userSide, rival } = s.state.meta;
    const others = s.state.race.order.filter((c) => c !== userSide && c !== rival);
    const race = {
      ...s.state.race,
      order: [userSide, others[0] as string, rival, ...others.slice(1)],
    };
    const card = (level: DifficultySettings['information']) =>
      renderToStaticMarkup(
        createElement(BroadcastDecision, {
          moment,
          race,
          model: daily.model,
          onChoose: () => {},
          info: informationView(level),
        }),
      );
    expect(card('full')).toContain('>Gap<');
    expect(card('minimal')).not.toContain('>Gap<');
  });
});

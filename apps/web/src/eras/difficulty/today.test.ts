// Without an Eras difficulty, the standings, the leaders, the driver card, the car stats, the
// quick-call and battle cards, the big call and the engineer's radio are exactly what they were
// before the information levels reached them (build plan 8.6). Each digest below was taken
// from the code as it stood before that change, over real races and sessions; any change to
// what these render outside Eras changes a digest.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type RaceModel, engineerConfig } from '@laststint/sim';
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
import { quickCallLaps } from '../../game/quickCalls.js';
import { RaceLog } from '../../game/raceLog.js';
import type { Game } from '../../game/useGame.js';
import { RaceScreen } from '../../screens/RaceScreen.js';
import { GameSession } from '../../state/session.js';
import { overtakingCorners } from '../../track/corners.js';
import { outlineFor } from '../../track/outlines.js';

const digest = (parts: string[]) =>
  createHash('sha256').update(parts.join('\n---\n')).digest('hex').slice(0, 16);

/**
 * Rendered markup as the digests take it: with its `aria-*` and `id` attributes left out, so an
 * accessibility-only edit (a name, a description and the ids it points at) leaves a digest as it
 * was. Everything else (elements, text, classes, styles, every other attribute) still counts, so
 * any change to what a player sees outside Eras still changes a digest.
 */
const markup = (html: string) => html.replace(/\s(?:aria-[\w-]+|id)="[^"]*"/g, '');
const digestMarkup = (parts: string[]) => digest(parts.map(markup));

let daily: Daily;
beforeAll(async () => {
  daily = await new StaticDailyProvider().today();
});

/** The Daily's race state at its takeover, a few laps on, and at its first big call. */
function sessions(): GameSession[] {
  const out: GameSession[] = [];
  for (const laps of [0, 4, 300]) {
    const s = new GameSession(daily);
    s.start();
    s.pickPlan('a');
    for (let i = 0; i < laps && s.state.phase === 'racing'; i++) s.tick();
    out.push(s);
  }
  return out;
}

const raceFile = (id: string) =>
  JSON.parse(
    readFileSync(
      join(__dirname, '..', '..', '..', '..', '..', 'data', 'races', `${id}.json`),
      'utf8',
    ),
  ) as RaceModel;

/** Every call the director makes and every info line, over a whole race with no answers. */
function radio(model: RaceModel): string[] {
  const engine = new GameEngine(model, model.race.seed, { decisions: [] });
  const cfg = engineerConfig(model);
  const corners = overtakingCorners(outlineFor(model.race.id));
  const quick = new Set(quickCallLaps(model));
  const memory = newMemory();
  const log = new RaceLog();
  log.see(engine.state);
  const out: string[] = [];
  while (!engine.isFinished()) {
    engine.step();
    const events = log.see(engine.state);
    const lap = engine.lap;
    const call = directorCall(
      engine.state,
      model,
      cfg,
      events,
      engine.notes,
      corners,
      memory,
      quick.has(lap),
    );
    out.push(JSON.stringify(call));
    out.push(String(infoLine(engine.state, model, events)));
  }
  return out;
}

const RADIO_RACES = ['abu-dhabi-2021', 'bahrain-2021', 'austria-2019'];

describe('outside Eras, byte-identical to before the information levels', () => {
  it('the standings, leaders, driver card and car stats', () => {
    const towers: string[] = [];
    const leaders: string[] = [];
    const cards: string[] = [];
    const stats: string[] = [];
    for (const s of sessions()) {
      const race = s.state.race;
      const { userSide, rival } = s.state.meta;
      const log = new RaceLog().see(race);
      const base = { race, model: daily.model, userSide, rival };
      towers.push(renderToStaticMarkup(createElement(TimingTower, base)));
      leaders.push(
        renderToStaticMarkup(
          createElement(LeadersTower, { ...base, live: null, onPick: () => {} }),
        ),
      );
      for (const code of race.order)
        cards.push(
          renderToStaticMarkup(
            createElement(DriverCard, { ...base, code, log, onClose: () => {} }),
          ),
        );
      stats.push(renderToStaticMarkup(createElement(CarStats, { ...base, log })));
    }
    expect({
      towers: digestMarkup(towers),
      leaders: digestMarkup(leaders),
      cards: digestMarkup(cards),
      stats: digestMarkup(stats),
    }).toEqual(TODAY.components);
  });

  it('the race screen', () => {
    const html = sessions().map((s) => {
      const game = {
        state: s.state,
        model: daily.model,
        clock: null,
        notes: () => s.notes,
        preview: () => s.previewLap(),
        setPace: () => {},
      } as unknown as Game;
      return renderToStaticMarkup(
        createElement(RaceScreen, { game, state: s.state, model: daily.model }),
      );
    });
    expect(digestMarkup(html)).toBe(TODAY.screen);
  });

  it('the big call', () => {
    const s = sessions()[2] as GameSession;
    const moment = s.state.currentMoment;
    if (!moment) throw new Error('no moment');
    const html = renderToStaticMarkup(
      createElement(BroadcastDecision, {
        moment,
        race: s.state.race,
        model: daily.model,
        onChoose: () => {},
      }),
    );
    expect(digestMarkup([html])).toBe(TODAY.decision);
  });

  it('the quick-call and battle cards', () => {
    const s = sessions()[1] as GameSession;
    const { userSide, rival } = s.state.meta;
    const quick = {
      lap: 12,
      from: 'Engineer',
      kind: 'quick' as const,
      text: `Gap to ${rival} is 1.4 s. Push?`,
      stats: [{ label: 'Gap', value: '1.4 s ahead' }],
      options: [
        { id: 'push', label: 'Push', note: 'Harder on the tyres', call: null },
        { id: 'stay', label: 'Stay steady', call: null },
      ],
    };
    const battle = {
      ...quick,
      from: userSide,
      kind: 'battle' as const,
      other: rival,
      attacking: true,
      gap: 0.8,
      options: [
        { id: 'dive', label: 'Dive up the inside', line: 'inside' as const, call: null },
        {
          id: 'drs',
          label: 'Wait for DRS',
          line: 'wait' as const,
          odds: { good: 0.4, label: 'pass' as const, contact: 0.02 },
          call: null,
        },
      ],
    };
    const html = [
      renderToStaticMarkup(
        createElement(QuickCallCard, {
          call: quick,
          ms: 8000,
          onAnswer: () => {},
          onTimeout: () => {},
        }),
      ),
      renderToStaticMarkup(
        createElement(QuickCallCard, {
          call: battle,
          ms: 12000,
          onAnswer: () => {},
          onTimeout: () => {},
        }),
      ),
      ...(['approach', 'waiting', 'move', 'done'] as const).map((stage) =>
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
            result: stage === 'done' ? { text: 'HELD!', good: true } : null,
            onAnswer: () => {},
          }),
        ),
      ),
    ];
    expect(digestMarkup(html)).toBe(TODAY.cards);
  });

  it.each(RADIO_RACES)('the engineer’s radio over %s', (id) => {
    expect(digest(radio(raceFile(id)))).toBe(TODAY.radio[id]);
  });
});

/**
 * Taken from the code before the information levels reached these components, then retaken
 * when main's realistic UI, call timing and tyre calls were merged in (Nov 10 2026): the
 * towers, cards, big call and radio digests are exactly main's (checked against an origin/main
 * checkout); the leaders and the race screen differ from main's only by Eras's shared-screen
 * touches (the timing mark in the leaders' and standings' headers, the radio mark on the Team
 * radio pill, the tapped car's card over the map, the top bar's phone spacing).
 */
const TODAY = {
  // The markup digests are taken without `aria-*` and `id` attributes (`markup` above). Retaken
  // when that began (test suite review, Nov 24 2026): the same values from an origin/main
  // checkout and from this branch, whose S2 accessible names (the standings list, the Team radio
  // bar, the call options) changed only those attributes. Before (attributes in):
  // towers '744def06d2cc0263' (main; the same now, as it had none), leaders '92b7aa6722da2ecb',
  // cards 'efcfeeeb0a03435b', stats '41a6d50080639e8b', screen 'ccf7241ff273c1b3',
  // decision 'f71311307784d55e', quick-call and battle cards '82ea30e0dbd15610' (all main's).
  components: {
    towers: '744def06d2cc0263',
    leaders: '23ea455fbeb70cc8',
    cards: '201ffee3e433cf12',
    stats: '092ae83ef054f2af',
  },
  // Before the merge: '79aa9a7697842f85' (8.8's phone spacing), 'a3ff5c603c39a2f9' (before 8.8).
  // 'ee1d94ac9fe089d8' before the logo went white (Brand: text-white, not the team colour).
  // 'ff65482385daa3aa' before the map's OpenStreetMap credit (components/MapCredit.tsx).
  // '0a151c0f15589328' before the credit moved to the map's bottom right (clear of the strip).
  // '3ea81a4162b5cb5a' before every venue was re-fitted (31efc59): the ground image's placement matrix moved.
  // (Those with the attributes in.)
  screen: 'aeedbfe3f6149a5a',
  decision: '12a19a92cafd6399',
  cards: '471cfe4cfeefbe2e',
  // Before the worn-tyre box request asked only as the tyres got worse (2026-11-14):
  // bahrain-2021 '23f7c24ac4ac5b24', austria-2019 '68bbb551ab858735'.
  radio: {
    'abu-dhabi-2021': 'eac4bbd654ee15dc',
    'bahrain-2021': '791ddd20cd3c9725',
    'austria-2019': '30e494d6b88a057a',
  } as Record<string, string>,
};

import abuDhabi2021 from '@data/races/abu-dhabi-2021.json';
import {
  type DifficultySettings,
  type ErasBlock,
  type ErasTarget,
  type RaceModel,
  difficultyForEra,
  legendDifficulty,
} from '@laststint/sim';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EraIntro } from './EraIntro.js';
import { eraById, eraRace } from './catalog.js';
import {
  INFORMATION_NAME,
  RIVAL_POLICY_NAME,
  isReconstructed,
  masteryText,
  starLines,
  strategistText,
  targetText,
  timerText,
} from './raceIntro.js';

// Abu Dhabi 2021: HAM (Mercedes, teammate BOT) against VER, takeover on lap 34 of 58.
const BASE = abuDhabi2021 as unknown as RaceModel;
const ERA = eraById(9);
const RACE = eraRace('abu-dhabi-2021');
if (!ERA || !RACE) throw new Error('Abu Dhabi 2021 is an Era 9 race');

const ERA9: DifficultySettings = difficultyForEra(9);

function withEras(eras?: Partial<ErasBlock>, extra: Partial<RaceModel> = {}): RaceModel {
  return { ...BASE, ...extra, eras: eras ? { eraId: 9, order: 10, ...eras } : undefined };
}

function render(
  model: RaceModel,
  opts: {
    difficulty?: DifficultySettings;
    legend?: boolean;
    draft?: boolean;
    timed?: boolean;
  } = {},
): string {
  return renderToStaticMarkup(
    createElement(EraIntro, {
      era: ERA as NonNullable<typeof ERA>,
      race: RACE as NonNullable<typeof RACE>,
      model,
      difficulty: opts.difficulty ?? ERA9,
      legend: opts.legend ?? false,
      draft: opts.draft ?? false,
      timed: opts.timed ?? true,
      onStart: () => {},
      onHelp: () => {},
    }),
  );
}

/** The page's text, tags dropped (for whole-sentence checks). */
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&');

const TARGETS: Array<[ErasTarget, string]> = [
  [{ type: 'win' }, 'Win the race'],
  [{ type: 'defend' }, 'Keep the lead to the flag and win'],
  [{ type: 'position', position: 3 }, 'Finish P3 or better'],
  [{ type: 'position', position: 1 }, 'Finish P1'],
  [{ type: 'beat-rival', rival: 'VER' }, 'Finish ahead of Verstappen'],
  [{ type: 'team', positions: [1, 2] }, 'Finish P1, with Bottas P2 or better'],
  [{ type: 'deny', rival: 'VER', position: 4 }, 'Keep Verstappen at P4 or lower'],
];

describe('race intro sentences', () => {
  it.each(TARGETS)('says the %o target in plain words', (target, sentence) => {
    expect(targetText(target, BASE)).toBe(sentence);
  });

  it('covers all six target types', () => {
    expect(new Set(TARGETS.map(([t]) => t.type))).toEqual(
      new Set(['win', 'defend', 'position', 'beat-rival', 'team', 'deny']),
    );
  });

  it('falls back to the code for an unknown driver, and to "your teammate"', () => {
    expect(targetText({ type: 'beat-rival', rival: 'ZZZ' }, BASE)).toBe('Finish ahead of ZZZ');
    const alone: RaceModel = { ...BASE, drivers: BASE.drivers.filter((d) => d.code !== 'BOT') };
    expect(targetText({ type: 'team', positions: [2, 4] }, alone)).toBe(
      'Finish P2 or better, with your teammate P4 or better',
    );
  });

  it('spells out the mastery label in full, with the no-orange-or-red rule', () => {
    expect(masteryText('Win without pitting under the safety car')).toBe(
      'Win without pitting under the safety car, and no call graded orange or red',
    );
    expect(masteryText('Win on a one-stop. ')).toBe(
      'Win on a one-stop, and no call graded orange or red',
    );
  });

  it('gives the accuracy threshold and the timer', () => {
    expect(strategistText(72)).toBe('Race accuracy of 72% or more');
    expect(strategistText(82.25)).toBe('Race accuracy of 82.3% or more');
    expect(timerText(45, true)).toBe('45 s per call');
    expect(timerText(20, false)).toBe('Timer off');
    expect(RIVAL_POLICY_NAME['standard-plus']).toBe('Standard+');
    expect(INFORMATION_NAME.minimal).toBe('Minimal');
  });

  it('has no stars without an eras block, and marks unwritten ones', () => {
    expect(starLines(withEras(), ERA9)).toBeNull();
    expect(starLines(withEras({}), ERA9)).toEqual([
      { star: 1, name: 'Result', text: null },
      { star: 2, name: 'Strategist', text: 'Race accuracy of 72% or more' },
      { star: 3, name: 'Mastery', text: null },
    ]);
  });

  it('reads Reconstructed from the race file', () => {
    expect(isReconstructed(BASE)).toBe(false);
    expect(isReconstructed({ ...BASE, reconstructed: true })).toBe(true);
    expect(isReconstructed({ ...BASE, provenance: { kind: 'reconstructed' } })).toBe(true);
  });
});

describe('EraIntro', () => {
  const authored = withEras({
    target: { type: 'deny', rival: 'VER', position: 2 },
    mastery: { type: 'no_neutralized_stop', label: 'Win without pitting under the safety car' },
  });

  it('shows the dilemma, the race and the duel', () => {
    const page = text(render(authored));
    expect(page).toContain('Abu Dhabi 2021');
    expect(page).toContain('The finale');
    expect(page).toContain('Era 9 · The 2021 title fight · Race 10');
    expect(page).toContain('Hamilton’s race engineer at Mercedes from lap 34 of 58');
    expect(page).toContain('against Verstappen');
  });

  it.each(TARGETS)('shows the %o target as ★1', (target, sentence) => {
    const page = text(render(withEras({ target })));
    expect(page).toContain(`Star 1: Result${sentence}`);
  });

  it('shows all three stars, ★3 in full', () => {
    const page = text(render(authored));
    expect(page).toContain('Star 1: ResultKeep Verstappen at P2 or lower');
    expect(page).toContain('Star 2: StrategistRace accuracy of 72% or more');
    expect(page).toContain(
      'Star 3: MasteryWin without pitting under the safety car, and no call graded orange or red',
    );
    expect(page).not.toContain('not written yet');
  });

  it("shows the era's difficulty: information level, rival policy and timer", () => {
    const html = render(authored, { difficulty: difficultyForEra(7) });
    const page = text(html);
    expect(page).toContain('InformationReduced');
    expect(page).toContain('No gap trend');
    expect(page).toContain('Rival policyStandard+');
    expect(page).toContain('Decision timer45 s per call');
    expect(page).toContain('Race accuracy of 78% or more');
    expect(page).not.toContain('Legend');
  });

  it('says "Timer off" when the player turned the timer off', () => {
    const page = text(render(authored, { timed: false }));
    expect(page).toContain('Decision timerTimer off');
    expect(page).toContain('marked untimed');
    expect(page).not.toContain('per call');
  });

  it('marks a Legend attempt, with Legend difficulty', () => {
    const page = text(render(authored, { legend: true, difficulty: legendDifficulty() }));
    expect(page).toContain('Legend');
    expect(page).toContain('Difficulty · Legend');
    expect(page).toContain('InformationMinimal');
    expect(page).toContain('Rival policyExpert');
    expect(page).toContain('Decision timer20 s per call');
    expect(page).toContain('Race accuracy of 90% or more');
    expect(page).toContain('Start the race · Legend');
  });

  it('shows the Reconstructed and Draft badges only where they apply', () => {
    expect(text(render(authored))).not.toMatch(/Reconstructed|Draft/);
    const page = text(render({ ...authored, reconstructed: true }, { draft: true }));
    expect(page).toContain('Reconstructed');
    expect(page).toContain('Draft');
  });

  it('shows a marked slot, and no invented objectives, without an eras block', () => {
    const html = render(withEras());
    const page = text(html);
    expect(html).toContain('data-todo="objectives"');
    expect(page).toContain('Objectives not written yet');
    expect(page).toContain('The finale');
    expect(page).toContain('InformationFull');
    expect(page).toContain('Decision timer45 s per call');
    expect(page).not.toContain('Star 1');
    expect(page).not.toContain('orange or red');
  });

  it('marks each unwritten star of a partly written block', () => {
    const html = render(withEras({ target: { type: 'win' } }));
    expect(text(html)).toContain('Star 1: ResultWin the race');
    expect(text(html)).toContain('Star 3: MasteryNot written yet.');
    expect(html.match(/data-todo="objective"/g)).toHaveLength(1);
  });

  it('shows the briefing when there is one', () => {
    expect(text(render(withEras({ briefing: 'Level on points.' })))).toContain('Level on points.');
  });
  it('credits the sources a race was built from, by its provenance, linking the credits', () => {
    const asRace = (id: string) => render({ ...BASE, race: { ...BASE.race, id } });
    const tum = asRace('spain-2016');
    expect(tum).toContain('data-credit="race"');
    expect(text(tum)).toContain('Race data: TUM f1-timing-database (CC BY-NC-SA 3.0). Credits');
    expect(tum).toMatch(/<p data-credit="race"[^>]*>[\s\S]*?href="\/credits"/);
    expect(text(asRace('brazil-2003'))).toContain(
      'Race data: Jolpica-F1 (CC BY-NC-SA 4.0) and F1DB (CC BY 4.0).',
    );
    expect(text(asRace('australia-1986'))).toContain(
      'Race data: Jolpica-F1 (CC BY-NC-SA 4.0) and F1DB (CC BY 4.0).',
    );
  });

  it('has no source credit for a race built from OpenF1 or FastF1', () => {
    expect(render(BASE)).not.toContain('data-credit');
    expect(text(render(BASE))).not.toContain('Race data:');
  });
});

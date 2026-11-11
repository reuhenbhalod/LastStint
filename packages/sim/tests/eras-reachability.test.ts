// Reachability and difficulty checker (eras build plan 6.1; "done when: it runs in CI over
// every race with an eras block"). The fixture eras blocks go on Abu Dhabi 2021 in memory
// (HAM the player, VER the rival, six moments); data/races is left alone. Grading is cut to
// SAMPLES playouts per option to keep the suite fast: the checker is deterministic at any
// sample count, so the results below are fixed.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import abuJson from '../../../data/races/abu-dhabi-2021.json';
import {
  LEGEND_SAFETY_CARS_SUPPORTED,
  checkRace,
  checkRaces,
  effectiveRivalPolicy,
  erasModel,
  formatSummary,
  missingContent,
  stayOutIndex,
} from '../src/eras/reachability.js';
import type { DecisionMoment } from '../src/moments.js';
import type { ErasBlock, RaceModel } from '../src/types.js';

const abu = abuJson as unknown as RaceModel;
const SAMPLES = 60;
const FAST = { samples: SAMPLES, seeds: [1, 2] } as const;

/** Beat Verstappen on a one-stop, and finish on the podium for the hidden objective. */
const REACHABLE: ErasBlock = {
  eraId: 10,
  order: 1,
  target: { type: 'beat-rival', rival: 'VER' },
  mastery: { type: 'stop_count', exact: 1, label: 'Win on a one-stop' },
  hidden: { type: 'finish_position', position: 3, label: 'Finish on the podium' },
};

/** The same, but the mastery objective can't be met: win by more than 1000 seconds. */
const UNREACHABLE: ErasBlock = {
  ...REACHABLE,
  mastery: { type: 'margin', seconds: 1000, label: 'Win by over a quarter of an hour' },
};

function withEras(eras: ErasBlock, patch: Partial<RaceModel> = {}): RaceModel {
  return { ...abu, ...patch, eras };
}

/** One moment whose only option is staying out: always graded green. */
const ONLY_STAY: DecisionMoment = {
  id: 'only-stay',
  lap: 40,
  trigger: 'cliff',
  target: { kind: 'beat-rival' },
  options: [{ id: 'stay', label: 'Stay out', decisions: [] }],
  realOptionId: 'stay',
};

describe('checkRace', () => {
  const pass = checkRace(withEras(REACHABLE), FAST);

  it('passes a reachable race at the era difficulty and at Legend', () => {
    expect(pass.errors).toEqual([]);
    expect(pass.pass).toBe(true);
    for (const d of [pass.era, pass.legend]) {
      expect(d?.reachable).toBe(true);
      expect(d?.best?.full).toBe(true);
      const e = d?.best?.evaluation;
      expect(e?.stars).toEqual({ result: true, strategist: true, mastery: true });
      expect(e?.hidden).toBe(true);
      expect(d?.best?.choices.map((c) => c.momentId)).toEqual(abu.decisionMoments.map((m) => m.id));
    }
    expect(pass.era?.settings.accuracyThreshold).toBe(70);
    expect(pass.legend?.settings.accuracyThreshold).toBe(90);
  });

  it('plays the stay-out path on every seed and finds it short of ★3', () => {
    for (const d of [pass.era, pass.legend]) {
      expect(d?.stayOut.map((s) => s.seed)).toEqual([1, 2]);
      expect(d?.stayOutEarnsMastery).toBe(false);
      // Staying out never stops, so the one-stop mastery objective is never met.
      for (const s of d?.stayOut ?? []) expect(s.evaluation.masteryObjective).toBe(false);
    }
  });

  it('is deterministic', () => {
    const again = checkRace(withEras(REACHABLE), FAST);
    expect(again.era?.best).toEqual(pass.era?.best);
    expect(again.legend?.stayOut).toEqual(pass.legend?.stayOut);
  });

  it('fails a race whose mastery objective no path can meet', () => {
    const r = checkRace(withEras(UNREACHABLE), FAST);
    expect(r.errors).toEqual([]);
    expect(r.pass).toBe(false);
    for (const d of [r.era, r.legend]) {
      expect(d?.reachable).toBe(false);
      expect(d?.seedsSearched).toEqual([1, 2]);
      expect(d?.best?.evaluation.stars.mastery).toBe(false);
      expect(d?.best?.full).toBe(false);
    }
    expect(formatSummary({ ok: false, reports: [r] })).toMatch(/^FAIL abu-dhabi-2021/);
  });

  it('fails a race where staying out every time earns ★3', () => {
    // A no-stop mastery objective and a single stay-out-only moment: the stay-out path is the
    // only path, its call is green, and it meets the objective.
    const r = checkRace(
      withEras(
        {
          ...REACHABLE,
          target: { type: 'position', position: 20 },
          mastery: { type: 'stop_count', max: 0, label: 'No stops' },
          hidden: { type: 'finish_position', position: 20, label: 'Finish' },
        },
        { decisionMoments: [ONLY_STAY] },
      ),
      { samples: 10, seeds: [1] },
    );
    expect(r.errors).toEqual([]);
    expect(r.era?.reachable).toBe(true);
    expect(r.era?.stayOutEarnsMastery).toBe(true);
    expect(r.legend?.stayOutEarnsMastery).toBe(true);
    expect(r.pass).toBe(false);
    expect(formatSummary({ ok: false, reports: [r] })).toContain('stay-out ★3 EARNED (fails)');
  });

  it('reports an exhaustive search when the beam never cuts, and a bounded one when it does', () => {
    const one = { ...abu.decisionMoments[0], lap: 36 } as DecisionMoment;
    const small = withEras(REACHABLE, { decisionMoments: [one] });
    const wide = checkRace(small, { samples: 20, seeds: [1], beamWidth: 10 });
    expect(wide.era?.exhaustive).toBe(true);
    const narrow = checkRace(withEras(UNREACHABLE), { samples: 20, seeds: [1], beamWidth: 1 });
    expect(narrow.era?.exhaustive).toBe(false);
    expect(narrow.era?.pathsEvaluated).toBe(1);
  });

  it('fails an incomplete eras block without searching', () => {
    const r = checkRace(withEras({ eraId: 10, order: 1, target: { type: 'win' } }), FAST);
    expect(r.pass).toBe(false);
    expect(r.errors).toEqual(['eras block incomplete: no mastery objective, no hidden objective']);
    expect(r.era).toBeNull();
  });

  it('fails a race with no decision moments', () => {
    const r = checkRace(withEras(REACHABLE, { decisionMoments: [] }), FAST);
    expect(r.errors).toEqual(['no decision moments']);
    expect(r.pass).toBe(false);
  });

  it('reports a moment with no stay-out option as an error', () => {
    const pitOnly: DecisionMoment = {
      ...ONLY_STAY,
      options: [
        { id: 'box', label: 'Box', decisions: [{ lap: 40, kind: 'pit', compound: 'HARD' }] },
      ],
    };
    const r = checkRace(withEras(REACHABLE, { decisionMoments: [pitOnly] }), {
      samples: 10,
      seeds: [1],
    });
    expect(r.pass).toBe(false);
    expect(r.errors).toEqual(['moment only-stay has no stay-out option']);
  });

  it("plays the era's rival policy, and Legend's Expert with random safety cars", () => {
    // Era 8 is Standard+; Legend is Expert. Both are in the sim (step 9.1), so no fallback.
    const r = checkRace(withEras({ ...REACHABLE, eraId: 8 }, { decisionMoments: [ONLY_STAY] }), {
      samples: 10,
      seeds: [1],
    });
    expect(r.era?.settings.rivalPolicy).toBe('standard-plus');
    expect(r.era?.rivalPolicy).toBe('standard-plus');
    expect(r.era?.warnings.some((w) => w.startsWith('rival policy'))).toBe(false);
    expect(r.legend?.rivalPolicy).toBe('expert');
    expect(r.legend?.warnings.some((w) => w.includes('real SCs'))).toBe(false);
  });

  it('rejects bad options', () => {
    expect(() => checkRace(withEras(REACHABLE), { seeds: [] })).toThrow(/no seeds/);
    expect(() => checkRace(withEras(REACHABLE), { samples: 0 })).toThrow(/samples/);
    expect(() => checkRace(withEras(REACHABLE), { beamWidth: 0 })).toThrow(/beamWidth/);
  });
});

describe('checkRaces', () => {
  it('passes with no races, and skips races without an eras block', () => {
    expect(checkRaces([])).toEqual({ ok: true, reports: [] });
    expect(checkRaces([abu])).toEqual({ ok: true, reports: [] });
    expect(formatSummary(checkRaces([]))).toContain('no races with an eras block');
  });

  it('fails when any race fails', () => {
    const s = checkRaces([withEras(UNREACHABLE)], { samples: 20, seeds: [1] });
    expect(s.ok).toBe(false);
    expect(s.reports).toHaveLength(1);
  });
});

describe('helpers', () => {
  it('picks the stay-out option: no calls, else no pit call', () => {
    const m = abu.decisionMoments[0] as DecisionMoment;
    expect(m.options[stayOutIndex(m) as number]?.decisions).toEqual([]);
    const push: DecisionMoment = {
      ...ONLY_STAY,
      options: [
        { id: 'box', label: 'Box', decisions: [{ lap: 40, kind: 'pit', compound: 'HARD' }] },
        {
          id: 'push',
          label: 'Push',
          decisions: [{ lap: 40, kind: 'mode', key: 'pace', value: 'push' }],
        },
      ],
    };
    expect(stayOutIndex(push)).toBe(1);
    expect(stayOutIndex({ ...push, options: push.options.slice(0, 1) })).toBeNull();
  });

  it('keeps an implemented rival policy and replaces the rest', () => {
    expect(effectiveRivalPolicy('standard')).toEqual({ policy: 'standard', warning: null });
    expect(effectiveRivalPolicy('smart')).toEqual({ policy: 'smart', warning: null });
  });

  it('plays from eras.userSide', () => {
    const m = erasModel(withEras({ ...REACHABLE, userSide: 'VER' }));
    expect([m.userSide, m.rival]).toEqual(['VER', 'HAM']);
    expect(erasModel(withEras(REACHABLE))).toEqual(withEras(REACHABLE));
  });

  it('lists missing checklist content', () => {
    expect(missingContent(REACHABLE)).toEqual([]);
    expect(missingContent({ eraId: 1, order: 1 })).toEqual([
      'no target',
      'no mastery objective',
      'no hidden objective',
    ]);
  });
});

describe('the CLI', () => {
  const script = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'reachability.ts');
  // On Windows the .bin shim is tsx.cmd, and Node only runs .cmd files through a shell.
  const win = process.platform === 'win32';
  const tsx = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'node_modules',
    '.bin',
    win ? 'tsx.cmd' : 'tsx',
  );
  const dir = mkdtempSync(join(tmpdir(), 'reachability-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  const cli = (...args: string[]) =>
    spawnSync(tsx, [script, ...args, '--samples', '20', '--seeds', '1'], {
      encoding: 'utf8',
      shell: win,
    });

  it('exits 1 on an unreachable fixture race', () => {
    const file = join(dir, 'unreachable.json');
    writeFileSync(file, JSON.stringify(withEras(UNREACHABLE)));
    const r = cli(file);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('FAIL abu-dhabi-2021');
    expect(r.stdout).toContain('0 passed, 1 failed of 1');
  }, 30_000);

  it('exits 0 on a race file without an eras block', () => {
    const file = join(dir, 'plain.json');
    writeFileSync(file, JSON.stringify(abu));
    const r = cli(file);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('no races with an eras block');
  }, 30_000);
});

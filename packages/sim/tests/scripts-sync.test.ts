// The UI's race scripts (data/scripts/<race>.json, Reuhen's) and the race files' approved
// moments must agree: the Worker grades the race file's moments, so a moment the UI asks
// under another id, lap or option set would get every run rejected (beta spec B2).

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { RaceModel } from '../src/types.js';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const scriptsDir = join(repo, 'data', 'scripts');

interface Script {
  raceId: string;
  target: unknown;
  moments: Array<{
    id: string;
    lap: number;
    options: Array<{ id: string; decisions: unknown[] }>;
  }>;
}

/** What both sides must share, per moment: id, lap, target, and each option's id and calls. */
function shape(moments: Script['moments'] | RaceModel['decisionMoments'], target?: unknown) {
  return moments.map((m) => ({
    id: m.id,
    lap: m.lap,
    target: 'target' in m ? m.target : target,
    options: m.options.map((o) => ({ id: o.id, decisions: o.decisions })),
  }));
}

function mismatch(script: Script, model: RaceModel): string | null {
  const want = JSON.stringify(shape(model.decisionMoments));
  const got = JSON.stringify(shape(script.moments, script.target));
  return want === got ? null : `script: ${got}\nrace file: ${want}`;
}

const scripts = readdirSync(scriptsDir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(scriptsDir, f), 'utf8')) as Script);
const model = (id: string) =>
  JSON.parse(readFileSync(join(repo, 'data', 'races', `${id}.json`), 'utf8')) as RaceModel;

describe('UI race scripts match the race files', () => {
  it('there is at least one script', () => expect(scripts.length).toBeGreaterThan(0));

  for (const script of scripts) {
    it(`${script.raceId}: same moments, laps, targets and options`, () => {
      expect(mismatch(script, model(script.raceId))).toBeNull();
    });
  }

  it('catches a renamed moment, a moved lap and a changed option', () => {
    const script = scripts[0] as Script;
    const race = model(script.raceId);
    const edited = (f: (s: Script) => void) => {
      const copy = JSON.parse(JSON.stringify(script)) as Script;
      f(copy);
      return mismatch(copy, race);
    };
    expect(
      edited((s) => {
        (s.moments[0] as { id: string }).id = 'renamed';
      }),
    ).not.toBeNull();
    expect(
      edited((s) => {
        (s.moments[0] as { lap: number }).lap += 1;
      }),
    ).not.toBeNull();
    expect(
      edited((s) => {
        s.moments[0]?.options.pop();
      }),
    ).not.toBeNull();
  });
});

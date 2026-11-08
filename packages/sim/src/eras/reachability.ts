// Reachability and difficulty checker (eras build plan 6.1; eras spec §15, the per-race
// checklist). For a race with an `eras` block it searches the player's decision paths, one
// option per decision moment, at the era's difficulty and at Legend, and checks two things:
//
//   reachable:  some path earns ★1, ★2 and ★3 and the hidden objective (all on that one path);
//   difficulty: the "stay out every time" path never earns ★3.
//
// A path is played as the game plays it: a live run (initRun with no calls, incidents on) on
// one seed, paused before each moment, the moment graded there with the grader (the same
// samples and seeds the game uses), then answered with answerMoment. The finished run goes
// through the Eras evaluator with its race log. Nothing here is random: the seed set is fixed.
//
// Search (bounded beam with exact pruning), per seed, moment by moment in lap order:
//   - every option of every kept prefix is a candidate child;
//   - a child whose option grades orange or red is cut: ★3 needs no orange or red call, so no
//     path through it can earn all three stars (exact, not a heuristic);
//   - a child that can't reach the ★2 threshold even with 100 on every remaining call is cut
//     (exact);
//   - the survivors are ranked by accuracy so far (desc), then the chosen option's chance of
//     the target (desc), then option order, and the best `beamWidth` are kept.
// If no level ever has more survivors than `beamWidth` the search was exhaustive over every
// path that could earn all three stars, and the report says so; otherwise it was bounded.
// Every kept full path is played to the flag and evaluated. Seeds are tried in order and the
// search stops at the first seed with a passing path; the stay-out path is played on every
// seed. Grades are cached per (sim setting, seed, prefix), so the era and Legend searches share
// work when they race under the same conditions.
//
// Not searched: the takeover race plan (strategy planner; optional in the game) and the live
// calls a player can make between moments (BOX, the headset). Paths are moment answers only.
//
// The player's car is eras.userSide when set (the model is seen from that side, as the hard-
// call counter does), else the race file's userSide.

import { GRADE_SAMPLES, type MomentGrade, gradeMoment } from '../grade.js';
import type { DecisionMoment, MomentOption } from '../moments.js';
import { RivalPolicyError, resolveRivalPolicy } from '../rivals/policy.js';
import { type Run, type RunOptions, classify, initRun, isFinished, stepLap } from '../sim.js';
import type { ErasBlock, RaceModel } from '../types.js';
import { answerMoment } from '../verify.js';
import {
  type DifficultySettings,
  ERAS_CONFIG,
  type ErasConfig,
  type RivalPolicy,
  decisionAccuracy,
  difficultyForEra,
  legendDifficulty,
} from './config.js';
import { type ErasEvaluation, type GradedCall, evaluateEras } from './evaluate.js';
import { fromSide } from './hard-calls.js';
import { emptyLog, recordLap } from './race-log.js';

/** The fixed seeds every path is tried on, in order. */
export const REACH_SEEDS: readonly number[] = [1, 2, 3];
/** Prefixes kept per moment (the beam). */
export const REACH_BEAM = 4;

/** Legend's random safety cars (eras spec §8; legend.ts) are in the sim: Legend runs use them. */
export const LEGEND_SAFETY_CARS_SUPPORTED = true;

export interface ReachabilityOptions {
  /** The seeds tried, in order. Default REACH_SEEDS. */
  seeds?: readonly number[];
  /** Playouts per option at each moment. Default GRADE_SAMPLES (what the game grades with). */
  samples?: number;
  /** Prefixes kept per moment. Default REACH_BEAM. */
  beamWidth?: number;
  /** Extra run options for Legend runs only (e.g. the sim's random-SC flag, once it exists). */
  legendRunOptions?: RunOptions;
  /** Difficulty source. Default eras-config.json. */
  config?: ErasConfig;
  /** Clock for runtimes, in ms. Default Date.now. */
  now?: () => number;
}

export interface PathChoice {
  momentId: string;
  optionId: string;
}

export interface PathResult {
  seed: number;
  choices: PathChoice[];
  evaluation: ErasEvaluation;
  /** ★1, ★2, ★3 and the hidden objective all earned. */
  full: boolean;
}

export interface DifficultyReport {
  label: 'era' | 'legend';
  settings: DifficultySettings;
  /** The rival policy the runs used (standard when the asked-for one isn't in the sim yet). */
  rivalPolicy: RivalPolicy;
  /** Fallbacks taken (rival policy, Legend safety cars). */
  warnings: string[];
  /** Some path earned all three stars and the hidden objective. */
  reachable: boolean;
  /** The passing path, or the best path found (most goals, then accuracy). */
  best: PathResult | null;
  /** Every path that could earn all three stars was tried, on every seed searched. */
  exhaustive: boolean;
  /** Seeds searched before a passing path was found (or all of them). */
  seedsSearched: number[];
  pathsEvaluated: number;
  /** The stay-out path on each seed; `mastery` true on any seed fails the difficulty check. */
  stayOut: { seed: number; evaluation: ErasEvaluation }[];
  /** The stay-out path earned ★3 on some seed. */
  stayOutEarnsMastery: boolean;
  ms: number;
}

export interface RaceReport {
  raceId: string;
  pass: boolean;
  /** Why the race couldn't be checked, or failed outright (incomplete eras block, sim error). */
  errors: string[];
  era: DifficultyReport | null;
  legend: DifficultyReport | null;
  ms: number;
}

export interface ReachabilitySummary {
  /** Every race passed (true with no races). */
  ok: boolean;
  reports: RaceReport[];
}

/** The rival policy a run can use: `wanted`, or standard with a warning if the sim rejects it. */
export function effectiveRivalPolicy(wanted: RivalPolicy): {
  policy: RivalPolicy;
  warning: string | null;
} {
  try {
    return { policy: resolveRivalPolicy(wanted), warning: null };
  } catch (e) {
    if (!(e instanceof RivalPolicyError)) throw e;
    return {
      policy: 'standard',
      warning: `rival policy ${wanted} is not in the sim yet, ran standard instead (${e.message})`,
    };
  }
}

/** The model as the player runs it in Eras: from eras.userSide when that is set. */
export function erasModel(model: RaceModel): RaceModel {
  const side = model.eras?.userSide;
  return side && side !== model.userSide ? fromSide(model, side) : model;
}

/** What the checklist needs authored before the check can run (spec §15). */
export function missingContent(eras: ErasBlock): string[] {
  const missing: string[] = [];
  if (!eras.target) missing.push('no target');
  if (!eras.mastery) missing.push('no mastery objective');
  if (!eras.hidden) missing.push('no hidden objective');
  return missing;
}

/**
 * The option the decision timer picks (eras spec §7, stay out and keep the mode): the option
 * with no calls, else the first without a pit call. Null if every option pits.
 */
export function stayOutIndex(moment: DecisionMoment): number | null {
  const none = moment.options.findIndex((o) => o.decisions.length === 0);
  if (none >= 0) return none;
  const noPit = moment.options.findIndex((o) => !o.decisions.some((d) => d.kind === 'pit'));
  return noPit >= 0 ? noPit : null;
}

/** Moments in the order the game meets them (by lap, then file order). */
function orderedMoments(model: RaceModel): DecisionMoment[] {
  return model.decisionMoments
    .map((m, i) => ({ m, i }))
    .sort((a, b) => a.m.lap - b.m.lap || a.i - b.i)
    .map((x) => x.m);
}

/** One sim setting (model, rival, Legend options, samples): runs paths and caches grades. */
class PathRunner {
  readonly moments: DecisionMoment[];
  private readonly grades = new Map<string, MomentGrade>();

  constructor(
    readonly model: RaceModel,
    private readonly runOptions: RunOptions,
    private readonly samples: number,
  ) {
    this.moments = orderedMoments(model);
  }

  private option(j: number, index: number): MomentOption {
    const m = this.moments[j] as DecisionMoment;
    const o = m.options[index];
    if (!o) throw new Error(`moment ${m.id} has no option ${index}`);
    return o;
  }

  private start(seed: number): Run {
    return initRun(this.model, seed, { ...this.runOptions, decisions: [] });
  }

  /**
   * The grade of moment `prefix.length`, after the answers in `prefix`. As the server rebuilds
   * it (verify.ts pausedBefore): only answers to moments on earlier laps are in the run.
   */
  gradeAt(seed: number, prefix: number[]): MomentGrade {
    const key = `${seed}:${prefix.join(',')}`;
    const cached = this.grades.get(key);
    if (cached) return cached;
    const j = prefix.length;
    const moment = this.moments[j];
    if (!moment) throw new Error(`no moment ${j}`);
    const run = this.start(seed);
    for (let i = 0; i < j; i++) {
      const m = this.moments[i] as DecisionMoment;
      if (m.lap >= moment.lap) break;
      while (run.state.lap < m.lap - 1) stepLap(run);
      answerMoment(run, m, this.option(i, prefix[i] as number).id);
    }
    if (run.state.lap > moment.lap - 1)
      throw new Error(`moment ${moment.id} on lap ${moment.lap} comes before the takeover`);
    while (run.state.lap < moment.lap - 1) stepLap(run);
    const grade = gradeMoment(run, moment.options, moment.target, this.samples);
    this.grades.set(key, grade);
    return grade;
  }

  get gradesRun(): number {
    return this.grades.size;
  }

  /** Play a full path to the flag and evaluate it. */
  play(
    seed: number,
    path: number[],
    eras: ErasBlock,
    difficulty: DifficultySettings,
    config: ErasConfig,
  ): PathResult {
    if (path.length !== this.moments.length)
      throw new Error(`path answers ${path.length} of ${this.moments.length} moments`);
    const calls: GradedCall[] = this.moments.map((m, j) => ({
      grade: this.gradeAt(seed, path.slice(0, j)),
      chosen: this.option(j, path[j] as number).id,
    }));
    const run = this.start(seed);
    const log = emptyLog(run);
    let next = 0;
    while (!isFinished(run)) {
      for (let m = this.moments[next]; m && m.lap - 1 === run.state.lap; m = this.moments[next]) {
        answerMoment(run, m, this.option(next, path[next] as number).id);
        next++;
      }
      stepLap(run);
      recordLap(log, run);
    }
    if (next !== this.moments.length) {
      const m = this.moments[next] as DecisionMoment;
      throw new Error(`moment ${m.id} on lap ${m.lap} never came up`);
    }
    const evaluation = evaluateEras({
      race: { model: this.model, result: classify(run), log },
      eras,
      calls,
      difficulty,
      untimed: false,
      config,
    });
    return {
      seed,
      choices: this.moments.map((m, j) => ({
        momentId: m.id,
        optionId: this.option(j, path[j] as number).id,
      })),
      evaluation,
      full: isFull(evaluation),
    };
  }
}

function isFull(e: ErasEvaluation): boolean {
  return e.stars.result && e.stars.strategist && e.stars.mastery && e.hidden === true;
}

function goals(e: ErasEvaluation): number {
  return [e.stars.result, e.stars.strategist, e.stars.mastery, e.hidden === true].filter(Boolean)
    .length;
}

/** Better of two paths: more goals, then higher accuracy; the first wins a tie. */
function better(a: PathResult | null, b: PathResult): PathResult {
  if (!a) return b;
  const d = goals(b.evaluation) - goals(a.evaluation);
  if (d !== 0) return d > 0 ? b : a;
  return b.evaluation.raceAccuracy > a.evaluation.raceAccuracy ? b : a;
}

interface Node {
  prefix: number[];
  accuracy: number;
  probability: number;
}

function lexCompare(a: number[], b: number[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const d = (a[i] as number) - (b[i] as number);
    if (d !== 0) return d;
  }
  return a.length - b.length;
}

/** The beam search on one seed: the full paths kept to the end, and whether nothing was cut. */
function searchSeed(
  runner: PathRunner,
  seed: number,
  difficulty: DifficultySettings,
  beamWidth: number,
  config: ErasConfig,
): { paths: number[][]; exhaustive: boolean } {
  const k = runner.moments.length;
  let frontier: Node[] = [{ prefix: [], accuracy: 0, probability: 1 }];
  let exhaustive = true;
  for (let j = 0; j < k; j++) {
    const children: Node[] = [];
    for (const node of frontier) {
      const grade = runner.gradeAt(seed, node.prefix);
      const moment = runner.moments[j] as DecisionMoment;
      moment.options.forEach((option, index) => {
        const graded = grade.options.find((o) => o.id === option.id);
        if (!graded) throw new Error(`option ${option.id} of ${moment.id} was not graded`);
        if (graded.band === 'orange' || graded.band === 'red') return;
        const accuracy = node.accuracy + decisionAccuracy(graded.behindBest, config);
        const bestMean = (accuracy + 100 * (k - 1 - j)) / k;
        if (bestMean < difficulty.accuracyThreshold) return;
        children.push({
          prefix: [...node.prefix, index],
          accuracy,
          probability: graded.probability,
        });
      });
    }
    children.sort(
      (a, b) =>
        b.accuracy - a.accuracy || b.probability - a.probability || lexCompare(a.prefix, b.prefix),
    );
    if (children.length > beamWidth) exhaustive = false;
    frontier = children.slice(0, beamWidth);
  }
  return { paths: k === 0 ? [] : frontier.map((n) => n.prefix), exhaustive };
}

function checkDifficulty(
  label: 'era' | 'legend',
  model: RaceModel,
  eras: ErasBlock,
  settings: DifficultySettings,
  runners: Map<string, PathRunner>,
  options: Required<Omit<ReachabilityOptions, 'legendRunOptions'>> & {
    legendRunOptions: RunOptions;
  },
): DifficultyReport {
  const t0 = options.now();
  const warnings: string[] = [];
  const { policy, warning } = effectiveRivalPolicy(settings.rivalPolicy);
  if (warning) warnings.push(warning);
  const extra = label === 'legend' ? options.legendRunOptions : {};
  if (label === 'legend' && !LEGEND_SAFETY_CARS_SUPPORTED)
    warnings.push(
      "Legend's random safety cars are not in the sim yet, ran the race's real SCs and VSCs",
    );

  const key = JSON.stringify({ policy, extra });
  let runner = runners.get(key);
  if (!runner) {
    runner = new PathRunner(model, { ...extra, rivalPolicy: policy }, options.samples);
    runners.set(key, runner);
  }

  let best: PathResult | null = null;
  let exhaustive = true;
  let pathsEvaluated = 0;
  const seedsSearched: number[] = [];
  for (const seed of options.seeds) {
    seedsSearched.push(seed);
    const found = searchSeed(runner, seed, settings, options.beamWidth, options.config);
    exhaustive &&= found.exhaustive;
    for (const path of found.paths) {
      const result = runner.play(seed, path, eras, settings, options.config);
      pathsEvaluated++;
      best = better(best, result);
      if (result.full) break;
    }
    if (best?.full) break;
  }

  // The stay-out path, on every seed: earning ★3 on any one fails the difficulty check.
  const stayOutPath = runner.moments.map((m) => {
    const i = stayOutIndex(m);
    if (i === null) throw new Error(`moment ${m.id} has no stay-out option`);
    return i;
  });
  const stayOut = options.seeds.map((seed) => ({
    seed,
    evaluation: runner.play(seed, stayOutPath, eras, settings, options.config).evaluation,
  }));

  return {
    label,
    settings,
    rivalPolicy: policy,
    warnings,
    reachable: best?.full === true,
    best,
    exhaustive,
    seedsSearched,
    pathsEvaluated,
    stayOut,
    stayOutEarnsMastery: stayOut.some((s) => s.evaluation.stars.mastery),
    ms: options.now() - t0,
  };
}

/** Check one race with an `eras` block, at the era's difficulty and at Legend. */
export function checkRace(model: RaceModel, opts: ReachabilityOptions = {}): RaceReport {
  const options = {
    seeds: opts.seeds ?? REACH_SEEDS,
    samples: opts.samples ?? GRADE_SAMPLES,
    beamWidth: opts.beamWidth ?? REACH_BEAM,
    legendRunOptions: opts.legendRunOptions ?? { legend: true },
    config: opts.config ?? ERAS_CONFIG,
    now: opts.now ?? Date.now,
  };
  if (options.seeds.length === 0) throw new RangeError('checkRace: no seeds');
  if (!Number.isInteger(options.samples) || options.samples < 1)
    throw new RangeError(`checkRace: samples must be a positive integer, got ${options.samples}`);
  if (!Number.isInteger(options.beamWidth) || options.beamWidth < 1)
    throw new RangeError(
      `checkRace: beamWidth must be a positive integer, got ${options.beamWidth}`,
    );

  const t0 = options.now();
  const raceId = model.race.id;
  const report = (
    errors: string[],
    era: DifficultyReport | null = null,
    legend: DifficultyReport | null = null,
  ): RaceReport => ({
    raceId,
    pass:
      errors.length === 0 &&
      !!era?.reachable &&
      !!legend?.reachable &&
      !era.stayOutEarnsMastery &&
      !legend.stayOutEarnsMastery,
    errors,
    era,
    legend,
    ms: options.now() - t0,
  });

  const eras = model.eras;
  if (!eras) return report(['no eras block']);
  const missing = missingContent(eras);
  if (missing.length) return report([`eras block incomplete: ${missing.join(', ')}`]);
  if (model.decisionMoments.length === 0) return report(['no decision moments']);

  // A failure inside the sim or the evaluator is reported as this race's error (and fails
  // the check), so one broken race doesn't hide the others' results.
  try {
    const played = erasModel(model);
    const runners = new Map<string, PathRunner>();
    const era = checkDifficulty(
      'era',
      played,
      eras,
      difficultyForEra(eras.eraId, options.config),
      runners,
      options,
    );
    const legend = checkDifficulty(
      'legend',
      played,
      eras,
      legendDifficulty(options.config),
      runners,
      options,
    );
    return report([], era, legend);
  } catch (e) {
    return report([e instanceof Error ? e.message : String(e)]);
  }
}

/** Check every race given (those with an `eras` block; the rest are skipped). */
export function checkRaces(
  models: RaceModel[],
  opts: ReachabilityOptions = {},
): ReachabilitySummary {
  const reports = models.filter((m) => m.eras).map((m) => checkRace(m, opts));
  return { ok: reports.every((r) => r.pass), reports };
}

function stars(e: ErasEvaluation): string {
  const s = (on: boolean, n: number) => (on ? `★${n}` : `-${n}`);
  return `${s(e.stars.result, 1)} ${s(e.stars.strategist, 2)} ${s(e.stars.mastery, 3)} hidden ${
    e.hidden ? 'yes' : 'no'
  } (accuracy ${e.raceAccuracy.toFixed(1)})`;
}

function formatDifficulty(d: DifficultyReport): string[] {
  const lines = [
    `  ${d.label}: ${d.reachable ? 'reachable' : 'NOT reachable'}, stay-out ★3 ${
      d.stayOutEarnsMastery ? 'EARNED (fails)' : 'not earned'
    }; threshold ${d.settings.accuracyThreshold}, rival ${d.rivalPolicy}, ${
      d.exhaustive ? 'exhaustive' : 'bounded'
    } search, ${d.pathsEvaluated} paths on seeds [${d.seedsSearched.join(',')}], ${(
      d.ms / 1000
    ).toFixed(1)} s`,
  ];
  if (d.best) {
    const path = d.best.choices.map((c) => `${c.momentId}=${c.optionId}`).join(' ');
    lines.push(`    best (seed ${d.best.seed}): ${stars(d.best.evaluation)}: ${path}`);
  } else {
    lines.push('    best: none (no path survived the ★2/★3 pruning)');
  }
  for (const s of d.stayOut) lines.push(`    stay-out (seed ${s.seed}): ${stars(s.evaluation)}`);
  for (const w of d.warnings) lines.push(`    warning: ${w}`);
  return lines;
}

/** The report as text, one block per race and a closing line. */
export function formatSummary(summary: ReachabilitySummary): string {
  const lines: string[] = [];
  if (summary.reports.length === 0) lines.push('reachability: no races with an eras block');
  for (const r of summary.reports) {
    lines.push(`${r.pass ? 'PASS' : 'FAIL'} ${r.raceId} (${(r.ms / 1000).toFixed(1)} s)`);
    for (const e of r.errors) lines.push(`  error: ${e}`);
    if (r.era) lines.push(...formatDifficulty(r.era));
    if (r.legend) lines.push(...formatDifficulty(r.legend));
  }
  const failed = summary.reports.filter((r) => !r.pass).length;
  lines.push(
    `reachability: ${summary.reports.length - failed} passed, ${failed} failed of ${summary.reports.length}`,
  );
  return lines.join('\n');
}

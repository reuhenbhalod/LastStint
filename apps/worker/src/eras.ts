// Eras mode API (docs/laststint-eras-mode-spec.md §13; Eras build plan 7.2). The campaign map,
// an era's race cards, and attempts: the server deals each attempt a fresh seed (spec §9) and
// gates it by release, publication, lock and Legend (spec §5, §8, §13), all bypassed on test
// (ERAS_TEST_MODE "true", staging only). Production never shows or serves a Draft race.
//
//   GET  /api/eras?anonId=                    { testMode, eras }: every era in play order, with
//                                             release state, the player's stars and unlock state
//   GET  /api/eras/:eraId?anonId=             the era, and its races with the player's stars,
//                                             hidden objective state and best accuracy
//   POST /api/eras/attempts                   { anonId, raceId, legend } -> { attemptId, seed,
//                                             modelUrl, modelHash, difficulty, expiresAt }
//   POST /api/eras/attempts/:id               { anonId, decisions, grades, untimed?,
//                                             rivalClaims?, modelHash? } -> the evaluated
//                                             attempt (erasEval.ts EraAttemptResult) with the
//                                             player's progress on the race and rank (7.3)
//   GET  /api/eras/races/:raceId/model?h=     the race file an attempt pinned (immutable by hash)
//
// The player is the account an anonId is linked to (player_ids), else the anonId itself: a
// signed-in browser plays as its account's player ID (players.ts, erasMerge.ts). Unlocks,
// Cleared and stars are derived from era_progress, never stored (spec §12). The history book, community stats and leaderboards are step 7.4.
//
// A submit is replayed and evaluated on the server (erasEval.ts, build plan 7.3) from the race
// file the attempt pinned at its start (era_attempts.model_hash), graded from the game's
// claimed grades as a Daily run is, and re-graded in full nightly (reverify.ts). An Expert
// rival (play orders 8-10 and every Legend attempt) is replayed from the rival's claimed
// choices (`rivalClaims`, checked by the sim); claims that don't replay are refused with 400
// bad-rival-claims and the sim's `code`, and the nightly job re-grades the rest.

import { type RaceModel, STARS_PER_RACE, VerifyError, unlocksNextEra } from '@laststint/sim';
import type { Context, Hono } from 'hono';
import {
  BadRivalClaimsError,
  type EraAttemptResult,
  EraRaceNotReadyError,
  HISTORY_INSERT,
  PROGRESS_UPSERT,
  attemptDifficulty,
  evaluateAttempt,
} from './erasEval.js';
import { modelHash } from './hash.js';
import type { Env } from './index.js';
import { ERAS_RACE_FILES } from './races.gen.js';
import { type BundledRace, getRace } from './races.js';
import { ApiError, isAnonId } from './runs.js';

type Ctx = Context<{ Bindings: Env }>;

export { attemptDifficulty };

/** An attempt left unsubmitted this long is abandoned and can't be submitted (spec §9). */
export const ATTEMPT_TTL_MS = 24 * 3600 * 1000;
/** Largest accepted submit body, as POST /api/runs. */
const MAX_BODY_BYTES = 64 * 1024;
/** More decisions than any race could log: a bigger list is refused unread. */
const MAX_DECISIONS = 2000;

/** Test mode (spec §5, §13, §16): on only when the config says exactly "true". */
export function erasTestMode(env: Pick<Env, 'ERAS_TEST_MODE'>): boolean {
  return env.ERAS_TEST_MODE === 'true';
}

interface EraRow {
  id: number;
  name: string;
  years: string;
  play_order: number;
  released_at: string | null;
}

interface EraRaceRow {
  race_id: string;
  era_id: number;
  position: number;
  published: number;
}

interface ProgressRow {
  race_id: string;
  star_result: number;
  star_strategist: number;
  star_mastery: number;
  hidden_done: number;
  best_accuracy: number | null;
}

interface AttemptRow {
  id: string;
  player_id: string;
  race_id: string;
  legend: number;
  seed: number;
  decisions: string | null;
  model_hash: string | null;
  created_at: string;
  submitted_at: string | null;
}

/** An era on the map (web `EraSummary`). */
export interface EraSummary {
  eraId: number;
  name: string;
  years: string;
  playOrder: number;
  released: boolean;
  unlocked: boolean;
  stars: number;
  maxStars: number;
}

/** One race card (web `EraRaceSummary`). */
export interface EraRaceSummary {
  raceId: string;
  position: number;
  stars: { result: boolean; strategist: boolean; mastery: boolean };
  hiddenDone: boolean;
  bestAccuracy: number | null;
  reconstructed: boolean;
  draft: boolean;
}

export interface EraDetail extends EraSummary {
  /** Cleared (at least one star on every race; spec §8): Legend can be played. */
  legendUnlocked: boolean;
  races: EraRaceSummary[];
}

/** One era as worked out for a player (internal: more than the map shows). */
interface EraState {
  row: EraRow;
  races: EraRaceRow[];
  summary: EraSummary;
  /** Released in production (released_at set and reached), whatever the mode. */
  releasedForReal: boolean;
  cleared: boolean;
}

// ---- race files ---------------------------------------------------------------------------

const erasHashes = new Map<string, Promise<string>>();

/** An Eras race's bundled file: a Daily or Gauntlet one, or an Eras-only one. Null: not built. */
export async function getErasRace(id: string): Promise<BundledRace | null> {
  const shared = await getRace(id);
  if (shared) return shared;
  if (!Object.hasOwn(ERAS_RACE_FILES, id)) return null;
  const model = ERAS_RACE_FILES[id] as RaceModel;
  let hash = erasHashes.get(id);
  if (!hash) {
    hash = modelHash(model);
    erasHashes.set(id, hash);
  }
  return { model, hash: await hash };
}

// ---- campaign state ----------------------------------------------------------------------

function starCount(p: ProgressRow | undefined): number {
  if (!p) return 0;
  return (p.star_result ? 1 : 0) + (p.star_strategist ? 1 : 0) + (p.star_mastery ? 1 : 0);
}

/**
 * Every era as the player stands, in play order. Stars are the normal (not Legend) ones; an era
 * unlocks with the sim's `unlocksNextEra` on the previous era's stars, the same helper the web
 * map uses, so the two never disagree. `released` is always true on test.
 */
async function campaign(
  db: D1Database,
  playerId: string,
  now: number,
  testMode: boolean,
): Promise<{ eras: EraState[]; progress: Map<string, ProgressRow> }> {
  const [eras, races, progress] = await db.batch([
    db.prepare('SELECT * FROM eras ORDER BY play_order'),
    db.prepare('SELECT * FROM era_races ORDER BY era_id, position'),
    db
      .prepare(
        `SELECT race_id, star_result, star_strategist, star_mastery, hidden_done, best_accuracy
         FROM era_progress WHERE player_id = ? AND legend = 0`,
      )
      .bind(playerId),
  ]);
  const byRace = new Map(
    (progress?.results as ProgressRow[] | undefined)?.map((p) => [p.race_id, p]) ?? [],
  );
  const allRaces = (races?.results ?? []) as EraRaceRow[];
  const nowIso = new Date(now).toISOString();

  const out: EraState[] = [];
  for (const row of (eras?.results ?? []) as EraRow[]) {
    const own = allRaces.filter((r) => r.era_id === row.id);
    const stars = own.reduce((n, r) => n + starCount(byRace.get(r.race_id)), 0);
    const prev = out.at(-1);
    const unlocked =
      row.play_order === 1 || (!!prev && unlocksNextEra(prev.summary.stars, prev.races.length));
    const releasedForReal = row.released_at !== null && row.released_at <= nowIso;
    out.push({
      row,
      races: own,
      releasedForReal,
      cleared: own.length > 0 && own.every((r) => starCount(byRace.get(r.race_id)) > 0),
      summary: {
        eraId: row.id,
        name: row.name,
        years: row.years,
        playOrder: row.play_order,
        released: testMode || releasedForReal,
        unlocked,
        stars,
        maxStars: STARS_PER_RACE * own.length,
      },
    });
  }
  return { eras: out, progress: byRace };
}

/** Whether production shows (and serves) a race: published, in a released era. */
function visibleInProduction(era: EraState, race: EraRaceRow): boolean {
  return era.releasedForReal && race.published === 1;
}

/**
 * The player an anonId plays as: the account it's linked to (player_ids), or itself while
 * anonymous. A signed-in browser already sends its account's player ID (it adopts it at sign-in,
 * and the account's own ID is linked to itself); resolving here also keys a browser still on a
 * linked anonymous ID by the account, where sign-in's Eras merge (7.5) moved its rows.
 */
export async function playerOf(db: D1Database, value: unknown): Promise<string> {
  if (!isAnonId(value)) throw new ApiError(400, 'bad-request', 'anonId must be a UUID');
  const linked = await db
    .prepare('SELECT player_id FROM player_ids WHERE anon_id = ?')
    .bind(value)
    .first<{ player_id: string }>();
  return linked?.player_id ?? value;
}

async function jsonBody(c: Ctx): Promise<Record<string, unknown>> {
  const text = await c.req.text();
  if (text.length > MAX_BODY_BYTES) throw new ApiError(400, 'bad-request', 'body too large');
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new ApiError(400, 'bad-request', 'body must be JSON');
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ApiError(400, 'bad-request', 'body must be a JSON object');
  }
  return body as Record<string, unknown>;
}

async function limit(c: Ctx, key: string): Promise<void> {
  if (!c.env.RUNS_LIMITER) return;
  const ip = c.req.header('cf-connecting-ip') ?? 'unknown';
  const { success } = await c.env.RUNS_LIMITER.limit({ key: `${key}:${ip}` });
  if (!success) throw new ApiError(429, 'rate-limited');
}

function randomSeed(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  // 31 bits: a positive integer in every language the seed travels through.
  return (a[0] as number) >>> 1;
}

function isDecisionList(value: unknown): value is Array<Record<string, unknown>> {
  return (
    Array.isArray(value) &&
    value.length <= MAX_DECISIONS &&
    value.every(
      (d) =>
        typeof d === 'object' &&
        d !== null &&
        !Array.isArray(d) &&
        Number.isInteger((d as Record<string, unknown>).lap) &&
        typeof (d as Record<string, unknown>).kind === 'string',
    )
  );
}

// ---- endpoints ---------------------------------------------------------------------------

/** POST /api/eras/attempts: the gating (production only) and a fresh seed. */
async function startAttempt(c: Ctx, now: number) {
  const body = await jsonBody(c);
  const playerId = await playerOf(c.env.DB, body.anonId);
  const { raceId } = body;
  const legend = body.legend ?? false;
  if (typeof raceId !== 'string' || raceId.length > 64) {
    throw new ApiError(400, 'bad-request', 'raceId is required');
  }
  if (typeof legend !== 'boolean') throw new ApiError(400, 'bad-request', 'legend is a boolean');

  const testMode = erasTestMode(c.env);
  const { eras } = await campaign(c.env.DB, playerId, now, testMode);
  const era = eras.find((e) => e.races.some((r) => r.race_id === raceId));
  const race = era?.races.find((r) => r.race_id === raceId);
  if (!era || !race) throw new ApiError(404, 'no-race', `${raceId} is not an Eras race`);

  // Production gating (spec §13). On test every era and race is open (spec §5, §16).
  if (!testMode) {
    if (!era.releasedForReal) throw new ApiError(403, 'era-unreleased', 'this era is coming soon');
    if (race.published !== 1) throw new ApiError(403, 'race-unpublished', 'this race is a draft');
    if (!era.summary.unlocked) throw new ApiError(403, 'era-locked', 'this era is locked');
    if (legend && !era.cleared) {
      throw new ApiError(403, 'legend-locked', 'Legend unlocks once the era is cleared');
    }
  }

  const bundled = await getErasRace(raceId);
  if (!bundled) throw new ApiError(503, 'model-missing', `race ${raceId} is not built yet`);

  const attemptId = crypto.randomUUID();
  const seed = randomSeed();
  const createdAt = new Date(now).toISOString();
  await c.env.DB.prepare(
    `INSERT INTO era_attempts (id, player_id, race_id, legend, seed, model_hash, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(attemptId, playerId, raceId, legend ? 1 : 0, seed, bundled.hash, createdAt)
    .run();

  const origin = new URL(c.req.url).origin;
  return {
    attemptId,
    seed,
    modelUrl: `${origin}/api/eras/races/${raceId}/model?h=${bundled.hash}`,
    modelHash: bundled.hash,
    difficulty: attemptDifficulty(era.row.play_order, legend),
    expiresAt: new Date(now + ATTEMPT_TTL_MS).toISOString(),
  };
}

/** The player's standing on a race after a submit (normal or Legend, as the attempt). */
export interface RaceProgress {
  stars: { result: boolean; strategist: boolean; mastery: boolean };
  hiddenDone: boolean;
  bestAccuracy: number | null;
}

/** POST /api/eras/attempts/:id's answer: the evaluated attempt and where it leaves the player. */
export interface SubmitResponse extends EraAttemptResult {
  attemptId: string;
  /** Stars this attempt earned that the player didn't have on the race before. */
  newStars: { result: boolean; strategist: boolean; mastery: boolean };
  /** This attempt wrote the race's history book entry (the player's first rewrite of it). */
  historyEntry: boolean;
  /** The player's best per star on the race, this attempt included (a worse one lowers nothing). */
  progress: RaceProgress;
  /** The player's place on the race's board by best accuracy (Legend's own board for Legend). */
  rank: number;
  total: number;
}

const toProgress = (p: ProgressRow | null): RaceProgress => ({
  stars: {
    result: !!p?.star_result,
    strategist: !!p?.star_strategist,
    mastery: !!p?.star_mastery,
  },
  hiddenDone: !!p?.hidden_done,
  bestAccuracy: p?.best_accuracy ?? null,
});

function progressRow(db: D1Database, playerId: string, raceId: string, legend: number) {
  return db
    .prepare(
      `SELECT race_id, star_result, star_strategist, star_mastery, hidden_done, best_accuracy
       FROM era_progress WHERE player_id = ? AND race_id = ? AND legend = ?`,
    )
    .bind(playerId, raceId, legend);
}

/**
 * POST /api/eras/attempts/:id: replays and evaluates the attempt (erasEval.ts) from the race
 * file it pinned, then keeps the best result per star and writes the history book entry on a
 * first rewrite. A tampered or malformed submission is refused (400) and nothing is stored, as
 * a Daily run's; the nightly re-grade corrects edited claimed grades.
 */
async function submitAttempt(c: Ctx, attemptId: string, now: number) {
  const db = c.env.DB;
  const body = await jsonBody(c);
  const playerId = await playerOf(db, body.anonId);
  const attempt = isAnonId(attemptId)
    ? await db
        .prepare('SELECT * FROM era_attempts WHERE id = ?')
        .bind(attemptId)
        .first<AttemptRow>()
    : null;
  // Someone else's attempt reads as no attempt, as a survivor run does.
  if (!attempt || attempt.player_id !== playerId) throw new ApiError(404, 'no-attempt');
  if (attempt.submitted_at !== null) throw new ApiError(409, 'already-submitted');
  if (now - Date.parse(attempt.created_at) >= ATTEMPT_TTL_MS) {
    throw new ApiError(409, 'attempt-expired', 'attempts expire 24 hours after they start');
  }
  if (!isDecisionList(body.decisions)) {
    throw new ApiError(400, 'bad-request', 'decisions must be a list of { lap, kind, ... }');
  }
  const untimed = body.untimed ?? false;
  if (typeof untimed !== 'boolean') throw new ApiError(400, 'bad-request', 'untimed is a boolean');
  const rivalClaims = body.rivalClaims ?? null;
  if (rivalClaims !== null && !Array.isArray(rivalClaims)) {
    return c.json(
      { error: 'bad-rival-claims', code: 'bad-claim', detail: 'rivalClaims must be a list' },
      400,
    );
  }

  // The race file the attempt pinned at its start (server-side; a client's echo of the hash
  // must agree with it). An attempt from before the pin, or a file rebuilt since, is refused.
  const bundled = await getErasRace(attempt.race_id);
  if (
    !attempt.model_hash ||
    !bundled ||
    bundled.hash !== attempt.model_hash ||
    (body.modelHash !== undefined && body.modelHash !== attempt.model_hash)
  ) {
    throw new ApiError(409, 'model-changed', 'this race changed since the attempt started');
  }
  const era = await db
    .prepare(
      'SELECT e.play_order FROM era_races r JOIN eras e ON e.id = r.era_id WHERE r.race_id = ?',
    )
    .bind(attempt.race_id)
    .first<{ play_order: number }>();
  if (!era) throw new ApiError(404, 'no-race', `${attempt.race_id} is not an Eras race`);
  const legend = attempt.legend === 1;
  const difficulty = attemptDifficulty(era.play_order, legend);

  const nowIso = new Date(now).toISOString();
  const grades = body.grades ?? null;
  let evaluated: EraAttemptResult;
  try {
    evaluated = evaluateAttempt({
      model: bundled.model,
      seed: attempt.seed,
      legend,
      difficulty,
      decisions: body.decisions,
      // Always a claim on submit (undefined would mean a full re-grade); null fails its check.
      grades,
      rivalClaims,
      untimed,
    });
  } catch (e) {
    if (e instanceof VerifyError) throw new ApiError(400, e.code, e.message);
    if (e instanceof BadRivalClaimsError) {
      // The sim's claim code (illegal-option, missing-claim, ...) says which check failed.
      return c.json({ error: e.code, code: e.claimCode, detail: e.message }, 400);
    }
    if (e instanceof EraRaceNotReadyError) throw new ApiError(503, 'race-not-ready', e.message);
    throw e;
  }

  // Only an unsubmitted attempt is written: a second submit finds it submitted.
  const write = await db
    .prepare(
      `UPDATE era_attempts SET decisions = ?, grades = ?, rival_claims = ?, untimed = ?,
         accuracy = ?, result = ?, submitted_at = ? WHERE id = ? AND submitted_at IS NULL`,
    )
    .bind(
      JSON.stringify(body.decisions),
      JSON.stringify(grades),
      rivalClaims === null ? null : JSON.stringify(rivalClaims),
      untimed ? 1 : 0,
      evaluated.accuracy,
      JSON.stringify(evaluated),
      nowIso,
      attemptId,
    )
    .run();
  if (!write.meta.changes) throw new ApiError(409, 'already-submitted');

  const before = await progressRow(
    db,
    playerId,
    attempt.race_id,
    attempt.legend,
  ).first<ProgressRow>();
  const s = evaluated.stars;
  const writes = [
    db
      .prepare(PROGRESS_UPSERT)
      .bind(
        playerId,
        attempt.race_id,
        attempt.legend,
        s.result ? 1 : 0,
        s.strategist ? 1 : 0,
        s.mastery ? 1 : 0,
        evaluated.hidden ? 1 : 0,
        evaluated.accuracy,
        nowIso,
      ),
  ];
  if (evaluated.rewrite) {
    writes.push(db.prepare(HISTORY_INSERT).bind(playerId, attempt.race_id, attemptId, nowIso));
  }
  const done = await db.batch(writes);
  const after = toProgress(
    await progressRow(db, playerId, attempt.race_id, attempt.legend).first<ProgressRow>(),
  );
  const had = toProgress(before);
  const standing = await db
    .prepare(
      `SELECT count(*) AS total,
         sum(CASE WHEN best_accuracy > ?3 THEN 1 ELSE 0 END) AS ahead
       FROM era_progress WHERE race_id = ?1 AND legend = ?2 AND best_accuracy IS NOT NULL`,
    )
    .bind(attempt.race_id, attempt.legend, after.bestAccuracy)
    .first<{ total: number; ahead: number | null }>();

  const response: SubmitResponse = {
    attemptId,
    ...evaluated,
    newStars: {
      result: after.stars.result && !had.stars.result,
      strategist: after.stars.strategist && !had.stars.strategist,
      mastery: after.stars.mastery && !had.stars.mastery,
    },
    historyEntry: !!done[1]?.meta.changes,
    progress: after,
    rank: (standing?.ahead ?? 0) + 1,
    total: standing?.total ?? 0,
  };
  return c.json(response);
}

export function registerEras(app: Hono<{ Bindings: Env }>) {
  app.get('/api/eras', async (c) => {
    const playerId = await playerOf(c.env.DB, c.req.query('anonId'));
    const testMode = erasTestMode(c.env);
    const { eras } = await campaign(c.env.DB, playerId, Date.now(), testMode);
    return c.json({ testMode, eras: eras.map((e) => e.summary) });
  });

  app.get('/api/eras/:eraId', async (c) => {
    const raw = c.req.param('eraId');
    const eraId = /^\d{1,3}$/.test(raw) ? Number(raw) : Number.NaN;
    if (!Number.isInteger(eraId)) throw new ApiError(400, 'bad-request', 'eraId is a number');
    const playerId = await playerOf(c.env.DB, c.req.query('anonId'));
    const testMode = erasTestMode(c.env);
    const { eras, progress } = await campaign(c.env.DB, playerId, Date.now(), testMode);
    const era = eras.find((e) => e.row.id === eraId);
    if (!era) throw new ApiError(404, 'no-era');

    const races: EraRaceSummary[] = [];
    for (const r of era.races) {
      // Production lists published races of released eras only: an unreleased era has none.
      if (!testMode && !visibleInProduction(era, r)) continue;
      const p = progress.get(r.race_id);
      const bundled = await getErasRace(r.race_id);
      races.push({
        raceId: r.race_id,
        position: r.position,
        stars: {
          result: !!p?.star_result,
          strategist: !!p?.star_strategist,
          mastery: !!p?.star_mastery,
        },
        hiddenDone: !!p?.hidden_done,
        bestAccuracy: p?.best_accuracy ?? null,
        reconstructed: bundled?.model.reconstructed === true,
        draft: r.published !== 1,
      });
    }
    const detail: EraDetail = { ...era.summary, legendUnlocked: era.cleared, races };
    return c.json(detail);
  });

  app.post('/api/eras/attempts', async (c) => {
    await limit(c, 'eras');
    return c.json(await startAttempt(c, Date.now()), 201);
  });

  app.post('/api/eras/attempts/:id', async (c) => {
    await limit(c, 'eras-submit');
    return submitAttempt(c, c.req.param('id'), Date.now());
  });

  // The race file an attempt pinned. Production serves published races of released eras only
  // (anything else reads as no race); test serves every built Eras race.
  app.get('/api/eras/races/:raceId/model', async (c) => {
    const raceId = c.req.param('raceId');
    const row = await c.env.DB.prepare(
      `SELECT r.published, e.released_at FROM era_races r JOIN eras e ON e.id = r.era_id
       WHERE r.race_id = ?`,
    )
      .bind(raceId)
      .first<{ published: number; released_at: string | null }>();
    const released = !!row?.released_at && row.released_at <= new Date().toISOString();
    const visible = !!row && (erasTestMode(c.env) || (released && row.published === 1));
    const race = visible ? await getErasRace(raceId) : null;
    if (!race) throw new ApiError(404, 'no-race');
    const pinned = c.req.query('h') === race.hash;
    return c.body(JSON.stringify(race.model), 200, {
      'Content-Type': 'application/json',
      'Cache-Control': pinned ? 'public, max-age=31536000, immutable' : 'public, max-age=300',
      ETag: `"${race.hash}"`,
    });
  });
}

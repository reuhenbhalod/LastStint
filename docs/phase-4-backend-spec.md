# Phase 4 Spec: Backend and Leaderboard (Cloudflare)

Status: in progress · Owner: @Abhiram

## Purpose

The server side of the Daily Race, on Cloudflare: serve the day's race, verify every run by replaying it with the shared TS sim, and compute score, percentile, rank, stats and the leaderboard. Reuhen builds the UI against the API here; together they close Gate G3 ("a full Daily Race is playable end to end with verified scores on the leaderboard").

## Stack (Implementation Plan, Phase 0 and 4)

| Piece | Choice |
|---|---|
| API | Cloudflare Worker, Hono router (`apps/worker`) |
| Database | Cloudflare D1 (SQLite), migrations in `apps/worker/migrations`, applied by Wrangler |
| Sim | `@boxthislap/sim`, the same code the browser runs |
| Cron | Worker `scheduled()` handler: daily queue check |
| Tests | vitest on `@cloudflare/vitest-pool-workers`, so the tests run inside workerd with a local D1 |
| Deploy | Wrangler; GitHub Actions deploys `main` once a Cloudflare API token is in the repo secrets |
| Web | Cloudflare Pages (Reuhen's side); the Worker only allows its origin through CORS |

**Decided Oct 26, 2026: the recommended option for every decision** (A1a–A3a, B1a–B3a, C1a–C4a).

## Where things stand

- `apps/worker` has stubs: Hono with CORS, `/api/health`, three 501 endpoints, an empty cron, and `0001_init.sql` (plan 4.2's `daily` and `runs` tables).
- **Cloudflare:** Wrangler 4.152 is installed but not logged in, and no D1 database exists yet (`database_id` is a placeholder).
- **Races:** 32 race models, about 14 KB each (under 2 KB gzipped). Only **Abu Dhabi 2021** has approved decision moments, so it is the only race that can be played as a daily today. Filling the queue is Phase 5.
- **Grading cost:** about 75 ms of CPU per moment (4 options × 300 samples) in Node. A run has 2–4 moments, so full verification costs about 150–300 ms of CPU.

### Found while writing this spec: the server can't reproduce a grade without knowing when each call was made

A grade is computed at the pause before a moment. It includes the player's calls already queued for later laps, such as a BOX for lap 40 pressed on lap 30 (`forkRun` keeps `run.decisions` for future laps). The call log only records each call's `lap`, not when the player made it. So the server can't tell whether that BOX was known at the lap 33 moment. The two cases grade differently.

**Fix (part of stage 1):** `decide()` stamps each call with `at`, the last completed lap when the call was made. To rebuild the grade at a moment, the server uses the calls with `at < moment.lap - 1`. This adds an optional field, so the change is backward compatible: sim 0.1.0 → 0.2.0, schema unchanged. The UI keeps calling `decide()` and sending `run.decisions` exactly as before.

## API

All JSON. Dates are `YYYY-MM-DD`.

| Method and path | Request | Response |
|---|---|---|
| `GET /api/daily?date=` | The player's date (see B1) | `{ date, number, raceId, seed, side, modelUrl, modelHash }` |
| `GET /api/races/:id` | | The race model JSON. Immutable, cached for a year (the URL carries the hash). |
| `POST /api/runs` | `{ date, anonId, decisions }` | `{ runId, result, calls, score, meanProbability, percentile, rank, total }` |
| `GET /api/runs/:date/:anonId` | | The same body. Lets a player who refreshes or switches tab see their result again. |
| `GET /api/daily/:date/stats` | | `{ runs, scoreHistogram, moments: [{ id, realOptionId, options: [{ id, share }] , matchedReal }] }` |
| `GET /api/daily/:date/leaderboard` | | Top 100 `{ rank, name, score }` |
| `GET /api/health` | | `{ ok, queueDays }` |

Errors use `{ error, detail? }` with 400 (invalid run), 404 (no daily or run), 409 (already submitted), 429 (rate limited).

### Verifying a run (plan 4.3)

1. The request is checked: the date is playable now (B1), `anonId` is a UUID, and `decisions` is an array of at most 500 calls.
2. The day's race model and seed are loaded. `validateDecisions` must pass, and every call needs `at < lap`, with `at` never decreasing along the log.
3. **Every moment has exactly one radio answer**, `{ kind: 'radio', lap: moment.lap, momentId, optionId }`. The calls for that lap must be exactly the chosen option's calls. Mode or pit calls that match no option are rejected.
4. **Replay.** `initRun(model, seed, { decisions })` runs to the flag, and `classify` gives the result.
5. **Grade each moment.** A run with only the calls known at that point (`at < moment.lap - 1`) is stepped to `moment.lap - 1`, then `gradeMoment` grades the moment's options. If `realOptionId` is null, the real team's call is graded too.
6. `scoreRun` gives the score, and the run and its calls are stored. The response returns the server's numbers, and the client shows those.

### Percentile and rank (plan 4.4)

- **Ordering.** Score (high first), then `meanProbability`, then the finishing position of the user's car (a disqualified car counts as last), then the earliest submission.
- **Percentile.** The share of the day's runs that score strictly lower.
- **Rank.** 1 + the number of runs ahead in that ordering. Both use indexed `COUNT` queries.
- **Caching.** Stats and the leaderboard sit in the Cache API for 60 seconds.

## D1 schema changes (`0002_phase4.sql`)

- **`daily`:**
  - `number`: the puzzle number, for the share text.
  - `model_hash`: the SHA-256 of the race model scheduled for that day.
- **`runs`:**
  - New columns: `mean_probability`, `finish_position`, `disqualified`.
  - The index becomes `(date, score DESC, mean_probability DESC, finish_position, created_at)`.
- **New table `run_calls`:** `(run_id, date, moment_id, option_id, band, matched_real)`.
  - This keeps the stats queries plain `GROUP BY`s.
- **Pinned model.** A run is verified against the model whose hash the day pinned. If that race file is later rebuilt, the server refuses to serve or verify a mismatched model, so existing scores never shift.

## Decisions

← marks the recommendation.

### A. Cloudflare platform

**A1. Worker plan (CPU per request)**

- **a. Workers Paid ($5/month) before the first public deploy.** ← recommended
  - The CPU limit is 30 s by default, so full 300-sample grading of every run fits easily.
  - Includes 10M requests a month. D1 stays inside its free allowance at launch scale.
  - Stages 1–4 are built and tested locally, where no CPU limit applies, so nothing has to be paid for tonight.
- b. The free plan.
  - It allows 10 ms of CPU per request. That is not enough for one moment's grade, so the server would have to accept client grades, which breaks plan principle 5 ("never trust the client").

**A2. Where race models live**

- **a. Bundled into the Worker** and served at `GET /api/races/:id?h=<hash>`. ← recommended
  - `data/races` stays the single source of truth.
  - 32 races × 14 KB is far under the Worker size limit.
  - A new race ships with a deploy, which CI does on merge to `main`.
- b. An R2 bucket the schedule script uploads to. This lets a race go live without a deploy, but it adds a second copy to keep in sync.
- c. Static files on Pages (Reuhen's side). The Worker would still need its own copy to verify runs.

**A3. Accounts and deploy tonight**

- **a. You log in once and I set up and deploy the rest.** ← recommended
  - You run `! npx wrangler login` in `apps/worker`. I then create the D1 database, apply the migrations, and deploy to `pitwall.<your-subdomain>.workers.dev`.
  - CI deploys `main` once you add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as repo secrets.
  - The first deploy needs your OK, because it is public.
- b. Local only tonight; deploy later.

### B. Game rules

**B1. When the day rolls over**

- **a. The player's local midnight, as Wordle does.** ← recommended
  - The client sends its local date. The server accepts any date that is "today" somewhere on Earth (UTC−12 to UTC+14), and leaderboards are per date.
  - Players expect a daily game to reset at their own midnight.
- b. UTC midnight. That is 4–5 pm in California, mid-session for US players.
- c. Pacific midnight. That is fine for the US and Europe, but mid-afternoon in Asia and Australia.

**B2. When the server grades**

- **a. Synchronously on submit, with the full 300 samples.** ← recommended
  - That is about 150–300 ms of CPU, and the player gets the verified result in the same response. I'll measure it inside workerd in stage 2 and report before relying on it.
- b. Synchronously with fewer samples, such as 100. Faster, but the server's bands could then differ from the ones the client showed during the race.
- c. Asynchronously (return the finish first, grade on a queue). More moving parts; only worth it if (a) measures too slow.

**B3. Leaderboard names**

- **a. A generated name from the anonId**, such as "Late Braker 417". Deterministic, nothing to moderate. ← recommended
- b. A player-chosen nickname. Needs a profanity filter and moderation.
- c. No names, ranks only.

### C. Abuse and operations

**C1. Rate limiting (plan 4.5)**

- **a. The Workers Rate Limiting binding: 10 run submissions per minute per IP**, configured in `wrangler.jsonc` and tested. ← recommended
- b. A WAF rule set up in the dashboard. Not in the repo, and not testable.
- Turnstile is added only if bots show up (plan 4.5).

**C2. Error tracking**

- **a. Workers observability logs now (already on); Sentry in Phase 6** with the frontend's. ← recommended
- b. Sentry now. Needs an account and DSN tonight.

**C3. Running low on races (plan 4.6)**

- **a. The cron checks how many days are scheduled ahead.**
  - It logs a warning below 7 days and an error when tomorrow is missing.
  - `/api/health` reports `queueDays`.
  - An optional `ALERT_WEBHOOK` secret (Discord or Slack) gets the same message.
  - ← recommended
- b. Email alerts. Needs Email Routing set up on a domain, which you don't have yet.

**C4. Scheduling races (plan 5.4)**

- **a. A `schedule` script.** ← recommended
  - Run as `pnpm --filter @boxthislap/worker schedule --from <date> --days N [--race id]`.
  - It picks only **eligible** races: approved moments and a G1 pass or borderline.
  - It draws a random seed per date with `crypto` (never derived from the date), numbers the dailies, pins the model hash, and writes to D1 through `wrangler d1 execute` (`--local` or `--remote`).
  - It never overwrites a date already published.
- b. An admin API endpoint behind a secret. A public write surface we don't need yet.

Today only Abu Dhabi 2021 is eligible. For testing, `--allow-ineligible` schedules any race, and it is refused with `--remote`.

## Stages

Each stage ends with its tests passing and one commit pushed.

| Stage | Work | Done when |
|---|---|---|
| **1. Sim: call timing** | `decide()` stamps `at`, `validateDecisions` checks it, sim 0.2.0, `docs/sim-api.md` updated (the radio answer is required and the server reconstructs grades) | Sim tests pass, plus a new test: a grade rebuilt from the log equals the live grade |
| **2. Worker test harness and verification** | vitest-pool-workers, migration 0002, `verify.ts` (steps 1–6 above, a pure function), race-model bundle with hashes. **Measure grading CPU in workerd.** | A played Abu Dhabi run (from `playDailyRace`) verifies to the identical score; tampered logs (wrong option, missing radio, past-lap call, bad `at`) are rejected |
| **3. Endpoints** | `/api/daily`, `/api/races/:id`, `POST /api/runs`, `GET /api/runs/:date/:anonId`, stats, leaderboard, CORS, date window (B1), names (B3) | Endpoint tests on a local D1: submit → rank and percentile, duplicate → 409, stats and leaderboard numbers by hand-computed fixtures |
| **4. Abuse and ops** | Rate limit binding, cron queue check, webhook alert, `/api/health` `queueDays`, `schedule` script | Tests for the rate limit (429) and the cron; `schedule --local` fills a local D1 and `wrangler dev` serves a playable daily |
| **5. Deploy** (after A3 login) | Create D1, apply migrations remotely, deploy, schedule Abu Dhabi 2021 for the coming days, CI deploy job | `curl` on the live `/api/daily` and a scripted full run submitted to the live Worker returns a verified score |
| **6. Docs** | `docs/api.md` for Reuhen: endpoints, request/response shapes, the radio-answer rule, local dev (`pnpm --filter @boxthislap/worker dev` + Vite proxy) | Reuhen can call every endpoint from the doc alone |

## Out of scope

- Mystery Races, share text and persona (Phase 6). The API returns `number`, `calls` (bands) and `percentile`, which is everything the share text needs.
- Accounts and cross-device history (Phase 7).
- Filling the race queue to 21 (Phase 5).

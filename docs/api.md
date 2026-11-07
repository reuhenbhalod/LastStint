# LastStint API

The game's backend: a Cloudflare Worker (`apps/worker`) with a D1 database. It serves the day's race and verifies every run by replaying it with the same sim the browser runs (`@laststint/sim`, see [sim-api.md](sim-api.md)). The client sends its calls, never a score.

- **Base URL.**
  - Production: the Worker's URL (set `VITE_API_BASE` in the web app).
  - Local dev: Vite proxies `/api` to `wrangler dev` on port 8787 (see [Local development](#local-development)).
- **Format.** JSON everywhere. Dates are `YYYY-MM-DD`.
- **Errors.** `{ error, detail? }` with:
  - `400` `bad-request`, or a verification code (see [Rejections](#rejections))
  - `404` `no-daily` / `no-run` / `no-race`
  - `409` `already-submitted`
  - `429` `rate-limited`
  - `503` `model-changed`

## The game's calls, in order

1. **Make a player ID once.** Store `crypto.randomUUID()` in `localStorage` as `anonId`; it is the player's only identity (no accounts).
2. **Get the daily.** `GET /api/daily?date=<the player's local date>`.
3. **Load the race.** `GET modelUrl` (immutable, so the browser caches it).
4. **Check for a run already played today.** `GET /api/runs/:date/:anonId`. A `200` means show the results screen; a `404` means play.
5. **Play.** Use `initRun(model, seed, { decisions: [] })`, then follow [sim-api.md](sim-api.md).
   - Pause and start grading **straight after** the lap before a moment.
   - At the pause, once the grade is ready and **before** answering, call `claimGrade(run, moment, grade)` and keep the result.
   - Answer each decision moment with `answerMoment()`.
6. **Submit.** `POST /api/runs` with `run.decisions` and the kept grades.
7. **Show the results.** Use the response, plus `GET .../stats` and `GET .../leaderboard` for the post-race screens.

## Endpoints

### `GET /api/daily?date=YYYY-MM-DD`

Today's race for the player's **local** date. A date is playable while it is "today" somewhere on Earth (UTC−12 to UTC+14), so every player gets a new race at their own midnight. A date that isn't playable yet returns `404 no-daily`.

```json
{
  "date": "2026-10-27",
  "number": 1,
  "raceId": "abu-dhabi-2021",
  "seed": 2128060267,
  "side": "HAM",
  "modelUrl": "https://…/api/races/abu-dhabi-2021?h=4d4b36be…",
  "modelHash": "4d4b36be…"
}
```

- `number` is the puzzle number for the share text ("Pit Wall #12").
- `side` is the driver the player runs. It is the same as `model.userSide`.
- `503 model-changed` means the race file was rebuilt after this day was scheduled. The day can't be played; this needs a fix on our side.

### `GET /api/races/:id`

A race model (schema v9). Requested through `modelUrl` (with `?h=<hash>`), it is cached for a year. Without the hash, it is cached for 5 minutes.

### `POST /api/runs`

```json
{
  "date": "2026-10-27",
  "anonId": "…uuid…",
  "decisions": [ …run.decisions… ],
  "grades": [ …one claimGrade() result per moment… ]
}
```

Each entry of `grades` is `{ momentId, probabilities, real? }`:
- `probabilities` are the moment's option chances, in the moment's option order.
- `real` is the real team's call's chance, present only when the real team took none of the options.

`claimGrade()` (from `@laststint/sim`) builds the entry; don't build it by hand.

**The race plan** (docs/strategy-planner-spec.md). A run that logged a plan at takeover (one `{ kind: "plan" }` call, made at the takeover lap) adds one more entry, `{ momentId: "plan", probabilities }`: each plan's chance, in the order graded (the engineer's plans a, b, c, then `own` if the player built and picked their own). `claimPlanGrade()` builds it. The plan counts as one more call in the score. A run without a plan has no plan entry and no plan grade.

**Before it responds, the server:**

1. Checks the call log.
2. Replays the race to the flag.
3. Checks the grades' shape: one per moment (and one for the plan, if the run has one), one chance per option, each a whole number of the 300 samples. The nightly re-grade also rebuilds the engineer's plans and checks a picked one matches.
4. Scores the run from them, stores it and ranks it.

**Why the game's grades.** Full grading takes about 100 ms, and Cloudflare's free plan allows 10 ms per request. So the server scores from the game's grades, and a nightly job re-grades every run with the full 300 samples. Grading is deterministic, so an honest run always matches. A run whose grades were edited gets its true score overnight, so its score, rank and bands can change the next day.

It returns `201`:

```json
{
  "runId": "…",
  "date": "2026-10-27",
  "number": 1,
  "raceId": "abu-dhabi-2021",
  "score": 70,
  "meanProbability": 0.41,
  "finishPosition": 2,
  "disqualified": false,
  "result": { "order": ["VER", "HAM", "…"], "finishers": ["…"], "disqualified": [], "gaps": { "HAM": 1.2 } },
  "calls": [
    {
      "momentId": "sc-53",
      "lap": 53,
      "chosen": "box-soft",
      "band": "yellow",
      "points": 70,
      "probability": 0.41,
      "best": "box-medium",
      "options": [{ "id": "stay-out", "probability": 0.2, "behindBest": 24, "band": "red" }],
      "real": { "optionId": "stay-out", "probability": 0.2, "band": "red" },
      "matchedReal": false
    }
  ],
  "plan": {
    "chosen": "b",
    "band": "green",
    "points": 100,
    "probability": 0.47,
    "best": "b",
    "options": [{ "id": "a", "probability": 0.16, "behindBest": 31, "band": "red" }]
  },
  "percentile": 63,
  "rank": 120,
  "total": 324
}
```

- **Show these numbers.** They are the server's, and they match what the game computed during the race when the client is honest.
- **`calls`** are in lap order.
  - `band` is the share card's coloured square: green, yellow, orange or red.
  - `real` is the real team's call, graded against the same best option.
- **`percentile`** is the share of the day's runs that scored strictly lower (0–100).
- **`rank`** orders by score, then `meanProbability`, then `finishPosition`, then the earliest submission.
- **`409 already-submitted`.** There is one run per `anonId` per date. Fetch it with `GET /api/runs/:date/:anonId`.
- **Grace period.** A run can be submitted for 6 hours after its date ends everywhere, so a race finished just after midnight still counts.
- **Rate limit.** 10 submissions per minute per IP, then `429`.

#### Rejections

A `400` with one of these codes means the client built the call log wrongly. The checks are listed in [sim-api.md](sim-api.md#server-verification).

| `error` | Usual cause in the UI |
|---|---|
| `invalid-calls` | Calls not made through `decide()` (no `at`), edited, or reordered |
| `missing-answer` | A moment answered without `answerMoment()`, or answered twice |
| `bad-grades` | `grades` missing, or not built with `claimGrade()` for every moment |
| `bad-answer` | A call queued for a moment's lap, or another call made at the pause before the answer |
| `bad-request` | Malformed body, date or `anonId` |

### `GET /api/runs/:date/:anonId`

The same body as the `POST` response, with the standing recomputed now. It is used after a refresh, or to show today's result on return. Returns `404 no-run` if the player hasn't submitted.

### `GET /api/daily/:date/stats`

How everyone played the day. It is cached for 60 seconds, and future dates return `404`.

```json
{
  "date": "2026-10-27",
  "runs": 324,
  "meanScore": 58.5,
  "scores": [{ "score": 0, "runs": 40 }, { "score": 70, "runs": 120 }, { "score": 100, "runs": 164 }],
  "moments": [
    {
      "id": "sc-53",
      "lap": 53,
      "realOptionId": "stay-out",
      "matchedReal": 0.31,
      "options": [{ "id": "stay-out", "label": "Stay out", "share": 0.31 }]
    }
  ]
}
```

- `scores` is the score distribution (one entry per distinct score).
- `matchedReal` is the share of players who made the real team's call.

### `GET /api/daily/:date/leaderboard`

The top 100, cached for 60 seconds.

- The response is `{ date, size, entries: [{ rank, name, score }] }`.
- A signed-in player with a display name shows by it. Everyone else gets a name generated from the player ID, such as "Late Braker 417". The same player always gets the same name, and the ID itself is never shown.
- To mark the player's own row, compare names with `displayName(anonId)`: it's 20 lines in `apps/worker/src/names.ts`, which you can copy.

### Sign-in and profile (docs/auth0-spec.md)

The credential is an ID token: Auth0's when `AUTH0_DOMAIN` and `AUTH0_CLIENT_ID` are set (wrangler vars), else Google's (`GOOGLE_CLIENT_ID`). A Google sign-in through Auth0 (`google-oauth2|<id>`) finds the account made with the old Google button.

| Endpoint | What it does |
|---|---|
| `POST /api/auth` `{ credential, anonId }` | Signs in. It links this browser's anonId to the account (made on first sign-in) and returns `{ playerId, name, email, displayName, favouriteTeam, needsProfile, created, admin }`. The browser adopts `playerId`. `/api/auth/google` is the old name. |
| `POST /api/profile` `{ credential, displayName, favouriteTeam }` | Sets the profile and returns `{ displayName, favouriteTeam }`. The name is 3–20 letters, digits, spaces, `_`, `-` or `.`, unique ignoring case. Errors: 400 `bad-name` / `bad-team`, 409 `name-taken`, 404 `no-account` (sign in first). |
| `GET /api/players/:anonId?today=YYYY-MM-DD` | `{ account, streak }`. `account` is null when signed out; it carries the profile fields above. |

### `GET /api/health`

`{ ok, queueDays }`: how many consecutive days, from today (UTC), have a race scheduled.

## Admin

For the people running the game (`apps/worker/src/admin.ts`, the website's `/admin` page). Every request sends the admin's ID token (Auth0's, or Google's without Auth0 set up) as `Authorization: Bearer <token>`. The token must verify (the issuer's keys, our client ID, not expired), its email must be verified, and the email must be in `ADMIN_EMAILS` (`apps/worker/wrangler.jsonc` vars, comma-separated). Otherwise: 401 `sign-in-required` / `bad-credential`, or 403 `not-admin`.

| Endpoint | What it does |
|---|---|
| `GET /api/admin/me` | `{ admin: true, email, sub }` |
| `GET /api/admin/races` | The playable races (those with decision moments): id, name, userSide, rival, moments, seed, hash |
| `GET /api/admin/schedule?from&to` | Days from a week ago to 60 days ahead (default): date, number, raceId, runs, and `current` (the day still pins the race file's hash) |
| `POST /api/admin/schedule` `{ from, days, raceId? }` | Schedules the dates that aren't scheduled yet, rotating the playable races (or always `raceId`), numbered on from the last day |
| `POST /api/admin/day` `{ date, raceId }` | Sets a day's race (a new day, or one with no runs: 409 `day-has-runs` otherwise) |
| `POST /api/admin/repin` | Re-pins today's and later days to their race file's current hash; days with runs are left as they are |
| `POST /api/admin/runs/clear` `{ date }` | Deletes the admin's own runs on that day (every browser linked to their Google account), to play it again |

### Tickets

The game-change ticket tracker (`apps/worker/src/tickets.ts`, the admin page's Tickets tab at `/admin/tickets`), on the same admin check as above. A ticket is `{ id, title, description, category, status, notes, source, createdBy, assignee, createdAt, updatedAt, completedAt }`; times are Unix milliseconds. `assignee` is an admin's email (one of `ADMIN_EMAILS`, 400 otherwise) or `''` for unassigned; the page's Pick up sends `{ assignee: <you>, status: 'in_progress' }` for an open ticket.

| Endpoint | What it does |
|---|---|
| `GET /api/admin/tickets` | `{ tickets, admins, me }`: every ticket, newest first; the admins a ticket can be assigned to; the caller's email |
| `POST /api/admin/tickets` `{ title, category, description?, status?, notes?, source?, assignee? }` | `201 { ticket }`. `createdBy` is the admin's email |
| `PATCH /api/admin/tickets/:id` `{ any of those fields }` | `{ ticket }` |
| `DELETE /api/admin/tickets/:id` | `{ ok: true }` |

- **Fields.** `category` is `bug`, `feature`, `ui`, `content`, `question` or `other`; `status` is `open` (the default), `in_progress` or `done`. The title is trimmed and can't be empty. Lengths: title 200, description and notes 10,000, source 500 characters. Any other field is refused.
- **`completedAt`** is set when a ticket becomes `done` (kept while it stays done) and cleared when it leaves `done`.
- **Errors.** `400 invalid` (with a `detail`), `400 bad-json`, `400 bad-id` (the id must be a positive integer), `404 not-found`, `413 too-large` (over 64 KB), `415 bad-content-type` (send `application/json`). The admin check comes first, so a signed-out call always gets 401.

## Operations

| Task | Command (from the repo root) |
|---|---|
| Run the Worker locally | `pnpm --filter @laststint/worker dev` (port 8787; regenerates the race bundle first) |
| Create local tables | `pnpm --filter @laststint/worker migrate:local` |
| Schedule dailies | `pnpm --filter @laststint/worker schedule --local --days 7` (`--remote` for production; `--race <id>`, `--from <date>`, `--dry-run`) |
| Play a daily against a Worker | `pnpm --filter @laststint/worker smoke --url http://localhost:8787` |
| Test | `pnpm --filter @laststint/worker test` (runs in workerd with a local D1) |
| Seed the ticket tracker | `pnpm --filter @laststint/worker tickets:seed:local` (`tickets:seed:remote` for production), after `migrate:local` / `migrate:remote`. Loads `apps/worker/data/tickets.json`; tickets whose title is already there are skipped, so it's safe to run again |
| Rebundle races after `pipeline build` | `pnpm --filter @laststint/worker races` (CI fails if the bundle is stale) |

**Scheduling.**
- Only races that have approved decision moments **and** a G1 pass or borderline in `docs/g1-report.md` can be scheduled.
- Each date gets a random seed, the next puzzle number, and the race model's SHA-256.
- A rebuilt race file doesn't change days already scheduled: the Worker refuses to serve a day whose model hash no longer matches.

**Queue check.**
- A cron runs at 09:00 UTC and checks how many days are scheduled ahead.
- It logs a warning under 7 days and an error when tomorrow is missing.
- If the `ALERT_WEBHOOK` secret is set (`npx wrangler secret put ALERT_WEBHOOK`, a Discord or Slack webhook URL), it posts the same message there.

## Local development

```sh
pnpm --filter @laststint/worker migrate:local          # once
pnpm --filter @laststint/worker schedule --local --days 7
pnpm --filter @laststint/worker dev                    # Worker on :8787
pnpm --filter @laststint/web dev                       # Vite on :5173, proxies /api
```

Local D1 data lives in `apps/worker/.wrangler/` (git-ignored).

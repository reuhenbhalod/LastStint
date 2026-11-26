# Test suite: report

Spec: `docs/test-suite-spec.md`. The full control list is generated into
`docs/test-suite-coverage.md` (`E2E_COVERAGE=1 pnpm --filter @laststint/web e2e`, then
`pnpm --filter @laststint/web coverage:report`).

## Result (Nov 25)

All on branch `test-suite` (local, not pushed), merged from the six agent branches, reviewed,
fixed and re-run:

| Suite | Result |
|---|---|
| Unit and component (`pnpm test`) | sim 2386, worker 331 (72 contract tests over all 54 routes), web 1289 + 1 skipped |
| Browser screens (`e2e`, phone + desktop) | 599 passed, 24 skipped (16 Linux-only screenshots, 8 existing skips), 28 min on the Mac |
| Flows against wrangler dev + local D1 (`e2e:flows`) | 12 passed, 9.5 min |
| Screenshots (Linux, Playwright noble image) | 16 passed on three runs |
| Coverage guard (`coverage:guard`) | 0 not covered: 831 of 1218 controls pressed, 172 through the race screen on another route, 215 excused (`e2e/coverage-exceptions.json`) |
| Typecheck, biome | clean |

CI (`.github/workflows/ci.yml`, GitHub-hosted): the e2e job records coverage and fails on the
guard, uploads `control-coverage`, and a new `flows` job runs before deploy.

**Bugs fixed here, each with a test:** the admin race picker's message named the previous race;
the phone account button had no accessible name. (`scripts/schedule.ts` misreading the G1
report was fixed on main by #58.)

**For the owner (not changed):**
- Turkey 2021's team radio labels every dry tyre "Dry" (`raceRules.ts` two-compound rule); the
  test is `test.fixme`.
- On phone, the tutorial coach card covers the button it points at.
- A failed sign-in shows no message on the Daily card.
- Gauntlet rounds and the Daily share one per-IP rate limit.

**Watch in CI:** controls that show only for a moment or on some race paths (a disabled
"Grading your calls…", a battle answer one path offers) can be recorded in one run and not the
next. Two showed up across three full runs and are now pressed or excused. If the guard flags
one in CI, press it in a spec or excuse it with a reason; don't loosen the guard.

## S1: where we start (Nov 24)

### Browser tests

The recorder is `apps/web/e2e/coverage.ts`, which every spec now imports. With it on, the
existing 67 tests press **144 of the 707 controls they bring on screen (20%)**, across 15
routes. A row of a long list (a timing tower, a leaderboard) counts as one control.

| Route | Pressed | Not pressed |
|---|---|---|
| `/eras/:n/:race` (an Eras race) | 60 | 244 |
| `/` (Daily: intro, race, result) | 19 | 100 |
| `/eras/:n/:race/legend` | 18 | 80 |
| `/gauntlet` | 10 | 63 |
| `/admin` (Today, announcement) | 4 | 15 |
| `/admin/schedule` | 6 | 16 |
| `/admin/eras` | 2 | 14 |
| `/eras/:n/:race/leaderboard` | 1 | 11 |
| `/eras`, `/eras/:n` | 4 | 20 |
| Admin players, runs, tickets, stats, versus | 20 | 0 |

**Never on screen in any test:** `/tutorial`, `/privacy`, `/terms`, `/credits`, the profile
sheet and the account menu signed in, and the Daily result's share. Their controls are missing
from the table above, so they count as untested. The source inventory at the end of the
coverage file lists where they live.

**Not pressed on the Daily, for example:**
- the plan cards B and C, "Build your own", "Change plan" and "Keep ours";
- "Box as planned", "Box next lap" on each tyre, and "One more lap";
- every battle and defence option;
- the headset modes (Manage, Push, Lift and coast);
- the radio replies ("No, stay out", "Not yet", track limits);
- the timing tower and leaders rows, the driver details, "Follow car", the sound toggle, and the
  Calls, Radio and Car tabs.

**Accessible names (D7):** every control seen has one. Some names run several labels together
(an option's title, detail and tag in one button, such as "Late-brake up the insideClassic
hairpin lungeRisky"). They're findable but read badly to a screen reader, so S3 gives them
proper names. The timing tower's list has no label.

**Fixed on the way:** `admin-tabs.spec.ts` broke with PR #54. It checked the announcement banner
on `/versus`, which a production build now sends home, where the first-visit intro covers the
banner. It now checks the banner on `/gauntlet`. The full suite passes: 67 passed, 2 skipped.

### Component tests

74 unit test files. None renders a component and presses it: the web package has no jsdom or
Testing Library (today's component tests render static HTML, like `TopBar.test.ts`). S2 adds the
harness.

### Worker

Every one of the 54 routes appears in a Worker test. S5 checks depth per route:
- auth: signed out, a player, an admin;
- bad input and limits;
- rate limits;
- the error responses.

### Rule cases to cover (screens involved)

From the game's calls and radio (`apps/web/src/game`, `state`, `engine`):

- **Calls:**
  - pit: box now, box next lap on each tyre, one more lap, box as planned;
  - stop owed, and the last legal lap;
  - modes: pace, ERS, fuel, lift and coast;
  - quick calls;
  - battle and defend, with a boost;
  - team orders;
  - blue flags and track limits;
  - fuel calls in refuelling Eras.
- **Engineer and driver:**
  - plans: offer, Switch (including a stop on the coming lap), Keep ours until the race
    changes, Build your own;
  - the driver's box request asking again only as the tyres get worse;
  - replies.
- **Race events:**
  - SC or VSC at or after the takeover, and its cause;
  - a red flag before the takeover;
  - rain arriving or going, and wet tyres;
  - faults (gear stuck, power loss, puncture, damage);
  - storyline retirements, avoided or repeated;
  - the rival retiring;
  - penalties at the flag on the result.
- **Session:**
  - timed decisions running out, and the untimed opt-out;
  - a reload mid-race;
  - a Daily already played;
  - streaks across days and time zones;
  - the share text.
- **Gauntlet:**
  - round to round, a lost round;
  - the Menu out of a race;
  - the start runs once.
- **Eras:**
  - unlock at 70%;
  - stars;
  - rewrite or no rewrite;
  - hidden objectives;
  - Legend, its leaderboards and the history book.
- **Admin:**
  - every tab and edit;
  - the announcement banner;
  - a non-admin refused.

## Next: S2-S5 as an agent chain

| Agent | Stage | Scope |
|---|---|---|
| A | S2 | jsdom and Testing Library harness; component tests for the shared controls (plans, radio, headset, battle and quick calls, towers, track map selection, banner, account, profile, intro, how to play, tutorial) |
| B | S3 | Daily race and result screens: every control, every state, phone and desktop; key screenshots |
| C | S3 | Gauntlet, intro and tutorial, legal and credits, account and profile |
| D | S3 | Eras: map, era, race, results, legend, leaderboards, history book |
| E | S3 | Admin: every tab and every control, and a non-admin refused |
| F | S4 + S5 | Flows against a local Worker and D1; Worker contract depth per route |

After them: review, verify (break each control and see its test fail), fix, then QA. S6 (the CI
guard on GitHub-hosted runners) comes after S3, once the matrix is near 100%.

## S4: L3 flows against a local Worker and D1 (agent F)

`pnpm --filter @laststint/web e2e:flows` (`apps/web/playwright.flows.config.ts`, specs in
`apps/web/e2e/flows`). Nothing is mocked except Google's sign-in script.

**The local stack** (started fresh on every run, never reused):

1. `e2e/flows/stack.mjs`: a new local D1 in a temp directory (`--persist-to`), every
   migration, the dailies from the fixed date (`schedule --local --persist-to <dir> --from
   2026-06-01 --days 28 --race abu-dhabi-2021`), an Eras seed (Eras 10 and 9 released and
   published; each project's Eras player on 20 Era 10 stars), then `wrangler dev --local` on
   port 8851 (inspector 5352) with an env file: `FLOWS_TEST=true`, `FLOWS_NOW`, Google sign-in with the flows' own
   key (`GOOGLE_JWKS`, Auth0 off), `ADMIN_EMAILS=admin@flows.test`, `SURVIVOR_POOL` (Spain 2020),
   `ERAS_TEST_MODE=false`.
2. `vite build` + `vite preview` (`e2e/flows/vite.flows.config.ts`) on port 5351, with
   the Google sign-in path on and `/api` proxied to (1).

**The fixed date.** The Worker reads the time in about 40 places, so the least invasive hook
is one clock swap at the top of `fetch()` (`apps/worker/src/testClock.ts`). It does nothing
unless the `FLOWS_TEST` var is exactly `"true"`, which only the flows' env file sets (not
`wrangler.jsonc`, not staging). When on, "now" is the request's `x-flows-now` header, else
`FLOWS_NOW`, running on in real time. The browser's clock is put at the same time
(`page.clock.install`), and Playwright sends the header with every request, so the next day is
one `setTime()` call. A contract test checks the header is ignored when the var is off.

| Flow | What it checks |
|---|---|
| `daily.spec.ts` | The day's Daily (the card shows no number, #58) intro → plan → every call → result; the Worker's 201 (its own score, rank 1/1, number in the API); the stored run, streak 1 and leaderboard from the API; Share result: the line (no number) and link on the clipboard, "Copied!"; reload → straight to the result; with the browser's saved run gone, the game fetches the run from the Worker and shows it; a second submit is 409; next day: the next Daily, streak 2 in the API and on screen; day 1 not playable on day 4 |
| `gauntlet.spec.ts` | Start (201, Spain 2020), round 1 won (the Worker's verdict), the next race's brief, round 2 lost (box for softs at every stop call), "run over"; the run in the API (over, 1 round, history won/lost), the all-time board one longer, a late round refused (409) |
| `eras.spec.ts` | Production mode: Era 9 locked "1 to go" and the Worker refuses its attempt (403 era-locked); Belgium 2023 from the Era 10 page to its stars (the Worker deals the seed, replays and scores); the new star makes Era 10 21+ stars; Era 9 opens on the map and Turkey 2021 starts (201) |
| `account.spec.ts` | A bad token (401, still signed out); sign-in (a new account adopts its player ID), the profile sheet saved (POST /api/profile), the account in the API, the old anonymous ID linked, reload stays signed in, sign out (fresh anonymous ID, no account), another browser finds the same account with no profile prompt; an admin account gets the Admin menu item |
| `admin.spec.ts` | A non-admin is refused on /admin (403 from the Worker); the admin signs in, sets an announcement, changes day 4's race to Spain 2020; both edits in the audit log; a player sees the banner, and on day 4 the Spain 2020 daily; clearing it takes the banner down |

**Not covered locally:** Auth0's hosted login and its redirect back (`completeLogin`), Google's
own popup and One Tap, fetching the real issuers' keys, the daily cron (`scheduled`), and the
nightly re-verification. The Worker's Auth0 token path is in `apps/worker/test/auth.test.ts`.
**Phone and desktop.** Both projects run every flow against the one stack. Each plays its own
days and players (`e2e/flows/env.ts` PROJECTS: desktop from 2026-06-01, phone from 2026-06-15;
its own Eras player, account and display name), so they never meet; the Gauntlet's shared
all-time board is checked relative to what was there before.

**Runtime:** 9-11 minutes for both projects (stack start and web build ~1.5 min; per project
Daily ~1.3 min, Eras ~1 min, Gauntlet ~2.5 min, the rest seconds). Two full runs back to back
(the second with `E2E_COVERAGE=1`) passed 12/12. Run it detached or with a long timeout: a
shell that kills the run at 10 minutes takes the stack down mid-test (the "Gauntlet never
answers" failure seen before the pause). `FLOWS_DEBUG=1` shows the Worker's request log;
`stack.mjs` always reports on stderr if `wrangler dev` exits. A run's D1 is in
`$TMPDIR/laststint-flows-*`; Playwright kills the stack hard, so the folder can be left behind.

**Control coverage** (`E2E_COVERAGE=1`): the flows press 70 of the 362 controls they bring on
screen across 7 routes (`/` 23/102, `/gauntlet` 22/100, `/eras/:n/:race` 15/94, `/admin` 6/21,
`/admin/schedule` 2/21, `/eras` 1/12, `/eras/:n` 1/12), with none unnamed. The flows press what
the journeys need; every control is the S3 screen specs' job.

**Mutation checks** (each broke a test, then restored): Share result not setting "Copied!";
the Gauntlet board tabs doing nothing; the admin announcement sent changed (caught only after
the banner check was made case-exact); the profile sheet dropping the team.

## S5: Worker contract tests (agent F)

`apps/worker/test/contract.test.ts` walks all 54 routes (28 admin, 26 public): every admin
route signed out, with a non-Bearer header, an oversize token, a bad token and a player (401,
401, 401, 401, 403 with the exact body) and with sign-in off (503 auth-off); expired, wrong
audience, wrong issuer, unverified and re-signed admin tokens; then each route's success, bad
input (missing, wrong type, invalid, oversize), not found, the RUNS_LIMITER limit where it
applies (runs, auth, survivor start and round, Eras start and submit) and the exact error. A
real run and player go through the admin run detail, reverify, delete, player page, rename and
hide, and the audit log. Mutation checks caught: the test clock on for any FLOWS_TEST value,
the POST /api/runs limiter ignored, a day with runs re-raced, and any verified account taken
as admin (28 failures, one per admin route).

## Bugs and notes from S4/S5

- **`scripts/schedule.ts` misread `docs/g1-report.md`**: fixed on main by #58 (eligible = in
  the daily pool with moments). The flows no longer pass `--allow-ineligible`.
- **The test clock is off in production**: contract tests check that only `FLOWS_TEST` exactly
  `"true"` turns it on (`TRUE`, `1`, `yes`, empty and unset don't), that `Date` stays the real
  one when off, and that `wrangler.jsonc` (production and staging) sets neither var.
- **A failed sign-in is silent on the daily card** (web, not changed): the compact account bar
  on the intro doesn't show `account.error`; only the result screen's bar does.
- **Gauntlet rounds share the daily's rate-limit key** (`POST /api/survivor/:id/round` and
  `POST /api/runs` both count against the bare IP), so a player's daily run and Gauntlet rounds
  draw from the same 10 a minute. Probably fine; noted.
- `test/shuffle.test.ts` "keeps a race from coming straight back…" is CPU-bound and times out
  (60 s) under heavy machine load (load average 25-37 from parallel agents' e2e runs; the file
  alone took 86 s then). It passes when the machine is quieter. Not changed here.

## Screenshots (D6)

`apps/web/e2e/screens/shots.spec.ts` takes `toHaveScreenshot` shots of the key screens only, on
both projects (phone 390 px, desktop 1440 × 900):

| Shot | State |
|---|---|
| `daily-card.png` | The Daily card (Spain 2025), the walkthrough closed |
| `daily-plan.png` | The race plan at the takeover, every plan graded |
| `daily-result.png` | A result: today's run already played (P1 ahead of Alonso, score 85, rank 3/10, 72%) |
| `gauntlet-lobby.png` | The Gauntlet lobby with a two-row weekly leaderboard |
| `eras-map.png` | The era map in production: Era 10 Mastered, Era 9 open, Era 8 locked, the rest coming soon |
| `eras-intro.png` | Hungary 1992's intro |
| `eras-results.png` | Hungary 1992's results with three new stars and the rewrite |
| `admin-today.png` | Admin Today with a warning announcement |

Each is set up with the screen specs' mocks. The clock is fixed (2026-11-11 12:00 UTC) except
for the Eras results, whose race has to run to the flag (cut to its last two laps). Every shot
waits for the fonts and an idle network, turns animations off, hides the caret, masks every
`<canvas>` (the 3D view) and allows `maxDiffPixelRatio: 0.01`.

**Linux only.** The baselines (`apps/web/e2e/screens/shots.spec.ts-snapshots/*-linux.png`) are
made in the Playwright Docker image so they match CI's ubuntu-latest; the spec skips on any
other platform. Never commit baselines made on macOS.

**Updating on purpose** (after a design change). From the repo root, with Docker running. The
anonymous volumes keep the container's Linux `node_modules` off the Mac's:

```sh
docker run --rm --ipc=host -v "$PWD":/repo -w /repo \
  -v /repo/node_modules -v /repo/apps/web/node_modules -v /repo/apps/worker/node_modules \
  -v /repo/packages/sim/node_modules \
  mcr.microsoft.com/playwright:v1.49.1-noble bash -c '
    npm i -g pnpm@12.15.0 && pnpm install --frozen-lockfile && cd apps/web &&
    CI=1 E2E_PORT=5381 npx playwright test e2e/screens/shots.spec.ts --update-snapshots'
```

Then run the same command without `--update-snapshots` twice to check the shots are stable,
look at the new PNGs, and commit only `apps/web/e2e/screens/shots.spec.ts-snapshots/`. The image
tag follows `@playwright/test` in `apps/web/package.json`; `noble` is Ubuntu 24.04, the same as
ubuntu-latest. The image's corepack fails on an old npm signing key, so pnpm comes from npm.

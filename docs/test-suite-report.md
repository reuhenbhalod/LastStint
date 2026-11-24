# Test suite: report

Spec: `docs/test-suite-spec.md`. The full control list is generated into
`docs/test-suite-coverage.md` (`E2E_COVERAGE=1 pnpm --filter @laststint/web e2e`, then
`pnpm --filter @laststint/web coverage:report`).

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
   2026-06-01 --days 7 --race abu-dhabi-2021 --allow-ineligible`), an Eras seed (Eras 10 and 9
   released and published; the Eras player on 20 Era 10 stars), then `wrangler dev --local` on a
   free port with an env file: `FLOWS_TEST=true`, `FLOWS_NOW`, Google sign-in with the flows' own
   key (`GOOGLE_JWKS`, Auth0 off), `ADMIN_EMAILS=admin@flows.test`, `SURVIVOR_POOL` (Spain 2020),
   `ERAS_TEST_MODE=false`.
2. `vite build` + `vite preview` (`e2e/flows/vite.flows.config.ts`) on another free port, with
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
| `daily.spec.ts` | Daily #1 intro → plan → every call → result; the Worker's 201 (its own score, rank 1/1); the stored run, streak 1 and leaderboard from the API; reload → straight to the result; with the browser's saved run gone, the game fetches the run from the Worker and shows it; a second submit is 409; next day: Daily #2, streak 2 in the API and on screen; day 1 not playable on day 4 |
| `gauntlet.spec.ts` | Start (201, Spain 2020), round 1 won (the Worker's verdict), the next race's brief, round 2 lost (box for softs at every stop call), "run over"; the run in the API (over, 1 round, history won/lost, rank 1/1), the leaderboard, a late round refused (409) |
| `eras.spec.ts` | Production mode: Era 9 locked "1 to go" and the Worker refuses its attempt (403 era-locked); Belgium 2023 from the Era 10 page to its stars (the Worker deals the seed, replays and scores); the new star makes Era 10 21+ stars; Era 9 opens on the map and Turkey 2021 starts (201) |
| `account.spec.ts` | A bad token (401, still signed out); sign-in (a new account adopts its player ID), the profile sheet saved (POST /api/profile), the account in the API, the old anonymous ID linked, reload stays signed in, sign out (fresh anonymous ID, no account), another browser finds the same account with no profile prompt; an admin account gets the Admin menu item |
| `admin.spec.ts` | A non-admin is refused on /admin (403 from the Worker); the admin signs in, sets an announcement, changes day 4's race to Spain 2020; both edits in the audit log; a player sees the banner, and on day 4 the Spain 2020 daily (#4); clearing it takes the banner down |

**Not covered locally:** Auth0's hosted login and its redirect back (`completeLogin`), Google's
own popup and One Tap, fetching the real issuers' keys, the daily cron (`scheduled`), and the
nightly re-verification. The Worker's Auth0 token path is in `apps/worker/test/auth.test.ts`.
Phone layout isn't run in the flows (the mocked suite covers it).

**Runtime:** 6-7 minutes per run (stack start ~20 s, web build ~30 s; Daily ~1.4 min, Eras
~1.5 min, Gauntlet ~3 min, the rest seconds), about 11 minutes with the machine under heavy
load. Three full runs from a clean D1 (two of them back to back) all passed. A run's D1 is in
`$TMPDIR/laststint-flows-*`; Playwright kills the stack hard, so the folder can be left behind.

## S5: Worker contract tests (agent F)

`apps/worker/test/contract.test.ts` walks all 54 routes (28 admin, 26 public): every admin
route signed out, with a non-Bearer header, an oversize token, a bad token and a player (401,
401, 401, 401, 403 with the exact body) and with sign-in off (503 auth-off); expired, wrong
audience, wrong issuer, unverified and re-signed admin tokens; then each route's success, bad
input (missing, wrong type, invalid, oversize), not found, the RUNS_LIMITER limit where it
applies (runs, auth, survivor start and round, Eras start and submit) and the exact error.

## Bugs and notes from S4/S5

- **`scripts/schedule.ts` misreads `docs/g1-report.md`** (not fixed: it decides what production
  schedules, so the owner should pick the rule). `g1Statuses` keeps the last table row per race,
  and later measurement tables in the report ("pass, 2.28s", "**fail**, 2.19s") replace the G1
  status. Six daily-pool races drop out as ineligible: abu-dhabi-2021, bahrain-2022,
  canada-2022, mexico-2024, miami-2022, united-states-2022. The flows pass `--race
  abu-dhabi-2021 --allow-ineligible` to get round it.
- **A failed sign-in is silent on the daily card** (web, not changed): the compact account bar
  on the intro doesn't show `account.error`; only the result screen's bar does.
- **Gauntlet rounds share the daily's rate-limit key** (`POST /api/survivor/:id/round` and
  `POST /api/runs` both count against the bare IP), so a player's daily run and Gauntlet rounds
  draw from the same 10 a minute. Probably fine; noted.
- `test/shuffle.test.ts` "keeps a race from coming straight back…" is CPU-bound and times out
  (60 s) under heavy machine load (load average 25-37 from parallel agents' e2e runs; the file
  alone took 86 s then). It passes when the machine is quieter. Not changed here.

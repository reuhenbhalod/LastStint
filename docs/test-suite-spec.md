# Spec: a rigorous test suite (every feature, every button)

Nov 24, 2026 · Branch `test-suite` (worktree `.worktrees/test-suite`, from `origin/main` cf6d89e).
Localhost first; one PR at the end; no production writes.

## Goal

Every screen, every control and every rule of the game the first release ships has a test that
would fail if it broke. A control is anything a player or admin can press, type into, toggle or
pick. "Covered" means a test presses it and checks what it did, not just that it renders.

## Decisions made (owner, Nov 24)

- **D1. Depth: every button plus the rules.** A coverage matrix of every control on every screen,
  each pressed on phone and desktop. Rule edge cases come from the game's rules, not only from
  happy paths. A CI guard fails when a new control ships without a test.
- **D2. Scope: the first release.** Daily and results, Gauntlet, Eras, account and admin. Versus
  is out of the release (PR #54) and out of this suite for now.
- **D3. Runtime: everything on every PR.** No nightly-only tier.

## Where we start

- **Web:** about 50 screens and components hold controls, with about 150 `<button>` sites. Many
  render in lists, so there are more buttons on screen. 74 unit test files.
- **Browser (Playwright, `apps/web/e2e`):** 41 tests in 12 files. Most are long playthroughs: one
  Daily, one Gauntlet, one defend race, Eras (launch, phone, play, results, unlock), admin,
  players and tickets. Phone (390 px) and desktop projects. The API is mocked (`e2e/mock.ts`).
- **Worker:** 54 API routes (admin 28, eras 7, survivor 4, daily 3, runs 2, auth 2, others 1
  each) and 20 test files.
- **Sim and pipeline:** strong already (sim 2385 tests, pytest 2029, parity, reachability).
  This suite doesn't redo them. It adds rule cases only where the game's screens are involved.
- **Unknown:** which controls the current tests actually press. Stage S1 measures it.

## The three layers

| Layer | What | Where | Runs against |
|---|---|---|---|
| L1 Component | One control at a time: it calls the right handler with the right value. Covers disabled and enabled states, timers, a second tap that confirms, keyboard use, and labels for screen readers. | `apps/web/src/**/*.test.tsx` (vitest + jsdom + Testing Library) | No server |
| L2 Screen | Every control on a screen pressed in the browser, with the result checked. Covers every state of the screen (loading, error, empty, signed in or out, phone or desktop). | `apps/web/e2e/screens/*.spec.ts` | Mocked API (`e2e/mock.ts`), deterministic |
| L3 Flow | Full journeys across screens against a real local Worker and D1: a Daily from takeover to result, share, streak; a Gauntlet run; an Eras race to stars and unlock; sign-in; admin edits. | `apps/web/e2e/flows/*.spec.ts` | `wrangler dev` with local D1 and fixed dates |

Worker API: every route gets a contract test (inputs, auth, errors, rate limits) in
`apps/worker/test`.

## The coverage matrix and the guard

- **Matrix:** `apps/web/e2e/coverage.json` lists every control as `screen → control → state →
  test`. It's generated, not hand-kept: a script walks the rendered screens in every state and
  lists each interactive element by role and accessible name (`getByRole` style). A test marks
  what it covers by pressing the control through that same role and name.
- **Guard (CI):** the script compares the controls it finds with the ones the tests pressed.
  An uncovered control fails CI, with a reason column for the few that can't be pressed (for
  example an external link).
- **The report doubles as an accessibility check:** a control with no accessible name can't be
  named in the matrix, so the script flags it.

## Rule cases (screens involved)

Listed in full in S1; for example:

- **Race events:**
  - a safety car or VSC at or just after the takeover;
  - a red flag before the takeover;
  - rain arriving or leaving, and wet tyres;
  - the rival retiring;
  - penalties at the flag shown on the result.
- **Strategy calls:**
  - the box call on the last legal lap;
  - "stop owed";
  - "Keep ours" until the race changes;
  - "Switch" to a plan that stops on the coming lap;
  - the box request as tyres get worse.
- **Calls under time and fuel limits:**
  - timed decisions running out (no answer: the driver's choice) and the untimed opt-out;
  - refuelling fills.
- **Results and progress:**
  - streaks across days and time zones;
  - a Daily already played;
  - a reload mid-race;
  - the share text;
  - Gauntlet seeds and rounds, and losing a round;
  - Eras unlock at 70%, stars, the history book and legend leaderboards.
- **Admin:**
  - every tab;
  - edits and their audit;
  - a non-admin refused.

## Stages

| # | Stage | Done when |
|---|---|---|
| S1 | Inventory: the matrix script, today's coverage report, the full rule-case list, and the gaps | `docs/test-suite-report.md` shows covered and uncovered controls per screen |
| S2 | L1 harness (jsdom + Testing Library), then component tests for the shared components | Each shared control covered |
| S3 | L2 screen specs, one screen per agent: Daily race, result, Gauntlet, Eras (map, detail, race, results, history book, leaderboards), account and profile, intro and tutorial, legal, admin (each tab) | Matrix green for those screens, on phone and desktop |
| S4 | L3 flows against a local Worker and D1 | The journeys above pass from a clean local database |
| S5 | Worker contract tests for every route | Every route covered |
| S6 | The CI guard and wiring (D3: every PR) | An uncovered control fails CI |
| S7 | Review, then verify by breaking things: each new test is checked to fail when its control is removed or broken (mutation spot checks) | Report with the numbers; owner sign-off |

Agent chain (as for the races): spec, then review, then develop (one worktree per agent, a few
screens each), then review, verify, fix and QA. Bugs the tests find go into the report: small
ones are fixed in place, bigger ones need the owner first.

## Decisions made (owner, Nov 24, round 2)

- **D4. CI stays on the PC runner** (owner, Nov 24, replacing "GitHub-hosted": the repo's Actions
  minutes ran out on Nov 12, which is why CI moved to the PC). Every PR runs the whole suite on
  the PC (D3). Since the PC was offline Nov 13-24, S6 also documents how to check the runner is
  up and how to deploy from the Mac when it isn't.
  **Superseded by PR #55** (88a6d6a): CI now runs on GitHub-hosted `ubuntu-latest`, free since
  the repo went public, so the suite and the guard run there on every PR. The screenshot
  baselines are made in the Playwright 1.49.1 Ubuntu 24.04 (noble) image to match that runner.
- **D5. Real Worker in CI.** L3 flows run in CI against `wrangler dev` with a fresh local D1 and
  fixed dates.
- **D6. Screenshots of the key screens only.** Phone and desktop, main states; updated on purpose
  when the design changes.
- **D7. Find controls by role and accessible name.** Unnamed controls get names (an
  accessibility fix); `data-testid` only where names repeat.

# Test suite: how to resume (paused Nov 24)

Read with `docs/test-suite-spec.md` (plan, decisions D1-D7) and `docs/test-suite-report.md`
(S1 findings, the S2 result). This file is the hand-over: the state of each worktree, a brief
to give each agent, and the integration steps.

## State

Every worktree is under `.worktrees/`, branched from `origin/main` cf6d89e. Each has one local
commit, `WIP test suite (<name>)`, which is not pushed and not reviewed. The S1 patch (recorder
`apps/web/e2e/coverage.ts`, `scripts/coverage-report.mjs`, the specs importing `./coverage.js`,
the `screens/` desktop match in `playwright.config.ts`, and the docs) is in all seven.

| Worktree (branch) | Stage | State at the pause |
|---|---|---|
| `test-suite` | Integration + S1 | S1 done. The admin-tabs fix (banner on `/gauntlet`) and the docs. D4 changed to keep the PC runner |
| `ts-a-components` | S2 | **Done and checked.** Harness (jsdom, Testing Library, `src/test/setup.ts`, `.test.tsx` with `// @vitest-environment jsdom`), 21 test files, 233 tests, 25 mutation checks all caught. Web suite 1289 passed |
| `ts-b-daily` | S3 Daily (`/`) | Stopped mid-edit while rewriting the battle tests with fixed moves. Specs: `screens/daily-{intro,race,calls,result}.spec.ts`, helper `screens/daily.ts`. Scratch files `_explore.spec.ts` and `_probe.spec.ts` must be deleted. Markup edits in BattleCard, PlanCard, QuickCallCard, TeamRadio, TimingTower and RaceScreen overlap S2's |
| `ts-c-gauntlet-misc` | S3 Gauntlet, pages, account | Stopped while refactoring a reusable `answerCall`. Specs: `screens/{gauntlet,pages,account}.spec.ts`, helper `screens/gauntlet.ts`. Markup edits in AccountBar and TeamRadio overlap S2's |
| `ts-d-eras` | S3 Eras | Stopped mid-edit. Specs: `screens/eras-{map,detail,intro,race,results,legend,leaderboard,history}.spec.ts`. `e2e/eras.ts` extended |
| `ts-e-admin` | S3 admin | Furthest along (it was waiting on a test run). Specs: `screens/admin-{access,nav,today,schedule,eras,players,runs,tickets,reports}.spec.ts`, helper `screens/adminApi.ts`. Markup edits in seven admin files |
| `ts-f-flows-api` | S4 flows + S5 Worker contracts | Stopped while its Gauntlet flow ran. `playwright.flows.config.ts`, `e2e/flows/` (stack.mjs, env.ts, helpers.ts, vite.flows.config.ts; daily, gauntlet, eras, account and admin specs), `apps/worker/test/contract.test.ts`. **Changes Worker source:** `src/testClock.ts`, `src/index.ts`, `scripts/d1.ts`, `scripts/schedule.ts` |

None of the S3-S5 work has been run, reviewed or mutation-checked as a whole. Treat it as a
draft.

## Brief for each agent (paste with the worktree's path)

> You are resuming stopped work on LastStint's test suite in the git worktree
> `<path>` (branch `<branch>`; one local commit "WIP test suite …" holds the work so far). Read
> CLAUDE.md, docs/test-suite-spec.md (D1-D7), docs/test-suite-report.md and
> docs/test-suite-resume.md (this file: your row and the rules below). The previous agent was
> stopped mid-task and its notes are gone.
>
> **First, before writing anything new:**
> 1. Read every file the WIP commit added or changed (`git show --stat HEAD`, then the files).
> 2. Run the specs once. Fix or finish what's broken. Delete scratch files (`_explore`, `_probe`).
>
> **Then finish your scope** (your row above; the original scope is in docs/test-suite-spec.md
> stage S3/S4/S5):
> - Every control on your routes is pressed and its effect checked, in every state, on phone and
>   desktop.
> - Controls are found by role and accessible name (D7).
> - No screenshot assertions; list 3-6 key states for them instead.
>
> **Rules:**
> - Commit locally on your branch as you go, never push. Never deploy or touch production or
>   staging, and never use git stash.
> - Don't edit `data/`, `packages/sim`, the pipeline, `playwright.config.ts`, `package.json` (S4
>   may add its `e2e:flows` script) or other worktrees' areas.
> - Markup changes: attribute-only accessible names. Keep S2's names; see "Names S2 set" below.
> - Real bugs: fix only small obvious ones, with a test. Otherwise use `test.fixme` with a note
>   and list it.
> - Use your own `E2E_PORT` (Daily 5311, Gauntlet 5321, Eras 5331, admin 5341, flows: its own
>   config). Use no sleeps over ~1 s; wait on UI state.
>
> **Done when:**
> - Your specs pass twice in a row on phone and desktop.
> - `E2E_COVERAGE=1 … && node scripts/coverage-report.mjs` shows your routes' controls pressed;
>   list any you can't reach and why.
> - Five or more mutation checks fail as they should.
> - Typecheck and biome are clean.
>
> **Reply with:** files, coverage numbers per route, states covered, markup changes, bugs,
> mutation checks, suggested screenshot states and runtime.

Extra for `ts-f-flows-api`:
- Confirm the test clock (`src/testClock.ts`) is off unless a test-only var is set. Production
  behaviour must be unchanged; add a test that proves it.
- Never use `--remote`.
- S5 replies with a table of route -> cases for all 54 routes.

## Names S2 set (keep them; e2e selectors must use them)

- **Battle and defend moves:** named by the move's label alone ("Late-brake up the inside").
  Its note and risk tag are the description.
- **Quick call answers:** named by the label, with the note as the description.
- **Plan cards:** "B · One stop, 61%, engineer's pick". The stops line is the description.
- **Plan editor:**
  - "Stop N earlier" / "Stop N later" and "Remove stop N";
  - the tyre and pace buttons sit in groups named "Stop N tyre" and "Stint N pace".
- **Team radio:** the bar is "Team radio". Its tyre buttons still read "SSofts"
  (`eras-play.spec.ts` matches `/^D\s*Dry/`); fix both together if needed.
- **Timing tower:** the `<ol>` is "Standings".
- **How it works:** the back button is "Back: close How it works".

## Integration (the coordinator, in `test-suite`)

1. **Merge.** Wait for all five agents to report done. Merge `ts-a-components` first, then
   `ts-e-admin`, `ts-c-gauntlet-misc`, `ts-b-daily`, `ts-d-eras` and `ts-f-flows-api` (`git merge
   --no-ff`). Where markup overlaps S2, S2's names win. Fix selectors in the merged specs, and
   re-check the Eras digests in `src/eras/difficulty/today.test.ts`: only attributes may differ.
2. **Run everything** on the merged branch, with nothing else loading the Mac. Earlier load
   caused e2e timeouts:
   - all CLAUDE.md checks;
   - `pnpm --filter @laststint/web e2e` and `e2e:flows`;
   - Worker tests;
   - then `E2E_COVERAGE=1` and the report. The target is every control on the release's routes
     pressed, with a reason for each exception.
3. **Review and verify.** A review agent reads the merged tests against the code; it isn't
   anchored on the authors' summaries. Then mutation spot checks across screens: break a
   control's handler and see its test fail.
4. **S6:**
   - the CI guard: fail when a release route has an unpressed control that isn't on the
     exceptions list;
   - wire `e2e:flows`, the Worker contract tests and the guard into `.github/workflows/ci.yml`
     on the PC runner (D4; every PR, D3);
   - Linux screenshot baselines for the key states (D6), made on the PC or in the Playwright
     Docker image, not on the Mac;
   - document checking the runner is up, and deploying from the Mac when it isn't (as on Nov
     24).
5. **Report and PR.** Update `docs/test-suite-report.md`, then open one PR and ask the owner
   before merging.

Budget: about 3 hours. The agents' share (S3-S5) is the largest; integration plus the full runs
take about 1.5 hours.

## Paused Nov 25 (night)

- Merged and committed through eeb5b7d (S6 guard, flows job in CI). Guard: 0 uncovered.
- Uncommitted on purpose: `apps/web/e2e/screens/shots.spec.ts` (8 shots x phone/desktop,
  Linux only) and the "Screenshots (D6)" section in `docs/test-suite-report.md`. Don't commit
  the spec until its baselines exist.
- Nov 25 (resumed): baselines made in `mcr.microsoft.com/playwright:v1.49.1-noble`, 16/16 on two
  further runs, committed (61fb78c). In the image, install pnpm with `npm i -g pnpm@12.15.0`
  (its corepack fails on an old signing key). Left: the full e2e with E2E_COVERAGE=1 and the
  guard, the final report, then ask the owner before push/PR.
- Owner decision pending: Turkey 2021 team radio shows "Dry" for every dry tyre (test.fixme).

## Done (Nov 28)

- S1-S7 finished. PR #59 open; CI run 9 (05c593e) green on every job (e2e 619 passed,
  screenshots and the coverage guard included).
- Left for the owner: sign-off on `docs/test-suite-report.md` and
  `apps/web/e2e/coverage-exceptions.json`, the four owner items in the report, then the merge.
- If the guard flags a control in a later CI run (some show only on some race paths or on a
  slow runner), press it in a spec or excuse it with a reason; don't loosen the guard.

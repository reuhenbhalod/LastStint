# Eras mode: remaining work (handover spec)

Status: 2026-11-08. This is the single document a new session needs to finish Eras mode.
Read it with `laststint-eras-mode-spec.md` (the feature), `eras-build-plan.md` (the original plan,
phases 0–10, ~93% by its weights), `simulator-roadmap.md`, `eras-grader.md` and
`eras-races-report.md` (per-race status).

---

## 1. Where things stand

- **Branch:** all work is on `eras` (local only; **never pushed**). It was branched from
  `data-ingestion`, which is ahead of `origin/main` by a few commits.
- **Races (100):** on `eras` today **41 ready to publish** (pass accuracy + authored + reachable),
  3 authored but just over an accuracy limit, ~54 failing accuracy, 2 unbuilt. Branches waiting
  in integration 8 add China 2007 and Brazil 1993 (all 100 built), Europe 1997 and Europe 2012
  passing (≈44 pass expected).
- **Tests on `eras`:** sim 1563, worker 182, web 655, pipeline 1558 — all passing.
- **In flight when this was written:** **integration 8** (worktree `.worktrees/integrate-8`,
  branch `eras-integrate-8`) merging the 12 "Sector 1" branches: `eras-s1-report`,
  `s2-live-tank`, `s3-rain-tyres`, `s4-stint-fade`, `s5-restarts`, `s6-no-dry-laps`,
  `s7-recon-anchors`, `s9-near-misses`, `s10-credits`, `s11-era-briefings`, `s12-e2e`,
  `s13-staging-web`. If it didn't finish, re-run it (brief in §6.1). When it's done,
  fast-forward `eras` to it.
- **Hotfix (separate, production):** branch `hotfix-wet-takeover-two-compound` (from
  `origin/main`) is **pushed**; owner to open the PR and deploy. After deploy, owner runs:
  `UPDATE runs SET verified = 0 WHERE date IN (SELECT date FROM daily WHERE race_id = 'canada-2024');`
  (`npx wrangler d1 execute pitwall-db --remote --command "…"` from apps/worker).
- **Staging (live):** API https://pitwall-staging.boxboxbox.workers.dev (D1
  `pitwall-staging-db`, migrations 0001–0012 applied, `ERAS_TEST_MODE=true`), website
  https://pitwall-web-staging.boxboxbox.workers.dev. See `docs/staging.md`.

## 2. Rules every agent and session must follow

1. **No Claude attribution in commits** — no `Co-Authored-By: Claude`, no session link.
2. **Never use `git stash`** — worktrees share one stash list; use a temp commit or scratch copy.
3. **Daily/Gauntlet are frozen:** every race file and golden in `data/pools.json` `daily` and
   `survivor` (incl. the 5 shared races abu-dhabi-2021, bahrain-2021, france-2021, russia-2021,
   hungary-2019) stays byte-identical; Daily grades must not change. Gate model changes to Eras
   builds (`build.py` `eras_build`; sim `erasRace(model)`). The build keeps a pool race's
   committed `schemaVersion` (`pinned_schema_version`).
4. **Shared races:** their Eras content lives only in `data/eras/<id>.json` (keys `eras`,
   `provenance`, `rules`, `storylineEvents`, `decisionMoments`), merged at serve time
   (`apps/worker/src/erasOverlay.ts` = `pipeline/export.py with_eras_fields`).
5. **No invented facts** (spec §19): every fact from a source actually read; record it in a
   `docs/eras-checks/*.md` sheet with a blank "Owner checked" column. Headlines original; never
   quote team radio.
6. **Never fetch formula1.com** (its terms forbid reuse). Sources in use: OpenF1, FastF1 cache,
   TUM (CC BY-NC-SA 3.0), Jolpica (CC BY-NC-SA 4.0), F1DB (CC BY 4.0), Wikipedia/Motor Sport/
   Autosport/GrandPrix.com. **LastStint is non-commercial** (required by the NC licences).
7. **Parallel agents:** one worktree per agent under `.worktrees/` (git-excluded), branch
   `eras-<job>`; the coordinator merges. Model agents measure in a scratch dir and don't commit
   `data/races`/`data/golden`; one integrator rebuilds everything. Keep every command bounded
   (one race per call for robust G1). Keep the Mac awake (`caffeinate -dims`).
8. **Never touch production** (`pitwall`, `pitwall-db`, `pitwall-web`); no push or deploy
   without the owner. Production migrations 0009–0012 go out with the deploy that ships Eras.

## 3. Owner decisions already made (don't re-ask)

- Eras order: Era 10 (2022–25) → Era 1 (1983–88); unlock at 70% (21/30 stars); Legend
  leaderboards never reset; every decision is timed (45/30/20 s) with an accessibility
  opt-out marking stars "untimed".
- **Side = more hard calls** (`pipeline hard-calls`), recounted with the honest grader; also on
  shared races (via overlay). Exception: **austria-2002 stays Barrichello, takeover lap 26**.
- **No rewrite** (history book) in races the Eras side really won (19 races so far).
- Storyline retirements of the player's car are avoidable (only if the real call is repeated).
- Refuelling: fill is **required** on every pit call; real calls carry the real fill
  (`{laps:n}`); fill rate pinned to ~0.25 s/lap of fuel.
- No safety cars before 1993, anywhere. Legend: calls follow the drawn SCs; scripted stops
  pay real conditions.
- Rival policies per spec §7 (Standard/Standard+/Smart/Expert; Expert 100 samples, claims).
- Race swaps done: brazil-2024→belgium-2023, brazil-2016→great-britain-2016,
  japan-1989→france-1990, san-marino-1985→germany-1986 (migration 0012).
- Fully-wet reconstructed races use the solver's dry pace; DQ'd cars with a sourced road place
  (`roadPositions`) are placed on the road.
- Restart model and dirty-air model stay **off** (measured worse); lapped status from real lap
  counts is **on**.

## 4. Remaining work

Sector A can start as soon as integration 8 is on `eras`. Later sectors depend on earlier ones.

### Sector A — fixes (independent, run in parallel; minimal changes; all tests must pass)

| # | Job | Done when |
|---|---|---|
| A1 | **San Marino 2005 can't be scored.** Its one-stop race plan asks for a fill (`{laps:41}`) larger than a 2005 tank (`fillCap`), so `checkFill` throws, plans never grade and submit fails ("Can't reach the server"). Cap plan/playout fills at `fillCap` (planner.ts `fuelled`, grade playouts). Check austria-2002's lap-61 `{laps:10}` moment for the same cause. | `eras-play.spec.ts` Era 5 test un-`fixme`'d and passing; reachability still passes |
| A2 | **Radio lines** for the sim's `fault`, `storyline` (retirement) and `team-order` notes — `apps/web/src/game/engineerRadio.ts` has no case for them. Short, original wording; pit-board style in Eras 1–2. | Unit tests for each line; e2e asserts them in Era 1 (monaco-1988), Era 4 (austria-2002) and a fault race |
| A3 | **Grader drops later real stops** when a real stop is already queued at the pause: `grade.ts playOption` adds no continuation, so later real stops are lost (japan-2000 HAK lap 23, hungary-1998 MSCM laps 26/44, austria-2002 BAR lap 62 real call grades 0%). Add the remaining real stops after the queued one (eras-grader.md §2). Eras-gated. | Tests; those moments' real calls grade sensibly; Daily grades byte-identical across all pool races |
| A4 | **Contact / damage losses.** Reuse the FAULT event (no new system): a sourced `fault: "damage"` with a fitted per-lap loss for N laps. Enter sourced facts for brazil-2019 (Hamilton–Albon, lap 70), hungary-2024 (Verstappen–Hamilton), europe-2012 (Maldonado wing, penultimate lap) if sources give laps. | Rebuilt, robust G1 before/after reported; authored races still reachable |

### Sector B — content (after A1 and A3 for refuelling-era races; others right away)

| # | Job | Done when |
|---|---|---|
| B1 | **Author every race that passes but isn't authored** (after integration 8 + A4: e.g. europe-1997, china-2007 if it passes, brazil-1993 if it passes, south-africa-1983, monaco-1992, france-1990 if their checks pass, brazil-2019/hungary-2024 after A4). Per race: `pipeline hard-calls` → side; moments (`pnpm author --target --eras`); `eras` block (target with sourced positions, storyline, mastery, hidden, briefing; no rewrite if the side really won); `storylineEvents`; facts sheet. | `pnpm --filter @laststint/sim reachability` and `pnpm --filter @laststint/worker reachability:shared` pass for every authored race at era difficulty and Legend; stay-out never earns ★3 |
| B2 | **Re-author races the merged fixes broke** (reachability failures after integration 8 / Sector A). | Same as B1 |
| B3 | **Model work for the failing races** (optional, diminishing returns — do only if needed to fill an era to 10): per-stint wear rate for scripted cars (monaco-2011, hungary-2014, australia-2010); a drying-line / per-class wetness for changeable rain (germany-2000 got worse with job 1.3); trains/post-restart pace spread so the restart model can be turned on. **Known bug, logged Nov 9 (owner: revert for now):** the live player car takes no stint pace offset (M2 `stintPace`), while every scripted car runs its own (netherlands-2023: every offset is -1.0 to -1.6 s, so live Alonso ran ~1.3 s a lap slow). The fix (`eras-model-player-pace` 2c5979b, sim.ts `playerStintOffset`: the race-wide mean offset in every stint) was reverted on `eras-revert-player-pace`; fixing it needs a re-author pass of hungary-1998, turkey-2021, hungary-2024, japan-2023, abu-dhabi-2022. **Nov 10 (owner-approved): both fixes are in** — the player's race-wide stint offset in live play (`eras-fix-player-pace`, sim.ts, Eras-gated) and the Expert rival grader fix (`eras-fix-expert-grader`, `rivals/expert.ts rivalPlayout` keeps the player's later real stops after a queued stop). 12 races were re-authored for them (`docs/eras-checks/b2-reauthor-nov10.md`) and hungary-1998 was swapped out of Era 3 for brazil-1999 (`b1-brazil-1999.md`); integrated on `eras-integrate-nov10`. See the ranked gap list in `eras-races-report.md`. | Each change gated, measured with robust G1 before/after on the affected races, no pass lost |
| B4 | **Fill eras to 10.** An era is releasable only with 10 published races. Era 1 is closest (9 ready). For any era, pick: fix its failing races (B3/data), or **swap** a failing race for another real race with a similar storyline (owner approves swaps; same procedure as the four done: spec §4, plan appendix, pools.json `eras`, catalog.ts, overlay rules, track file, a D1 migration updating `era_races`, reconstruction facts if pre-1996). | Era has 10 races passing + authored + reachable |

### Sector C — integration and reporting (after A and B batches)

| # | Job | Done when |
|---|---|---|
| C1 | Integrate all branches, rebuild every non-pool race, regenerate races.gen.ts / sc_rates.json / legend parity, re-run robust G1 + anchors + both reachability checks + e2e, update `eras-races-report.md`. | All suites green; report current |
| C2 | **Owner sign-off** (owner does this): every `docs/eras-checks/*.md` sheet — track maps (2.5), drivers/incidents (2.6), SC estimates (2.4, W4), wet timelines (4.5), reconstruction facts (R2, S7), red flags (R1), swaps, scripted events (M4), near misses (S9), era briefings (S11), authored content (6.2-*). Mark "Owner checked". Priorities flagged in earlier reports: Phoenix 1990 start line, Kyalami direction, Monaco 1984–92 pit lanes, Paul Ricard 1990 start line, Portugal 1984 pre-race points (derived), turkey-2021 two-compound waiver (inferred), france-2021 Pérez stop lap (inferred), europe-2012 SC laps, belgium-1998 second SC from lap 29, monaco-2025 minStops citation (from memory — verify the article). | Every sheet fully checked |
| C3 | **Publish races:** set `era_races.published = 1` (via the seed/migration used in 0010/0012 or an admin step) for each race that is passing + authored + reachable + signed off. | Staging shows them; production unaffected until release |

### Sector D — QA and release (after C)

| # | Job | Done when |
|---|---|---|
| D1 | **Staging sign-in:** owner adds `https://pitwall-web-staging.boxboxbox.workers.dev` to the Auth0 app (Allowed Callback URLs, Logout URLs, Web Origins, CORS) and the Google OAuth client's Authorized JavaScript origins. | Sign-in works on staging |
| D2 | **Play-through on staging** (plan 10.2): every era and authored race, phone and desktop; log issues, fix, re-run. Push `eras` to GitHub so `.github/workflows/staging.yml` deploys staging (worker + website + migrations). | Issue list closed; pass rate recorded in the races report |
| D3 | **History cleanup before the PR** (no agents running): remove Claude co-author/session lines from commits on `eras` and drop `docs/Game changes.pdf` and `docs/LastStint Logo.html` from history (they were committed by mistake and untracked again). Use an interactive-free rewrite (e.g. `git filter-repo --message-callback` + `--path … --invert-paths`) on a copy first; the owner confirms before force-updating `eras`. | `git log` clean; files absent from history |
| D4 | **PR to main and deploy:** owner reviews and merges; deploy worker + web together; apply production migrations 0009–0012 **in the same deploy** (0009 renames race IDs and re-pins hashes — any day on `usa-2022` returns 503 until it runs). Production `ERAS_TEST_MODE` stays `false`. | Production healthy; Daily/Gauntlet unchanged |
| D5 | **Release eras one at a time** in play order (Era 10 first, or the owner's choice): set the era's `released_at` once its 10 races are published. | Era live in production |

## 5. Known open issues (not yet assigned)

- **CI reachability** passes today (44/44); keep it green as races are authored.
- **`pnpm --filter @laststint/web build`** was broken on `eras` (mockErasApi.ts overlay import);
  fixed on s12/s13 — confirm after integration 8.
- **Stale race files:** ~25 pool race files differ from a fresh build in the last digit
  (pre-existing; frozen on purpose — don't rebuild them).
- **No authored race has a red flag or car fault yet** (all such races fail accuracy). They get
  covered as those races pass (B1/B3).
- **Collisions** (brazil-2019, hungary-2024) → A4.
- **Expert rival cost** on a real phone not yet measured (bench says ~0.3 s/decision at 5×).

## 6. Briefs to reuse

### 6.1 Integrator
Worktree from `eras`; merge the listed branches `--no-ff`; keep both sides' behaviour; never
hand-merge data — rebuild (`pipeline build <id>`, `pipeline reconstruct <id> --force` for
reconstructed races; spain-1994 needs `--event Spanish`, great-britain-1987 `--event British`);
regenerate `pnpm --filter @laststint/worker races`,
`uv run python -m pipeline.sc_rates --cache /Users/reuhenbhalod/Documents/LastStint/pipeline/cache/eras-sources`,
`uv run python -m pipeline.legend`; run robust G1 per race, both reachability checks, e2e
(`CI=1`, free `E2E_PORT`), all suites; update the races report; commit without attribution.

### 6.2 Checks (all must pass before merge)
`pnpm install --frozen-lockfile`, `pnpm test`, `pnpm typecheck`, `npx biome check apps packages`,
`cd pipeline && uv sync && uv run python -m pytest`, `uv run ruff check src tests scripts`,
`uv run ruff format --check src tests scripts`, `pnpm --filter @laststint/sim reachability`,
`pnpm --filter @laststint/worker reachability:shared`, and for UI changes the e2e suite.

## 7. Key files

- Spec / plan / reports: `docs/laststint-eras-mode-spec.md`, `docs/eras-build-plan.md`,
  `docs/simulator-roadmap.md`, `docs/eras-races-report.md`, `docs/g1-report.md`,
  `docs/eras-grader.md`, `docs/reconstruction-facts.md`, `docs/fuel-load-spec.md`,
  `docs/staging.md`, `docs/eras-checks/`.
- Data: `data/races`, `data/golden`, `data/raw`, `data/eras` (overlays), `data/moments`,
  `data/reconstruction`, `data/redflags`, `data/estimates`, `data/incidents.json`,
  `data/pools.json`, `data/sc_rates.json`, `data/wet-eras.json`.
- Pipeline: `pipeline/src/pipeline/{build,assemble,fit,pace,track,wet,wet_laps,estimates,
  jolpica,tum,f1db,reconstruct,redflag,refuel,faults,race_rules,legend,hard_calls,overtaking,
  restart,dirty_air,sc_queue}.py`.
- Sim: `packages/sim/src/{sim,grade,moments,planner,rules,refuel,legend,redflag,faults,
  scripted}.ts`, `packages/sim/src/rivals/`, `packages/sim/src/eras/{config,evaluate,race-log,
  reachability,hard-calls}.ts`.
- Worker: `apps/worker/src/{eras,erasEval,erasHistory,erasOverlay,erasMerge}.ts`,
  migrations 0009–0012.
- Web: `apps/web/src/eras/`, `screens/RaceScreen.tsx`, `screens/Credits.tsx`,
  `apps/web/e2e/eras-play.spec.ts`.

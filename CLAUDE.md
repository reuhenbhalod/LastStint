# LastStint — working notes for Claude

LastStint is a non-commercial daily F1 strategy game (formerly "BoxThisLap"; Cloudflare
resources still use the old `pitwall` names). Monorepo:

| Path | What |
|---|---|
| `pipeline/` | Python (uv): ingests timing data, fits race models, builds `data/races` + `data/golden` |
| `packages/sim/` | TypeScript race simulator, grader, planner, rivals, Eras logic |
| `packages/schema/` | Race-model JSON schema |
| `apps/worker/` | Cloudflare Worker API + D1 migrations (`apps/worker/migrations`) |
| `apps/web/` | React website (Vite) + Playwright e2e (`apps/web/e2e`) |
| `data/` | Race files, goldens, raw parquet snapshots (committed), Eras overlays, moments, facts |
| `docs/` | Specs, plans, reports. Start with the docs listed under "Current feature" |

Game modes: **Daily** and **Gauntlet** (`survivor`) are live in production and frozen.
**Eras** (10 eras × 10 real races, 1983–2025) is the feature in progress.

---

## Rules (always)

1. **No Claude attribution** in commits or PRs: no `Co-Authored-By: Claude`, no session links.
2. **Never `git stash`.** Worktrees share one stash list; use a temp commit or a scratch copy.
3. **Daily/Gauntlet are frozen.** Every race file and golden listed in `data/pools.json` `daily`
   and `survivor` stays byte-identical, and Daily grades must not change. That includes the 5
   shared races (abu-dhabi-2021, bahrain-2021, france-2021, russia-2021, hungary-2019). Gate model
   changes to Eras builds (`build.py` `eras_build`; sim `erasRace(model)`). Never rebuild pool
   races; ~25 of them differ from a fresh build in the last digit on purpose.
4. **Shared races' Eras content** lives only in `data/eras/<id>.json`, merged at serve time
   (`apps/worker/src/erasOverlay.ts` = `pipeline/export.py with_eras_fields`).
5. **No invented facts.** Every fact comes from a source actually read and is recorded in a
   `docs/eras-checks/*.md` sheet with a blank "Owner checked" column. Headlines are original;
   never quote team radio. If a source doesn't give a number (lap, gap), don't guess it.
6. **Never fetch formula1.com.** Allowed: OpenF1, FastF1 cache, TUM (CC BY-NC-SA 3.0), Jolpica
   (CC BY-NC-SA 4.0), F1DB (CC BY 4.0), Wikipedia, Motor Sport, Autosport, GrandPrix.com.
7. **Never touch production** (`pitwall`, `pitwall-db`, `pitwall-web`). No push, deploy or
   production migration without the owner saying so. Always pass `--env staging` to wrangler
   for staging; without it wrangler targets production.
8. **Pushing `eras` deploys staging** (`.github/workflows/staging.yml` runs on every push to
   `eras`). Only push it when the owner wants staging updated.
9. **Never hand-merge data files.** Rebuild them (see "Rebuilding races").
10. **Parallel agents:** one worktree per agent under `.worktrees/` (git-ignored via
    `.git/info/exclude`), branch `eras-<job>`, created from `eras`. Agents change code and tests.
    Only the integrator commits rebuilt `data/races` and `data/golden`. Keep commands bounded
    (one race per robust-G1 call). The coordinator merges with `--no-ff`.

## Checks (all must pass before merging)

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
npx biome check apps packages
cd pipeline && uv sync && uv run python -m pytest && uv run ruff check src tests scripts && uv run ruff format --check src tests scripts
pnpm --filter @laststint/sim reachability            # every authored Eras race (or name races)
pnpm --filter @laststint/worker reachability:shared  # the 5 shared races
CI=1 E2E_PORT=<free port> pnpm --filter @laststint/web e2e   # for UI changes
```

Run each pipeline command from `pipeline/` in its own shell; a `cd` carried over from a
previous step breaks the next one.

## Rebuilding races (integrator only)

```sh
cd pipeline
uv run pipeline build <id>                         # normal race (reads data/raw)
uv run pipeline reconstruct <id> --force           # reconstructed pre-1996 races
#   spain-1994 needs --event Spanish, great-britain-1987 needs --event British
uv run pipeline validate <id> --robust             # robust G1, one race per call
uv run python -m pipeline.sc_rates --cache pipeline/cache/eras-sources
uv run python -m pipeline.legend                   # legend parity fixture
cd .. && pnpm --filter @laststint/worker races     # regenerate apps/worker/src/races.gen.ts
```

After a rebuild, run the checks above and update `docs/eras-races-report.md`.

---

## Setting up on a new machine

Toolchain: Node ≥ 20 (CI uses 22), pnpm 12.15.0 (`corepack enable`), uv (Python ≥ 3.11),
git. On Windows, use **WSL2 (Ubuntu)** and keep the repo inside the Linux filesystem
(`~/LastStint`, not `/mnt/c/...`). Shell scripts, `uv`, Playwright and the long reachability
runs are much slower or break on native Windows paths.

```sh
pnpm install --frozen-lockfile
cd pipeline && uv sync --dev && cd ..
pnpm --filter @laststint/web exec playwright install --with-deps chromium
```

**Native Windows also works** (set up 2026-11-08 at `C:\Users\bhalo\LastStint`, all checks pass):

- Clone with `git clone -c core.autocrlf=false …`. With Git for Windows' default
  (`autocrlf=true`) every data file is checked out with CRLF, which breaks the frozen pool files.
- Set `PYTHONUTF8=1` for every pipeline command. Python's Windows default (cp1252) misreads
  `data/drivers.json` (e.g. Räikkönen). Every pipeline `write_text` passes
  `encoding="utf-8", newline="\n"`, so builds write LF on Windows too; keep that on new writers.
- `corepack enable` needs admin; `npm install -g pnpm@12.15.0` works instead. Playwright:
  `playwright install chromium` (no `--with-deps`).
- Local dev: `npx wrangler d1 migrations apply pitwall-db --local`, then
  `pnpm --filter @laststint/worker schedule --local --days 7`, then `wrangler dev --var
  ERAS_TEST_MODE:true` (apps/worker, :8787) and `vite` (apps/web, :5173, proxies `/api`).

Not in git, so it must be copied over by hand:

| What | Path | Size | Needed for |
|---|---|---|---|
| Eras source cache (TUM SQLite, Jolpica, F1DB) | `pipeline/cache/eras-sources/` | ~91 MB | Rebuilds, sc_rates, 2 TUM fault tests (they skip without it) |
| FastF1 cache | `cache/` | ~40 MB | Re-ingesting races (rare; `data/raw` is committed) |
| Wrangler login | — | — | `npx wrangler login` on the new machine (staging only) |
| Local Claude settings | `.claude/settings.local.json` | — | Optional; contains Mac paths |

The TUM database path is `pipeline/cache/eras-sources/tum/repo/F1_timingdata_2014_2019.sqlite`
(`pipeline/src/pipeline/tum.py` `DEFAULT_DB`). You can also point `TUM_DB` at it.

**Moving the repo.** `eras` and ~100 `eras-*` branches are local only, and pushing `eras` deploys
staging. To move everything without pushing, make a bundle on the Mac and clone it on the PC:

```sh
# Mac
git bundle create laststint.bundle --all
# PC
git clone laststint.bundle LastStint && cd LastStint
git remote set-url origin https://github.com/reuhenbhalod/LastStint.git
git checkout eras
```

Do this with no agents running and no uncommitted work in any worktree. Worktrees don't move;
recreate them from branches as needed.

Mac-only habits to drop: `caffeinate -dims` (on the PC, turn off sleep while long runs go),
and `/Users/reuhenbhalod/...` absolute paths in older docs and briefs (read them as repo-relative).

---

## Current feature: Eras mode

Read these first: `docs/eras-remaining-work.md` (handover spec, rules, decisions, sectors A–D),
`docs/laststint-eras-mode-spec.md` (the feature), `docs/eras-build-plan.md`,
`docs/eras-races-report.md` (per-race status, the source of truth for counts),
`docs/eras-grader.md`, `docs/simulator-roadmap.md`, `docs/staging.md`.

### Owner decisions already made (don't re-ask)

- Era order: Era 10 (2022–25) → Era 1 (1983–88). An era unlocks at 70% (21/30 stars). Legend
  leaderboards never reset. Every decision is timed (45/30/20 s), with an accessibility opt-out
  that marks stars "untimed".
- Side = the car with more hard calls (`pipeline hard-calls`, honest grader), shared races too.
  Exception: austria-2002 stays Barrichello, takeover lap 26.
- No rewrite (history book) in races the Eras side really won.
- Storyline retirements of the player's car are avoidable only if the real call is repeated.
- Refuelling: a fill is required on every pit call; real calls carry the real fill
  (`{laps:n}`); fill rate pinned to ~0.25 s per lap of fuel.
- No safety cars before 1993. Legend: calls follow the drawn SCs; scripted stops pay real conditions.
- Rival policies per spec §7 (Standard / Standard+ / Smart / Expert; Expert 100 samples).
- Race swaps done (migration 0012): brazil-2024→belgium-2023, brazil-2016→great-britain-2016,
  japan-1989→france-1990, san-marino-1985→germany-1986. New swaps need owner approval.
- Restart model and dirty-air model stay off; lapped status from real lap counts is on.
- Fully wet reconstructed races use the solver's dry pace. Disqualified cars with a sourced road
  place (`roadPositions`) are placed on the road (e.g. Bellof, monaco-1984).
- Shared races follow "hard calls win" too (side set in the overlay).
- **south-africa-1983 is played as Piquet** (owner confirmed 2026-11-08). The hard-call count
  ties 0–0 (Prost by 0.3 pts), but Prost's lap-35 turbo failure has no sourced avoidable call.

### Open owner decisions (ask, don't assume)

- **Expert rival grader fix** (see open items): it makes hungary-1998 Legend unreachable.
- Any new race swap (B4).

### Status (2026-11-09, integration B)

Newest first; the 2026-11-08 notes below still hold where this doesn't replace them.

- **Integration B** (`eras-integrate-b`, merged into `eras`; nothing pushed) adds:
  - B2 (`eras-b2-reauthor`): malaysia-2013 and spain-2016 re-authored on the real P2 (the win
    stays as the rewrite), spain-2013's hidden objective changed. All three reachable. Sheet:
    `docs/eras-checks/b2-reauthor.md`.
  - B1 (`eras-b1-europe-1997`): europe-1997 authored from Villeneuve (no rewrite). brazil-2019
    re-checked after A4, still reachable. Sheet: `docs/eras-checks/b1-europe-1997.md`. It also
    adds `teamOrder` to the moment trigger enum in `race-model.schema.json` (additive; Daily and
    Gauntlet files unchanged), which needs the owner's OK (spec §19).
  - A2 e2e (`eras-a2-e2e`): radio assertions for monaco-1988 (pit wall), brazil-2019 (damage
    fault) and canada-2014 (engine fault). The austria-2002 team-order test is `test.fixme`:
    austria-2002 has no `teamorder-71` moment, and the sim's Schumacher passes Barrichello by
    lap 52, so the order never fires.
  - The pit card now names the fuel fill on tyre buttons when a refuelling stop offers one
    compound at several fills (they all read "Mediums" before).
  - Windows support: native setup notes above, LF/UTF-8 pipeline writers.
- **Counts now** (`docs/eras-races-report.md`): 48 pass, 1 borderline, 51 fail; **49 authored,
  49 reachable, 47 ready**. By era (ready): E10 2, E9 5, E8 5, E7 2, E6 3, E5 1, E4 3, E3 6, E2 10,
  E1 10. Authored but not ready: spain-2013 (G1 fail), china-2011 (borderline).
  Passing but not authored: hungary-2024 (robust G1 re-run at 973d827: pass, 2.52 s). B3
  near-miss attempt found no honest fix for spain-2013, china-2011, abu-dhabi-2012 or
  brazil-2021 (`docs/eras-checks/b3-near-misses.md`): they need model gaps 1 and 3.
- **Owner review from integration B**: the two P2 targets (and that their ★1-3 path is the real
  calls), europe-1997's no-rewrite choice (portugal-1984 does have one), the schema enum, the
  europe-1997 facts that came through a summarising fetch tool, and the A2 radio-wording notes
  in the B and A2 reports (raw driver codes in lines, no board signs reachable in Eras 1–2,
  `damage` has only the generic fault line).

### Status (2026-11-08)

`docs/eras-remaining-work.md` §1 ("Where things stand") and §5 were written before
integration 8 and are out of date. Where they disagree, this section is right.

- **Integration 8** (12 Sector 1 branches) is merged into `eras` (`48432d5`). It reported
  47 pass, 1 borderline, 52 fail, 0 unbuilt; 44 authored, 41 reachable, 39 ready.
- **Current counts** in `docs/eras-races-report.md` (integration 8 + Eras 1–2 authoring; not yet
  updated for Sector A): 47 pass, 1 borderline, 52 fail; **48 authored, 45 reachable, 43 ready
  to publish**. Eras 1 and 2 are 10/10 ready, pending owner sign-off. By era, ready / pass:
  E10 2/3, E9 5/5, E8 4/4, E7 1/2, E6 2/3 (+1 borderline), E5 1/1, E4 3/3, E3 5/6, E2 10/10,
  E1 10/10. Authored but not ready: spain-2016, malaysia-2013, spain-2013 (unreachable),
  china-2011 (borderline), brazil-2019 (failed G1 before A4). Passing but not authored:
  hungary-2024 (now borderline after A4), europe-1997.
- **Eras 1–2 final authoring** is merged into `eras` (`cf8ed2c`: south-africa-1983,
  france-1990, monaco-1992, brazil-1993).
- **Sector A** (all four fixes) is merged into `eras` (via `eras-integrate-a`), along with a
  rebuild of brazil-2019, hungary-2024 and europe-2012. Reachability after it: 40/43 authored
  races (the 3 failures below) and 5/5 shared.
  - A1 San Marino 2005 fill cap (`planner.ts fuelled` caps fills at `fillCap`); the Era 5 e2e
    test is un-`fixme`'d.
  - A2 radio lines for `fault`, `storyline` (retired) and `team-order` notes, with pit-board style
    in Eras 1–2 (`engineerRadio.ts`, `board` flag from `session.ts`).
  - A3 the grader keeps later real stops after a queued one (`grade.ts playOption`,
    `sim.ts erasContinuation`, Eras-gated). Daily grades were checked byte-identical on all 39
    pool races.
  - A4 `fault: "damage"` (contact) on the existing FAULT event. Facts are in
    `docs/eras-checks/a4-contact-damage.md`. Robust G1: brazil-2019 fail→pass, europe-2012
    fail→pass, hungary-2024 fail→borderline.
- **Sector A effect on the report** (to be written into `docs/eras-races-report.md` at the next
  integration): brazil-2019 (authored, HAM) fail → pass, so it becomes ready if reachable;
  europe-2012 still passes (1.16 s); hungary-2024 pass → borderline.
- **Tests on the merged branch** (Sector A + Eras 1–2 authoring): sim 1651, worker 182, web 688,
  pipeline 1596 (+18 skipped); typecheck, biome, ruff clean.
- **Hotfix** `hotfix-wet-takeover-two-compound` (from `origin/main`) is pushed and waiting for the
  owner's PR and deploy. After the deploy, run:
  `UPDATE runs SET verified = 0 WHERE date IN (SELECT date FROM daily WHERE race_id = 'canada-2024');`
  (from `apps/worker`: `npx wrangler d1 execute pitwall-db --remote --command "…"`; that's
  production, so only the owner runs it).
- **Staging:** API https://pitwall-staging.boxboxbox.workers.dev (D1 `pitwall-staging-db`,
  migrations 0001–0012, `ERAS_TEST_MODE=true`); website
  https://pitwall-web-staging.boxboxbox.workers.dev.

### Open items carried out of Sector A

- ~~Reachability failures (B2)~~: done in integration B.
- **Expert rival grader** (`packages/sim/src/rivals/expert.ts` `rivalPlayout`) has the same
  "nothing queued" bug A3 fixed. Fixing it makes hungary-1998 Legend unreachable, so it needs the
  owner's decision plus a re-author of hungary-1998.
- ~~San Marino 2005 plans all run dry / planner fallback stops past the tank~~: done in
  integration C (`eras-b3-tank-planner`). It was every authored refuelling race, not just San
  Marino. Plans now respect the tank on board, `fillCap` and push burn; fallback stops fill
  within the tank (parity updated); Daily grades byte-identical. Owner review: refuelling races
  now offer different (all two-stop in tight races) plans; europe-1997's "different plan" gap
  is 3 laps instead of 6.
- **A2 e2e:** done in integration B, except austria-2002's team-order line (`test.fixme`; needs
  a re-author with a `teamorder-71` moment and Barrichello able to lead to the end).
- **A2 wording to confirm:** in Eras 1–2 the retirement line comes from "Pit wall", and board
  signs end in "?" (`SLOW · GEARBOX?`).
- ~~Fuel line on a stopped car~~: done in integration C ("The car's stopped"; pit wall in Eras 1–2).
- ~~hungary-2024 borderline~~: passes robust G1 at 973d827 (2.52 s); authoring in integration C.
- ~~brazil-2019 re-check after A4~~: done in integration B (reachable, story unchanged).
- **austria-2002 BAR lap 62** real call grades ~3% live. That's because the race plays out as it
  really did (Barrichello loses to Schumacher), not because of a bug. Revisit when authoring.
- **Expert rival cost** on a real phone isn't measured yet (bench: ~0.3 s per decision at 5×).
- Owner sign-off is needed for `docs/eras-checks/a4-contact-damage.md`. One Autosport quote in it
  came through a fetch tool, so verify its wording.

### Remaining work (details and "done when" checks in `docs/eras-remaining-work.md` §4)

- **B — content:**
  - B1: author every race that passes but isn't authored: europe-1997, hungary-2024 if it gets
    back to a pass, china-2007 if it passes, and any race that starts passing; see the races
    report. Per race: `pipeline hard-calls` → side; moments (`pnpm --filter @laststint/sim author
    <id> --target --eras`); `eras` block (target with sourced positions, storyline, mastery,
    hidden, briefing; no rewrite if the side really won); `storylineEvents`; facts sheet.
  - B2: re-author broken races (the three above, and hungary-1998 if the Expert fix goes in).
  - B3: optional model work (per-stint wear for scripted cars, drying line, restart pace spread,
    tank-aware planner).
  - B4: fill every era to 10 races, by fixing failing races or swapping (owner approves swaps).
- **C — integrate and report:**
  - C1: integrate, rebuild every non-pool race, regenerate files, and run all checks plus e2e.
  - C2: owner signs off every `docs/eras-checks/*.md` sheet (priority list in §4 C2).
  - C3: publish races (`era_races.published = 1`).
- **D — release:**
  - D1: add the staging URL to Auth0 and Google OAuth.
  - D2: play through on staging (phone and desktop); this needs `eras` pushed.
  - D3: before the PR, clean history: strip Claude co-author/session lines and drop
    `docs/Game changes.pdf` and `docs/LastStint Logo.html` with `git filter-repo` on a copy, and
    get the owner's OK before force-updating.
  - D4: PR to `main`, then deploy worker + web with production migrations 0009–0012 in the same
    deploy (0009 renames race IDs, so `usa-2022` days return 503 until it runs). Production
    `ERAS_TEST_MODE` stays `false`.
  - D5: release eras one at a time (`released_at`) once each has 10 published races.

### Local state to know about

- On GitHub (checked 2026-11-08 from the PC): `eras`, `eras-integrate-a` and ~115 `eras-*`
  branches **are** on GitHub, at the commit that added this file (22533d0); they were pushed
  when the repo moved off the Mac. Pushing `eras` runs `staging.yml`, so staging probably
  deployed that commit. Everything after it (integration B) is local only.
- The Mac's `.worktrees/` don't exist on the PC. Integration B's agent worktrees are under
  `.claude/worktrees/` (git-ignored) and can be removed once `eras` has their branches.
- Worktrees under `.worktrees/`: `fix-contact-loss`, `fix-grader-queued-stop`, `fix-radio-lines`
  and `fix-sm2005-fill` are merged into `eras-integrate-a` and can be removed
  (`git worktree remove`). `fix-contact-loss/scratch/` holds only before/after measurements and
  can be deleted. A stale worktree entry at the old `BoxThisLap/.claude/worktrees/` path can go
  with `git worktree prune`.
- Untracked in the main checkout, never commit: `.claude/`, `docs/Game changes.pdf`,
  `docs/LastStint Logo.html`. Stage files by name, not `git add docs` or `git add -A`.
- Commits already on `eras` that carry Claude attribution lines are cleaned up in D3.
- The Mac repo has 3 old `git stash` entries (owner's; never inspected). A `git bundle` carries
  at most the newest one (`refs/stash`). Owner decided 2026-11-08 to leave them behind.

### Key files

- Sim: `packages/sim/src/{sim,grade,moments,planner,rules,refuel,legend,redflag,faults,scripted}.ts`,
  `packages/sim/src/rivals/`, `packages/sim/src/eras/`.
- Pipeline: `pipeline/src/pipeline/{build,assemble,fit,pace,track,wet,reconstruct,refuel,faults,incidents,legend,hard_calls,sim_reference,validate}.py`.
- Worker: `apps/worker/src/{eras,erasEval,erasHistory,erasOverlay,erasMerge}.ts`, migrations 0009–0012.
- Web: `apps/web/src/eras/`, `apps/web/src/game/engineerRadio.ts`, `apps/web/src/screens/RaceScreen.tsx`,
  `apps/web/e2e/eras-play.spec.ts`.
- Data: `data/pools.json` (frozen pools + eras), `data/eras/` (overlays), `data/incidents.json`
  (incl. FAULT/damage), `data/moments/`, `data/reconstruction/`, `data/sc_rates.json`.

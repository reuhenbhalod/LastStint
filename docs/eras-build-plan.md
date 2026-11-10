# Eras mode: build plan

Status: draft 2026-11-07. This plan takes Eras mode from 0% to 100%.
- **What to build:** `laststint-eras-mode-spec.md` (the feature).
- **The models and data it needs:** `simulator-roadmap.md`.
- **How to build it:** this plan. Every step has an id, a weight, what it depends on, and a
  "done when". Progress is the sum of the weights of the steps that are done.

## Rules for the whole build

- **Build in phase order, except where the dependency column allows parallel work.** Backend
  and UI (phases 7–8) can start as soon as phase 1 is done, built against the 12 races that
  already exist.
- **The implement → review → test loop.** Each step is built by the implementer, reviewed by
  the code reviewer and checked by the tester (the repo's agents) before it's marked done.
- **Model changes land in the TS sim (`packages/sim`) and the Python reference sim
  (`pipeline/src/pipeline/sim_reference.py`) together,** with the parity check passing in CI.
- **Daily and Gauntlet must behave exactly as before.** Their tests run on every step.
- **No invented race facts** (eras spec §19). Facts come from the pipeline or are checked by a
  person; anything missing stays a TODO.
- **Ask before changing a schema that Daily or Gauntlet already use:** the race JSON and the
  D1 tables.

## Progress

| Phase | Weight | Depends on |
|---|---|---|
| 0. Housekeeping | 3% | — |
| 1. Foundations | 8% | 0 |
| 2. Data pipeline | 11% | 1 |
| 3. Races, wave A (no new models) | 10% | 2 |
| 4. Sim models | 20% | 1 |
| 5. Races, wave B | 13% | 3, 4 |
| 6. Race content | 8% | each race passing in 3 or 5 |
| 7. Backend | 8% | 1 |
| 8. UI | 12% | 1, 7 (screens can start on mocks) |
| 9. Difficulty and Legend | 4% | 4, 8 |
| 10. QA and release | 3% | all |
| **Total** | **100%** | |

### Step dependencies

The phase table above is the simple order. This table is the real one, per step. **Start now** means the step depends on nothing else.

| Step | Depends on | Start now? |
|---|---|---|
| 0.1 Rename race IDs | — | **Yes** |
| 0.2 Test environment | — | **Yes** |
| 0.3 Commit the specs | — | **Yes** |
| 1.1 Race JSON schema | 0.1 (both edit every race file) | No |
| 1.2 Era config blocks | — | **Yes** |
| 1.3 Eras config | — | **Yes** |
| 1.4 Goals and evaluator | 1.1, 1.3 | No |
| 1.5 Hard-call counter | 1.1 | No |
| 2.1 `tum.py` | — | **Yes** |
| 2.2 `jolpica.py` | — | **Yes** |
| 2.3 `f1db.py` (formula1.com dropped) | — | **Yes** |
| 2.4 Estimated fields | 1.1, 2.2 | No |
| 2.5 Track maps | — | **Yes** |
| 2.6 Drivers, teams, incidents | — | **Yes** |
| 3.1 Wave A races | 1.1, 1.2, 2.5, 2.6; plus 2.1 for TUM races and 2.2 + 2.4 for Jolpica races | No (the 4 OpenF1 / FastF1-cache races only need 1.1, 1.2, 2.5, 2.6) |
| 3.2 Build report | 3.1, 1.5 | No |
| 4.1 Era rules | 1.1, 1.2 | No |
| 4.2 Refuelling, fuel limits | 4.1 | No |
| 4.3 Red flags | 1.1 | No |
| 4.4 Car faults | 1.1 | No |
| 4.5 Wet before 2018 | 1.1; 2.1 or 2.2 for the laps | No |
| 4.6 Reconstruction solver | 2.2, 2.3, 4.1 | No |
| 5.1 Wave B races | 3.1, plus each race's models from 4.x | No |
| 5.2 Report | 5.1 | No |
| 6.1 Reachability checker | 1.4; 9.1 and 9.2 for the full era and Legend check | No |
| 6.2 Author every race | 1.4, 1.5, 6.1, and that race built (3.1 or 5.1) | No |
| 7.1 Migration `0010_eras.sql` | 0.1 (migration 0009 comes first) | No |
| 7.2 API | 7.1, 1.3 | No |
| 7.3 Server evaluation | 7.2, 1.4 | No |
| 7.4 History, stats, leaderboards | 7.3 | No |
| 7.5 Account merge | 7.1 | No |
| 8.1 Entry and routing | — | **Yes** |
| 8.2 Era map | 8.1; 7.2 for live data (mocks before) | No |
| 8.3 Era detail | 8.2 | No |
| 8.4 Race intro | 8.3, 1.4 | No |
| 8.5 Era-adaptive race screen | 1.1, 4.1; 4.2 for the fuel controls | No |
| 8.6 Difficulty presentation | 1.3 | No |
| 8.7 Results | 1.4, 7.3 | No |
| 8.8 History book, leaderboards | 7.4 | No |
| 9.1 Rival policies | 1.3 | No |
| 9.2 Legend | 1.1, 1.3 | No |
| 10.1 End-to-end tests | phases 7 and 8, and one finished race per era (6.2) | No |
| 10.2 Test play-through | everything above | No |
| 10.3 Release | 10.2 | No |

**Waves of parallel work** (each wave can start once the one before it is done):

| Wave | Steps | Weight |
|---|---|---|
| 1 | 0.1, 0.2, 0.3, 1.2, 1.3, 2.1, 2.2, 2.3, 2.5, 2.6, 8.1 | 15% |
| 2 | 1.1, 7.1, 8.6, 9.1 | 6.5% |
| 3 | 1.4, 1.5, 2.4, 4.1, 4.3, 4.4, 4.5, 7.2, 7.5, 9.2, and the 4 OpenF1 / FastF1 races in 3.1 | 23.5% + part of 3.1 |
| 4 | 4.2, 4.6, 6.1, 7.3, 8.2, 8.5, and the rest of 3.1 | 16.5% + 3.1 (8%) |
| 5 | 3.2, 5.1, 7.4, 8.3, 8.7 | 17% |
| 6 | 5.2, 6.2, 8.4, 8.8 | 10.5% |
| 7 | 10.1 | 1% |
| 8 | 10.2 | 1% |
| 9 | 10.3 | 1% |

---

## Phase 0: Housekeeping (3%)

**0.1 Rename the inconsistent race IDs (1.5%)**
Rename `usa-2018`, `usa-2021` and `usa-2022` to `united-states-<year>`, and `saudi-2022` to
`saudi-arabia-2022`, so every race ID follows `<event-slug>-<year>`.
- **Files:**
  - `git mv` each race's files in `data/races`, `data/raw` (`.parquet`, `.status.json`),
    `data/tracks`, `data/golden` and `data/moments`;
  - the `race.id` inside each race JSON;
  - the keys in `pipeline/src/pipeline/build.py`, `data/incidents.json`,
    `data/retirements.json` and `data/pools.json`;
  - the tests: `packages/sim/tests/green-entry.test.ts`, `apps/web/src/track/battle.test.ts`,
    `pipeline/tests/test_model_v3.py`, `apps/worker/test/shuffle.test.ts`;
  - `packages/sim/scripts/whatif.ts`;
  - the docs that cite them (`g1-report.md`, `phase-1-closeout-spec.md`).
- **Code:**
  - regenerate `apps/worker/src/races.gen.ts` with `pnpm --filter @laststint/worker races`;
  - in `apps/worker/src/shuffle.ts`, remove the `united-states → usa` and
    `saudi-arabia → saudi` aliases from `SAME_CIRCUIT`, which are no longer needed.
- **Live data:** `usa-2022` is in the Daily pool. A scheduled daily stores its `race_id` and
  the race file's `model_hash`, and `runs.ts` rejects a run whose hash doesn't match. The race
  ID is inside the race file, so renaming changes the hash.
  - Add migration `apps/worker/migrations/0009_rename_race_ids.sql`. It updates `daily.race_id`
    and `daily.model_hash` (the new hash, computed with the worker's `modelHash`), and
    `survivor_rounds.race_id` and `model_hash`, wherever the old ID appears.
  - The owner applies it to production with the deploy that ships the rename, never separately.
- **Done when:**
  - `pnpm test`, `pnpm typecheck` and the pipeline tests pass;
  - `rg 'usa-20|saudi-2022'` finds nothing outside the migration and git history;
  - a local D1 with a daily scheduled on `usa-2022` serves and accepts runs after the migration.

**0.2 Test environment (1%)**
- A staging worker and D1 with `ERAS_TEST_MODE=true`: every era and race open, Draft races
  shown (eras spec §5).
- Production keeps it `false`.
- **Done when:** staging deploys from a branch, and its flag is off in production config.

**0.3 Commit the specs (0.5%)**
- Commit `laststint-eras-mode-spec.md`, `simulator-roadmap.md` and this plan on a feature
  branch, separately from the in-progress LastStint rename edits.
- **Done when:** a PR is open with only these docs.

## Phase 1: Foundations (8%)

**1.1 Race JSON schema (1.5%)**
- Add to the race schema:
  - the optional `eras` block (eras spec §11), with `hardCalls`;
  - `provenance` (`real` | `reconstructed`) and the list of estimated fields;
  - a `rules` block: `twoCompound`, `tyreChanges`, `refuelling`, `fuelLimit`,
    `pitLaneClosedUnderSC`, `vsc`, `drs`, `ers`;
  - `storylineEvent` on events.
- Bump `schemaVersion`. Update `packages/schema/race-model.schema.json`, the TS types, and
  `pipeline/export.py`.
- Existing race files stay valid (every new field is optional, with a default that matches
  today).
- **Done when:** all 60 race files validate unchanged; schema tests cover each new field.

**1.2 Era config blocks (1.5%)**
- Add a block for each schema era (`1988-1993`, `1994-2009`, `2010-2013`, `2014-2025`) to
  `packages/sim/src/headset.json` and `pipeline/config/compound_priors.json`.
- Older eras switch off ERS and DRS (roadmap R5). Rates are copied from `2014-2025` until
  they're tuned.
- **Done when:** a race file re-tagged to each era builds and plays without a crash, and
  engineer calls and incidents still fire.

**1.3 Eras config (0.5%)**
- One config file with:
  - `ERA_UNLOCK_SHARE = 0.7`;
  - the 2.5 accuracy multiplier;
  - `HARD_CALL_EDGE` (5 points);
  - the difficulty table (eras spec §7: thresholds, information level, rival policy, timer
    45/30/20 s).
- Read by the worker and the web app.
- **Done when:** changing a value in the config changes the behaviour, with no code edit; a
  test proves it.

**1.4 Goals and the objective evaluator (3%)**
- **Goals:** extend the grader's `Target` (`win`, `beat-rival`, `position` exist in
  `packages/sim/src/grade.ts`) with `deny` (a rival kept at a set position or lower) and
  `team` (both cars at set positions). `defend` is `win` from P1, framed as a defence in the
  UI. The six target types are in eras spec §6.
- **The evaluator:** one module, shared by the client preview and the server. It takes a
  finished race and the race's `eras` block, and returns:
  - ★1 Result;
  - ★2 Strategist (the accuracy formula);
  - ★3 Mastery (the objective plus no orange or red call);
  - the hidden objective;
  - the rewrite.
- **Done when:** it supports all 8 mastery types (`stop_count`, `beat_real_call`,
  `finish_position`, `margin`, `compound_rule`, `mode_rule`, `no_neutralized_stop`,
  `team_result`), and unit tests cover every type with retirements, red flags and ties.

**1.5 Hard-call counter (1.5%)**
- A pipeline command, `pipeline hard-calls <race>`. It runs the moment finder and the grader
  from each storyline driver's side on the real race, counts the moments whose best two
  options are within `HARD_CALL_EDGE`, and writes `eras.hardCalls`.
- It sets `userSide` to the higher count; a tie goes to the side whose real calls gave up the
  most chance.
- **Done when:** it runs on `abu-dhabi-2021`, and a test checks the counts and the tie rule
  on a fixture.

**Eras overlay files (decided Nov 7).** `pipeline build` writes each race file fresh from the
timing data, so authored Eras content can't live in `data/races/<id>.json`. Instead it lives in
`data/eras/<race-id>.json`, one file per race, with up to five top-level keys: `eras`,
`provenance`, `rules`, `storylineEvents` (a list of `[lap, eventType]`) and `decisionMoments`
(Nov 8: the Eras side's moments for a shared race whose hard-call side isn't its Daily side;
an Eras-only race keeps its moments in `data/moments/`). `pipeline build`
applies the overlay with `export.with_eras_fields` (step 2.4 adds this). Each step writes only
its own keys: 1.5 writes `eras.hardCalls` and `eras.userSide`, 2.4 writes `provenance`, 4.1
writes `rules`, 6.2 writes the rest of `eras` and `storylineEvents` (and `decisionMoments` on a shared race). The merge plays the model from `eras.userSide`:
when that is the race file's rival, userSide and rival swap in place (owner decision Nov 8: the
hard-call side wins, also on shared races). An Eras-only race whose hard-call side differs from
its registry `user_side` is re-registered for that side and rebuilt.

**Shared races (decided Nov 7).** A race in Eras and in the Daily or Gauntlet pool
(`data/pools.json`: today abu-dhabi-2021, bahrain-2021, france-2021, hungary-2019 and
russia-2021) keeps its Daily race file and hash unchanged forever. Its Eras content stays in its
overlay, which is never baked into `data/races/<id>.json`:
- `pipeline build` leaves a pool race's overlay out of its race file (`build.shared_races`; the
  report says so). A pool race with estimated fields can't take an overlay `provenance`, since
  the Worker's merge replaces the block. Eras races in no Daily or Gauntlet pool still take
  their overlay into the file.
- The Worker generator bundles the shared races' overlays (`races.gen.ts` `ERAS_OVERLAYS`).
  The Eras API (`getErasRace`: the attempt pin, `GET /api/eras/races/:raceId/model?h=`, server
  evaluation, the history book) uses the race file merged with its overlay
  (`apps/worker/src/erasOverlay.ts`, the same merge as `export.with_eras_fields`), pinned by the
  merged model's own hash. The nightly re-grade (`scripts/reverify.ts`) merges the same way.
  `GET /api/races/:id` and the Daily hash use the race file alone.
- Parity vectors keep the two merges equal (`pipeline/tests/fixtures/eras_overlay_parity.json`,
  regenerated with `REGEN_OVERLAY_VECTORS=1`). `apps/worker/test/eras-shared.test.ts` replays
  them and pins the five Daily hashes and their Eras hashes.
- Editing a shared race's overlay changes its Eras hash only. Attempts started before the edit
  are refused at submit (409 `model-changed`), as for a rebuilt Eras-only race.

## Phase 2: Data pipeline (11%)

Each adapter writes the same raw parquet (`LAP_COLUMNS`) and status JSON as `ingest.py`, so
cleaning, fitting and assembly run unchanged (roadmap P1). Each source is cached once, with a
pinned version; tests run on cached fixtures only.

**2.1 `tum.py` (2%)**
- Reads the TUM SQLite for 2014–2019, and maps the A1–A7 compound codes to SOFT/MEDIUM/HARD
  per race.
- **Done when:** `abu-dhabi-2018` rebuilt from TUM matches today's FastF1 build: the same stop
  laps and compounds for every driver, and `basePace` within 0.1 s.

**2.2 `jolpica.py` (2%)**
- Reads the Jolpica CSV dump: laps, positions, results, retirements, standings; pit stops
  from 2011.
- **Done when:** each lead-lap finisher's summed laps match the official race time within
  0.1 s, on 3 races from different decades.

**2.3 `f1db.py` (1.5%)**
- **formula1.com is dropped.** Its legal notice allows personal, non-commercial use only and
  forbids extracting or redistributing "historical race data" without F1's written consent
  (checked Nov 7, 2026).
- `f1db.py`: F1DB (CC BY 4.0; the credits screen must name F1DB under CC BY 4.0) gives every
  stop from 1994 (1994: 14 of 16 races; none before) and each driver's fastest lap and its lap
  for every race from 1983. Output in `data/raw/f1db/`.
- **Done when:** every stop lands on its official lap for `hungary-1998` and `japan-2005`.

**2.4 Estimated fields (1.5%)**
- **Compounds before 2014 (roadmap P2):** one dry compound before 2007; from 2007, two
  compounds assigned to stints from the pace step, with the both-compounds rule.
- **SC laps:** from field-wide slow laps, with a hand-check file per race.
- **Fuel loads:** stint length × burn rate.
- Every estimate is listed in the race file's `provenance`.
- **Done when:** each estimator has tests, and each race's estimates appear in the build
  report.

**2.5 Track maps (2%)**
- Reuse a 2018+ outline where the layout is unchanged. Otherwise import from OpenStreetMap,
  or hand-trace.
- Corner numbers, pit lane and start/finish are set by hand (roadmap P4).
- **Done when:** every race in the appendix has a track file that its race-screen map renders,
  and each one has been checked against an onboard lap of that year.

**2.6 Drivers, teams, incidents (2%)**
- Every driver in the 100 races goes into `data/drivers.json`, with researched radio
  attitudes.
- Team colours by team and year go in `teamTheme.ts`.
- Safety-car causes and fault facts go in `data/incidents.json`. All of it is fact-checked.
- **Done when:** `drivers.test.ts` passes for every race file, and no team falls back to the
  default colour.

## Phase 3: Races, wave A (10%)

The 35 races in the appendix that need **no new sim model** (Needs column: "none", "wet model
(exists)" or "P4 map" only).

**3.1 Build and validate (8%)**
For each race:
1. Ingest it (adapter or existing source).
2. Build it with `pipeline build`.
3. Run G1 (podium order and the main contenders' gaps, as today).
4. Run the server-match check, and tune its seeds with `scripts/tune.ts`.

A race that fails G1 gets a diagnosis (pace fit, overtakes, wet) and a fix. It's never
dropped silently.
- **Done when:** each race is marked pass or fail in the appendix with its G1 numbers, and
  every failure has an open fix or is reported to the owner.

**3.2 Build report (2%)**
- `docs/eras-races-report.md`: per race, the source, the estimated fields, the G1 result and
  the hard-call counts.
- **Done when:** it covers all wave A races.

## Phase 4: Sim models (20%)

Each model lands in both sims with parity tests, behind the race's `rules` block, and is off
for every existing race.

| Step | Model | Weight | Unblocks |
|---|---|---|---|
| 4.1 | **Era rules (R5):** no VSC, no DRS/ERS before their years, the two-compound rule by year, the 2005 no-tyre-change rule, the 2007–09 pit-lane closure, `scUnlap: none` | 3% | every pre-2014 race |
| 4.2 | **Refuelling and fuel limits (R4):** fill choice, fill time fitted per race, weight reset per stint, the 1984–88 capped tank | 4% | Eras 1, 3, 4, 5 |
| 4.3 | **Red flags (R1):** stop, free tyre change, restart, gaps wiped; `race_suitability` accepts them | 4% | 16 races |
| 4.4 | **Car faults (R2):** stuck gear, power loss, puncture, tyre failure as frozen `storylineEvent`s | 2.5% | 7 races |
| 4.5 | **Wet before 2018 (R3):** wetness from lap times and race reports; tyre changes from the stops | 3% | 24 races |
| 4.6 | **Reconstruction solver (P3):** fits pace, wear and noise to the real anchors (finishing order exact, lead-lap gaps within 2 s), and writes a synthetic raw parquet | 3.5% | 23 races (1983–95) |

- **Done when:** each model's unit tests and parity tests pass, all existing races replay
  identically (golden files unchanged), and one unblocked race builds with it.

## Phase 5: Races, wave B (13%)

**5.1 Build and validate the other 65 races (11%)**
- As in 3.1, as each race's models from phase 4 land.
- Reconstructed races are checked on their anchors (eras spec §4) instead of G1.
- **Done when:** every race in the appendix is pass, or flagged to the owner with a diagnosis.

**5.2 Report (2%)**
- Extend `eras-races-report.md` to all 100 races.

## Phase 6: Race content (8%)

**6.1 Reachability and difficulty checker (2%)**
- A script that searches decision paths at the era's difficulty, and at Legend. It confirms
  that some path earns all three stars and the hidden objective, and that the "stay out every
  time" path can't earn ★3.
- **Done when:** it runs in CI over every race with an `eras` block.

**6.2 Author every race (6%)**
For each of the 100 races, write:
- the `eras` block: target, storyline, rewrite condition, an original headline, the mastery
  and hidden objectives, the briefing;
- the decision moments;
- the `storylineEvent` flags;
- the hard-call counts (1.5).

Then work through the per-race checklist (eras spec §15).
- **Done when:** every race passes the checklist and the checker, with facts checked against
  sources.

## Phase 7: Backend (8%)

**7.1 D1 migration `0010_eras.sql` (1%)**
- The eras spec §12 tables. Era 10 is `play_order` 1.
- Seed the 10 eras and the 100 `era_races` with `published = 0`.
- Add an `eras` block to `pools.json`. The pools test becomes: a race is in at most one of
  Daily and Gauntlet, and may also be in Eras.
- **Done when:** the migration applies to a local D1, and the pools test passes with the five
  shared Daily races.

**7.2 API (3%)**
- The eras spec §13 endpoints.
- Attempts: server-generated seeds, a 24 h expiry, and gating by lock, release and Legend,
  bypassed when `ERAS_TEST_MODE` is on.
- **Done when:** worker tests cover every endpoint and every rejection.

**7.3 Server evaluation (2%)**
- On submit:
  1. replay the decisions with the attempt's seed;
  2. run the evaluator (1.4);
  3. write the best result per star;
  4. write the history entry on a rewrite;
  5. reject or correct tampered submissions.
- The nightly re-grade covers Eras attempts.
- **Done when:** the eras spec §18 tamper, persistence and "worse attempt" criteria pass.

**7.4 History, stats, leaderboards (1.5%)**
- The history book counts, community rewrite % (cached), and per-race leaderboards (normal and
  Legend, never reset).
- **Done when:** the counts match the database exactly in a test.

**7.5 Account merge (0.5%)**
- On sign-in, merge anonymous progress: best per star, and every history entry. Accounts
  already exist (Auth0 and Google).
- **Done when:** a test merges two players' progress correctly.

## Phase 8: UI (12%)

**8.1 Entry and routing (0.5%)**
- An "Eras" pill in the header next to "Gauntlet". `/eras` and `/eras/<era>` routes in
  `App.tsx`. An `EraProvider` that loads a race by attempt.

**8.2 Era map (2%)**
- A timeline from 2025 back to 1983 in play order.
- Each node shows its stars and a lock; later eras show as locked until the player reaches
  70% in the one before.
- Unreleased eras show "Coming soon" in production; on test, all are open with their lock
  state still shown.
- Phone layout: no sideways scroll at 390 px.

**8.3 Era detail (1.5%)**
- The briefing, then 10 race cards with stars, best accuracy, and the Reconstructed and Draft
  badges.
- A Legend toggle once the era is Cleared.

**8.4 Race intro (1%)**
- The dilemma, the three objectives (★3 in full), and the era's difficulty, information level
  and timer.

**8.5 Era-adaptive race screen (3%)**
All driven by the race's `rules` and the era config:
- hide the battery and ERS before 2009, and DRS before 2011;
- the fuel-fill choice on the pit card, and the fuel gauge to the next stop, in refuelling
  years;
- tyre badges by era, and the 2005 tyre lock;
- the pit-lane-closed notice;
- pit-board prompts in Eras 1–2.

**8.6 Difficulty presentation (1.5%)**
- **Information levels:** Full, Reduced, Limited, Minimal.
- **The decision timer** on every decision (45/30/20 s), with the default option when it runs
  out. An accessibility setting turns it off; that attempt's stars are marked untimed.

**8.7 Results (1%)**
- The stars earned, a "new star" animation, the rewrite headline and the community stat, added
  to the existing review screen.

**8.8 History book and leaderboards (1.5%)**
- Completion %, per-era progress, rewrite entries, badges, and per-race leaderboards.

- **Done when (phase 8):** each screen has component tests, and the eras spec §18 UI criteria
  pass on a phone and a desktop.

## Phase 9: Difficulty and Legend (4%)

**9.1 Rival policies (2.5%)**
- Standard+, Smart and Expert (eras spec §7) in both sims, with parity tests.
- Measure Expert's cost on a mid-range phone; if it's too slow, precompute or simplify, and
  report back.

**9.2 Legend (1.5%)**
- Hardest settings; random safety cars at the track's historical rate, except
  `storylineEvent`s; separate stars.
- **Done when:** Legend safety cars move between attempts, and storyline events don't.

## Phase 10: QA and release (3%)

**10.1 End-to-end tests (1%)**
- One race per era, from the map to the result: refuelling, the 2005 tyre lock, no DRS,
  a red flag, a fault, a reconstructed race.
- Plus a full regression of Daily and Gauntlet.
- **Done (Nov 8 2026):** `apps/web/e2e/eras-play.spec.ts` (mocked Worker and play driver in
  `e2e/eras.ts`), at 1440 px (`desktop` project) and 390 px (`phone`). The playthroughs run
  laps at 5× through the app's e2e hook (`window.__laststintE2E`, src/game/useGame.ts). Runtime
  with `CI=1` (build included, 9 workers, 18-core laptop): 5 min 36 s for all 40 tests (38
  pass, 2 `fixme`); the slowest is the existing defend spec (4.5 min), and every Eras
  playthrough takes 27 s to 1.9 min. `E2E_PORT` moves the preview server off 4173.
- No authored race has a red flag or a car fault, so those are played on Draft races
  (italy-2020, canada-2014). Known app bug, `fixme` in the spec: san-marino-2005 can't be
  scored (a plan's fill to the flag is more than the tank holds).

**10.2 Test play-through (1%)**
- All 10 eras and 100 races on staging (`ERAS_TEST_MODE`).
- Log issues, fix them, and record the final pass rate in the races report.

**10.3 Release (1%)**
- Production: release Era 10 by setting its `released_at` once all 10 of its races are
  published, then each following era in play order.
- **Done when:** Era 10 is live in production, and the remaining eras have a release order and
  status recorded.

---

## Appendix: the 100 races

The **Needs** column is from race history and must be checked against the data for each race
(roadmap note).
- **Ids:** R1–R6 are the roadmap's sim models; P3 and P4 are its pipeline steps.
- **Wave A** is every race that needs none of R1–R4 or P3.
- **Status** starts empty and is filled in as phases 3 and 5 run: pass / fail with G1 numbers
  / reconstructed-anchors pass.

| Era | Race | Data source | Needs before it can build | Status |
|---|---|---|---|---|
| 10 | `bahrain-2023` | built | none |  |
| 10 | `great-britain-2023` | OpenF1 | none |  |
| 10 | `hungary-2022` | built | none |  |
| 10 | `japan-2023` | built | none |  |
| 10 | `netherlands-2023` | OpenF1 | R1 red flag, wet model (exists) |  |
| 10 | `emilia-romagna-2024` | OpenF1 | none |  |
| 10 | `hungary-2024` | built | none |  |
| 10 | `belgium-2023` | OpenF1 | wet model (exists) |  |
| 10 | `australia-2025` | built | wet model (exists) |  |
| 10 | `abu-dhabi-2022` | Jolpica (est. compounds, SC) | none |  |
| 9 | `bahrain-2021` | built (Daily) | none |  |
| 9 | `styria-2021` | built | none |  |
| 9 | `azerbaijan-2021` | Jolpica (est. compounds, SC) | R1 red flag, R2 fault |  |
| 9 | `france-2021` | built (Daily) | none |  |
| 9 | `hungary-2021` | FastF1 cache | R1 red flag, wet model (exists) |  |
| 9 | `russia-2021` | built (Daily) | wet model (exists) |  |
| 9 | `turkey-2021` | Jolpica (est. compounds, SC) | wet model (exists) |  |
| 9 | `netherlands-2021` | Jolpica (est. compounds, SC) | none |  |
| 9 | `great-britain-2021` | FastF1 cache | R1 red flag |  |
| 9 | `abu-dhabi-2021` | built (Daily) | none |  |
| 8 | `monaco-2017` | TUM | P4 map |  |
| 8 | `azerbaijan-2017` | TUM | R1 red flag, P4 map |  |
| 8 | `germany-2018` | TUM | wet model (exists) |  |
| 8 | `russia-2018` | TUM | none |  |
| 8 | `germany-2019` | TUM | wet model (exists) |  |
| 8 | `hungary-2019` | built (Daily) | none |  |
| 8 | `brazil-2019` | TUM | none |  |
| 8 | `italy-2020` | Jolpica (est. compounds, SC) | R1 red flag |  |
| 8 | `turkey-2020` | Jolpica (est. compounds, SC) | wet model (exists) |  |
| 8 | `sakhir-2020` | Jolpica (est. compounds, SC) | none |  |
| 7 | `bahrain-2014` | TUM | P4 map |  |
| 7 | `canada-2014` | TUM | R2 fault, P4 map |  |
| 7 | `hungary-2014` | TUM | R3 wet pre-2018, P4 map |  |
| 7 | `monaco-2015` | TUM | P4 map |  |
| 7 | `hungary-2015` | TUM | P4 map |  |
| 7 | `united-states-2015` | TUM | R3 wet pre-2018, P4 map |  |
| 7 | `spain-2016` | TUM | P4 map |  |
| 7 | `monaco-2016` | TUM | P4 map |  |
| 7 | `great-britain-2016` | TUM | R3 wet pre-2018, P4 map |  |
| 7 | `abu-dhabi-2016` | TUM | P4 map |  |
| 6 | `australia-2010` | Jolpica + F1DB stops (est. compounds) | R3 wet pre-2018, P4 map |  |
| 6 | `abu-dhabi-2010` | Jolpica + F1DB stops (est. compounds) | P4 map |  |
| 6 | `china-2011` | Jolpica (est. compounds) | P4 map |  |
| 6 | `monaco-2011` | Jolpica (est. compounds) | R1 red flag, P4 map |  |
| 6 | `canada-2011` | Jolpica (est. compounds) | R1 red flag, R3 wet pre-2018, P4 map |  |
| 6 | `europe-2012` | Jolpica (est. compounds) | P4 map |  |
| 6 | `abu-dhabi-2012` | Jolpica (est. compounds) | P4 map |  |
| 6 | `brazil-2012` | Jolpica (est. compounds) | R3 wet pre-2018, P4 map |  |
| 6 | `malaysia-2013` | Jolpica (est. compounds) | R3 wet pre-2018, P4 map |  |
| 6 | `spain-2013` | Jolpica (est. compounds) | P4 map |  |
| 5 | `san-marino-2005` | Jolpica + f1db (est. compounds, fuel) | R4 refuel, P4 map |  |
| 5 | `japan-2005` | Jolpica + f1db (est. compounds, fuel) | R4 refuel, P4 map |  |
| 5 | `hungary-2006` | Jolpica + f1db (est. compounds, fuel) | R3 wet pre-2018, R4 refuel, P4 map |  |
| 5 | `brazil-2006` | Jolpica + f1db (est. compounds, fuel) | R4 refuel, P4 map |  |
| 5 | `china-2007` | Jolpica + f1db (est. compounds, fuel) | R3 wet pre-2018, R4 refuel, P4 map |  |
| 5 | `europe-2007` | Jolpica + f1db (est. compounds, fuel) | R1 red flag, R3 wet pre-2018, R4 refuel, P4 map |  |
| 5 | `brazil-2007` | Jolpica + f1db (est. compounds, fuel) | R4 refuel, P4 map |  |
| 5 | `monaco-2008` | Jolpica + f1db (est. compounds, fuel) | R2 fault, R4 refuel, P4 map |  |
| 5 | `brazil-2008` | Jolpica + f1db (est. compounds, fuel) | R3 wet pre-2018, R4 refuel, P4 map |  |
| 5 | `brazil-2009` | Jolpica + f1db (est. compounds, fuel) | R4 refuel, P4 map |  |
| 4 | `germany-2000` | Jolpica + f1db (est. compounds, fuel) | R3 wet pre-2018, R4 refuel, P4 map |  |
| 4 | `japan-2000` | Jolpica + f1db (est. compounds, fuel) | R4 refuel, P4 map |  |
| 4 | `malaysia-2001` | Jolpica + f1db (est. compounds, fuel) | R3 wet pre-2018, R4 refuel, P4 map |  |
| 4 | `austria-2002` | Jolpica + f1db (est. compounds, fuel) | R4 refuel, P4 map |  |
| 4 | `brazil-2003` | Jolpica + f1db (est. compounds, fuel) | R1 red flag, R3 wet pre-2018, R4 refuel, P4 map |  |
| 4 | `hungary-2003` | Jolpica + f1db (est. compounds, fuel) | R4 refuel, P4 map |  |
| 4 | `united-states-2003` | Jolpica + f1db (est. compounds, fuel) | R3 wet pre-2018, R4 refuel, P4 map |  |
| 4 | `japan-2003` | Jolpica + f1db (est. compounds, fuel) | R4 refuel, P4 map |  |
| 4 | `france-2004` | Jolpica + f1db (est. compounds, fuel) | R4 refuel, P4 map |  |
| 4 | `monaco-2004` | Jolpica + f1db (est. compounds, fuel) | R4 refuel, P4 map |  |
| 3 | `spain-1994` | Reconstruct (real stops) | R2 fault, R4 refuel, P3 solver, P4 map |  |
| 3 | `australia-1994` | Reconstruct (real stops) | R4 refuel, P3 solver, P4 map |  |
| 3 | `belgium-1995` | Reconstruct (real stops) | R3 wet pre-2018, R4 refuel, P3 solver, P4 map |  |
| 3 | `spain-1996` | Jolpica + F1DB stops (est. fuel) | R3 wet pre-2018, R4 refuel, P4 map |  |
| 3 | `hungary-1997` | Jolpica + F1DB stops (est. fuel) | R4 refuel, P4 map |  |
| 3 | `europe-1997` | Jolpica + F1DB stops (est. fuel) | R4 refuel, P4 map |  |
| 3 | `hungary-1998` | Jolpica + F1DB stops (est. fuel) | R4 refuel, P4 map |  |
| 3 | `belgium-1998` | Jolpica + F1DB stops (est. fuel) | R1 red flag, R3 wet pre-2018, R4 refuel, P4 map |  |
| 3 | `malaysia-1999` | Jolpica + F1DB stops (est. fuel) | R4 refuel, P4 map |  |
| 3 | `europe-1999` | Jolpica + F1DB stops (est. fuel) | R3 wet pre-2018, R4 refuel, P4 map |  |
| 2 | `france-1990` | Reconstruct | P3 solver, P4 map |  |
| 2 | `united-states-1990` | Reconstruct | P3 solver, P4 map |  |
| 2 | `mexico-1990` | Reconstruct | P3 solver, P4 map |  |
| 2 | `brazil-1991` | Reconstruct | R2 fault, P3 solver, P4 map |  |
| 2 | `monaco-1992` | Reconstruct | P3 solver, P4 map |  |
| 2 | `belgium-1992` | Reconstruct | R3 wet pre-2018, P3 solver, P4 map |  |
| 2 | `hungary-1992` | Reconstruct | R2 fault, P3 solver, P4 map |  |
| 2 | `brazil-1993` | Reconstruct | R3 wet pre-2018, P3 solver, P4 map |  |
| 2 | `europe-1993` | Reconstruct | R3 wet pre-2018, P3 solver, P4 map |  |
| 2 | `australia-1993` | Reconstruct | P3 solver, P4 map |  |
| 1 | `south-africa-1983` | Reconstruct | R4 refuel, P3 solver, P4 map |  |
| 1 | `monaco-1984` | Reconstruct | R1 red flag, R3 wet pre-2018, R4 fuel limit, P3 solver, P4 map |  |
| 1 | `portugal-1984` | Reconstruct | R4 fuel limit, P3 solver, P4 map |  |
| 1 | `germany-1986` | Reconstruct | R4 fuel limit, P3 solver, P4 map |  |
| 1 | `portugal-1985` | Reconstruct | R3 wet pre-2018, R4 fuel limit, P3 solver, P4 map |  |
| 1 | `mexico-1986` | Reconstruct | R4 fuel limit, P3 solver, P4 map |  |
| 1 | `hungary-1986` | Reconstruct | R4 fuel limit, P3 solver, P4 map |  |
| 1 | `australia-1986` | Reconstruct | R2 fault, R4 fuel limit, P3 solver, P4 map |  |
| 1 | `great-britain-1987` | Reconstruct | R4 fuel limit, P3 solver, P4 map |  |
| 1 | `monaco-1988` | Reconstruct | R4 fuel limit, P3 solver, P4 map |  |

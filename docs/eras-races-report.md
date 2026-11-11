# Eras races report

**Nov 11, 2026 (branch eras-gauntlet-add):** spain-2013 left Eras for the Gauntlet (owner
request): its overlay `data/eras/spain-2013.json` is removed, and it is now a plain pool race
(robust G1 pass, 1.71 s; see the Nov 11 update in `docs/survivor-spec.md`). Its facts sheets
stay in `docs/eras-checks/`. china-2011 stays an unserved Eras fixture (it fails G1 as a plain
build). The 100 Eras races are unchanged.

**Integration Nov 10, 2026** (branch eras-integrate-nov10, on `eras` fc23ca5 + the PC integration;
`origin/eras` 9a2584b, the Admin Players tab, merged in). Owner-approved Nov 10: the Expert rival
grader fix (`eras-fix-expert-grader`: `rivals/expert.ts rivalPlayout` keeps the player's later real
stops after a queued stop) and the player stint-pace fix (`eras-fix-player-pace`: the live player
car runs its race-wide stint offset, Eras-gated), both via `eras-integrate-fixes`; hungary-1998
swapped out of Era 3 #7 for brazil-1999 (`eras-swap-hungary-1998`, authored as Häkkinen, no
rewrite; scout `eras-scout4-era3` also commits canada-1996 and japan-1999 as unused candidates);
portugal-2021 stays shared with the Gauntlet. 12 races were re-authored so they stay reachable
with the fixes in (`docs/eras-checks/b2-reauthor-nov10.md`): abu-dhabi-2022, japan-2023,
bahrain-2023, hungary-2024, turkey-2021, australia-2017, australia-2018, malaysia-2015,
spain-2016, abu-dhabi-2011, great-britain-2007, bahrain-2006. Every non-pool race was rebuilt
(158: 135 built, 23 reconstructed with --force; the reconstructed snapshots came out identical);
the only changed race files are the 12 re-authored races, hungary-1998 (its eras block removed)
and the three new pairs (brazil-1999, canada-1996, japan-1999). sc_rates.json, the legend parity
fixture and races.gen.ts regenerated. The 39 Daily/Gauntlet race and golden files are
byte-identical to `origin/eras`. Robust G1 on all 100, one race per call: 77 timed races pass,
99.76 s total (every race that stayed is unchanged; brazil-1999 0.36 s replaces hungary-1998
1.42 s); the 23 reconstructed races' anchors unchanged, G1 sanity 13 of 23, 112.79 s.
Reachability, one race per call: 94 of 94 Eras-only races and 6 of 6 shared races reachable at
the era's difficulty and at Legend, stay-out never ★3. **100 pass, 100 authored, 100 reachable,
100 ready.**

### Earlier header (integration PC)

**Integration PC, Nov 10 2026** (branch eras-integrate-pc: local `eras` fc23ca5 merged with
`origin/eras` 7bf23c7, the owner's PC integrations B and C). The merge brings in the B3 tank
planner (`planner.ts withinTank`/`fillCap`, mirrored in `refuel.py fill_cap`), the stopped-car
fuel line, LF/UTF-8 pipeline writers, pit-card fill labels and the A2 radio e2e. Race content
for europe-1997, hungary-2024, malaysia-2013 and spain-2016 keeps local `eras`'s versions
(authored later, validated in this 100-race set); the PC authoring of those races is not shipped
(its facts sheets are kept as appendices in `docs/eras-checks/b1-europe-1997.md` and
`b1-hungary-2024.md`; `b2-reauthor.md` describes the PC re-author of malaysia-2013 and
spain-2016, which is likewise not shipped). spain-2013 (not in the 100) takes the PC's hidden
objective. Every non-pool race was rebuilt (155: 132 built, 23 reconstructed with --force) and
sc_rates.json, the legend parity fixture and races.gen.ts regenerated: **every file came out
byte-identical to the merge commit** (the tank planner changes play and grading, not the
built race models), and the 39 Daily/Gauntlet race and golden files are byte-identical to
`eras`. Robust G1 on all 100, one race per call: every result and mean gap error is unchanged
(77 timed races pass, 100.82 s total; the 23 reconstructed races' anchor reports are
unchanged, G1 sanity 13 of 23, 112.79 s). Reachability, one race per call: 94 of 94 Eras-only
races and 6 of 6 shared races (`reachability:shared`, portugal-2021 now shared with the
Gauntlet) reachable at the era's difficulty and at Legend, stay-out never ★3, on the tank
planner. **Nothing broke: 100 pass, 100 authored, 100 reachable, 100 ready.** The table rows
below are carried over from phase 3 unchanged (every value re-measured equal).

### Earlier header (overnight phase 3)

Eras integration overnight phase 3, Nov 10 2026: the races report after the phase-3 merges on
branch eras-integrate-p3 (on top of phase 2, eras d036ef6). Merged: the five swap branches (owner
pre-approved Nov 9: each failing race swapped for the next-best race by robust-G1 mean gap error;
migrations 0023-0026 and 0028): eras-swap-era8-p3 (2 races), -era7-p3 (2), -era6-p3 (4),
-era5-p3 (2), -era3-p3 (1, with eras-fix-luxembourg-1998), with the B1 authoring of all 11
swapped-in races and the B2 re-authoring of italy-2001 (top-two target). No branch was skipped.
Every non-pool race was rebuilt (155: 132 built, 23 reconstructed with --force, identical to the
committed snapshots); the race files and goldens are byte-identical to phase 2's except the 11
new Eras-only pairs and italy-2001's race file (its re-author). Daily/Gauntlet race and golden
files unchanged (`git diff --stat` against eras empty). sc_rates.json and the legend fixture are
regenerated (the new races join the sources). One row per race of the 100 in data/pools.json's
`eras` block, in the spec's §4 order (Era 10, play order 1, first). Diagnoses are carried over
with this run's moves appended ("int. p3").

**How it was run.** For each race, one race per call: robust G1 (`pipeline validate`'s robust
mode: 1,000 runs on each of two seed sets; pass = both sets pass, borderline = one) with the
rebuilt race model and the real finishing gaps from the race's laps,
and for the reconstructed races (1983-1995) the core anchors from the committed
`data/raw/<id>.reconstruction.json` (`reconstruct.failures`). The committed race files are the rebuilt ones (test_race_files_current passes). Then `pnpm --filter
@laststint/sim reachability <id>` for each authored Eras-only race and `pnpm --filter
@laststint/worker reachability:shared <id>` for each authored shared race, one race per call.

**Switches** (unchanged): `restart.IN_ERAS_BUILDS` and `dirty_air.IN_ERAS_BUILDS` are off, as in
the last report.

- **Data source**: where the laps come from. Jolpica races before 2011 take their stops from F1DB.
  Reconstructed races (1983-1995) have no lap timing: their laps are solved to the anchors.
- **Estimated**: the race file's `provenance.estimated` (fields the build estimated, not read).
- **Check**: G1 for races with real lap timing; for reconstructed races the core anchors
  (`reconstruct.failures`: grid, order, gaps, fastest laps, retirements, laps down, stops,
  safety cars, tyres, lap leaders, running order and lap gaps) are the pass criterion and G1 is
  only a sanity check of the replay.
- **Mean gap error / anchors**: G1's mean over the gap checks (both seed sets), or core anchors
  passed / total.
- **Main failing check**: the check furthest over its limit, values seed set 10000 / 20000,
  limit in brackets.
- **Authored (side)**: the race has an `eras` block with `target`, `mastery` and `hidden` (in the
  race file; for a shared race, marked "(shared)", in its overlay data/eras/<id>.json), and the
  Eras side it is played from.
- **Reachable**: the reachability checker passes at the era's difficulty and at Legend, and
  stay-out never earns ★3 (`-` = not authored, so not checked).
- **Ready**: ready to publish = authored, reachable and passing its check.

## Era 10: Ground-effect era (2022–2025)

| # | Race | Data source | Estimated | Built | Check | Result | Mean gap error / anchors | Main failing check | Authored (side) | Reachable | Ready | Diagnosis |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | bahrain-2023 | FastF1 (F1 live timing) | none | yes | G1 | pass | 1.22 s |  | yes (SAI) | yes | **yes** | swapped in for monaco-2022 (owner, Nov 9; swap-races-e10-e9.md); int. nov10: re-authored for the Expert grader and player-pace fixes (b2-reauthor-nov10.md), reachable |
| 2 | great-britain-2023 | OpenF1 | none | yes | G1 | pass | 1.56 s |  | yes (NOR) | yes | **yes** | swapped in for great-britain-2022 (owner, Nov 9; swap-races-e10-e9-b.md); B1 authored (NOR) |
| 3 | hungary-2022 | FastF1 (F1 live timing) | none | yes | G1 | pass | 1.69 s |  | yes (VER) | yes | **yes** | passes; now played from Verstappen (A1); int. 8: 1.97 -> 1.69 s |
| 4 | japan-2023 | FastF1 (F1 live timing) | none | yes | G1 | pass | 1.97 s |  | yes (RUS) | yes | **yes** | swapped in for singapore-2023 (owner, Nov 9; swap-races-e10-e9-b.md); B1 authored (RUS); int. w3: not reachable at the era's difficulty (the player's race-wide stint offset in live play, eras-model-player-pace; best path misses ★1), reachable before it; int. w4: reachable again (eras-revert-player-pace); int. nov10: re-authored for the Expert grader and player-pace fixes (b2-reauthor-nov10.md), reachable |
| 5 | netherlands-2023 | OpenF1 | driverPace | yes | G1 | pass | 2.49 s |  | yes (VER) | yes | **yes** | HAM's five wet laps, all in the finish shower (M1), and the red-flag restart; 3.79 -> 6.69 s; int. 8: 6.69 -> 2.34 s; int. w1: 2.34 -> 2.47 s; int. w3: 2.47 -> 2.49 s; B1 authored (VER; side won, no rewrite) |
| 6 | emilia-romagna-2024 | OpenF1 | none | yes | G1 | pass | 0.88 s |  | yes (NOR) | yes | **yes** | swapped in for miami-2024 (owner, Nov 9; swap-races-e10-e9-b.md); B1 authored (NOR) |
| 7 | hungary-2024 | FastF1 (F1 live timing) | none | yes | G1 | pass | 2.52 s |  | yes (PIA) | yes | **yes** | now passes (int. 8); McLaren's swap is now scripted (M4 team orders: the duel order passes); LEC's field gap 5.1 s, just over; int. 8: 1.96 -> 1.93 s; int. w1: 1.93 -> 2.52 s; int. w3: Legend no longer reachable (the player's race-wide stint offset in live play, eras-model-player-pace; best Legend path misses the hidden objective); int. w4: reachable again (eras-revert-player-pace); int. nov10: re-authored for the Expert grader and player-pace fixes (b2-reauthor-nov10.md), reachable |
| 8 | belgium-2023 | OpenF1 | none | yes | G1 | pass | 1.99 s |  | yes (VER) | yes | **yes** | now passes: driver damp / wet pace from clear-air laps against the field (M1); int. 8: 1.73 -> 1.98 s; int. w1: 1.98 -> 1.99 s |
| 9 | saudi-arabia-2023 | OpenF1 | none | yes | G1 | pass | 0.86 s |  | yes (VER) | yes | **yes** | swapped in for australia-2025 (owner, Nov 9, third batch; swap-races-e10-e9-c.md; australia-2025 failed G1, 3.43 s); sourced pace_skip for VER laps 21-22 (fix-saudi-arabia-2023.md); B1 authored (VER; hard calls VER 2, PER 0) |
| 10 | abu-dhabi-2022 | Jolpica laps | compounds, safetyCars | yes | G1 | pass | 0.54 s |  | yes (LEC) | yes | **yes** | swapped in for monaco-2025 (owner, Nov 9; swap-races-e10-e9-b.md); B1 authored (LEC); int. w3: stay-out earns ★3 at the era's difficulty and Legend is not reachable (the player's race-wide stint offset in live play, eras-model-player-pace), reachable before it; int. w4: reachable again, stay-out no longer earns ★3 (eras-revert-player-pace); int. nov10: re-authored for the Expert grader and player-pace fixes (b2-reauthor-nov10.md), reachable |

## Era 9: The 2021 title fight

| # | Race | Data source | Estimated | Built | Check | Result | Mean gap error / anchors | Main failing check | Authored (side) | Reachable | Ready | Diagnosis |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | bahrain-2021 (shared) | FastF1 (F1 live timing) | none | yes | G1 | pass | 0.66 s |  | yes (VER) | yes | **yes** | passes; strict status fails only on a near-tie |
| 2 | styria-2021 | FastF1 (F1 live timing) | none | yes | G1 | pass | 0.55 s |  | yes (VER) | yes | **yes** | swapped in for spain-2021 (owner, Nov 9; swap-races-e10-e9.md) |
| 3 | azerbaijan-2021 | Jolpica laps | compounds, safetyCars | yes | G1 | pass | 1.27 s |  | yes (PER) | yes | **yes** | race mechanics: Alonso's red-flag restart and a recorded pit-lane pass; int. 8: 2.90 -> 2.86 s; int. w1: 2.86 -> 1.27 s; B1 authored (PER; side won, no rewrite) |
| 4 | france-2021 (shared) | FastF1 (F1 live timing) | none | yes | G1 | pass | 3.01 s |  | yes (HAM) | yes | **yes** |  |
| 5 | portugal-2021 (shared) | FastF1 (F1 live timing) | none | yes | G1 | pass | 0.77 s |  | yes (HAM) | yes | **yes** | swapped in for hungary-2021 (owner pre-approved, Nov 9, robust-G1 stats pick; swap-races-era9-overnight.md); B1 authored (HAM) |
| 6 | russia-2021 (shared) | FastF1 (F1 live timing) | none | yes | G1 | pass | 2.89 s |  | yes (NOR) | yes | **yes** |  |
| 7 | turkey-2021 | Jolpica laps | compounds, safetyCars, weather | yes | G1 | pass | 0.41 s |  | yes (LEC) | yes | **yes** | passes; now played from Leclerc (A1), takeover pinned at lap 38; int. w3: Legend no longer reachable (the player's race-wide stint offset in live play, eras-model-player-pace; best Legend path misses ★1); int. w4: reachable again (eras-revert-player-pace); int. nov10: re-authored for the Expert grader and player-pace fixes (b2-reauthor-nov10.md), reachable |
| 8 | netherlands-2021 | Jolpica laps | compounds, safetyCars | yes | G1 | pass | 1.76 s |  | yes (VER) | yes | **yes** | swapped in for brazil-2021 (owner, Nov 9; swap-races-e10-e9-b.md); B1 authored (VER; side won, no rewrite) |
| 9 | great-britain-2021 | FastF1 (F1 live timing) | none | yes | G1 | pass | 1.14 s |  | yes (LEC) | yes | **yes** | swapped in for saudi-arabia-2021 (owner, Nov 9; swap-races-e10-e9.md) |
| 10 | abu-dhabi-2021 (shared) | FastF1 (F1 live timing) | none | yes | G1 | pass | 2.27 s |  | yes (HAM) | yes | **yes** |  |

## Era 8: Mercedes vs Ferrari (2017–2020)

| # | Race | Data source | Estimated | Built | Check | Result | Mean gap error / anchors | Main failing check | Authored (side) | Reachable | Ready | Diagnosis |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | australia-2017 | TUM f1-timing-database | none | yes | G1 | pass | 2.11 s |  | yes (VET) | yes | **yes** | swapped in for monaco-2017 (owner pre-approved, Nov 9, robust-G1 stats pick; swap-races-era8-overnight.md); B1 authored (VET); int. nov10: re-authored for the Expert grader and player-pace fixes (b2-reauthor-nov10.md), reachable |
| 2 | australia-2018 | TUM f1-timing-database | none | yes | G1 | pass | 1.06 s |  | yes (VET) | yes | **yes** | swapped in for azerbaijan-2017 (owner pre-approved, Nov 9, robust-G1 stats pick; swap-races-era8-overnight.md); B1 authored (VET); int. nov10: re-authored for the Expert grader and player-pace fixes (b2-reauthor-nov10.md), reachable |
| 3 | germany-2018 | TUM f1-timing-database | weather | yes | G1 | pass | 1.64 s |  | yes (HAM) | yes | **yes** | passes with the restart switch off (fails on with it on: 1.88 s); pace by stint moved GRO to 5.06 [5.00] on M2 alone; int. 8: 1.59 -> 1.64 s |
| 4 | spain-2017 | TUM f1-timing-database | none | yes | G1 | pass | 2.57 s |  | yes (VET) | yes | **yes** | swapped in for russia-2018 (owner pre-approved, Nov 9, robust-G1 stats pick; swap-races-era8-overnight.md); B1 authored (VET) |
| 5 | germany-2019 | TUM f1-timing-database | weather, driverPace | yes | G1 | pass | 1.54 s |  | yes (VER) | yes | **yes** | int. 8: 1.38 -> 1.42 s; int. w1: 1.42 -> 1.54 s |
| 6 | hungary-2019 (shared) | FastF1 (F1 live timing) | none | yes | G1 | pass | 0.96 s |  | yes (HAM) | yes | **yes** |  |
| 7 | brazil-2019 | TUM f1-timing-database | none | yes | G1 | pass | 1.66 s |  | yes (HAM) | yes | **yes** | now played from Hamilton (A1's hard-call side). The duel is the real 0.06 s finish: Gasly's last-stint offset (M2) and the overtake model (M3: Hamilton's late charge passes less) move the mean gap; int. 8: 1.97 -> 2.08 s; int. w1: 2.08 -> 1.66 s |
| 8 | china-2017 | TUM f1-timing-database | none | yes | G1 | pass | 0.78 s |  | yes (HAM) | yes | **yes** | swapped in for italy-2020 (owner pre-approved, Nov 9, robust-G1 stats pick; swap-races-era8-overnight.md); B1 authored (HAM) |
| 9 | turkey-2020 | Jolpica laps | compounds, safetyCars, weather | yes | G1 | pass | 1.75 s |  | yes (HAM) | yes | **yes** | now passes on the combined fixes; the dry labels from lap 18 (gap 11) remain; int. 8: 1.76 -> 1.75 s |
| 10 | china-2018 | TUM f1-timing-database | none | yes | G1 | pass | 2.26 s |  | yes (BOT) | yes | **yes** | swapped in for sakhir-2020 (owner pre-approved, Nov 9, robust-G1 stats pick; swap-races-era8-overnight.md); B1 authored (BOT) |

## Era 7: Hybrid turbo (2014–2016)

| # | Race | Data source | Estimated | Built | Check | Result | Mean gap error / anchors | Main failing check | Authored (side) | Reachable | Ready | Diagnosis |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | united-states-2014 | TUM f1-timing-database | none | yes | G1 | pass | 0.75 s |  | yes (ROS) | yes | **yes** | swapped in for bahrain-2014 (owner pre-approved, Nov 9, robust-G1 stats pick; swap-races-era7-overnight.md); B1 authored (ROS) |
| 2 | brazil-2014 | TUM f1-timing-database | none | yes | G1 | pass | 1.41 s |  | yes (HAM) | yes | **yes** | swapped in for canada-2014 (owner pre-approved, Nov 9, robust-G1 stats pick; swap-races-era7-overnight.md); B1 authored (HAM) |
| 3 | canada-2016 | TUM f1-timing-database | none | yes | G1 | pass | 1.97 s |  | yes (HAM) | yes | **yes** | swapped in for hungary-2014 (owner pre-approved, Nov 9, robust-G1 stats pick; swap-races-era7-overnight.md); B1 authored (HAM) |
| 4 | singapore-2014 | TUM f1-timing-database | none | yes | G1 | pass | 0.76 s |  | yes (VET) | yes | **yes** | swapped in for monaco-2015 (owner pre-approved, Nov 9, robust-G1 stats pick; swap-races-era7-overnight.md); B1 authored (VET) |
| 5 | abu-dhabi-2015 | TUM f1-timing-database | none | yes | G1 | pass | 0.76 s |  | yes (HAM) | yes | **yes** | swapped in for hungary-2015 (owner pre-approved, Nov 9, robust-G1 stats pick; swap-races-era7-overnight.md); B1 authored (HAM) |
| 6 | germany-2016 | TUM f1-timing-database | none | yes | G1 | pass | 1.48 s |  | yes (HAM) | yes | **yes** | swapped in for united-states-2015 (owner pre-approved, Nov 9, robust-G1 stats pick; swap-races-era7-overnight.md); B1 authored (HAM) |
| 7 | spain-2016 | TUM f1-timing-database | none | yes | G1 | pass | 1.15 s |  | yes (RAI) | yes | **yes** | not reachable after the rebuild (int. 8): the best path gets ★2 only, at both levels; int. 8: 1.13 -> 1.15 s; int. p2: reachable after its B2 re-author; int. nov10: re-authored for the Expert grader and player-pace fixes (b2-reauthor-nov10.md), reachable |
| 8 | bahrain-2015 | TUM f1-timing-database | none | yes | G1 | pass | 0.71 s |  | yes (RAI) | yes | **yes** | swapped in for monaco-2016 (owner pre-approved, Nov 9, robust-G1 stats pick; swap-races-era7-overnight.md); B1 authored (RAI) |
| 9 | malaysia-2015 | TUM f1-timing-database | none | yes | G1 | pass | 2.02 s |  | yes (VET) | yes | **yes** | swapped in for great-britain-2016 (owner pre-approved, Nov 9, robust-G1 stats pick; swap-races-era7-overnight.md); B1 authored (VET); int. nov10: re-authored for the Expert grader and player-pace fixes (b2-reauthor-nov10.md), reachable |
| 10 | abu-dhabi-2016 | TUM f1-timing-database | none | yes | G1 | pass | 0.87 s |  | yes (ROS) | yes | **yes** | int. 8: 0.85 -> 0.87 s |

## Era 6: Fast-wearing tyres (2010–2013)

| # | Race | Data source | Estimated | Built | Check | Result | Mean gap error / anchors | Main failing check | Authored (side) | Reachable | Ready | Diagnosis |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | bahrain-2012 | Jolpica laps | compounds, safetyCars | yes | G1 | pass | 1.98 s |  | yes (VET) | yes | **yes** | swapped in for australia-2010 (owner pre-approved, Nov 9, robust-G1 stats pick; swap-races-era6-overnight.md); B1 authored (VET) |
| 2 | abu-dhabi-2010 | Jolpica laps + F1DB stops | compounds, safetyCars | yes | G1 | pass | 1.96 s |  | yes (PET) | yes | **yes** | now passes on the combined fixes (the Petrov train: pooled overtake model, M3) |
| 3 | germany-2013 | Jolpica laps | compounds, safetyCars | yes | G1 | pass | 1.31 s |  | yes (RAI) | yes | **yes** | swapped in for china-2011 (owner pre-approved, Nov 9, robust-G1 stats pick; swap-races-era6-overnight.md); B1 authored (RAI) |
| 4 | italy-2010 | Jolpica laps + F1DB stops | compounds, safetyCars | yes | G1 | pass | 0.79 s |  | yes (ALO) | yes | **yes** | swapped in for monaco-2011 (owner pre-approved, Nov 9, robust-G1 stats pick; swap-races-era6-overnight.md); B1 authored (ALO) |
| 5 | australia-2013 | Jolpica laps | compounds, safetyCars | yes | G1 | pass | 1.74 s |  | yes (RAI) | yes | **yes** | swapped in for canada-2011 (owner pre-approved, Nov 9, robust-G1 stats pick; swap-races-era6-overnight.md); B1 authored (RAI) |
| 6 | europe-2012 | Jolpica laps | compounds, safetyCars | yes | G1 | pass | 1.38 s |  | yes (RAI) | yes | **yes** | now passes (int. 8); the sourced SC (laps 28-33, W4; applied here with the storyline SC moved to lap 28): MSCM's podium gap 5.38 / 5.15 [5.00], just over (race mechanics 76%); 1.94 -> 1.46 s; int. 8: 1.46 -> 1.37 s; int. w1: 1.37 -> 1.38 s |
| 7 | germany-2012 | Jolpica laps | compounds, safetyCars | yes | G1 | pass | 1.24 s |  | yes (BUT) | yes | **yes** | swapped in for abu-dhabi-2012 (owner pre-approved, Nov 9, robust-G1 stats pick; swap-races-era6-overnight.md); B1 authored (BUT) |
| 8 | china-2013 | Jolpica laps | compounds, safetyCars | yes | G1 | pass | 0.95 s |  | yes (ALO) | yes | **yes** | swapped in for brazil-2012 (owner pre-approved, Nov 9, robust-G1 stats pick; swap-races-era6-overnight.md); B1 authored (ALO) |
| 9 | malaysia-2013 | Jolpica laps | compounds, safetyCars, weather | yes | G1 | pass | 0.90 s |  | yes (WEB) | yes | **yes** | not reachable after the rebuild (int. 8): no path earns ★1, at both levels; int. 8: 1.20 -> 0.90 s; int. p2: reachable after its B2 re-author |
| 10 | abu-dhabi-2011 | Jolpica laps | compounds, safetyCars | yes | G1 | pass | 0.87 s |  | yes (HAM) | yes | **yes** | swapped in for spain-2013 (owner pre-approved, Nov 9, robust-G1 stats pick; swap-races-era6-overnight.md); B1 authored (HAM); int. nov10: re-authored for the Expert grader and player-pace fixes (b2-reauthor-nov10.md), reachable |

## Era 5: Alonso, Räikkönen, Hamilton (2005–2009)

| # | Race | Data source | Estimated | Built | Check | Result | Mean gap error / anchors | Main failing check | Authored (side) | Reachable | Ready | Diagnosis |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | san-marino-2005 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | pass | 1.70 s |  | yes (MSCM) | yes | **yes** | now passes: pace by stint (M2: Schumacher's middle stint, Alonso's last) and the pooled overtake model (M3) |
| 2 | europe-2009 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | pass | 1.04 s |  | yes (HAM) | yes | **yes** | swapped in for japan-2005 (owner pre-approved, Nov 9, robust-G1 stats pick; swap-races-era5-overnight.md); B1 authored (HAM) |
| 3 | france-2007 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | pass | 0.49 s |  | yes (RAI) | yes | **yes** | swapped in for hungary-2006 (owner pre-approved, Nov 9, robust-G1 stats pick; swap-races-era5-overnight.md); B1 authored (RAI) |
| 4 | san-marino-2006 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | pass | 0.79 s |  | yes (ALO) | yes | **yes** | swapped in for brazil-2006 (owner pre-approved, Nov 9, robust-G1 stats pick; swap-races-era5-overnight.md); B1 authored (ALO) |
| 5 | great-britain-2007 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | pass | 0.58 s |  | yes (RAI) | yes | **yes** | swapped in for china-2007 (owner pre-approved, Nov 9, robust-G1 stats pick; swap-races-era5-overnight.md); B1 authored (RAI); int. nov10: re-authored for the Expert grader and player-pace fixes (b2-reauthor-nov10.md), reachable |
| 6 | belgium-2009 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | pass | 0.51 s |  | yes (FIS) | yes | **yes** | swapped in for europe-2007 (owner pre-approved, Nov 9, robust-G1 stats pick; swap-races-era5-overnight.md); B1 authored (FIS) |
| 7 | hungary-2007 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | pass | 1.85 s |  | yes (RAI) | yes | **yes** | swapped in for brazil-2007 (owner pre-approved, Nov 9, robust-G1 stats pick; swap-races-era5-overnight.md); B1 authored (RAI) |
| 8 | bahrain-2006 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | pass | 1.34 s |  | yes (MSCM) | yes | **yes** | swapped in for monaco-2008 (owner pre-approved, Nov 9, robust-G1 stats pick; swap-races-era5-overnight.md); B1 authored (MSCM); int. nov10: re-authored for the Expert grader and player-pace fixes (b2-reauthor-nov10.md), reachable |
| 9 | turkey-2008 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | pass | 0.98 s |  | yes (HAM) | yes | **yes** | swapped in for brazil-2008 (owner pre-approved, Nov 9, robust-G1 stats pick; swap-races-era5-overnight.md); B1 authored (HAM) |
| 10 | malaysia-2006 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | pass | 1.10 s |  | yes (ALO) | yes | **yes** | swapped in for brazil-2009 (owner pre-approved, Nov 9, robust-G1 stats pick; swap-races-era5-overnight.md); B1 authored (ALO) |

## Era 4: Ferrari dynasty (2000–2004)

| # | Race | Data source | Estimated | Built | Check | Result | Mean gap error / anchors | Main failing check | Authored (side) | Reachable | Ready | Diagnosis |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | canada-2003 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | pass | 0.88 s |  | yes (SCH) | yes | **yes** | swapped in for germany-2000 (owner pre-approved, Nov 9, robust-G1 stats pick; swap-races-era4-overnight.md); B1 authored (SCH) |
| 2 | japan-2000 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads, weather | yes | G1 | pass | 1.29 s |  | yes (HAK) | yes | **yes** | now passes: driver damp / wet pace (M1); int. 8: 1.27 -> 1.29 s |
| 3 | san-marino-2000 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | pass | 0.75 s |  | yes (MSCM) | yes | **yes** | swapped in for malaysia-2001 (owner pre-approved, Nov 9, robust-G1 stats pick; swap-races-era4-overnight.md); B1 authored (MSCM) |
| 4 | austria-2002 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | pass | 0.63 s |  | yes (BAR) | yes | **yes** | passes; the last-corner swap now plays (M4) |
| 5 | hungary-2001 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | pass | 1.15 s |  | yes (BAR) | yes | **yes** | swapped in for brazil-2003 (owner pre-approved, Nov 9, robust-G1 stats pick; swap-races-era4-overnight.md); B1 authored (BAR) |
| 6 | austria-2001 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | pass | 0.70 s |  | yes (COU) | yes | **yes** | swapped in for hungary-2003 (owner pre-approved, Nov 9, robust-G1 stats pick; swap-races-era4-overnight.md); B1 authored (COU) |
| 7 | france-2001 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | pass | 0.59 s |  | yes (MSCM) | yes | **yes** | swapped in for united-states-2003 (owner pre-approved, Nov 9, robust-G1 stats pick; swap-races-era4-overnight.md); B1 authored (MSCM) |
| 8 | italy-2001 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | pass | 1.62 s |  | yes (MON) | yes | **yes** | swapped in for japan-2003 (owner pre-approved, Nov 9, robust-G1 stats pick; swap-races-era4-overnight.md); B1 authored (MON); int. p2: Legend not reachable on the regenerated sc_rates (Monza's SC rate 0.333 -> 0.273 per race now that italy-2001 and italy-2010 count; reachable at both levels with the author branch's sc_rates); int. p3: reachable after its B2 re-author |
| 9 | france-2004 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | pass | 1.89 s |  | yes (ALO) | yes | **yes** | now passes: pace by stint (M2) |
| 10 | san-marino-2003 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | pass | 1.44 s |  | yes (MSCM) | yes | **yes** | swapped in for monaco-2004 (owner pre-approved, Nov 9, robust-G1 stats pick; swap-races-era4-overnight.md); B1 authored (MSCM) |

## Era 3: Refuelling returns (1994–1999)

| # | Race | Data source | Estimated | Built | Check | Result | Mean gap error / anchors | Main failing check | Authored (side) | Reachable | Ready | Diagnosis |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | spain-1994 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, safetyCars, fuelLoads, weather | yes | anchors | pass | 93/93 core anchors |  | yes (HIL) | yes | **yes** |  |
| 2 | australia-1994 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, safetyCars, fuelLoads, weather | yes | anchors | pass | 104/104 core anchors |  | yes (HIL) | yes | **yes** | anchors pass; Schumacher leads from lap 1 as sourced (W2's lap leaders); the collision retires both only on the real calls (M4 storyline retirement) |
| 3 | belgium-1995 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 134/134 core anchors |  | yes (MSCM) | yes | **yes** | anchors pass; G1 sanity 2.97 -> 5.76 s on W2's anchors: BRU (21.5 s) and FRE on estimated stint tyres |
| 4 | spain-1996 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads, weather | yes | G1 | pass | 0.63 s |  | yes (MSCM) | yes | **yes** | now passes: pace by stint (M2); still wet all race and built dry; int. 8: 0.62 -> 0.63 s |
| 5 | luxembourg-1998 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | pass | 0.88 s |  | yes (HAK) | yes | **yes** | swapped in for hungary-1997 (owner pre-approved, Nov 9, robust-G1 stats pick; swap-races-era3-overnight.md); B1 authored (HAK) |
| 6 | europe-1997 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | pass | 1.20 s |  | yes (VIL) | yes | **yes** | now passes (int. 8: S9 sources McLaren's swap); the let-bys at the flag scripted (M4: VIL's podium gap passes); podium order 0.45 [0.50], 2.53 -> 0.82 s; int. 8: 0.82 -> 1.20 s; B1 authored (VIL) |
| 7 | brazil-1999 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | pass | 0.36 s |  | yes (HAK) | yes | **yes** | swapped in for hungary-1998 (owner, Nov 10: hungary-1998 not winnable at Legend with the Expert grader and player-pace fixes; scout4-era3.md, b1-brazil-1999.md); B1 authored (HAK; side won, no rewrite) |
| 8 | germany-1996 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | pass | 1.27 s |  | yes (HIL) | yes | **yes** | swapped in for belgium-1998 (owner pre-approved, Nov 9, robust-G1 stats pick; swap-races-era3-overnight.md); B1 authored (HIL) |
| 9 | germany-1997 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | pass | 1.41 s |  | yes (BER) | yes | **yes** | swapped in for malaysia-1999 (owner pre-approved, Nov 9, robust-G1 stats pick; swap-races-era3-overnight.md); B1 authored (BER) |
| 10 | san-marino-1999 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | pass | 0.91 s |  | yes (MSCM) | yes | **yes** | swapped in for europe-1999 (owner pre-approved, Nov 9, robust-G1 stats pick; swap-races-era3-overnight.md); B1 authored (MSCM) |

## Era 2: Senna vs Prost (1989–1993)

| # | Race | Data source | Estimated | Built | Check | Result | Mean gap error / anchors | Main failing check | Authored (side) | Reachable | Ready | Diagnosis |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | france-1990 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 68/68 core anchors |  | yes (CAP) | yes | **yes** | now passes (S7: de Cesaris run at his sourced road place); anchor fail (order): de Cesaris' disqualification puts him in the road order (solver); G1 sanity 0.52 -> 3.86 s on W2's anchors: duel CAP vs PRO 8.1 s (race mechanics 98%); int. 8: anchors 67/68 core anchors -> 68/68 core anchors; 6.2 (Eras 1-2): authored from Capelli (hard calls CAP 0, PRO 0, tie to Capelli) |
| 2 | united-states-1990 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 60/60 core anchors |  | yes (ALE) | yes | **yes** |  |
| 3 | mexico-1990 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 73/73 core anchors |  | yes (PRO) | yes | **yes** | anchors pass; G1 sanity now passes on W2's anchors (2.00 -> 1.84 s) |
| 4 | brazil-1991 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 61/61 core anchors |  | yes (SENA) | yes | **yes** | anchors pass; G1 sanity 2.37 -> 3.64 s on W2's anchors: ALE and PRO about 7 s (pace 69%) |
| 5 | monaco-1992 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 58/58 core anchors |  | yes (SENA) | yes | **yes** | now passes (S7: a lap-1 retirement stands outside the grid ladder); anchor fail (grid): Moreno's and Wendlinger's lap 1 pinned by their fastest laps (solver); int. 8: anchors 57/58 core anchors -> 58/58 core anchors; 6.2 (Eras 1-2): side flipped to Senna (hard calls 0-0, tie to Senna), rebuilt; Mansell's lap-71 stop is a storyline call; G1 sanity not re-run after the flip |
| 6 | belgium-1992 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 110/110 core anchors |  | yes (MSCM) | yes | **yes** | anchors pass; rival Mansell again (W1: his slick stop is a storyline call); Mansell leads at the takeover as sourced. G1 sanity 5.18 -> 10.86 s on W2's anchors (10.80 s with Patrese as the rival): duel MSCM vs MAN 14.4 s, PAT 13.8 s |
| 7 | hungary-1992 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 57/57 core anchors |  | yes (BER) | yes | **yes** | anchors pass; G1 sanity 2.55 -> 4.10 s on W2's anchors: duel MAN vs BER 6.5 s, Mansell's fresh-tyre pace (pace 90%) |
| 8 | brazil-1993 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 123/123 core anchors |  | yes (SENA) | yes | **yes** | built (S7): the field's slick change sourced (weather.slickChange), Senna P3 at the takeover; anchors pass; int. 8: anchors not built -> 123/123 core anchors; 6.2 (Eras 1-2): authored from Senna (hard calls SENA 4, HIL 1) |
| 9 | europe-1993 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, safetyCars, fuelLoads, weather | yes | anchors | pass | 106/106 core anchors |  | yes (SENA) | yes | **yes** | anchors pass; Senna now leads at the takeover (W2's lap leaders; was P12); rival Hill again (W1). G1 sanity 1.16 -> 52.20 s: HIL 78 s off his real gap (38.20 s with Prost as the rival, so mostly the anchors): his four unsourced later stops are absorbed into his pace |
| 10 | australia-1993 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, safetyCars, fuelLoads, weather | yes | anchors | pass | 60/60 core anchors |  | yes (SENA) | yes | **yes** |  |

## Era 1: Turbo era (1983–1988)

| # | Race | Data source | Estimated | Built | Check | Result | Mean gap error / anchors | Main failing check | Authored (side) | Reachable | Ready | Diagnosis |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | south-africa-1983 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 58/58 core anchors |  | yes (PIQN) | yes | **yes** | now passes (S7: a lap-1 retirement stands outside the grid ladder); anchor fail (grid): a lap-1 retirement pinned by its fastest lap (solver); G1 sanity now passes on W2's anchors (3.93 -> 2.95 s); int. 8: anchors 57/58 core anchors -> 58/58 core anchors; 6.2 (Eras 1-2): kept on Piquet against the 0-0 tie (which goes to Prost by 0.3 pts): Prost's lap-35 turbo failure has no sourced call to make avoidable, so every Prost path retires; owner to confirm |
| 2 | monaco-1984 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 41/41 core anchors |  | yes (PRO) | yes | **yes** | anchors pass; fuel limit bites in the rain as if dry; G1 sanity 5.54 -> 2.40 s on W2's anchors (BEL 6.3 s) |
| 3 | portugal-1984 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 58/58 core anchors |  | yes (LAU) | yes | **yes** | anchors pass; G1 sanity: race mechanics (pace 32%) |
| 4 | germany-1986 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 68/68 core anchors |  | yes (ROSK) | yes | **yes** | anchors pass; Rosberg runs to the last lap 2.0 s behind Piquet (M4 lastLapStops) and his out-of-fuel stop is left to the fuel model |
| 5 | portugal-1985 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 58/58 core anchors |  | yes (SENA) | yes | **yes** | anchors pass; Senna 30 s clear by lap 20 as sourced (W2); fuel limit bites in the rain as if dry |
| 6 | mexico-1986 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 54/54 core anchors |  | yes (BER) | yes | **yes** |  |
| 7 | hungary-1986 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 71/71 core anchors |  | yes (PIQN) | yes | **yes** |  |
| 8 | australia-1986 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 64/64 core anchors |  | yes (MAN) | yes | **yes** | anchors pass; Mansell's tyre failure comes only on the real no-stop (M4 storyline retirement) |
| 9 | great-britain-1987 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 58/58 core anchors |  | yes (PIQN) | yes | **yes** | anchors pass; now played from Piquet (A4) |
| 10 | monaco-1988 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 61/61 core anchors |  | yes (SENA) | yes | **yes** | anchors pass; Senna's crash comes only on the real push from lap 55 (M4); G1 sanity 6.92 -> 3.03 s on W2's anchors (ALBM 5.0 s) |

## Summary

**Result: 100 pass, 0 borderline, 0 fail, 0 not built** (of 100; 23 reconstructed races checked on
their anchors, 77 on G1). **Authored 100, reachable 100 of 100, ready to publish 100.** Last report
(integration PC): the same counts (100 / 100 / 100 / 100), with hungary-1998 where brazil-1999 now is.

| Era | Pass | Borderline | Fail | Not built | Authored | Reachable | Ready to publish |
|---|---|---|---|---|---|---|---|
| 10 | 10 | 0 | 0 | 0 | 10 | 10 | 10 |
| 9 | 10 | 0 | 0 | 0 | 10 | 10 | 10 |
| 8 | 10 | 0 | 0 | 0 | 10 | 10 | 10 |
| 7 | 10 | 0 | 0 | 0 | 10 | 10 | 10 |
| 6 | 10 | 0 | 0 | 0 | 10 | 10 | 10 |
| 5 | 10 | 0 | 0 | 0 | 10 | 10 | 10 |
| 4 | 10 | 0 | 0 | 0 | 10 | 10 | 10 |
| 3 | 10 | 0 | 0 | 0 | 10 | 10 | 10 |
| 2 | 10 | 0 | 0 | 0 | 10 | 10 | 10 |
| 1 | 10 | 0 | 0 | 0 | 10 | 10 | 10 |
| **All** | **100** | **0** | **0** | **0** | **100** | **100** | **100** |

Timed races (77): total mean gap error 99.76 s (last report 100.82 s; brazil-1999 0.36 s
replaces hungary-1998 1.42 s). No race that stayed in the lineup changed its G1 result or mean gap error. G1
sanity of the 23 reconstructed races: 13 pass, 112.79 s total (last report 13 of 23,
112.79 s); all 23 pass every core anchor (snapshots and anchor reports unchanged).

### Ready to publish (100)

- **Era 10** (10): bahrain-2023 (SAI), great-britain-2023 (NOR), hungary-2022 (VER), japan-2023 (RUS), netherlands-2023 (VER), emilia-romagna-2024 (NOR), hungary-2024 (PIA), belgium-2023 (VER), saudi-arabia-2023 (VER), abu-dhabi-2022 (LEC)
- **Era 9** (10): bahrain-2021 (VER), styria-2021 (VER), azerbaijan-2021 (PER), france-2021 (HAM), portugal-2021 (HAM), russia-2021 (NOR), turkey-2021 (LEC), netherlands-2021 (VER), great-britain-2021 (LEC), abu-dhabi-2021 (HAM)
- **Era 8** (10): australia-2017 (VET), australia-2018 (VET), germany-2018 (HAM), spain-2017 (VET), germany-2019 (VER), hungary-2019 (HAM), brazil-2019 (HAM), china-2017 (HAM), turkey-2020 (HAM), china-2018 (BOT)
- **Era 7** (10): united-states-2014 (ROS), brazil-2014 (HAM), canada-2016 (HAM), singapore-2014 (VET), abu-dhabi-2015 (HAM), germany-2016 (HAM), spain-2016 (RAI), bahrain-2015 (RAI), malaysia-2015 (VET), abu-dhabi-2016 (ROS)
- **Era 6** (10): bahrain-2012 (VET), abu-dhabi-2010 (PET), germany-2013 (RAI), italy-2010 (ALO), australia-2013 (RAI), europe-2012 (RAI), germany-2012 (BUT), china-2013 (ALO), malaysia-2013 (WEB), abu-dhabi-2011 (HAM)
- **Era 5** (10): san-marino-2005 (MSCM), europe-2009 (HAM), france-2007 (RAI), san-marino-2006 (ALO), great-britain-2007 (RAI), belgium-2009 (FIS), hungary-2007 (RAI), bahrain-2006 (MSCM), turkey-2008 (HAM), malaysia-2006 (ALO)
- **Era 4** (10): canada-2003 (SCH), japan-2000 (HAK), san-marino-2000 (MSCM), austria-2002 (BAR), hungary-2001 (BAR), austria-2001 (COU), france-2001 (MSCM), italy-2001 (MON), france-2004 (ALO), san-marino-2003 (MSCM)
- **Era 3** (10): spain-1994 (HIL), australia-1994 (HIL), belgium-1995 (MSCM), spain-1996 (MSCM), luxembourg-1998 (HAK), europe-1997 (VIL), brazil-1999 (HAK), germany-1996 (HIL), germany-1997 (BER), san-marino-1999 (MSCM)
- **Era 2** (10): france-1990 (CAP), united-states-1990 (ALE), mexico-1990 (PRO), brazil-1991 (SENA), monaco-1992 (SENA), belgium-1992 (MSCM), hungary-1992 (BER), brazil-1993 (SENA), europe-1993 (SENA), australia-1993 (SENA)
- **Era 1** (10): south-africa-1983 (PIQN), monaco-1984 (PRO), portugal-1984 (LAU), germany-1986 (ROSK), portugal-1985 (SENA), mexico-1986 (BER), hungary-1986 (PIQN), australia-1986 (MAN), great-britain-1987 (PIQN), monaco-1988 (SENA)

Not ready: none. Every era has 10 of 10 races ready to publish, pending the owner's sign-off of
the facts sheets (C2) and publishing (C3).

## Since the last report

**Integration Nov 10** (against integration PC): Expert rival grader fix and player stint-pace
fix in; 12 races re-authored to stay reachable (rows marked "int. nov10"); hungary-1998 (Era 3
#7, pass 1.42 s, Legend unreachable with the fixes) swapped for brazil-1999 (pass 0.36 s,
authored HAK, reachable, ready). No race lost a pass or reachability; counts unchanged at 100
ready.

**Integration PC** (against phase 3, fc23ca5): no change to any race's build, G1 result, mean gap
error, reachability or readiness. Every refuelling race (Eras 3-5, 1994-2009) stays reachable at both levels on
the B3 tank planner.

**Phase 3** (against the last report then):

Against the last report (overnight phase 2, d036ef6). Ready = authored + reachable + pass. No
race lost a pass: the 11 races swapped out (italy-2020, sakhir-2020; bahrain-2014,
united-states-2015; spain-2013, brazil-2012, abu-dhabi-2012, china-2011; europe-2007,
brazil-2007; hungary-1997) all failed G1 except china-2011 (borderline), and no race that stayed
changed its G1 result or mean gap error. Every race that stayed and was reachable is still
reachable on the regenerated sc_rates.

| Race | Era | Before | After | Why |
|---|---|---|---|---|
| italy-2001 | 4 | pass, authored, **not reachable** (Legend) | reachable, **ready** | B2 re-author (top-two target) against the phase-2 sc_rates |
| china-2017 | 8 | - (swapped in for italy-2020, fail) | pass (0.78 s), authored (HAM), reachable, **ready** | swap (owner pre-approved, Nov 9) + B1 authoring |
| china-2018 | 8 | - (swapped in for sakhir-2020, fail) | pass (2.26 s), authored (BOT), reachable, **ready** | swap (owner pre-approved, Nov 9) + B1 authoring |
| united-states-2014 | 7 | - (swapped in for bahrain-2014, fail) | pass (0.75 s), authored (ROS), reachable, **ready** | swap (owner pre-approved, Nov 9) + B1 authoring |
| germany-2016 | 7 | - (swapped in for united-states-2015, fail) | pass (1.48 s), authored (HAM), reachable, **ready** | swap (owner pre-approved, Nov 9) + B1 authoring |
| germany-2013 | 6 | - (swapped in for china-2011, borderline) | pass (1.31 s), authored (RAI), reachable, **ready** | swap (owner pre-approved, Nov 9) + B1 authoring |
| germany-2012 | 6 | - (swapped in for abu-dhabi-2012, fail) | pass (1.24 s), authored (BUT), reachable, **ready** | swap (owner pre-approved, Nov 9) + B1 authoring |
| china-2013 | 6 | - (swapped in for brazil-2012, fail) | pass (0.95 s), authored (ALO), reachable, **ready** | swap (owner pre-approved, Nov 9) + B1 authoring |
| abu-dhabi-2011 | 6 | - (swapped in for spain-2013, fail) | pass (0.87 s), authored (HAM), reachable, **ready** | swap (owner pre-approved, Nov 9) + B1 authoring |
| belgium-2009 | 5 | - (swapped in for europe-2007, fail) | pass (0.51 s), authored (FIS), reachable, **ready** | swap (owner pre-approved, Nov 9) + B1 authoring |
| hungary-2007 | 5 | - (swapped in for brazil-2007, fail) | pass (1.85 s), authored (RAI), reachable, **ready** | swap (owner pre-approved, Nov 9) + B1 authoring |
| luxembourg-1998 | 3 | - (swapped in for hungary-1997, fail) | pass (0.88 s), authored (HAK), reachable, **ready** | swap (owner pre-approved, Nov 9) + B1 authoring |

**Merge notes.** The refuelling pooled slope (`refuel.POOLED_SLOPE`, for the record only, not
used in the fit) is recomputed on the merged data/raw/f1db: 0.0945 s a lap, tau 0.1251 (the Era 5
third batch and luxembourg-1998 each added races). The history-book totals are recomputed from
the data: 51 of the 100 races have no rewrite condition, so the web mock's total is 779 and the
worker's 780. Yas Marina's SC rate is now 0.4615 per race (abu-dhabi-2011 joins), so the
Legend verify/eval tests' Abu Dhabi 2021 draw changed (sim test: seed 4363; worker test: the
VSC drawn on lap 35 at the shared seed).

**Every era is complete** (10 of 10 ready, pending owner sign-off of the facts sheets).

## Model gaps, ranked

Not re-ranked for phase 3. Since phase 2, the 11 races listed under "Since the last report" left
the lineup (swaps); read their names out of the lists below. No race in the lineup fails.

Not re-ranked for phase 2. Since wave 4, the 30 races listed under "Since the last report" left
the lineup (swaps); read their names out of the lists below.

Not re-ranked for wave 3. Since wave 1, great-britain-2022, singapore-2023, miami-2024,
monaco-2025 and brazil-2021 left the lineup (swaps); read their names out of the lists below.

Carried over from the last report, not re-ranked for wave 1. Since then azerbaijan-2021,
netherlands-2023 and brazil-2019 pass, and monaco-2022, spain-2021 and saudi-arabia-2021 left the
lineup (swaps); read their names out of the lists below.

Not re-ranked in integration 8: the lists below are the last report's. Since then gap 7
(reconstruction anchor conflicts) is resolved (S7: 0 failing), gap 8 (dropped cars) is fixed in
Eras builds (S6; china-2007 built, still failing on wet pace), gap 13's brazil-1993 is built,
and gap 12 reopens: spain-2016, malaysia-2013 and spain-2013 are no longer reachable.

By the number of failing races each one explains (a race can have more than one), then by the
races it blocks from being played as authored (those pass their check but can't be won, fail
reachability, or aren't built). Unchanged from integration 7
except gap 12 (the Eras content blocked in play), resolved by the 6.2 re-author: every authored
race is now reachable.

1. **Weak overtaking: cars stuck in trains, a faster car can't pass, Monaco queues (after M3's pooled overtake model; W3's dirty-air bands built but off).** 15 failing: singapore-2023, monaco-2025, spain-2021, brazil-2021, monaco-2017, italy-2020, bahrain-2014, monaco-2015, hungary-2015, australia-2010, abu-dhabi-2012, brazil-2006, brazil-2007, brazil-2008, spain-2013.
2. **Driver damp / wet pace (after M1): few clear-air laps (Monaco), tyre labels that mix slicks and rain tyres, rain with no weather data, and one wetness per lap (the slick / inter curves 2% apart where europe-1999's second shower had them 8%).** 12 failing: monaco-2022, netherlands-2023, australia-2025, monaco-2016, canada-2011, brazil-2012, hungary-2006, europe-2007, monaco-2008, malaysia-2001, united-states-2003, europe-1999.
3. **Stint-to-stint pace (after M2's per-stint offsets for scripted cars): a stint run in traffic gets no offset, a last-lap pass or mistake isn't in the offsets, an offset that moves the cars around a near-tie.** 10 failing: hungary-2021, japan-2005, brazil-2009, brazil-2003, hungary-2003, japan-2003, monaco-2004, hungary-1997, europe-1997, brazil-2019.
4. **SC / red-flag restart mechanics (late-SC sprints, restart order and spacing, the fitted SC queue's stop costs; M4's restart model is built but off).** 12 failing: great-britain-2022, miami-2024, azerbaijan-2021, saudi-arabia-2021, azerbaijan-2017, italy-2020, sakhir-2020, bahrain-2014, monaco-2015, belgium-1998 (the sim's restart nose-to-tail, then ALE passes the Jordans), germany-2000 (its two sourced SCs; duel and DLR at their limits), europe-2012 (MSCM's podium gap behind the sourced SC, race mechanics 76%).
5. **Team orders and let-bys: scripted since M4 (TEAM_ORDER facts), but the sim's cars around the swap don't end where the real ones did.** 4 failing: hungary-2024, russia-2018, europe-1997, malaysia-1999.
6. **One-off losses and car problems: unsourced (not in data/incidents.json), or a sourced fault's fitted constant loss that doesn't settle a near-tie.** 3 failing: canada-2014, united-states-2015, great-britain-2016.
7. **Reconstruction solver anchor conflicts (lap-1 grid vs fastest-lap-pinned retirements; disqualified cars in the road order).** 3 failing: france-1990, monaco-1992, south-africa-1983.
8. **Dropped cars with no dry laps (a car that ran only wet laps has no pace fit).** 2 failing: hungary-2006, malaysia-2001; 1 not built: china-2007.
9. **No unlapping decided from the sim's own gaps (a car the sim has a lap down stays there).** 1 failing: monaco-2011 (HAM 69 s, WEB 26 s).
10. **Estimated dry compounds (step 2.4's SOFT/HARD split).** 1 failing: brazil-2008.
11. **Tyre wear on long stints (flat HARD wear, last-stint wear).** 1 failing: hungary-2014.
12. **Eras content under the merged grader and anchors.** Resolved (6.2 re-author): all 44 authored races pass reachability at both levels. 3 authored races are held back by G1 alone: europe-2012 (gap 4), spain-2013 (gap 1), brazil-2019 (gap 3).
13. **Unreconstructed stops (unsourced tyre changes or later stops absorbed into pace).** 1 not built: brazil-1993; europe-1993's G1 sanity (Hill's four unsourced later stops: HIL 78 s).
14. **Fuel limit bites in the rain as if dry (the takeover margin is drawn for a dry burn).** 2 flagged (both reachable and ready): monaco-1984, portugal-1985.

## Reachability (eras spec §15)

`pnpm --filter @laststint/sim reachability <id>` for each of the 94 authored Eras-only races and
`pnpm --filter @laststint/worker reachability:shared <id>` for each of the 6 authored shared races
(the race file merged with its overlay, the model the Eras API serves), one race per call, on the
rebuilt race files. Last report = overnight phase 2; "new" = authored since.

| Race | Era difficulty | Legend | Stay-out ★3 | Result | Last report |
|---|---|---|---|---|---|
| abu-dhabi-2010 | reachable | reachable | not earned | pass | pass |
| abu-dhabi-2011 | reachable | reachable | not earned | pass | new |
| abu-dhabi-2015 | reachable | reachable | not earned | pass | pass |
| abu-dhabi-2016 | reachable | reachable | not earned | pass | pass |
| abu-dhabi-2021 (shared) | reachable | reachable | not earned | pass | pass |
| abu-dhabi-2022 | reachable | reachable | not earned | pass | pass |
| australia-1986 | reachable | reachable | not earned | pass | pass |
| australia-1993 | reachable | reachable | not earned | pass | pass |
| australia-1994 | reachable | reachable | not earned | pass | pass |
| australia-2013 | reachable | reachable | not earned | pass | pass |
| australia-2017 | reachable | reachable | not earned | pass | pass |
| australia-2018 | reachable | reachable | not earned | pass | pass |
| austria-2001 | reachable | reachable | not earned | pass | pass |
| austria-2002 | reachable | reachable | not earned | pass | pass |
| azerbaijan-2021 | reachable | reachable | not earned | pass | pass |
| bahrain-2006 | reachable | reachable | not earned | pass | pass |
| bahrain-2012 | reachable | reachable | not earned | pass | pass |
| bahrain-2015 | reachable | reachable | not earned | pass | pass |
| bahrain-2021 (shared) | reachable | reachable | not earned | pass | pass |
| bahrain-2023 | reachable | reachable | not earned | pass | pass |
| belgium-1992 | reachable | reachable | not earned | pass | pass |
| belgium-1995 | reachable | reachable | not earned | pass | pass |
| belgium-2009 | reachable | reachable | not earned | pass | new |
| belgium-2023 | reachable | reachable | not earned | pass | pass |
| brazil-1991 | reachable | reachable | not earned | pass | pass |
| brazil-1993 | reachable | reachable | not earned | pass | pass |
| brazil-2014 | reachable | reachable | not earned | pass | pass |
| brazil-2019 | reachable | reachable | not earned | pass | pass |
| canada-2003 | reachable | reachable | not earned | pass | pass |
| canada-2016 | reachable | reachable | not earned | pass | pass |
| china-2013 | reachable | reachable | not earned | pass | new |
| china-2017 | reachable | reachable | not earned | pass | new |
| china-2018 | reachable | reachable | not earned | pass | new |
| emilia-romagna-2024 | reachable | reachable | not earned | pass | pass |
| europe-1993 | reachable | reachable | not earned | pass | pass |
| europe-1997 | reachable | reachable | not earned | pass | pass |
| europe-2009 | reachable | reachable | not earned | pass | pass |
| europe-2012 | reachable | reachable | not earned | pass | pass |
| france-1990 | reachable | reachable | not earned | pass | pass |
| france-2001 | reachable | reachable | not earned | pass | pass |
| france-2004 | reachable | reachable | not earned | pass | pass |
| france-2007 | reachable | reachable | not earned | pass | pass |
| france-2021 (shared) | reachable | reachable | not earned | pass | pass |
| germany-1986 | reachable | reachable | not earned | pass | pass |
| germany-1996 | reachable | reachable | not earned | pass | pass |
| germany-1997 | reachable | reachable | not earned | pass | pass |
| germany-2012 | reachable | reachable | not earned | pass | new |
| germany-2013 | reachable | reachable | not earned | pass | new |
| germany-2016 | reachable | reachable | not earned | pass | new |
| germany-2018 | reachable | reachable | not earned | pass | pass |
| germany-2019 | reachable | reachable | not earned | pass | pass |
| great-britain-1987 | reachable | reachable | not earned | pass | pass |
| great-britain-2007 | reachable | reachable | not earned | pass | pass |
| great-britain-2021 | reachable | reachable | not earned | pass | pass |
| great-britain-2023 | reachable | reachable | not earned | pass | pass |
| hungary-1986 | reachable | reachable | not earned | pass | pass |
| hungary-1992 | reachable | reachable | not earned | pass | pass |
| brazil-1999 | reachable | reachable | not earned | pass | new (swapped in for hungary-1998, Nov 10) |
| hungary-2001 | reachable | reachable | not earned | pass | pass |
| hungary-2007 | reachable | reachable | not earned | pass | new |
| hungary-2019 (shared) | reachable | reachable | not earned | pass | pass |
| hungary-2022 | reachable | reachable | not earned | pass | pass |
| hungary-2024 | reachable | reachable | not earned | pass | pass |
| italy-2001 | reachable | reachable | not earned | pass | fail |
| italy-2010 | reachable | reachable | not earned | pass | pass |
| japan-2000 | reachable | reachable | not earned | pass | pass |
| japan-2023 | reachable | reachable | not earned | pass | pass |
| luxembourg-1998 | reachable | reachable | not earned | pass | new |
| malaysia-2006 | reachable | reachable | not earned | pass | pass |
| malaysia-2013 | reachable | reachable | not earned | pass | pass |
| malaysia-2015 | reachable | reachable | not earned | pass | pass |
| mexico-1986 | reachable | reachable | not earned | pass | pass |
| mexico-1990 | reachable | reachable | not earned | pass | pass |
| monaco-1984 | reachable | reachable | not earned | pass | pass |
| monaco-1988 | reachable | reachable | not earned | pass | pass |
| monaco-1992 | reachable | reachable | not earned | pass | pass |
| netherlands-2021 | reachable | reachable | not earned | pass | pass |
| netherlands-2023 | reachable | reachable | not earned | pass | pass |
| portugal-1984 | reachable | reachable | not earned | pass | pass |
| portugal-1985 | reachable | reachable | not earned | pass | pass |
| portugal-2021 (shared) | reachable | reachable | not earned | pass | pass |
| russia-2021 (shared) | reachable | reachable | not earned | pass | pass |
| san-marino-1999 | reachable | reachable | not earned | pass | pass |
| san-marino-2000 | reachable | reachable | not earned | pass | pass |
| san-marino-2003 | reachable | reachable | not earned | pass | pass |
| san-marino-2005 | reachable | reachable | not earned | pass | pass |
| san-marino-2006 | reachable | reachable | not earned | pass | pass |
| saudi-arabia-2023 | reachable | reachable | not earned | pass | pass |
| singapore-2014 | reachable | reachable | not earned | pass | pass |
| south-africa-1983 | reachable | reachable | not earned | pass | pass |
| spain-1994 | reachable | reachable | not earned | pass | pass |
| spain-1996 | reachable | reachable | not earned | pass | pass |
| spain-2016 | reachable | reachable | not earned | pass | pass |
| spain-2017 | reachable | reachable | not earned | pass | pass |
| styria-2021 | reachable | reachable | not earned | pass | pass |
| turkey-2008 | reachable | reachable | not earned | pass | pass |
| turkey-2020 | reachable | reachable | not earned | pass | pass |
| turkey-2021 | reachable | reachable | not earned | pass | pass |
| united-states-1990 | reachable | reachable | not earned | pass | pass |
| united-states-2014 | reachable | reachable | not earned | pass | new |

**100 pass, 0 fail of 100** (94 Eras-only, 6 shared; shared 6 of 6).
Last report: 89 pass, 2 fail of 91. Passing again: italy-2001 (B2 re-author). Gone: spain-2013
(swapped out). New: the 11 swapped-in races, all pass.

## Not built

None: china-2007 (model fix 1.6) and brazil-1993 (S7) are built.

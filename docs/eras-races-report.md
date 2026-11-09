# Eras races report

Eras build job 1.1, Nov 8 2026: a fresh accuracy report on the current code (main at a911ab9,
after the 6.2 re-author merges: the 19 reconstructed races and the 25 races from 1996 on). One
row per race of the 100 in data/pools.json's `eras` block, in the spec's §4 order (Era 10, play
order 1, first). Nothing was rebuilt and no code or data changed: every check ran on the
**committed** race file.

**How it was run.** For each race, one race per call: robust G1 (`pipeline validate`'s robust
mode: 1,000 runs on each of two seed sets; pass = both sets pass, borderline = one) with the
committed `data/races/<id>.json` as the model and the real finishing gaps from the race's laps,
and for the reconstructed races (1983-1995) the core anchors from the committed
`data/raw/<id>.reconstruction.json` (`reconstruct.failures`). As a drift check each race was
also built in memory: the build equals the committed file for 96 of the 98 built races; the
other two are the shared bahrain-2021 (two pit-loss deviations, -1.898 / -1.618 committed,
-1.899 / -1.619 built) and russia-2021 (one deviation and one stop loss, 0.001 s apart), last
digit float rounding in the Daily files, which are kept as they are. Then `pnpm --filter
@laststint/sim reachability <id>` for each authored Eras-only race and `pnpm --filter
@laststint/worker reachability:shared <id>` for each authored shared race, one race per call.

**Switches** (unchanged): `restart.IN_ERAS_BUILDS` and `dirty_air.IN_ERAS_BUILDS` are off, as in
integration 7.

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
| 1 | monaco-2022 | Jolpica laps | compounds, safetyCars, weather | yes | G1 | **fail** | 7.49 s | duel LEC vs PER gap error 9.46 / 8.8 [3.00] (+6 more) | no | - | no | Monaco's few clear-air laps for the wet-pace fit (M1) and the drying track; 4.93 -> 7.49 s |
| 2 | great-britain-2022 | Jolpica laps | compounds, safetyCars | yes | G1 | **fail** | 2.03 s | duel LEC vs SAI gap error 5.09 / 5 [3.00] (+2 more) | no | - | no | the 10-lap sprint after the late SC (LEC vs SAI 5.1 s); 2.96 -> 2.03 s |
| 3 | hungary-2022 | FastF1 (F1 live timing) | none | yes | G1 | pass | 1.97 s |  | yes (VER) | yes | **yes** | passes; now played from Verstappen (A1) |
| 4 | singapore-2023 | FastF1 (F1 live timing) | none | yes | G1 | **fail** | 4.01 s | field GAS gap error 10.8 / 11.11 [5.00] (+2 more) | no | - | no | race mechanics (pace 4%): the NOR vs SAI gap, GAS 9.9 s |
| 5 | netherlands-2023 | OpenF1 | none | yes | G1 | **fail** | 6.69 s | podium order rate 0.01 / 0.01 [0.50] (+4 more) | no | - | no | HAM's five wet laps, all in the finish shower (M1), and the red-flag restart; 3.79 -> 6.69 s |
| 6 | miami-2024 | FastF1 (F1 live timing) | none | yes | G1 | **fail** | 4.71 s | duel VER vs NOR gap error 5.6 / 5.38 [3.00] (+5 more) | no | - | no | race mechanics (pace 3%): the SC that timed Norris' stop (spec §4); rebuilt with the Eras fixes (2.88 s before) |
| 7 | hungary-2024 | FastF1 (F1 live timing) | none | yes | G1 | **fail** | 1.96 s | field LEC gap error 5.12 / 5.15 [5.00] | no | - | no | McLaren's swap is now scripted (M4 team orders: the duel order passes); LEC's field gap 5.1 s, just over |
| 8 | belgium-2023 | OpenF1 | none | yes | G1 | pass | 1.73 s |  | yes (VER) | yes | **yes** | now passes: driver damp / wet pace from clear-air laps against the field (M1) |
| 9 | australia-2025 | OpenF1 | none | yes | G1 | **fail** | 3.66 s | duel VER vs NOR gap error 7.31 / 7.26 [3.00] (+2 more) | no | - | no | wet-dry race: duel VER vs NOR 7.3 s; 4.62 -> 3.66 s with M1 |
| 10 | monaco-2025 | OpenF1 | none | yes | G1 | **fail** | 3.27 s | field HAM gap error 8.45 / 8.13 [5.14] (+1 more) | no | - | no | Hamilton in the Monaco queue of the mandatory two-stop (8.5 s); 2.63 -> 3.27 s |

## Era 9: The 2021 title fight

| # | Race | Data source | Estimated | Built | Check | Result | Mean gap error / anchors | Main failing check | Authored (side) | Reachable | Ready | Diagnosis |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | bahrain-2021 (shared) | FastF1 (F1 live timing) | none | yes | G1 | pass | 0.66 s |  | yes (VER) | yes | **yes** | passes; strict status fails only on a near-tie |
| 2 | spain-2021 | FastF1 (F1 live timing) | none | yes | G1 | **fail** | 6.15 s | duel VER vs HAM gap error 7.48 / 7.55 [3.00] (+4 more) | no | - | no | race mechanics (pace 1%): VER 7 s, BOT, PER, RIC |
| 3 | azerbaijan-2021 | Jolpica laps | compounds, safetyCars | yes | G1 | **fail** | 2.90 s | field ALO gap error 6.95 / 6.97 [5.00] | no | - | no | race mechanics: Alonso's red-flag restart and a recorded pit-lane pass |
| 4 | france-2021 (shared) | FastF1 (F1 live timing) | none | yes | G1 | pass | 3.01 s |  | yes (HAM) | yes | **yes** |  |
| 5 | hungary-2021 | FastF1 (F1 live timing) | weather | yes | G1 | **fail** | 5.15 s | podium HAM gap error 9.87 / 9.74 [5.00] (+3 more) | no | - | no | Hamilton's charge on hards after the wet start (HAM 9.9 s); 5.74 -> 5.15 s |
| 6 | russia-2021 (shared) | FastF1 (F1 live timing) | none | yes | G1 | pass | 2.89 s |  | yes (NOR) | yes | **yes** |  |
| 7 | turkey-2021 | Jolpica laps | compounds, safetyCars, weather | yes | G1 | pass | 0.41 s |  | yes (LEC) | yes | **yes** | passes; now played from Leclerc (A1), takeover pinned at lap 38 |
| 8 | brazil-2021 | FastF1 (F1 live timing) | none | yes | G1 | **fail** | 1.85 s | duel VER vs HAM gap error 3.33 / 3.39 [3.00] | no | - | no | race mechanics: Hamilton's pass on Verstappen (duel gap 3.12, just over) |
| 9 | saudi-arabia-2021 | Jolpica laps | compounds, safetyCars | yes | G1 | **fail** | 8.57 s | podium BOT gap error 19.09 / 19.22 [5.00] (+4 more) | no | - | no | two red flags and their restarts (BOT 19 s); 13.96 -> 8.57 s on the combined fixes |
| 10 | abu-dhabi-2021 (shared) | FastF1 (F1 live timing) | none | yes | G1 | pass | 2.27 s |  | yes (HAM) | yes | **yes** |  |

## Era 8: Mercedes vs Ferrari (2017–2020)

| # | Race | Data source | Estimated | Built | Check | Result | Mean gap error / anchors | Main failing check | Authored (side) | Reachable | Ready | Diagnosis |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | monaco-2017 | TUM f1-timing-database | none | yes | G1 | **fail** | 2.98 s | field BOT gap error 6.34 / 6.45 [5.00] | no | - | no | race mechanics (pace 5%): Bottas in Monaco traffic |
| 2 | azerbaijan-2017 | TUM f1-timing-database | none | yes | G1 | **fail** | 5.85 s | podium order rate 0.08 / 0.07 [0.50] (+6 more) | no | - | no | red flag and SC restarts (podium order 0.08); 6.86 -> 5.85 s |
| 3 | germany-2018 | TUM f1-timing-database | weather | yes | G1 | pass | 1.59 s |  | yes (HAM) | yes | **yes** | passes with the restart switch off (fails on with it on: 1.88 s); pace by stint moved GRO to 5.06 [5.00] on M2 alone |
| 4 | russia-2018 | TUM f1-timing-database | none | yes | G1 | **fail** | 2.34 s | duel BOT vs HAM gap error 4.18 / 4.24 [3.00] | no | - | no | Mercedes' swap is now scripted (M4: duel and podium order pass); the duel gap 4.2 s, the sim's BOT drops further back |
| 5 | germany-2019 | TUM f1-timing-database | weather | yes | G1 | pass | 1.38 s |  | yes (VER) | yes | **yes** |  |
| 6 | hungary-2019 (shared) | FastF1 (F1 live timing) | none | yes | G1 | pass | 0.96 s |  | yes (HAM) | yes | **yes** |  |
| 7 | brazil-2019 | TUM f1-timing-database | none | yes | G1 | **fail** | 1.97 s | duel HAM vs GAS gap error 4.46 / 4.53 [3.00] | yes (HAM) | yes | no | now played from Hamilton (A1's hard-call side). The duel is the real 0.06 s finish: Gasly's last-stint offset (M2) and the overtake model (M3: Hamilton's late charge passes less) move the mean gap |
| 8 | italy-2020 | Jolpica laps | compounds, safetyCars | yes | G1 | **fail** | 2.23 s | duel GAS vs SAI gap error 4.96 / 5.11 [3.00] (+1 more) | no | - | no | the red-flag restart and Gasly holding Sainz off; 3.69 -> 2.23 s |
| 9 | turkey-2020 | Jolpica laps | compounds, safetyCars, weather | yes | G1 | pass | 1.76 s |  | yes (HAM) | yes | **yes** | now passes on the combined fixes; the dry labels from lap 18 (gap 11) remain |
| 10 | sakhir-2020 | Jolpica laps | compounds, safetyCars | yes | G1 | **fail** | 2.51 s | duel RUS vs PER gap error 8.85 / 8.8 [3.00] | no | - | no | duel RUS vs PER 8.9 s: the fitted SC queue's stop costs (sim fixes 2) and the overtake model (M3); 1.30 -> 2.51 s |

## Era 7: Hybrid turbo (2014–2016)

| # | Race | Data source | Estimated | Built | Check | Result | Mean gap error / anchors | Main failing check | Authored (side) | Reachable | Ready | Diagnosis |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | bahrain-2014 | TUM f1-timing-database | none | yes | G1 | **fail** | 1.17 s | duel HAM vs ROS order rate 0.48 / 0.49 [0.60] (+1 more) | no | - | no | the late-SC fight between HAM and ROS (duel order 0.48 [0.60]); 2.16 -> 1.17 s |
| 2 | canada-2014 | TUM f1-timing-database | none | yes | G1 | **fail** | 2.99 s | duel ROS vs RIC order rate 0.22 / 0.2 [0.60] (+3 more) | no | - | no | the field's pace now fits (6.53 -> 2.99 s: faults carry the stint offsets, M2); duel order ROS vs RIC 0.22, Ricciardo's late passes |
| 3 | hungary-2014 | TUM f1-timing-database | weather | yes | G1 | **fail** | 2.73 s | field RAI gap error 5.66 / 6.39 [5.00] (+1 more) | no | - | no | tyre wear on long last stints (RAI 5.7 s); 4.15 -> 2.73 s |
| 4 | monaco-2015 | TUM f1-timing-database | none | yes | G1 | **fail** | 4.71 s | podium order rate 0.26 / 0.26 [0.50] (+5 more) | no | - | no | race mechanics (pace 4%): the SC and Monaco traffic (KVY, RIC, RAI) |
| 5 | hungary-2015 | TUM f1-timing-database | none | yes | G1 | **fail** | 6.90 s | field ALO gap error 19.8 / 19.63 [5.00] (+4 more) | no | - | no | race mechanics: ALO 20 s, VET vs KVY; 5.76 -> 6.90 s (M3 measured 6.59 alone) |
| 6 | united-states-2015 | TUM f1-timing-database | weather | yes | G1 | **fail** | 2.31 s | duel HAM vs ROS order rate 0.4 / 0.39 [0.60] (+2 more) | no | - | no | Rosberg's one-lap loss on lap 48, which decides the duel, isn't modelled (duel order 0.40); 3.30 -> 2.31 s |
| 7 | spain-2016 | TUM f1-timing-database | none | yes | G1 | pass | 1.13 s |  | yes (RAI) | yes | **yes** |  |
| 8 | monaco-2016 | TUM f1-timing-database | none | yes | G1 | **fail** | 10.79 s | podium order rate 0.02 / 0.02 [0.50] (+6 more) | no | - | no | a wet race with no rain data; the full-wets shift (M1) and the SC (race mechanics 77%); 8.15 -> 10.79 s |
| 9 | great-britain-2016 | TUM f1-timing-database | weather | yes | G1 | **fail** | 2.37 s | podium order rate 0.41 / 0.4 [0.50] | no | - | no | Rosberg's gearbox fault (laps 46-47) is now a sourced FAULT (W4): the duel order passes, the podium order is still 0.41 [0.50] and the gap errors grow a little; 2.11 -> 2.37 s |
| 10 | abu-dhabi-2016 | TUM f1-timing-database | none | yes | G1 | pass | 0.85 s |  | yes (ROS) | yes | **yes** |  |

## Era 6: Fast-wearing tyres (2010–2013)

| # | Race | Data source | Estimated | Built | Check | Result | Mean gap error / anchors | Main failing check | Authored (side) | Reachable | Ready | Diagnosis |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | australia-2010 | Jolpica laps + F1DB stops | compounds, safetyCars, weather | yes | G1 | **fail** | 4.11 s | field ROS gap error 9.65 / 9.38 [5.00] (+2 more) | no | - | no | the two-stoppers stuck in the one-stop train (ROS 9.6 s); 3.35 -> 4.10 s |
| 2 | abu-dhabi-2010 | Jolpica laps + F1DB stops | compounds, safetyCars | yes | G1 | pass | 1.96 s |  | yes (PET) | yes | **yes** | now passes on the combined fixes (the Petrov train: pooled overtake model, M3) |
| 3 | china-2011 | Jolpica laps | compounds, safetyCars | yes | G1 | pass | 1.44 s |  | yes (VET) | yes | **yes** | now passes on the combined fixes (pooled overtake model, M3; pace by stint, M2) |
| 4 | monaco-2011 | Jolpica laps | compounds, safetyCars | yes | G1 | **fail** | 15.16 s | field HAM gap error 69.07 / 70.99 [5.00] (+2 more) | no | - | no | W4's SC fix (the first SC one period, laps 34-38; the late SC, 69-71, an SC, not a yellow) puts VET, ALO and BUT within 1 s of their real gaps; what fails is HAM (69 s) and WEB (26 s) a lap down at the red-flag restart (no unlapping); 43.37 -> 15.16 s |
| 5 | canada-2011 | Jolpica laps | compounds, safetyCars, weather | yes | G1 | **fail** | 3.02 s | podium order rate 0.26 / 0.23 [0.50] (+3 more) | no | - | no | lap pace (58%) on the drying track (PET, MAS); the back-to-back stop fix took it from 10.27 to 3.51 s |
| 6 | europe-2012 | Jolpica laps | compounds, safetyCars | yes | G1 | **fail** | 1.46 s | podium MSCM gap error 5.38 / 5.15 [5.00] | yes (RAI) | yes | no | the sourced SC (laps 28-33, W4; applied here with the storyline SC moved to lap 28): MSCM's podium gap 5.38 / 5.15 [5.00], just over (race mechanics 76%); 1.94 -> 1.46 s |
| 7 | abu-dhabi-2012 | Jolpica laps | compounds, safetyCars | yes | G1 | **fail** | 1.72 s | duel VET vs BUT gap error 3.4 / 3.22 [3.00] (+1 more) | no | - | no | the VET vs BUT gap, just over (3.4 / 3.2 [3.00]); 2.89 -> 1.72 s |
| 8 | brazil-2012 | Jolpica laps | compounds, safetyCars, weather | yes | G1 | **fail** | 3.44 s | duel VET vs ALO gap error 5.65 / 5.65 [3.00] (+2 more) | no | - | no | Vettel's last wet stint (pace 49%) |
| 9 | malaysia-2013 | Jolpica laps | compounds, safetyCars, weather | yes | G1 | pass | 1.20 s |  | yes (WEB) | yes | **yes** |  |
| 10 | spain-2013 | Jolpica laps | compounds, safetyCars | yes | G1 | **fail** | 1.51 s | duel RAI vs ALO gap error 3.08 / 3.16 [3.00] | yes (RAI) | yes | no | just over: duel RAI vs ALO 3.08 / 3.16 [3.00] (race mechanics 89%); now played from Räikkönen (6.2) |

## Era 5: Alonso, Räikkönen, Hamilton (2005–2009)

| # | Race | Data source | Estimated | Built | Check | Result | Mean gap error / anchors | Main failing check | Authored (side) | Reachable | Ready | Diagnosis |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | san-marino-2005 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | pass | 1.70 s |  | yes (MSCM) | yes | **yes** | now passes: pace by stint (M2: Schumacher's middle stint, Alonso's last) and the pooled overtake model (M3) |
| 2 | japan-2005 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | **fail** | 4.48 s | duel RAI vs FIS order rate 0.15 / 0.16 [0.60] (+5 more) | no | - | no | Räikkönen's last stint: the duel order RAI vs FIS 0.15 [0.60]; 6.18 -> 4.48 s |
| 3 | hungary-2006 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads, weather | yes | G1 | **fail** | 15.15 s | duel BUT vs DLR gap error 21.85 / 21 [3.00] (+3 more) | no | - | no | de la Rosa's dry-labelled wet stint (BUT vs DLR 21 s); RAI and LIU dropped; 22.00 -> 15.15 s with M1 |
| 4 | brazil-2006 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | **fail** | 6.99 s | duel ALO vs MSCM gap error 17.38 / 17.06 [3.00] (+1 more) | no | - | no | Schumacher's charge: ALO vs MSCM 17 s; 8.23 -> 6.99 s |
| 5 | china-2007 | Jolpica laps + F1DB stops | none | no: user's car (HAM) isn't in the model: he ran only wet laps, so `build.dry_fit` has no dry pace for him and `assemble` drops him | G1 | **not built** |  |  | no | - | no |  |
| 6 | europe-2007 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads, weather | yes | G1 | **fail** | 2.23 s | duel ALO vs MAS gap error 6.12 / 6 [3.00] (+2 more) | no | - | no | pace in the late rain: ALO vs MAS 6.1 s; 4.93 -> 2.23 s with M1 |
| 7 | brazil-2007 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | **fail** | 2.00 s | field ROS gap error 7.02 / 6.9 [6.28] | no | - | no | race mechanics: the second-stop swap and Rosberg's train |
| 8 | monaco-2008 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads, weather | yes | G1 | **fail** | 4.53 s | podium order rate 0.18 / 0.19 [0.50] (+5 more) | no | - | no | the long stints on old inters (podium order 0.18); 3.28 -> 4.53 s |
| 9 | brazil-2008 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads, weather | yes | G1 | **fail** | 5.42 s | field GLO gap error 12.91 / 12.95 [5.00] (+3 more) | no | - | no | 2.4's estimated SOFT/HARD split and Trulli's train (GLO 13 s); 7.26 -> 5.42 s |
| 10 | brazil-2009 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | **fail** | 3.79 s | field VET gap error 7.08 / 7.06 [5.00] (+2 more) | no | - | no | Vettel's field gap (7.1 s; the duel passes since M2); 4.50 -> 3.79 s |

## Era 4: Ferrari dynasty (2000–2004)

| # | Race | Data source | Estimated | Built | Check | Result | Mean gap error / anchors | Main failing check | Authored (side) | Reachable | Ready | Diagnosis |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | germany-2000 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads, weather | yes | G1 | **fail** | 2.85 s | duel BAR vs HAK gap error 3.07 / 2.97 [3.00] (+1 more) | no | - | no | W4 sourced both SCs (laps 25-28 and 30-31) and rejected the rain periods: 32.31 -> 2.85 s. Now just over at the limits: duel BAR vs HAK 3.07 / 2.97 [3.00], DLR 5.06 / 5.01 [5.00] (race mechanics 54%) |
| 2 | japan-2000 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads, weather | yes | G1 | pass | 1.27 s |  | yes (HAK) | yes | **yes** | now passes: driver damp / wet pace (M1) |
| 3 | malaysia-2001 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads, weather | yes | G1 | **fail** | 9.92 s | duel MSCM vs BAR gap error 17.36 / 17.19 [3.00] (+5 more) | no | - | no | Ferrari's inters against the field's full wets (the laps can't split them); FIS dropped; the SC now from lap 4 as sourced (W4): 8.35 -> 9.92 s |
| 4 | austria-2002 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | pass | 0.63 s |  | yes (BAR) | yes | **yes** | passes; the last-corner swap now plays (M4) |
| 5 | brazil-2003 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads, weather | yes | G1 | **fail** | 5.74 s | duel FIS vs RAI gap error 7.98 / 7.57 [3.00] (+4 more) | no | - | no | Fisichella's last-lap pass isn't modelled; Räikkönen's last-stint offset (M2) takes him further clear; 3.79 -> 5.74 s |
| 6 | hungary-2003 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | **fail** | 7.08 s | field SCH gap error 20.8 / 20.98 [5.00] (+3 more) | no | - | no | Williams' pace by stint, now fitted (M2): SCH 21 s; 10.24 -> 7.08 s |
| 7 | united-states-2003 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads, weather | yes | G1 | **fail** | 6.20 s | duel MSCM vs RAI gap error 7.53 / 7.62 [3.00] (+3 more) | no | - | no | Bridgestone wet pace: W4 rejected the lap 21 and 23 'SC' (rain), so those laps are in the pace fit now; MSCM vs RAI 7.5 s, HEI 13.5 s; 4.77 -> 6.20 s |
| 8 | japan-2003 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | **fail** | 4.05 s | duel MSCM vs RAI gap error 11.68 / 11.77 [3.00] (+1 more) | no | - | no | Schumacher's and Barrichello's stints (MSCM vs RAI 11.7 s); 3.53 -> 4.05 s |
| 9 | france-2004 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | pass | 1.89 s |  | yes (ALO) | yes | **yes** | now passes: pace by stint (M2) |
| 10 | monaco-2004 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | **fail** | 3.64 s | podium BAR gap error 7.64 / 7.18 [5.00] (+1 more) | no | - | no | Barrichello's podium gap (7.6 s); Button's last stint now fitted (M2): 5.63 -> 3.64 s |

## Era 3: Refuelling returns (1994–1999)

| # | Race | Data source | Estimated | Built | Check | Result | Mean gap error / anchors | Main failing check | Authored (side) | Reachable | Ready | Diagnosis |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | spain-1994 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, safetyCars, fuelLoads, weather | yes | anchors | pass | 93/93 core anchors | G1 sanity pass, 1.05 s | yes (HIL) | yes | **yes** |  |
| 2 | australia-1994 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, safetyCars, fuelLoads, weather | yes | anchors | pass | 104/104 core anchors | G1 sanity pass, 0.18 s | yes (HIL) | yes | **yes** | anchors pass; Schumacher leads from lap 1 as sourced (W2's lap leaders); the collision retires both only on the real calls (M4 storyline retirement) |
| 3 | belgium-1995 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 134/134 core anchors | G1 sanity fail, 5.76 s | yes (MSCM) | yes | **yes** | anchors pass; G1 sanity 2.97 -> 5.76 s on W2's anchors: BRU (21.5 s) and FRE on estimated stint tyres |
| 4 | spain-1996 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads, weather | yes | G1 | pass | 0.62 s |  | yes (MSCM) | yes | **yes** | now passes: pace by stint (M2); still wet all race and built dry |
| 5 | hungary-1997 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | **fail** | 2.53 s | field MSCM gap error 10.18 / 10.48 [5.00] (+1 more) | no | - | no | stint pace behind the leaders: MSCM 10 s; 4.15 -> 2.53 s with M2 |
| 6 | europe-1997 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | **fail** | 0.82 s | podium order rate 0.45 / 0.46 [0.50] | no | - | no | the let-bys at the flag scripted (M4: VIL's podium gap passes); podium order 0.45 [0.50], 2.53 -> 0.82 s |
| 7 | hungary-1998 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | pass | 1.58 s |  | yes (COU) | yes | **yes** | now passes on the combined fixes (Schumacher's push fitted, M2; overtaking, M3; no SC, so not the restart switch) |
| 8 | belgium-1998 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads, weather | yes | G1 | **fail** | 5.25 s | field DIN gap error 14.03 / 13.97 [5.17] (+3 more) | no | - | no | W4: SC laps 29-32 and Jordan's hold order (TEAM_ORDER, laps 33-44); the duel passes. The sim's restart is nose-to-tail (really HIL 2.4 s, ALE 4.7 s back) and its ALE then passes the Jordans: DIN 14.0 s, ALE 11.8 s; 14.21 -> 5.25 s |
| 9 | malaysia-1999 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | **fail** | 2.96 s | duel IRV vs HAK gap error 3.62 / 3.87 [3.00] (+1 more) | no | - | no | Ferrari's team orders scripted (M4); the duel IRV vs HAK gap 3.6 / 3.9 [3.00], Irvine's last laps |
| 10 | europe-1999 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads, weather | yes | G1 | **fail** | 25.63 s | field SCH gap error 49.33 / 49 [5.00] (+5 more) | no | - | no | W4's sourced tyre classes and the rejected lap 36-43 'SC' (rain): the wet runners finish too far back, the slick runners too far forward (SCH 49 s). At the fitted wetness the slick and inter curves sit about 2% apart, the real second shower about 8%: needs a per-car wetness or new wet curves; 23.24 -> 25.63 s |

## Era 2: Senna vs Prost (1989–1993)

| # | Race | Data source | Estimated | Built | Check | Result | Mean gap error / anchors | Main failing check | Authored (side) | Reachable | Ready | Diagnosis |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | france-1990 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | **fail** | 67/68 core anchors | order anchor; G1 sanity fail, 3.86 s | no | - | no | anchor fail (order): de Cesaris' disqualification puts him in the road order (solver); G1 sanity 0.52 -> 3.86 s on W2's anchors: duel CAP vs PRO 8.1 s (race mechanics 98%) |
| 2 | united-states-1990 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 60/60 core anchors | G1 sanity pass, 2.18 s | yes (ALE) | yes | **yes** |  |
| 3 | mexico-1990 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 73/73 core anchors | G1 sanity pass, 1.84 s | yes (PRO) | yes | **yes** | anchors pass; G1 sanity now passes on W2's anchors (2.00 -> 1.84 s) |
| 4 | brazil-1991 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 61/61 core anchors | G1 sanity fail, 3.64 s | yes (SENA) | yes | **yes** | anchors pass; G1 sanity 2.37 -> 3.64 s on W2's anchors: ALE and PRO about 7 s (pace 69%) |
| 5 | monaco-1992 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | **fail** | 57/58 core anchors | grid anchor; G1 sanity pass, 1.60 s | no | - | no | anchor fail (grid): Moreno's and Wendlinger's lap 1 pinned by their fastest laps (solver) |
| 6 | belgium-1992 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 110/110 core anchors | G1 sanity fail, 10.86 s | yes (MSCM) | yes | **yes** | anchors pass; rival Mansell again (W1: his slick stop is a storyline call); Mansell leads at the takeover as sourced. G1 sanity 5.18 -> 10.86 s on W2's anchors (10.80 s with Patrese as the rival): duel MSCM vs MAN 14.4 s, PAT 13.8 s |
| 7 | hungary-1992 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 57/57 core anchors | G1 sanity fail, 4.10 s | yes (BER) | yes | **yes** | anchors pass; G1 sanity 2.55 -> 4.10 s on W2's anchors: duel MAN vs BER 6.5 s, Mansell's fresh-tyre pace (pace 90%) |
| 8 | brazil-1993 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather (sidecar) | no: `data_issue`: the synthetic race isn't the real one (no source for the field's slick stops on laps 40-43; Senna P14 at the takeover, can't win with his real calls). Raw reconstruction only; anchors 108/108 (G1 sanity 46.25 s, integration 6; not re-run) | anchors | **not built** |  |  | no | - | no |  |
| 9 | europe-1993 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, safetyCars, fuelLoads, weather | yes | anchors | pass | 106/106 core anchors | G1 sanity fail, 52.20 s | yes (SENA) | yes | **yes** | anchors pass; Senna now leads at the takeover (W2's lap leaders; was P12); rival Hill again (W1). G1 sanity 1.16 -> 52.20 s: HIL 78 s off his real gap (38.20 s with Prost as the rival, so mostly the anchors): his four unsourced later stops are absorbed into his pace |
| 10 | australia-1993 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, safetyCars, fuelLoads, weather | yes | anchors | pass | 60/60 core anchors | G1 sanity pass, 0.72 s | yes (SENA) | yes | **yes** |  |

## Era 1: Turbo era (1983–1988)

| # | Race | Data source | Estimated | Built | Check | Result | Mean gap error / anchors | Main failing check | Authored (side) | Reachable | Ready | Diagnosis |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | south-africa-1983 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | **fail** | 57/58 core anchors | grid anchor; G1 sanity pass, 2.95 s | no | - | no | anchor fail (grid): a lap-1 retirement pinned by its fastest lap (solver); G1 sanity now passes on W2's anchors (3.93 -> 2.95 s) |
| 2 | monaco-1984 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 41/41 core anchors | G1 sanity fail, 2.40 s | yes (PRO) | yes | **yes** | anchors pass; fuel limit bites in the rain as if dry; G1 sanity 5.54 -> 2.40 s on W2's anchors (BEL 6.3 s) |
| 3 | portugal-1984 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 58/58 core anchors | G1 sanity fail, 3.00 s | yes (LAU) | yes | **yes** | anchors pass; G1 sanity: race mechanics (pace 32%) |
| 4 | germany-1986 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 68/68 core anchors | G1 sanity pass, 1.77 s | yes (ROSK) | yes | **yes** | anchors pass; Rosberg runs to the last lap 2.0 s behind Piquet (M4 lastLapStops) and his out-of-fuel stop is left to the fuel model |
| 5 | portugal-1985 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 58/58 core anchors | G1 sanity pass, 0.37 s | yes (SENA) | yes | **yes** | anchors pass; Senna 30 s clear by lap 20 as sourced (W2); fuel limit bites in the rain as if dry |
| 6 | mexico-1986 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 54/54 core anchors | G1 sanity pass, 2.03 s | yes (BER) | yes | **yes** |  |
| 7 | hungary-1986 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 71/71 core anchors | G1 sanity pass, 0.26 s | yes (PIQN) | yes | **yes** |  |
| 8 | australia-1986 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 64/64 core anchors | G1 sanity pass, 0.21 s | yes (MAN) | yes | **yes** | anchors pass; Mansell's tyre failure comes only on the real no-stop (M4 storyline retirement) |
| 9 | great-britain-1987 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 58/58 core anchors | G1 sanity pass, 0.69 s | yes (PIQN) | yes | **yes** | anchors pass; now played from Piquet (A4) |
| 10 | monaco-1988 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 61/61 core anchors | G1 sanity fail, 3.03 s | yes (SENA) | yes | **yes** | anchors pass; Senna's crash comes only on the real push from lap 55 (M4); G1 sanity 6.92 -> 3.03 s on W2's anchors (ALBM 5.0 s) |
## Summary

**Result: 41 pass, 0 borderline, 57 fail, 2 not built** (of 100; 22 reconstructed races checked on their
anchors, 76 on G1). **Authored 44, reachable 44 of 44, ready to publish 41.** Last report
(integration 7): 41 pass, 0 borderline, 57 fail, 2 not built; 35 authored, 22 reachable, 21 ready.
No race changed its check status, and every mean gap error and anchor count is the same to the
second decimal: the 6.2 re-author changed sides, moments and `eras` blocks, and G1 replays the
real strategies, so none of it moved a G1 number.

| Era | Pass | Borderline | Fail | Not built | Authored | Reachable | Ready to publish |
|---|---|---|---|---|---|---|---|
| 10 | 2 | 0 | 8 | 0 | 2 | 2 | 2 |
| 9 | 5 | 0 | 5 | 0 | 5 | 5 | 5 |
| 8 | 4 | 0 | 6 | 0 | 5 | 5 | 4 |
| 7 | 2 | 0 | 8 | 0 | 2 | 2 | 2 |
| 6 | 3 | 0 | 7 | 0 | 5 | 5 | 3 |
| 5 | 1 | 0 | 8 | 1 | 1 | 1 | 1 |
| 4 | 3 | 0 | 7 | 0 | 3 | 3 | 3 |
| 3 | 5 | 0 | 5 | 0 | 5 | 5 | 5 |
| 2 | 7 | 0 | 2 | 1 | 7 | 7 | 7 |
| 1 | 9 | 0 | 1 | 0 | 9 | 9 | 9 |
| **All** | **41** | **0** | **57** | **2** | **44** | **44** | **41** |

Timed races (76): total mean gap error 294.85 s (integration 7: 294.85 s). G1 sanity of the 22
built reconstructed races: 13 pass, 104.68 s total (integration 7: the same).

### Ready to publish (41)

- **Era 10** (2): hungary-2022 (VER), belgium-2023 (VER)
- **Era 9** (5): bahrain-2021 (VER), france-2021 (HAM), russia-2021 (NOR), turkey-2021 (LEC), abu-dhabi-2021 (HAM)
- **Era 8** (4): germany-2018 (HAM), germany-2019 (VER), hungary-2019 (HAM), turkey-2020 (HAM)
- **Era 7** (2): spain-2016 (RAI), abu-dhabi-2016 (ROS)
- **Era 6** (3): abu-dhabi-2010 (PET), china-2011 (VET), malaysia-2013 (WEB)
- **Era 5** (1): san-marino-2005 (MSCM)
- **Era 4** (3): japan-2000 (HAK), austria-2002 (BAR), france-2004 (ALO)
- **Era 3** (5): spain-1994 (HIL), australia-1994 (HIL), belgium-1995 (MSCM), spain-1996 (MSCM), hungary-1998 (COU)
- **Era 2** (7): united-states-1990 (ALE), mexico-1990 (PRO), brazil-1991 (SENA), belgium-1992 (MSCM), hungary-1992 (BER), europe-1993 (SENA), australia-1993 (SENA)
- **Era 1** (9): monaco-1984 (PRO), portugal-1984 (LAU), germany-1986 (ROSK), portugal-1985 (SENA), mexico-1986 (BER), hungary-1986 (PIQN), australia-1986 (MAN), great-britain-1987 (PIQN), monaco-1988 (SENA)

Authored but not ready (3): all three are reachable but fail robust G1 just over a limit:
**europe-2012** (Era 6, RAI; MSCM's podium gap 5.38 / 5.15 [5.00]), **spain-2013** (Era 6, RAI;
duel RAI vs ALO 3.08 / 3.16 [3.00]) and **brazil-2019** (Era 8, HAM; duel HAM vs GAS 4.46 / 4.53
[3.00]). No passing race is unauthored: every one of the 41 passes is authored and reachable.

## Since the last report

Against the integration 7 report (a8a4fd6). **No race changed its check status (pass / fail /
not built), and no mean gap error or anchor count moved by 0.01 s or more.** What changed is
authoring and reachability, from the two 6.2 re-author merges (8b2aef9, a911ab9; notes in
docs/eras-checks/6.2-reauthor-reconstructed.md and docs/eras-checks/6.2-reauthor-modern.md).
Ready = authored + reachable + pass.

| Race | Era | Before | After | Why |
|---|---|---|---|---|
| belgium-2023 | 10 | pass, not authored | pass, authored, reachable, **ready** | 6.2: newly authored (VER) |
| turkey-2020 | 8 | pass, not authored | pass, authored, reachable, **ready** | 6.2: newly authored (HAM) |
| abu-dhabi-2010 | 6 | pass, not authored | pass, authored, reachable, **ready** | 6.2: newly authored (PET) |
| china-2011 | 6 | pass, not authored | pass, authored, reachable, **ready** | 6.2: newly authored (VET) |
| san-marino-2005 | 5 | pass, not authored | pass, authored, reachable, **ready** | 6.2: newly authored (MSCM) |
| japan-2000 | 4 | pass, not authored | pass, authored, reachable, **ready** | 6.2: newly authored (HAK) |
| france-2004 | 4 | pass, not authored | pass, authored, reachable, **ready** | 6.2: newly authored (ALO) |
| spain-1996 | 3 | pass, not authored | pass, authored, reachable, **ready** | 6.2: newly authored (MSCM) |
| hungary-1998 | 3 | pass, not authored | pass, authored, reachable, **ready** | 6.2: newly authored (COU) |
| australia-1993 | 2 | pass, authored, not reachable | pass, authored, reachable, **ready** | 6.2: mastery exactly one stop, hidden win by more than 10 s (stay-out earned ★3 on seed 3) |
| australia-1994 | 3 | pass, authored, not reachable | pass, authored, reachable, **ready** | 6.2: side flipped to Hill (hard-call recount), moments and storyline retirement re-authored |
| belgium-1995 | 3 | pass, authored, not reachable | pass, authored, reachable, **ready** | 6.2: side flipped to Schumacher, Hill's stops as storyline calls, mastery / hidden re-set |
| brazil-2019 | 8 | fail, authored, not reachable | fail, authored, reachable, not ready | 6.2: mastery fixed (★3 was unreachable); G1 still fails, duel HAM vs GAS 4.46 / 4.53 [3.00] |
| europe-1993 | 2 | pass, authored, not reachable | pass, authored, reachable, **ready** | 6.2: mastery four stops or fewer, as Senna did (was three) |
| europe-2012 | 6 | fail, authored, not reachable | fail, authored, reachable, not ready | 6.2: re-authored on the sourced SC (laps 28-33); G1 still fails, MSCM 5.38 / 5.15 [5.00] |
| great-britain-1987 | 1 | pass, authored, not reachable | pass, authored, reachable, **ready** | 6.2: moments re-authored from Mansell's lap-35 stop (no path won before) |
| hungary-1986 | 1 | pass, authored, not reachable | pass, authored, reachable, **ready** | 6.2: hidden win by more than 14 s (was Piquet's real 17.7 s, unmet) |
| hungary-1992 | 2 | pass, authored, not reachable | pass, authored, reachable, **ready** | 6.2: side flipped to Berger (gave-up rule), moments re-authored |
| hungary-2019 | 8 | pass, authored, not reachable | pass, authored, reachable, **ready** | 6.2: side switched to Hamilton (overlay), stop_count max 1 replaced |
| mexico-1990 | 2 | pass, authored, not reachable | pass, authored, reachable, **ready** | 6.2: its first decision moments |
| portugal-1984 | 1 | pass, authored, not reachable | pass, authored, reachable, **ready** | 6.2: mastery one tyre stop, hidden no laps at PUSH (lifting now grades with fuel in playouts) |
| portugal-1985 | 1 | pass, authored, not reachable | pass, authored, reachable, **ready** | 6.2: mastery win by more than 70 s (stay-out won by 61.6-63.4 s and earned ★3) |

Sides switched with no change to G1 (the replay doesn't depend on the side): malaysia-2013
(WEB), spain-2013 (RAI: its main failing check now reads RAI vs ALO), abu-dhabi-2010 (PET),
china-2011 (VET), san-marino-2005 (MSCM), japan-2000 (HAK), france-2004 (ALO), hungary-1998 (COU),
france-2021, abu-dhabi-2021 and hungary-2019 (HAM, in their overlays), australia-1994 (HIL),
belgium-1995 (MSCM), hungary-1992 (BER).

## Model gaps, ranked

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

`pnpm --filter @laststint/sim reachability <id>` for each of the 39 authored Eras-only races and
`pnpm --filter @laststint/worker reachability:shared <id>` for each of the 5 authored shared races
(the race file merged with its overlay, the model the Eras API serves), one race per call.
Last report = integration 7.

| Race | Era difficulty | Legend | Stay-out ★3 | Result | Last report |
|---|---|---|---|---|---|
| abu-dhabi-2010 | reachable | reachable | not earned | pass | not authored |
| abu-dhabi-2016 | reachable | reachable | not earned | pass | pass |
| abu-dhabi-2021 (shared) | reachable | reachable | not earned | pass | pass |
| australia-1986 | reachable | reachable | not earned | pass | pass |
| australia-1993 | reachable | reachable | not earned | pass | **fail** |
| australia-1994 | reachable | reachable | not earned | pass | **fail** |
| austria-2002 | reachable | reachable | not earned | pass | pass |
| bahrain-2021 (shared) | reachable | reachable | not earned | pass | pass |
| belgium-1992 | reachable | reachable | not earned | pass | pass |
| belgium-1995 | reachable | reachable | not earned | pass | **fail** |
| belgium-2023 | reachable | reachable | not earned | pass | not authored |
| brazil-1991 | reachable | reachable | not earned | pass | pass |
| brazil-2019 | reachable | reachable | not earned | pass | **fail** |
| china-2011 | reachable | reachable | not earned | pass | not authored |
| europe-1993 | reachable | reachable | not earned | pass | **fail** |
| europe-2012 | reachable | reachable | not earned | pass | **fail** |
| france-2004 | reachable | reachable | not earned | pass | not authored |
| france-2021 (shared) | reachable | reachable | not earned | pass | pass |
| germany-1986 | reachable | reachable | not earned | pass | pass |
| germany-2018 | reachable | reachable | not earned | pass | pass |
| germany-2019 | reachable | reachable | not earned | pass | pass |
| great-britain-1987 | reachable | reachable | not earned | pass | **fail** |
| hungary-1986 | reachable | reachable | not earned | pass | **fail** |
| hungary-1992 | reachable | reachable | not earned | pass | **fail** |
| hungary-1998 | reachable | reachable | not earned | pass | not authored |
| hungary-2019 (shared) | reachable | reachable | not earned | pass | **fail** |
| hungary-2022 | reachable | reachable | not earned | pass | pass |
| japan-2000 | reachable | reachable | not earned | pass | not authored |
| malaysia-2013 | reachable | reachable | not earned | pass | pass |
| mexico-1986 | reachable | reachable | not earned | pass | pass |
| mexico-1990 | reachable | reachable | not earned | pass | **fail** |
| monaco-1984 | reachable | reachable | not earned | pass | pass |
| monaco-1988 | reachable | reachable | not earned | pass | pass |
| portugal-1984 | reachable | reachable | not earned | pass | **fail** |
| portugal-1985 | reachable | reachable | not earned | pass | **fail** |
| russia-2021 (shared) | reachable | reachable | not earned | pass | pass |
| san-marino-2005 | reachable | reachable | not earned | pass | not authored |
| spain-1994 | reachable | reachable | not earned | pass | pass |
| spain-1996 | reachable | reachable | not earned | pass | not authored |
| spain-2013 | reachable | reachable | not earned | pass | pass |
| spain-2016 | reachable | reachable | not earned | pass | pass |
| turkey-2020 | reachable | reachable | not earned | pass | not authored |
| turkey-2021 | reachable | reachable | not earned | pass | pass |
| united-states-1990 | reachable | reachable | not earned | pass | pass |

**44 pass, 0 fail of 44** (39 Eras-only, 5 shared). Last report: 22 pass, 13 fail of 35. Not
checked: the 54 built races with no authored `eras` block (south-africa-1983, monaco-1992 and
france-1990 wait on the solver fix for their anchors; the rest on G1) and the 2 not built.

## Not built

- **china-2007** (Era 5): the user's car, Hamilton, isn't in the race model. He ran only wet
  laps (retired on lap 31), so `build.dry_fit` has no dry pace for him and `assemble` drops him.
  Needs a pace for a car with only wet laps (gap 'dropped cars').
- **brazil-1993** (Era 2): registered with `data_issue`, raw reconstruction only. Anchors pass
  (108/108 with W2's lap leaders), but no source gives the field's slick stops (laps 40-43), so
  the synthetic race isn't the real one. Needs the slick stops sourced, or a solver rule for
  unsourced tyre changes.

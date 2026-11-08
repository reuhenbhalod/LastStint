# Eras races report

Eras build plan steps 3.2 and 5.2, Nov 8 2026 (integration 7). One row per race of the 100 in
data/pools.json's `eras` block, in the spec's §4 order (Era 10, play order 1, first). Written
from a fresh build of every non-pool race on the merged code (integration 6's M1-M4 and A1-A4,
plus W4's sourced race-data corrections, W3's dirty-air model (built, switched off), W2's
sourced lap leaders and running order as reconstruction anchors, and W1's Eras grader fixes),
and a fresh robust G1 run of every built race (`pipeline validate`'s robust mode: 1,000 runs on
each of two seed sets, one race per call; pass = both sets pass, borderline = one). Diagnoses
are kept from the last report where the race's status and error held (within 1 s), otherwise
from `diagnose.py` on this run, the W4 notes (docs/eras-checks/w4-corrections.md) and the
model fix notes in docs/g1-report.md.

**Switches.** `restart.IN_ERAS_BUILDS` (M4's SC restart jump and spread) stays off, as chosen in
integration 6 (its on / off G1 comparison is in that report, b56edb4). `dirty_air.IN_ERAS_BUILDS`
(W3's dirty-air bands, held gap and de-trafficked pace) is off: it made robust G1 worse on M3's
28 races (docs/g1-report.md, Eras sim fix W3). Neither changes a race file.

**W1 (the grader) doesn't move G1**: G1 replays the race, it doesn't grade calls. Its effect is
in the reachability table. Every Daily and Gauntlet race file and golden is byte-identical to
the eras branch.

- **Data source**: where the laps come from. Jolpica races before 2011 take their stops from F1DB.
  Reconstructed races (1983-1995) have no lap timing: their laps are solved to the anchors.
- **Estimated**: the race file's `provenance.estimated` (fields the build estimated, not read).
- **Check**: G1 for races with real lap timing; for reconstructed races the core anchors
  (`reconstruct.failures`: grid, order, gaps, fastest laps, retirements, laps down, stops,
  safety cars, tyres, and since W2 lap leaders, running order and lap gaps) are the pass
  criterion and G1 is only a sanity check of the replay.
- **Mean gap error / anchors**: G1's mean over the gap checks (both seed sets), or core anchors
  passed / total (W2 added the leader, running-order and lap-gap anchors, so the totals grew).
- **Main failing check**: the check furthest over its limit, values seed set 10000 / 20000,
  limit in brackets.

## Era 10: Ground-effect era (2022–2025)

| # | Race | Data source | Estimated | Built | Check | Result | Mean gap error / anchors | Main failing check | Diagnosis |
|---|---|---|---|---|---|---|---|---|---|
| 1 | monaco-2022 | Jolpica laps | compounds, safetyCars, weather | yes | G1 | **fail** | 7.49 s | duel LEC vs PER gap error 9.46 / 8.8 [3.00] (+6 more) | Monaco's few clear-air laps for the wet-pace fit (M1) and the drying track; 4.93 -> 7.49 s |
| 2 | great-britain-2022 | Jolpica laps | compounds, safetyCars | yes | G1 | **fail** | 2.03 s | duel LEC vs SAI gap error 5.09 / 5 [3.00] (+2 more) | the 10-lap sprint after the late SC (LEC vs SAI 5.1 s); 2.96 -> 2.03 s |
| 3 | hungary-2022 | FastF1 (F1 live timing) | none | yes | G1 | pass | 1.97 s |  | passes; now played from Verstappen (A1) |
| 4 | singapore-2023 | FastF1 (F1 live timing) | none | yes | G1 | **fail** | 4.01 s | field GAS gap error 10.8 / 11.11 [5.00] (+2 more) | race mechanics (pace 4%): the NOR vs SAI gap, GAS 9.9 s |
| 5 | netherlands-2023 | OpenF1 | none | yes | G1 | **fail** | 6.69 s | podium order rate 0.01 / 0.01 [0.50] (+4 more) | HAM's five wet laps, all in the finish shower (M1), and the red-flag restart; 3.79 -> 6.69 s |
| 6 | miami-2024 | FastF1 (F1 live timing) | none | yes | G1 | **fail** | 4.71 s | duel VER vs NOR gap error 5.6 / 5.38 [3.00] (+5 more) | race mechanics (pace 3%): the SC that timed Norris' stop (spec §4); rebuilt with the Eras fixes (2.88 s before) |
| 7 | hungary-2024 | FastF1 (F1 live timing) | none | yes | G1 | **fail** | 1.96 s | field LEC gap error 5.12 / 5.15 [5.00] | McLaren's swap is now scripted (M4 team orders: the duel order passes); LEC's field gap 5.1 s, just over |
| 8 | belgium-2023 | OpenF1 | none | yes | G1 | pass | 1.73 s |  | now passes: driver damp / wet pace from clear-air laps against the field (M1) |
| 9 | australia-2025 | OpenF1 | none | yes | G1 | **fail** | 3.66 s | duel VER vs NOR gap error 7.31 / 7.26 [3.00] (+2 more) | wet-dry race: duel VER vs NOR 7.3 s; 4.62 -> 3.66 s with M1 |
| 10 | monaco-2025 | OpenF1 | none | yes | G1 | **fail** | 3.27 s | field HAM gap error 8.45 / 8.13 [5.14] (+1 more) | Hamilton in the Monaco queue of the mandatory two-stop (8.5 s); 2.63 -> 3.27 s |

## Era 9: The 2021 title fight

| # | Race | Data source | Estimated | Built | Check | Result | Mean gap error / anchors | Main failing check | Diagnosis |
|---|---|---|---|---|---|---|---|---|---|
| 1 | bahrain-2021 | FastF1 (F1 live timing) | none | yes | G1 | pass | 0.66 s |  | passes; strict status fails only on a near-tie |
| 2 | spain-2021 | FastF1 (F1 live timing) | none | yes | G1 | **fail** | 6.15 s | duel VER vs HAM gap error 7.48 / 7.55 [3.00] (+4 more) | race mechanics (pace 1%): VER 7 s, BOT, PER, RIC |
| 3 | azerbaijan-2021 | Jolpica laps | compounds, safetyCars | yes | G1 | **fail** | 2.90 s | field ALO gap error 6.95 / 6.97 [5.00] | race mechanics: Alonso's red-flag restart and a recorded pit-lane pass |
| 4 | france-2021 | FastF1 (F1 live timing) | none | yes | G1 | pass | 3.01 s |  |  |
| 5 | hungary-2021 | FastF1 (F1 live timing) | weather | yes | G1 | **fail** | 5.15 s | podium HAM gap error 9.87 / 9.74 [5.00] (+3 more) | Hamilton's charge on hards after the wet start (HAM 9.9 s); 5.74 -> 5.15 s |
| 6 | russia-2021 | FastF1 (F1 live timing) | none | yes | G1 | pass | 2.89 s |  |  |
| 7 | turkey-2021 | Jolpica laps | compounds, safetyCars, weather | yes | G1 | pass | 0.41 s |  | passes; now played from Leclerc (A1), takeover pinned at lap 38 |
| 8 | brazil-2021 | FastF1 (F1 live timing) | none | yes | G1 | **fail** | 1.85 s | duel VER vs HAM gap error 3.33 / 3.39 [3.00] | race mechanics: Hamilton's pass on Verstappen (duel gap 3.12, just over) |
| 9 | saudi-arabia-2021 | Jolpica laps | compounds, safetyCars | yes | G1 | **fail** | 8.57 s | podium BOT gap error 19.09 / 19.22 [5.00] (+4 more) | two red flags and their restarts (BOT 19 s); 13.96 -> 8.57 s on the combined fixes |
| 10 | abu-dhabi-2021 | FastF1 (F1 live timing) | none | yes | G1 | pass | 2.27 s |  |  |

## Era 8: Mercedes vs Ferrari (2017–2020)

| # | Race | Data source | Estimated | Built | Check | Result | Mean gap error / anchors | Main failing check | Diagnosis |
|---|---|---|---|---|---|---|---|---|---|
| 1 | monaco-2017 | TUM f1-timing-database | none | yes | G1 | **fail** | 2.98 s | field BOT gap error 6.34 / 6.45 [5.00] | race mechanics (pace 5%): Bottas in Monaco traffic |
| 2 | azerbaijan-2017 | TUM f1-timing-database | none | yes | G1 | **fail** | 5.85 s | podium order rate 0.08 / 0.07 [0.50] (+6 more) | red flag and SC restarts (podium order 0.08); 6.86 -> 5.85 s |
| 3 | germany-2018 | TUM f1-timing-database | weather | yes | G1 | pass | 1.59 s |  | passes with the restart switch off (fails on with it on: 1.88 s); pace by stint moved GRO to 5.06 [5.00] on M2 alone |
| 4 | russia-2018 | TUM f1-timing-database | none | yes | G1 | **fail** | 2.34 s | duel BOT vs HAM gap error 4.18 / 4.24 [3.00] | Mercedes' swap is now scripted (M4: duel and podium order pass); the duel gap 4.2 s, the sim's BOT drops further back |
| 5 | germany-2019 | TUM f1-timing-database | weather | yes | G1 | pass | 1.38 s |  |  |
| 6 | hungary-2019 | FastF1 (F1 live timing) | none | yes | G1 | pass | 0.96 s |  |  |
| 7 | brazil-2019 | TUM f1-timing-database | none | yes | G1 | **fail** | 1.97 s | duel HAM vs GAS gap error 4.46 / 4.53 [3.00] | **new fail**: now played from Hamilton (A1's hard-call side). The duel is the real 0.06 s finish: Gasly's last-stint offset (M2) and the overtake model (M3: Hamilton's late charge passes less) move the mean gap |
| 8 | italy-2020 | Jolpica laps | compounds, safetyCars | yes | G1 | **fail** | 2.23 s | duel GAS vs SAI gap error 4.96 / 5.11 [3.00] (+1 more) | the red-flag restart and Gasly holding Sainz off; 3.69 -> 2.23 s |
| 9 | turkey-2020 | Jolpica laps | compounds, safetyCars, weather | yes | G1 | pass | 1.76 s |  | now passes on the combined fixes; the dry labels from lap 18 (gap 11) remain |
| 10 | sakhir-2020 | Jolpica laps | compounds, safetyCars | yes | G1 | **fail** | 2.51 s | duel RUS vs PER gap error 8.85 / 8.8 [3.00] | duel RUS vs PER 8.9 s: the fitted SC queue's stop costs (sim fixes 2) and the overtake model (M3); 1.30 -> 2.51 s |

## Era 7: Hybrid turbo (2014–2016)

| # | Race | Data source | Estimated | Built | Check | Result | Mean gap error / anchors | Main failing check | Diagnosis |
|---|---|---|---|---|---|---|---|---|---|
| 1 | bahrain-2014 | TUM f1-timing-database | none | yes | G1 | **fail** | 1.17 s | duel HAM vs ROS order rate 0.48 / 0.49 [0.60] (+1 more) | the late-SC fight between HAM and ROS (duel order 0.48 [0.60]); 2.16 -> 1.17 s |
| 2 | canada-2014 | TUM f1-timing-database | none | yes | G1 | **fail** | 2.99 s | duel ROS vs RIC order rate 0.22 / 0.2 [0.60] (+3 more) | the field's pace now fits (6.53 -> 2.99 s: faults carry the stint offsets, M2); duel order ROS vs RIC 0.22, Ricciardo's late passes |
| 3 | hungary-2014 | TUM f1-timing-database | weather | yes | G1 | **fail** | 2.73 s | field RAI gap error 5.66 / 6.39 [5.00] (+1 more) | tyre wear on long last stints (RAI 5.7 s); 4.15 -> 2.73 s |
| 4 | monaco-2015 | TUM f1-timing-database | none | yes | G1 | **fail** | 4.71 s | podium order rate 0.26 / 0.26 [0.50] (+5 more) | race mechanics (pace 4%): the SC and Monaco traffic (KVY, RIC, RAI) |
| 5 | hungary-2015 | TUM f1-timing-database | none | yes | G1 | **fail** | 6.90 s | field ALO gap error 19.8 / 19.63 [5.00] (+4 more) | race mechanics: ALO 20 s, VET vs KVY; 5.76 -> 6.90 s (M3 measured 6.59 alone) |
| 6 | united-states-2015 | TUM f1-timing-database | weather | yes | G1 | **fail** | 2.31 s | duel HAM vs ROS order rate 0.4 / 0.39 [0.60] (+2 more) | Rosberg's one-lap loss on lap 48, which decides the duel, isn't modelled (duel order 0.40); 3.30 -> 2.31 s |
| 7 | spain-2016 | TUM f1-timing-database | none | yes | G1 | pass | 1.13 s |  |  |
| 8 | monaco-2016 | TUM f1-timing-database | none | yes | G1 | **fail** | 10.79 s | podium order rate 0.02 / 0.02 [0.50] (+6 more) | a wet race with no rain data; the full-wets shift (M1) and the SC (race mechanics 77%); 8.15 -> 10.79 s |
| 9 | great-britain-2016 | TUM f1-timing-database | weather | yes | G1 | **fail** | 2.37 s | podium order rate 0.41 / 0.4 [0.50] | Rosberg's gearbox fault (laps 46-47) is now a sourced FAULT (W4): the duel order passes, the podium order is still 0.41 [0.50] and the gap errors grow a little; 2.11 -> 2.37 s |
| 10 | abu-dhabi-2016 | TUM f1-timing-database | none | yes | G1 | pass | 0.85 s |  |  |

## Era 6: Fast-wearing tyres (2010–2013)

| # | Race | Data source | Estimated | Built | Check | Result | Mean gap error / anchors | Main failing check | Diagnosis |
|---|---|---|---|---|---|---|---|---|---|
| 1 | australia-2010 | Jolpica laps + F1DB stops | compounds, safetyCars, weather | yes | G1 | **fail** | 4.11 s | field ROS gap error 9.65 / 9.38 [5.00] (+2 more) | the two-stoppers stuck in the one-stop train (ROS 9.6 s); 3.35 -> 4.10 s |
| 2 | abu-dhabi-2010 | Jolpica laps + F1DB stops | compounds, safetyCars | yes | G1 | pass | 1.96 s |  | now passes on the combined fixes (the Petrov train: pooled overtake model, M3) |
| 3 | china-2011 | Jolpica laps | compounds, safetyCars | yes | G1 | pass | 1.44 s |  | now passes on the combined fixes (pooled overtake model, M3; pace by stint, M2) |
| 4 | monaco-2011 | Jolpica laps | compounds, safetyCars | yes | G1 | **fail** | 15.16 s | field HAM gap error 69.07 / 70.99 [5.00] (+2 more) | W4's SC fix (the first SC one period, laps 34-38; the late SC, 69-71, an SC, not a yellow) puts VET, ALO and BUT within 1 s of their real gaps; what fails is HAM (69 s) and WEB (26 s) a lap down at the red-flag restart (no unlapping); 43.37 -> 15.16 s |
| 5 | canada-2011 | Jolpica laps | compounds, safetyCars, weather | yes | G1 | **fail** | 3.02 s | podium order rate 0.26 / 0.23 [0.50] (+3 more) | lap pace (58%) on the drying track (PET, MAS); the back-to-back stop fix took it from 10.27 to 3.51 s |
| 6 | europe-2012 | Jolpica laps | compounds, safetyCars | yes | G1 | **fail** | 1.46 s | podium MSCM gap error 5.38 / 5.15 [5.00] | the sourced SC (laps 28-33, W4; applied here with the storyline SC moved to lap 28): MSCM's podium gap 5.38 / 5.15 [5.00], just over (race mechanics 76%); 1.94 -> 1.46 s |
| 7 | abu-dhabi-2012 | Jolpica laps | compounds, safetyCars | yes | G1 | **fail** | 1.72 s | duel VET vs BUT gap error 3.4 / 3.22 [3.00] (+1 more) | the VET vs BUT gap, just over (3.4 / 3.2 [3.00]); 2.89 -> 1.72 s |
| 8 | brazil-2012 | Jolpica laps | compounds, safetyCars, weather | yes | G1 | **fail** | 3.44 s | duel VET vs ALO gap error 5.65 / 5.65 [3.00] (+2 more) | Vettel's last wet stint (pace 49%) |
| 9 | malaysia-2013 | Jolpica laps | compounds, safetyCars, weather | yes | G1 | pass | 1.20 s |  |  |
| 10 | spain-2013 | Jolpica laps | compounds, safetyCars | yes | G1 | **fail** | 1.51 s | duel ALO vs RAI gap error 3.08 / 3.16 [3.00] | **new fail**, just over: duel ALO vs RAI 3.08 / 3.16 [3.00] (race mechanics 89%) |

## Era 5: Alonso, Räikkönen, Hamilton (2005–2009)

| # | Race | Data source | Estimated | Built | Check | Result | Mean gap error / anchors | Main failing check | Diagnosis |
|---|---|---|---|---|---|---|---|---|---|
| 1 | san-marino-2005 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | pass | 1.70 s |  | now passes: pace by stint (M2: Schumacher's middle stint, Alonso's last) and the pooled overtake model (M3) |
| 2 | japan-2005 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | **fail** | 4.48 s | duel RAI vs FIS order rate 0.15 / 0.16 [0.60] (+5 more) | Räikkönen's last stint: the duel order RAI vs FIS 0.15 [0.60]; 6.18 -> 4.48 s |
| 3 | hungary-2006 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads, weather | yes | G1 | **fail** | 15.15 s | duel BUT vs DLR gap error 21.85 / 21 [3.00] (+3 more) | de la Rosa's dry-labelled wet stint (BUT vs DLR 21 s); RAI and LIU dropped; 22.00 -> 15.15 s with M1 |
| 4 | brazil-2006 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | **fail** | 6.99 s | duel ALO vs MSCM gap error 17.38 / 17.06 [3.00] (+1 more) | Schumacher's charge: ALO vs MSCM 17 s; 8.23 -> 6.99 s |
| 5 | china-2007 | Jolpica laps + F1DB stops | none | no: user's car (HAM) isn't in the model: he ran only wet laps, so `build.dry_fit` has no dry pace for him and `assemble` drops him | G1 | **not built** |  |  |  |
| 6 | europe-2007 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads, weather | yes | G1 | **fail** | 2.23 s | duel ALO vs MAS gap error 6.12 / 6 [3.00] (+2 more) | pace in the late rain: ALO vs MAS 6.1 s; 4.93 -> 2.23 s with M1 |
| 7 | brazil-2007 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | **fail** | 2.00 s | field ROS gap error 7.02 / 6.9 [6.28] | race mechanics: the second-stop swap and Rosberg's train |
| 8 | monaco-2008 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads, weather | yes | G1 | **fail** | 4.53 s | podium order rate 0.18 / 0.19 [0.50] (+5 more) | the long stints on old inters (podium order 0.18); 3.28 -> 4.53 s |
| 9 | brazil-2008 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads, weather | yes | G1 | **fail** | 5.42 s | field GLO gap error 12.91 / 12.95 [5.00] (+3 more) | 2.4's estimated SOFT/HARD split and Trulli's train (GLO 13 s); 7.26 -> 5.42 s |
| 10 | brazil-2009 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | **fail** | 3.79 s | field VET gap error 7.08 / 7.06 [5.00] (+2 more) | Vettel's field gap (7.1 s; the duel passes since M2); 4.50 -> 3.79 s |

## Era 4: Ferrari dynasty (2000–2004)

| # | Race | Data source | Estimated | Built | Check | Result | Mean gap error / anchors | Main failing check | Diagnosis |
|---|---|---|---|---|---|---|---|---|---|
| 1 | germany-2000 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads, weather | yes | G1 | **fail** | 2.85 s | duel BAR vs HAK gap error 3.07 / 2.97 [3.00] (+1 more) | W4 sourced both SCs (laps 25-28 and 30-31) and rejected the rain periods: 32.31 -> 2.85 s. Now just over at the limits: duel BAR vs HAK 3.07 / 2.97 [3.00], DLR 5.06 / 5.01 [5.00] (race mechanics 54%) |
| 2 | japan-2000 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads, weather | yes | G1 | pass | 1.27 s |  | now passes: driver damp / wet pace (M1) |
| 3 | malaysia-2001 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads, weather | yes | G1 | **fail** | 9.92 s | duel MSCM vs BAR gap error 17.36 / 17.19 [3.00] (+5 more) | Ferrari's inters against the field's full wets (the laps can't split them); FIS dropped; the SC now from lap 4 as sourced (W4): 8.35 -> 9.92 s |
| 4 | austria-2002 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | pass | 0.63 s |  | passes; the last-corner swap now plays (M4) |
| 5 | brazil-2003 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads, weather | yes | G1 | **fail** | 5.74 s | duel FIS vs RAI gap error 7.98 / 7.57 [3.00] (+4 more) | Fisichella's last-lap pass isn't modelled; Räikkönen's last-stint offset (M2) takes him further clear; 3.79 -> 5.74 s |
| 6 | hungary-2003 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | **fail** | 7.08 s | field SCH gap error 20.8 / 20.98 [5.00] (+3 more) | Williams' pace by stint, now fitted (M2): SCH 21 s; 10.24 -> 7.08 s |
| 7 | united-states-2003 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads, weather | yes | G1 | **fail** | 6.20 s | duel MSCM vs RAI gap error 7.53 / 7.62 [3.00] (+3 more) | Bridgestone wet pace: W4 rejected the lap 21 and 23 'SC' (rain), so those laps are in the pace fit now; MSCM vs RAI 7.5 s, HEI 13.5 s; 4.77 -> 6.20 s |
| 8 | japan-2003 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | **fail** | 4.05 s | duel MSCM vs RAI gap error 11.68 / 11.77 [3.00] (+1 more) | Schumacher's and Barrichello's stints (MSCM vs RAI 11.7 s); 3.53 -> 4.05 s |
| 9 | france-2004 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | pass | 1.89 s |  | now passes: pace by stint (M2) |
| 10 | monaco-2004 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | **fail** | 3.64 s | podium BAR gap error 7.64 / 7.18 [5.00] (+1 more) | Barrichello's podium gap (7.6 s); Button's last stint now fitted (M2): 5.63 -> 3.64 s |

## Era 3: Refuelling returns (1994–1999)

| # | Race | Data source | Estimated | Built | Check | Result | Mean gap error / anchors | Main failing check | Diagnosis |
|---|---|---|---|---|---|---|---|---|---|
| 1 | spain-1994 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, safetyCars, fuelLoads, weather | yes | anchors | pass | 93/93 core anchors | G1 sanity pass, 1.05 s |  |
| 2 | australia-1994 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, safetyCars, fuelLoads, weather | yes | anchors | pass | 104/104 core anchors | G1 sanity pass, 0.18 s | anchors pass; Schumacher leads from lap 1 as sourced (W2's lap leaders); the collision retires both only on the real calls (M4 storyline retirement) |
| 3 | belgium-1995 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 134/134 core anchors | G1 sanity fail, 5.76 s | anchors pass; G1 sanity 2.97 -> 5.76 s on W2's anchors: BRU (21.5 s) and FRE on estimated stint tyres |
| 4 | spain-1996 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads, weather | yes | G1 | pass | 0.62 s |  | now passes: pace by stint (M2); still wet all race and built dry |
| 5 | hungary-1997 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | **fail** | 2.53 s | field MSCM gap error 10.18 / 10.48 [5.00] (+1 more) | stint pace behind the leaders: MSCM 10 s; 4.15 -> 2.53 s with M2 |
| 6 | europe-1997 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | **fail** | 0.82 s | podium order rate 0.45 / 0.46 [0.50] | the let-bys at the flag scripted (M4: VIL's podium gap passes); podium order 0.45 [0.50], 2.53 -> 0.82 s |
| 7 | hungary-1998 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | pass | 1.58 s |  | now passes on the combined fixes (Schumacher's push fitted, M2; overtaking, M3; no SC, so not the restart switch) |
| 8 | belgium-1998 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads, weather | yes | G1 | **fail** | 5.25 s | field DIN gap error 14.03 / 13.97 [5.17] (+3 more) | W4: SC laps 29-32 and Jordan's hold order (TEAM_ORDER, laps 33-44); the duel passes. The sim's restart is nose-to-tail (really HIL 2.4 s, ALE 4.7 s back) and its ALE then passes the Jordans: DIN 14.0 s, ALE 11.8 s; 14.21 -> 5.25 s |
| 9 | malaysia-1999 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | **fail** | 2.96 s | duel IRV vs HAK gap error 3.62 / 3.87 [3.00] (+1 more) | Ferrari's team orders scripted (M4); the duel IRV vs HAK gap 3.6 / 3.9 [3.00], Irvine's last laps |
| 10 | europe-1999 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads, weather | yes | G1 | **fail** | 25.63 s | field SCH gap error 49.33 / 49 [5.00] (+5 more) | W4's sourced tyre classes and the rejected lap 36-43 'SC' (rain): the wet runners finish too far back, the slick runners too far forward (SCH 49 s). At the fitted wetness the slick and inter curves sit about 2% apart, the real second shower about 8%: needs a per-car wetness or new wet curves; 23.24 -> 25.63 s |

## Era 2: Senna vs Prost (1989–1993)

| # | Race | Data source | Estimated | Built | Check | Result | Mean gap error / anchors | Main failing check | Diagnosis |
|---|---|---|---|---|---|---|---|---|---|
| 1 | france-1990 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | **fail** | 67/68 core anchors | order anchor; G1 sanity fail, 3.86 s | anchor fail (order): de Cesaris' disqualification puts him in the road order (solver); G1 sanity 0.52 -> 3.86 s on W2's anchors: duel CAP vs PRO 8.1 s (race mechanics 98%) |
| 2 | united-states-1990 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 60/60 core anchors | G1 sanity pass, 2.18 s |  |
| 3 | mexico-1990 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 73/73 core anchors | G1 sanity pass, 1.84 s | anchors pass; G1 sanity now passes on W2's anchors (2.00 -> 1.84 s) |
| 4 | brazil-1991 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 61/61 core anchors | G1 sanity fail, 3.64 s | anchors pass; G1 sanity 2.37 -> 3.64 s on W2's anchors: ALE and PRO about 7 s (pace 69%) |
| 5 | monaco-1992 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | **fail** | 57/58 core anchors | grid anchor; G1 sanity pass, 1.60 s | anchor fail (grid): Moreno's and Wendlinger's lap 1 pinned by their fastest laps (solver) |
| 6 | belgium-1992 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 110/110 core anchors | G1 sanity fail, 10.86 s | anchors pass; rival Mansell again (W1: his slick stop is a storyline call); Mansell leads at the takeover as sourced. G1 sanity 5.18 -> 10.86 s on W2's anchors (10.80 s with Patrese as the rival): duel MSCM vs MAN 14.4 s, PAT 13.8 s |
| 7 | hungary-1992 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 57/57 core anchors | G1 sanity fail, 4.10 s | anchors pass; G1 sanity 2.55 -> 4.10 s on W2's anchors: duel MAN vs BER 6.5 s, Mansell's fresh-tyre pace (pace 90%) |
| 8 | brazil-1993 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather (sidecar) | no: `data_issue`: the synthetic race isn't the real one (no source for the field's slick stops on laps 40-43; Senna P14 at the takeover, can't win with his real calls). Raw reconstruction only; anchors 108/108 (G1 sanity 46.25 s, integration 6; not re-run) | anchors | **not built** |  |  |  |
| 9 | europe-1993 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, safetyCars, fuelLoads, weather | yes | anchors | pass | 106/106 core anchors | G1 sanity fail, 52.20 s | anchors pass; Senna now leads at the takeover (W2's lap leaders; was P12); rival Hill again (W1). G1 sanity 1.16 -> 52.20 s: HIL 78 s off his real gap (38.20 s with Prost as the rival, so mostly the anchors): his four unsourced later stops are absorbed into his pace |
| 10 | australia-1993 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, safetyCars, fuelLoads, weather | yes | anchors | pass | 60/60 core anchors | G1 sanity pass, 0.72 s |  |

## Era 1: Turbo era (1983–1988)

| # | Race | Data source | Estimated | Built | Check | Result | Mean gap error / anchors | Main failing check | Diagnosis |
|---|---|---|---|---|---|---|---|---|---|
| 1 | south-africa-1983 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | **fail** | 57/58 core anchors | grid anchor; G1 sanity pass, 2.95 s | anchor fail (grid): a lap-1 retirement pinned by its fastest lap (solver); G1 sanity now passes on W2's anchors (3.93 -> 2.95 s) |
| 2 | monaco-1984 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 41/41 core anchors | G1 sanity fail, 2.40 s | anchors pass; fuel limit bites in the rain as if dry; G1 sanity 5.54 -> 2.40 s on W2's anchors (BEL 6.3 s) |
| 3 | portugal-1984 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 58/58 core anchors | G1 sanity fail, 3.00 s | anchors pass; G1 sanity: race mechanics (pace 32%) |
| 4 | germany-1986 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 68/68 core anchors | G1 sanity pass, 1.77 s | anchors pass; Rosberg runs to the last lap 2.0 s behind Piquet (M4 lastLapStops) and his out-of-fuel stop is left to the fuel model |
| 5 | portugal-1985 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 58/58 core anchors | G1 sanity pass, 0.37 s | anchors pass; Senna 30 s clear by lap 20 as sourced (W2); fuel limit bites in the rain as if dry |
| 6 | mexico-1986 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 54/54 core anchors | G1 sanity pass, 2.03 s |  |
| 7 | hungary-1986 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 71/71 core anchors | G1 sanity pass, 0.26 s |  |
| 8 | australia-1986 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 64/64 core anchors | G1 sanity pass, 0.21 s | anchors pass; Mansell's tyre failure comes only on the real no-stop (M4 storyline retirement) |
| 9 | great-britain-1987 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 58/58 core anchors | G1 sanity pass, 0.69 s | anchors pass; now played from Piquet (A4) |
| 10 | monaco-1988 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 61/61 core anchors | G1 sanity fail, 3.03 s | anchors pass; Senna's crash comes only on the real push from lap 55 (M4); G1 sanity 6.92 -> 3.03 s on W2's anchors (ALBM 5.0 s) |

## Summary

**Result: 41 pass, 0 borderline, 57 fail, 2 not built** (of 100; 22 reconstructed races checked on their anchors, 76 on G1). Last report (integration 6): 41 pass, 0 borderline, 57 fail, 2 not built. No race changed status; the errors moved (below).

| Era | Pass | Borderline | Fail | Not built |
|---|---|---|---|---|
| 10 | 2 | 0 | 8 | 0 |
| 9 | 5 | 0 | 5 | 0 |
| 8 | 4 | 0 | 6 | 0 |
| 7 | 2 | 0 | 8 | 0 |
| 6 | 3 | 0 | 7 | 0 |
| 5 | 1 | 0 | 8 | 1 |
| 4 | 3 | 0 | 7 | 0 |
| 3 | 5 | 0 | 5 | 0 |
| 2 | 7 | 0 | 2 | 1 |
| 1 | 9 | 0 | 1 | 0 |
| **All** | **41** | **0** | **57** | **2** |

Timed races (76): total mean gap error 294.85 s (integration 6: 356.32 s, the same 76 races), all
of the drop from W4's corrections and europe-2012's SC. G1 sanity of the 22 built reconstructed
races: 13 pass, 104.68 s total (integration 6: 13 pass, 44.96 s); W2's anchors move every
reconstructed replay, and europe-1993 (52.20 s) and belgium-1992 (10.86 s) take most of it.

## Model gaps, ranked

By the number of failing races each one explains (a race can have more than one), then by the
races it blocks from being played as authored (those pass their check but can't be won, fail
reachability, or aren't built). Resolved since the last report: the SC estimate misses (W4
sourced germany-2000's and belgium-1998's SCs; gap 9 of the last report), Jordan's unrecorded
order at Spa 1998 (W4's TEAM_ORDER items), great-britain-2016's unsourced gearbox loss (W4's
FAULT), the estimated dry labels at europe-1999 (W4's sourced tyre classes: the gap is now the
wet curves), monaco-2011's tyre wear (W4: the field's long HARD stints don't support more
wear; not the cause), and the reconstructed running order at europe-1993 and australia-1994
(W2: Senna and Schumacher lead as sourced).

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
12. **Eras content under the merged grader and anchors (W1's fuel in playouts and real-plan continuation; W2's sourced running order).** 12 blocked in play (reachability fails, every one with its anchors or G1 as before): australia-1993, australia-1994, europe-1993, hungary-1986, portugal-1985, great-britain-1987, portugal-1984, belgium-1995, hungary-1992, brazil-2019, europe-2012, hungary-2019 (shared); and mexico-1990 has no decision moments. Content to re-author (owner).
13. **Unreconstructed stops (unsourced tyre changes or later stops absorbed into pace).** 1 not built: brazil-1993; europe-1993's G1 sanity (Hill's four unsourced later stops: HIL 78 s).
14. **Fuel limit bites in the rain as if dry (the takeover margin is drawn for a dry burn).** 2 blocked in play or flagged: monaco-1984, portugal-1985.

## Since the last report

No race changed status. Every row whose error moved by 0.05 s or more against the integration 6
report (eras branch, b56edb4). Before = that report's number; after = this run.

| Race | Era | Before | After | Why |
|---|---|---|---|---|
| monaco-2011 | 6 | fail, 43.37 s | fail, 15.16 s | W4: the first SC one period (34-38), the late SC (69-71) an SC |
| germany-2000 | 4 | fail, 32.31 s | fail, 2.85 s | W4: both SCs sourced (25-28, 30-31), the rain periods rejected; now at the limits |
| belgium-1998 | 3 | fail, 14.21 s | fail, 5.25 s | W4: SC laps 29-32 and Jordan's hold order |
| europe-2012 | 6 | fail, 1.94 s | fail, 1.46 s | the sourced SC, laps 28-33 (W4's correction, applied here with the overlay and moments moved) |
| europe-1999 | 3 | fail, 23.24 s | fail, 25.63 s | W4: sourced tyre classes, the lap 36-43 "SC" rejected (rain); needs wet-curve work |
| malaysia-2001 | 4 | fail, 8.35 s | fail, 9.92 s | W4: the SC from lap 4 (was 5) |
| united-states-2003 | 4 | fail, 4.77 s | fail, 6.20 s | W4: the lap 21 and 23 "SC" rejected (rain), those laps now in the pace fit |
| great-britain-2016 | 7 | fail, 2.11 s | fail, 2.37 s | W4: Rosberg's gearbox fault (laps 46-47); duel order passes, podium order doesn't |
| europe-1993 | 2 | pass (anchors), sanity pass 1.16 s | pass (anchors 106/106), sanity fail 52.20 s | W2's anchors (Senna leads at the takeover) and W1's rival Hill: HIL 78 s |
| belgium-1992 | 2 | pass (anchors), sanity fail 5.18 s | pass (anchors 110/110), sanity fail 10.86 s | W2's anchors (10.80 s with Patrese as the rival) |
| monaco-1988 | 1 | pass (anchors), sanity fail 6.92 s | pass (anchors 61/61), sanity fail 3.03 s | W2's anchors |
| monaco-1984 | 1 | pass (anchors), sanity fail 5.54 s | pass (anchors 41/41), sanity fail 2.40 s | W2's anchors |
| france-1990 | 2 | fail (order anchor), sanity pass 0.52 s | fail (order anchor), sanity fail 3.86 s | W2's anchors |
| belgium-1995 | 3 | pass (anchors), sanity fail 2.97 s | pass (anchors 134/134), sanity fail 5.76 s | W2's anchors |
| hungary-1992 | 2 | pass (anchors), sanity fail 2.55 s | pass (anchors 57/57), sanity fail 4.10 s | W2's anchors |
| brazil-1991 | 2 | pass (anchors), sanity fail 2.37 s | pass (anchors 61/61), sanity fail 3.64 s | W2's anchors |
| south-africa-1983 | 1 | fail (grid anchor), sanity fail 3.93 s | fail (grid anchor), sanity pass 2.95 s | W2's anchors |
| mexico-1990 | 2 | pass (anchors), sanity fail 2.00 s | pass (anchors 73/73), sanity pass 1.84 s | W2's anchors |
| spain-1994 | 3 | pass (anchors), sanity pass 0.11 s | pass (anchors 93/93), sanity pass 1.05 s | W2's anchors |
| germany-1986 | 1 | pass (anchors), sanity pass 1.03 s | pass (anchors 68/68), sanity pass 1.77 s | W2's anchors |
| portugal-1984 | 1 | pass (anchors), sanity fail 2.49 s | pass (anchors 58/58), sanity fail 3.00 s | W2's anchors |
| united-states-1990 | 2 | pass (anchors), sanity pass 1.56 s | pass (anchors 60/60), sanity pass 2.18 s | W2's anchors |
| mexico-1986 | 1 | pass (anchors), sanity pass 2.47 s | pass (anchors 54/54), sanity pass 2.03 s | W2's anchors |
| australia-1993 | 2 | pass (anchors), sanity pass 0.34 s | pass (anchors 60/60), sanity pass 0.72 s | W2's anchors |
| australia-1986 | 1 | pass (anchors), sanity pass 0.78 s | pass (anchors 64/64), sanity pass 0.21 s | W2's anchors |
| great-britain-1987 | 1 | pass (anchors), sanity pass 1.07 s | pass (anchors 58/58), sanity pass 0.69 s | W2's anchors |
| hungary-1986 | 1 | pass (anchors), sanity pass 0.03 s | pass (anchors 71/71), sanity pass 0.26 s | W2's anchors |
| monaco-1992 | 2 | fail (grid anchor), sanity pass 1.38 s | fail (grid anchor), sanity pass 1.60 s | W2's anchors |
| australia-1994 | 3 | pass (anchors), sanity pass 0.26 s | pass (anchors 104/104), sanity pass 0.18 s | W2's anchors |
| portugal-1985 | 1 | pass (anchors), sanity pass 0.29 s | pass (anchors 58/58), sanity pass 0.37 s | W2's anchors |

Every other timed race has the same error to the second decimal (australia-2010 4.10 -> 4.11 s:
W4's SC laps 1-4; malaysia-2013 and brazil-2008 unchanged, their SCs rejected or confirmed as
estimated).

## Reachability (eras spec §15)

`pnpm --filter @laststint/sim reachability <id>` for each of the 30 race files with an `eras`
block, one race per call, and `pnpm --filter @laststint/worker reachability:shared` (the five
shared races on the merged model the Eras API serves). Integration 6 = that report; W1 = the
W1 branch's own run (docs/eras-grader.md, on integration 6's race files); now = the merged code
and rebuilt races.

| Race | Era difficulty | Legend | Result | Integration 6 | W1 |
|---|---|---|---|---|---|
| abu-dhabi-2016 | reachable | reachable | pass | pass | pass |
| abu-dhabi-2021 (shared) | reachable | reachable | pass | pass | pass |
| australia-1986 | reachable | reachable | pass | pass | pass |
| australia-1993 | reachable, but stay-out earns ★3 | reachable | **fail** | pass | pass |
| australia-1994 | NOT reachable (best -1 ★2 ★3 hidden no) | NOT reachable (best -1 ★2 ★3 hidden no) | **fail** | fail | pass |
| austria-2002 | reachable | reachable | pass | pass | pass |
| bahrain-2021 (shared) | reachable | reachable | pass | pass | pass |
| belgium-1992 | reachable | reachable | pass | pass | pass |
| belgium-1995 | NOT reachable (best ★1 ★2 ★3 hidden no) | NOT reachable (best ★1 ★2 ★3 hidden no) | **fail** | pass | fail |
| brazil-1991 | reachable | reachable | pass | pass | pass |
| brazil-2019 | NOT reachable (best ★1 ★2 -3 hidden yes) | NOT reachable (best ★1 ★2 -3 hidden yes) | **fail** | pass | fail |
| europe-1993 | NOT reachable (best ★1 ★2 -3 hidden yes) | NOT reachable (best ★1 ★2 -3 hidden yes) | **fail** | pass | pass |
| europe-2012 | NOT reachable (best -1 ★2 ★3 hidden no) | NOT reachable (best -1 ★2 ★3 hidden no) | **fail** | fail | fail |
| france-2021 (shared) | reachable | reachable | pass | pass | pass |
| germany-1986 | reachable | reachable | pass | pass | fail |
| germany-2018 | reachable | reachable | pass | pass | pass |
| germany-2019 | reachable | reachable | pass | pass | pass |
| great-britain-1987 | NOT reachable (best -1 ★2 ★3 hidden no) | NOT reachable (best -1 ★2 ★3 hidden no) | **fail** | pass | fail |
| hungary-1986 | NOT reachable (best ★1 ★2 ★3 hidden no) | NOT reachable (best ★1 ★2 ★3 hidden no) | **fail** | pass | pass |
| hungary-1992 | NOT reachable (best ★1 ★2 ★3 hidden no) | NOT reachable (best ★1 ★2 ★3 hidden no) | **fail** | fail | fail |
| hungary-2019 (shared) | NOT reachable (best ★1 ★2 ★3 hidden no; stay-out earns ★3) | NOT reachable (best ★1 ★2 ★3 hidden no) | **fail** | pass | fail |
| hungary-2022 | reachable | reachable | pass | pass | pass |
| malaysia-2013 | reachable | reachable | pass | pass | pass |
| mexico-1986 | reachable | reachable | pass | pass | fail |
| mexico-1990 | error: no decision moments | - | **fail** | fail | fail |
| monaco-1984 | reachable | reachable | pass | pass | pass |
| monaco-1988 | reachable | reachable | pass | pass | pass |
| portugal-1984 | NOT reachable (best ★1 ★2 -3 hidden no) | NOT reachable (best ★1 ★2 -3 hidden no) | **fail** | pass | fail |
| portugal-1985 | reachable, but stay-out earns ★3 | reachable, but stay-out earns ★3 | **fail** | pass | pass |
| russia-2021 (shared) | reachable | reachable | pass | pass | pass |
| spain-1994 | reachable | reachable | pass | pass | pass |
| spain-2013 | reachable | reachable | pass | pass | pass |
| spain-2016 | reachable | reachable | pass | pass | pass |
| turkey-2021 | reachable | reachable | pass | pass | pass |
| united-states-1990 | reachable | reachable | pass | pass | pass |

**18 pass, 12 fail of the 30; shared 4 of 5 pass: 22 pass, 13 fail of 35** (integration 6: 31 /
4; W1 alone: 25 / 10). Stay-out never earns ★3 except where noted.

Moved against W1 alone (the merged reconstructions, W2, under W1's grader):

- **germany-1986, mexico-1986**: fail -> **pass**. W1's fuel-in-playouts failure (lifting early
  graded best, the ★3 / hidden pace objectives missed) no longer holds on the re-solved races.
- **australia-1993**: pass -> **fail** at Era difficulty only: staying out earns ★3 (Legend passes).
- **australia-1994**: pass -> **fail** at both levels: with Schumacher leading from lap 1 as
  sourced, no searched path beats Hill (best: ★2 ★3, rivalpit-18 box-medium, the path W1 found).
- **europe-1993**: pass -> **fail** at both levels: ★1 and hidden (win by more than a minute) are
  met now that Senna leads at the takeover, but not ★3 (three stops or fewer): the best path
  stops four times.
- **hungary-1986**: pass -> **fail** at both levels: the hidden objective (beat Piquet's real
  17.7 s margin) isn't met on any searched path.
- **portugal-1985**: pass -> **fail** at both levels: staying out earns ★3 (Senna 30 s clear by
  lap 20 as sourced, W2).
- **europe-2012**: still **fail**, now at both levels (the best path doesn't beat Alonso). It fails
  on the merged code with integration 6's race file too (Era: ★2 ★3 only), so the sourced SC isn't
  the only cause; giving it a second SC call (sc-29, sc-30 or sc-31 as well as sc-28) didn't make
  it reachable either. Content to re-author (owner).
- great-britain-1987, portugal-1984, belgium-1995, brazil-2019, hungary-2019, hungary-1992 and
  mexico-1990 fail as on the W1 branch (causes in docs/eras-grader.md and the last report).

Owner decisions carried from the W1 branch's report: austria-2002's takeover stays at lap 26.
From lap 21 the grader now prices the lap-24 SC call right (stay out runs dry on lap 27 and
grades red; box with the real fill grades best), and with a lap-24 stop moment and a two-stop
mastery both levels pass, but the hard-call counter from lap 21 gives MSCM 1, BAR 0, which would
move the Eras side to Schumacher. The stored `hardCalls` were counted with the old grader;
europe-1993's from W1's rebuilt file with the new one is SENA 2, HIL 2 (the gave-up rule would
pick HIL): not changed, owner to confirm.

## Not built

- **china-2007** (Era 5): the user's car, Hamilton, isn't in the race model. He ran only wet
  laps (retired on lap 31), so `build.dry_fit` has no dry pace for him and `assemble` drops him.
  Needs a pace for a car with only wet laps (gap 'dropped cars').
- **brazil-1993** (Era 2): registered with `data_issue`, raw reconstruction only. Anchors pass
  (108/108 with W2's lap leaders), but no source gives the field's slick stops (laps 40-43), so
  the synthetic race isn't the real one. Needs the slick stops sourced, or a solver rule for
  unsourced tyre changes.

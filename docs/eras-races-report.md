# Eras races report

Eras build plan steps 3.2 and 5.2, Nov 8 2026 (integration 6). One row per race of the 100 in
data/pools.json's `eras` block, in the spec's §4 order (Era 10, play order 1, first). Written
from a fresh build of every non-pool race on the merged code (the model fixes M1 driver damp /
wet pace, M2 pace by stint, M3 the pooled overtake model and M4 scripted events, with the
authored Eras overlays of A1-A4) and a fresh robust G1 run of every built race (`pipeline
validate`'s robust mode: 1,000 runs on each of two seed sets, one race per call; pass = both
sets pass, borderline = one). Diagnoses are kept from the last report where the race's status
and error held (within 1 s), otherwise from `diagnose.py` on this run and the model fix notes
in docs/g1-report.md.

**SC restart switch (`restart.IN_ERAS_BUILDS`, M4): off.** Robust G1 was run with it on and off
over every timed non-pool Eras race (71): on, 16 pass, total mean gap error 354.43 s; off, 17
pass, 346.52 s (germany-2018 passes only with it off). The 22 reconstructed races' anchors don't
move with it (their G1 sanity: 13 pass, 46.09 s on; 13 pass, 44.96 s off). The race files are
built with it off (no `track.restart`).

- **Data source**: where the laps come from. Jolpica races before 2011 take their stops from F1DB.
  Reconstructed races (1983-1995) have no lap timing: their laps are solved to the anchors.
- **Estimated**: the race file's `provenance.estimated` (fields the build estimated, not read).
- **Check**: G1 for races with real lap timing; for reconstructed races the core anchors
  (`reconstruct.failures`: grid, order, gaps, fastest laps, retirements, laps down, stops,
  safety cars, tyres) are the pass criterion and G1 is only a sanity check of the replay.
- **Mean gap error / anchors**: G1's mean over the gap checks (both seed sets), or core anchors
  passed / total.
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
| 9 | great-britain-2016 | TUM f1-timing-database | weather | yes | G1 | **fail** | 2.11 s | podium order rate 0.41 / 0.42 [0.50] | Rosberg's gearbox loss (laps 46-47) isn't a sourced fault, so a 1.34 s duel is a coin flip (podium order 0.41); 0.74 -> 2.11 s |
| 10 | abu-dhabi-2016 | TUM f1-timing-database | none | yes | G1 | pass | 0.85 s |  |  |

## Era 6: Fast-wearing tyres (2010–2013)

| # | Race | Data source | Estimated | Built | Check | Result | Mean gap error / anchors | Main failing check | Diagnosis |
|---|---|---|---|---|---|---|---|---|---|
| 1 | australia-2010 | Jolpica laps + F1DB stops | compounds, safetyCars, weather | yes | G1 | **fail** | 4.10 s | field ROS gap error 9.57 / 9.39 [5.00] (+2 more) | the two-stoppers stuck in the one-stop train (ROS 9.6 s); 3.35 -> 4.10 s |
| 2 | abu-dhabi-2010 | Jolpica laps + F1DB stops | compounds, safetyCars | yes | G1 | pass | 1.96 s |  | now passes on the combined fixes (the Petrov train: pooled overtake model, M3) |
| 3 | china-2011 | Jolpica laps | compounds, safetyCars | yes | G1 | pass | 1.44 s |  | now passes on the combined fixes (pooled overtake model, M3; pace by stint, M2) |
| 4 | monaco-2011 | Jolpica laps | compounds, safetyCars | yes | G1 | **fail** | 43.37 s | field HAM gap error 115.8 / 116.01 [5.00] (+4 more) | no unlapping from the sim's own gaps (HAM 116 s a lap down at the red-flag restart); 32.66 -> 43.37 s |
| 5 | canada-2011 | Jolpica laps | compounds, safetyCars, weather | yes | G1 | **fail** | 3.02 s | podium order rate 0.26 / 0.23 [0.50] (+3 more) | lap pace (58%) on the drying track (PET, MAS); the back-to-back stop fix took it from 10.27 to 3.51 s |
| 6 | europe-2012 | Jolpica laps | compounds, safetyCars | yes | G1 | **fail** | 1.94 s | podium MSCM gap error 5.5 / 5.89 [5.00] | **new fail**: MSCM's podium gap 5.5 / 5.9 [5.00]; pace by stint (M2: Räikkönen's last stint in traffic) and the overtake model (M3) move the places behind Alonso |
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
| 1 | germany-2000 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads, weather | yes | G1 | **fail** | 32.31 s | field BUT gap error 83.37 / 83.11 [5.00] (+3 more) | data: both SCs missed by the 2.4 estimate (applied as yellows); BUT 83 s; 36.41 -> 32.31 s. Fix: the owner's SC hand check |
| 2 | japan-2000 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads, weather | yes | G1 | pass | 1.27 s |  | now passes: driver damp / wet pace (M1) |
| 3 | malaysia-2001 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads, weather | yes | G1 | **fail** | 8.35 s | duel MSCM vs BAR gap error 12.02 / 12.01 [3.00] (+5 more) | Ferrari's inters against the field's full wets (the laps can't split them); FIS dropped; 10.22 -> 8.35 s |
| 4 | austria-2002 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | pass | 0.63 s |  | passes; the last-corner swap now plays (M4) |
| 5 | brazil-2003 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads, weather | yes | G1 | **fail** | 5.74 s | duel FIS vs RAI gap error 7.98 / 7.57 [3.00] (+4 more) | Fisichella's last-lap pass isn't modelled; Räikkönen's last-stint offset (M2) takes him further clear; 3.79 -> 5.74 s |
| 6 | hungary-2003 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | **fail** | 7.08 s | field SCH gap error 20.8 / 20.98 [5.00] (+3 more) | Williams' pace by stint, now fitted (M2): SCH 21 s; 10.24 -> 7.08 s |
| 7 | united-states-2003 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads, weather | yes | G1 | **fail** | 4.77 s | field HEI gap error 17.32 / 17.26 [5.64] | Bridgestone wet pace: HEI 17 s; 14.64 -> 4.77 s with driver wet pace (M1) |
| 8 | japan-2003 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | **fail** | 4.05 s | duel MSCM vs RAI gap error 11.68 / 11.77 [3.00] (+1 more) | Schumacher's and Barrichello's stints (MSCM vs RAI 11.7 s); 3.53 -> 4.05 s |
| 9 | france-2004 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | pass | 1.89 s |  | now passes: pace by stint (M2) |
| 10 | monaco-2004 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | **fail** | 3.64 s | podium BAR gap error 7.64 / 7.18 [5.00] (+1 more) | Barrichello's podium gap (7.6 s); Button's last stint now fitted (M2): 5.63 -> 3.64 s |

## Era 3: Refuelling returns (1994–1999)

| # | Race | Data source | Estimated | Built | Check | Result | Mean gap error / anchors | Main failing check | Diagnosis |
|---|---|---|---|---|---|---|---|---|---|
| 1 | spain-1994 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, safetyCars, fuelLoads, weather | yes | anchors | pass | 88/88 core anchors | G1 sanity pass, 0.11 s |  |
| 2 | australia-1994 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, safetyCars, fuelLoads, weather | yes | anchors | pass | 99/99 core anchors | G1 sanity pass, 0.26 s | anchors pass; the collision retires both only on the real calls (M4 storyline retirement: Hill within 2 s) |
| 3 | belgium-1995 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 124/124 core anchors | G1 sanity fail, 2.97 s | anchors pass; G1 sanity: BRU and FRE on estimated stint tyres |
| 4 | spain-1996 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads, weather | yes | G1 | pass | 0.62 s |  | now passes: pace by stint (M2); still wet all race and built dry |
| 5 | hungary-1997 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | **fail** | 2.53 s | field MSCM gap error 10.18 / 10.48 [5.00] (+1 more) | stint pace behind the leaders: MSCM 10 s; 4.15 -> 2.53 s with M2 |
| 6 | europe-1997 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | **fail** | 0.82 s | podium order rate 0.45 / 0.46 [0.50] | the let-bys at the flag scripted (M4: VIL's podium gap passes); podium order 0.45 [0.50], 2.53 -> 0.82 s |
| 7 | hungary-1998 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | pass | 1.58 s |  | now passes on the combined fixes (Schumacher's push fitted, M2; overtaking, M3; no SC, so not the restart switch) |
| 8 | belgium-1998 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads, weather | yes | G1 | **fail** | 14.21 s | duel HIL vs SCH gap error 21.64 / 21.42 [3.00] (+5 more) | driver wet pace (M1) gives Ralf Schumacher his real clear-air wet pace, so the sim's SCH passes Hill; really Jordan held him behind (an order not in data/incidents.json). 4.91 -> 14.21 s |
| 9 | malaysia-1999 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | **fail** | 2.96 s | duel IRV vs HAK gap error 3.62 / 3.87 [3.00] (+1 more) | Ferrari's team orders scripted (M4); the duel IRV vs HAK gap 3.6 / 3.9 [3.00], Irvine's last laps |
| 10 | europe-1999 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads, weather | yes | G1 | **fail** | 23.24 s | podium order rate 0 / 0 [0.50] (+4 more) | estimated MEDIUM labels (gap 11): M1's field reference mixes slicks and rain tyres in the second shower; 15.56 -> 23.24 s |

## Era 2: Senna vs Prost (1989–1993)

| # | Race | Data source | Estimated | Built | Check | Result | Mean gap error / anchors | Main failing check | Diagnosis |
|---|---|---|---|---|---|---|---|---|---|
| 1 | france-1990 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | **fail** | 59/60 core anchors | order anchor; G1 sanity pass, 0.52 s | anchor fail (order): de Cesaris' disqualification puts him in the road order (solver); also a stop is the clear call (one wear rate) |
| 2 | united-states-1990 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 54/54 core anchors | G1 sanity pass, 1.56 s |  |
| 3 | mexico-1990 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 57/57 core anchors | G1 sanity fail, 2.00 s | anchors pass; G1 sanity: race mechanics (pace 32%) |
| 4 | brazil-1991 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 55/55 core anchors | G1 sanity fail, 2.37 s | anchors pass; G1 sanity: synthetic noise (pace 85%) |
| 5 | monaco-1992 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | **fail** | 54/55 core anchors | grid anchor; G1 sanity pass, 1.38 s | anchor fail (grid): Moreno's and Wendlinger's lap 1 pinned by their fastest laps (solver) |
| 6 | belgium-1992 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 104/104 core anchors | G1 sanity fail, 5.18 s | anchors pass; G1 sanity (7.66 -> 5.18 s): dry model fitted on laps 36-44 only; Boutsen leads at the takeover |
| 7 | hungary-1992 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 52/52 core anchors | G1 sanity fail, 2.55 s | anchors pass; G1 sanity: Mansell's fresh-tyre pace |
| 8 | brazil-1993 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather (sidecar) | no: `data_issue`: the synthetic race isn't the real one (no source for the field's slick stops on laps 40-43; Senna P14 at the takeover, can't win with his real calls). Raw reconstruction only; anchors 104/104, G1 sanity 46.25 s | anchors | **not built** |  |  |  |
| 9 | europe-1993 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, safetyCars, fuelLoads, weather | yes | anchors | pass | 97/97 core anchors | G1 sanity pass, 1.16 s | anchors pass; playable, but Senna P12 at the takeover: unsourced stops absorbed into pace; G1 sanity 1.07 -> 1.16 s |
| 10 | australia-1993 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, safetyCars, fuelLoads, weather | yes | anchors | pass | 57/57 core anchors | G1 sanity pass, 0.34 s |  |

## Era 1: Turbo era (1983–1988)

| # | Race | Data source | Estimated | Built | Check | Result | Mean gap error / anchors | Main failing check | Diagnosis |
|---|---|---|---|---|---|---|---|---|---|
| 1 | south-africa-1983 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | **fail** | 54/55 core anchors | grid anchor; G1 sanity fail, 3.93 s | anchor fail (grid): a lap-1 retirement pinned by its fastest lap (solver); G1 sanity: Piquet's only sourced stop |
| 2 | monaco-1984 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 38/38 core anchors | G1 sanity fail, 5.54 s | anchors pass; fuel limit bites in the rain as if dry; G1 sanity: one wear rate for all |
| 3 | portugal-1984 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 56/56 core anchors | G1 sanity fail, 2.49 s | anchors pass; G1 sanity: race mechanics (pace 32%) |
| 4 | germany-1986 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 60/60 core anchors | G1 sanity pass, 1.03 s | anchors pass; Rosberg runs to the last lap 2.0 s behind Piquet (M4 lastLapStops) and his out-of-fuel stop is left to the fuel model |
| 5 | portugal-1985 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 55/55 core anchors | G1 sanity pass, 0.29 s | anchors pass; fuel limit bites in the rain as if dry |
| 6 | mexico-1986 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 51/51 core anchors | G1 sanity pass, 2.47 s |  |
| 7 | hungary-1986 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 62/62 core anchors | G1 sanity pass, 0.03 s |  |
| 8 | australia-1986 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 54/54 core anchors | G1 sanity pass, 0.78 s | anchors pass; Mansell's tyre failure comes only on the real no-stop (M4 storyline retirement) |
| 9 | great-britain-1987 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 53/53 core anchors | G1 sanity pass, 1.07 s | anchors pass; now played from Piquet (A4) |
| 10 | monaco-1988 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 51/51 core anchors | G1 sanity fail, 6.92 s | anchors pass; Senna's crash comes only on the real push from lap 55 (M4); G1 sanity BER, ALBM |

## Summary

**Result: 41 pass, 0 borderline, 57 fail, 2 not built** (of 100; 22 reconstructed races checked on their anchors, 76 on G1). Last report: 35 pass, 0 borderline, 63 fail, 2 not built.

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

## Model gaps, ranked

By the number of failing races each one explains (a race can have more than one), then by the
races it blocks from being played as authored (those pass their check but can't be won, or
aren't built). Resolved since the last report: the two-compound sim bug on a takeover on
intermediates (e3d8d2c, before this integration: the real calls of united-states-2015,
great-britain-2016 and monaco-2008 are legal again), and frozen storyline retirements (M4: the
player's car retires only on the real call at australia-1994, germany-1986, australia-1986 and
monaco-1988).

1. **Weak overtaking: cars stuck in trains, a faster car can't pass, Monaco queues (after M3's pooled overtake model).** 15 failing: singapore-2023, monaco-2025, spain-2021, brazil-2021, monaco-2017, italy-2020, bahrain-2014, monaco-2015, hungary-2015, australia-2010, abu-dhabi-2012, brazil-2006, brazil-2007, brazil-2008, spain-2013.
2. **Driver damp / wet pace (after M1: clear-air laps against the field, two track states, the full-wets shift): few clear-air laps (Monaco), tyre labels that mix slicks and rain tyres, rain with no weather data.** 13 failing: monaco-2022, netherlands-2023, australia-2025, monaco-2016, canada-2011, brazil-2012, hungary-2006, europe-2007, monaco-2008, malaysia-2001, united-states-2003, belgium-1998, europe-1999.
3. **Stint-to-stint pace (after M2's per-stint offsets for scripted cars): a stint run in traffic gets no offset, a last-lap pass or mistake isn't in the offsets, an offset that moves the cars around a near-tie.** 11 failing: hungary-2021, japan-2005, brazil-2009, brazil-2003, hungary-2003, japan-2003, monaco-2004, hungary-1997, europe-1997, brazil-2019, europe-2012.
4. **SC / red-flag restart mechanics (late-SC sprints, restart order, the fitted SC queue's stop costs). M4's restart jump and spread is built but off: it moved G1 both ways and cost a pass overall.** 9 failing: great-britain-2022, miami-2024, azerbaijan-2021, saudi-arabia-2021, azerbaijan-2017, italy-2020, sakhir-2020, bahrain-2014, monaco-2015.
5. **Team orders and let-bys: scripted since M4 (TEAM_ORDER facts), but the sim's cars around the swap don't end where the real ones did; an order not in data/incidents.json (Jordan at Spa 1998) isn't played.** 5 failing: hungary-2024, russia-2018, europe-1997, malaysia-1999, belgium-1998.
6. **Unsourced one-off losses and car problems (not in data/incidents.json, or a fault's constant loss).** 3 failing: canada-2014, united-states-2015, great-britain-2016.
7. **Reconstruction solver anchor conflicts (lap-1 grid vs fastest-lap-pinned retirements; disqualified cars in the road order).** 3 failing: france-1990, monaco-1992, south-africa-1983.
8. **Dropped cars with no dry laps (a car that ran only wet laps has no pace fit).** 2 failing: hungary-2006, malaysia-2001; 1 blocked in play or not built: china-2007 (not built).
9. **SC estimate misses (step 2.4: an SC applied as yellows, or a lap late).** 2 failing: germany-2000, belgium-1998.
10. **Estimated dry compounds (step 2.4's SOFT/HARD split, or dry labels on wet stints).** 2 failing: brazil-2008, europe-1999.
11. **Tyre wear on long stints (flat HARD wear, last-stint wear).** 2 failing: hungary-2014, monaco-2011.
12. **No unlapping decided from the sim's own gaps (a car the sim has a lap down stays there).** 1 failing: monaco-2011.
13. **Unsourced tyre changes in reconstructed races (the running order isn't the real one).** 2 blocked in play or not built: brazil-1993 (not built), europe-1993.
14. **Fuel limit bites in the rain as if dry (the takeover margin is drawn for a dry burn).** 2 blocked in play or not built: monaco-1984, portugal-1985.

## Since the last report

Status changes against the integration 5 report (eras branch, 0cc2bcb). Before = that report's
number; after = this run (restart switch off).

| Race | Era | Before | After | Why |
|---|---|---|---|---|
| belgium-2023 | 10 | fail, 4.80 s | **pass**, 1.73 s | M1: VER's wet pace from clear-air laps against the field (his damp opening laps in traffic left out) |
| brazil-2019 | 8 | pass, 1.77 s | **fail**, 1.97 s | now played from Hamilton (A1); the 0.06 s GAS-HAM finish moves with M2 (Gasly's last stint) and M3 (Hamilton's late charge passes less) |
| turkey-2020 | 8 | fail, 3.25 s | **pass**, 1.76 s | combined fixes (M1's field reference and M2's offsets on the dry-labelled stints) |
| abu-dhabi-2010 | 6 | fail, 2.93 s | **pass**, 1.96 s | M3: ROS and KUB in the Petrov train (the pooled overtake model) |
| china-2011 | 6 | fail, 3.07 s | **pass**, 1.44 s | M3 with M2: the HAM vs VET gap and order |
| europe-2012 | 6 | pass, 1.44 s | **fail**, 1.94 s | MSCM's podium gap 5.5 / 5.9 [5.00]: M2 (Räikkönen's last stint in traffic gets no offset) and M3 |
| spain-2013 | 6 | pass, 1.71 s | **fail**, 1.51 s | duel ALO vs RAI 3.08 / 3.16 [3.00], just over, on the combined fixes |
| san-marino-2005 | 5 | fail, 6.25 s | **pass**, 1.70 s | M2: Schumacher's middle stint and Alonso's last; M3: Schumacher still can't pass |
| japan-2000 | 4 | fail, 4.51 s | **pass**, 1.27 s | M1: Coulthard's and Button's drizzle pace by track state |
| france-2004 | 4 | fail, 2.69 s | **pass**, 1.89 s | M2: the four-stop sprint's stints |
| spain-1996 | 3 | fail, 7.55 s | **pass**, 0.62 s | M2: Schumacher's pace by stint |
| hungary-1998 | 3 | fail, 1.66 s | **pass**, 1.58 s | M2: Schumacher's 19-lap push and eased last stint; with M3 he no longer clears Coulthard too often |

Every other race keeps its status. Largest error moves among them: united-states-2003 14.64 ->
4.77 s, saudi-arabia-2021 13.96 -> 8.57 s, hungary-2006 22.00 -> 15.15 s, canada-2014 6.53 ->
2.99 s, hungary-2003 10.24 -> 7.08 s (better); belgium-1998 4.91 -> 14.21 s, europe-1999 15.56
-> 23.24 s, monaco-2011 32.66 -> 43.37 s, monaco-2022 4.93 -> 7.49 s, netherlands-2023 3.79 ->
6.69 s, monaco-2016 8.15 -> 10.79 s (worse; diagnoses in the tables). germany-2018 passes only
with the restart switch off (1.88 s and a fail with it on).

## The SC restart switch (M4), on and off

Robust G1 on both settings for every non-pool Eras race (G1 sanity for the reconstructed ones; the switch only changes Eras
builds, never a pool race). Races that moved by 0.005 s or more:

| Race | On | Off |
|---|---|---|
| monaco-2022 | fail, 7.26 s | fail, 7.49 s |
| great-britain-2022 | fail, 2.27 s | fail, 2.03 s |
| singapore-2023 | fail, 4.50 s | fail, 4.01 s |
| netherlands-2023 | fail, 6.05 s | fail, 6.69 s |
| miami-2024 | fail, 4.94 s | fail, 4.71 s |
| australia-2025 | fail, 5.30 s | fail, 3.66 s |
| azerbaijan-2021 | fail, 2.74 s | fail, 2.90 s |
| monaco-2017 | fail, 3.45 s | fail, 2.98 s |
| germany-2018 | fail, 1.88 s | pass, 1.59 s |
| germany-2019 | pass, 0.94 s | pass, 1.38 s |
| brazil-2019 | fail, 2.08 s | fail, 1.97 s |
| italy-2020 | fail, 2.40 s | fail, 2.23 s |
| sakhir-2020 | fail, 3.73 s | fail, 2.51 s |
| bahrain-2014 | fail, 1.58 s | fail, 1.17 s |
| hungary-2014 | fail, 2.92 s | fail, 2.73 s |
| monaco-2015 | fail, 4.33 s | fail, 4.71 s |
| hungary-2015 | fail, 7.23 s | fail, 6.90 s |
| united-states-2015 | fail, 2.17 s | fail, 2.31 s |
| monaco-2011 | fail, 43.98 s | fail, 43.37 s |
| canada-2011 | fail, 3.52 s | fail, 3.02 s |
| europe-2012 | fail, 2.99 s | fail, 1.94 s |
| abu-dhabi-2012 | fail, 2.56 s | fail, 1.72 s |
| brazil-2012 | fail, 3.45 s | fail, 3.44 s |
| hungary-2006 | fail, 15.30 s | fail, 15.15 s |
| monaco-2008 | fail, 4.25 s | fail, 4.53 s |
| austria-2002 | pass, 0.60 s | pass, 0.63 s |
| brazil-2003 | fail, 6.66 s | fail, 5.74 s |
| monaco-2004 | fail, 3.48 s | fail, 3.64 s |
| belgium-1995 | fail, 4.10 s | fail, 2.97 s |
| belgium-1998 | fail, 14.72 s | fail, 14.21 s |

**Timed races (71): on 16 pass, 354.43 s total mean gap error; off 17 pass, 346.52 s.** The
reconstructed races' anchors don't depend on it (G1 sanity on 13 pass / 46.09 s, off 13 / 44.96
s). Left off (`restart.IN_ERAS_BUILDS = False`); the race files are built without `track.restart`.

## Reachability (eras spec §15)

`pnpm --filter @laststint/sim reachability <id>` for each of the 30 race files with an `eras`
block, one race per call, and `pnpm --filter @laststint/worker reachability:shared` (new: the
five shared races on the merged model the Eras API serves, their race file with its overlay).
A1's ten Eras 10-8 races are all here: five in the 30 (hungary-2022, turkey-2021,
germany-2018, germany-2019, brazil-2019) and the five shared races.

| Race | Era difficulty | Legend | Result |
|---|---|---|---|
| abu-dhabi-2016 | reachable | reachable | pass |
| abu-dhabi-2021 | reachable | reachable | pass |
| australia-1986 | reachable | reachable | pass |
| australia-1993 | reachable | reachable | pass |
| australia-1994 | NOT reachable | NOT reachable | **fail** |
| austria-2002 | reachable | reachable | pass |
| bahrain-2021 | reachable | reachable | pass |
| belgium-1992 | reachable | reachable | pass |
| belgium-1995 | reachable | reachable | pass |
| brazil-1991 | reachable | reachable | pass |
| brazil-2019 | reachable | reachable | pass |
| europe-1993 | reachable | reachable | pass |
| europe-2012 | reachable | NOT reachable | **fail** |
| france-2021 | reachable | reachable | pass |
| germany-1986 | reachable | reachable | pass |
| germany-2018 | reachable | reachable | pass |
| germany-2019 | reachable | reachable | pass |
| great-britain-1987 | reachable | reachable | pass |
| hungary-1986 | reachable | reachable | pass |
| hungary-1992 | NOT reachable | NOT reachable | **fail** |
| hungary-2019 | reachable | reachable | pass |
| hungary-2022 | reachable | reachable | pass |
| malaysia-2013 | reachable | reachable | pass |
| mexico-1986 | reachable | reachable | pass |
| mexico-1990 | error: no decision moments | - | **fail** |
| monaco-1984 | reachable | reachable | pass |
| monaco-1988 | reachable | reachable | pass |
| portugal-1984 | reachable | reachable | pass |
| portugal-1985 | reachable | reachable | pass |
| russia-2021 | reachable | reachable | pass |
| spain-1994 | reachable | reachable | pass |
| spain-2013 | reachable | reachable | pass |
| spain-2016 | reachable | reachable | pass |
| turkey-2021 | reachable | reachable | pass |
| united-states-1990 | reachable | reachable | pass |

**31 pass, 4 fail of 35** (shared: 5 of 5 pass). Stay-out never earns ★3.

- **australia-1994**: not reachable at either level (best ★2 only). The collision is now
  avoidable (M4), but no searched path beats Hill: the reconstruction has Hill ahead of
  Schumacher until about lap 33 (really Schumacher led throughout). Was failing on the frozen
  retirement (6.2-eras3-2).
- **europe-2012**: reachable at era difficulty, not at Legend (the best Legend path takes ★1-★3
  but not the hidden objective). Passed in 6.2-eras7-4; the merged model fixes (M2, M3) move
  the race (it also fails G1 now).
- **hungary-1992** (the grader rates staying out above the real stop) and **mexico-1990** (no
  decision moments): failing as authored in 6.2-eras3-2, unchanged.
- germany-1986, australia-1986 and monaco-1988 failed in 6.2-era1 on their frozen storyline
  retirements and now pass (M4).

## Not built

- **china-2007** (Era 5): the user's car, Hamilton, isn't in the race model. He ran only wet
  laps (retired on lap 31), so `build.dry_fit` has no dry pace for him and `assemble` drops him.
  Needs a pace for a car with only wet laps (gap 'dropped cars').
- **brazil-1993** (Era 2): registered with `data_issue`, raw reconstruction only. Anchors pass
  (104/104), but no source gives the field's slick stops (laps 40-43), so the synthetic race
  isn't the real one (Senna P14 at the takeover). Needs the slick stops sourced, or a solver
  rule for unsourced tyre changes.

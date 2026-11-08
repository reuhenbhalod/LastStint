# Eras races report

Eras build plan steps 3.2 and 5.2, Nov 8 2026 (integration 5). One row per race of the 100 in
data/pools.json's `eras` block, in the spec's §4 order (Era 10, play order 1, first). Written
from a fresh build of every race on the merged code (eras-sim-fixes-2, eras-5.6-swap-builds,
eras-5.5-wet-recon and the two stop-loss fixes of this integration) and a fresh robust G1 run of
every built race (`pipeline validate`'s robust mode: 1,000 runs on each of two seed sets, one race
per call; pass = both sets pass, borderline = one). Diagnoses are from docs/g1-report.md where
they still apply, otherwise from `diagnose.py` on this run.

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
| 1 | monaco-2022 | Jolpica laps | compounds, safetyCars, weather | yes | G1 | **fail** | 4.93 s | field RUS gap error 13.4 / 13.78 [5.00] (+3 more) | lap pace on the drying track (pace 59%); RUS's error grew with sim fixes 2 (the lap-31 stoppage stops now free, the fitted SC queue) |
| 2 | great-britain-2022 | Jolpica laps | compounds, safetyCars | yes | G1 | **fail** | 2.96 s | duel LEC vs SAI gap error 5.83 / 5.87 [3.00] (+3 more) | race mechanics: the 10-lap sprint after the late SC (pace 2%) |
| 3 | hungary-2022 | FastF1 (F1 live timing) | none | yes | G1 | pass | 1.40 s |  |  |
| 4 | singapore-2023 | FastF1 (F1 live timing) | none | yes | G1 | **fail** | 3.76 s | field GAS gap error 9.92 / 9.9 [5.00] (+1 more) | race mechanics (pace 4%): the NOR vs SAI gap, GAS 9.9 s |
| 5 | netherlands-2023 | OpenF1 | none | yes | G1 | **fail** | 3.79 s | field HAM gap error 11.49 / 11.52 [5.00] (+3 more) | lap pace (62%): rain at the start and the finish, driver wet pace |
| 6 | miami-2024 | FastF1 (F1 live timing) | none | yes | G1 | **fail** | 4.74 s | duel VER vs NOR gap error 5.79 / 5.5 [3.00] (+6 more) | race mechanics (pace 3%): the SC that timed Norris' stop (spec §4); rebuilt with the Eras fixes (2.88 s before) |
| 7 | hungary-2024 | FastF1 (F1 live timing) | none | yes | G1 | **fail** | 2.32 s | field SAI gap error 5.1 / - [5.00] (+2 more) | race mechanics: McLaren's team-order swap isn't modelled (pace 1%) |
| 8 | belgium-2023 | OpenF1 | none | yes | G1 | **fail** | 4.80 s | duel VER vs PER gap error 5.91 / 5.84 [3.00] (+3 more) | wet pace fit: `wet.driver_wet_pace` counts the drying opening laps, so VER's edge over PER in the shower is reversed |
| 9 | australia-2025 | OpenF1 | none | yes | G1 | **fail** | 4.62 s | field ANT gap error 9.07 / 9.46 [5.00] (+2 more) | lap pace (69%): wet-dry race, damp pace by driver (ANT 9 s) |
| 10 | monaco-2025 | OpenF1 | none | yes | G1 | **fail** | 2.63 s | field HAM gap error 10.82 / 10.94 [5.14] (+2 more) | race mechanics: Hamilton 10.8 s in the Monaco queue of the mandatory two-stop |

## Era 9: The 2021 title fight

| # | Race | Data source | Estimated | Built | Check | Result | Mean gap error / anchors | Main failing check | Diagnosis |
|---|---|---|---|---|---|---|---|---|---|
| 1 | bahrain-2021 | FastF1 (F1 live timing) | none | yes | G1 | pass | 0.66 s |  | passes; strict status fails only on a near-tie |
| 2 | spain-2021 | FastF1 (F1 live timing) | none | yes | G1 | **fail** | 5.90 s | duel VER vs HAM gap error 6.95 / 6.96 [3.00] (+4 more) | race mechanics (pace 1%): VER 7 s, BOT, PER, RIC |
| 3 | azerbaijan-2021 | Jolpica laps | compounds, safetyCars | yes | G1 | **fail** | 2.66 s | field ALO gap error 7.38 / 7.38 [5.00] | race mechanics: Alonso's red-flag restart and a recorded pit-lane pass |
| 4 | france-2021 | FastF1 (F1 live timing) | none | yes | G1 | pass | 3.01 s |  |  |
| 5 | hungary-2021 | FastF1 (F1 live timing) | weather | yes | G1 | **fail** | 5.74 s | podium HAM gap error 11.76 / 11.61 [5.00] (+4 more) | race mechanics: Hamilton's charge on hards after the wet start (pace 4%) |
| 6 | russia-2021 | FastF1 (F1 live timing) | none | yes | G1 | pass | 2.89 s |  |  |
| 7 | turkey-2021 | Jolpica laps | compounds, safetyCars, weather | yes | G1 | pass | 1.94 s |  |  |
| 8 | brazil-2021 | FastF1 (F1 live timing) | none | yes | G1 | **fail** | 1.82 s | duel VER vs HAM gap error 3.12 / - [3.00] (+1 more) | race mechanics: Hamilton's pass on Verstappen (duel gap 3.12, just over) |
| 9 | saudi-arabia-2021 | Jolpica laps | compounds, safetyCars | yes | G1 | **fail** | 13.96 s | podium BOT gap error 31.12 / 30.69 [5.00] (+4 more) | race mechanics: two red flags and their restarts (BOT 31 s, GAS 27 s); pit loss fixed by the guard (48.9 -> 23.9 s) |
| 10 | abu-dhabi-2021 | FastF1 (F1 live timing) | none | yes | G1 | pass | 2.27 s |  |  |

## Era 8: Mercedes vs Ferrari (2017–2020)

| # | Race | Data source | Estimated | Built | Check | Result | Mean gap error / anchors | Main failing check | Diagnosis |
|---|---|---|---|---|---|---|---|---|---|
| 1 | monaco-2017 | TUM f1-timing-database | none | yes | G1 | **fail** | 3.19 s | field BOT gap error 6.19 / 6.37 [5.00] | race mechanics (pace 5%): Bottas in Monaco traffic |
| 2 | azerbaijan-2017 | TUM f1-timing-database | none | yes | G1 | **fail** | 6.86 s | podium STR gap error 12.66 / 12.64 [5.00] (+7 more) | race mechanics: red flag and SC restarts (STR 12.7 s, VET 10.1 s) |
| 3 | germany-2018 | TUM f1-timing-database | weather | yes | G1 | pass | 0.94 s |  | now passes (sim fixes 2) |
| 4 | russia-2018 | TUM f1-timing-database | none | yes | G1 | **fail** | 1.74 s | duel BOT vs HAM order rate 0.55 / 0.55 [0.60] (+1 more) | Mercedes' team-order swap (lap 25) after the D3 takeover |
| 5 | germany-2019 | TUM f1-timing-database | weather | yes | G1 | pass | 1.60 s |  |  |
| 6 | hungary-2019 | FastF1 (F1 live timing) | none | yes | G1 | pass | 0.96 s |  |  |
| 7 | brazil-2019 | TUM f1-timing-database | none | yes | G1 | pass | 1.77 s |  | passes; strict status fails on GAS vs HAM (0.06 s apart, near-tie) |
| 8 | italy-2020 | Jolpica laps | compounds, safetyCars | yes | G1 | **fail** | 3.69 s | duel GAS vs SAI gap error 6.07 / 5.98 [3.00] (+2 more) | race mechanics: the red-flag restart and Gasly holding Sainz off (pace 1%) |
| 9 | turkey-2020 | Jolpica laps | compounds, safetyCars, weather | yes | G1 | **fail** | 3.25 s | field SAI gap error 7.11 / 6.99 [5.00] (+2 more) | data: wet throughout, but the fit calls it dry from lap 18, so later stints take 2.4's dry labels |
| 10 | sakhir-2020 | Jolpica laps | compounds, safetyCars | yes | G1 | **fail** | 1.30 s | duel RUS vs PER gap error 5.31 / 5.16 [3.00] | duel RUS vs PER 5.3 s: the fitted SC queue changes what the SC stops cost (sim fixes 2; was a pass) |

## Era 7: Hybrid turbo (2014–2016)

| # | Race | Data source | Estimated | Built | Check | Result | Mean gap error / anchors | Main failing check | Diagnosis |
|---|---|---|---|---|---|---|---|---|---|
| 1 | bahrain-2014 | TUM f1-timing-database | none | yes | G1 | **fail** | 2.16 s | field HUL gap error 5.63 / 5.69 [5.00] (+2 more) | race mechanics: the late-SC fight between HAM and ROS (order 0.40) |
| 2 | canada-2014 | TUM f1-timing-database | none | yes | G1 | **fail** | 6.53 s | duel ROS vs RIC gap error 15.06 / 15.17 [3.00] (+5 more) | lap pace (61%): the field's pace before the faults, and the faults' constant loss |
| 3 | hungary-2014 | TUM f1-timing-database | weather | yes | G1 | **fail** | 4.15 s | field ROS gap error 7.64 / 8.42 [5.00] (+3 more) | tyre wear on long last stints (pace model) |
| 4 | monaco-2015 | TUM f1-timing-database | none | yes | G1 | **fail** | 4.52 s | duel HAM vs ROS gap error 4.67 / 4.54 [3.00] (+4 more) | race mechanics (pace 4%): the SC and Monaco traffic (KVY, RIC, RAI) |
| 5 | hungary-2015 | TUM f1-timing-database | none | yes | G1 | **fail** | 5.76 s | field ALO gap error 22.3 / 22.12 [5.00] (+1 more) | race mechanics (rest 100%): ALO 22 s, VET vs KVY; the stops with no tyre change are now priced (10.37 -> 5.76 s) |
| 6 | united-states-2015 | TUM f1-timing-database | weather | yes | G1 | **fail** | 3.30 s | duel HAM vs ROS gap error 4.33 / 4.59 [3.00] (+4 more) | Rosberg's one-lap loss on lap 48, which decides the duel, isn't modelled; real calls also hit the two-compound sim bug |
| 7 | spain-2016 | TUM f1-timing-database | none | yes | G1 | pass | 0.43 s |  |  |
| 8 | monaco-2016 | TUM f1-timing-database | none | yes | G1 | **fail** | 8.15 s | field VET gap error 17.28 / 16.9 [5.00] (+5 more) | a wet race with no rain data (pace 37%) |
| 9 | great-britain-2016 | TUM f1-timing-database | weather | yes | G1 | **fail** | 0.74 s | podium order rate 0.44 / 0.48 [0.50] (+1 more) | Rosberg's gearbox loss (laps 46-47) isn't a sourced fault, so a 1.34 s duel is a coin flip; real calls hit the two-compound sim bug |
| 10 | abu-dhabi-2016 | TUM f1-timing-database | none | yes | G1 | pass | 1.75 s |  |  |

## Era 6: Fast-wearing tyres (2010–2013)

| # | Race | Data source | Estimated | Built | Check | Result | Mean gap error / anchors | Main failing check | Diagnosis |
|---|---|---|---|---|---|---|---|---|---|
| 1 | australia-2010 | Jolpica laps + F1DB stops | compounds, safetyCars, weather | yes | G1 | **fail** | 3.35 s | field ROS gap error 11.44 / 11.03 [5.00] (+1 more) | race mechanics: the two-stoppers stuck in the one-stop train (ROS 11 s) |
| 2 | abu-dhabi-2010 | Jolpica laps + F1DB stops | compounds, safetyCars | yes | G1 | **fail** | 2.93 s | field KUB gap error 7.28 / 7.18 [5.00] (+1 more) | race mechanics: ROS and KUB in the Petrov train |
| 3 | china-2011 | Jolpica laps | compounds, safetyCars | yes | G1 | **fail** | 3.07 s | duel HAM vs VET gap error 4.34 / 4.42 [3.00] (+3 more) | race mechanics (pace 2%): the HAM vs VET gap and order, MAS |
| 4 | monaco-2011 | Jolpica laps | compounds, safetyCars | yes | G1 | **fail** | 32.66 s | field HAM gap error 76.19 / 77.15 [5.00] (+7 more) | no unlapping decided from the sim's own gaps: BUT's flat HARD wear puts HAM, KOB and WEB a lap down at the red-flag restart |
| 5 | canada-2011 | Jolpica laps | compounds, safetyCars, weather | yes | G1 | **fail** | 3.51 s | field PET gap error 7.74 / 6.99 [5.00] (+3 more) | lap pace (58%) on the drying track (PET, MAS); the back-to-back stop fix took it from 10.27 to 3.51 s |
| 6 | europe-2012 | Jolpica laps | compounds, safetyCars | yes | G1 | pass | 1.44 s |  |  |
| 7 | abu-dhabi-2012 | Jolpica laps | compounds, safetyCars | yes | G1 | **fail** | 2.89 s | duel VET vs BUT gap error 3.78 / 3.63 [3.00] (+1 more) | race mechanics (pace 5%): the VET vs BUT gap and order |
| 8 | brazil-2012 | Jolpica laps | compounds, safetyCars, weather | yes | G1 | **fail** | 3.34 s | duel VET vs ALO gap error 4.85 / 4.89 [3.00] (+1 more) | Vettel's last wet stint (pace 49%) |
| 9 | malaysia-2013 | Jolpica laps | compounds, safetyCars, weather | yes | G1 | pass | 0.86 s |  |  |
| 10 | spain-2013 | Jolpica laps | compounds, safetyCars | yes | G1 | pass | 1.71 s |  |  |

## Era 5: Alonso, Räikkönen, Hamilton (2005–2009)

| # | Race | Data source | Estimated | Built | Check | Result | Mean gap error / anchors | Main failing check | Diagnosis |
|---|---|---|---|---|---|---|---|---|---|
| 1 | san-marino-2005 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | **fail** | 6.25 s | duel ALO vs MSCM gap error 11.47 / 11.48 [3.00] (+5 more) | Schumacher's middle stint and Alonso's last (pace 41%); Schumacher can't pass |
| 2 | japan-2005 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | **fail** | 6.18 s | duel RAI vs FIS gap error 10.12 / 10.11 [3.00] (+6 more) | Räikkönen's last stint (pace 9%, rest 91%) |
| 3 | hungary-2006 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads, weather | yes | G1 | **fail** | 22.00 s | duel BUT vs DLR gap error 40.81 / 40.21 [3.00] (+5 more) | Button's inter pace, de la Rosa's dry-labelled wet stint (pace 54%); RAI and LIU dropped (wet laps only) |
| 4 | brazil-2006 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | **fail** | 8.23 s | duel ALO vs MSCM gap error 21.01 / 20.94 [3.00] (+2 more) | race mechanics: Schumacher can't pass (pace 1%) |
| 5 | china-2007 | Jolpica laps + F1DB stops | none | no: user's car (HAM) isn't in the model: he ran only wet laps, so `build.dry_fit` has no dry pace for him and `assemble` drops him | G1 | **not built** |  |  |  |
| 6 | europe-2007 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads, weather | yes | G1 | **fail** | 4.93 s | duel ALO vs MAS gap error 10.27 / 10.12 [3.00] (+4 more) | pace in the late rain (pace 37%) |
| 7 | brazil-2007 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | **fail** | 2.24 s | field ROS gap error 7.42 / 7.39 [6.28] (+1 more) | race mechanics: the second-stop swap and Rosberg's train |
| 8 | monaco-2008 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads, weather | yes | G1 | **fail** | 3.28 s | duel HAM vs KUB gap error 4.93 / 4.79 [3.00] (+2 more) | the long stints on old inters (pace 49%); real calls hit the two-compound sim bug |
| 9 | brazil-2008 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads, weather | yes | G1 | **fail** | 7.26 s | field GLO gap error 26.21 / 25.4 [5.00] (+3 more) | 2.4's estimated SOFT/HARD split and Trulli's train (rest 78%) |
| 10 | brazil-2009 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | **fail** | 4.50 s | duel BUT vs BAR gap error 5.16 / 5.13 [3.00] (+2 more) | race mechanics: Webber's last stint (pace 1%) |

## Era 4: Ferrari dynasty (2000–2004)

| # | Race | Data source | Estimated | Built | Check | Result | Mean gap error / anchors | Main failing check | Diagnosis |
|---|---|---|---|---|---|---|---|---|---|
| 1 | germany-2000 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads, weather | yes | G1 | **fail** | 36.41 s | field BUT gap error 101.19 / 101.11 [5.00] (+7 more) | data: both SCs missed by the 2.4 estimate; their laps (27-28, 30-31) are partly yellow, so the stops on them are now priced in the sim frame with the real SC bunching in them (20.64 -> 36.41 s). Fix: the owner's SC hand check |
| 2 | japan-2000 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads, weather | yes | G1 | **fail** | 4.51 s | podium COU gap error 16.21 / 16.2 [5.00] (+1 more) | lap pace (80%): Coulthard and Button in the drizzle on the ambiguous laps |
| 3 | malaysia-2001 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads, weather | yes | G1 | **fail** | 10.22 s | duel MSCM vs BAR gap error 15.56 / 15.61 [3.00] (+5 more) | lap pace (54%): Ferrari's inters against the field's full wets; FIS dropped (wet laps only) |
| 4 | austria-2002 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | pass | 0.98 s |  | passes; strict fails on Barrichello's let-by at the line (team orders, near-tie). Takeover pinned to lap 26 in step 6.2 (was 1.54 s from lap 21) |
| 5 | brazil-2003 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads, weather | yes | G1 | **fail** | 3.79 s | duel FIS vs RAI gap error 4.36 / 3.76 [3.00] (+3 more) | race mechanics: Fisichella's last-lap pass and the field's late pace |
| 6 | hungary-2003 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | **fail** | 10.24 s | field SCH gap error 27.2 / 27.59 [5.00] (+3 more) | race mechanics: Williams' pace by stint (pace 0%, rest 100%) |
| 7 | united-states-2003 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads, weather | yes | G1 | **fail** | 14.64 s | duel MSCM vs RAI gap error 25.37 / 25.3 [3.00] (+5 more) | Bridgestone wet pace (pace 87%); both stop fixes took it from 48.32 to 14.64 s |
| 8 | japan-2003 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | **fail** | 3.53 s | duel MSCM vs RAI gap error 9.89 / 9.23 [3.00] (+2 more) | Schumacher's and Barrichello's stints (pace 27%) |
| 9 | france-2004 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | **fail** | 2.69 s | duel MSCM vs ALO gap error 4.06 / 3.85 [3.00] (+1 more) | race mechanics: the four-stop sprint (pace 2%) |
| 10 | monaco-2004 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | **fail** | 5.63 s | duel TRU vs BUT gap error 6.7 / 6.74 [3.00] (+2 more) | race mechanics: Button's last stint (pace 1%) |

## Era 3: Refuelling returns (1994–1999)

| # | Race | Data source | Estimated | Built | Check | Result | Mean gap error / anchors | Main failing check | Diagnosis |
|---|---|---|---|---|---|---|---|---|---|
| 1 | spain-1994 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, safetyCars, fuelLoads, weather | yes | anchors | pass | 88/88 core anchors | G1 sanity pass, 0.11 s |  |
| 2 | australia-1994 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, safetyCars, fuelLoads, weather | yes | anchors | pass | 99/99 core anchors | G1 sanity pass, 0.26 s | anchors pass; **not winnable as authored**: the Schumacher-Hill collision frozen (both retire) |
| 3 | belgium-1995 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 124/124 core anchors | G1 sanity fail, 2.97 s | anchors pass; G1 sanity: BRU and FRE on estimated stint tyres |
| 4 | spain-1996 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads, weather | yes | G1 | **fail** | 7.55 s | duel MSCM vs ALE gap error 9.96 / 9.92 [3.00] (+2 more) | data: wet all race, built dry (no dry laps for wet-laps); then Schumacher's pace by stint |
| 5 | hungary-1997 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | **fail** | 4.15 s | field MSCM gap error 9.4 / 9.74 [5.00] (+2 more) | stint pace behind the leaders (pace 50%) |
| 6 | europe-1997 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | **fail** | 2.53 s | podium VIL gap error 9.4 / 9.39 [5.00] (+1 more) | Villeneuve's last stint and the let-by at the flag |
| 7 | hungary-1998 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | **fail** | 1.66 s | duel MSCM vs COU gap error 3.75 / 3.62 [3.00] (+1 more) | Schumacher's 19-lap push (pace 7%) |
| 8 | belgium-1998 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads, weather | yes | G1 | **fail** | 4.91 s | field FRE gap error 11.35 / 11.03 [5.00] (+3 more) | lap pace (57%): rain heavier on old tyres, an SC estimated a lap late |
| 9 | malaysia-1999 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads | yes | G1 | **fail** | 3.41 s | field FRE gap error 7.56 / 7.66 [5.00] (+2 more) | Ferrari's team orders and Irvine's last laps |
| 10 | europe-1999 | Jolpica laps + F1DB stops | compounds, safetyCars, fuelLoads, weather | yes | G1 | **fail** | 15.56 s | field HAK gap error 52.36 / 52.08 [6.29] (+4 more) | wet model: slicks in the second shower lose too little (one wetness a lap); 16.59 -> 15.56 s |

## Era 2: Senna vs Prost (1989–1993)

| # | Race | Data source | Estimated | Built | Check | Result | Mean gap error / anchors | Main failing check | Diagnosis |
|---|---|---|---|---|---|---|---|---|---|
| 1 | france-1990 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | **fail** | 59/60 core anchors | order anchor; G1 sanity pass, 0.52 s | anchor fail (order): de Cesaris' disqualification puts him in the road order (solver); also a stop is the clear call (one wear rate) |
| 2 | united-states-1990 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 54/54 core anchors | G1 sanity pass, 1.56 s |  |
| 3 | mexico-1990 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 57/57 core anchors | G1 sanity fail, 2.00 s | anchors pass; G1 sanity: race mechanics (pace 32%) |
| 4 | brazil-1991 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 55/55 core anchors | G1 sanity fail, 2.37 s | anchors pass; G1 sanity: synthetic noise (pace 85%) |
| 5 | monaco-1992 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | **fail** | 54/55 core anchors | grid anchor; G1 sanity pass, 1.38 s | anchor fail (grid): Moreno's and Wendlinger's lap 1 pinned by their fastest laps (solver) |
| 6 | belgium-1992 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 104/104 core anchors | G1 sanity fail, 7.66 s | anchors pass; G1 sanity: dry model fitted on laps 36-44 only; Boutsen leads at the takeover |
| 7 | hungary-1992 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 52/52 core anchors | G1 sanity fail, 2.55 s | anchors pass; G1 sanity: Mansell's fresh-tyre pace |
| 8 | brazil-1993 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather (sidecar) | no: `data_issue`: the synthetic race isn't the real one (no source for the field's slick stops on laps 40-43; Senna P14 at the takeover, can't win with his real calls). Raw reconstruction only; anchors 104/104, G1 sanity 46.25 s | anchors | **not built** |  |  |  |
| 9 | europe-1993 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, safetyCars, fuelLoads, weather | yes | anchors | pass | 97/97 core anchors | G1 sanity pass, 1.07 s | anchors pass; playable, but Senna P12 at the takeover: unsourced stops absorbed into pace |
| 10 | australia-1993 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, safetyCars, fuelLoads, weather | yes | anchors | pass | 57/57 core anchors | G1 sanity pass, 0.34 s |  |

## Era 1: Turbo era (1983–1988)

| # | Race | Data source | Estimated | Built | Check | Result | Mean gap error / anchors | Main failing check | Diagnosis |
|---|---|---|---|---|---|---|---|---|---|
| 1 | south-africa-1983 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | **fail** | 54/55 core anchors | grid anchor; G1 sanity fail, 3.93 s | anchor fail (grid): a lap-1 retirement pinned by its fastest lap (solver); G1 sanity: Piquet's only sourced stop |
| 2 | monaco-1984 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 38/38 core anchors | G1 sanity fail, 5.54 s | anchors pass; fuel limit bites in the rain as if dry; G1 sanity: one wear rate for all |
| 3 | portugal-1984 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 56/56 core anchors | G1 sanity fail, 2.49 s | anchors pass; G1 sanity: race mechanics (pace 32%) |
| 4 | germany-1986 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 60/60 core anchors | G1 sanity pass, 0.85 s | anchors pass; **not playable as authored**: Rosberg's out-of-fuel stop frozen as a retirement, and the solver puts him ahead of Piquet |
| 5 | portugal-1985 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 55/55 core anchors | G1 sanity pass, 0.29 s | anchors pass; fuel limit bites in the rain as if dry |
| 6 | mexico-1986 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 51/51 core anchors | G1 sanity pass, 2.47 s |  |
| 7 | hungary-1986 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 62/62 core anchors | G1 sanity pass, 0.03 s |  |
| 8 | australia-1986 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 54/54 core anchors | G1 sanity pass, 0.78 s | anchors pass; **not winnable as authored**: Mansell's tyre failure frozen |
| 9 | great-britain-1987 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 53/53 core anchors | G1 sanity pass, 1.07 s |  |
| 10 | monaco-1988 | Reconstructed (Jolpica + F1DB anchors, sourced facts) | compounds, fuelLoads, weather | yes | anchors | pass | 51/51 core anchors | G1 sanity fail, 6.92 s | anchors pass; **not winnable as authored**: Senna's crash frozen; G1 sanity BER, ALBM |

## Summary

**Result: 35 pass, 0 borderline, 63 fail, 2 not built** (of 100; 22 reconstructed races checked on their anchors, 76 on G1).

| Era | Pass | Borderline | Fail | Not built |
|---|---|---|---|---|
| 10 | 1 | 0 | 9 | 0 |
| 9 | 5 | 0 | 5 | 0 |
| 8 | 4 | 0 | 6 | 0 |
| 7 | 2 | 0 | 8 | 0 |
| 6 | 3 | 0 | 7 | 0 |
| 5 | 0 | 0 | 9 | 1 |
| 4 | 1 | 0 | 9 | 0 |
| 3 | 3 | 0 | 7 | 0 |
| 2 | 7 | 0 | 2 | 1 |
| 1 | 9 | 0 | 1 | 0 |
| **All** | **35** | **0** | **63** | **2** |

## Model gaps, ranked

By the number of failing races each one explains (a race can have more than one), then by the
races it blocks from being played as authored (those pass their check but can't be won, or
aren't built). The sim bug in item 8 is a play bug (it disqualifies the real calls), not a G1
cause: G1 replays the real stops.

1. **No driver-specific damp / intermediate pace (one wetness a lap for the field; wet pace averaged over the race; rain with no weather data).** 17 failing: monaco-2022, netherlands-2023, belgium-2023, australia-2025, turkey-2020, monaco-2016, canada-2011, brazil-2012, hungary-2006, europe-2007, monaco-2008, japan-2000, malaysia-2001, united-states-2003, spain-1996, belgium-1998, europe-1999.
2. **Weak overtaking: cars stuck in trains, a faster car can't pass, Monaco queues.** 17 failing: singapore-2023, monaco-2025, spain-2021, brazil-2021, monaco-2017, italy-2020, bahrain-2014, monaco-2015, hungary-2015, australia-2010, abu-dhabi-2010, china-2011, abu-dhabi-2012, san-marino-2005, brazil-2006, brazil-2007, brazil-2008.
3. **One race pace per car vs real stint-to-stint pace (a car's pace in one stint, a push, a fresh-tyre charge).** 13 failing: hungary-2021, san-marino-2005, japan-2005, brazil-2009, brazil-2003, hungary-2003, japan-2003, france-2004, monaco-2004, spain-1996, hungary-1997, europe-1997, hungary-1998.
4. **SC / red-flag restart mechanics (late-SC sprints, restart order, the fitted SC queue's stop costs).** 9 failing: great-britain-2022, miami-2024, azerbaijan-2021, saudi-arabia-2021, azerbaijan-2017, italy-2020, sakhir-2020, bahrain-2014, monaco-2015.
5. **Team orders and let-bys not modelled.** 4 failing: hungary-2024, russia-2018, europe-1997, malaysia-1999.
6. **Unsourced one-off losses and car problems (not in data/incidents.json, or a fault's constant loss).** 3 failing: canada-2014, united-states-2015, great-britain-2016.
7. **Reconstruction solver anchor conflicts (lap-1 grid vs fastest-lap-pinned retirements; disqualified cars in the road order).** 3 failing: france-1990, monaco-1992, south-africa-1983.
8. **Sim bug: a car taking over on intermediates that switches to slicks is disqualified by the two-compound rule (`stateAtTakeover.compoundsUsed` omits the wet tyre it's on).** 3 failing: united-states-2015, great-britain-2016, monaco-2008.
9. **Dropped cars with no dry laps (a car that ran only wet laps has no pace fit).** 2 failing: hungary-2006, malaysia-2001; 1 blocked in play or not built: china-2007 (not built).
10. **SC estimate misses (step 2.4: an SC applied as yellows, or a lap late).** 2 failing: germany-2000, belgium-1998.
11. **Estimated dry compounds (step 2.4's SOFT/HARD split, or dry labels on wet stints).** 2 failing: turkey-2020, brazil-2008.
12. **Tyre wear on long stints (flat HARD wear, last-stint wear).** 2 failing: hungary-2014, monaco-2011.
13. **No unlapping decided from the sim's own gaps (a car the sim has a lap down stays there).** 1 failing: monaco-2011.
14. **Storyline retirements frozen (the player's car retires whatever the calls).** 4 blocked in play or not built: australia-1994, germany-1986, australia-1986, monaco-1988.
15. **Unsourced tyre changes in reconstructed races (the running order isn't the real one).** 2 blocked in play or not built: brazil-1993 (not built), europe-1993.
16. **Fuel limit bites in the rain as if dry (the takeover margin is drawn for a dry burn).** 2 blocked in play or not built: monaco-1984, portugal-1985.

## Changes against docs/g1-report.md

Robust G1 on the merged code moved these races (before = the latest number in docs/g1-report.md):
- canada-2011: 10.27 -> 3.51 s (MAS's back-to-back stops, out-laps 53 and 54, no longer count
  lap 53 twice: his lap-54 loss 47.1 -> 7.1 s). Still fails: BUT vs VET order, PET, MAS.
- united-states-2003: 48.32 -> 14.64 s (both stop fixes: Schumacher's back-to-back stops and the
  partly yellow laps 21 and 23). Still fails on Bridgestone wet pace.
- europe-1999: 16.59 -> 15.56 s (partly yellow laps of the ambiguous 36-43 period priced in the
  sim frame).
- **germany-2000: 20.64 -> 36.41 s (worse).** Its two real SCs (laps 25-28, 30-31) were missed
  by step 2.4 and applied as yellows; laps 27-28 and 30-31 are partly yellow, so the stops on
  them are now priced in the sim frame, which carries the real SC bunching into the loss (BUT's
  lap-28 stop 16.3 -> 76.5 s). The fix is the owner's SC hand check (data/estimates/germany-2000.sc.json),
  which the 5.1 check showed makes the duel pass. Whole-lap yellows ("2") are left out of the
  fix: in a source without status timing they are 2.4's ambiguous slow periods (europe-2012
  failed at 6.05 s with them in, and passes at 1.44 s without).
- hungary-2006: 20.42 -> 22.00 s; monaco-2011: 32.97 -> 32.66 s; miami-2024: 2.88 -> 4.74 s and
  brazil-2021: 1.23 -> 1.82 s (both now rebuilt with every Eras fix; they had been left out of
  the sim-fixes-2 rebuild); europe-2007: 4.17 -> 4.93 s; sakhir-2020: 0.97 -> 1.30 s (still
  fails on the duel); austria-2002: 1.79 -> 1.54 s (still passes); belgium-1998: 5.00 -> 4.91 s;
  belgium-1995: 2.60 -> 2.97 s (G1 sanity only).
- No status changed: every race keeps the pass / fail status of its latest docs/g1-report.md
  entry (germany-2018 stays the pass sim fixes 2 made it). Every other race is within 0.05 s.

## Not built

- **china-2007** (Era 5): the user's car, Hamilton, isn't in the race model. He ran only wet
  laps (retired on lap 31), so `build.dry_fit` has no dry pace for him and `assemble` drops him.
  Needs a pace for a car with only wet laps (gap 'dropped cars').
- **brazil-1993** (Era 2): registered with `data_issue`, raw reconstruction only. Anchors pass
  (104/104), but no source gives the field's slick stops (laps 40-43), so the synthetic race
  isn't the real one (Senna P14 at the takeover). Needs the slick stops sourced, or a solver
  rule for unsourced tyre changes.

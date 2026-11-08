# Simulator and pipeline roadmap (for Eras)

Status: draft 2026-11-07. The models and data work that `laststint-eras-mode-spec.md` needs
beyond today's simulator. Each item lists the Eras races it unblocks. Until its item lands, a
race stays a **Draft**: it's visible on test, but can't be released (eras spec §16).

The race lists here are from race history and must each be checked against the data before
building (eras spec §19).

## Sim models

### R1. Red flags
- **What:** the race stops; cars line up in the pit lane; tyre changes are free; a restart
  (standing or rolling, by year) follows; the gaps are wiped.
- **Calls it adds:** whether to pit just before a red flag (it's now free); which tyre for the
  restart.
- **Pipeline:** `race_suitability()` stops turning red-flag races down; the race-status
  timeline gains a red-flag code.
- **Unblocks (draft list):** monaco-2022, great-britain-2022, netherlands-2023, brazil-2024,
  azerbaijan-2021, hungary-2021, saudi-arabia-2021, azerbaijan-2017, italy-2020, brazil-2016,
  monaco-2011, canada-2011, europe-2007, brazil-2003, belgium-1998, monaco-1984.

### R2. Car faults
- **What:** a scripted fault from the real race: stuck in a gear (a pace loss per lap), power
  loss, a puncture or a tyre failure (a forced slow lap and a stop). Frozen on its real lap,
  like the safety cars, and flagged `storylineEvent`.
- **Calls it adds:** nurse the car or push; pit now or limp on.
- **Unblocks:** spain-1994, brazil-1991, canada-2014, azerbaijan-2021, monaco-2008,
  hungary-1992, australia-1986.

### R3. Wet races without weather data (before 2018)
- **What:** today's wet model (`pipeline/wet.py`) fits wetness from the minute-by-minute
  weather and each lap's tyre, which only exist from 2018 (FastF1/OpenF1). Before 2018 the
  wetness timeline has to be fitted from lap times alone (the whole field slowing), checked
  against race reports, with the tyre changes taken from the pit stops.
- **Unblocks (draft list):** brazil-2016, united-states-2015, hungary-2014, malaysia-2013, brazil-2012,
  canada-2011, australia-2010, brazil-2008, europe-2007, china-2007, hungary-2006, united-states-2003,
  brazil-2003, malaysia-2001, germany-2000, europe-1999, belgium-1998, spain-1996,
  belgium-1995, europe-1993, brazil-1993, belgium-1992, portugal-1985, monaco-1984.
- **2018+ wet races** (germany-2018, germany-2019, turkey-2020, russia-2021, turkey-2021,
  monaco-2022, netherlands-2023, australia-2025) use today's model. Each must still pass G1;
  Australia 2025 failed it so far.

### R4. Refuelling (1994–2009) and fuel limits (1983–88)
- **Refuelling:**
  - a stop costs the pit-lane time plus the time to put the fuel in;
  - the fuel added is set by the next stint's length;
  - the fill rate is fitted per race from the real stops (stop time against the next stint's
    length);
  - the car's weight resets at each stop.
  - The player chooses the fill (short / standard / long). This extends the fuel-load model
    (`docs/fuel-load-spec.md`) so the tank refills at a stop.
- **Fuel limits (1984–88):** the turbo era's capped tank (fuel saving was the strategy). The
  same tank model with no refuelling and a fixed race allowance. 1983 allowed refuelling
  (south-africa-1983).
- **Unblocks:** Eras 1, 3, 4 and 5.

### R5. Rules by era
Each era's rules live in the race file's `rules` block and the era's `headset.json` block, not
in code:

| Rule | Years | Notes |
|---|---|---|
| VSC | 2015+ | Earlier eras have none |
| DRS (`wait-drs` move) | 2011–2025 | |
| Battery / ERS | KERS 2009, 2011–13; hybrid 2014+ | Earlier eras: none |
| Two-compound rule | 2007+ | Off before |
| No tyre changes in the race | 2005 | A stop only refuels |
| Pit lane closed when the SC is called | 2007–09 | A stop takes a penalty |
| Lapped cars unlap under the SC | 2012+ (`scUnlap`) | `none` before |

- **Config:** `compound_priors.json` and `packages/sim/src/headset.json` need a block for each
  schema era. Today only `2014-2025` exists, so a race tagged with another era crashes the tyre
  fit and quietly loses engineer calls, ERS and incidents.

### R6. Eras difficulty (from the eras spec §7)
- **Information levels:** UI only.
- **Rival policies:** Standard+, Smart and Expert, in the TS sim and the Python reference sim,
  with parity tests.
- **Expert** runs the grader for the rival's own calls. Check the cost on a phone before
  committing.

## Data pipeline

All sources below were tested Nov 4–5, 2026, unless marked.

| Source | Covers | Gives | Notes |
|---|---|---|---|
| OpenF1 (`pipeline/openf1.py`, exists) | 2023+ | everything FastF1 gives | free |
| FastF1 | 2018+ | everything | needs an F1TV-subscribed account in `pipeline/.env` since Oct 2026 |
| TUM f1-timing-database | 2014–2019 | per-lap time, gap, position, compound, tyre age, stops, SC/VSC phases | **CC BY-NC-SA**: accepted Nov 7. Credit TUM; race files built from it carry the same licence |
| Jolpica CSV dump | lap times 1996+; pit stops 2011+; results all years | laps, positions, stops, grid, result, retirements | summed laps match official race times to the ms |
| f1db | 2000–2009 stops (all 182 races) | stop lap and pit-lane time | licence to check |
| formula1.com results pages | pit stops 1994+ (1994: 14 of 16 races; 1995: 17 of 17); fastest laps for every race 1990+ | stops, each driver's fastest lap and the lap it came on, 3-letter codes | cache once; check the terms |
| Race reports (Wikipedia etc.) | all | SC laps and causes, weather, faults | hand-checked facts only |
| — | 1983–1993 lap times | **none exist** | Eras 1–2 are reconstructed (P3) |

- **P1. One adapter per source.** Each writes the same raw parquet (`LAP_COLUMNS`) and status
  JSON as `ingest.py`, so `clean.py`, `fit.py`, `track.py` and `assemble.py` run unchanged:
  `jolpica.py`, `f1com.py`, `f1db.py`, `tum.py`.
- **P2. Compounds before 2014.** One dry compound per race before 2007. From 2007, two
  compounds, assigned to stints from each stint's pace step and wear, with the both-compounds
  rule. Shown as estimates.
- **P3. Reconstruction (1983–1995 with no laps):** generate a lap-by-lap race that hits the real
  anchors:
  - the grid order and the real finishing order;
  - lead-lap gaps;
  - each driver's fastest lap, on the right lap;
  - retirement laps;
  - real stops (1994–95) or stops from race reports;
  - SC laps.
  A solver adjusts each driver's pace, wear and noise until finishing order is exact and
  lead-lap gaps are within 2 s. Pre-1990 coverage is unresearched.
- **P4. Track maps before 2018.** Reuse the 2018+ outline where the layout is unchanged.
  Otherwise use OpenStreetMap or a hand trace (old Hockenheim, Adelaide, Imola, Estoril,
  Jerez, A1-Ring, Sepang, Valencia, Donington and others), with corner numbers and pit lanes
  set by hand.
- **P5. People and teams.** Every driver in `data/drivers.json` (`drivers.test.ts` requires
  it); historic team colours in `teamTheme.ts`, looked up by team and year.

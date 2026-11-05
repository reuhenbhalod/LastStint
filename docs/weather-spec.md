# Weather spec

Status: built 2026-11-05 (see Built). Decided 2026-11-05. The owner chose the recommended option for W1–W7 (W1: mixed-weather
races only, in the daily rotation and the Gauntlet). Built after the strategy planner.

## Goal

From the owner's list: "add weather to use different tyres", and "tyre wear should adjust
based on track history, weather, etc". Every race in the game today is dry: the pipeline
skipped wet races, and the sim knows only slick compounds. Rain brings the most famous
strategy calls in the sport (Russia 2021: Norris stays out on slicks and loses the win;
Germany 2018: Hamilton stays out and wins from 14th).

## What exists

- The pipeline downloads FastF1 lap data, plus track status. FastF1 also has weather by the
  minute (rainfall, track temperature) and each lap's compound, including INTERMEDIATE and WET.
  Neither is used yet. `events.py` notes rain was left for later.
- The sim's `Compound` is a string; compounds are per race in the model. So adding inters and
  wets is mostly new model fields, not a rewrite.
- Safety cars are frozen real events, with blind forks for grading. Rain fits the same pattern.

## Model sketch

- **Track wetness** per lap, 0 (dry) to 1 (standing water), as a frozen real timeline (like
  safety cars), read from FastF1's rainfall and from which tyres the field ran.
- **Tyre pace by wetness:** each compound gets a lap-time penalty curve over wetness. Slicks
  lose time fast as it gets wet; inters are best in the middle; wets are best in standing
  water. Crossover points are fitted from the real race's laps, with defaults when a race has
  too few laps on a compound.
- **Risk:** slicks on a wet track (and wets on a drying one) raise crash and spin chances; the
  sim's incident model already scales with risk.
- **Wear:** inters on a drying track wear fast (a known real effect); slicks on a cool damp
  track wear slower.
- **Grading and plans without hindsight:** a blind fork follows the forecast, not the real
  rain. W3 decides how good the forecast is.

## Decisions

**W1. Which races**
- **A (recommended):** Mixed-weather races only, where the call is the game:
  - Russia 2021 (Norris vs Hamilton, late rain);
  - Germany 2018 (Hamilton vs Vettel, late rain);
  - Great Britain 2024 (Hamilton vs Norris/Verstappen, the inters timing);
  - Turkey 2020 (worn inters to the end);
  - Turkey 2021 (Hamilton's late stop);
  - Netherlands 2023 (rain at the start and the end);
  - Canada 2024.
  Each goes through the same realism check as every race today.
- B: Also fully wet races (Japan 2022, Brazil 2024). They're harder to model and have fewer
  real calls.

**W2. Where wet races go**
- **A (recommended):** Mixed into the daily rotation (about 1 day in 6) and the Gauntlet.
- B: A separate "Rain" mode.

**W3. Forecast**
- **A (recommended):** The engineer gives a radar forecast: "rain in about 4 laps, 70%,
  light". It's fairly accurate at short range and less so further out. Blind forks roll rain
  from that forecast.
- B: A perfect forecast (rain comes exactly when forecast).
- C: No forecast; you react to what you see.

**W4. What you see**
- **A (recommended):** A weather chip in the scoreboard (dry, damp, wet, with the trend) and
  rain drawn on the track map (darker track, spray behind the cars). The radio reports drivers
  "saying it's wet in sector 2".
- B: The chip only.

**W5. Calls it adds**
- **A (recommended):**
  - The engineer's call "Box for inters?" (and back to slicks when it dries), with the chance
    of each;
  - the driver's own request "It's raining, I need inters!", which plays into trust;
  - the tyre picker gaining inters and wets.
- B: The tyre picker only; no new calls.

**W6. Rules**
- **A (recommended):** Real rules: no two-compound rule if inters or wets are used, and wets
  are required behind a wet safety car start (only if a race needs it).
- B: Simplified: no compound rules in wet races.

**W7. Grading**
- **A (recommended):** Wet moments are graded like the others, against blind forks under the
  forecast (so staying out in Russia is graded on what the radar showed, not on hindsight).
- B: Wet races are practice-style: unscored until the model is proven.

## Risks

- Realism: the realism check (G1) was built for dry races. Wet pace swings lap to lap, so
  each wet race needs its own check, and a race that fails is left out (as Hungary 2019 was).
- Effort: the biggest change since the race engineer work. It needs pipeline, sim, server
  parity, UI and content, staged as below.

## Build outline (after the decisions)

1. Pipeline: weather and wetness timeline; keep INTERMEDIATE and WET laps; fit the wetness
   curves; build the W1 races (Python and TS parity checked in CI as today).
2. Sim: wetness, the compound pace curve, wet risk and wear, the forecast, blind rain in
   forks; the rules (W6). Sim tests and parity.
3. Realism check per wet race, seeds tuned with the tuner, and a report.
4. UI: the weather chip, rain on the map, the calls (W5), inters and wets in the picker and
   in the strategy planner.
5. e2e on one wet race; schedule them into the rotation.

## Built (Nov 5 2026)

- **Data (OpenF1).** FastF1 needs an F1TV subscription since Oct 2026, so the owner chose
  OpenF1 (free, 2023 on): `pipeline/openf1.py` writes the same raw snapshot, track status and
  a new weather file (rain by the minute). Russia 2021 came from the local FastF1 cache.
  Checked against FastF1 on Spain and Singapore 2023 (tyres, stints, positions identical).
- **Races (W1, revised for the data).** Germany 2018 and both Turkey races aren't on OpenF1,
  Netherlands 2023 turns on a red flag and Brazil 2024 is wet throughout. Five races were
  built: Russia 2021, Great Britain 2024, Canada 2024, Monaco 2023, Australia 2025.
  Russia 2021 and Canada 2024 pass G1 and are in the daily pool. Great Britain 2024 and
  Monaco 2023 pass on the duel but miss field checks; Australia 2025 fails (the leader's
  last wet stint: race craft the model doesn't have). Those three are built but not played.
- **Model.** `pipeline/wet.py`: a wetness timeline per race (0-1, fitted from the laps) and
  three curves shared by all races (`data/wet.json`, `pipeline wet-fit`): the share of a dry
  lap a slick, an inter and a wet lose. Fitted within 0.3-2.1% per race. Slicks barely wear
  on a wet track, wet tyres wear fast on a drying one; drivers have a wet pace of their own.
  The dry model is fitted on the untouched laps with a fixed fuel effect.
- **Sims.** Both sims run the wet lap and wear identically (parity on Russia and Canada). A
  blind playout races a forecast: the real rain shifted a lap or two and scaled ±20% (W3).
  The two-compound rule is waived once wet tyres are used (W6). In live play slicks in the
  wet raise crash risk, and the player's car aquaplanes off now and then (10 s).
- **Game.** Rain and drying moments; the driver asks for inters, the engineer offers slicks
  as it dries (W5); the weather chip with the radar forecast and rain on the map (W4);
  plans include wet tyres; a stop far dearer than usual crawls its in-lap on the map.

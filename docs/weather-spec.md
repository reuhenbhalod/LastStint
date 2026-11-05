# Weather spec

Status: decided 2026-11-05. The owner chose the recommended option for W1–W7 (W1: mixed-weather
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

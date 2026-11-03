# Spec: Races, batch 1 (10 races to Abu Dhabi level)

Nov 2, 2026 · Bring 10 more races up to the level of Abu Dhabi 2021 so they can be daily races. Same session branch as the rest of today's work; one PR at the end.

## What "Abu Dhabi level" means

A race is ready when it has all of these:

1. **Realistic simulation**: passes the G1 check (robust, 1,000 runs on two seed sets).
2. **Graded decision moments**: a race plan when you take over, then 4–6 big calls found by the moment finder, each a real dilemma (quality bar: some option at least 5 points behind the best, the best no more than 30 ahead). Stop calls get a "Box next lap" option where the next lap is still neutralized or the tyres can take one more lap; pace calls get "Push and attack" where a fight is on.
3. **A track map**: the real circuit outline and pit lane from FastF1 position data (`pipeline outline`).
4. **The right garages**: each season's pit garage order (the previous season's constructors' standings).
5. **Driver attitudes** for everyone in the race (`data/drivers.json`; already done for all 40).
6. **A name** that says who you are and who you race ("Canada 2022: Sainz vs Verstappen").
7. **A fair seed**: the combos check passes (game grades equal the server's on every sampled path), and the best play can beat the real team's result.
8. **Tests**: every race file's moments verify end to end, the drivers and garages coverage tests pass, the browser playthrough still passes.

## Decisions (Nov 2, 2026)

**D1. The 10 races.** All 13 candidates still pass G1 after this week's changes (re-run Nov 2). Taken: Mexico 2021 (PER vs HAM), Bahrain 2022 (LEC vs VER), Miami 2022 (LEC vs VER), Canada 2022 (SAI vs VER), France 2019 (BOT vs HAM), Hungary 2019 (VER vs HAM), Mexico 2019 (VET vs HAM), Spain 2020 (VER vs HAM), Portugal 2020 (BOT vs HAM), Italy 2024 (PIA vs LEC). Reserves, used if a race has too few real dilemmas: Japan 2023, Bahrain 2021, Hungary 2025 (the last two pass G1 only with the near-tie rule; Japan has the largest gap error).

**D2. Moments.** The race plan is the same five choices as Abu Dhabi (run to plan, manage, push, box now on the two compounds that reach the flag). The rest come from the moment finder, keeping the ones that pass the quality bar, spaced at least 3 laps apart, up to 6. A race with fewer than 3 passing moments is swapped for a reserve.

**D3. Garages.** A per-season table in the web app (`track/garages.ts`), checked by a test against every race's teams. Done.

**D4. Scheduling** the new races as dailies is a production database write: it waits for your OK, like the re-pin.

## Stages

| # | Stage | Done when |
|---|---|---|
| R1 | G1 re-run, pick the 10 | Done: all 13 pass |
| R2 | Per-season garages | Done, with a coverage test |
| R3 | Moment finder on the 10, author the moments | Each race has a race plan and 3–6 graded moments in `data/moments/` |
| R4 | Track outlines | `data/tracks/<race>.json` for each, with the pit lane |
| R5 | Names, rebuild the race files with their moments | Schema-valid race files; parity and G1 unchanged |
| R6 | Combos check per race | 0 live/full mismatches; the best play beats the real result |
| R7 | Tests, docs, screenshots of each race on localhost | All green |

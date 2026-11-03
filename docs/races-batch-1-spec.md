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

## Tuning and batch 2 (Nov 2-3, 2026, overnight)

**Seeds (`scripts/tune.ts`).** The moments are graded without hindsight, so they don't depend on the daily seed; the seed only sets the race's luck. The tuner tries 80 seeds per race, playing 120 fixed answer paths on each the way the server replays a run (about 2 s a race), and keeps a seed where:

1. **Real way:** answering every call the way the real team did, and boxing on their real laps, gives the real result, with the rival within a place of theirs (no luck taking them out).
2. **Good play wins:** taking the best-graded option at every call, and boxing when the grader's sensible plan says to, finishes ahead of the rival (the game's goal in a beat race and a defend race alike).
3. **Careless play mostly loses:** random answers (boxing only when the two-compound warning shows) win 3-35% of the time, closest to 15%.

Every simulated player uses the BOX button between calls like a real one. The old combos fairness numbers didn't: a path that skipped a stop call was disqualified, which is why Bahrain 2022 looked unwinnable (best P6).

The current seed is kept when it passes. Abu Dhabi 2021 is not tuned: on its seed the real way loses and good play wins, but random play wins only about 1%, so it stays the hardest race.

**Results.** All 18 tuned races pass: real way = real result, good play wins, random play wins 3-18%. Seeds changed on 17 (Hungary 2019's already passed); `build.py` holds the same seeds.

**Revived.** Bahrain 2022 (LEC holds P1 from SAI). Portugal 2020 as a defend race (BOT holds P2 from VER), taking over on lap 26 instead of 37 for more calls (G1 0.42 s). Japan 2023 fails G1 as a NOR vs PIA defend race and stays out.

**Batch 2.**
- *Existing races:* the 18 built races without calls were re-checked. None passes G1 with its automatic duel. As defend races, France 2021 (HAM from PER) and Austria 2019 (LEC from BOT) pass and are in. Brazil 2021, Hungary 2022 and 70th Anniversary 2020 still fail.
- *New races:* 12 new ones were downloaded from FastF1. Kept: Italy 2019 (BOT vs LEC), USA 2022 (HAM vs VER), Mexico 2024 (NOR vs SAI), Abu Dhabi 2024 (SAI vs NOR, taking over on lap 10).
- *Dropped:*
  - Britain 2019, Spain 2019, Qatar 2021, Spain 2024: G1 fails with either duel.
  - Austria 2022: validation crashes on NaN data.
  - USA 2024, Netherlands 2024, Netherlands 2021: too few calls, and an earlier takeover fails G1 or still leaves too few.

**Not yet scheduled.** No production database writes were made. Scheduling these as dailies waits for the owner's OK (D4).

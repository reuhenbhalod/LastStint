# Races batch 3: report

Nov 19, 2026 · Branch `races-batch-3`. Spec: `docs/races-batch-3-spec.md`.

**Result: 59 new races, 47 Daily and 12 Gauntlet. 39 of them (66%) put the player in a
midfield car.** Round 1 added 39 races from 2018–2025 (27 Daily, 12 Gauntlet, 22 midfield);
round 2 (D12) added 20 Dailies from 2014–2017 (17 midfield). Daily grows from 21 to 68 races
and Gauntlet from 19 to 31. The 40 existing races are unchanged: grade, Expert and radio
fixtures match origin/main for all 40, and round 1's 39 are unchanged by round 2.

## The 39 races

Finish = the official place (post-race time penalties applied). Laps left = from the
takeover to the flag. Calls = graded decision moments. Penalties = the race file's `postRacePenalties`.

| Mode | Race | Duel | Teams | Finish | Laps left | Calls | Midfield | Penalties |
|---|---|---|---|---|---|---|---|---|
| Daily | 70th-anniversary-2020 | Norris vs Kvyat | McLaren vs AlphaTauri | P9 / P10 | 20 | 3 |  |  |
| Daily | abu-dhabi-2019 | Hülkenberg vs Ricciardo | Renault vs Renault | P12 / P11 | 16 | 3 | yes |  |
| Daily | abu-dhabi-2025 | Piastri vs Norris | McLaren vs McLaren | P2 / P3 | 20 | 3 |  | STR +5s, BEA +5s, ALB +5s, GAS +5s |
| Daily | australia-2022 | Ocon vs Bottas | Alpine vs Alfa Romeo | P7 / P8 | 22 | 3 | yes | STR +5s |
| Daily | austria-2024 | Ricciardo vs Gasly | RB vs Alpine | P9 / P10 | 15 | 3 | yes | VER +10s, ALB +5s, NOR +5s |
| Daily | azerbaijan-2023 | Russell vs Stroll | Mercedes vs Aston Martin | P8 / P7 | 15 | 3 |  |  |
| Daily | azerbaijan-2025 | Tsunoda vs Lawson | Red Bull Racing vs Racing Bulls | P6 / P5 | 16 | 3 |  | ALB +10s |
| Daily | bahrain-2018 | Hülkenberg vs Alonso | Renault vs McLaren | P6 / P7 | 21 | 4 | yes | PER +30s, HAR +30s |
| Daily | brazil-2018 | Hartley vs Sainz | Toro Rosso vs Renault | P11 / P12 | 25 | 4 | yes | ALO +5s, VAN +5s |
| Daily | brazil-2023 | Hamilton vs Tsunoda | Mercedes vs AlphaTauri | P8 / P9 | 19 | 3 |  |  |
| Daily | brazil-2025 | Gasly vs Albon | Alpine vs Williams | P10 / P11 | 19 | 3 | yes |  |
| Daily | china-2019 | Verstappen vs Leclerc | Red Bull Racing vs Ferrari | P4 / P5 | 17 | 3 |  |  |
| Daily | eifel-2020 | Ricciardo vs Pérez | Renault vs Racing Point | P3 / P4 | 20 | 4 | yes |  |
| Daily | emilia-romagna-2025 | Alonso vs Hülkenberg | Aston Martin vs Kick Sauber | P11 / P12 | 20 | 3 | yes |  |
| Daily | great-britain-2018 | Hamilton vs Räikkönen | Mercedes vs Ferrari | P2 / P3 | 23 | 4 |  | GAS +5s |
| Daily | hungary-2020 | Bottas vs Verstappen | Mercedes vs Red Bull Racing | P3 / P2 | 24 | 4 |  | MAG +10s, GRO +10s |
| Daily | italy-2021 | Stroll vs Alonso | Aston Martin vs Alpine | P7 / P8 | 15 | 3 | yes | PER +5s |
| Daily | italy-2025 | Russell vs Hamilton | Mercedes vs Ferrari | P5 / P6 | 18 | 3 |  | ANT +5s |
| Daily | japan-2018 | Alonso vs Hartley | McLaren vs Toro Rosso | P14 / P13 | 17 | 3 |  |  |
| Daily | las-vegas-2023 | Piastri vs Alonso | McLaren vs Aston Martin | P10 / P9 | 15 | 3 |  | RUS +5s |
| Daily | las-vegas-2024 | Zhou vs Colapinto | Kick Sauber vs Williams | P13 / P14 | 19 | 3 | yes |  |
| Daily | mexico-2025 | Leclerc vs Verstappen | Ferrari vs Red Bull Racing | P2 / P3 | 15 | 3 |  |  |
| Daily | netherlands-2025 | Verstappen vs Hadjar | Red Bull Racing vs Racing Bulls | P2 / P3 | 23 | 4 |  | ANT +10s, ANT +5s |
| Daily | singapore-2025 | Sainz vs Hadjar | Williams vs Racing Bulls | P10 / P11 | 15 | 3 | yes | HAM +5s |
| Daily | spain-2022 | Tsunoda vs Alonso | AlphaTauri vs Alpine | P10 / P9 | 17 | 3 | yes | ALB +5s |
| Daily | spain-2025 | Gasly vs Alonso | Alpine vs Aston Martin | P8 / P9 | 15 | 3 | yes | VER +10s, BEA +10s |
| Daily | united-states-2018 | Verstappen vs Hamilton | Red Bull Racing vs Mercedes | P2 / P3 | 22 | 4 |  |  |
| Gauntlet | australia-2019 | Magnussen vs Hülkenberg | Haas F1 Team vs Renault | P6 / P7 | 48 | 2 | yes |  |
| Gauntlet | austria-2021 | Alonso vs Russell | Alpine vs Williams | P10 / P11 | 44 | 2 | yes | PER +10s, RAI +20s, LAT +30s, MAZ +30s |
| Gauntlet | bahrain-2024 | Stroll vs Zhou | Aston Martin vs Kick Sauber | P10 / P11 | 33 | 2 | yes |  |
| Gauntlet | belgium-2018 | Vettel vs Hamilton | Ferrari vs Mercedes | P1 / P2 | 26 | 2 |  | BOT +5s |
| Gauntlet | japan-2025 | Hamilton vs Hadjar | Ferrari vs Racing Bulls | P7 / P8 | 31 | 2 |  |  |
| Gauntlet | monaco-2021 | Stroll vs Ocon | Aston Martin vs Alpine | P8 / P9 | 44 | 2 | yes |  |
| Gauntlet | netherlands-2024 | Gasly vs Alonso | Alpine vs Aston Martin | P9 / P10 | 44 | 2 | yes | STR +5s |
| Gauntlet | qatar-2025 | Sainz vs Piastri | Williams vs McLaren | P3 / P2 | 36 | 2 | yes |  |
| Gauntlet | spain-2019 | Magnussen vs Sainz | Haas F1 Team vs McLaren | P7 / P8 | 46 | 2 | yes |  |
| Gauntlet | united-states-2021 | Tsunoda vs Vettel | AlphaTauri vs Aston Martin | P9 / P10 | 42 | 2 | yes |  |
| Gauntlet | united-states-2024 | Hülkenberg vs Pérez | Haas F1 Team vs Red Bull Racing | P8 / P7 | 33 | 2 | yes | NOR +5s |
| Gauntlet | united-states-2025 | Piastri vs Russell | McLaren vs Mercedes | P5 / P6 | 29 | 2 |  | BEA +10s |

Every race passes these checks:
- Robust G1 (with its penalties).
- Daily: 15–25 laps left (D9) and at least 3 graded calls. Gauntlet: at least 25 laps left
  and 2 calls (`author --max 2`, as the live Gauntlet races).
- Tuned with `scripts/tune.ts`: the real way gives the real result, good play wins, and
  random play lands in the band. Gauntlet races have 1–5 seeds in `data/pools.json`.
- Track outline, driver attitudes, SC/VSC causes (`data/incidents.json`) and retirements.
- Source review by agents (Wikipedia + Jolpica): duel, top 6, penalties, teams, names and
  pit laps.

## Round 2: 20 Dailies from 2014–2017 (D12)

Same rules as round 1's Dailies: 15–25 laps left, at least 3 graded calls, robust G1, a tuned
seed, and a source review of the duel and post-race penalties (Wikipedia, Jolpica, Motor
Sport, Autosport, GrandPrix.com). Lap data from the TUM database (`pipeline tum-ingest`,
CC BY-NC-SA 3.0, as the 13 live TUM races); every top 10 matches Jolpica's classification.

| Race | Duel | Teams | Finish | Laps left | Calls | Midfield | Penalties |
|---|---|---|---|---|---|---|---|
| abu-dhabi-2014 | Massa vs Hamilton | Williams vs Mercedes | P2 / P1 | 15 | 3 | yes |  |
| australia-2015 | Ericsson vs Sainz | Sauber vs Toro Rosso | P8 / P9 | 18 | 3 | yes |  |
| australia-2016 | Vettel vs Hamilton | Ferrari vs Mercedes | P3 / P2 | 25 | 4 |  |  |
| austria-2014 | Pérez vs Magnussen | Force India vs McLaren | P6 / P7 | 19 | 4 | yes |  |
| bahrain-2016 | Massa vs Kvyat | Williams vs Red Bull Racing | P8 / P7 | 16 | 3 | yes |  |
| belgium-2014 | Pérez vs Kvyat | Force India vs Toro Rosso | P8 / P9 | 25 | 4 | yes | MAG +20s |
| belgium-2016 | Pérez vs Vettel | Force India vs Ferrari | P5 / P6 | 24 | 4 | yes |  |
| canada-2017 | Pérez vs Vettel | Force India vs Ferrari | P5 / P4 | 24 | 3 | yes |  |
| china-2014 | Alonso vs Rosberg | Ferrari vs Mercedes | P3 / P2 | 24 | 4 |  |  |
| china-2016 | Sainz vs Verstappen | Toro Rosso vs Toro Rosso | P9 / P8 | 20 | 3 | yes |  |
| germany-2014 | Bottas vs Hamilton | Williams vs Mercedes | P2 / P3 | 20 | 4 | yes |  |
| hungary-2016 | Räikkönen vs Verstappen | Ferrari vs Red Bull Racing | P6 / P5 | 23 | 3 |  | GUT +5s |
| italy-2017 | Pérez vs Massa | Force India vs Williams | P9 / P8 | 24 | 4 | yes |  |
| japan-2015 | Grosjean vs Maldonado | Lotus F1 vs Lotus F1 | P7 / P8 | 23 | 4 | yes |  |
| malaysia-2014 | Massa vs Bottas | Williams vs Williams | P7 / P8 | 17 | 3 | yes |  |
| mexico-2015 | Bottas vs Kvyat | Williams vs Red Bull Racing | P3 / P4 | 25 | 4 | yes |  |
| mexico-2017 | Pérez vs Stroll | Force India vs Williams | P7 / P6 | 24 | 3 | yes |  |
| russia-2017 | Hülkenberg vs Ocon | Renault vs Force India | P8 / P7 | 15 | 3 | yes |  |
| spain-2015 | Ericsson vs Pérez | Sauber vs Force India | P14 / P13 | 24 | 4 | yes |  |
| united-states-2017 | Stroll vs Vandoorne | Williams vs McLaren | P11 / P12 | 23 | 4 | yes | VER +5s |

**Funnel.** 56 unused 2014–2017 races (79 in TUM, 23 already in a pool, Eras or the registry).
G1 passed for at least one duel in 37; 28 had a duel with 3+ calls; 27 tuned. The source
review then dropped:

- Not a real late fight: china-2014 (Vergne vs Button), japan-2017, belgium-2015,
  russia-2014, spain-2014, singapore-2017 (Palmer vs Pérez, and the Sainz vs Bottas
  alternative). Alternative duels replaced abu-dhabi-2014 (Massa vs Hamilton for the win),
  bahrain-2016 (Massa vs Kvyat), malaysia-2014 (Massa vs Bottas) and china-2014 (Alonso vs
  Rosberg); japan-2016 (Ferrari team-mates) and belgium-2017 weren't fights either.
- Decided by the stewards: mexico-2016 (Vettel's 10 s for his move on Ricciardo).
- No tuned seed: malaysia-2014's first duel (Massa vs Button), belgium-2016 Bottas vs Alonso.
- austria-2015 (Pérez vs Ricciardo): no car ever comes within battle range of Pérez in the
  radio test, and the sources rate it only a partial fight. belgium-2016 (Pérez vs Vettel)
  took its place.
- brazil-2015 kept out: Massa's disqualification (tyre temperature) isn't modelled, so the duel
  would be one place off.

**Fixes found on the way.**

- **TUM teams for mid-season moves.** TUM keeps one team per driver per season, so it had
  Verstappen at Toro Rosso and Kvyat at Red Bull from the 2016 Spanish GP on, and Sainz at
  Toro Rosso at the 2017 US and Mexican GPs (he drove for Renault). `tum.TEAM_MOVES` fixes
  them from Jolpica's per-race constructors (test: `test_mid_season_team_moves`). Only the
  `team` label changes (goldens identical). **Owner:** six existing Eras/registry TUM races
  carry the old labels until re-ingested: spain-2016 (Verstappen's first Red Bull win shows
  Toro Rosso), monaco-2016, canada-2016, great-britain-2016, germany-2016, abu-dhabi-2016.
  They weren't touched here (Eras rebuilds are the integrator's).
- **Red flags.** australia-2016 (lap 18) and belgium-2016 (lap 9) were red-flagged before the
  takeover. Both now have `data/redflags/<id>.json` (lap from Jolpica's stoppage lap,
  Wikipedia). Calls, seeds and grades didn't change. **Owner:** Wikipedia's lead says Belgium
  resumed "under green flag conditions"; the file uses the 2016 rule (behind the SC), which
  Jolpica's lap times fit.
- **SC cause.** mexico-2015's lap-52 safety car (Vettel's crash at Turn 7) is in
  `data/incidents.json`. Wikipedia's text puts it on lap 53; the timing has 52.

**Owner notes.** 17 of 20 are midfield (above round 1's "about half"). Several duels are
outside the points: spain-2015 (P14/P13), united-states-2017 (P11/P12). italy-2017 and
china-2016 are marginal fights (a team order in China). Track maps are same-layout reuses from
the nearest season (`scripts/batch3_tracks.py`). Two places outside the top 10 differ from
Jolpica (italy-2017 P16/17, japan-2015 P19).

## What changed in code (all gated, no existing race file changes)

- **Post-race penalties (D10).**
  - The registry gets `post_race_penalties` (each with a source URL). `build.py`
    `penalised_result` writes `postRacePenalties` and re-sorts `realResult`.
  - `sim.ts classify` and `sim_reference.py` add the penalties at the flag, so grades
    use them too. G1 adds them to the real gaps (`validate.with_penalties`).
  - The results screen lists them: "Stewards after the flag, as in the real race: …".
  - There's a new optional schema field. Only races that list penalties are affected.
- **Unfitted tyres** (`assemble.py`). A dry tyre used after the takeover that nobody ran
  long enough to fit gets the era's prior, as wet races already did (Monza 2021).
- **Stops onto no tyre** are dropped: a car pitting to retire, or a pit entry after the flag
  (Canada 2018/2025). Races with either failed to simulate before, so no built race changes.
- **Pit-loss reference by era** (`config/pit_loss_reference.json` `before`). Melbourne up
  to 2021 is 24.06 s, because the pit lane was narrower and limited to 60 km/h until the 2022
  changes (Wikipedia, 2022 Australian GP).
- **SC rates rebuilt** (`data/sc_rates.json`, legend parity fixture). The sources were
  re-downloaded to `pipeline/cache/eras-sources`: TUM at the pinned commit (SHA-256
  matches) and Jolpica's public delayed CSV dump of 2026-11-02 (hash matches Jolpica's). With
  main's raw files they reproduce the committed file exactly. Adding the batch's timelines
  gives 281 races and new circuits `vegas` and `losail`. This changes Legend SC rates for
  Eras, which only Eras reads.
- **Tests:**
  - Pool counts 40 → 79. The fixtures for the new races are recorded, and the 40 old hashes
    are byte-identical.
  - The motion test expects fewer pit entries on a Daily with 25 or fewer laps left.
- **`pipeline/scripts/batch3_tracks.py`.** 20 races reuse the outline of the same layout from
  another season. Las Vegas comes from the MultiViewer circuit API with a stand-in pit lane.

## The funnel

98 unused 2018–2025 races, outside the pools and Eras:
- 84 had usable data.
- About 60 had a duel that passes G1. The compound fixes and penalties brought back Monza
  2021, Canada 2018/2025, Australia 2022, Spain 2025, Zandvoort 2025, Bahrain 2018 and
  Australia 2019; the wider Daily window added more.
- 39 also had enough real calls, a tunable seed and a clean source review.

## Dropped, and why

- **Penalties decided by the stewards that the sim can't model:** las-vegas-2025 (both
  McLarens DSQ), hungary-2023 (with Leclerc's penalty, Russell enters the scored top 6 and
  G1 fails).
- **Not a real fight:**
  - saudi-arabia-2024: team tactic.
  - monaco-2024: red-flag tyres, no passing.
  - azerbaijan-2022: forced DRS repair.
  - qatar-2024: odd pit cluster.
  - qatar-2023: lap-1 hit, plus an 18-lap stint cap the sim can't enforce.
- **Data:**
  - belgium-2025: OpenF1 labels intermediates as mediums.
  - canada-2023: Tsunoda's last stint has no tyre recorded.
  - canada-2018: chequered flag a lap early; result at lap 68.
  - australia-2023: three red flags.
  - brazil-2024: fully wet.
  - belgium-2021: no racing.
- **Tests:** abu-dhabi-2018 (TUM parity fixture). austria-2023 (its real way can't finish
  legally in the replay).
- **Eras races** (overlays): brazil-2021, great-britain-2022, hungary-2021, russia-2018,
  spain-2021.

## Notes for the owner (races kept)

- **Lower-order places** that are road order or wrong outside the duel and top 6:
  - united-states-2018: Ocon and Magnussen were disqualified; DSQ isn't modelled.
  - bahrain-2018: Stroll should be P14.
  - brazil-2018: Vandoorne/Ocon at P14/P15.
  - italy-2021: Hamilton/Verstappen at P17/P18.
  - Also brazil-2023, singapore-2025, austria-2024, netherlands-2024, and some tails.
- **Weaker duels:**
  - Outside the points: japan-2018, las-vegas-2024, abu-dhabi-2019, emilia-romagna-2025,
    brazil-2018.
  - Gap opened early: australia-2022 (Bottas stuck behind Stroll), australia-2019 (a lap
    down).
  - abu-dhabi-2025 is a teammate pair on title-decider day.
- **Decided by a neutralisation** (real strategy, kept): eifel-2020, mexico-2025,
  spain-2025.
- **qatar-2025** keeps its real 25-lap stint cap unenforced (D11).
- **Penalties left out as unsourced:** penalties whose source doesn't say whether they were
  served (Magnussen Austria 2023, Bearman Monza 2025, Tsunoda Brazil 2025, Pérez Qatar 2023,
  some 5 s ones in Austria 2021 / USA 2024). None of them changes the duel or top 6.
- **Repurposed G1 validation races:** 70th-anniversary-2020, united-states-2021,
  bahrain-2018 and united-states-2018 now have game duels.
- **Track maps:** the reused layouts and the Las Vegas pit lane need a look.
- **Scheduling** the new Dailies in production is a D1 write and waits for the owner.

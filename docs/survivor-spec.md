# Spec: Survivor mode

Nov 3, 2026 · Branch `survivor`. A second game mode, separate from the daily: races one after another, and the run ends at the first race you lose. Survivor uses its own races, never the dailies.

## Decided (Nov 3, 2026, with the owner)

- **D1. One loss ends the run.** You win a race by finishing ahead of the rival in a beat race, or staying ahead in a defend race. Each race you win, you go on to the next.
- **D2. No difficulty ramp.** Each round is simply a different race.
- **D3. Its own races.** Survivor races and daily races are separate pools: a race is in one or the other, never both.
  - **Daily pool:** the 19 races already playable.
  - **Survivor pool:** a new batch (batch 3), downloaded and built for survivor.
- **D4. Its own game mode and leaderboard.** It doesn't touch the daily, the daily's one-run rule, or the streak. You can play as many runs as you like.

## Defaults (not asked; change any)

- **Pools file:** `data/pools.json` lists `daily` and `survivor`. The scheduler and the admin page only use `daily`; survivor only uses `survivor`. A test fails if a race is in both, or if a playable race is in neither.
- **Survivor races are short:** 2-3 big graded calls, plus all the race engineer calls between them.
  - A race qualifies with 2+ calls, and passes the same realism check (G1), server-match check and seed tuner as a daily.
  - The three races dropped earlier for too few calls (USA 2024, Netherlands 2021, Netherlands 2024) qualify on that bar, if they still pass G1.
- **A run:**
  - The server deals the races in a random order with no repeats.
  - Each race gets a fresh setup (seed) chosen by the server: the tuned seed isn't used, so a race plays differently each run.
  - Once every survivor race is used, the run goes round again with new setups.
  - The run's id and its races are fixed at the start, so it can't be re-rolled.
- **Checking:**
  - Each race is submitted at its flag and checked like a daily run (the race replayed from the call log, and the grades' shape checked).
  - The run lives on only if the server agrees you won.
  - The nightly re-grade covers survivor runs too.
- **Leaderboard:**
  - Ranked by rounds survived, then by the mean score of the calls.
  - All-time and this week, with the same player names as the daily.
- **Entry points:**
  - "Survivor" on the home page next to the daily's Start.
  - "Play survivor" on the daily results.
  - `/survivor` goes straight there.
- **Screens:**
  - The race screen is the daily's.
  - Between races: "Round N survived", the next race's card and Continue.
  - At the end: the run's summary (rounds, each race and how it ended), your rank, and Play again.

## Stages

1. **Batch 3 races:** register about 55 new dry races from 2018-2025. Then download, build, take track outlines, run G1, author 2-3 calls, tune, and put them in the survivor pool.
2. **Pools:** `data/pools.json`, the scheduler and admin on `daily`, and tests.
3. **Server:**
   - migration `0005_survivor`: survivor runs, their rounds and the leaderboard;
   - `POST /api/survivor/start` gives a run id and its first race and seed;
   - `POST /api/survivor/:id/round` takes a finished race (calls and claimed grades), verifies it, and returns won or lost plus the next race;
   - `GET /api/survivor/leaderboard`;
   - the nightly re-grade;
   - tests.
4. **Game:** the mode flow (start, race, between-races card, run over), entry points, the leaderboard, and local practice when offline.
5. **Checks:** all suites, the e2e survivor run, browser playthroughs on laptop and phone, and docs.

## Done (Nov 3-4, 2026)

**Batch 3, the survivor pool: 19 races.**
- 80 dry races from 2018-2025 were downloaded and built, with track maps and pit lanes. Wet and red-flagged races were left out.
- Each race had to:
  - pass G1, with the automatic duel, or another close pair found by `pipeline/scripts/duels.py`;
  - get 1-2 calls after the race plan (`author --max 2`);
  - have at least one seed passing the tuner (`tune --survivor 5`).
- Kept: canada-2019 (HAM vs VET), united-states-2019 (HAM vs BOT), styria-2020 (BOT vs HAM), russia-2020 (VER vs BOT), abu-dhabi-2020 (BOT vs VER), portugal-2021 (VER vs HAM), styria-2021 (HAM vs VER), netherlands-2022 (RUS vs VER), italy-2022 (LEC vs VER), mexico-2022 (HAM vs VER), miami-2023 (PER vs VER), spain-2023 (HAM vs VER), united-states-2023 (HAM vs VER), japan-2024 (PER vs VER), china-2024 (NOR vs VER), belgium-2024 (HAM vs RUS), china-2025 (NOR vs PIA), saudi-arabia-2025 (VER vs PIA), austria-2025 (PIA vs NOR).
- Dropped:
  - 35 fail G1 on checks no pairing changes (the field's gaps or the podium order, most often in 2018);
  - 10 have missing or broken data (2 didn't download, 8 fail to build);
  - 6 have no fair setup;
  - 10 have too few calls, even taking over 8 or 15 laps earlier (USA 2024, Netherlands 2021 and Netherlands 2024 among them).
- The bar wasn't lowered. A looser G1 for survivor (only the duel and our cars' gaps) would add more races, and is the owner's call.

**Pools:**
- `data/pools.json`; the scheduler and the admin page use only the daily pool.
- The Worker bundles only the pool races: 38, 97 KB gzipped.
- Tests:
  - the pools are disjoint;
  - every pool race is playable, and every playable race is in a pool;
  - every pool race has a map and a pit lane.

**Server:**
- migration 0005;
- `/api/survivor/start`, `/:runId`, `/:runId/round`, `/leaderboard` (`src/survivor.ts`);
- the nightly re-grade covers survivor rounds;
- tests cover a win carrying on, a loss ending the run, ranking, other players, wrong rounds, tampered logs and double submits.

**Game:**
- `/survivor`: the lobby (rules, Start, this week's and all-time leaderboards), each race's card (the home hero, "Survivor · round N"), the race, "Round N survived" with the next race, and "Run over" with the history and rank.
- A run in progress survives a refresh: its own save slot, never the daily's.
- Entry points: "Survivor mode" on the home page, and "Keep racing: Survivor" on the daily results.
- An e2e test plays a round.

**Driver data:** Pietro Fittipaldi (Abu Dhabi 2020) added to `data/drivers.json` as low attitude, with no researched radio history, like Doohan.

**Update (Nov 5, 2026):** the tyre-life fix re-tuned the survivor seeds. Styria 2021 has no seed left where good play wins, so it left the pool (its moments removed): 18 survivor races.

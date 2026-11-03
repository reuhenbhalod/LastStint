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

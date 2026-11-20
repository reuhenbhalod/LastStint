# Spec: Races, batch 3 (about 60 new races, short Dailies, more midfield)

Nov 18, 2026 · Branch `races-batch-3` (worktree `.worktrees/races-batch-3`, from `origin/main` 655d326).
Localhost first; one PR at the end; no merge, no production writes without the owner's OK.

## Where we start

- Daily has 21 races, and the player takes over with 15–55 laps left (most leave 36–55).
  Gauntlet has 19 races with 31–57 laps left.
- 39 of the 40 player cars are Red Bull, Mercedes, Ferrari or McLaren. The only exception is
  spain-2013 (RAI, Lotus).
- Adding races to the Daily pool is safe. `apps/worker/src/shuffle.ts` never changes days
  already scheduled, so new races just join the shuffle bag.
- Yield is the main risk. Batch 2 kept 4 of 12 new races; the rest failed G1 or had too few
  real calls.

## Decisions made (owner, Nov 18)

- **D1. New races only.** Existing Daily and Gauntlet races stay byte-identical. Reuhen is
  splitting and reorganising the existing ones separately.
- **D2. About 60 new races** across Daily and Gauntlet.
- **D3. About half the new races put the player in a midfield car**: any team except Red Bull,
  Mercedes, Ferrari and McLaren (Williams, Alpine/Renault, Aston Martin/Racing Point/Force
  India, Haas, Sauber/Alfa Romeo/Kick Sauber, AlphaTauri/Toro Rosso/RB). The rival is whoever
  makes the closest real fight. Usually that's another midfield car, often for points.
- **D4. Seasons 2018–2025.**

## Proposed rules (to confirm)

- **P1. Daily length: 15–20 laps left.** The takeover lap falls between laps−20 and laps−15.
  Inside that window, the D3 rule still applies: 3 laps before the first strategic event
  involving the duel (a stop or a SC/VSC). A race with no such event in its last 20 laps can't
  be a Daily, though it may still work as a Gauntlet race. Expect the Dailies to lean towards
  late safety cars, two-stoppers, rain and late undercut fights.
- **P2. Daily calls.** A race plan plus at least 2 graded moments (the batch 1 bar was 3). In
  15–20 laps, with moments at least 3 laps apart, the most a race can fit is about 5.
- **P3. Gauntlet length.** Keep the current D3 rule, with at least 25 laps left. Two graded
  calls, as the existing Gauntlet races (`author --max 2`; the 19 live ones have 1–2), and
  seeds that pass `scripts/tune.ts` (real way = real result, good play wins, random play wins
  3–35%). Up to 5 seeds per race, as now.
- **P4. Candidates.** All 2018–2025 Grands Prix except:
  - the 40 Daily and Gauntlet races;
  - the 21 Eras races. Sharing one would freeze it and need an Eras overlay.

  45 unused races are already downloaded, 24 of them outside Eras; the rest come from FastF1.
  The cache and `data/raw` are allowed sources, and formula1.com is never fetched. That gives
  roughly 110 candidates for 60 places.
- **P5. Readiness.** The same 8 points as batch 1: robust G1, graded moments, track outline,
  garages, driver attitudes, a name, a fair tuned seed, and tests. Driver attitudes
  (`data/drivers.json`) will need new entries for midfield drivers who aren't there yet.
- **P6. If fewer than 60 pass,** ship what passes and report the shortfall with reasons. Don't
  lower the G1 bar to hit the number.

## Stages

| # | Stage | Done when |
|---|---|---|
| S1 | Candidate list: every 2018–2025 race not excluded by P4, with the possible duels (midfield first), last-20-lap events, and Daily or Gauntlet fit | A table in `docs/races-batch-3-report.md` |
| S2 | Download the missing races (FastF1 into `data/raw`) | Parquet and status sidecars committed |
| S3 | Add `build.py` entries; build; robust G1, one race per call | A pass/fail per race, with reasons |
| S4 | Moment finder, authored moments, takeover lap per P1/P3 | `data/moments/<id>.json` meets P2 or P3 |
| S5 | Outlines, garages, driver attitudes, names | Coverage tests pass |
| S6 | Seed tuning (`scripts/tune.ts`): one seed for a Daily, up to 5 for Gauntlet | All tuned races pass |
| S7 | Add the races to `data/pools.json`; regenerate `races.gen.ts` | Freeze tests show the old 40 unchanged |
| S8 | Full checks (CLAUDE.md list), localhost play of a sample, report | All green; owner tests on localhost |

Scheduling the new Dailies in production (D1 writes) and merging both wait for the owner.

## Decisions made (owner, Nov 18, round 2)

- **D5. Split:** about 35 Daily and 25 Gauntlet, adjusted to what passes.
- **D6. Daily calls:** a race plan plus at least 3 graded moments. This replaces P2. A
  15–20 lap Daily therefore needs 3 calls at least 3 laps apart.
- **D7. No conflict with Reuhen:** his reorganisation uses separate files.
- **D9 (Nov 19). Daily window widened to 15–25 laps left** (replaces P1's 15–20). The
  takeover is 3 laps before the duel's first strategic event, between laps−25 and laps−15.
- **D10 (Nov 19). Post-race penalties are applied at the flag.** Registry
  `post_race_penalties` (sourced) → race file `postRacePenalties`; both sims add them in
  `classify` / `_classify`; G1 adds them to the real gaps; `realResult` takes them.
- **D11 (Nov 19). Qatar 2025 stays** without a stint-cap rule (accepted).
- **D12 (Nov 19). About 20 more Dailies from 2014–2017.** The 2018–2025 candidates are used
  up, so this extends D4 to the hybrid era. Races come from the TUM database
  (`pipeline tum-ingest`, CC BY-NC-SA 3.0, as the 13 live TUM races) and follow the same
  Daily rules: 15–25 laps left, at least 3 graded calls, about half midfield. Same
  exclusions as P4. Ship what passes and report any shortfall.
- **D8. Run it as an agent chain.** Deterministic steps (ingest, build, G1, tuning) run as
  scripts. Agents handle the judgment steps (choosing the duel and takeover, authoring
  moments, names, driver attitudes), and review, verify and QA agents follow.

## Data source note

FastF1's network archive now needs an F1TV login (Oct 2026), and formula1.com is never
fetched. Races therefore come from the on-disk FastF1 cache, ingested with `--offline`:
135 events from 2018–2025. Races missing from the cache come from OpenF1, which is allowed,
or are skipped.

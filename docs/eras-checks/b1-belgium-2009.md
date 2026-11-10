# B1: Eras content for belgium-2009 (Era 5, #6)

Eras job B1 (author a swapped-in passing race), Nov 9 2026. The race facts and their sources are
in `docs/eras-checks/swap-races-era5-overnight.md`, section "belgium-2009" (Facts table, read on
Nov 9 2026); this sheet cites its rows by topic. Nothing comes from memory. The storyline,
headline and briefing are original wording; no team radio is quoted. Check each row against its
source, then put your initials and the date in **Owner checked**.

## Sources

| Short name | Link |
|---|---|
| Swap | `docs/eras-checks/swap-races-era5-overnight.md`, belgium-2009 facts (WP, GPE, AS-L, MS, Jolpica as linked there) |
| Timing | Jolpica-F1 laps (CC BY-NC-SA 4.0) in `data/raw/belgium-2009.parquet`, as built into `data/races/belgium-2009.json` |

## Model status

- Robust G1 (`pipeline validate belgium-2009 --robust`, Eras build of this branch, base
  `eras-swap-era5-p3`): **pass** (strict pass), mean gap error 0.51 s with the eras block
  (played from Fisichella's side; 0.51 s rules-only on the swap branch).
- Reachability (`pnpm --filter @laststint/sim reachability belgium-2009 --seeds 1,2,3`): **pass**
  at era difficulty (threshold 82, Smart rival) and at Legend (90, Expert rival), all three stars
  and the hidden objective on seed 1 (exhaustive search): rivalpit-14 box next lap (hards),
  pace-19 standard, pace-23 standard, rivalpit-31 box (softs), battle-38 defend. The stay-out
  path earns no star on any seed (accuracy 80.0).
- With a `win` target the race was reachable at era difficulty but **not at Legend**: the Expert
  Räikkönen stays ahead on every path of an exhaustive search (32 paths, seeds 1-3), also with
  added light-fill and late-stop options at both stops (tried, not kept). The target became
  position 2 (owner-accepted pattern); the win stays the rewrite condition.

## Content

| Item | Value | Fact it rests on | Source | Owner checked |
|---|---|---|---|---|
| Side | **FIS** (Fisichella). `pipeline hard-calls`: hard calls FIS 0, RAI 0 (tie); chance given up FIS 25.0, RAI 13.7, so the tool picks Fisichella. Matches the swap sheet's suggested side. | the grader, not a fact | - | |
| Rival (moments) | RAI, the other storyline car | | | |
| Target | `position` 2. Fisichella is second at the takeover (end of lap 11: RAI P1, FIS P2 +1.803 s, KUB P3 +1.880 s behind FIS). A win was not reachable at Legend (see Model status). | Timing; "Restart / lead" (lap 11: Räikkönen +1.8 s over Fisichella, Kubica another 1.8 s) | Timing; Swap (GPE) | |
| Rewrite | `win`, headline "Force India's first win: Fisichella beats the Ferrari at Spa" (original). Fisichella did not win, so a rewrite is allowed. | Räikkönen 1st, Fisichella 2nd +0.939 s ("Result") | Swap (Jolpica-R, WP) | |
| Storyline | "Fisichella puts the Force India on pole" | "Grid" (pole 1:46.308) | Swap (Jolpica-Q, Jolpica-R) | |
| Storyline | "Räikkönen, sixth on the grid and the only KERS car in the top ten, takes second on the opening lap" | "Grid" (Räikkönen 6th; only KERS car in the qualifying top 10); "Start / lap 1" (took 2nd at Les Combes using KERS) | Swap (Jolpica-Q, WP, GPE) | |
| Storyline | "at the restart after the lap-one safety car he uses KERS to pass Fisichella for the lead" | "SC / VSC / red flag" (SC laps 2-4, restart lap 5); "Restart / lead" | Swap (GPE, MS, Jolpica-L) | |
| Storyline | "The two make the same two stops on the same laps, and Ferrari stays ahead each time" | "Stops: Räikkönen and Fisichella" (two stops each, pitting together; Ferrari kept the lead at both stops) | Swap (GPE, MS, Jolpica-L) | |
| Storyline | "Fisichella stays close but can't get past" | "Restart / lead" (never more than about a second apart after the restart; stuck in the Ferrari's dirty air) | Swap (MS) | |
| Storyline | "Räikkönen wins by 0.939 s, and Force India takes its first podium" | "Result" (+0.939; Force India's first podium) | Swap (Jolpica-R, AS-L) | |
| Briefing | "You run Fisichella's Force India from pole, but Räikkönen's KERS Ferrari passed you at the restart after the lap-one safety car" | "Grid"; "Restart / lead" | Swap | |
| Briefing | "After 11 laps you're second, 1.8 s behind him, with Kubica 1.9 s behind you" | End of lap 11 (takeover, D3 rule): RAI P1, FIS P2 +1.803 s, KUB P3 +1.880 s | Timing (GPE lap 11 gives 1.8 s and 1.8 s) | |
| Briefing | "Ferrari will stop when you do" | "Stops: Räikkönen and Fisichella" (pitting together, both stops) | Swap (GPE, Jolpica-L) | |
| Mastery | `stop_count` exact 2: "Top two on two stops" | Fisichella's two stops ("Stops: Räikkönen and Fisichella") | Swap | |
| Hidden | `mode_rule` manage, max 0 laps: "Top two without a lap managing the tyres". Game objective, no fact behind it. | | | |
| storylineEvents | none. The only SC (laps 2-4) is before the takeover and not in the built model ("SC / VSC / red flag"); no VSC or red flag. The model's retirements after the takeover (Trulli lap 22, Alonso lap 27) are kept in Legend anyway (`legend.ts isKept`), and neither is the player's car. | | Swap | |

## Notes

- Moments (`pnpm --filter @laststint/sim author belgium-2009 --target win --eras --write`):
  rivalpit-14 (real: box, hards, fill 17 laps), pace-19, pace-23, rivalpit-31 (real: box, softs,
  fill 13 laps), battle-38, in `data/moments/belgium-2009.json`. Graded on the win (as italy-2001
  after its re-author to a top-two target). Every pit option carries a fill (refuelling era); the
  real calls carry the real fills (lap 14 to 31, lap 31 to the flag; stint lengths from the
  sourced in-laps, GPE laps 14 and 31, as no source gives fuel loads). The tool's own candidates,
  not hand-adjusted.
- Compounds per stint are not in the sources; the moment options' compounds are the model's.
- The stop laps in the moments follow GPE's in-laps (14, 31); the race file's real stops are on
  the out-laps (15, 32), matching Jolpica's slow laps.
- The model doesn't know about Räikkönen's KERS (the rules overlay has `ers: "kers"`, but the
  restart and dirty-air models are off). The pass that decided the race happened before the
  takeover, so the race starts from the real order.
- Spec §4 Era 5 #6 target updated from the draft "defend: Fisichella wins from pole" (he is P2
  at the takeover).
- `pipeline/src/pipeline/build.py` names FIS as `user_side`, as `eras.userSide` does.
- `data/races/belgium-2009.json` and its golden must be built by the integrator
  (`pipeline build belgium-2009`); this branch does not commit them.

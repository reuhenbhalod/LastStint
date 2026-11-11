# B1: Eras content for netherlands-2023 (Era 10, #5)

Eras job B1 (author a passing race), Nov 9 2026. Every fact below was read in the linked
source on Nov 9 2026, or taken from the committed timing snapshot. Nothing comes from memory.
The storyline and briefing are original wording; no team radio is quoted. Check each row
against its source, then put your initials and the date in **Owner checked**.

**Status: authored as Verstappen** (second attempt, branch `eras-author-netherlands-2023-b`,
base `eras-model-player-pace`, after the player-pace fix 2c5979b and the wet-side fix 806ed95).
The first attempt (below, "Why the first attempt was blocked") counted ALO 2, VER 1; with both
fixes in, the counter gives **VER 5, ALO 1**, so by the hard-call rule the race is played as
Verstappen, not as the spec's draft (Alonso P2 or better). He won, so the race has no rewrite.

## Sources

| Short name | Link |
|---|---|
| WP | https://en.wikipedia.org/wiki/2023_Dutch_Grand_Prix |
| AS | https://www.autosport.com/f1/news/f1-dutch-gp-verstappen-fends-off-alonso-in-red-flagged-rain-hit-race/10512346/ |
| MS | https://www.motorsportmagazine.com/articles/single-seaters/f1/dutch-drama-was-childs-play-for-record-breaking-verstappen/ |
| Timing | OpenF1 snapshot `data/raw/netherlands-2023.parquet` (stints, positions, lap times) |
| RC | `data/raw/netherlands-2023.redflags.json` (OpenF1 race control) |

GrandPrix.com's race notes returned HTTP 429 and were not read.

## Model status

- Rebuilt locally (`pipeline build netherlands-2023`, Eras build, with this overlay). Robust G1
  (`pipeline validate netherlands-2023 --robust`): **pass** (strict pass), mean gap error 2.49 s
  (2.83 s before the overlay's side swap and moments; first attempt 2.47 s).
- `pipeline hard-calls netherlands-2023`: **VER 5, ALO 1** (chance given up VER 20.3 pts, ALO
  116.0) → side **Verstappen** (rival Alonso). Rerun on the authored model: the same. The counter
  grades on beat-rival; from Verstappen's side most of his moments have two options within 5
  points at 85-98% (stay out vs push, stay out vs box for softs), which is what counts.
- Moments (`pnpm --filter @laststint/sim author netherlands-2023 --target win --eras --write`):
  stop-11, sc-16, battle-21, stop-49, stop-61, red-64. At stop-61 box-intermediate grades 91%
  (green) and staying out on slicks 62% (red); at red-64 intermediates 97%, full wets 18%.
- Reachability (`pnpm --filter @laststint/sim reachability netherlands-2023`): **pass** at era
  difficulty (threshold 70, Standard rival, exhaustive) and at Legend (90, Expert rival), all
  three stars and the hidden objective on seed 1. The stay-out path never earns ★1 or ★3 on
  seeds 1-3.

## Facts

| Item | Fact | Source | Owner checked |
|---|---|---|---|
| Grid | Verstappen pole, Norris 2nd, Alonso 5th, Pérez 7th, Gasly 12th | WP | |
| Result | Verstappen 1st; Alonso 2nd +3.744 s; Gasly 3rd +7.058 s; Pérez 4th +10.068 s (incl. penalty); Sainz 5th +12.541 s. 72 laps | WP | |
| Record | Verstappen's ninth win in a row, equalling Vettel's record | WP, AS, MS | |
| Fastest lap | Alonso, 1:13.837, lap 56 | WP | |
| Opening rain | Heavy rain on lap 1; Pérez pitted for inters at the end of lap 1, Alonso and Verstappen at the end of lap 2 | MS (Pérez lap 1, Alonso the lap after); Timing (stints: PER inters from lap 2, ALO and VER from lap 3) | |
| Pérez leads | Pérez leads from lap 3 | Timing (positions); AS (he passed Russell and Norris, who had not pitted) | |
| Slicks | Alonso back on softs at the end of lap 10, Verstappen at the end of lap 11, Pérez a lap later; Verstappen leads from lap 12 | AS (VER lap 11, PER a lap later, lead from 12); Timing (ALO softs from lap 11) | |
| Safety car | Sargeant crashed at Turn 8 on lap 16 (SC); restart on lap 22 | AS; WP (Sargeant retired after 14 laps, hydraulics/accident) | |
| Second dry stops | Alonso end of lap 48, Verstappen end of lap 49 (both softs) | Timing | |
| Finish shower | Heavy rain on lap 60; Pérez pitted first, Verstappen on lap 61 for inters | AS | |
| Alonso to P2 | Pérez slid off at Turn 1; Alonso took second on lap 63 | AS (lap 63); MS (slid off, lost second); Timing (ALO P2 from lap 63) | |
| Red flag | Zhou crashed at Turn 1 in the rain; a VSC was upgraded to a red flag; order taken back a lap | AS; MS (backdated a lap); WP (Zhou retired after 62 laps, accident) | |
| Restart | Rolling start after a ~43-minute stoppage, eight laps left: two laps behind the SC, then a six-lap run to the flag on inters | RC ("ROLLING START PROCEDURE"); AS (43 min, eight laps, two behind the SC); MS (six-lap sprint on inters) | |
| Verstappen's calls | Inters at the end of lap 2; softs at the end of lap 11; softs at the end of lap 49; inters at the end of lap 61; full wets at the end of lap 63, then inters for the restart | Timing (VER `realStrategy`: SOFT lap 12, SOFT 50, INTERMEDIATE 62, WET 64, INTERMEDIATE 65); AS (VER lap 11 to slicks, lap 61 to inters) | |
| Takeover state | Lap 8: Pérez, Verstappen (6.1 s behind, inters 6 laps old), Zhou, Gasly, Alonso | Timing (`stateAtTakeover`) | |
| Pérez penalty | 5 s for speeding in the pit lane (during the red flag, AS) | WP, AS | |

The race model already has these events: RED lap 64 (2 laps, rolling), SC lap 66 (1 lap),
SC lap 16 (6 laps). That matches the restart row (laps 65-66 neutralised, racing 67-72), so
`docs/eras-checks/r1-red-flags.md` needs no change.

## Why the first attempt was blocked (fixed on this base)

1. **The player's car runs about 1.3 s a lap slower than every other car.** In this build every
   car's pace by stint (`stintPace`, model fix M2/W5) is -1.0 to -1.6 s (ALO -1.06, -1.62,
   -1.64; VER -1.27, -1.45, -1.64), because `basePace` is fitted on the wet opening. The
   player's car in live play takes no stint offset (`sim.ts` initRun line ~734 and stepLap
   line ~1941: "its pace is the modes'"). Result: with Alonso's real calls
   (`realDecisions`, incidents off), he finishes P14-P16 in 40 of 40 seeds; scripted, he is
   P2 in 25 of 40. The author run grades every option 0% from the takeover to lap 48. No other
   authored race has a user-side offset over 0.8 s (san-marino-2005 -0.73, spain-1996 -0.77).
   Diagnostic only (not committed): with ALO's `basePace` moved 1.45 s quicker, the real calls
   give P2 in 34 of 40 seeds.
2. **The finish shower is fitted almost dry.** The wetness timeline for laps 60-72 is 0.06-0.10.
   At w = 0.09 slicks lose 3.6% and inters 12.5% (inter curve best 0.17), so the model says
   slicks beat inters through the downpour and the red-flag restart. Real laps 67-72 on inters
   were ~81-82 s against ~74 s dry (+10%), which the inter curve also fits at w ≈ 0.29 (the wet
   side), where inters beat slicks. The fit picks the dry side because the whole field is on one
   tyre class. Effect: the author run grades box-intermediate at the lap-61 stop 0% (red) and
   staying out on slicks 100%; reachability's best path keeps slicks at lap 61 into the red flag.

Both are fixed on `eras-model-player-pace`: 2c5979b (the player's car runs its race-wide stint
offset) and 806ed95 (a wet-tyres-only lap fits on the wet side; laps 61-72 now w 0.31-0.45).

## Content (data/eras/netherlands-2023.json)

| Item | Value | Fact it rests on | Source | Owner checked |
|---|---|---|---|---|
| Side | Verstappen (`eras.userSide` VER), rival Alonso | Hard calls VER 5, ALO 1 | `pipeline hard-calls` | |
| Target | `win` | Verstappen won; P2 at the takeover | WP; Timing | |
| Rewrite | none (no `rewriteCondition` or headline) | The side really won (owner rule, Nov 8) | WP | |
| Storyline | Pole; rain on lap 1, Pérez in for inters, Verstappen and Alonso a lap later, Pérez leads; Verstappen to slicks a lap before Pérez, leads from lap 12; late rain, Zhou's crash, red flag; wins the six-lap run on inters by 3.744 s from Alonso; ninth win in a row, equalling Vettel's record | Grid, Opening rain, Pérez leads, Slicks, Red flag, Restart, Result, Record rows | WP, AS, MS, Timing | |
| Mastery | `margin` 3.7 s: "Win by more than 3.7 seconds" | Real margin 3.744 s | WP | |
| Hidden | `compound_rule` mustAvoid WET: "Never fit the full wet tyre" | Verstappen really fitted full wets at the end of lap 63, then inters for the restart | Timing | |
| Briefing | "Zandvoort, 2023 ... second and 6.1 s behind Pérez after eight laps ... the rain isn't done" | Takeover state, Grid, Finish shower rows | Timing; WP; AS | |
| storylineEvents | [63, RETIREMENT] (Zhou), [64, RED], [66, SC] (the restart's SC laps) | Red flag, Restart rows; `docs/eras-checks/r1-red-flags.md` | AS, MS, RC | |

The finish shower itself is in the weather timeline (`weather.wetness`, laps 60-72), not an
event, so it has no storylineEvent flag; Legend runs the same timeline on every attempt.

## For the owner

- The side flipped from the spec's draft (Alonso P2 or better) to Verstappen under the
  hard-call rule, as bahrain-2023 (SAI) and spain-2013 (RAI) did. If the owner wants Alonso
  kept, that is an exception like austria-2002. The draft for Alonso: target `position` 2,
  rewrite only on a win (`rewriteCondition` win, as abu-dhabi-2016), takeover lap 8, order then
  Pérez, Verstappen, Zhou, Gasly, Alonso.

# B1: Eras content for netherlands-2023 (Era 10, #5): blocked

Eras job B1 (author a passing race), Nov 9 2026. Every fact below was read in the linked
source on Nov 9 2026, or taken from the committed timing snapshot. Nothing comes from memory.
No team radio is quoted. Check each row against its source, then put your initials and the
date in **Owner checked**.

**Status: not authored.** The race passes robust G1, but two model problems make the real
calls grade badly in live play, so no `eras` block, moments or storyline were committed. See
"Why it is blocked" below.

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

- Rebuilt locally (`pipeline build netherlands-2023`, Eras build) on `eras-integrate-w1`
  (87a5d25). Robust G1: **pass** (strict pass), mean gap error 2.47 s.
- `pipeline hard-calls netherlands-2023`: ALO 2, VER 1 (chance given up ALO 344.3 pts, VER
  117.3) → side **Alonso**, as `build.py` already has (`user_side` ALO, `rival` VER).

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
| Pérez penalty | 5 s for speeding in the pit lane (during the red flag, AS) | WP, AS | |

The race model already has these events: RED lap 64 (2 laps, rolling), SC lap 66 (1 lap),
SC lap 16 (6 laps). That matches the restart row (laps 65-66 neutralised, racing 67-72), so
`docs/eras-checks/r1-red-flags.md` needs no change.

## Why it is blocked

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

Either fix is a model change (sim live pace, or the wet timeline fit) and is out of scope for an
authoring job.

## Draft content (not committed; for whoever authors it after the fixes)

- Target `position` 2 (spec §4 draft). Alonso really finished P2, so a rewrite only on a win
  (`rewriteCondition` win), as abu-dhabi-2016 does.
- Takeover lap 8 (D3 rule). Order then (Timing): Pérez, Verstappen, Zhou, Gasly, Alonso.

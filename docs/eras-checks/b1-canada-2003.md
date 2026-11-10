# B1: Eras content for canada-2003 (Era 4, #1)

Eras job B1 (author a swapped-in passing race), Nov 9 2026. The race facts and their sources are
in `docs/eras-checks/swap-races-era4-overnight.md`, section "canada-2003" (Facts table, read on
Nov 9 2026); this sheet cites its rows by topic. Nothing comes from memory. The storyline,
headline and briefing are original wording; no team radio is quoted. Check each row against its
source, then put your initials and the date in **Owner checked**.

## Sources

| Short name | Link |
|---|---|
| Swap | `docs/eras-checks/swap-races-era4-overnight.md`, canada-2003 facts (WP, Jolpica, GPE, AS, AF1 as linked there) |
| Timing | Jolpica-F1 laps (CC BY-NC-SA 4.0) and F1DB stops in `data/raw/canada-2003.parquet`, as built into `data/races/canada-2003.json` |

## Model status

- Robust G1 (`pipeline validate canada-2003 --robust`, Eras build of this branch, base
  `eras-swap-era4`): **pass** (strict fail), mean gap error 1.00 s with the rules-only overlay
  (MSCM side), 0.88 s with the eras block (played from Ralf's side).
- Reachability (`pnpm --filter @laststint/sim reachability canada-2003 --seeds 1,2,3`): **pass**
  at era difficulty (threshold 84, Smart rival) and at Legend (90, Expert rival), all three stars
  and the hidden objective on seed 1 (exhaustive search): stop-20 box next lap, pace-25 standard,
  stop-46 box, pace-57 push. The stay-out path earns no star on any seed (accuracy 75.0).

## Content

| Item | Value | Fact it rests on | Source | Owner checked |
|---|---|---|---|---|
| Side | **SCH** (Ralf Schumacher). `pipeline hard-calls`: hard calls MSCM 0, SCH 0 (tie); chance given up MSCM 0.0, SCH 2.3, so the tool picks Ralf. Kept. The swap sheet's draft and the spec §4 dilemma named Michael. | the grader, not a fact | - | |
| Rival (moments) | MSCM, the other storyline car | | | |
| Target | `win` | Ralf led at the takeover (end of lap 17: SCH P1, MSCM P2 +0.962 s) | Timing | |
| Rewrite | `win`, headline "Ralf beats his brother to the flag in Montreal" (original). Ralf did not win, so a rewrite is allowed. | M. Schumacher 1st, R. Schumacher 2nd +0.784 ("Result top 6") | Swap (Jolpica, WP, AS) | |
| Storyline | "Ralf Schumacher starts from pole and leads the first 19 laps" | "Grid top 6" (pole 1:15.529); "Leaders by lap" (R. Schumacher laps 1-19) | Swap (WP, Jolpica) | |
| Storyline | "his tyres graining in the first stint" | "Tyres" (Ralf had graining in the first stint) | Swap (AF1, GPE) | |
| Storyline | "He stops on lap 20 and keeps his front tyres" | "Stops: R. Schumacher" (lap 20, kept his front tyres) | Swap (AF1, GPE) | |
| Storyline | "Michael stops a lap later and comes out ahead" | "Stops: M. Schumacher" (lap 21; rejoined ahead of Ralf after the first stop) | Swap (AF1, AS, Jolpica) | |
| Storyline | "Ralf changes only the rears again at his second stop and loses time in traffic" | "Stops: R. Schumacher" (second stop rear tyres only, both sources; lost time in traffic after it) | Swap (AF1, AS) | |
| Storyline | "He finishes second, 0.784 s behind his brother, with Montoya third" | "Result top 6" | Swap (Jolpica, WP) | |
| Briefing | "You run Ralf Schumacher's Williams from pole, leading after 17 laps, 1.0 s ahead of your brother's Ferrari and with Montoya 8.7 s further back" | End of lap 17 (takeover, D3 rule): SCH P1, MSCM P2 +0.962 s, MON P3 8.729 s behind MSCM; "Grid top 6" | Timing; Swap | |
| Briefing | "Your tyres are graining" | "Tyres" (first-stint graining) | Swap (AF1, GPE) | |
| Briefing | "Michael will stop a lap after you" | in-laps 20 (Ralf) and 21 (Michael), "Stops" rows | Swap (AF1, Jolpica) | |
| Mastery | `stop_count` exact 2: "Win on two stops" | Ralf's two stops, in-laps 20 and 46 ("Stops: R. Schumacher") | Swap | |
| Hidden | `mode_rule` manage, max 0 laps: "Win without a lap managing the tyres". Game objective, no fact behind it. A push limit of 10 laps was tried first: the Legend path that earns all three stars pushes from lap 57 to the flag, so it can't be met there. | | | |
| storylineEvents | none. The race has no SC, VSC or red flag ("SC / VSC / red flag"); its retirements are kept in Legend anyway (`legend.ts isKept`), and none is the player's car. | | Swap | |

## Notes

- Moments (`pnpm --filter @laststint/sim author canada-2003 --target win --eras --write`):
  stop-20 (real: box, fill 26 laps), pace-25, stop-46 (real: box, fill 24 laps), pace-57, in
  `data/moments/canada-2003.json`. Every pit option carries a fill (refuelling era); the real
  calls carry the real fills (lap 20 to 46, lap 46 to the flag; the stint lengths from the
  sourced in-laps, as no source gives fill amounts). Picked from the tool's own candidates, not
  hand-adjusted.
- The win is hard: the best option at each moment is under 50% (stop-20: box next lap 43%,
  box now 30%). It stays the target because the race passes reachability with it. The winning
  path boxes a lap after Ralf really did, which is Michael's real call.
- The model doesn't know about Ralf's front tyres kept through both stops or Michael's brake
  trouble ("Brakes"); neither is in the text as a game mechanic.
- The stop laps in the moments follow the sourced in-laps (20, 46); the race file's real stops
  are on the out-laps (21, 47).
- `pipeline/src/pipeline/build.py` still names MSCM as `user_side`; the overlay's
  `eras.userSide` SCH swaps the side at export (`export.py`), as for the other hard-call sides.
- `data/races/canada-2003.json` and its golden must be built by the integrator
  (`pipeline build canada-2003`); this branch does not commit them.

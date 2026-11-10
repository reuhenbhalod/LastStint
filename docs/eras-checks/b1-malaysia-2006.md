# B1: Eras content for malaysia-2006 (Era 5, #10)

Eras job B1 (author a swapped-in passing race), Nov 9 2026. The race facts and their sources are
in `docs/eras-checks/swap-races-era5-overnight.md`, section "malaysia-2006" (Facts table, read
on Nov 9 2026); this sheet cites its rows by topic. Nothing comes from memory. The storyline,
headline and briefing are original wording; no team radio is quoted. Check each row against its
source, then put your initials and the date in **Owner checked**.

## Sources

| Short name | Link |
|---|---|
| Swap | `docs/eras-checks/swap-races-era5-overnight.md`, malaysia-2006 facts (WP, AS, Jolpica-R/Q/L as linked there) |
| Timing | Jolpica-F1 laps (CC BY-NC-SA 4.0) in `data/raw/malaysia-2006.parquet`, as built into `data/races/malaysia-2006.json` |

## Model status

- Robust G1 (`pipeline validate malaysia-2006 --robust`, Eras build of this branch, base
  `eras-swap-era5`): **pass** (strict pass), mean gap error 1.10 s, before and after the overlay.
- Reachability (`pnpm --filter @laststint/sim reachability malaysia-2006`): **pass** at era
  difficulty (threshold 82, Smart rival) and at Legend (90, Expert rival), all three stars and
  the hidden objective on seed 1 (exhaustive search), on the real stop calls (box lap 26, box
  lap 43) with push at the two pace calls. The stay-out path earns no ★3 on any seed (accuracy
  75.0; at Legend seed 3 it earns ★2 only).

## Content

| Item | Value | Fact it rests on | Source | Owner checked |
|---|---|---|---|---|
| Side | **ALO**. `pipeline hard-calls`: hard calls ALO 1, FIS 1 (tie); chance given up ALO 6.0, FIS 0.3, so the tool picks Alonso. Kept. | Fisichella's pole and simpler race; Alonso's heavy first stint | Swap ("Grid", "Strategy shape") | |
| Rival (moments) | FIS, the other storyline car from the hard-call count (the swap sheet's draft named Button) | | | |
| Target | `position` 2: "finish second or better" | Alonso 2nd, +4.585 s (Result); 3rd at the end of lap 14, the takeover lap | Swap (Jolpica-R); Timing | |
| Rewrite | `win`, headline "Alonso's long first stint takes Sepang from Fisichella" (original). Alonso did not win, so a rewrite is allowed. | Fisichella 1st, Alonso 2nd (Result) | Swap | |
| Storyline | "A fuel calculation problem leaves Alonso heavy in qualifying and he starts seventh" | "Alonso's qualifying", "Grid" | Swap (WP, Jolpica-Q) | |
| Storyline | "but he is third after the first lap" | 7th to 3rd round the outside of Turn 1 ("Start / lap 1"); P3 at the end of lap 1 | Swap (WP, AS); Timing | |
| Storyline | "His first stint runs ten laps longer than Fisichella's" | "Stops: Alonso" (WP: ten laps longer); in-laps 26 vs 17 | Swap (WP, Jolpica-L) | |
| Storyline | "he leads laps 20 to 26 and 39 to 43" | "Strategy shape" lead order | Swap (Jolpica-L) | |
| Storyline | "After a quick final stop he rejoins second, behind his team-mate and ahead of Button" | "Stops: Alonso" (AS: 6.4 s in-and-out; rejoined 2nd behind Fisichella, ahead of Button) | Swap (AS, WP) | |
| Storyline | "finishes 4.6 s behind Fisichella" | +4.585 s (Result) | Swap (Jolpica-R) | |
| Briefing | "A fuel calculation problem left Alonso heavy in qualifying, and he starts seventh" | "Alonso's qualifying", "Grid" | Swap (WP, Jolpica-Q) | |
| Briefing | "third after 14 laps and 17.9 s behind Fisichella in the lead, with Button between them" | End of lap 14: FIS P1, BUT P2 +6.229 s, ALO P3 +11.626 s behind Button (17.855 s to the lead) | Timing | |
| Briefing | "a long first stint still to run" | in-lap 26 ("Stops: Alonso") | Swap (Jolpica-L, AS) | |
| Mastery | `stop_count` exact 2: "Finish second or better on two stops" | Alonso's two stops, in-laps 26 and 43 ("Stops: Alonso") | Swap | |
| Hidden | `mode_rule` manage, max 0 laps: "Finish second or better without a lap managing the tyres". Game objective, no fact behind it. A push-laps limit (as san-marino-2005) was tried first: the only Legend path that earns all three stars pushes from lap 30 to the flag, so it can't be met there. | | | |
| storylineEvents | none. The race has no SC or red flag (row "SC / VSC / red flag"); its retirements (WEB, KLI, IDE, SPE, HEI) are kept in Legend anyway (`legend.ts isKept`), and none is the player's car. | | Swap | |

## Notes

- Moments (`pnpm --filter @laststint/sim author malaysia-2006 --target position:2 --eras
  --write`): stop-26 (real: box, fill 17 laps), pace-30, pace-34 (no real call), stop-43
  (real: box, fill 13 laps), in `data/moments/malaysia-2006.json`. Every pit option carries a
  fill (refuelling era); the real calls carry the real fills (lap 26 to 43, lap 43 to the flag;
  the stint lengths from the sourced in-laps, as no source gives fuel loads). The rival-pit
  moments at Fisichella's stops (17, 38) graded "no tension" and were not picked.
- `--target win` was measured too: every option is under 15% at every moment, so the win stays
  the rewrite, not the target.
- The stop laps in the moments follow the sourced in-laps (26, 43); the race file's real stops
  are on the out-laps (27, 44).
- `data/races/malaysia-2006.json` and its golden must be rebuilt by the integrator
  (`pipeline build malaysia-2006`); this branch does not commit them.

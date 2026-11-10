# B1: Eras content for azerbaijan-2021 (Era 9, #3)

Eras job B1 (author a passing race), Nov 9 2026. Every fact below was read in the linked
source on Nov 9 2026. Nothing comes from memory. The storyline and briefing are original
wording; no team radio is quoted. Check each row against its source, then put your initials
and the date in **Owner checked**.

## Sources

| Short name | Link |
|---|---|
| WP-AZE21 | https://en.wikipedia.org/wiki/2021_Azerbaijan_Grand_Prix (read as plain text, MediaWiki `action=raw`) |
| Timing | Jolpica-F1 laps and stops (CC BY-NC-SA 4.0) in `data/raw/azerbaijan-2021.parquet`, as built into `data/races/azerbaijan-2021.json` |
| R1 | `docs/eras-checks/r1-red-flags.md` (red flag lap 48, standing restart lap 50) |
| SC-M | `docs/eras-checks/sc-mechanics.md` (the pit-lane pass into the red flag) |
| 2.6 | `docs/eras-checks/2.6-drivers-incidents.md` (STR lap 30 and VER lap 46 tyre failures, SCs) |

## Model status

- Robust G1 (`pipeline validate azerbaijan-2021 --robust`, Eras build of this branch, base
  `eras-integrate-w1`): **pass** (strict pass), mean gap error 1.27 s, before and after the
  overlay. Same figure as the SC-mechanics job's "after".
- Reachability (`pnpm --filter @laststint/sim reachability azerbaijan-2021`): **pass** at era
  difficulty (threshold 72, Standard rival) and at Legend (90, Expert rival), all three stars
  and the hidden objective on seed 1. The stay-out path never earns ★1 or ★3 (no stop: the car
  runs its start tyres until a puncture and can't win).

## Content

| Item | Value | Fact it rests on | Source | Owner checked |
|---|---|---|---|---|
| Side | PER (hard calls PER 3, VET 0; `pipeline hard-calls`) | the grader, not a fact | - | |
| Target | `defend` (spec §4: "Pérez holds the lead at the restart") | after Verstappen's crash "Pérez was in the lead with Hamilton in second"; restart on lap 50 "using the race order at the moment of the suspension"; Pérez "led the race to the end" | WP-AZE21 race report | |
| Rewrite | none: the side really won | Pérez won | WP-AZE21 classification | |
| Storyline | "Hamilton leads early" | "At the end of lap 3, Hamilton passed Leclerc on the start–finish straight to take the lead" | WP-AZE21 | |
| Storyline | "the two Red Bulls jump him in the stops, and Pérez keeps him behind in second" | "Following the stops, both Red Bulls jumped Hamilton"; "Hamilton unsuccessfully trying to pass Pérez for second place"; VER, PER, HAM P1-P3 at the end of lap 45 | WP-AZE21; Timing | |
| Storyline | "Verstappen's left-rear tyre fails from the lead on lap 46" | fastest lap "on lap 44. Two laps later, his Red Bull RB16B suffered a left-rear tyre failure on the main straight"; VER P1 at the end of lap 45 | WP-AZE21; Timing; 2.6 | |
| Storyline | "the race is stopped, and at the standing restart on lap 50" | "the race was restarted on lap 50 with a standing start" | WP-AZE21; R1 | |
| Storyline | "Hamilton locks up into turn 1 and drops to last" | Hamilton "had inadvertently selected the wrong brake mode ... causing him to lock up at high speed and forcing him onto the escape road; Hamilton dropped to last" | WP-AZE21 | |
| Storyline | "Pérez wins by 1.385 s from Vettel" | classification: Pérez 1st, Vettel 2nd "+1.385" | WP-AZE21 classification | |
| Briefing | "Hamilton leads Verstappen, and you run Pérez in third, ten laps in" | HAM, VER, PER P1-P3 at the end of lap 10 (the takeover lap, D3 rule); "Verstappen passed Leclerc for second place. Pérez also overtook Leclerc on the following lap" | Timing; WP-AZE21 | |
| Briefing | "Hamilton will be the first of the three to stop" | "Hamilton was the first driver from the top three to make a pit stop"; HAM in on lap 11, VER 12, PER 13 | WP-AZE21; Timing | |
| Mastery | `margin` 1.4 s: "Win by more than 1.4 seconds" (beat Pérez's real margin) | Vettel "+1.385" | WP-AZE21 classification | |
| Hidden | `stop_count` exact 2: "Win on two stops" | the game's choice: Pérez's lap-13 stop plus a stop into the red flag (his real lap-47 pit-lane pass is one in the model) | Timing; SC-M | |
| storylineEvents | [31, SC] (Stroll's crash), [45, RETIREMENT] (VER), [48, RED] | Stroll's lap-30 tyre failure and "the safety car being deployed"; SC ended "after four laps and normal racing resumed on the start of lap 36" (model SC laps 31-35); VER's last lap 45; red flag lap 48 | WP-AZE21; 2.6; R1; Timing | |

## Notes

- Moments (`pnpm --filter @laststint/sim author azerbaijan-2021 --target position:2 --eras
  --write`): stop-13, pace-18, pace-26, sc-31, battle-35, prered-47
  (`data/moments/azerbaijan-2021.json`). Graded on **P2 or better**, not on the win: playouts
  don't know the future (grade.ts), so before lap 46 they never drop Verstappen and every win
  chance is 0-7%, which left no real stop call (the lap-13 stop was "no choice" and the stay-out
  path was green everywhere). P2 is the race Pérez was really in before the crash, against
  Hamilton. ★1 is still the `defend` target (win). From lap 46 on, P2-or-better and the win
  grade the same (prered-47: stay and box-soft both 100%).
- The SC on lap 31 is flagged so Legend keeps it with Stroll's kept retirement (as bahrain-2023
  keeps the VSC for Leclerc's car). Verstappen's retirement and the red flag are kept in Legend
  anyway; flagging them only records them as the storyline.
- Rejected objectives (reachability): mastery `stop_count` exact 1 (the stay-out path meets it
  in Legend after its puncture stop, and the winning paths stop twice); hidden margin 3 s (not
  reached), margin 2 s (Legend's best path wins by 1.98 s), `no_neutralized_stop` (Legend's
  only winning paths pit under the lap-31 SC, even with a beam of 16).
- Model gap seen but not changed: the race file has no SC on lap 47 (the timing shows SC-speed
  laps 47-48 before the red lap 49; the RED event covers 48-49). Robust G1 passes with it.
- The rival stays VET (registry). At the real restart Hamilton was second (WP-AZE21), so the
  moments grade against him through the P2 target, not through the rival.
- `data/races/azerbaijan-2021.json` and its golden must be rebuilt by the integrator
  (`pipeline build azerbaijan-2021`); this branch does not commit them.

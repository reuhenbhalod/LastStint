# B1: Eras content for bahrain-2012 (Era 6, #1)

Eras job B1 (author a passing race), Nov 9 2026. bahrain-2012 replaced australia-2010 in Era 6
slot #1 (owner pre-approved swap, Nov 9; `docs/eras-checks/swap-races-era6-overnight.md`, which
holds the full race facts). Every fact below was read in the linked source on Nov 9 2026.
Nothing comes from memory. The storyline and briefing are original wording; no team radio is
quoted. Check each row against its source, then put your initials and the date in **Owner
checked**.

## Sources

| Short name | Link |
|---|---|
| WP-BHR12 | https://en.wikipedia.org/wiki/2012_Bahrain_Grand_Prix (read as plain text, MediaWiki `action=raw`) |
| Timing | FastF1/Jolpica laps and stops in `data/raw/bahrain-2012.parquet`, as built into `data/races/bahrain-2012.json` |
| SWAP-E6 | `docs/eras-checks/swap-races-era6-overnight.md` (bahrain-2012 section: grid, stops, result, Autosport's Lotus story) |

## Model status

- Robust G1 (`pipeline validate bahrain-2012 --robust`, Eras build of this branch, base
  `eras-swap-era6`): **pass** (strict pass), mean gap error 1.98 s, before and after the
  overlay.
- Reachability (`pnpm --filter @laststint/sim reachability bahrain-2012`): **pass** at era
  difficulty (threshold 80, Smart rival) and at Legend (90, Expert rival), all three stars and
  the hidden objective on seed 1. The stay-out path never earns a star (seeds 1-3).

## Content

| Item | Value | Fact it rests on | Source | Owner checked |
|---|---|---|---|---|
| Side | VET (hard calls VET 3, RAI 1; `pipeline hard-calls`) | the grader, not a fact | - | |
| Rival | RAI (the other storyline driver) | Räikkönen finished second, +3.333 | WP-BHR12 classification; SWAP-E6 | |
| Target | `defend` | Vettel "started the race from pole position, leading into the first corner and for the majority of the race en route to victory" | WP-BHR12 | |
| Rewrite | none: the side really won | Vettel won | WP-BHR12 classification | |
| Storyline | "Vettel leads from pole to the flag" | as the target row; VET P1 at the end of laps 1, 8, 24, 38 and 57 in the timing (P2 on laps 12 and 40, in the stop phases) | WP-BHR12; Timing | |
| Storyline | "Räikkönen, 11th on the grid, climbs to second" | Räikkönen "climbed the field, having started in eleventh place, and challenged for the lead before finishing second" | WP-BHR12 | |
| Storyline | "is within DRS range by lap 33" | Räikkönen "was within the DRS zone on lap 33" | WP-BHR12 | |
| Storyline | "his attack at turn 1 on lap 36 doesn't come off" | "on lap 36 attempted an overtake down the inside but then under braking switched to the outside unsuccessfully" | WP-BHR12 (turn 1: SWAP-E6, Autosport) | |
| Storyline | "Vettel wins by 3.333 s, with Grosjean third" | classification: Vettel 1st, Räikkönen "+3.333", Grosjean 3rd | WP-BHR12; SWAP-E6 (Jolpica) | |
| Briefing | "leading from pole, eight laps in, five seconds clear of Grosjean's Lotus" | takeover lap 8 (author tool); end of lap 8: VET 1st, GRO 2nd +5.0 s, HAM 3rd +7.8 s, RAI 6th +11.2 s | Timing | |
| Briefing | "Räikkönen, started 11th and is sixth" | grid 11th (WP-BHR12); P6 at the end of lap 8, passed Alonso for 5th on lap 9 | WP-BHR12; Timing | |
| Briefing | "with a set of softs he saved in qualifying" | "Räikkönen and Rosberg the only drivers in the top 9 on the soft compound after both saving a set during qualifying" (lap 21) | WP-BHR12 | |
| Mastery | `margin` 3.4 s: "Win by more than 3.4 seconds" (beat Vettel's real margin) | Räikkönen "+3.333" | WP-BHR12 classification | |
| Hidden | `mode_rule` push, 0 laps: "Win without a single push lap" | the game's choice; Vettel was told to stop at the pit exit after the flag "most likely due to low fuel" | WP-BHR12 | |
| storylineEvents | none | no safety car, VSC or red flag in any source read; the build finds 0 SC periods. The race file's retirements (PIC, MAL, SEN, BUT) are not the side's car | WP-BHR12; SWAP-E6; Timing | |

## Notes

- Moments (`pnpm --filter @laststint/sim author bahrain-2012 --target win --eras --write`):
  rivalpit-11, pace-16, pace-20, stop-25, rivalpit-39 (`data/moments/bahrain-2012.json`),
  graded on the win. Vettel's real stops (in-laps 11, 25, 39; Jolpica) are the three stop
  calls; stay out is red at each (0-3%). The real compound at each is the model's (hard); the
  sources give only his last stint on mediums (WP-BHR12).
- Rejected objective (reachability): hidden `stop_count` exact 2 ("Win on two stops"): no
  winning two-stop path at era difficulty or Legend.
- `data/races/bahrain-2012.json` and its golden must be rebuilt by the integrator
  (`pipeline build bahrain-2012`); this branch does not commit them.

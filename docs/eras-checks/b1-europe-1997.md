# B1: Eras content for europe-1997 (Era 3, #6)

Eras job B1 (author a passing race), Nov 9 2026. Every fact below was read in the linked
source on Nov 9 2026. Nothing comes from memory. The storyline and briefing are original
wording; no team radio is quoted. Check each row against its source, then put your initials
and the date in **Owner checked**.

## Sources

| Short name | Link |
|---|---|
| WP-EUR97 | https://en.wikipedia.org/wiki/1997_European_Grand_Prix (read as plain text, MediaWiki `action=raw`) |
| Timing | Jolpica-F1 laps and F1DB stops in `data/raw/europe-1997.parquet`, as built into `data/races/europe-1997.json` |
| M4 | `docs/eras-checks/m4-scripted-events.md` (VIL lets HAK and COU by, lap 69) |
| S9 | `docs/eras-checks/s9-near-misses.md` (COU lets HAK by, lap 67) |

## Model status

- Robust G1 (`pipeline validate europe-1997 --robust`, Eras build of this branch, base
  `eras-swap-era3`): **pass** (strict pass), mean gap error 1.20 s, before and after the overlay.
- Reachability (`pnpm --filter @laststint/sim reachability europe-1997`): **pass** at era
  difficulty (threshold 86, Expert rival) and at Legend (90, Expert rival), all three stars and
  the hidden objective on seed 1 (best path: the real stops on laps 23 and 44, standard pace,
  ignore the lap-69 let-by). The stay-out path earns no star on seeds 1-3 (no stop: the car
  runs out of fuel).

## Content

| Item | Value | Fact it rests on | Source | Owner checked |
|---|---|---|---|---|
| Side | VIL (hard calls VIL 0, MSCM 0; chance given up VIL 0.3, MSCM 0.0 pts; `pipeline hard-calls`, tie broken by chance given up) | the grader, not a fact | - | |
| Target | `beat-rival` MSCM (spec §4: "Villeneuve ahead of Schumacher") | "Villeneuve had to finish the race in a points-scoring position ... and ahead of Schumacher to become World Drivers' Champion" | WP-EUR97 Background | |
| Rewrite | `win`, headline "Villeneuve wins at Jerez and takes the title" (original) | the side did not win: classification Häkkinen 1st, Coulthard 2nd, Villeneuve 3rd | WP-EUR97; Timing | |
| Storyline | "Schumacher leads from the start" | Schumacher "had taken the lead by the time they reached the first corner" | WP-EUR97 Race | |
| Storyline | "Frentzen lets Villeneuve into second on lap 8" | "Under the orders of the Williams team, Frentzen let teammate Villeneuve past on lap eight"; VIL P2 at the end of lap 8 | WP-EUR97; Timing | |
| Storyline | "On lap 48 Villeneuve goes for the inside at Dry Sac, Schumacher turns in on him and is out" | "Partway through the lap he attempted to overtake Schumacher at the sharp, right-hand Dry Sac corner ... Villeneuve held the inside line and was ahead on the track when Schumacher turned in on him"; the collision "caused Schumacher to retire"; MSCM's last lap 47 (race file RETIREMENT lap 47) | WP-EUR97; Timing | |
| Storyline | "Villeneuve drives on with a damaged car" | "He continued but damage to the mounts on his car's battery meant he was slower than the cars behind him" | WP-EUR97 | |
| Storyline | "lets both McLarens by on the last lap and finishes third" | "on the last lap, he had been caught by both McLarens"; Villeneuve said after the race it was better to let them through (not quoted); VIL P1 at the end of lap 68, P3 at the end of lap 69 | WP-EUR97; Timing; M4 | |
| Storyline | "0.116 s clear of Berger" | "The final margin between Villeneuve and Berger was 0.116 seconds" | WP-EUR97 | |
| Storyline | "champion by three points, and Häkkinen wins his first race" | "Third place meant Villeneuve finished ahead of Schumacher in the Drivers' Championship by three points, and became World Champion. Häkkinen's victory was the first of his career." | WP-EUR97 | |
| Briefing | "the final round. Schumacher leads the championship on 78 points, Villeneuve is one behind on 77 but holds the tie-break on wins" | "the final round"; "Schumacher was leading with 78 points; ... Villeneuve was second with 77 points"; "Villeneuve had won two more races than Schumacher ... in the event of a tie on points, the rules stated Villeneuve would be world champion" | WP-EUR97 Background | |
| Briefing | "Finish ahead of Schumacher and in the points, and the title is yours" | as the Target row | WP-EUR97 Background | |
| Briefing | "second after 19 laps, 5.6 s behind the Ferrari" | MSCM P1, VIL P2 at the end of lap 19 (the takeover lap), VIL's gap ahead 5.584 s | Timing | |
| Mastery | `finish_position` 2: "Finish in the top two" (beat his real third place) | Villeneuve 3rd | WP-EUR97; Timing | |
| Hidden | `finish_position` 1: "Win the race" | the game's choice (the rewrite) | - | |
| storylineEvents | [47, RETIREMENT] (MSCM) | the collision on lap 48; MSCM's last lap 47 | WP-EUR97; Timing | |
| Moment teamorder-69-hak | comply (real) / ignore: "Let HAK and COU through" | the lap-69 let-bys (M4's TEAM_ORDER rows, VIL lets HAK and COU by) | M4; WP-EUR97 | |

## Notes

- Moments (`pnpm --filter @laststint/sim author europe-1997 --target position:2 --eras --write`):
  stop-23, stop-44, pace-47, pace-51 (`data/moments/europe-1997.json`), plus teamorder-69-hak
  added by hand (the author tool graded it "no-tension": comply 0%, ignore 100% on P2). Kept so
  the real let-by can be played, as japan-2023 does. Graded on **P2 or better**, not on the
  rival: playouts don't know the future (grade.ts), so before lap 47 they never drop Schumacher
  and every beat-rival and win chance was 0-1% (no call survived). P2 is the race Villeneuve was
  really in before the collision. ★1 is still the `beat-rival` target.
- The author tool crashed on this race ("no stop on the final lap"): it re-offered the lap-69
  team-order candidate as a stop call. `packages/sim/scripts/authoring.ts` now keeps a team
  order's own comply / ignore options (authoring script only; no sim or Daily change).
- Schumacher's retirement is unconditional in the race file (a RETIREMENT event), so once he is
  out ★1 only needs Villeneuve to finish. The stay-out path still runs dry and earns nothing.
- Fills: the real calls carry the real fills (stop-23 box `{laps: 21}`, stop-44 box
  `{laps: 25}`); the box-next options use the standard fill.
- `data/races/europe-1997.json` and its golden must be rebuilt by the integrator
  (`pipeline build europe-1997`); this branch does not commit them.

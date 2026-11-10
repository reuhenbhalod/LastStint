# B1: Eras content for china-2013 (Era 6, #8)

Eras job B1 (author a passing race), Nov 9 2026. china-2013 replaced brazil-2012 in Era 6
slot #8 (owner pre-approved swap, Nov 9; `docs/eras-checks/swap-races-era6-overnight.md`, which
holds the full race facts and sources). Every fact below rests on a row of that sheet or on the
timing data. Nothing comes from memory. The storyline and briefing are original wording; no team
radio is quoted. Check each row against its source, then put your initials and the date in
**Owner checked**.

## Sources

| Short name | Link |
|---|---|
| WP | https://en.wikipedia.org/wiki/2013_Chinese_Grand_Prix (raw wikitext; via SWAP-E6) |
| AS | Autosport race report, "Chinese GP: Alonso takes commanding victory for Ferrari" (via SWAP-E6; read through a summarising fetch tool, check wording) |
| MS | Motor Sport, Nigel Roebuck, June 2013 (via SWAP-E6; read through a summarising fetch tool, check wording) |
| Jolpica | https://api.jolpi.ca/ergast/f1/2013/3/results/ and `.../pitstops/?limit=100` (via SWAP-E6) |
| Timing | Jolpica laps and stops in `data/raw/china-2013.parquet`, as built into `data/races/china-2013.json` |
| SWAP-E6 | `docs/eras-checks/swap-races-era6-overnight.md`, china-2013 section |

## Model status

- Robust G1 (`pipeline validate china-2013 --robust`, Eras build on this branch, base
  `eras-swap-era6-p3`): **pass** (strict pass), mean gap error 0.95 s.
- Reachability (`pnpm --filter @laststint/sim reachability china-2013`, seeds 1-3 too):
  **pass** at era difficulty (threshold 80, Smart rival) and at Legend (90, Expert rival), all
  three stars and the hidden objective. The stay-out path never earns a star (seeds 1-3).

## Content

| Item | Value | Fact it rests on | Source | Owner checked |
|---|---|---|---|---|
| Side | ALO (hard calls ALO 2, RAI 1; chance given up 1.7 / 1.7 pts; `pipeline hard-calls`) | the grader, not a fact | - | |
| Rival | RAI (the other hard-call driver) | Räikkönen finished second, +10.168 | Jolpica; WP | |
| Target | `win` (spec §4: "win: Alonso from P3") | Alonso won; grid 3rd | Jolpica; WP | |
| Rewrite | none: the side really won | Alonso won by 10.168 s | Jolpica | |
| Storyline | "Alonso starts third on softs" | grid 3rd; Alonso started on softs | Jolpica-q, WP; AS | |
| Storyline | "gets past Hamilton in the opening laps" | Alonso and Massa passed Hamilton at Turn 1 on lap 4 (WP) or 5 (AS); the conflict is why no lap is given | WP; AS | |
| Storyline | "the first of his three stops on lap 6" | stops on laps 6, 23, 41 | Jolpica; WP | |
| Storyline | "takes the lead from Vettel on lap 28" | passed Vettel for the lead on lap 28 | WP | |
| Storyline | "wins by 10.168 s" | Räikkönen +10.168 | Jolpica | |
| Storyline | "Räikkönen finishes second with a nose damaged against Pérez's McLaren" | nudged Pérez's McLaren (lap 15) and tore his nose, did not pit for it; finished 2nd | WP; AS; Jolpica | |
| Storyline | "Hamilton holds third from Vettel by 0.203 s" | Hamilton +12.322, Vettel +12.525 | Jolpica; WP | |
| Briefing | "second after 18 laps ... 0.8 s behind Button's McLaren" | takeover lap 18 (author tool); end of lap 18: BUT 1st, ALO 2nd +0.765 s, HAM 3rd +4.677 s to ALO, RAI 4th +0.759 s to HAM | Timing | |
| Briefing | "on his second set of tyres" | Alonso's first stop on lap 6 | Jolpica | |
| Briefing | "Button ... has yet to stop" | Button's stops: laps 23 and 49 | Jolpica | |
| Briefing | "Räikkönen fourth, five seconds back" | 4.677 + 0.759 = 5.4 s behind Alonso at the end of lap 18 | Timing | |
| Briefing | "The softs last only a handful of laps" | soft "guaranteed a pitstop within a handful of laps" | MS | |
| Mastery | `margin` 5 s: "Win by more than 5 seconds" (counterfactual) | the game's choice. Alonso's real margin (10.168 s) as the bar is reachable at era difficulty but not at Legend (Expert rival), see notes | Jolpica | |
| Hidden | `mode_rule` manage, 0 laps: "Never back off to save tyres" | the game's choice | - | |
| storylineEvents | none | no safety car, VSC or red flag in WP, AS or MS; the build finds 0 SC periods. The race file's only retirement (ROS, lap 22) is not the side's car | SWAP-E6; Timing | |

## Notes

- Moments (`pnpm --filter @laststint/sim author china-2013 --target win --eras --write`):
  stop-23, pace-26, pace-30, rivalpit-34, stop-41 (`data/moments/china-2013.json`), graded on
  the win. stop-23 and stop-41 are Alonso's real second and third stops (in-laps 23 and 41,
  Jolpica); stay out is red at both (4% and 38%). rivalpit-34 is Räikkönen's third stop (lap 34,
  Jolpica). The real compound at each stop is the model's (hards at 23, softs at 41); the sources
  give no compound per stop.
- Rejected objectives (reachability): mastery `margin` 10.2 s (beat the real margin): reachable
  at era difficulty, not at Legend. Hidden `stop_count` exact 1 ("one stop fewer than the real
  three"): no such path found at era difficulty. Hidden `mode_rule` push 0: Legend needs push laps
  to win by 5 s.
- `data/races/china-2013.json` and its golden must be rebuilt by the integrator
  (`pipeline build china-2013`); this branch does not commit them.

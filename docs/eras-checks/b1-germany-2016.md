# B1: Eras content for germany-2016 (Era 7, #6)

Eras job B1 (author a passing race), Nov 9 2026. germany-2016 replaced united-states-2015 in
Era 7 slot #6 (owner pre-approved swap, Nov 9; `docs/eras-checks/swap-races-era7-overnight.md`,
third round, which holds the full race facts and their sources). Every fact below comes from a
row of that sheet (each read there in the linked source) or from the timing data; no page was
re-fetched for this sheet and nothing comes from memory. The storyline and briefing are original
wording; no team radio is quoted. Check each row against its source, then put your initials and
the date in **Owner checked**.

## Sources

| Short name | Link |
|---|---|
| SWAP-E7 | `docs/eras-checks/swap-races-era7-overnight.md`, germany-2016 section (its sources: WP, MS, AS, AS-pen, GPE, J-res, J-pit) |
| MS | [Motor Sport race report, "2016 German Grand Prix" (Mark Hughes)](https://www.motorsportmagazine.com/reports/f1/2016-german-grand-prix/), as recorded in SWAP-E7 |
| AS | [Autosport race report](https://www.autosport.com/f1/news/125566/hamilton-wins-as-rosberg-ends-up-fourth), as recorded in SWAP-E7 |
| J-res / J-pit | [Jolpica results](https://api.jolpi.ca/ergast/f1/2016/12/results.json) and [pit stops](https://api.jolpi.ca/ergast/f1/2016/12/pitstops.json?limit=100), as recorded in SWAP-E7 |
| Timing | TUM laps in `data/raw/germany-2016.parquet`, as built into `data/races/germany-2016.json` |

## Model status

- Robust G1 (`pipeline validate germany-2016 --robust`, Eras build of this branch, base
  `eras-swap-era7-p3`): **pass** (strict pass), mean gap error 1.48 s, before and after the
  overlay.
- Reachability (`pnpm --filter @laststint/sim reachability germany-2016`): **pass** at era
  difficulty (threshold 78, Standard+ rival) and at Legend (90, Expert rival), all three stars
  and the hidden objective on seed 2. The stay-out path never earns ★3 (seeds 1-3).

## Content

| Item | Value | Fact it rests on | Source | Owner checked |
|---|---|---|---|---|
| Side | HAM (hard calls HAM 3, RIC 3, chance given up 0.0-0.0; tie, race-file side, as austria-2001 and san-marino-2006) | the grader, not a fact | - | |
| Rival | RIC (the other storyline driver) | Ricciardo finished second, +6.996 | J-res | |
| Target | `defend` | Hamilton led into turn 1 and won | MS, AS; J-res | |
| Rewrite | none: the side really won | Hamilton 1st, 1:30:44.200 | J-res | |
| Storyline | "Rosberg makes a poor start from pole and Hamilton leads into turn 1" | Rosberg pole (1:14.363); "poor start (wheelspin); Hamilton led into Turn 1" | SWAP-E7 (WP, J-res; MS, AS) | |
| Storyline | "with both Red Bulls also past Rosberg" | "both Red Bulls passed Rosberg, who fell to 4th"; timing end of lap 1: HAM, VER, RIC, ROS | SWAP-E7 (MS, AS); Timing | |
| Storyline | "In the heat the tyres wear faster than expected and the leaders all stop three times" | sunny, high track temperatures; "Higher degradation than expected: the hotter the track, the more the race moved to three stops"; HAM, ROS, RIC, VER, VET, RAI three stops each | SWAP-E7 (MS, AS, J-pit) | |
| Storyline | "Rosberg gets a 5 s penalty for forcing Verstappen off at the hairpin on lap 27" | "Lap 27 (MS): Rosberg dived inside Verstappen into the Turn 6 hairpin and pushed him wide off track. 5 s time penalty" | SWAP-E7 (MS, AS, AS-pen, WP) | |
| Storyline | "serves it at his last stop, which runs about 3 s long, so both Red Bulls get ahead" | penalty "served at his final stop"; the stopwatch "failed, adding ~3 s stationary; both Red Bulls pitted on the next two laps and rejoined ahead" | SWAP-E7 (MS, AS) | |
| Storyline | "Verstappen later lets Ricciardo by" | "Around lap 40 Verstappen let Ricciardo through on team instruction" (MS); no lap given in the storyline because MS gives only "around" | SWAP-E7 (MS, AS) | |
| Storyline | "Hamilton wins by 7.0 s from Ricciardo, with Verstappen third" | Ricciardo +6.996, Verstappen +13.413 | J-res | |
| Briefing | "Hockenheim, 2016 ... nine laps in, leading Verstappen by 3.8 seconds. Ricciardo is third, 5.5 seconds back, and Rosberg fourth" | takeover lap 9 (race file); end of lap 9: HAM 1st, VER +3.8 s, RIC +5.5 s, ROS +6.6 s | Timing | |
| Briefing | "after a poor start from pole" | as the storyline row | SWAP-E7 (MS, AS) | |
| Briefing | "The tyres are wearing faster than expected in the heat" | as the storyline row | SWAP-E7 (MS, AS) | |
| Mastery | `stop_count` exact 3: "Win on three stops, as Hamilton did" | Hamilton stopped three times (in-laps 14, 34, 47) | SWAP-E7 (J-pit, AS) | |
| Hidden | `mode_rule` manage, 0 laps: "Win without a single lap managing the tyres" | the game's choice, not a fact | - | |
| storylineEvents | none | no safety car, VSC or red flag in any source read (SWAP-E7); the TUM track status is green on every lap. The race file's retirements (MAS lap 39, NAS lap 61 in the model) are not the side's car | SWAP-E7; Timing | |

## Notes

- Moments (`pnpm --filter @laststint/sim author germany-2016 --target win --eras --write`):
  stop-14, pace-17, pace-21, stop-34, stop-47 (`data/moments/germany-2016.json`), graded on the
  win. Hamilton's real stops (in-laps 14, 34, 47; J-pit) are the three stop calls; stay out is
  red at each (1-15%). The model's best compound at each (medium, soft, medium in the model's
  names) matches the real soft, supersoft, soft (SWAP-E7: AS, MS), since the weekend's medium /
  soft / supersoft are built as HARD / MEDIUM / SOFT.
- Rejected objectives (reachability): mastery `margin` 7 s (beat Hamilton's real 6.996 s) and
  `margin` 5 s: ★3 not reached at Legend against the Expert rival; hidden `stop_count` exact 2
  ("Win on two stops", after Red Bull's original two-stop plan for Ricciardo): no winning
  two-stop path at era difficulty.
- `data/races/germany-2016.json` and its golden must be rebuilt by the integrator
  (`pipeline build germany-2016`); this branch does not commit them.
- Catalog dilemma and spec §4 target rewritten for the Hamilton side ("Leading from the start as
  the tyres fade in the heat: time three stops against two Red Bulls on split strategies";
  `defend: Hamilton holds P1`). Red Bull's split strategies: MS, via SWAP-E7 ("Red Bull split"
  row). The swap sheet's Ricciardo drafts are not used.

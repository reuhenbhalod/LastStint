# B1: Eras content for great-britain-2007 (Era 5, #5)

Eras job B1 (author a passing race), Nov 9 2026. great-britain-2007 replaced china-2007 in the
overnight Era 5 swap (`swap-races-era5-overnight.md`). Every fact below rests on a row of that
sheet's great-britain-2007 section (sources WP, AS, GPE, GPE-inc, Jolpica, F1DB, read there on
Nov 9 2026) or on the built timing; nothing comes from memory. The storyline and briefing are
original wording; no team radio is quoted. Check each row against its source, then put your
initials and the date in **Owner checked**.

## Sources

| Short name | Link |
|---|---|
| SWAP | `docs/eras-checks/swap-races-era5-overnight.md`, section "great-britain-2007" (WP, AS, GPE, GPE-inc, Jolpica, F1DB as listed there) |
| Timing | Jolpica laps and F1DB stops in `data/raw/great-britain-2007.parquet`, as built into `data/races/great-britain-2007.json` (Eras build of this branch) |

## Model status

- Robust G1 (`pipeline validate great-britain-2007 --robust`, Eras build of this branch, base
  `eras-swap-era5`): **pass** (strict pass), mean gap error 0.58 s, before and after authoring.
- Reachability (`pnpm --filter @laststint/sim reachability great-britain-2007`): **pass** at
  era difficulty (threshold 82, Smart rival; seed 1) and at Legend (90, Expert rival; seed 3),
  all three stars and the hidden objective. The stay-out path never earns ★1 or ★3.

## Content

| Item | Value | Fact it rests on | Source | Owner checked |
|---|---|---|---|---|
| Side | RAI, rival HAM (hard calls RAI 1, HAM 0; chance given up RAI 2.3, HAM 0.7; `pipeline hard-calls`). `build.py` now builds the race for RAI vs HAM (it was the provisional HAM vs RAI) | the grader, not a fact | - | |
| Target | `win` | Räikkönen 1st, Alonso +2.459, Hamilton +39.373 | SWAP "Result" (Jolpica, WP) | |
| Rewrite | none: the side really won | Räikkönen won | SWAP "Result" | |
| Storyline | "Hamilton starts from pole and leads the first stint" | Hamilton pole (1:19.997); Hamilton led laps 1-15 | SWAP "Grid", "Leaders" (F1DB, WP, AS) | |
| Storyline | "Räikkönen, alongside him on the front row, stops two laps later and comes out ahead of him" | Räikkönen 2nd on the grid; stops lap 18 vs Hamilton lap 16; "Rejoined ahead of Hamilton at the first" | SWAP "Grid", "Stops: Räikkönen", "Stops: Hamilton" (F1DB, AS) | |
| Storyline | "but Alonso's short first stop puts the second McLaren in front" | Alonso's lap-20 stop "was short and he rejoined just ahead of Räikkönen"; Alonso led from his lap-20 stop | SWAP "Stops: Alonso", "Leaders" (AS, F1DB) | |
| Storyline | "Räikkönen runs longer again at the second stops, takes the lead for good on lap 43" | second stops Alonso lap 37, Räikkönen lap 43; Räikkönen "third and final leader" after his lap-43 stop, about four seconds clear of Alonso | SWAP "Stops", "Leaders" (F1DB, AS) | |
| Storyline | "wins by 2.459 s from Alonso, with Hamilton third" | Alonso +2.459, Hamilton +39.373 | SWAP "Result" (Jolpica, WP) | |
| Briefing | "Hamilton took pole for McLaren" | Hamilton pole; Hamilton's team McLaren | SWAP "Grid"; Timing (team) | |
| Briefing | "You run Räikkönen's Ferrari, second and half a second behind him after 13 laps, with Alonso's McLaren 2.4 s further back" | model state at the takeover (lap 13, D3 rule): HAM P1, RAI P2 0.46 s behind, ALO P3 2.365 s behind RAI | Timing | |
| Briefing | "Two stops each, and the fuel you take decides the order" | Hamilton laps 16/38, Räikkönen 18/43, Alonso 20/37; Alonso's light fill at his first stop | SWAP "Stops", "Fuel" (F1DB, AS, GPE, WP) | |
| Mastery | `margin` 2.4 s: "Win by more than 2.4 seconds" (about Räikkönen's real 2.459 s margin) | Alonso +2.459 | SWAP "Result" | |
| Hidden | `mode_rule` manage, max 0 laps: "Win without a single lap managing the tyres" | the game's choice. (Räikkönen tried to "save some fuel and look after tyres" early on, GPE; the objective is not a claim about his race) | SWAP "Fuel" (GPE) | |
| storylineEvents | none | no SC, VSC or red flag; no front-runner retirement, contact or penalty | SWAP "SC / VSC / red flag", "Retirements", "Contact", "Penalties" | |

## Notes

- Moments (`pnpm --filter @laststint/sim author great-britain-2007 --target win --eras
  --write`): stop-18, pace-29, pace-37, stop-43 (`data/moments/great-britain-2007.json`).
  The real calls carry the real fills: stop-18 box-hard `{laps: 25}`, stop-43 box-soft
  `{laps: 16}`.
- **Hand-adjusted moment (owner-accepted pattern):** at stop-18 the author tool's box-soft
  option carried the `standard` fill (21 laps). It graded green (69%) but never won live on any
  seed at the era's Smart rival, and the only winning stop (the real box-hard, 25 laps) grades
  orange (55%), so the beam search cut it and the race was unreachable at era difficulty. The
  box-soft option now carries the real call's fill (`{laps: 25}`); with it the race is reachable
  at both difficulties.
- Rejected hidden objectives (reachability): push at most 8 laps and push at most 25 laps (the
  only paths kept push from lap 29, so neither was met at either difficulty).
- The race file is RAI vs HAM, while the real fight for the win was with Alonso (2nd); the
  draft proposal suggested Alonso vs Räikkönen. `pipeline hard-calls` counts only the build
  pair, so Alonso's side was not counted. Owner to decide whether to rebuild as RAI vs ALO and
  re-count.
- `data/races/great-britain-2007.json` and its golden must be rebuilt by the integrator
  (`pipeline build great-britain-2007`); this branch does not commit them.

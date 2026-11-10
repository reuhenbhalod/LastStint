# B1: Eras content for hungary-2007 (Era 5, #7)

Eras job B1 (author a passing race), Nov 9 2026. hungary-2007 replaced brazil-2007 in the
Era 5 third batch (`swap-races-era5-overnight.md`). Every fact below rests on a row of that
sheet's hungary-2007 section (sources WP, GPE-n, GPE-q, GPE-h, AS-st, AS-rv, Jolpica-r, F1DB,
read there on Nov 9 2026) or on the built timing; nothing comes from memory. The storyline,
headline and briefing are original wording; no team radio is quoted. Check each row against its
source, then put your initials and the date in **Owner checked**.

## Sources

| Short name | Link |
|---|---|
| SWAP | `docs/eras-checks/swap-races-era5-overnight.md`, section "hungary-2007" (WP, GPE-n, GPE-q, GPE-h, AS-st, AS-rv, Jolpica-r, F1DB as listed there; WP, GPE-h and the AS rows were read through a fetch tool's summary) |
| Timing | Jolpica laps and F1DB stops in `data/raw/hungary-2007.parquet`, as built into `data/races/hungary-2007.json` (Eras build of this branch) |

## Model status

- Robust G1 (`pipeline validate hungary-2007 --robust`, Eras build of this branch, base
  `eras-swap-era5-p3`): **pass** (strict pass), mean gap error 1.85 s.
- Reachability (`pnpm --filter @laststint/sim reachability hungary-2007`): **pass** at era
  difficulty (threshold 82, Smart rival; seed 1) and at Legend (90, Expert rival; seed 1), all
  three stars and the hidden objective. The stay-out path never earns any star (seeds 1-3).

## Content

| Item | Value | Fact it rests on | Source | Owner checked |
|---|---|---|---|---|
| Side | RAI, rival HAM (hard calls HAM 0, RAI 0; tie settled by chance given up: RAI 9.7, HAM 0.0; `pipeline hard-calls`). `build.py` now builds the race for RAI vs HAM (it was the provisional HAM vs RAI) | the grader, not a fact | - | |
| Target | `win` | Hamilton 1st, Räikkönen +0.715 | SWAP "Result" (Jolpica-r, WP) | |
| Rewrite | condition `win`; headline "Räikkönen beats Hamilton to the Hungaroring win" (original) | Räikkönen did not win, so a rewrite is allowed | SWAP "Result" | |
| Storyline | "Alonso's grid penalty hands Hamilton pole" | Alonso fastest in Q3, lost 5 places for impeding Hamilton; Hamilton promoted to pole | SWAP "Grid penalties" (AS-st, WP, GPE-n) | |
| Storyline | "and he leads every lap" | Hamilton led every lap | SWAP "Hamilton" (WP) | |
| Storyline | "Räikkönen passes Heidfeld at the start" | Räikkönen passed Heidfeld for 2nd at the start (grid: Heidfeld 2nd, Räikkönen 3rd) | SWAP "Start / lap 1", "Grid" (GPE-n, GPE-h, WP, Jolpica-r) | |
| Storyline | "both stop on lap 19" | Hamilton stops laps 19 and 50; Räikkönen laps 19 and 46 | SWAP "Hamilton", "Räikkönen" (GPE-n, F1DB) | |
| Storyline | "Räikkönen stops again four laps before Hamilton, but never gets back in front" | second stops lap 46 (RAI) vs lap 50 (HAM); Hamilton led every lap | SWAP "Hamilton", "Räikkönen" (F1DB, WP) | |
| Storyline | "He closes to half a second by lap 57 and finishes 0.715 s behind" | Lap 57: 0.5 s; finish 0.715 s | SWAP "Gaps, middle and late" (GPE-n, Jolpica-r) | |
| Briefing | "Alonso's grid penalty hands Hamilton pole" | as above | SWAP "Grid penalties" | |
| Briefing | "You run Räikkönen's Ferrari, second and 4.6 s behind the McLaren after 16 laps, with Heidfeld's BMW 8.3 s further back" | model state at the takeover (lap 16, D3 rule): HAM P1, RAI P2 4.554 s behind, HEI P3 8.27 s behind RAI. Sources agree on the order and gap size (GPE-h lap 13: 4.6 s; GPE-n lap 15: 4.5 s, Heidfeld 10 s further back) | Timing; SWAP "Gaps, first stint" | |
| Briefing | "Two stops each, and the fuel you take at the first decides the order" | both two-stoppers (HAM 19/50, RAI 19/46); Räikkönen said afterwards the fuel choice at the first stop decided the result (press quote, paraphrased) | SWAP "Hamilton", "Räikkönen" (F1DB, GPE-n, GPE-q) | |
| Mastery | `margin` 0.7 s: "Win by more than 0.7 seconds" (counterfactual: Hamilton's real winning margin, 0.715 s, turned round) | Räikkönen +0.715 | SWAP "Result" | |
| Hidden | `mode_rule` push, max 0 laps: "Win without pushing for a single lap" | the game's choice, not a claim about the real race | - | |
| storylineEvents | none | no SC, VSC or red flag; no top-six car retired; no front-runner contact or race penalty | SWAP "Safety car / red flag", "Retirements", "Contact", "Penalties (race)" | |

## Notes

- Moments (`pnpm --filter @laststint/sim author hungary-2007 --target win --eras --write`):
  rivalpit-19, stop-46, pace-56, pace-60, battle-64 (`data/moments/hungary-2007.json`), as the
  tool picked them; no hand adjustment. The real calls carry the real fills: rivalpit-19
  box-hard `{laps: 27}` (lap 19 to the lap-46 stop), stop-46 box-hard `{laps: 24}` (to the
  flag). Every other pit option carries the `standard` fill. Compounds per stint are not
  sourced (SWAP "Compounds"); the model's compounds are estimates.
- The reachable paths take box-next-hard at lap 19 (stop a lap after Hamilton), so the
  winning line is a counterfactual (the real lap-19 call grades orange, 12%).
- The real fight for 3rd (Heidfeld three stops vs Alonso two, 1.729 s) is not in the build
  pair; SWAP's draft names it as an alternative story. `pipeline hard-calls` counts only the
  build pair.
- `data/races/hungary-2007.json` and its golden must be rebuilt by the integrator
  (`pipeline build hungary-2007`); this branch does not commit them.
- `tests/test_sc_rates.py::test_rebuild_matches_the_committed_file` fails here with the
  locally built third-batch race files present (two more races than `data/sc_rates.json`
  counts); the integrator regenerates it.

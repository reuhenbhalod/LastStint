# B1: Eras content for portugal-2021 (Era 9, #5)

Eras job B1 (author a passing race), Nov 9 2026. portugal-2021 is a Gauntlet race swapped into
Era 9 for hungary-2021 (owner pre-approved, Nov 9), so it is a **shared race**: its race file,
golden and Gauntlet hash stay frozen, and everything below lives only in
`data/eras/portugal-2021.json`. The facts come from the swap sheet
(`swap-races-era9-overnight.md`), whose rows were read in the linked sources on Nov 9 2026;
nothing here comes from memory. The storyline and briefing are original wording; no team radio
is quoted. Check each row against its source, then put your initials and the date in **Owner
checked**.

## Sources

| Short name | Link |
|---|---|
| Swap | `docs/eras-checks/swap-races-era9-overnight.md` (portugal-2021 facts table) |
| GPE | [GrandPrix.com race notes](https://www.grandprix.com/races/portuguese-gp-2021-race-notes.html) |
| MS-LBL | [Motor Sport lap by lap](https://www.motorsportmagazine.com/articles/single-seaters/f1/hamilton-seizes-portimao-victory-2021-portuguese-grand-prix-lap-by-lap-report/) |
| WP | [English Wikipedia, 2021 Portuguese Grand Prix](https://en.wikipedia.org/wiki/2021_Portuguese_Grand_Prix) |
| Jolpica | [api.jolpi.ca/ergast/f1/2021/3/results.json](https://api.jolpi.ca/ergast/f1/2021/3/results.json) |
| Timing | `data/races/portugal-2021.json` (frozen Gauntlet file: stop laps, takeover lap 32) |

## Model status

- Robust G1 (`pipeline validate portugal-2021 --robust`, the committed race file; a shared race
  is never rebuilt): **pass** (strict pass), mean gap error 0.77 s, as in the swap sheet.
- Reachability (`pnpm --filter @laststint/worker reachability:shared portugal-2021`): **pass** at
  era difficulty (threshold 72, Standard rival) and at Legend (90, Expert rival): all three stars
  and the hidden objective on seed 1 (rivalpit-35 box-hard, then stay, stay; accuracy 100). The
  stay-out path earns neither ★1 nor ★3 on seeds 1-3 (no stop at all: live play makes no stop
  the player doesn't call).

## Content

| Item | Value | Fact it rests on | Source | Owner checked |
|---|---|---|---|---|
| Side | HAM (hard calls HAM 1, VER 0; chance given up VER 6.0, HAM 0.0; `pipeline hard-calls`) | the grader, not a fact | - | |
| Target | `defend` (spec §4: "Hamilton holds P1") | Hamilton leads at the lap-32 takeover (race file position 1); led from lap 20; won | Timing; GPE; MS-LBL; Jolpica | |
| Rewrite | none: the side really won | Hamilton 1st | Jolpica | |
| Storyline | "Hamilton passes Bottas for the lead on lap 20" | Hamilton passed Bottas around the outside of Turn 1 on lap 20 | GPE; MS-LBL | |
| Storyline | "keeps his mediums until lap 38, two laps after Red Bull stops Verstappen" | the front four started on mediums; Verstappen stopped lap 36, Bottas 37, Hamilton 38, all to hards (Jolpica's pit-stop list has each one lap earlier; GPE/MS-LBL and the race file taken) | GPE; MS-LBL; Timing | |
| Storyline | "He comes out ahead of both" | Bottas came out ahead of Verstappen and lost the place on cold tyres; Hamilton rejoined 2nd behind the unstopped Pérez, ahead of Verstappen | GPE; MS-LBL | |
| Storyline | "passes the one-stopping Pérez on lap 51" | Hamilton passed Pérez with DRS on lap 51; Pérez stopped once, on lap 52 | MS-LBL; GPE | |
| Storyline | "wins by 29.148 s from Verstappen" | Verstappen +29.148 | Jolpica; WP | |
| Briefing | "leading Bottas by 3.3 s on worn mediums after 30 laps, with Verstappen close behind" | lap 30: Hamilton leads Bottas by 3.3 s, Verstappen +3.7; Hamilton told the team about his tyre wear (not quoted) | GPE | |
| Briefing | "Hamilton, Bottas and Verstappen all still have to stop for hards" | each stopped once for hards on laps 36-38 (Bottas and Verstappen added late optional stops for softs on laps 64 and 65, for fastest lap) | GPE; MS-LBL | |
| Briefing | "Pick your lap before Red Bull tries the undercut" | Mercedes planned to stop Bottas to protect against a Red Bull undercut; Red Bull stopped Verstappen first, on lap 36 | MS-LBL; GPE | |
| Mastery | `margin` 30 s: "Win by more than 30 seconds" (beat Hamilton's real 29.148 s margin) | Verstappen +29.148 | Jolpica | |
| Hidden | `stop_count` exact 1: "Win on one stop" | the game's choice; Hamilton's real race was one stop | GPE; Timing | |
| storylineEvents | none | no SC, VSC or red flag after the takeover; the race file has no events | Swap; 2.6 | |

## Notes

- Moments (`pnpm --filter @laststint/sim author portugal-2021 --target win --eras --write`, from
  Hamilton's side, written into the overlay's `decisionMoments`): rivalpit-35 (real option: stay,
  he stopped on lap 38), cliff-52, rivalpit-64. Hamilton is the fastest car after the takeover, so
  the win grades 91-100% on most options; the pace calls (laps 36-60) and the lap-37 stop were
  "no choice" and dropped. Box-medium at lap 35 grades orange (93%), the late boxes at lap 64
  orange (91%).
- Mastery: a margin can't be met by the stay-out path (it doesn't win). The checker's best path
  (box for hards at lap 35) wins by more than 30 s on seed 1 at both difficulties.
- Tests: `apps/worker/test/eras-shared.test.ts` and `pipeline/tests/test_shared_races.py` now
  treat portugal-2021 as authored (the rules-only case is gone); its Eras hash is the file with
  this overlay (`2a0aa501…`), and the parity vectors were regenerated. The worker test needs
  `apps/worker/src/races.gen.ts` regenerated (`pnpm --filter @laststint/worker races`) by the
  integrator; this branch does not commit it.

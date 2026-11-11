# B1: Eras content for san-marino-2003 (Era 4, #10)

Eras job B1 (author a passing race), Nov 9 2026. san-marino-2003 replaced monaco-2004 in the
Era 4 swaps (owner pre-approved, Nov 9; `swap-races-era4-overnight.md`). Every fact below was
read in the sources of that sheet's san-marino-2003 section (read on Nov 9 2026) or in the
built race; nothing comes from memory. The storyline and briefing are original wording; no team
radio is quoted. Check each row against its source, then put your initials and the date in
**Owner checked**.

## Sources

| Short name | Link |
|---|---|
| SWAP | `docs/eras-checks/swap-races-era4-overnight.md`, section "san-marino-2003": its sources WP (https://en.wikipedia.org/wiki/2003_San_Marino_Grand_Prix), GPE (https://www.grandprix.com/gpe/rr701.html), GPE-N (GrandPrix.com race notes), AS-A (Atlas F1 race review, atlasf1.autosport.com), Jolpica-R / Jolpica-L (results, lap timings) |
| RACE | `data/races/san-marino-2003.json` (Eras build of this branch), `stateAtTakeover` at the takeover lap 15 (D3 rule) |

## Model status

- Robust G1 (`pipeline validate san-marino-2003 --robust`, Eras build, base `eras-swap-era4`):
  **pass** (strict pass), mean gap error 1.44 s, before and after the overlay.
- Reachability (`pnpm --filter @laststint/sim reachability san-marino-2003`): **pass** at era
  difficulty (threshold 84, Smart rival) and at Legend (90, Expert rival), all three stars and
  the hidden objective on seed 1 (stop-18 box-medium, pace-23 push, pace-27 push-attack, stop-34
  box-medium, stop-49 box-medium; accuracy 99.3 / 99.2). The stay-out path earns no star in
  either (accuracy 80).

## Content

| Item | Value | Fact it rests on | Source | Owner checked |
|---|---|---|---|---|
| Side | MSCM (hard calls MSCM 0, RAI 0; tie settled by chance given up, MSCM 52.3 pts vs RAI 20.3; `pipeline hard-calls`) | the grader, not a fact | - | |
| Target | `position` 2: top two (owner-accepted pattern: a position target when the win is unreachable; see Notes) | M. Schumacher 1st, Räikkönen 2nd +1.882 | SWAP (Jolpica-R, GPE, AS-A) | |
| Rewrite | none: the side really won | M. Schumacher won, 1:28:12.058 | SWAP (Jolpica-R) | |
| Storyline | "Ralf Schumacher leads the opening laps for Williams with Michael right behind him" | leaders: R. Schumacher laps 1-15; lap 10 Ralf leads Michael by 0.5 s; RACE: SCH P1, MSCM P2 (+0.807 s) at lap 15 | SWAP (Jolpica-L, AS-A); RACE | |
| Storyline | "A quick lap just before his first stop takes Michael ahead of his brother" | lap 17 fastest lap (1:22.491) to jump Ralf; emerged ahead of him | SWAP (GPE, AS-A) | |
| Storyline | "he wins on three stops" | M. Schumacher three stops, laps 18, 34, 49 | SWAP (AS-A, GPE, Jolpica-L) | |
| Storyline | "Räikkönen runs long on two stops from sixth on the grid and finishes second, 1.882 s behind" | grid 6 Räikkönen; two stops, laps 22 and 44, "the exception to the rule"; 2nd +1.882 | SWAP (WP, Jolpica-R, AS-A) | |
| Storyline | "Barrichello passes Ralf for third late on" | passed Ralf on lap 52 out of the final chicane for 3rd | SWAP (GPE, AS-A, GPE-N) | |
| Briefing | "Ralf Schumacher's Williams has led from the front row" | grid 2 R. Schumacher (+0.014 s to pole); led laps 1-15 | SWAP (WP, Jolpica-R, Jolpica-L) | |
| Briefing | "you run Michael Schumacher's Ferrari, right behind him fifteen laps in" | RACE: MSCM P2, 0.807 s behind SCH at the takeover (lap 15) | RACE | |
| Briefing | "Ferrari and Williams are on three stops; Räikkönen's McLaren is running long on two" | Ferrari and Williams three stops, McLaren two | SWAP (GPE, GPE-N, AS-A) | |
| Mastery | `stop_count` exact 3: "Finish in the top two on three stops" | Michael's three stops (laps 18, 34, 49, all after the takeover) | SWAP (AS-A, Jolpica-L) | |
| Hidden | `team_result` [2, 3]: "Top two with Barrichello on the podium" | Barrichello 3rd +2.291 | SWAP (Jolpica-R) | |
| Real fills | stop-18 `{laps:16}`, stop-34 `{laps:15}`, stop-49 `{laps:13}` (the model's fills to the next real stop or the flag; fuel loads are not in sources) | stop laps 18, 34, 49 | RACE; SWAP | |
| storylineEvents | none: no SC, VSC or red flag; no front-runner retired | "No source mentions a safety car"; retirements Villeneuve, Wilson, Verstappen, Firman, Webber, Fisichella | SWAP (GPE-N, AS-A, GPE, WP, Jolpica-R) | |

## Notes

- Moments (`pnpm --filter @laststint/sim author san-marino-2003 --target position:2 --eras
  --write`): stop-18 (real: box-medium), pace-23, pace-27, stop-34 (real: box-medium), stop-49
  (real: box-medium) (`data/moments/san-marino-2003.json`). Graded on **P2 or better**.
- **Why not the win.** With the win as target (`--target win`; moments stop-18, pace-23, pace-27,
  stop-34, rivalpit-44), the best path (all calls green, accuracy 100) missed ★1 on seeds 1-3 at
  both difficulties. In 200 seeds with the real calls, live play (Smart rival) gives Michael the
  win in 52 (Räikkönen 100), against 128 of 200 in the scripted replay. The gap is the known
  live-player stint-offset bug (commit 876a585 reverted the player's stint pace offset; logged
  under B3): Michael's fitted stint offsets are -0.564 s and -0.334 s a lap after his first two
  stops, which the live car doesn't get. If B3 fixes it, re-check `--target win` and a `defend`
  style win target.
- Rejected objective (reachability): hidden `finish_position` 1 ("Win, as Schumacher did"):
  reached at era difficulty, not at Legend.
- Montoya's short fill (lap 30), Barrichello's slow third stop and Michael letting Barrichello by
  on lap 50 are not scripted (none decides the player's top-two target).
- `data/races/san-marino-2003.json` and its golden are new and untracked; the integrator builds
  them (`pipeline build san-marino-2003`). This branch does not commit them.

# A4 contact and damage: owner sign-off

Eras job A4 (collisions), Nov 8 2026. Every fact below was read in the linked source. Nothing
comes from memory. Where a source gives no lap, the row says where the lap came from. Check
each row against its links, then put your initials and the date in **Owner checked**.

A collision is the existing FAULT event with a new kind, `fault: "damage"` (no new system):
its contact lap is a fitted slow lap, and its damage a fitted pace loss for `laps` laps (absent:
to the flag). No source names damage for Albon, Hamilton (2019) or Verstappen, so those items
have `laps: 1`: the contact lap only. The magnitudes are fitted from the car's real laps
(`pipeline/faults.py`), never written. On its contact lap the car is out of the lap's pass
rolls, like a car making a stop: it spun or went off, so it doesn't hold up the cars behind.

G1 is robust mode (`pipeline validate <id> --robust`: 1,000 runs on each of two seed sets, one
race per call). Before = `eras` at a193b45. After = this branch. The three races were rebuilt
into a scratch directory only (`pipeline build <id> --out <scratch>`); no `data/races` or
`data/golden` file was committed, and no Daily or Gauntlet file changed.

## Sources

| Short name | Link |
|---|---|
| WP-BRA19 | https://en.wikipedia.org/wiki/2019_Brazilian_Grand_Prix |
| GP-HUN24 | https://www.grandprix.com/races/hungarian-gp-2024-race-notes.html |
| AS-HUN24 | https://www.autosport.com/f1/news/fia-hamilton-could-have-done-more-to-avoid-verstappen-clash-but-no-action-taken/10637398/ |
| WP-HUN24 | https://en.wikipedia.org/wiki/2024_Hungarian_Grand_Prix |
| WP-EUR12 | https://en.wikipedia.org/wiki/2012_European_Grand_Prix |

Wikipedia was read as plain text through the MediaWiki API (`action=raw`). GrandPrix.com was
read as the page's HTML. Autosport was read through a fetch tool.

## G1 before and after

| Race | Before | After | What changed |
|---|---|---|---|
| brazil-2019 | fail, 1.97 s (duel HAM vs GAS gap error 4.46 / 4.53 [3.00]) | pass (strict fail), 1.52 s | ALB's spin (slow lap 10.12 s) and HAM's contact (2.75 s), lap 70. Every check passes on both seed sets |
| hungary-2024 | fail, 1.96 s (field LEC gap error 5.12 / 5.15 [5.00]) | borderline, 2.58 s (one seed set: LEC 5.02, VER 5.03 [5.00]) | VER's contact lap 63 (slow lap 5.85 s). VER now ends behind LEC as in the real race. Without it the sim's VER ends 20.8 s back, ahead of LEC (24.7 s); with it 26.3 s (real 21.35 s). The sim's LEC was already 5 s too far back, and VER's gap now follows LEC's |
| europe-2012 | fail, 1.46 s (podium MSCM gap error 5.38 / 5.15 [5.00]) | pass, 1.16 s | MAL's lost front wing from lap 56 to the flag (pace loss 14.22 s a lap, slow lap 0). Every check passes on both seed sets |

Reachability (`pnpm --filter @laststint/sim reachability <file>`, the scratch builds): brazil-2019
and europe-2012 still pass at era difficulty and Legend. hungary-2024 has no `eras` block (not
authored).

## Collisions (`data/incidents.json`, `type: "FAULT"`, `fault: "damage"`)

| Race | Item | Fact | Sources | Lap from | Owner checked |
|---|---|---|---|---|---|
| brazil-2019 | FAULT, ALB, Collision (damage), lap 70, turn 10, `laps: 1` | "At the race restart, on lap 70, Hamilton passed Gasly, but later made contact with Albon while trying to pass him at turn 10. Albon was sent into a spin and was forced to rejoin the field in fifteenth position." | WP-BRA19 | WP. No damage named: the contact lap only. Timing: ALB lap 70 84.2 s (GAS 75.3 s), P2 to P15 | |
| brazil-2019 | FAULT, HAM, Collision (damage), lap 70, turn 10, `laps: 1` | "Hamilton, too, was slowed by the contact, allowing Gasly to pass into second place." (His five-second penalty is in the result, not here.) | WP-BRA19 | WP. No damage named: the contact lap only | |
| hungary-2024 | FAULT, VER, Collision (damage), lap 63, turn 1, `laps: 1` | GP-HUN24: "On lap 63 Verstappen tries to get by Hamilton in the DRS at turn 1 and dives down the inside out of control, the two touch and Verstappen goes off track and Leclerc passes for fourth." AS-HUN24: "battling for third place on lap 63 when Verstappen made an attempt to draft past his rival under braking for Turn 1". WP-HUN24: "an attempted overtake from Verstappen caused a collision between the two"; "Verstappen finished in fifth after losing fourth to Charles Leclerc due to the collision" | GP-HUN24, AS-HUN24, WP-HUN24 | GP-HUN24 and AS-HUN24 (WP has no lap). No source names damage: the contact lap only. Timing: VER lap 63 88.6 s under a local yellow (status 12; LEC 83.0 s), P4 to P5 | |
| europe-2012 | FAULT, MAL, Collision (damage), lap 56, turn 13, to the flag | "Maldonado attacked Hamilton at turn 1 on the penultimate lap ... Maldonado tried again down into turn 13 using DRS ... clumsily hit Hamilton, forcing him into the wall and out of the race. Maldonado himself lost his front wing, and dropped back down the order." "Maldonado who continued on without his front wing was still able to take the final point in 10th." | WP-EUR12 | The penultimate lap of 57 is lap 56 (WP's classification: Hamilton 55 laps, "Collision"). Timing: MAL laps 56-57 120.3 s and 120.7 s (field about 105 s), P3 to P10. Hamilton retired on the lap: his RETIREMENT event carries it, no FAULT item | |

Not entered: the 20-second penalty WP-EUR12 gives Maldonado (post-race, in the result), and the
stewards' no-penalty ruling in Hungary (no effect on the race model).

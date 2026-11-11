# SC and red-flag mechanics: owner sign-off

Eras job "model-safety-car" (ranked gap 4 of `docs/eras-races-report.md`), Nov 9 2026. Every
fact below was read in the linked source on that day. Nothing comes from memory. Check each
row against its link, then put your initials and the date in **Owner checked**.

Three Eras-only changes (an Eras race file carries a `rules` block; Daily and Gauntlet race
files never do, so they replay exactly as before):

1. **Standing restart spacing** (`redflag.plan(eras=True)`, `redFlagPlan(events, true)`). The
   0.74 s a place is the field's spacing at the end of a lap 1 (median over 47 races). It was
   applied at the end of the lap before the restart, and the first racing lap's spread was then
   added on top. An Eras race now waits in the 0.5 s queue and is spaced 0.74 s apart at the end
   of the restart's first racing lap, in that lap's order. No new number.
2. **A pit-lane pass into a red flag costs nothing** (`redflag.field_pit_passes`, build only).
   When at least 75% of the running cars "pit" on the same lap into a red flag's first red lap,
   race control sent the field through the pit lane: those passes are free, not green stops.
   Only azerbaijan-2021 has one among the built races (16 of the 17 cars running on lap 47).
3. **SC pickup** (`SC_PICKUP` facts in `data/incidents.json`, `pickup` on the SC event; both
   sims). When the safety car picked up a car behind the leader, the cars ahead of it on the
   road run a racing lap on the SC's first lap and keep their gaps on its second lap. The fact
   names only the car picked up. The seconds gained come from the sims' own lap times.

| Race | Fact | Used for | Source (quoted) | Owner checked |
|---|---|---|---|---|
| miami-2024 | The safety car picked up Verstappen, not the leader Norris (SC from lap 28, the model's timed SC event) | `SC_PICKUP` lap 28, driver VER | [Wikipedia](https://en.wikipedia.org/wiki/2024_Miami_Grand_Prix): "Verstappen was picked up by the safety car as Norris led the Grand Prix ahead of Verstappen and Leclerc." The article gives no lap for this; lap 28 is the SC event in the FastF1 timing. |  |
| miami-2024 | The safety car came in on lap 32 (matches the timed SC, laps 28-32) | check only | [Wikipedia](https://en.wikipedia.org/wiki/2024_Miami_Grand_Prix): "The safety car returned to the pit lane on lap 32." |  |
| azerbaijan-2021 | After Verstappen's crash (lap 46), the cars were sent through the pit lane under the SC, before the red flag | rule 2: the lap-48 "stops" are a pit-lane pass, cost 0 | [Wikipedia](https://en.wikipedia.org/wiki/2021_Azerbaijan_Grand_Prix): "The race director Michael Masi ordered the cars to pass through the pit lane to bypass the accident scene." |  |
| azerbaijan-2021 | Latifi stayed out and didn't drive through the pit lane (penalised after the race) | why one car has no lap-48 record | [Wikipedia](https://en.wikipedia.org/wiki/2021_Azerbaijan_Grand_Prix): Latifi was told to "stay out" and took this to mean he should not enter the pit lane; the cars were "required to drive through the pit lane", and he received a post-race penalty. |  |
| azerbaijan-2021 | Restart on lap 50 from a standing start | existing RED event (r1-red-flags.md) | [Wikipedia](https://en.wikipedia.org/wiki/2021_Azerbaijan_Grand_Prix): "the race was restarted on lap 50 with a standing start." |  |

The Wikipedia quotes were read through a fetch tool that summarises the page, so please check
the wording against the page.

## Robust G1 (1,000 runs on each of two seed sets, one race per call)

Before = `eras` at abcf03c. After = this branch (race files rebuilt locally, not committed).

| Race | Before | After | Notes |
|---|---|---|---|
| azerbaijan-2021 | fail, 2.86 s (field ALO 6.96 / 7.02 [5.00]) | **pass, 1.27 s** | rules 1 and 2 (ALO was lining up P13 behind LAT, who skipped the 21.9 s "stop") |
| miami-2024 | fail, 4.68 s (duel VER vs NOR 5.43 / 5.35; VER, LEC, PER, HAM gaps) | fail, 2.79 s (duel 5.22 / 5.23 [3.00]; VER 5.22, LEC 5.30 / 5.04 [5.00]) | rule 3: NOR now leaves the SC ahead of VER, as he really did. What's left is pace: the sim's NOR pulls away 0.43 s a lap after the restart, really 0.27 |
| great-britain-2022 | fail, 2.03 s (duel LEC vs SAI 5.09 / 5.00; podium order 0.46 / 0.48) | fail, 2.03 s (unchanged: no red flag, no pickup) | Not an SC mechanic: LEC's 17-lap-old hards are 0.5 s a lap slower than the model's, and the P2-P4 fight has no cost in the sim |
| italy-2020 | fail, 2.21 s (duel GAS vs SAI 5.00 / 5.09) | fail, 2.17 s (duel 4.89 / 4.94) | rule 1 |
| saudi-arabia-2021 | fail, 8.57 s | fail, 8.70 s | rule 1 (its two standing restarts) |

No other built race has a standing restart, a pit-lane pass or a pickup, so no passing race is
affected. Daily/Gauntlet: no pool race file changes, and the Python reference sim reproduces
every golden of the 39 pool races exactly.

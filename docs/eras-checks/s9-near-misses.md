# S9 near misses: owner sign-off

Eras build job 1.9, Nov 8 2026. These are the races that docs/eras-races-report.md lists as just over
a G1 limit, plus the ones the job named. Each was diagnosed and fixed only with per-race inputs
that a source supports. Every fact below was read in the linked source, not taken from memory.
Where a source gives no lap, the row says where the lap came from. Check each row against its
links, then put your initials and the date in **Owner checked**.

G1 is robust mode (`pipeline validate <id> --robust`: 1,000 runs on each of two seed sets, one
race per call). Values are seed set 10000 / 20000, with the limit in brackets. No sim code, Eras
overlay (`data/eras`) or moment file (`data/moments`) was edited. No Daily or Gauntlet file changed.

## Sources

| Short name | Link |
|---|---|
| WP-EUR97 | https://en.wikipedia.org/wiki/1997_European_Grand_Prix |
| WP-AUT02 | https://en.wikipedia.org/wiki/2002_Austrian_Grand_Prix |
| WP-ABU12 | https://en.wikipedia.org/wiki/2012_Abu_Dhabi_Grand_Prix |
| WP-BRA19 | https://en.wikipedia.org/wiki/2019_Brazilian_Grand_Prix |
| WP-EUR12 | https://en.wikipedia.org/wiki/2012_European_Grand_Prix |
| WP-GER00 | https://en.wikipedia.org/wiki/2000_German_Grand_Prix |
| WP-ESP13 | https://en.wikipedia.org/wiki/2013_Spanish_Grand_Prix |
| WP-HUN24 | https://en.wikipedia.org/wiki/2024_Hungarian_Grand_Prix |
| WP-GER18 | https://en.wikipedia.org/wiki/2018_German_Grand_Prix |
| WP-GBR16 | https://en.wikipedia.org/wiki/2016_British_Grand_Prix |

Wikipedia was read as plain text through the MediaWiki API.

## G1 before and after

| Race | Before | After | What changed |
|---|---|---|---|
| europe-1997 | fail, 0.82 s: podium order 0.45 / 0.46 [0.50] | **pass**, 1.12 s: podium order 0.81 / 0.82 | McLaren's swap (COU lets HAK by, lap 67) is now a sourced TEAM_ORDER. Before it, the sim's COU stayed ahead of HAK in about half of the runs. COU's gap error grows (0.40 -> 1.66 / 1.94 [5.00]) but stays well inside its limit |
| austria-2002 | pass, 0.63 s | pass, 0.63 s | SC estimate confirmed as two periods (24-27, 28-36). Race and golden files are byte-identical, because the two periods touch and the race file already had one SC from the takeover, for 11 laps |
| abu-dhabi-2012 | fail, 1.72 s | fail, 1.72 s | both SC estimates confirmed with their laps unchanged. Race and golden files are byte-identical |
| spain-2013 | fail, 1.51 s: duel RAI vs ALO 3.08 / 3.16 [3.00] | not changed | no per-race input, see below |
| europe-2012 | fail, 1.46 s: podium MSCM 5.38 / 5.15 [5.00] | not changed | no per-race input, see below |
| germany-2000 | fail, 2.85 s: duel BAR vs HAK 3.07 / 2.97 [3.00], DLR 5.06 / 5.01 [5.00] | not changed | no per-race input, see below |
| brazil-2019 | fail, 1.97 s: duel HAM vs GAS 4.46 / 4.53 [3.00] | not changed | needs a collision event, see below |
| hungary-2024 | fail, 1.96 s: field LEC 5.12 / 5.15 [5.00] | not changed | no per-race input, see below |
| great-britain-2016 | fail, 2.37 s: podium order 0.41 / 0.40 [0.50] | not changed | no per-race input, see below |
| germany-2018 | pass, 1.59 s | not changed | passes: every check is inside its limit (the closest is GRO, 4.26 / 4.39 [5.00]) |

## Team order (`data/incidents.json`)

| Race | Item | Fact | Source | Lap from | Owner checked |
|---|---|---|---|---|---|
| europe-1997 | TEAM_ORDER, COU lets HAK by, lap 67 | On the last lap Villeneuve "had been caught by both McLarens, Häkkinen having regained second place from Coulthard under team orders" | WP-EUR97 | No lap in WP. The timing (Jolpica positions) has COU ahead of HAK at every lap end from 48 to 66, and HAK ahead from the end of lap 67 | |

## Safety-car hand checks (`data/estimates/<id>.sc.json`)

Each period's `source` field in the file carries the quote. After the check:
`pipeline jolpica <id> --force`, then `pipeline build <id>`.

| Race | Period (was) | Now | Fact | Source | Laps from | Owner checked |
|---|---|---|---|---|---|---|
| austria-2002 | 24-36 (likely, one period) | 24-27 SC, confirmed | "Lap 24 saw the safety car's first deployment": Panis's engine seized. "The safety car was withdrawn at the conclusion of the 27th lap" | WP-AUT02 | WP | |
| austria-2002 | (same) | 28-36 SC, confirmed | "a major accident prompted the safety car's second deployment on lap 28" (Heidfeld and Sato); "the race restarted at lap 36's end" | WP-AUT02 | WP. The leader's lap 28 (85.5 s, between 124 s SC laps and 70 s green laps) is the restart lap the second SC came out on | |
| abu-dhabi-2012 | 9-14 (likely) | 9-14 SC, confirmed | Rosberg hit Karthikeyan, "the intervention of the safety car on lap nine"; "Racing resumed at the end of lap 14" | WP-ABU12 | WP | |
| abu-dhabi-2012 | 39-42 (likely) | 39-42 SC, confirmed | "On lap 39" Grosjean and Webber collided, "the second safety car period"; "the safety car came in on the end of lap 42" | WP-ABU12 | WP | |

**Knock-on: `data/sc_rates.json` regenerated** (`uv run python -m pipeline.sc_rates`). With
austria-2002 now two SC periods (one before), the Red Bull Ring rate is 0.6 SC a race (was 0.5),
and the all-track rate is 0.7339 (was 0.7294). The all-track rate is also the fallback for 8
circuits with too few races. That changes Legend's random SC draws on these circuits: Red Bull Ring, Imola,
Indianapolis, Istanbul, Jerez, Magny-Cours, Nürburgring, Portimão, Valencia, Zandvoort.
`pipeline/tests/fixtures/legend_parity.json` was regenerated (`uv run python -m
pipeline.legend`) and didn't change. Reachability was re-run on every authored race on those
circuits (below).

## Reachability

`pnpm --filter @laststint/sim reachability <id>`, one race per call. austria-2002's race file
didn't change, but its Legend SC rate did. The other five races are the authored races on the
circuits whose Legend rate moved. europe-1997 and abu-dhabi-2012 have no Eras content (their
overlays have `rules` only), so the checker doesn't apply to them.

| Race | Before | After |
|---|---|---|
| austria-2002 | pass (Era and Legend reachable; old SC rates, this branch) | pass (Era and Legend reachable, best path the same) |
| europe-2012 | fail (races report, before the a911ab9 re-author) | pass |
| france-2004 | (not in the report) | pass |
| san-marino-2005 | (not in the report) | pass |
| turkey-2020 | (not in the report) | pass |
| turkey-2021 | pass | pass |

## Diagnoses with no fix

Lap traces: the race was cut at the lap and run 150 times, and the sim's mean gap to the winner
was compared with the real gap at that lap.

- **spain-2013** (duel RAI vs ALO 3.08 / 3.16 [3.00]). RAI's gap matches the real one to
  within 1 s up to lap 50. The real gap then shrinks from 12.8 s on lap 60 to 9.3 s at the
  flag, but the sim's keeps growing to 12.8 s. That is Alonso easing off on his last stint,
  which the model's stint pace doesn't carry. WP-ESP13 has no safety car or car problem, and the
  SC hand-check file is empty, so there is nothing to confirm or reject. The duel (ALO's four
  stops against RAI's three) is the spec's storyline, so no change.
- **europe-2012** (podium MSCM 5.38 / 5.15 [5.00]). From lap 50, Schumacher on new tyres
  passed car after car ("around 2 seconds quicker than those in front of them", WP-EUR12). The
  sim's MSCM gains about 1 s where the real one gained 5 s, so this is the overtaking model. At
  the flag the sim also has MSCM behind MAL. In the real race Maldonado "lost his front wing,
  and dropped back down the order" after hitting Hamilton on the penultimate lap (WP-EUR12). The
  incident facts have no kind for collision damage: FAULT is only gear-stuck, power-loss,
  puncture or tyre-failure, and calling it one of those would be wrong. The SC is already
  confirmed (W4).
- **germany-2000** (duel 3.07 / 2.97 [3.00], DLR 5.06 / 5.01 [5.00]). Up to lap 35 every scored car is within
  about 3 s of its real gap. In the rain (laps 38-43) every car on wet tyres runs 3-11 s closer
  to Barrichello than it really did, and Barrichello stayed on slicks. Both SCs are confirmed and
  the rain periods rejected (W4). The fitted tyre classes already match WP-GER00 (11 of 15 to
  "wet-weather tyres", fitted as inters; BAR, FRE and ZON on slicks; COU to wets on lap 38). So
  a germany-2000.tyres.json would only pin what is already there. The gap is the wet curves
  (report gap 2), not the data.
- **brazil-2019** (duel HAM vs GAS 4.46 / 4.53 [3.00]). The sim matches HAM to within 2 s up to
  the lap-70 restart. It then finishes 1.7 s behind VER, where the real HAM was 6.1 s behind: the
  sim's HAM keeps second. WP-BRA19: on lap 70 Hamilton "made contact with Albon ... Albon was sent
  into a spin" and "Hamilton, too, was slowed by the contact, allowing Gasly to pass into second
  place". This is collision damage again: no FAULT kind fits. It would also be a frozen event on
  the player's own car. **Needs model or design work: a collision / contact event.**
- **hungary-2024** (field LEC 5.12 / 5.15 [5.00]). LEC is within 2 s of his real gap until lap
  64. He then loses about 3 s more in the last laps, stuck behind the sim's VER. The sim's VER
  is 5 s slower than the real one on laps 46-62 (his pace behind Hamilton), and his lap-63
  collision with Hamilton (WP-HUN24: no penalty, VER lost fourth to LEC) isn't representable
  either. No per-race input.
- **great-britain-2016** (podium order 0.41 / 0.40 [0.50]). The sim's HAM is too slow relative
  to the field: on laps 38-48 ROS and VER run 5-7 s closer to him than they really did, so ROS
  or VER sometimes beat HAM. Rosberg's gearbox fault is already sourced (W4). The deciding pass
  (ROS on VER, lap 38) is the duel's storyline, so a later takeover is ruled out, as for
  russia-2018 in docs/g1-report.md. No per-race input.

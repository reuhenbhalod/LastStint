# Scripted events (Eras model fixes M4): owner sign-off

Two kinds of hand-entered fact go into the Eras builds:

- **Team orders and let-bys** (`data/incidents.json`, items with `"type": "TEAM_ORDER"`). Both
  sims replay each one as a forced swap of the two cars. When the car told to let another by is
  the player's own, the swap becomes a call (comply or ignore) at a `teamOrder` decision moment.
- **Avoidable storyline retirements** (`eras.storylineRetirements` in `data/eras/<id>.json`).
  The player's car retires on its real lap only if the player repeats the real call. Scripted
  cars always keep their real retirements.

Every fact below was read in the linked source; nothing comes from memory. Where the source
gives no lap, the row says where the lap came from. Check each row against its links and put
your initials and the date in **Owner checked**.

## Sources

| Short name | Link |
|---|---|
| WP-HUN24 | https://en.wikipedia.org/wiki/2024_Hungarian_Grand_Prix |
| WP-RUS18 | https://en.wikipedia.org/wiki/2018_Russian_Grand_Prix |
| WP-EUR97 | https://en.wikipedia.org/wiki/1997_European_Grand_Prix |
| WP-MAL99 | https://en.wikipedia.org/wiki/1999_Malaysian_Grand_Prix |
| WP-AUT02 | https://en.wikipedia.org/wiki/2002_Austrian_Grand_Prix |
| WP-MON88 | https://en.wikipedia.org/wiki/1988_Monaco_Grand_Prix |
| WP-AUS86 | https://en.wikipedia.org/wiki/1986_Australian_Grand_Prix |
| WP-GER86 | https://en.wikipedia.org/wiki/1986_German_Grand_Prix |
| AS-GER86 | https://www.autosport.com/f1/feature/3783/grand-prix-gold-german-gp-1986 |
| WP-AUS94 | https://en.wikipedia.org/wiki/1994_Australian_Grand_Prix |
| MS-GBR21 | https://www.motorsportmagazine.com/articles/single-seaters/f1/hamilton-claws-his-way-back-to-silverstone-win-after-verstappen-crash-2021-british-gp-lap-by-lap-report/ |
| AS-GBR21 | https://www.autosport.com/f1/news/f1-british-gp-hamilton-wins-despite-penalty-for-verstappen-crash/6633130/ |
| GPE-GBR21 | https://www.grandprix.com/races/british-gp-2021-race-analysis.html |
| Timing | The race's lap positions in `data/raw/<id>.parquet` (FastF1 2018+, Jolpica 1996+) |

## Team orders and let-bys

Each row's lap is the lap at whose end the passer is ahead. The sims apply an order on that
lap or one of the next two green laps (`TEAM_ORDER_LAPS`), and only while the passer is within
10 s (`TEAM_ORDER_WINDOW`). The yielder drops 0.5 s behind and doesn't pass back.

| Race | Lap | Lets by | Passer | Fact | Sources | Lap from | Owner checked |
|---|---|---|---|---|---|---|---|
| hungary-2024 | 68 | NOR | PIA | McLaren told Norris to give the lead back; he slowed on the start-finish straight on lap 68 | WP-HUN24 | WP and Timing agree | |
| russia-2018 | 25 | BOT | HAM | Mercedes asked Bottas to let Hamilton through into second at turn 13 | WP-RUS18 | WP says lap 26; the Timing has HAM ahead from the end of lap 25, so 25 is used | |
| europe-1997 | 69 | VIL | HAK | Caught by both McLarens on the last lap, Villeneuve let them through ("better to let them through and win the World Championship") | WP-EUR97 | Last lap (69 of 69); Timing agrees | |
| europe-1997 | 69 | VIL | COU | The same let-by | WP-EUR97 | The same | |
| malaysia-1999 | 53 | MSCM | IRV | "Schumacher slowed once again to allow Irvine to retake the lead" (after the second stops) | WP-MAL99 | No lap in WP; the Timing has IRV retaking the lead from MSCM at the end of lap 53. The lap-4 let-by is before the takeover (lap 22), so it isn't entered | |
| austria-2002 | 71 | BAR | MSCM | Ferrari's order: Barrichello yielded in the last 100 to 50 yards and finished 0.182 s behind | WP-AUT02 | Last lap (71 of 71); Timing agrees | |
| great-britain-2021 | 40 | BOT | HAM | Mercedes told Bottas to let Hamilton by; he did, at Stowe | MS-GBR21, AS-GBR21, GPE-GBR21 | All three say lap 40; Timing agrees (HAM ahead from the end of lap 40) | |

Not entered: Malaysia 1999's "Schumacher ... block[ed] the McLarens" (holding a car up isn't a
swap), and the earlier, undated "Schumacher slowed again in order to allow Irvine to build an
advantage".

## Avoidable storyline retirements

The lap is the player's car's RETIREMENT event in the race file. The condition is judged at the
start of that lap.

| Race | Car | Real retirement | Condition (the real call) | Linked | Sources | Notes | Owner checked |
|---|---|---|---|---|---|---|---|
| monaco-1988 | SENA | Crashed at Portier on lap 67 (race file lap 66) | `mode`: pace `push` on every lap from 55 to the retirement lap | | WP-MON88 | WP: Prost passed Berger for second on lap 54 and "started trading fastest laps" with Senna (Senna's fastest lap is on lap 59). "With 11 laps remaining" (lap 67) Dennis radioed Senna to slow down, and he "lost concentration" and crashed. So the call modelled is pushing to answer Prost through lap 66, not the radio call itself. Please confirm | |
| australia-1986 | MAN | Left-rear tyre exploded on the Brabham Straight, lap 64 | `tyre_age`: started lap 64 on tyres at least 63 laps old (the original set) | | WP-AUS86 | No source read says outright that Mansell never stopped. The reconstruction has no Mansell stop, and the facts file's notes (Motor Sport) say Goodyear judged a non-stop run possible. WP gives Rosberg's lap-63 tyre failure and Piquet's precautionary stop after it | |
| germany-1986 | ROSK | Ran dry on the last lap at the first chicane; classified 5th, a lap down | `fuel`: the fuel model decides (the frozen retirement is dropped) | | AS-GER86, WP-GER86 | AS: "Minimum boost ... all the way", fuel figures "exactly on schedule to cross the line with a zero reading", "Piquet led Rosberg by around two seconds" at the start of the last lap. Also entered in `data/reconstruction/germany-1986.json` `lastLapStops` (ROSK 2.0 s behind the leader; PRO, no gap), so the solver keeps both on the road to the last lap | |
| australia-1994 | MSCM | Off at East Terrace, hit the wall; collided with Hill at the next corner | `pressure`: HIL started the lap behind MSCM, within 2.0 s | HIL | WP-AUS94 | WP: "Hill was catching Schumacher" and "the order between the two remained the same until lap 36". **The 2.0 s is not sourced**: it is the sims' fighting range (`PASS_WINDOW`). If the condition isn't met, Hill's lap-36 retirement doesn't happen either | |

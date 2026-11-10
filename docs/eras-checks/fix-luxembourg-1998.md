# Fix: luxembourg-1998 (Era 3 candidate, replacing hungary-1997)

Near-miss fix, Nov 9 2026. Every fact below was read in the linked source on Nov 9 2026, not
taken from memory. No team radio is quoted. Check each row against its source, then put your
initials and the date in **Owner checked**. This race is a candidate only: it is registered
for measurement (`pipeline/src/pipeline/build.py` RACES, rules-only overlay
`data/eras/luxembourg-1998.json`, both from the eras-scout-era3 scout). It has since been
swapped into Era 3 #5 for hungary-1997 (`swap-races-era3-overnight.md`, migration 0028).
Side (HAK) is provisional until `pipeline hard-calls`.

## Sources

| Short name | Link |
|---|---|
| WP-LUX98 | https://en.wikipedia.org/wiki/1998_Luxembourg_Grand_Prix (Report section; read through a fetch tool, so check the wording) |
| Timing | Jolpica lap times (`data/raw/luxembourg-1998.parquet`) |

## G1 before and after

| | Robust status | Mean gap error | duel HAK vs MSCM gap error [3.00] | duel order rate [0.60] | podium order rate [0.50] |
|---|---|---|---|---|---|
| Before | fail | 1.86 s | 2.50 | 0.47 | 0.47 |
| After | **pass** (both seed sets) | 0.88 s | 0.24 | 0.62 | 0.62 |

Gap errors and order rates are from the 500-run `pipeline validate luxembourg-1998`; status
and mean gap error from `--robust`. Every other check passes before and after (after: COU 1.23,
IRV 0.16, FRE 4.31, FIS 0.77). The duel order rate (0.62) is close to its limit.

## Diagnosis

Häkkinen's pace was fitted on laps that weren't racing laps at either end of his race: stuck
behind Irvine early in stint one (laps 12 to 14 are 83.0 to 83.3 s against Schumacher's 81.9
to 82.1 s, Timing), and backing off at the end (lap 67 is 83.72 s against 81.22 s). His last
stint's pace came out slow, so the sim's Schumacher won about half the time.

## Fact and fix

| Item | Fact | Source | Laps from | Owner checked |
|---|---|---|---|---|
| `pace_skip` HAK laps 2-14 | Irvine let Schumacher past "at the end of the first lap and then proceeded to hold up Häkkinen"; Häkkinen "passed the Ulsterman at the Veedol Chicane on lap 14" | WP-LUX98 | End of lap 1 to the pass on lap 14 (WP) | |
| `pace_skip` HAK laps 65-67 | Häkkinen extended "his lead to five seconds before easing off in the closing laps"; won by 2.2 s (results +2.212) | WP-LUX98 | WP gives no lap. Timing: the lead over Schumacher peaks at 6.46 s after lap 64 and falls to 5.74, 4.71 and 2.21 s over laps 65-67, so the closing laps are taken as 65-67 | |
| (context) stops | "The German pitted on lap 24, while Häkkinen stayed out until lap 28"; Häkkinen came out ahead "by less than a second" | WP-LUX98 | F1DB stops agree (MSC 24 and 47, HAK 28 and 48) | |

Code: the existing registry key `pace_skip` (Eras builds only; see
`fix-saudi-arabia-2023.md`). Only the luxembourg-1998 entry changes, so no other race file
changes.

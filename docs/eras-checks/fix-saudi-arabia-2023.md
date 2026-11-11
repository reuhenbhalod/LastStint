# Fix: saudi-arabia-2023 (Era 10 candidate)

Near-miss fix, Nov 9 2026. Every fact below was read in the linked source on Nov 9 2026, not
taken from memory. No team radio is quoted. Check each row against its source, then put your
initials and the date in **Owner checked**. This race is a candidate only: it is registered
for measurement (`pipeline/src/pipeline/build.py` RACES, rules-only overlay
`data/eras/saudi-arabia-2023.json`) and is not in `data/pools.json`.

## Sources

| Short name | Link |
|---|---|
| WP-SAU23 | https://en.wikipedia.org/wiki/2023_Saudi_Arabian_Grand_Prix (read as plain text, MediaWiki `action=raw`) |
| AS-SAU23 | Autosport race report, "F1 Saudi Arabian GP: Perez cruises to Red Bull 1-2 as penalty denies Alonso podium" (Boxall-Legge, 19 March 2023), https://www.autosport.com/f1/news/f1-saudi-arabian-gp-perez-cruises-to-red-bull-1-2-as-penalty-denies-alonso-podium/10446042/ . Read through the Wayback Machine copy cited by WP-SAU23 (https://web.archive.org/web/20230326210112/...), because autosport.com returned 403 |
| Timing | OpenF1 laps (`data/raw/saudi-arabia-2023.parquet`) |

## G1 before and after

Robust mode (`pipeline validate saudi-arabia-2023 --robust`), seed sets 10000 / 20000, limit
in brackets.

| | Status | Mean gap error | duel PER vs VER gap error [3.00] | duel order rate [0.60] |
|---|---|---|---|---|
| Before | fail | 1.88 s | 3.86 / 3.51 | 0.95 |
| After | **pass** | 1.03 s | 1.15 / 1.30 | 0.78 / 0.77 |

Every other check passes before and after (after: ALO 0.36, RUS 0.79 / 0.76, HAM 2.28 / 2.30,
SAI 1.35 / 1.33 [5.00]; podium order 0.78 / 0.77 [0.50]).

## Diagnosis

`pipeline/src/pipeline/diagnose.py`: race mechanics 100%, lap pace 0%. The sim's VER finished
3.7 s too far behind PER on average. VER restarted fourth, behind ALO and RUS, after the
safety car (laps 18-20). His laps 21 and 22 (96.95 s and 94.97 s against PER's 94.56 s and
93.90 s, Timing) were counted as his race pace, so his fitted pace was slow by about 0.1 s a
lap for the rest of the race, and the sim then also made him pass ALO and RUS on top of it.

## Fact and fix

| Item | Fact | Source | Laps from | Owner checked |
|---|---|---|---|---|
| `pace_skip` VER laps 21, 22 (left out of VER's pace fits; the race still replays them) | Verstappen "was initially told to prioritise managing his tyres until DRS was activated on lap 23" after the safety-car restart | AS-SAU23 | The safety car "left the track at the end of lap twenty" (WP-SAU23), so the restart laps before lap 23 are 21 and 22 | |
| (context) SC laps | Stroll stopped on lap 17; "The safety car left the track at the end of lap twenty" | WP-SAU23 | WP | |
| (context) passes after the restart | Verstappen passed Russell, then "At the end of the following lap Verstappen passed Alonso to move into second place" | WP-SAU23 | Timing has VER third from lap 23 and second from lap 25 | |

Code: a registry key `pace_skip` (`{driver: [laps]}`), read only in Eras builds
(`build.py` `eras_build`), drops those laps from the dry fit (`dry_fit`) and the post-takeover
and stint pace fits (`assemble.py`) through `faults.without_laps`. No race other than
saudi-arabia-2023 has the key, so no other race file changes.

## Not used

AS-SAU23 also says Verstappen backed off when his driveshaft made noises (gap back to 5.2 s)
and "spent the final laps charging his battery" for the fastest lap. Leaving those laps out
too was measured and made the duel worse (VER too fast), so they stay in the fit.

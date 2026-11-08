# Anchor report: mexico-1990 (reconstructed)

Solver: 1 attempt(s), noise sigma 0.35s; all anchors pass: True.

| Anchor | Pass | Total |
|---|---|---|
| grid | 1 | 1 |
| order | 1 | 1 |
| gap | 8 | 8 |
| fastest | 26 | 26 |
| retirement | 7 | 7 |
| retirement event | 7 | 7 |
| laps down | 10 | 10 |
| stop | 3 | 3 |
| safety car | 1 | 1 |

| Anchor | Subject | Target | Achieved | Pass |
|---|---|---|---|---|
| grid | lap-1 order is the grid order | 26 cars: BER PAT SENA MAN BOUT ALE MAR PIQN NAKS MOD WAR DON PRO NAN DEC BARP ALBM PIR SUZ GROO BRA ALL FOI LAR BEN JAR | 26 cars: BER PAT SENA MAN BOUT ALE MAR PIQN NAKS MOD WAR DON PRO NAN DEC BARP ALBM PIR SUZ GROO BRA ALL FOI LAR BEN JAR | pass |
| order | classification | 20 cars: PRO MAN BER NAN BOUT PIQN ALE DON PAT WAR MOD MAR DEC BARP FOI LAR ALBM ALL GROO SENA | 20 cars: PRO MAN BER NAN BOUT PIQN ALE DON PAT WAR MOD MAR DEC BARP FOI LAR ALBM ALL GROO SENA | pass |
| gap | MAN | 25.351 | 25.35 | pass |
| gap | BER | 25.53 | 25.532 | pass |
| gap | NAN | 41.099 | 41.098 | pass |
| gap | BOUT | 46.669 | 46.668 | pass |
| gap | PIQN | 46.943 | 46.938 | pass |
| gap | ALE | 49.077 | 49.073 | pass |
| gap | DON | 66.142 | 66.138 | pass |
| gap | PAT | 69.918 | 69.918 | pass |
| fastest | PRO | [77.958, 58] | [77.958, 58] | pass |
| fastest | MAN | [78.487, 62] | [78.487, 62] | pass |
| fastest | BER | [78.223, 65] | [78.223, 65] | pass |
| fastest | NAN | [79.378, 46] | [79.378, 46] | pass |
| fastest | BOUT | [79.525, 46] | [79.525, 46] | pass |
| fastest | PIQN | [78.365, 65] | [78.365, 65] | pass |
| fastest | ALE | [79.474, 65] | [79.474, 65] | pass |
| fastest | DON | [79.508, 63] | [79.508, 63] | pass |
| fastest | PAT | [78.653, 48] | [78.653, 48] | pass |
| fastest | WAR | [79.932, 53] | [79.932, 53] | pass |
| fastest | MOD | [80.355, 58] | [80.355, 58] | pass |
| fastest | MAR | [80.23, 60] | [80.23, 60] | pass |
| fastest | DEC | [80.601, 48] | [80.601, 48] | pass |
| fastest | BARP | [80.789, 56] | [80.789, 56] | pass |
| fastest | FOI | [81.408, 59] | [81.408, 59] | pass |
| fastest | LAR | [81.235, 43] | [81.235, 43] | pass |
| fastest | ALBM | [82.082, 35] | [82.082, 35] | pass |
| fastest | ALL | [81.467, 19] | [81.467, 19] | pass |
| fastest | GROO | [82.779, 41] | [82.779, 41] | pass |
| fastest | SENA | [79.062, 41] | [79.062, 41] | pass |
| fastest | JAR | [83.816, 13] | [83.816, 13] | pass |
| fastest | BEN | [82.636, 10] | [82.636, 10] | pass |
| fastest | SUZ | [82.936, 9] | [82.936, 9] | pass |
| fastest | NAKS | [81.736, 10] | [81.736, 10] | pass |
| fastest | BRA | [86.487, 4] | [86.487, 4] | pass |
| fastest | PIR | [83.476, 10] | [83.476, 10] | pass |
| retirement | SENA | 63 | 63 | pass |
| retirement event | SENA | true | true | pass |
| retirement | JAR | 26 | 26 | pass |
| retirement event | JAR | true | true | pass |
| retirement | BEN | 12 | 12 | pass |
| retirement event | BEN | true | true | pass |
| retirement | SUZ | 11 | 11 | pass |
| retirement event | SUZ | true | true | pass |
| retirement | NAKS | 11 | 11 | pass |
| retirement event | NAKS | true | true | pass |
| retirement | BRA | 11 | 11 | pass |
| retirement event | BRA | true | true | pass |
| retirement | PIR | 10 | 10 | pass |
| retirement event | PIR | true | true | pass |
| laps down | WAR | 1 | 1 | pass |
| laps down | MOD | 1 | 1 | pass |
| laps down | MAR | 1 | 1 | pass |
| laps down | DEC | 1 | 1 | pass |
| laps down | BARP | 2 | 2 | pass |
| laps down | FOI | 2 | 2 | pass |
| laps down | LAR | 2 | 2 | pass |
| laps down | ALBM | 3 | 3 | pass |
| laps down | ALL | 3 | 3 | pass |
| laps down | GROO | 4 | 4 | pass |
| stop | BER | 13 | 13 | pass |
| stop | PIQN | 44 | 44 | pass |
| stop | ALL | 12 | 12 | pass |
| safety car | leader's SC laps, sourced | [] | [] | pass |

## Estimated

- Every lap time and lap-end Time is synthetic: solved to the anchors, not measured
- Position each lap follows from the synthetic times; the lap-1 order is the grid order
- Lap times in between the anchors: pace + tyre wear + fuel + seeded noise
- Fuel: 0.06s per lap of fuel on board; full tank at the start
- Stop loss: pit-lane time - 5.0s, 35% on the in-lap
- PitInTime is the in-lap's end; PitOutTime adds the out-lap's share of the lane time
- Compound is left empty (one dry compound per race, estimated in step 2.4)
- No weather timeline: the race is assumed dry
- Stops: only the sourced ones; cars may have stopped more (unknown)

## Notes

- MOE: disqualified without a lap (Disqualified); left out

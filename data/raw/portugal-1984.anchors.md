# Anchor report: portugal-1984 (reconstructed)

Solver: 1 attempt(s), noise sigma 0.35s; all anchors pass: True.

| Anchor | Pass | Total |
|---|---|---|
| grid | 1 | 1 |
| order | 1 | 1 |
| gap | 4 | 4 |
| fastest | 27 | 27 |
| retirement | 11 | 11 |
| retirement event | 11 | 11 |
| laps down | 11 | 11 |
| safety car | 1 | 1 |

| Anchor | Subject | Target | Achieved | Pass |
|---|---|---|---|---|
| grid | lap-1 order is the grid order | 27 cars: PIQN PRO SENA ROSK DEA MAN TAM ALBM WAR JOH LAU PAT STRP CHE LAF SUR ARN BOUT WINM DEC HES GHI BER GAR BAL PALJ ALL | 27 cars: PIQN PRO SENA ROSK DEA MAN TAM ALBM WAR JOH LAU PAT STRP CHE LAF SUR ARN BOUT WINM DEC HES GHI BER GAR BAL PALJ ALL | pass |
| order | classification | 17 cars: PRO LAU SENA ALBM DEA PIQN TAM PAT ARN WINM JOH DEC BER LAF BAL GAR CHE | 17 cars: PRO LAU SENA ALBM DEA PIQN TAM PAT ARN WINM JOH DEC BER LAF BAL GAR CHE | pass |
| gap | LAU | 13.425 | 13.432 | pass |
| gap | SENA | 20.042 | 20.044 | pass |
| gap | ALBM | 20.317 | 20.325 | pass |
| gap | DEA | 92.169 | 92.172 | pass |
| fastest | PRO | [83.452, 39] | [83.452, 39] | pass |
| fastest | LAU | [82.996, 51] | [82.996, 51] | pass |
| fastest | SENA | [84.373, 46] | [84.373, 46] | pass |
| fastest | ALBM | [84.148, 68] | [84.148, 68] | pass |
| fastest | DEA | [85.68, 45] | [85.68, 45] | pass |
| fastest | PIQN | [84.275, 39] | [84.275, 39] | pass |
| fastest | TAM | [85.506, 37] | [85.506, 37] | pass |
| fastest | PAT | [86.173, 43] | [86.173, 43] | pass |
| fastest | ARN | [85.711, 53] | [85.711, 53] | pass |
| fastest | WINM | [86.404, 63] | [86.404, 63] | pass |
| fastest | JOH | [84.053, 51] | [84.053, 51] | pass |
| fastest | DEC | [86.806, 36] | [86.806, 36] | pass |
| fastest | BER | [86.601, 59] | [86.601, 59] | pass |
| fastest | LAF | [84.507, 55] | [84.507, 55] | pass |
| fastest | BAL | [87.772, 48] | [87.772, 48] | pass |
| fastest | GAR | [87.169, 58] | [87.169, 58] | pass |
| fastest | CHE | [86.02, 33] | [86.02, 33] | pass |
| fastest | GHI | [88.41, 42] | [88.41, 42] | pass |
| fastest | MAN | [84.267, 47] | [84.267, 47] | pass |
| fastest | WAR | [85.309, 20] | [85.309, 20] | pass |
| fastest | STRP | [86.874, 43] | [86.874, 43] | pass |
| fastest | ROSK | [85.667, 37] | [85.667, 37] | pass |
| fastest | HES | [89.219, 19] | [89.219, 19] | pass |
| fastest | BOUT | [87.725, 24] | [87.725, 24] | pass |
| fastest | PALJ | [90.711, 6] | [90.711, 6] | pass |
| fastest | SUR | [88.635, 7] | [88.635, 7] | pass |
| fastest | ALL | [95.542, 2] | [95.542, 2] | pass |
| retirement | GAR | 65 | 65 | pass |
| retirement event | GAR | true | true | pass |
| retirement | GHI | 60 | 60 | pass |
| retirement event | GHI | true | true | pass |
| retirement | MAN | 52 | 52 | pass |
| retirement event | MAN | true | true | pass |
| retirement | WAR | 51 | 51 | pass |
| retirement event | WAR | true | true | pass |
| retirement | STRP | 48 | 48 | pass |
| retirement event | STRP | true | true | pass |
| retirement | ROSK | 39 | 39 | pass |
| retirement event | ROSK | true | true | pass |
| retirement | HES | 31 | 31 | pass |
| retirement event | HES | true | true | pass |
| retirement | BOUT | 24 | 24 | pass |
| retirement event | BOUT | true | true | pass |
| retirement | PALJ | 19 | 19 | pass |
| retirement event | PALJ | true | true | pass |
| retirement | SUR | 8 | 8 | pass |
| retirement event | SUR | true | true | pass |
| retirement | ALL | 2 | 2 | pass |
| retirement event | ALL | true | true | pass |
| laps down | PIQN | 1 | 1 | pass |
| laps down | TAM | 1 | 1 | pass |
| laps down | PAT | 1 | 1 | pass |
| laps down | ARN | 1 | 1 | pass |
| laps down | WINM | 1 | 1 | pass |
| laps down | JOH | 1 | 1 | pass |
| laps down | DEC | 1 | 1 | pass |
| laps down | BER | 2 | 2 | pass |
| laps down | LAF | 3 | 3 | pass |
| laps down | BAL | 4 | 4 | pass |
| laps down | CHE | 6 | 6 | pass |
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

- DEC: no time fits both its classification and its window

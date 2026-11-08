# Anchor report: san-marino-1985 (reconstructed)

Solver: 1 attempt(s), noise sigma 0.35s; all anchors pass: False.

| Anchor | Pass | Total |
|---|---|---|
| grid | 1 | 1 |
| order | 0 | 1 |
| fastest | 24 | 24 |
| retirement | 20 | 20 |
| retirement event | 20 | 20 |
| laps down | 5 | 5 |
| safety car | 1 | 1 |

| Anchor | Subject | Target | Achieved | Pass |
|---|---|---|---|---|
| grid | lap-1 order is the grid order | 25 cars: SENA ROSK DEA ALBM BOUT PRO MAN LAU PIQN TAM CHE DEC WAR JOH LAF BER PAT MAR HES ALL GHI WINM BEL BRU BAL | 25 cars: SENA ROSK DEA ALBM BOUT PRO MAN LAU PIQN TAM CHE DEC WAR JOH LAF BER PAT MAR HES ALL GHI WINM BEL BRU BAL | pass |
| order | classification | 10 cars: DEA BOUT TAM LAU MAN JOH SENA PIQN BRU WAR | 10 cars: PRO DEA BOUT TAM LAU MAN JOH SENA PIQN BRU | FAIL |
| fastest | DEA | [91.411, 55] | [91.411, 55] | pass |
| fastest | BOUT | [93.448, 47] | [93.448, 47] | pass |
| fastest | TAM | [93.514, 55] | [93.514, 55] | pass |
| fastest | LAU | [92.198, 25] | [92.198, 25] | pass |
| fastest | MAN | [93.891, 33] | [93.891, 33] | pass |
| fastest | JOH | [91.017, 56] | [91.017, 56] | pass |
| fastest | SENA | [91.549, 37] | [91.549, 37] | pass |
| fastest | PIQN | [91.424, 50] | [91.424, 50] | pass |
| fastest | BRU | [97.887, 51] | [97.887, 51] | pass |
| fastest | WAR | [93.702, 45] | [93.702, 45] | pass |
| fastest | CHE | [94.128, 34] | [94.128, 34] | pass |
| fastest | GHI | [96.858, 26] | [96.858, 26] | pass |
| fastest | ALBM | [90.961, 29] | [90.961, 29] | pass |
| fastest | WINM | [96.708, 8] | [96.708, 8] | pass |
| fastest | ALL | [95.013, 20] | [95.013, 20] | pass |
| fastest | ROSK | [94.084, 20] | [94.084, 20] | pass |
| fastest | LAF | [95.245, 20] | [95.245, 20] | pass |
| fastest | MAR | [98.203, 14] | [98.203, 14] | pass |
| fastest | DEC | [95.856, 8] | [95.856, 8] | pass |
| fastest | BAL | [99.686, 4] | [99.686, 4] | pass |
| fastest | HES | [98.906, 3] | [98.906, 3] | pass |
| fastest | BEL | [98.437, 3] | [98.437, 3] | pass |
| fastest | BER | [96.239, 3] | [96.239, 3] | pass |
| fastest | PAT | [96.422, 3] | [96.422, 3] | pass |
| retirement | JOH | 57 | 57 | pass |
| retirement event | JOH | true | true | pass |
| retirement | SENA | 57 | 57 | pass |
| retirement event | SENA | true | true | pass |
| retirement | PIQN | 57 | 57 | pass |
| retirement event | PIQN | true | true | pass |
| retirement | BRU | 56 | 56 | pass |
| retirement event | BRU | true | true | pass |
| retirement | WAR | 56 | 56 | pass |
| retirement event | WAR | true | true | pass |
| retirement | PRO | 60 | 60 | pass |
| retirement event | PRO | true | true | pass |
| retirement | CHE | 50 | 50 | pass |
| retirement event | CHE | true | true | pass |
| retirement | ALBM | 29 | 29 | pass |
| retirement event | ALBM | true | true | pass |
| retirement | WINM | 27 | 27 | pass |
| retirement event | WINM | true | true | pass |
| retirement | ALL | 24 | 24 | pass |
| retirement event | ALL | true | true | pass |
| retirement | ROSK | 23 | 23 | pass |
| retirement event | ROSK | true | true | pass |
| retirement | LAF | 22 | 22 | pass |
| retirement event | LAF | true | true | pass |
| retirement | MAR | 14 | 14 | pass |
| retirement event | MAR | true | true | pass |
| retirement | DEC | 11 | 11 | pass |
| retirement event | DEC | true | true | pass |
| retirement | BAL | 9 | 9 | pass |
| retirement event | BAL | true | true | pass |
| retirement | HES | 5 | 5 | pass |
| retirement event | HES | true | true | pass |
| retirement | BEL | 5 | 5 | pass |
| retirement event | BEL | true | true | pass |
| retirement | BER | 4 | 4 | pass |
| retirement event | BER | true | true | pass |
| retirement | PAT | 4 | 4 | pass |
| retirement event | PAT | true | true | pass |
| retirement | PALJ | 0 | 0 | pass |
| retirement event | PALJ | true | true | pass |
| laps down | BOUT | 1 | 1 | pass |
| laps down | TAM | 1 | 1 | pass |
| laps down | LAU | 1 | 1 | pass |
| laps down | MAN | 2 | 2 | pass |
| laps down | GHI | 14 | 14 | pass |
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

- WAR: no time fits both its classification and its window

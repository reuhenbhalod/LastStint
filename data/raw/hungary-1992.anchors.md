# Anchor report: hungary-1992 (reconstructed)

Solver: 1 attempt(s), noise sigma 0.35s; all anchors pass: True.

| Anchor | Pass | Total |
|---|---|---|
| grid | 1 | 1 |
| order | 1 | 1 |
| gap | 4 | 4 |
| fastest | 22 | 22 |
| retirement | 15 | 15 |
| retirement event | 15 | 15 |
| laps down | 6 | 6 |
| stop | 2 | 2 |
| safety car | 1 | 1 |

| Anchor | Subject | Target | Achieved | Pass |
|---|---|---|---|---|
| grid | lap-1 order is the grid order | 22 cars: PAT MAN SENA MSCM BER BRU ALBM ALE CAP SUZ GAC HAK BELP VANE DEC KAT GUG GROO WEN MOD HIL MAR | 22 cars: PAT MAN SENA MSCM BER BRU ALBM ALE CAP SUZ GAC HAK BELP VANE DEC KAT GUG GROO WEN MOD HIL MAR | pass |
| order | classification | 11 cars: SENA MAN BER HAK BRU CAP ALBM DEC BELP GUG HIL | 11 cars: SENA MAN BER HAK BRU CAP ALBM DEC BELP GUG HIL | pass |
| gap | MAN | 40.139 | 40.141 | pass |
| gap | BER | 50.782 | 50.783 | pass |
| gap | HAK | 54.313 | 54.314 | pass |
| gap | BRU | 57.498 | 57.499 | pass |
| fastest | SENA | [79.588, 53] | [79.588, 53] | pass |
| fastest | MAN | [78.308, 63] | [78.308, 63] | pass |
| fastest | BER | [80.722, 38] | [80.722, 38] | pass |
| fastest | HAK | [80.658, 40] | [80.658, 40] | pass |
| fastest | BRU | [80.005, 46] | [80.005, 46] | pass |
| fastest | CAP | [82.62, 27] | [82.62, 27] | pass |
| fastest | ALBM | [83.094, 30] | [83.094, 30] | pass |
| fastest | DEC | [81.898, 56] | [81.898, 56] | pass |
| fastest | BELP | [82.84, 52] | [82.84, 52] | pass |
| fastest | GUG | [83.97, 37] | [83.97, 37] | pass |
| fastest | HIL | [84.777, 39] | [84.777, 39] | pass |
| fastest | MSCM | [80.291, 44] | [80.291, 44] | pass |
| fastest | PAT | [79.151, 51] | [79.151, 51] | pass |
| fastest | MAR | [83.925, 35] | [83.925, 35] | pass |
| fastest | KAT | [83.419, 35] | [83.419, 35] | pass |
| fastest | ALE | [83.307, 13] | [83.307, 13] | pass |
| fastest | GAC | [85.486, 12] | [85.486, 12] | pass |
| fastest | SUZ | [85.472, 11] | [85.472, 11] | pass |
| fastest | GROO | [85.996, 9] | [85.996, 9] | pass |
| fastest | WEN | [85.711, 9] | [85.711, 9] | pass |
| fastest | MOD | [86.724, 9] | [86.724, 9] | pass |
| fastest | VANE | [89.91, 2] | [89.91, 2] | pass |
| retirement | MSCM | 63 | 63 | pass |
| retirement event | MSCM | true | true | pass |
| retirement | PAT | 55 | 55 | pass |
| retirement event | PAT | true | true | pass |
| retirement | MAR | 40 | 40 | pass |
| retirement event | MAR | true | true | pass |
| retirement | KAT | 35 | 35 | pass |
| retirement event | KAT | true | true | pass |
| retirement | ALE | 14 | 14 | pass |
| retirement event | ALE | true | true | pass |
| retirement | GAC | 13 | 13 | pass |
| retirement event | GAC | true | true | pass |
| retirement | SUZ | 13 | 13 | pass |
| retirement event | SUZ | true | true | pass |
| retirement | GROO | 13 | 13 | pass |
| retirement event | GROO | true | true | pass |
| retirement | WEN | 13 | 13 | pass |
| retirement event | WEN | true | true | pass |
| retirement | MOD | 13 | 13 | pass |
| retirement event | MOD | true | true | pass |
| retirement | VANE | 2 | 2 | pass |
| retirement event | VANE | true | true | pass |
| retirement | BOUT | 0 | 0 | pass |
| retirement event | BOUT | true | true | pass |
| retirement | COM | 0 | 0 | pass |
| retirement event | COM | true | true | pass |
| retirement | TAR | 0 | 0 | pass |
| retirement event | TAR | true | true | pass |
| retirement | HER | 0 | 0 | pass |
| retirement event | HER | true | true | pass |
| laps down | CAP | 1 | 1 | pass |
| laps down | ALBM | 2 | 2 | pass |
| laps down | DEC | 2 | 2 | pass |
| laps down | BELP | 3 | 3 | pass |
| laps down | GUG | 4 | 4 | pass |
| laps down | HIL | 4 | 4 | pass |
| stop | SENA | 67 | 67 | pass |
| stop | MAN | 61 | 61 | pass |
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

- incident (not modelled): lap 61 FAULT MAN: Pitted with tyre trouble and rejoined sixth

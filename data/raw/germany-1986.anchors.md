# Anchor report: germany-1986 (reconstructed)

Solver: 1 attempt(s), noise sigma 0.35s; all anchors pass: True.

| Anchor | Pass | Total |
|---|---|---|
| grid | 1 | 1 |
| order | 1 | 1 |
| gap | 3 | 3 |
| fastest | 25 | 25 |
| retirement | 17 | 17 |
| retirement event | 17 | 17 |
| laps down | 5 | 5 |
| stop | 7 | 7 |
| safety car | 1 | 1 |

| Anchor | Subject | Target | Achieved | Pass |
|---|---|---|---|---|
| grid | lap-1 order is the grid order | 25 cars: ROSK PRO SENA BER PIQN MAN PAT ARN ALBM JOH DUM TAM ALL BRU PALJ DAN STRP JON WAR BOUT NAN DEC ROT GHI BEG | 25 cars: ROSK PRO SENA BER PIQN MAN PAT ARN ALBM JOH DUM TAM ALL BRU PALJ DAN STRP JON WAR BOUT NAN DEC ROT GHI BEG | pass |
| order | classification | 12 cars: PIQN SENA MAN ARN ROSK PRO WAR TAM JON BER JOH BEG | 12 cars: PIQN SENA MAN ARN ROSK PRO WAR TAM JON BER JOH BEG | pass |
| gap | SENA | 15.437 | 15.436 | pass |
| gap | MAN | 44.58 | 44.578 | pass |
| gap | ARN | 75.176 | 75.18 | pass |
| fastest | PIQN | [107.721, 34] | [107.721, 34] | pass |
| fastest | SENA | [109.424, 39] | [109.424, 39] | pass |
| fastest | MAN | [107.899, 37] | [107.899, 37] | pass |
| fastest | ARN | [110.374, 27] | [110.374, 27] | pass |
| fastest | ROSK | [109.552, 25] | [109.552, 25] | pass |
| fastest | PRO | [109.649, 26] | [109.649, 26] | pass |
| fastest | WAR | [112.955, 30] | [112.955, 30] | pass |
| fastest | TAM | [111.629, 23] | [111.629, 23] | pass |
| fastest | JON | [112.577, 18] | [112.577, 18] | pass |
| fastest | BER | [106.604, 35] | [106.604, 35] | pass |
| fastest | JOH | [110.932, 30] | [110.932, 30] | pass |
| fastest | BEG | [118.449, 23] | [118.449, 23] | pass |
| fastest | DAN | [114.975, 28] | [114.975, 28] | pass |
| fastest | ROT | [116.401, 13] | [116.401, 13] | pass |
| fastest | PALJ | [116.145, 23] | [116.145, 23] | pass |
| fastest | BRU | [113.682, 21] | [113.682, 21] | pass |
| fastest | PAT | [112.818, 11] | [112.818, 11] | pass |
| fastest | DEC | [114.826, 17] | [114.826, 17] | pass |
| fastest | NAN | [116.721, 3] | [116.721, 3] | pass |
| fastest | DUM | [113.756, 7] | [113.756, 7] | pass |
| fastest | BOUT | [116.803, 12] | [116.803, 12] | pass |
| fastest | ALL | [114.145, 7] | [114.145, 7] | pass |
| fastest | GHI | [120.492, 7] | [120.492, 7] | pass |
| fastest | STRP | [114.025, 7] | [114.025, 7] | pass |
| fastest | ALBM | [112.57, 5] | [112.57, 5] | pass |
| retirement | ROSK | 43 | 43 | pass |
| retirement event | ROSK | true | true | pass |
| retirement | PRO | 43 | 43 | pass |
| retirement event | PRO | true | true | pass |
| retirement | JOH | 41 | 41 | pass |
| retirement event | JOH | true | true | pass |
| retirement | DAN | 38 | 38 | pass |
| retirement event | DAN | true | true | pass |
| retirement | ROT | 38 | 38 | pass |
| retirement event | ROT | true | true | pass |
| retirement | PALJ | 37 | 37 | pass |
| retirement event | PALJ | true | true | pass |
| retirement | BRU | 34 | 34 | pass |
| retirement event | BRU | true | true | pass |
| retirement | PAT | 22 | 22 | pass |
| retirement event | PAT | true | true | pass |
| retirement | DEC | 20 | 20 | pass |
| retirement event | DEC | true | true | pass |
| retirement | NAN | 19 | 19 | pass |
| retirement event | NAN | true | true | pass |
| retirement | DUM | 17 | 17 | pass |
| retirement event | DUM | true | true | pass |
| retirement | BOUT | 13 | 13 | pass |
| retirement event | BOUT | true | true | pass |
| retirement | ALL | 11 | 11 | pass |
| retirement event | ALL | true | true | pass |
| retirement | GHI | 10 | 10 | pass |
| retirement event | GHI | true | true | pass |
| retirement | STRP | 7 | 7 | pass |
| retirement event | STRP | true | true | pass |
| retirement | ALBM | 6 | 6 | pass |
| retirement event | ALBM | true | true | pass |
| retirement | FAB | 0 | 0 | pass |
| retirement event | FAB | true | true | pass |
| laps down | WAR | 1 | 1 | pass |
| laps down | TAM | 1 | 1 | pass |
| laps down | JON | 2 | 2 | pass |
| laps down | BER | 2 | 2 | pass |
| laps down | BEG | 4 | 4 | pass |
| stop | PIQN | 15 | 15 | pass |
| stop | PIQN | 27 | 27 | pass |
| stop | SENA | 21 | 21 | pass |
| stop | MAN | 17 | 17 | pass |
| stop | ROSK | 19 | 19 | pass |
| stop | PRO | 20 | 20 | pass |
| stop | BER | 5 | 5 | pass |
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

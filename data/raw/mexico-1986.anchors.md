# Anchor report: mexico-1986 (reconstructed)

Solver: 1 attempt(s), noise sigma 0.35s; all anchors pass: True.

| Anchor | Pass | Total |
|---|---|---|
| grid | 1 | 1 |
| order | 1 | 1 |
| gap | 2 | 2 |
| fastest | 24 | 24 |
| retirement | 13 | 13 |
| retirement event | 13 | 13 |
| laps down | 9 | 9 |
| safety car | 1 | 1 |

| Anchor | Subject | Target | Achieved | Pass |
|---|---|---|---|---|
| grid | lap-1 order is the grid order | 24 cars: SENA PIQN MAN BER PAT PRO WAR FAB ALL ROSK ALBM ARN JOH JON BRU DUM PALJ STRP DAN BOUT DEC NAN GHI BEG | 24 cars: SENA PIQN MAN BER PAT PRO WAR FAB ALL ROSK ALBM ARN JOH JON BRU DUM PALJ STRP DAN BOUT DEC NAN GHI BEG | pass |
| order | classification | 16 cars: BER PRO SENA PIQN MAN ALL BOUT DEC DAN PALJ BRU JOH PAT NAN ARN BEG | 16 cars: BER PRO SENA PIQN MAN ALL BOUT DEC DAN PALJ BRU JOH PAT NAN ARN BEG | pass |
| gap | PRO | 25.438 | 25.44 | pass |
| gap | SENA | 52.513 | 52.513 | pass |
| fastest | BER | [80.543, 42] | [80.543, 42] | pass |
| fastest | PRO | [80.357, 37] | [80.357, 37] | pass |
| fastest | SENA | [80.237, 64] | [80.237, 64] | pass |
| fastest | PIQN | [79.36, 64] | [79.36, 64] | pass |
| fastest | MAN | [79.441, 63] | [79.441, 63] | pass |
| fastest | ALL | [81.63, 62] | [81.63, 62] | pass |
| fastest | BOUT | [82.315, 54] | [82.315, 54] | pass |
| fastest | DEC | [82.43, 48] | [82.43, 48] | pass |
| fastest | DAN | [83.551, 30] | [83.551, 30] | pass |
| fastest | PALJ | [81.732, 62] | [81.732, 62] | pass |
| fastest | BRU | [83.337, 7] | [83.337, 7] | pass |
| fastest | JOH | [80.182, 52] | [80.182, 52] | pass |
| fastest | PAT | [81.06, 60] | [81.06, 60] | pass |
| fastest | NAN | [84.978, 46] | [84.978, 46] | pass |
| fastest | ARN | [82.02, 57] | [82.02, 57] | pass |
| fastest | BEG | [88.736, 53] | [88.736, 53] | pass |
| fastest | DUM | [82.036, 22] | [82.036, 22] | pass |
| fastest | WAR | [81.89, 32] | [81.89, 32] | pass |
| fastest | JON | [82.024, 26] | [82.024, 26] | pass |
| fastest | ROSK | [81.298, 19] | [81.298, 19] | pass |
| fastest | ALBM | [82.546, 9] | [82.546, 9] | pass |
| fastest | GHI | [90.412, 5] | [90.412, 5] | pass |
| fastest | STRP | [84.525, 6] | [84.525, 6] | pass |
| fastest | FAB | [85.615, 3] | [85.615, 3] | pass |
| retirement | PALJ | 65 | 65 | pass |
| retirement event | PALJ | true | true | pass |
| retirement | JOH | 64 | 64 | pass |
| retirement event | JOH | true | true | pass |
| retirement | PAT | 64 | 64 | pass |
| retirement event | PAT | true | true | pass |
| retirement | ARN | 63 | 63 | pass |
| retirement event | ARN | true | true | pass |
| retirement | DUM | 53 | 53 | pass |
| retirement event | DUM | true | true | pass |
| retirement | WAR | 37 | 37 | pass |
| retirement event | WAR | true | true | pass |
| retirement | JON | 35 | 35 | pass |
| retirement event | JON | true | true | pass |
| retirement | ROSK | 32 | 32 | pass |
| retirement event | ROSK | true | true | pass |
| retirement | ALBM | 10 | 10 | pass |
| retirement event | ALBM | true | true | pass |
| retirement | GHI | 8 | 8 | pass |
| retirement event | GHI | true | true | pass |
| retirement | STRP | 8 | 8 | pass |
| retirement event | STRP | true | true | pass |
| retirement | FAB | 4 | 4 | pass |
| retirement event | FAB | true | true | pass |
| retirement | TAM | 0 | 0 | pass |
| retirement event | TAM | true | true | pass |
| laps down | PIQN | 1 | 1 | pass |
| laps down | MAN | 1 | 1 | pass |
| laps down | ALL | 1 | 1 | pass |
| laps down | BOUT | 2 | 2 | pass |
| laps down | DEC | 2 | 2 | pass |
| laps down | DAN | 2 | 2 | pass |
| laps down | BRU | 3 | 3 | pass |
| laps down | NAN | 4 | 4 | pass |
| laps down | BEG | 7 | 7 | pass |
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

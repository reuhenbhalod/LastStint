# Anchor report: great-britain-1987 (reconstructed)

Solver: 1 attempt(s), noise sigma 0.35s; all anchors pass: True.

| Anchor | Pass | Total |
|---|---|---|
| grid | 1 | 1 |
| order | 1 | 1 |
| gap | 1 | 1 |
| fastest | 25 | 25 |
| retirement | 15 | 15 |
| retirement event | 15 | 15 |
| laps down | 8 | 8 |
| stop | 1 | 1 |
| safety car | 1 | 1 |

| Anchor | Subject | Target | Achieved | Pass |
|---|---|---|---|---|
| grid | lap-1 order is the grid order | 25 cars: PIQN MAN SENA PRO BOUT FAB ALBM BER DEC JOH PAT NAKS WAR CHE NAN ARN BRU DAN CAM CAF ALL STRP PALJ CAP FAR | 25 cars: PIQN MAN SENA PRO BOUT FAB ALBM BER DEC JOH PAT NAKS WAR CHE NAN ARN BRU DAN CAM CAF ALL STRP PALJ CAP FAR | pass |
| order | classification | 9 cars: MAN PIQN SENA NAKS WAR FAB BOUT PALJ FAR | 9 cars: MAN PIQN SENA NAKS WAR FAB BOUT PALJ FAR | pass |
| gap | PIQN | 1.918 | 1.923 | pass |
| fastest | MAN | [69.832, 58] | [69.832, 58] | pass |
| fastest | PIQN | [70.632, 62] | [70.632, 62] | pass |
| fastest | SENA | [71.605, 60] | [71.605, 60] | pass |
| fastest | NAKS | [73.78, 61] | [73.78, 61] | pass |
| fastest | WAR | [74.21, 53] | [74.21, 53] | pass |
| fastest | FAB | [73.885, 51] | [73.885, 51] | pass |
| fastest | BOUT | [74.162, 54] | [74.162, 54] | pass |
| fastest | PALJ | [78.543, 33] | [78.543, 33] | pass |
| fastest | FAR | [79.784, 55] | [79.784, 55] | pass |
| fastest | STRP | [78.745, 38] | [78.745, 38] | pass |
| fastest | BRU | [74.102, 43] | [74.102, 43] | pass |
| fastest | PRO | [73.346, 47] | [73.346, 47] | pass |
| fastest | ALBM | [72.846, 49] | [72.846, 49] | pass |
| fastest | CHE | [74.346, 42] | [74.346, 42] | pass |
| fastest | CAM | [78.859, 32] | [78.859, 32] | pass |
| fastest | CAF | [77.347, 28] | [77.347, 28] | pass |
| fastest | DAN | [79.848, 28] | [79.848, 28] | pass |
| fastest | PAT | [74.814, 17] | [74.814, 17] | pass |
| fastest | JOH | [74.38, 14] | [74.38, 14] | pass |
| fastest | NAN | [77.383, 8] | [77.383, 8] | pass |
| fastest | DEC | [75.401, 7] | [75.401, 7] | pass |
| fastest | BER | [74.879, 7] | [74.879, 7] | pass |
| fastest | ALL | [78.924, 7] | [78.924, 7] | pass |
| fastest | ARN | [77.552, 3] | [77.552, 3] | pass |
| fastest | CAP | [78.999, 3] | [78.999, 3] | pass |
| retirement | STRP | 57 | 57 | pass |
| retirement event | STRP | true | true | pass |
| retirement | PRO | 53 | 53 | pass |
| retirement event | PRO | true | true | pass |
| retirement | ALBM | 52 | 52 | pass |
| retirement event | ALBM | true | true | pass |
| retirement | CHE | 45 | 45 | pass |
| retirement event | CHE | true | true | pass |
| retirement | CAM | 34 | 34 | pass |
| retirement event | CAM | true | true | pass |
| retirement | CAF | 32 | 32 | pass |
| retirement event | CAF | true | true | pass |
| retirement | DAN | 32 | 32 | pass |
| retirement event | DAN | true | true | pass |
| retirement | PAT | 28 | 28 | pass |
| retirement event | PAT | true | true | pass |
| retirement | JOH | 18 | 18 | pass |
| retirement event | JOH | true | true | pass |
| retirement | NAN | 10 | 10 | pass |
| retirement event | NAN | true | true | pass |
| retirement | DEC | 8 | 8 | pass |
| retirement event | DEC | true | true | pass |
| retirement | BER | 7 | 7 | pass |
| retirement event | BER | true | true | pass |
| retirement | ALL | 7 | 7 | pass |
| retirement event | ALL | true | true | pass |
| retirement | ARN | 3 | 3 | pass |
| retirement event | ARN | true | true | pass |
| retirement | CAP | 3 | 3 | pass |
| retirement event | CAP | true | true | pass |
| laps down | SENA | 1 | 1 | pass |
| laps down | NAKS | 2 | 2 | pass |
| laps down | WAR | 2 | 2 | pass |
| laps down | FAB | 2 | 2 | pass |
| laps down | BOUT | 3 | 3 | pass |
| laps down | PALJ | 5 | 5 | pass |
| laps down | FAR | 6 | 6 | pass |
| laps down | BRU | 11 | 11 | pass |
| stop | MAN | 35 | 35 | pass |
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

- GHI: disqualified without a lap (Excluded); left out

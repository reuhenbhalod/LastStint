# Anchor report: south-africa-1983 (reconstructed)

Solver: 1 attempt(s), noise sigma 0.35s; all anchors pass: False.

| Anchor | Pass | Total |
|---|---|---|
| grid | 0 | 1 |
| order | 1 | 1 |
| gap | 2 | 2 |
| fastest | 26 | 26 |
| retirement | 13 | 13 |
| retirement event | 13 | 13 |
| laps down | 10 | 10 |
| stop | 1 | 1 |
| safety car | 1 | 1 |
| leader | 2 | 2 |
| running order | 1 | 1 |

| Anchor | Subject | Target | Achieved | Pass |
|---|---|---|---|---|
| grid | lap-1 order is the grid order (the sourced lap-1 order at the front) | 26 cars: PIQN PAT TAM ARN PRO ROSK MAN WINM DEC LAF DEA LAU WAR CHE WAT GIA BAL ALBM SUL BOUT JARJ SUR BOE ACH FABC GHI | 26 cars: PIQN PAT TAM ARN PRO ROSK MAN DEC DEA LAU WINM WAR CHE WAT LAF GIA BAL ALBM SUL BOUT JARJ SUR BOE GHI ACH FABC | FAIL |
| order | classification | 12 cars: PAT DEC PIQN WAR ROSK CHE SUL SUR BOUT JARJ LAU ACH | 12 cars: PAT DEC PIQN WAR ROSK CHE SUL SUR BOUT JARJ LAU ACH | pass |
| gap | DEC | 9.319 | 9.319 | pass |
| gap | PIQN | 21.969 | 21.972 | pass |
| fastest | PAT | [70.848, 8] | [70.848, 8] | pass |
| fastest | DEC | [71.401, 5] | [71.401, 5] | pass |
| fastest | PIQN | [69.948, 6] | [69.948, 6] | pass |
| fastest | WAR | [72.102, 11] | [72.102, 11] | pass |
| fastest | ROSK | [71.656, 51] | [71.656, 51] | pass |
| fastest | CHE | [71.953, 6] | [71.953, 6] | pass |
| fastest | SUL | [73.494, 70] | [73.494, 70] | pass |
| fastest | SUR | [74.489, 60] | [74.489, 60] | pass |
| fastest | BOUT | [75.1, 47] | [75.1, 47] | pass |
| fastest | JARJ | [75.144, 18] | [75.144, 18] | pass |
| fastest | LAU | [70.634, 17] | [70.634, 17] | pass |
| fastest | ACH | [77.212, 7] | [77.212, 7] | pass |
| fastest | MAN | [70.825, 60] | [70.825, 60] | pass |
| fastest | BOE | [75.886, 5] | [75.886, 5] | pass |
| fastest | ALBM | [73.507, 50] | [73.507, 50] | pass |
| fastest | TAM | [71.267, 7] | [71.267, 7] | pass |
| fastest | GIA | [72.058, 51] | [72.058, 51] | pass |
| fastest | PRO | [71.166, 9] | [71.166, 9] | pass |
| fastest | FABC | [77.153, 8] | [77.153, 8] | pass |
| fastest | DEA | [72.709, 16] | [72.709, 16] | pass |
| fastest | WAT | [73.194, 17] | [73.194, 17] | pass |
| fastest | ARN | [72.183, 6] | [72.183, 6] | pass |
| fastest | BAL | [72.686, 4] | [72.686, 4] | pass |
| fastest | WINM | [83.427, 1] | [83.427, 1] | pass |
| fastest | LAF | [84.689, 1] | [84.689, 1] | pass |
| fastest | GHI | [89.776, 1] | [89.776, 1] | pass |
| retirement | LAU | 71 | 71 | pass |
| retirement event | LAU | true | true | pass |
| retirement | ALBM | 60 | 60 | pass |
| retirement event | ALBM | true | true | pass |
| retirement | TAM | 56 | 56 | pass |
| retirement event | TAM | true | true | pass |
| retirement | GIA | 56 | 56 | pass |
| retirement event | GIA | true | true | pass |
| retirement | PRO | 35 | 35 | pass |
| retirement event | PRO | true | true | pass |
| retirement | FABC | 28 | 28 | pass |
| retirement event | FABC | true | true | pass |
| retirement | DEA | 20 | 20 | pass |
| retirement event | DEA | true | true | pass |
| retirement | WAT | 18 | 18 | pass |
| retirement event | WAT | true | true | pass |
| retirement | ARN | 9 | 9 | pass |
| retirement event | ARN | true | true | pass |
| retirement | BAL | 5 | 5 | pass |
| retirement event | BAL | true | true | pass |
| retirement | WINM | 1 | 1 | pass |
| retirement event | WINM | true | true | pass |
| retirement | LAF | 1 | 1 | pass |
| retirement event | LAF | true | true | pass |
| retirement | GHI | 1 | 1 | pass |
| retirement event | GHI | true | true | pass |
| laps down | WAR | 1 | 1 | pass |
| laps down | ROSK | 1 | 1 | pass |
| laps down | CHE | 1 | 1 | pass |
| laps down | SUL | 2 | 2 | pass |
| laps down | SUR | 2 | 2 | pass |
| laps down | BOUT | 3 | 3 | pass |
| laps down | JARJ | 4 | 4 | pass |
| laps down | ACH | 6 | 6 | pass |
| laps down | MAN | 9 | 9 | pass |
| laps down | BOE | 11 | 11 | pass |
| stop | PIQN | 28 | 28 | pass |
| safety car | leader's SC laps, sourced | [] | [] | pass |
| leader | PIQN laps 1-59 | 59 laps | 59 of 59 laps | pass |
| leader | PAT laps 60-77 | 18 laps | 18 of 18 laps | pass |
| running order | lap 1 | ["PIQN", "PAT"] | ["PIQN", "PAT"] | pass |

## Estimated

- Every lap time and lap-end Time is synthetic: solved to the anchors, not measured
- Position each lap follows from the synthetic times; the lap-1 order is the grid order, with the sourced lap-1 order at the front; each lap's leader and the sourced snapshots of the order and gaps are anchors, the rest of the order is estimated
- Lap times in between the anchors: pace + tyre wear + fuel + seeded noise, the pace moved by a constant between the laps the sourced order marks
- Fuel: 0.06s per lap of fuel on board; full tank at the start
- Stop loss: pit-lane time - 5.0s, 35% on the in-lap
- PitInTime is the in-lap's end; PitOutTime adds the out-lap's share of the lane time
- Compound is left empty (one dry compound per race, estimated in step 2.4)
- No weather timeline: the race is assumed dry
- Stops: only the sourced ones; cars may have stopped more (unknown)

## Notes

- WINM: fastest lap on lap 1, its lap-1 time is the fastest lap's
- LAF: fastest lap on lap 1, its lap-1 time is the fastest lap's
- GHI: fastest lap on lap 1, its lap-1 time is the fastest lap's
- SUR: target 5641.9s not reachable
- BOUT: target 5633.6s not reachable

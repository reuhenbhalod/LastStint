# Anchor report: australia-1993 (reconstructed)

Solver: 1 attempt(s), noise sigma 0.35s; all anchors pass: True.

| Anchor | Pass | Total |
|---|---|---|
| grid | 1 | 1 |
| order | 1 | 1 |
| gap | 2 | 2 |
| fastest | 23 | 23 |
| retirement | 11 | 11 |
| retirement event | 10 | 11 |
| laps down | 10 | 10 |
| stop | 8 | 8 |
| safety car | 1 | 1 |
| leader | 3 | 3 |

| Anchor | Subject | Target | Achieved | Pass |
|---|---|---|---|---|
| grid | lap-1 order is the grid order | 23 cars: SENA PRO HIL MSCM HAK BER ALE BRU PAT SUZ WEN JAR BAR BLU DEC MAR WAR KAT IRV HER COM GOU SUU | 23 cars: SENA PRO HIL MSCM HAK BER ALE BRU PAT SUZ WEN JAR BAR BLU DEC MAR WAR KAT IRV HER COM GOU SUU | pass |
| order | classification | 15 cars: SENA PRO HIL ALE BER BRU SUZ PAT BLU WAR BAR COM DEC SUU WEN | 15 cars: SENA PRO HIL ALE BER BRU SUZ PAT BLU WAR BAR COM DEC SUU WEN | pass |
| gap | PRO | 9.259 | 9.256 | pass |
| gap | HIL | 33.902 | 33.899 | pass |
| fastest | SENA | [76.128, 70] | [76.128, 70] | pass |
| fastest | PRO | [75.434, 66] | [75.434, 66] | pass |
| fastest | HIL | [75.381, 64] | [75.381, 64] | pass |
| fastest | ALE | [77.786, 40] | [77.786, 40] | pass |
| fastest | BER | [76.686, 74] | [76.686, 74] | pass |
| fastest | BRU | [77.565, 63] | [77.565, 63] | pass |
| fastest | SUZ | [78.316, 49] | [78.316, 49] | pass |
| fastest | PAT | [77.478, 67] | [77.478, 67] | pass |
| fastest | BLU | [78.314, 53] | [78.314, 53] | pass |
| fastest | WAR | [78.905, 55] | [78.905, 55] | pass |
| fastest | BAR | [78.558, 53] | [78.558, 53] | pass |
| fastest | COM | [79.152, 76] | [79.152, 76] | pass |
| fastest | DEC | [80.625, 36] | [80.625, 36] | pass |
| fastest | SUU | [82.328, 52] | [82.328, 52] | pass |
| fastest | WEN | [78.101, 50] | [78.101, 50] | pass |
| fastest | JAR | [78.43, 49] | [78.43, 49] | pass |
| fastest | GOU | [81.678, 34] | [81.678, 34] | pass |
| fastest | HAK | [78.96, 17] | [78.96, 17] | pass |
| fastest | MSCM | [77.069, 17] | [77.069, 17] | pass |
| fastest | KAT | [82.143, 5] | [82.143, 5] | pass |
| fastest | IRV | [81.742, 9] | [81.742, 9] | pass |
| fastest | HER | [80.502, 8] | [80.502, 8] | pass |
| fastest | MAR | [81.175, 5] | [81.175, 5] | pass |
| retirement | PAT | 77 | 77 | pass |
| retirement event | PAT | true | false | FAIL |
| retirement | WEN | 73 | 73 | pass |
| retirement event | WEN | true | true | pass |
| retirement | JAR | 56 | 56 | pass |
| retirement event | JAR | true | true | pass |
| retirement | GOU | 34 | 34 | pass |
| retirement event | GOU | true | true | pass |
| retirement | HAK | 28 | 28 | pass |
| retirement event | HAK | true | true | pass |
| retirement | MSCM | 19 | 19 | pass |
| retirement event | MSCM | true | true | pass |
| retirement | KAT | 11 | 11 | pass |
| retirement event | KAT | true | true | pass |
| retirement | IRV | 10 | 10 | pass |
| retirement event | IRV | true | true | pass |
| retirement | HER | 9 | 9 | pass |
| retirement event | HER | true | true | pass |
| retirement | MAR | 5 | 5 | pass |
| retirement event | MAR | true | true | pass |
| retirement | LAM | 0 | 0 | pass |
| retirement event | LAM | true | true | pass |
| laps down | ALE | 1 | 1 | pass |
| laps down | BER | 1 | 1 | pass |
| laps down | BRU | 1 | 1 | pass |
| laps down | SUZ | 1 | 1 | pass |
| laps down | BLU | 2 | 2 | pass |
| laps down | WAR | 2 | 2 | pass |
| laps down | BAR | 3 | 3 | pass |
| laps down | COM | 3 | 3 | pass |
| laps down | DEC | 4 | 4 | pass |
| laps down | SUU | 5 | 5 | pass |
| stop | SENA | 24 | 24 | pass |
| stop | SENA | 55 | 55 | pass |
| stop | PRO | 29 | 29 | pass |
| stop | PRO | 48 | 48 | pass |
| stop | HIL | 22 | 22 | pass |
| stop | HIL | 44 | 44 | pass |
| stop | HAK | 26 | 26 | pass |
| stop | MSCM | 15 | 15 | pass |
| safety car | leader's SC laps, sourced (others unknown) | [] | [] | pass |
| leader | SENA laps 1-23 | 23 laps | 23 of 23 laps | pass |
| leader | PRO laps 24-28 | 5 laps | 5 of 5 laps | pass |
| leader | SENA laps 29-79 | 51 laps | 51 of 51 laps | pass |

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
- Safety cars: only the sourced ones (none found is not none run)

## Notes

- PAT: classified retirement stopped at its natural time, after the point a retirement is seen

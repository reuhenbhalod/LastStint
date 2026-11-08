# Anchor report: united-states-1990 (reconstructed)

Solver: 1 attempt(s), noise sigma 0.35s; all anchors pass: True.

| Anchor | Pass | Total |
|---|---|---|
| grid | 1 | 1 |
| order | 1 | 1 |
| gap | 4 | 4 |
| fastest | 25 | 25 |
| retirement | 12 | 12 |
| retirement event | 12 | 12 |
| laps down | 9 | 9 |
| stop | 1 | 1 |
| safety car | 1 | 1 |

| Anchor | Subject | Target | Achieved | Pass |
|---|---|---|---|---|
| grid | lap-1 order is the grid order | 25 cars: BER MAR DEC ALE SENA PIQN PRO GROO BOUT MOD NAKS PAT LAR BARP BEN MOE MAN SUZ SCHB ALBM NAN FOI WAR GUG CAP | 25 cars: BER MAR DEC ALE SENA PIQN PRO GROO BOUT MOD NAKS PAT LAR BARP BEN MOE MAN SUZ SCHB ALBM NAN FOI WAR GUG CAP | pass |
| order | classification | 14 cars: SENA ALE BOUT PIQN MOD NAKS MAR BEN PAT ALBM NAN SCHB MOE GUG | 14 cars: SENA ALE BOUT PIQN MOD NAKS MAR BEN PAT ALBM NAN SCHB MOE GUG | pass |
| gap | ALE | 8.685 | 8.684 | pass |
| gap | BOUT | 54.08 | 54.08 | pass |
| gap | PIQN | 68.358 | 68.355 | pass |
| gap | MOD | 69.503 | 69.507 | pass |
| fastest | SENA | [92.178, 18] | [92.178, 18] | pass |
| fastest | ALE | [92.221, 4] | [92.221, 4] | pass |
| fastest | BOUT | [92.915, 33] | [92.915, 33] | pass |
| fastest | PIQN | [92.865, 68] | [92.865, 68] | pass |
| fastest | MOD | [93.147, 67] | [93.147, 67] | pass |
| fastest | NAKS | [92.707, 68] | [92.707, 68] | pass |
| fastest | MAR | [91.568, 66] | [91.568, 66] | pass |
| fastest | BEN | [92.681, 66] | [92.681, 66] | pass |
| fastest | PAT | [92.222, 38] | [92.222, 38] | pass |
| fastest | ALBM | [94.517, 65] | [94.517, 65] | pass |
| fastest | NAN | [92.694, 67] | [92.694, 67] | pass |
| fastest | SCHB | [93.573, 62] | [93.573, 62] | pass |
| fastest | MOE | [95.446, 14] | [95.446, 14] | pass |
| fastest | GUG | [97.058, 56] | [97.058, 56] | pass |
| fastest | BARP | [94.265, 36] | [94.265, 36] | pass |
| fastest | SUZ | [93.819, 48] | [93.819, 48] | pass |
| fastest | MAN | [92.814, 40] | [92.814, 40] | pass |
| fastest | BER | [91.05, 34] | [91.05, 34] | pass |
| fastest | FOI | [94.156, 36] | [94.156, 36] | pass |
| fastest | GROO | [95.35, 29] | [95.35, 29] | pass |
| fastest | DEC | [94.067, 10] | [94.067, 10] | pass |
| fastest | PRO | [93.17, 19] | [93.17, 19] | pass |
| fastest | CAP | [95.598, 10] | [95.598, 10] | pass |
| fastest | WAR | [95.396, 5] | [95.396, 5] | pass |
| fastest | LAR | [96.971, 3] | [96.971, 3] | pass |
| retirement | BARP | 54 | 54 | pass |
| retirement event | BARP | true | true | pass |
| retirement | SUZ | 53 | 53 | pass |
| retirement event | SUZ | true | true | pass |
| retirement | MAN | 49 | 49 | pass |
| retirement event | MAN | true | true | pass |
| retirement | BER | 44 | 44 | pass |
| retirement event | BER | true | true | pass |
| retirement | FOI | 39 | 39 | pass |
| retirement event | FOI | true | true | pass |
| retirement | GROO | 39 | 39 | pass |
| retirement event | GROO | true | true | pass |
| retirement | DEC | 25 | 25 | pass |
| retirement event | DEC | true | true | pass |
| retirement | PRO | 21 | 21 | pass |
| retirement event | PRO | true | true | pass |
| retirement | CAP | 20 | 20 | pass |
| retirement event | CAP | true | true | pass |
| retirement | WAR | 6 | 6 | pass |
| retirement event | WAR | true | true | pass |
| retirement | LAR | 4 | 4 | pass |
| retirement event | LAR | true | true | pass |
| retirement | DON | 0 | 0 | pass |
| retirement event | DON | true | true | pass |
| laps down | NAKS | 1 | 1 | pass |
| laps down | MAR | 1 | 1 | pass |
| laps down | BEN | 1 | 1 | pass |
| laps down | PAT | 1 | 1 | pass |
| laps down | ALBM | 2 | 2 | pass |
| laps down | NAN | 2 | 2 | pass |
| laps down | SCHB | 2 | 2 | pass |
| laps down | MOE | 5 | 5 | pass |
| laps down | GUG | 6 | 6 | pass |
| stop | PIQN | 28 | 28 | pass |
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

- ALL: disqualified without a lap (Disqualified); left out

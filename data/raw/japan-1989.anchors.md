# Anchor report: japan-1989 (reconstructed)

Solver: 1 attempt(s), noise sigma 0.35s; all anchors pass: False.

| Anchor | Pass | Total |
|---|---|---|
| grid | 0 | 1 |
| order | 1 | 1 |
| gap | 3 | 3 |
| fastest | 23 | 23 |
| retirement | 16 | 16 |
| retirement event | 16 | 16 |
| laps down | 6 | 6 |
| stop | 3 | 3 |
| safety car | 1 | 1 |

| Anchor | Subject | Target | Achieved | Pass |
|---|---|---|---|---|
| grid | lap-1 order is the grid order | 24 cars: SENA PRO BER MAN PAT NAN BOUT ALL MOD LAR PIQN NAKS BRU CAF DEC CAP ALE GUG SCHB PIR GROO CHE WAR PALJ | 24 cars: SENA PRO BER MAN PAT NAN BOUT ALL MOD LAR PIQN NAKS BRU CAF DEC CAP ALE GUG PIR GROO CHE WAR PALJ SCHB | FAIL |
| order | classification | 10 cars: NAN PAT BOUT PIQN BRU WAR GUG CHE CAF DEC | 10 cars: NAN PAT BOUT PIQN BRU WAR GUG CHE CAF DEC | pass |
| gap | PAT | 11.904 | 11.902 | pass |
| gap | BOUT | 13.446 | 13.448 | pass |
| gap | PIQN | 104.225 | 104.224 | pass |
| fastest | NAN | [104.919, 28] | [104.919, 28] | pass |
| fastest | PAT | [105.335, 26] | [105.335, 26] | pass |
| fastest | BOUT | [105.115, 37] | [105.115, 37] | pass |
| fastest | PIQN | [106.42, 33] | [106.42, 33] | pass |
| fastest | BRU | [106.194, 46] | [106.194, 46] | pass |
| fastest | WAR | [107.069, 32] | [107.069, 32] | pass |
| fastest | GUG | [107.976, 43] | [107.976, 43] | pass |
| fastest | CHE | [107.92, 27] | [107.92, 27] | pass |
| fastest | CAF | [109.322, 29] | [109.322, 29] | pass |
| fastest | DEC | [106.225, 35] | [106.225, 35] | pass |
| fastest | PRO | [103.506, 43] | [103.506, 43] | pass |
| fastest | MOD | [108.609, 31] | [108.609, 31] | pass |
| fastest | MAN | [105.077, 32] | [105.077, 32] | pass |
| fastest | NAKS | [107.338, 30] | [107.338, 30] | pass |
| fastest | ALE | [106.674, 34] | [106.674, 34] | pass |
| fastest | ALL | [105.353, 25] | [105.353, 25] | pass |
| fastest | BER | [104.189, 26] | [104.189, 26] | pass |
| fastest | PIR | [105.049, 25] | [105.049, 25] | pass |
| fastest | GROO | [108.145, 22] | [108.145, 22] | pass |
| fastest | CAP | [107.465, 25] | [107.465, 25] | pass |
| fastest | LAR | [109.479, 19] | [109.479, 19] | pass |
| fastest | PALJ | [109.91, 4] | [109.91, 4] | pass |
| fastest | SCHB | [131.97, 1] | [131.97, 1] | pass |
| retirement | SENA | 53 | 53 | pass |
| retirement event | SENA | true | true | pass |
| retirement | PRO | 46 | 46 | pass |
| retirement event | PRO | true | true | pass |
| retirement | MOD | 46 | 46 | pass |
| retirement event | MOD | true | true | pass |
| retirement | MAN | 43 | 43 | pass |
| retirement event | MAN | true | true | pass |
| retirement | NAKS | 41 | 41 | pass |
| retirement event | NAKS | true | true | pass |
| retirement | ALE | 37 | 37 | pass |
| retirement event | ALE | true | true | pass |
| retirement | ALL | 36 | 36 | pass |
| retirement event | ALL | true | true | pass |
| retirement | BER | 34 | 34 | pass |
| retirement event | BER | true | true | pass |
| retirement | PIR | 33 | 33 | pass |
| retirement event | PIR | true | true | pass |
| retirement | GROO | 31 | 31 | pass |
| retirement event | GROO | true | true | pass |
| retirement | CAP | 27 | 27 | pass |
| retirement event | CAP | true | true | pass |
| retirement | LAR | 21 | 21 | pass |
| retirement event | LAR | true | true | pass |
| retirement | PALJ | 20 | 20 | pass |
| retirement event | PALJ | true | true | pass |
| retirement | SCHB | 1 | 1 | pass |
| retirement event | SCHB | true | true | pass |
| retirement | PERL | 0 | 0 | pass |
| retirement event | PERL | true | true | pass |
| retirement | BARP | 0 | 0 | pass |
| retirement event | BARP | true | true | pass |
| laps down | BRU | 1 | 1 | pass |
| laps down | WAR | 1 | 1 | pass |
| laps down | GUG | 1 | 1 | pass |
| laps down | CHE | 1 | 1 | pass |
| laps down | CAF | 1 | 1 | pass |
| laps down | DEC | 2 | 2 | pass |
| stop | SENA | 23 | 23 | pass |
| stop | SENA | 48 | 48 | pass |
| stop | PRO | 21 | 21 | pass |
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

- SCHB: fastest lap on lap 1, its lap-1 time is the fastest lap's

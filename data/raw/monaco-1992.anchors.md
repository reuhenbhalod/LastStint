# Anchor report: monaco-1992 (reconstructed)

Solver: 1 attempt(s), noise sigma 0.35s; all anchors pass: False.

| Anchor | Pass | Total |
|---|---|---|
| grid | 0 | 1 |
| order | 1 | 1 |
| gap | 4 | 4 |
| fastest | 25 | 25 |
| retirement | 14 | 14 |
| retirement event | 14 | 14 |
| laps down | 7 | 7 |
| stop | 2 | 2 |
| safety car | 1 | 1 |

| Anchor | Subject | Target | Achieved | Pass |
|---|---|---|---|---|
| grid | lap-1 order is the grid order | 25 cars: MAN PAT SENA ALE BER MSCM BRU CAP HER DEC ALBM MOR GUG HAK GAC WEN FITC SUZ JAR MOD BOUT COM GROO TAR MOE | 25 cars: MAN PAT SENA ALE BER MSCM BRU CAP HER DEC ALBM GUG HAK GAC FITC SUZ JAR MOD BOUT COM GROO TAR MOE WEN MOR | FAIL |
| order | classification | 12 cars: SENA MAN PAT MSCM BRU GAC ALBM FITC JAR COM SUZ BOUT | 12 cars: SENA MAN PAT MSCM BRU GAC ALBM FITC JAR COM SUZ BOUT | pass |
| gap | MAN | 0.215 | 0.213 | pass |
| gap | PAT | 31.843 | 31.838 | pass |
| gap | MSCM | 39.294 | 39.289 | pass |
| gap | BRU | 81.347 | 81.344 | pass |
| fastest | SENA | [83.47, 49] | [83.47, 49] | pass |
| fastest | MAN | [81.598, 74] | [81.598, 74] | pass |
| fastest | PAT | [84.08, 37] | [84.08, 37] | pass |
| fastest | MSCM | [83.868, 32] | [83.868, 32] | pass |
| fastest | BRU | [83.406, 48] | [83.406, 48] | pass |
| fastest | GAC | [84.932, 43] | [84.932, 43] | pass |
| fastest | ALBM | [85.004, 49] | [85.004, 49] | pass |
| fastest | FITC | [85.594, 40] | [85.594, 40] | pass |
| fastest | JAR | [85.39, 55] | [85.39, 55] | pass |
| fastest | COM | [86.002, 50] | [86.002, 50] | pass |
| fastest | SUZ | [85.909, 50] | [85.909, 50] | pass |
| fastest | BOUT | [86.32, 16] | [86.32, 16] | pass |
| fastest | CAP | [85.032, 28] | [85.032, 28] | pass |
| fastest | BER | [84.172, 30] | [84.172, 30] | pass |
| fastest | HAK | [85.871, 12] | [85.871, 12] | pass |
| fastest | ALE | [84.827, 25] | [84.827, 25] | pass |
| fastest | GUG | [86.863, 9] | [86.863, 9] | pass |
| fastest | HER | [86.005, 16] | [86.005, 16] | pass |
| fastest | MOE | [90.344, 11] | [90.344, 11] | pass |
| fastest | DEC | [86.916, 7] | [86.916, 7] | pass |
| fastest | TAR | [90.718, 8] | [90.718, 8] | pass |
| fastest | MOD | [88.149, 6] | [88.149, 6] | pass |
| fastest | GROO | [88.59, 4] | [88.59, 4] | pass |
| fastest | WEN | [104.613, 1] | [104.613, 1] | pass |
| fastest | MOR | [334.5, 1] | [334.5, 1] | pass |
| retirement | CAP | 60 | 60 | pass |
| retirement event | CAP | true | true | pass |
| retirement | BER | 32 | 32 | pass |
| retirement event | BER | true | true | pass |
| retirement | HAK | 30 | 30 | pass |
| retirement event | HAK | true | true | pass |
| retirement | ALE | 28 | 28 | pass |
| retirement event | ALE | true | true | pass |
| retirement | GUG | 18 | 18 | pass |
| retirement event | GUG | true | true | pass |
| retirement | HER | 17 | 17 | pass |
| retirement event | HER | true | true | pass |
| retirement | MOE | 11 | 11 | pass |
| retirement event | MOE | true | true | pass |
| retirement | DEC | 9 | 9 | pass |
| retirement event | DEC | true | true | pass |
| retirement | TAR | 9 | 9 | pass |
| retirement event | TAR | true | true | pass |
| retirement | MOD | 6 | 6 | pass |
| retirement event | MOD | true | true | pass |
| retirement | GROO | 4 | 4 | pass |
| retirement event | GROO | true | true | pass |
| retirement | WEN | 1 | 1 | pass |
| retirement event | WEN | true | true | pass |
| retirement | MOR | 1 | 1 | pass |
| retirement event | MOR | true | true | pass |
| retirement | MAR | 0 | 0 | pass |
| retirement event | MAR | true | true | pass |
| laps down | GAC | 1 | 1 | pass |
| laps down | ALBM | 1 | 1 | pass |
| laps down | FITC | 1 | 1 | pass |
| laps down | JAR | 2 | 2 | pass |
| laps down | COM | 2 | 2 | pass |
| laps down | SUZ | 2 | 2 | pass |
| laps down | BOUT | 3 | 3 | pass |
| stop | MAN | 71 | 71 | pass |
| stop | BRU | 19 | 19 | pass |
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

- MOR: fastest lap on lap 1, its lap-1 time is the fastest lap's
- WEN: fastest lap on lap 1, its lap-1 time is the fastest lap's

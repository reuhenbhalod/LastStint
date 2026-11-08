# Anchor report: france-1990 (reconstructed)

Solver: 1 attempt(s), noise sigma 0.35s; all anchors pass: False.

| Anchor | Pass | Total |
|---|---|---|
| grid | 1 | 1 |
| order | 0 | 1 |
| gap | 5 | 5 |
| fastest | 26 | 26 |
| retirement | 10 | 10 |
| retirement event | 10 | 10 |
| laps down | 10 | 10 |
| stop | 6 | 6 |
| safety car | 1 | 1 |

| Anchor | Subject | Target | Achieved | Pass |
|---|---|---|---|---|
| grid | lap-1 order is the grid order | 26 cars: MAN BER SENA PRO NAN PAT CAP BOUT PIQN GUG BEN ALL ALE SUZ NAKS WAR DON ALBM LAR MOD DEC CAF MAR PIR BRA DAL | 26 cars: MAN BER SENA PRO NAN PAT CAP BOUT PIQN GUG BEN ALL ALE SUZ NAKS WAR DON ALBM LAR MOD DEC CAF MAR PIR BRA DAL | pass |
| order | classification | 18 cars: PRO CAP SENA PIQN BER PAT SUZ BEN ALL ALBM WAR DON MOD LAR BRA NAN DAL MAN | 18 cars: PRO CAP SENA PIQN BER PAT SUZ BEN ALL ALBM WAR DON DEC MOD LAR BRA NAN DAL | FAIL |
| gap | CAP | 8.626 | 8.631 | pass |
| gap | SENA | 11.606 | 11.612 | pass |
| gap | PIQN | 41.207 | 41.21 | pass |
| gap | BER | 42.219 | 42.228 | pass |
| gap | PAT | 69.351 | 69.353 | pass |
| fastest | PRO | [68.212, 72] | [68.212, 72] | pass |
| fastest | CAP | [68.373, 62] | [68.373, 62] | pass |
| fastest | SENA | [68.573, 59] | [68.573, 59] | pass |
| fastest | PIQN | [69.135, 70] | [69.135, 70] | pass |
| fastest | BER | [69.206, 73] | [69.206, 73] | pass |
| fastest | PAT | [68.922, 51] | [68.922, 51] | pass |
| fastest | SUZ | [69.72, 59] | [69.72, 59] | pass |
| fastest | BEN | [69.895, 31] | [69.895, 31] | pass |
| fastest | ALL | [69.752, 41] | [69.752, 41] | pass |
| fastest | ALBM | [69.314, 67] | [69.314, 67] | pass |
| fastest | WAR | [68.882, 77] | [68.882, 77] | pass |
| fastest | DON | [68.023, 69] | [68.023, 69] | pass |
| fastest | MOD | [69.934, 77] | [69.934, 77] | pass |
| fastest | LAR | [70.374, 74] | [70.374, 74] | pass |
| fastest | BRA | [71.11, 57] | [71.11, 57] | pass |
| fastest | NAN | [68.214, 66] | [68.214, 66] | pass |
| fastest | DAL | [69.877, 63] | [69.877, 63] | pass |
| fastest | MAN | [68.012, 64] | [68.012, 64] | pass |
| fastest | DEC | [69.583, 53] | [69.583, 53] | pass |
| fastest | NAKS | [68.916, 60] | [68.916, 60] | pass |
| fastest | GUG | [68.983, 47] | [68.983, 47] | pass |
| fastest | MAR | [71.406, 36] | [71.406, 36] | pass |
| fastest | ALE | [70.265, 22] | [70.265, 22] | pass |
| fastest | CAF | [71.242, 16] | [71.242, 16] | pass |
| fastest | BOUT | [70.837, 7] | [70.837, 7] | pass |
| fastest | PIR | [72.275, 4] | [72.275, 4] | pass |
| retirement | NAN | 75 | 75 | pass |
| retirement event | NAN | true | true | pass |
| retirement | MAN | 72 | 72 | pass |
| retirement event | MAN | true | true | pass |
| retirement | DEC | 78 | 78 | pass |
| retirement event | DEC | true | true | pass |
| retirement | NAKS | 63 | 63 | pass |
| retirement event | NAKS | true | true | pass |
| retirement | GUG | 58 | 58 | pass |
| retirement event | GUG | true | true | pass |
| retirement | MAR | 40 | 40 | pass |
| retirement event | MAR | true | true | pass |
| retirement | ALE | 23 | 23 | pass |
| retirement event | ALE | true | true | pass |
| retirement | CAF | 22 | 22 | pass |
| retirement event | CAF | true | true | pass |
| retirement | BOUT | 7 | 7 | pass |
| retirement event | BOUT | true | true | pass |
| retirement | PIR | 7 | 7 | pass |
| retirement event | PIR | true | true | pass |
| laps down | SUZ | 1 | 1 | pass |
| laps down | BEN | 1 | 1 | pass |
| laps down | ALL | 1 | 1 | pass |
| laps down | ALBM | 1 | 1 | pass |
| laps down | WAR | 1 | 1 | pass |
| laps down | DON | 1 | 1 | pass |
| laps down | MOD | 2 | 2 | pass |
| laps down | LAR | 2 | 2 | pass |
| laps down | BRA | 3 | 3 | pass |
| laps down | DAL | 5 | 5 | pass |
| stop | PRO | 27 | 27 | pass |
| stop | SENA | 30 | 30 | pass |
| stop | PIQN | 20 | 20 | pass |
| stop | BER | 28 | 28 | pass |
| stop | PAT | 33 | 33 | pass |
| stop | MAN | 32 | 32 | pass |
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

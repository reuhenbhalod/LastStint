# Anchor report: monaco-1984 (reconstructed)

Solver: 1 attempt(s), noise sigma 0.35s; all anchors pass: True.

| Anchor | Pass | Total |
|---|---|---|
| grid | 1 | 1 |
| order | 1 | 1 |
| gap | 5 | 5 |
| fastest | 16 | 16 |
| retirement | 11 | 11 |
| retirement event | 11 | 11 |
| laps down | 3 | 3 |
| safety car | 1 | 1 |
| leader | 3 | 3 |

| Anchor | Subject | Target | Achieved | Pass |
|---|---|---|---|---|
| grid | lap-1 order is the grid order | 17 cars: PRO MAN ARN ALBM LAU PIQN ROSK DEA WINM SENA PAT FABC LAF HES CEC GHI BEL | 17 cars: PRO MAN ARN ALBM LAU PIQN ROSK DEA WINM SENA PAT FABC LAF HES CEC GHI BEL | pass |
| order | classification (road order: BEL disqualified, at the sourced road place) | 9 cars: PRO SENA BEL ARN ROSK DEA ALBM GHI LAF | 9 cars: PRO SENA BEL ARN ROSK DEA ALBM GHI LAF | pass |
| gap | SENA | 7.446 | 7.445 | pass |
| gap | BEL | 21.141 | 21.14 | pass |
| gap | ARN | 29.077 | 29.075 | pass |
| gap | ROSK | 35.246 | 35.247 | pass |
| gap | DEA | 44.439 | 44.44 | pass |
| fastest | PRO | [115.596, 19] | [115.596, 19] | pass |
| fastest | SENA | [114.334, 24] | [114.334, 24] | pass |
| fastest | ARN | [115.541, 26] | [115.541, 26] | pass |
| fastest | ROSK | [115.775, 25] | [115.775, 25] | pass |
| fastest | DEA | [115.026, 26] | [115.026, 26] | pass |
| fastest | ALBM | [115.437, 22] | [115.437, 22] | pass |
| fastest | GHI | [117.439, 10] | [117.439, 10] | pass |
| fastest | LAF | [116.946, 25] | [116.946, 25] | pass |
| fastest | PAT | [118.527, 24] | [118.527, 24] | pass |
| fastest | LAU | [116.996, 22] | [116.996, 22] | pass |
| fastest | WINM | [115.712, 21] | [115.712, 21] | pass |
| fastest | MAN | [115.112, 13] | [115.112, 13] | pass |
| fastest | PIQN | [118.897, 11] | [118.897, 11] | pass |
| fastest | HES | [119.644, 12] | [119.644, 12] | pass |
| fastest | FABC | [124.465, 6] | [124.465, 6] | pass |
| fastest | CEC | [155.136, 1] | [155.136, 1] | pass |
| retirement | PAT | 24 | 24 | pass |
| retirement event | PAT | true | true | pass |
| retirement | LAU | 23 | 23 | pass |
| retirement event | LAU | true | true | pass |
| retirement | WINM | 22 | 22 | pass |
| retirement event | WINM | true | true | pass |
| retirement | MAN | 15 | 15 | pass |
| retirement event | MAN | true | true | pass |
| retirement | PIQN | 14 | 14 | pass |
| retirement event | PIQN | true | true | pass |
| retirement | HES | 12 | 12 | pass |
| retirement event | HES | true | true | pass |
| retirement | FABC | 9 | 9 | pass |
| retirement event | FABC | true | true | pass |
| retirement | CEC | 1 | 1 | pass |
| retirement event | CEC | true | true | pass |
| retirement | WAR | 0 | 0 | pass |
| retirement event | WAR | true | true | pass |
| retirement | TAM | 0 | 0 | pass |
| retirement event | TAM | true | true | pass |
| retirement | DEC | 0 | 0 | pass |
| retirement event | DEC | true | true | pass |
| laps down | ALBM | 1 | 1 | pass |
| laps down | GHI | 1 | 1 | pass |
| laps down | LAF | 1 | 1 | pass |
| safety car | leader's SC laps, sourced | [] | [] | pass |
| leader | PRO laps 1-10 | 10 laps | 10 of 10 laps | pass |
| leader | MAN laps 11-15 | 5 laps | 5 of 5 laps | pass |
| leader | PRO laps 16-31 | 16 laps | 16 of 16 laps | pass |

## Estimated

- Every lap time and lap-end Time is synthetic: solved to the anchors, not measured
- Position each lap follows from the synthetic times; the lap-1 order is the grid order, with the sourced lap-1 order at the front; each lap's leader and the sourced snapshots of the order and gaps are anchors, the rest of the order is estimated
- Lap times in between the anchors: pace + tyre wear + fuel + seeded noise, the pace moved by a constant between the laps the sourced order marks
- Fuel: 0.06s per lap of fuel on board; full tank at the start
- Stop loss: pit-lane time - 5.0s, 35% on the in-lap
- PitInTime is the in-lap's end; PitOutTime adds the out-lap's share of the lane time
- Weather: each lap's wetness from the facts file's sourced timeline (track states as wetness: {'dry': 0.0, 'damp': 0.15, 'wet': 0.45, 'heavy': 0.65}; ramps between sourced points are linear)
- Wet laps: the dry lap x (1 + the stint tyre's penalty at that wetness), the weather model's curves (data/wet.json); tyre wear at wet.wear_mult
- Compound: WET / INTERMEDIATE on wet-tyre stints, slick stints left empty (step 2.4's dry compound); a stint no source names gets the tyre that loses least over its laps
- BEL: disqualified, run to the flag P3 on the road at its sourced gap, +21.141s; the official result keeps it excluded
- Stops: only the sourced ones; cars may have stopped more (unknown)

## Notes

- BEL: disqualified, placed P3 on the road at +21.141s (sourced)
- CEC: fastest lap on lap 1, its lap-1 time is the fastest lap's

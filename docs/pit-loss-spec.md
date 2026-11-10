# Pit loss fix spec

**Date:** Nov 9, 2026. Asked for by the owner: "check if it is respective to how long they stop in real time".

## What a stop costs today

The game charges a stop's whole **pit loss**: slowing for the lane, the speed limit, the stationary time (about 2–3 s) and rejoining. The stationary time isn't a separate number.

The pipeline measures it from the real race (`track.stop_records`). The loss is the stopping car's in-lap plus out-lap, minus the median lap of the cars that didn't stop, corrected for the car's own pace. The green loss is the median over green stops. Each new stop adds one random **deviation** from the real stops' spread (`pitLossDeviations`).

Most tracks land within about a second of real figures. Bahrain, for example, measures about 23 s, Spa about 18.6 s and Singapore about 29 s.

## What's wrong, and the fixes

### P1. Wet races measure the green loss too high
**Problem.** On a mixed weather day most stops swap intermediates and slicks. Those in- and out-laps don't compare with the cars that stayed out.

| Race | Measured green loss | Same track, dry |
|---|---|---|
| Canada 2024 | 25.9 s | 18.9 s |
| Silverstone 2024 | 22.8 s | 18.8 s |
| Monaco 2023 | 24.8 s | ~20 s |
| Australia 2025 | 23.1 s (no green slick stops) | ~19.5 s |

**Fix.** A race is **wet-affected** when at least 25% of its stops fit or remove an intermediate or wet tyre. Its green loss comes from `pipeline/config/pit_loss_reference.json`, keyed by circuit:
- **Where there's a dry race:** the median of that circuit's measured dry races.
- **Monaco and Melbourne:** no dry race yet, so a published estimate is used, marked as such in the file.

The real stops in those races keep their own measured cost; only new stops use the green loss.

### P2. The random spread has impossibly fast stops
**Problem.** The spread allows stops up to 13–14 s faster than normal (Silverstone 2024, Monaco 2023). Driving the lane takes longer than that.

**Fix.** Deviations faster than **−4 s** are measurement noise and are dropped. Slow stops stay up to the current +15 s cap.

### P3. Some VSC figures are implausible
**Problem.** A stop under a VSC normally costs about 50–70% of a green one.

| Measured too high | Measured too low |
|---|---|
| Japan 2023: 33.5 s, above its green loss | USA 2018: 8.2 s |
| Russia 2020: 25.2 s, equal to green | Netherlands 2022: 8.3 s |
| Saudi 2022 | |
| USA 2021 | |
| Italy 2019 | |

**Fix.** A measured VSC loss outside **40–80%** of the green loss is replaced by the standard 0.69 × green, the same fallback already used when too few VSC stops exist.

### P4. A check that can't regress
`pipeline/tests/test_pit_loss.py` runs over every race file and checks three things:
- the green loss is within 3 s of its circuit's reference, where one exists;
- no deviation is below −4 s;
- the VSC loss is 40–80% of green.

## Not changed
- **The SC loss:** stays 0.55 × green everywhere.
- **The map:** the garage pause stays about 15% of the lane time.
- **Stationary time:** still not shown on its own.

## Rollout
- **Rebuild:** every race is rebuilt and the golden files are regenerated. The Monaco 2023 overtake fit is restored to the CI (Linux) values.
- **Daily rotation:** stale days are re-pinned in Admin once this is live; that's the owner's step.

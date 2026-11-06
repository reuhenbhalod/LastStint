# Fuel load spec

Ticket 46, "Add fuel load management". The headset's Fuel setting (normal / lift and coast) already existed, but it was a flat trade: +0.3 s a lap, tyres wear 10% slower. There was no tank, no burn and no weight. This adds a real fuel load.

## Decisions (Nov 6, 2026)

| # | Question | Decision |
|---|---|---|
| F1 | Fuel at the takeover | **Varies by race.** The car takes over with the fuel the flag needs at the standard burn, plus a margin drawn from the race's seed, between 1.5 kg short and 1 kg spare. The daily seed is the same for everyone, so every player gets the same margin. |
| F2 | Running dry | **Forced heavy saving.** An empty tank costs `dryLapDelta` (1.2 s) every green lap to the flag. There is no retirement and no DSQ. The driver says so once on the radio. |
| F3 | Grading | **Live play only**, like the battery. The server's replay of your calls includes fuel exactly (it's the same sim). The grader's blind playouts leave it out, so the odds, the grades and the tuned seeds are unchanged. |
| F4 | UI | **A gauge, the radio and a fuel call.** The Car panel shows the kg left and the kg short or spare at the flag, with a bar. The engineer asks "Lift and coast?" when you're short, and "Back to normal?" once the target is met. A dry tank gets a radio line. |

## Model (`packages/sim`, headset.json `fuel`)

| Setting | Value | Meaning |
|---|---|---|
| `burnPerLap` | 1.7 kg | The standard burn on a green lap. |
| `marginMin` / `marginMax` | −1.5 / +1.0 kg | The range of the margin at the takeover. It is drawn from `FUEL_STREAM` (10000) for the user's car. |
| `neutralBurn` | 0.6 | The share of a lap burnt under a SC or VSC. |
| `dryLapDelta` | 1.2 s | What an empty tank costs each green lap. |
| mode `burnMult` | lift and coast 0.85, push 1.06, manage 0.96 | Multiplies the burn. The pace and fuel modes multiply together. |

- **Weight.** The race's fitted fuel effect (`fuelEffectPerLap`) already makes every car lighter lap by lap at the standard load. The fuel load only adds the difference: each kg off the standard load moves the lap time by `fuelEffectPerLap / burnPerLap`, about 0.03 s. A short car is a little quicker; spare fuel is a little slower; saving fuel early makes the car lighter later.
- **Where it applies.** The player's car only, in live play with incidents on (`run.incidents`, the same gate as the race engineer side). Replays, incidents-off runs (the "real calls replay the real race" checks), the Python sim and parity never see it.
- **`fuelMargin(model, car, lap)`** returns the kg to spare at the flag at the standard burn from here. **`fuelConfig(model)`** returns the era's settings.
- **The moment finder** (`pauseAt`) now replays the real race with incidents off: it's an authoring tool about the real race. Before, its live chaos (and now the fuel weight) could move the proposals.

## Game (`apps/web`)

- **`game/fuel.ts`:** `fuelReading` gives the kg, the margin, the kg to save a lap, the gauge level and whether the tank is empty. Short is a margin below −0.5 kg (the call says how many laps of lift and coast make it up); back on target while saving is above +0.4 kg.
- **The fuel call** (`engineerCalls.ts`, after the driver's requests, before the battery):
  - It is asked at most every 6 laps, and not in the last 3.
  - The options are "Lift and coast" and "Not yet" ("Back to normal" and "Keep saving" while saving).
- **Car panel:**
  - Fuel kg, and short or spare, coloured red when short, amber when just under, the good colour otherwise.
  - A bar of the tank level.
  - When short, how many laps of lift and coast make it up.
- **Team radio:** the mode lines now say how much fuel a mode uses ("uses 15% less fuel").

## Notes

- A race with long safety cars (Abu Dhabi 2021's VSC and SC) saves a lot of fuel. A car that's short at the takeover is often back on target after a neutralization, as in a real race.
- The values are estimates to tune by playtesting, like the rest of the headset.

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

## Refuelling and fuel limits (eras build plan 4.2)

The race's `rules` switch these on (`packages/sim/src/refuel.ts`, `pipeline/src/pipeline/refuel.py`, which has the sources). Without them nothing changes.

**Refuelling** (`rules.refuelling`, 1994–2009 and 1983). Every car carries a tank (`car.tank`), counted in laps of fuel at the standard burn. There is no fuel load in kg in these races: the tank replaces it.
- At the takeover a car carries the fuel to the end of its next stop's in-lap (or the flag), plus a reserve of 1 lap (`RESERVE_LAPS`).
- A stop fills the tank to the next stint plus the reserve. The weight resets with it: a lap costs `fuelEffectPerLap × (tank − (laps − lap + 1))` over the single-tank model, so a single-tank car is today's model.
- A real stop keeps its measured loss. Any other stop pays the pit loss plus `secondsPerLap × (fill − refFill)`. `track.refuel` holds the fill rate: each race's F1DB stop times against the next stint's length, shrunk toward a physical prior that the race can barely move (owner decision, Nov 7 2026).
  - **The prior is 0.25 s per lap of fuel** (`PRIOR_SECONDS_PER_LAP` in both sims). A rig put in about 12 L a second: "Cars were fuelled at a rate of more than 12 litres per second" (Wikipedia, "Pit stop"). A lap burnt about 3 L (the owner's figure). So 3 L ÷ 12 L/s = 0.25 s a lap.
  - **Its sd is 0.01 s a lap** (`PRIOR_SD`, refuel.py). That is about half the spread the two figures allow: 12–12.5 L/s and 2.8–3.2 L a lap give 0.22–0.27 s. The F1DB races can't pull it back toward the old 0.0648, the pooled slope of their own stop times (`POOLED_SLOPE`, kept for the record). The most precise race, europe-2007 (slope se 0.025, slope −0.11), moves it to 0.20. A typical race (se 0.076) moves it by under 2%. The 30 refuelling races in data/raw/f1db fit to 0.199–0.252 s, with a median of 0.247 s.
  - **Why not the stops' own slope.** A stop's time also holds the tyre change and the entry and exit, and the next stint's laps are only a proxy for the fuel put in. The slope comes out at a quarter of the physical rate and is noisy (se 0.025–0.32 s).
  - **It is labelled an estimate.** A refuelling race's provenance lists `fuelLoads`. The Jolpica sidecar's fuel-loads block names the fill rate (`fillRate`), and the build report prints it.
  - **What a fill costs.** At a typical stop a long fill now costs 4–5 s more than a short one: at Hungary 1998 (a 33-lap tank) a stop out on lap 30 with 48 laps to go fills 33 laps long and 16 short. Those 17 laps cost 4.09 s on the race's own fit (0.2405 s a lap) and 4.25 s at the prior, both tested. At the old 0.0648 they cost 1.1 s.
  - **A race without a fit** takes the prior with `refFill` 0, so a new stop pays the whole fill on top of the pit loss, which already holds a typical fill. At 0.25 s a lap that overcharges: about 5 s for a 20-lap fill. The build doesn't store `track.refuel` yet (`refuel.fit_fill_rate` isn't called from assemble or build). It must be wired in before a refuelling race file ships.
- **The fill is required (owner decision, Nov 7 2026).** In a refuelling race every pit call states its fill (the `fill` on a pit call, `Fill` in types.ts); there is no default. `validateDecisions` (through `checkFill`, refuel.ts) rejects a pit call without one, and still rejects a fill in a race that doesn't refuel. A plan's stops (`PlanStop.fill`, `validatePlan`) are checked the same way, and `planCalls` puts each stop's fill on its call. Before this a call without a fill took "standard", so the real team's calls ran cars dry (Alonso, Brazil 2006).
- A fill is one of the player's three choices or an exact number of laps. R is the laps from the out-lap to the flag, T is the tank (`track.refuel.tankLaps`, the longest real stint), and n = ⌈R / T⌉ is the fewest stints to the flag:
  - **long:** min(R, T), a full tank (to the flag if it fits);
  - **standard:** ⌈R / n⌉, the fewest stops from here, split evenly;
  - **short:** ⌈R / (n + 1)⌉, one stop more, split evenly;
  - **`{ laps: n }`:** exactly n laps, but never past the flag (min(R, n)). n must be a whole number from 1 to `fillCap(model)`: the tank, or the longest real stint after a stop in the race file if that is longer (so a real fill is never refused where the file and the fit's source differ). Nothing else is a fill (`validFill`).
  The fill adds the reserve and subtracts what is still in the tank (`fillLaps`, both sims; the parity vectors cover exact fills). `fillOptions(model, outLap)` gives each choice's laps for the pit card.
- **The real fill.** The real team's calls (`realDecisions`) carry `{ laps: n }`, the fuel the real team put in: the next real stint, from the out-lap to the in-lap of the next real stop or to the flag (`realFill`), plus the reserve on top. That is what a scripted car's stop fills, so the real calls replay the real race (`live-replay.test.ts` re-tags every race as refuelling, with a fit and with the prior, and checks every car's time and that no tank goes below empty). Everything built from the real calls carries it: the moment finder's `pauseAt` (and its takeover-lap real stop), the grader's real-call option (`realOption`), the hard-call grades, and `realOptionId` (which matches the fill too).
- **Options and plans.** The simplest design that keeps the option counts as they are:
  - **A moment's box options** (moments.ts `boxCall`) are still one per compound. The real team's call (its in-lap and compound) carries the real fill; every other box option fills "standard". The label says so ("Box for hards, a standard fill", "…, fuel for 17 laps"). The authoring recipe and the tuning scripts build their box calls with `boxCall` too.
  - **The engineer's plans** (`enginePlans`, planner.ts `fuelled`) fill each stop exactly to the plan's next stop or the flag: `{ laps: next stop's in-lap − this in-lap }`.
  - **The grader's continuation** (`planRemainingStops`) adds stops to the car's strategy, not calls: as a scripted car's, they fill to the next planned stop or the flag.
- **On the race screen** (apps/web), nothing is preselected:
  - **The pit card** (Team radio): no fill is chosen until the player picks one; the tyre buttons are disabled until then ("Pick a fuel fill, then the tyres."), and the fill is cleared after each box call.
  - **Quick calls** (`QuickCallCard`, with the race's refuelling reading): an answer that boxes is disabled until a fill is picked on the card, and the fill goes on its pit calls. The timer running out still answers "no change": stay out.
  - **The plan editor:** each stop asks short, standard or long, none pressed on a new stop; an engineer's plan's exact fill shows as its laps. The plan can't be graded, picked or run until every stop has one (`fillsMissing`).
  - **Last line of defence:** `callBlocked` (eras/raceRules.ts) blocks a box call without a fill ("pick a fuel fill first") before it reaches the sim, so a call the sim would refuse becomes a radio line, not a crash.
- **Race files authored before this** carry moments whose box options have no fill. In a refuelling race the sim now refuses them, so such a race's moments must be re-authored (the finder adds the fills).
- In live play with incidents, the player's tank burns by the modes (lift and coast 0.85…) and by `neutralBurn` under a SC or VSC. An empty tank stops the car. Replays burn 1 lap of fuel a lap, and the grader's playouts never stop a car on an empty tank. `tankReading(model, car, lap)` gives the laps on board, the laps to empty, the last in-lap and whether the fuel reaches the flag.

**Fuel limits** (`rules.fuelLimit` in kg, 1984–88). The tank above, with no refuelling:
- The standard burn is the allowance over the distance.
- An empty tank stops the car, instead of costing `dryLapDelta`.
- The allowances are 220 L (1984–85), 195 L (1986–87) and 150 L (1988), turbo cars only. They are converted at 0.85 kg/L, AGIP's turbo-era fuel.

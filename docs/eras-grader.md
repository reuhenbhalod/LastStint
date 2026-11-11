# Eras grader fixes (Nov 8 2026)

What the grader does differently in an Eras race, and why. Code: `packages/sim/src/grade.ts`
(playOption), `sim.ts` (erasRace, erasContinuation, forkRun, rivalHeld),
`rivals/expert.ts` (rivalPlayout), `rivals/react.ts` (rivalAfterLap).

## Gating

Every change below applies only to an **Eras race**: `sim.ts erasRace(model)`, a race file with a
`rules` or an `eras` block. That is every Eras-only race file and every shared race merged with
its Eras overlay (the Worker's `getErasRace`). No Daily or Gauntlet race file has either block,
so Daily and Gauntlet playouts, grades and replays run exactly as before.

Proof that Daily and Gauntlet grades are unchanged: every moment of every Daily and Gauntlet
pool race (21 + 18 races, seeds 1 and 7, 256 moments, 300 samples, the beat-rival target) was
graded before and after the change; the two outputs are byte-identical. No Daily or Gauntlet
race file or golden file changed.

## 1. Fuel in playouts

Playouts used to clear the fuel load (`car.fuel`) and the live refuelling tank (`tankLive`), so
a car never ran dry in them: "push" on the last laps of a 1984-88 fuel-limit race graded best,
and "stay out" on a near-empty tank in a refuelling race graded green, though live play stops
the car. In an Eras race with a fuel rule (`rules.refuelling`, or a 1984-88 `rules.fuelLimit`)
`forkRun` now keeps both, so a playout burns fuel by the modes, a fuel-limit car stops when its
allowance runs out (`outOfFuel`) and a refuelling car stops when its tank runs dry, exactly as in
live play. The fuel margin is the run's own (drawn once at the takeover from the race's seed), so
every sample of every option starts from the same tank.

**The offline grader's pause** (Nov 8 2026). The hard-call counter (`eras/hard-calls.ts`) and
the moment author (`pnpm author`) grade from `moments.ts pauseAt`: the real race replayed to
just before the moment with incidents off, so the player's fuel used to be the replay's (the
tank burnt one lap a lap and never ran dry; a fuel-limit car carried no load). In an Eras race
with a fuel rule (`sim.ts erasFuelRule`) `pauseAt` now ends with `liveFuelFrom`: the laps
already run stay the real race's, and from the pause on the player's fuel burns live, as in
live play. A refuelling car's replay tank goes live (`tankLive`: burnt by the modes, dry stops
the car); a fuel-limit car gets live play's load (the takeover load from the race's seed, less
the default modes' burn over the laps run) and stops when it runs out. So pushing to a real
stop on a short tank grades as running dry (japan-2000, Schumacher at lap 22: push 94% before,
5% now). The tank isn't live from the takeover: under a SC the live burn saves fuel, which
would add weight to the replay with no fill-time credit at the measured real stops and move
the paused state off the real race (austria-2002's Barrichello lost the lead by lap 61).
Every other race (all Daily and Gauntlet) pauses as before: the same Daily/Gauntlet proof as
above (21 + 18 races, every candidate and authored moment, live runs at seeds 1 and 7, 356
graded moments) is byte-identical before and after.

Other Eras races (the hybrid-era fuel load, where an empty tank only costs `dryLapDelta` a lap)
keep the fuel load out of playouts, as Daily does: with the margin drawn around zero, about half
of all runs would otherwise grade every non-lifting option on a dry-tank penalty the player is
shown and can lift for (brazil-2019 graded 0-5% on every option at its early moments).

Modes persist in a playout as the option leaves them (as before): the grader doesn't assume a
later lift. So in a fuel-limit race "keep" at an early moment grades as running dry when the
margin is short, and lifting early grades best; the real driver's fuel management isn't known.

## 2. The continuation: the real team's plan

After an option's calls, the player's car needs a plan for the rest of the race. Daily keeps the
planner's best stop from wherever the option left the car (`planRemainingStops`). That is a
best-case oracle: in hungary-1992 at lap 61 it graded "stay out" 80% (it got a perfect later
stop for free) against "box" 60%, though live play with no further call finishes P4 vs P2.

In an Eras race the car keeps to **the real team's plan** (`erasContinuation`):

- The moment's question is answered by the option. If some option of the moment makes a pit
  call (a stop question), the real stop on the moment's box-now out-lap counts as answered:
  staying out there skips it, and it isn't made later (hungary-1992: no stop after "stay out").
  A moment with no pit option (a pace or battle call) answers no stop question, so a real stop
  on that lap still comes.
- The car then makes the real stops after that, on their real laps, with their real compounds
  and fills (a real stop keeps its measured loss). If the player has already stopped more often
  since the takeover than the real car had by then (an early stop), the first of the remaining
  real stops is dropped for each extra one: the early stop stands in for it.
- The rules come first, as a player is told them: if those stops would leave the car short of
  the two-compound rule or the race's minimum stops, the planner's legal plan is used instead.
  Fuel does not get this help: a car that skipped a fill runs dry, as in live play. In a
  refuelling race the planner's stops keep every stint after a stop within the tank (B3, Nov 9
  2026: `sim.ts withinTank` adds stops; a stop without a fill fills to `fillCap` at most).
- A player who logged a race plan of their own (pit calls after the option) follows it as
  called; nothing is added.
- Expert's own grader (`rivalPlayout`) uses the same continuation for the player's car.

Deterministic: it reads only the model, the run state and the calls. Stops are counted from the
pit calls (one per out-lap); a forced stop (a puncture's) isn't counted.

## 3. Live play's outcomes in playouts

- **Disqualification.** A playout is a live run, so `classify` disqualifies a car that reaches
  the flag short of the two-compound rule or the minimum stops, in playouts as in live play (it
  always did; the planner's continuation always made the stop, which hid it). Tested in
  `grade.test.ts`.
- **Incidents.** Playouts draw live play's incidents (crashes, mechanical failures, punctures,
  pushing raising the risk, wet slides) at the live rates, from each sample's seed (they always
  did). A crash's SC/VSC isn't added in a playout, since playouts already draw neutralizations
  at the base rates. So a green-graded call can still end in a breakdown in a live run: the grade
  is the chance over the samples, and one live run is one draw (turkey-2021's case).
- **Decided: storyline retirements and faults still to come stay out of playouts** (as the real
  SCs do): the grader doesn't know the race's future. Including them would grade with hindsight.

## 4. Storyline calls: the rival keeps its real mistake

The Expert rival grades its own options and takes the best, so a storyline that turns on the
real rival's late call couldn't happen: belgium-1992's Mansell took the slicks on the crossover
and won every path; europe-1993's Hill did the same. A race can now flag those real stops in
its overlay, `eras.storylineCalls` (`{ driver, lap, real, source }`, `lap` the stop's out-lap,
one of the driver's real stops; the pipeline checks it). While the race's rival still has a
storyline call to come (`sim.ts rivalHeld`), its plan stays its real one whatever its policy:
no Standard cover or going long, no Smart overcut or wet switch, no Expert decision point. After
its last storyline call the policy runs as usual, unless that call is marked `untilFlag`: then
the rival keeps its real plan to the flag. It also holds in grader playouts (their Smart rivals
run the same rules).

belgium-1992's rival is Mansell again (call: slicks at the end of lap 33, Motor Sport) and
europe-1993's is Hill again (calls: slicks at the end of lap 17, wets at the end of lap 24,
Motor Sport; the second `untilFlag`, since his four later stops aren't sourced and the
reconstruction absorbs them: held only to lap 25, the Expert Hill took the dry crossover on time
and won). Both were rebuilt.

## 5. No rewrite for races the Eras side really won

`eras.storyline.rewriteCondition` is optional (schema, types, evaluator); a headline comes with a
rewrite condition and only with one. A race without one has no rewrite: the evaluator returns
`rewrite: null`, no history book entry is written, the results screen shows no rewrite stat,
and the history book's rewrites total counts only the races that have a rewrite condition (a race
whose storyline isn't written yet still counts as one; the Worker's `hasRewrite`). Taken out of
the eight races whose Eras side really won: hungary-2022, germany-2018, germany-2019,
abu-dhabi-2021, hungary-1986, mexico-1986, monaco-1984, portugal-1985.

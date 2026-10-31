# `@boxthislap/sim` API

The race simulator, grader and scoring for the game. It is pure TypeScript with no browser or Node dependencies, so the same code runs in the page, in Web Workers and in the Cloudflare Worker that verifies scores.

- **Version:** 0.1.0 (semver, see [Versioning](#versioning)).
- **Race files:** the race-model JSON at schema v9, in `data/races/<race-id>.json`.
- **Working example:** [`packages/sim/examples/daily-race.ts`](../packages/sim/examples/daily-race.ts) plays a full daily race. CI runs it (`tests/example.test.ts`), so it always matches this document.

```ts
import { initRun, stepLap, decide, gradeMoment, classify, scoreRun } from '@boxthislap/sim';
```

## How a daily race runs

1. **Start.** `initRun(model, seed, { decisions: [] })`.
   - Passing `decisions` (even empty) makes the user's car (`model.userSide`) player-controlled and the rival (`model.rival`) reactive.
   - Every other car follows its real strategy.
   - The `seed` comes from the daily (`GET /api/daily`); everyone playing that day gets the same race.
2. **Tick.** Call `stepLap(run)` once per lap, every 3–5 seconds.
   - It returns `run.state`: the order, each car's tyre/compound/total time, and the flag.
   - New entries in `run.notes` are things to narrate: the rival covering or staying out, a team-order swap, a driver error.
3. **Calls between moments.** The BOX button and the headset panel call `decide(run, call)` for a lap that hasn't run yet (see [Calls](#calls)).
4. **Decision moments.** When `run.state.lap + 1` equals a moment's `lap` (from `model.decisionMoments`), pause.
   - Grade the moment's options while the player reads them (in Web Workers, see [Grading](#grading)).
   - Apply the chosen option's calls with `decide()`, then resume ticking.
5. **Flag.** `isFinished(run)` becomes true. `classify(run)` gives the result; `scoreRun(...)` gives the score.
6. **Submit.** Send `run.decisions` (the full call log) to `POST /api/runs`. The server rebuilds the identical race from `(model, seed, decisions)` and recomputes everything.

The example implements exactly this loop.

## Calls

All calls go through `decide(run, call)`.

- It throws if the lap has already run or the call is invalid. `validateDecisions(model, calls)` checks a list up front.
- A call's `lap` is a lap that hasn't run yet: `run.state.lap + 1` or later.

| Call | Shape | Effect |
|---|---|---|
| Pit | `{ lap, kind: 'pit', compound }` | Box at the end of `lap`. The stop is charged on `lap + 1`, the out-lap. `compound` is a key of `model.compounds`. |
| Headset mode | `{ lap, kind: 'mode', key, value }` | Standing mode from `lap` on (green laps only). `key`: `pace` (`push` / `standard` / `manage`), `fuel` (`normal` / `liftAndCoast`), `battle` (`attack` / `hold` / `defend`). |
| Team order | `{ lap, kind: 'teamOrder', order }` | `letTeammatePast` or `teammateLetsYouPast`: the yielding car lifts if it starts a green lap directly ahead within 1s (open for 3 laps). `holdUp` / `release`: the teammate defends against the rival while directly ahead of it. Requires a teammate (`teammateOf(model)`). |
| Radio answer | `{ lap, kind: 'radio', momentId, optionId }` | Logged only. Radio moments map their options to the calls above. |

Mode and team-order effects are calibrated estimates in `packages/sim/src/headset.json`, tuned in playtests.

### Rules the UI should surface

- **Two-compound rule.** In a dry race a car must run two different dry compounds. `ruleSatisfied(run.state.cars[model.userSide])` says whether the player has. A car reaching the flag without it is disqualified: `result.disqualified`, classified last. Warn before the last laps (the example has an `onRuleWarning` hook).
- **Rival reactions.** Under a SC/VSC the rival covers your stop if it stays ahead after both stops, or goes long to take track position when its tyres reach the flag without stopping. Under green it covers inside the undercut window when its own stop is near. Each reaction adds a note: `rival-cover` or `rival-stays-out`.
- **Fixed events.** Real safety cars, VSCs and retirements happen on the laps they really did, whatever the player does.

## State you render

`run.state` (`RaceState`) has:

- `lap`: the last completed lap.
- `flag`: `green` / `sc` / `vsc` / `red`.
- `order`: running cars by time, then retired cars.
- `cars[code]` (`CarState`):
  - `compound`, `tyreAge` (laps on the set) and `tyreWear` (effective wear).
  - `totalTime`: seconds since takeover; gaps are differences of these.
  - `pittedThisLap`, `retired`.
  - `modes`, `compoundsUsed`.
- `teamOrders`: `{ holdUp, swap }`.

Other useful parts of the model:

- **Race-level:** `race` (`id`, `name`, `laps`, `takeoverLap`, `seed`), `userSide`, `rival`, `drivers`, `events`, `compounds`.
- **Real result:** `realResult`.
- **The real team's calls:** `realDecisions(model)`.

## Decision moments

`model.decisionMoments` (`DecisionMoment[]`) comes from `data/moments/<race-id>.json`. Each moment has:

- `id`, `lap` (the calls are for this lap, so pause after `lap - 1`).
- `trigger`: `SC` / `VSC` / `rivalPit` / `undercut` / `cliff`.
- `target`: `{ kind: 'win' }`, `{ kind: 'beat-rival' }` or `{ kind: 'position', atBest }`.
- `options`: `{ id, label, decisions }[]`, 2–4 of them.
- `realOptionId`: which option the real team took. Show it, graded, on the results screen.

**Finding moments.** `pnpm --filter @boxthislap/sim moments <race-id>`:

- Proposes moments from the race's triggers and grades each one from the real race's state.
- Keeps genuine dilemmas: some option is more than 5 points behind the best, and the best doesn't lead by more than 30.
- Writes them to `data/moments/proposed/<race-id>.json`.
- A person picks 2–4 and saves them as `data/moments/<race-id>.json`; `pipeline build <race-id>` embeds them.

Abu Dhabi 2021 ships with four approved moments, matching the UI race script (`data/scripts/abu-dhabi-2021.json` on main): `vsc-cover` (lap 36), `manage-or-push` (49), `sc-stop` (53) and `restart-stance` (57).

## Grading

`gradeMoment(run, options, target, samples = 300)` → `MomentGrade` `{ lap, samples, target, best, options: [{ id, probability, behindBest, band }] }`.

How a grade is computed:

- Each option is played to the flag `samples` times. Option k's run i shares its random draws with every other option's run i (common random numbers).
- **No hindsight.** Events starting after the decision lap are replaced by randomly drawn SC/VSC periods, and future retirements are dropped. The SC that prompts a call is known.
- After the option's calls, the player's car plans its best remaining stop: none or one, legal under the two-compound rule. So options are compared on the call alone.
- **Bands:** green ≤ 0.5, yellow ≤ 5, orange ≤ 15, red beyond, in percentage points behind the best (`BAND_EDGES`).

**The real team's call:** grade `realOption(run, moment.lap)` alongside the player's options, or use the moment's `realOptionId`.

### In Web Workers

A `Run` doesn't survive `postMessage`. Send a plain-JSON job and split its samples across workers:

```ts
// page
const job = gradeJob(run, moment.options, moment.target); // JSON-safe
const ranges = [[0, 150], [150, 300]];                    // one per worker
const results = await Promise.all(ranges.map(([from, to], i) => ask(workers[i], { job, from, to })));
const grade = mergeGradeJobs(job, results);               // same as gradeMoment(run, ...)

// worker
self.onmessage = ({ data: { job, from, to } }) => self.postMessage(runGradeJob(job, from, to));
```

`mergeGradeJobs` returns exactly what `gradeMoment` would; it throws if the ranges don't cover the samples exactly once.

Measured on an M-series laptop, for 4 options × 300 samples × 25 laps: 1 worker about 77 ms, 2 workers 42 ms, 4 workers 22 ms. Use 2–4 workers on phones.

## Scoring

`scoreRun([{ grade, chosen }, ...])` → `RunScore`:

- `score`: 0–100, the mean of band points (green 100, yellow 70, orange 40, red 0).
- `calls`: per-call bands.
- `meanProbability`: the first tie-break; the finishing result breaks any remaining tie.
- The calls' bands are the share card's coloured squares.

## Determinism and server verification

A run is fully defined by `(model, seed, decisions)`. Same inputs, same race, same grades, on any machine.

- **Randomness.** Each car draws from its own seeded streams, so one car's calls never shift another car's luck.
- **Server.** The Worker re-runs `initRun(model, seed, { decisions })` to the flag, re-grades each moment with `gradeMoment`, and calls `scoreRun`. Never trust a client score.
- **Without `decisions`.** `initRun(model, seed)` replays every car's real strategy. This is how the model is validated against the Python reference (`tests/parity.test.ts`).

## Reference

| Export | Purpose |
|---|---|
| `initRun`, `stepLap`, `isFinished`, `classify`, `simulate` | Run a race lap by lap, or to the flag in one call |
| `decide`, `validateDecisions`, `realDecisions`, `teammateOf`, `ruleSatisfied` | Player calls and rules |
| `gradeMoment`, `realOption`, `bandFor`, `BAND_EDGES`, `GRADE_SAMPLES` | Grading |
| `gradeJob`, `runGradeJob`, `mergeGradeJobs`, `runFromJob`, `countHits`, `gradeFromHits` | Grading in Web Workers |
| `scoreRun`, `BAND_POINTS` | Scoring |
| `candidateMoments`, `proposeMoments`, `pauseAt`, `verdictFor`, `QUALITY` | Moment finding (tooling) |
| `forkRun`, `playOption`, `planRemainingStop`, `sampleSeed`, `reachedTarget` | Lower-level grader pieces |
| `cleanLap`, `passProbability`, `mulberry32`, `deriveSeed` | Model internals, exposed for tests and tools |
| Types | `RaceModel`, `RaceState`, `CarState`, `Decision`, `TeamOrder`, `Modes`, `RaceResult`, `RaceNote`, `DecisionMoment`, `MomentOption`, `Target`, `MomentGrade`, `OptionGrade`, `RunScore`, `GradeJob`, `GradeJobResult`, `Run`, `RunOptions`, `ForkOptions` |

## Versioning

`@boxthislap/sim` follows semver; while it is 0.x, a breaking API change bumps the minor version (0.1 → 0.2). The race-model JSON has its own `schemaVersion`, bumped on any breaking change to the file. A breaking change to either is noted here.

| Version | Schema | Notes |
|---|---|---|
| 0.1.0 | v9 | First documented API. |

# Phase 3 Spec: Game Frontend (React + Vite)

Status: draft · Owner: @Reuhen · Branch: `UI` · Depends on: Phase 2 (`@boxthislap/sim`, done)

## Purpose

Build the mobile-first web game that lets a player run the pit wall for a Daily Race: watch
the laps tick by, make 2–4 strategy calls plus standing headset modes, and get every call
graded against the best option and the real team. The frontend is a thin shell over the
deterministic simulator — it renders `RaceState`, collects `Decision`s, and calls the
grader; it contains no race physics of its own.

Most players arrive from a shared link on a phone, so **design for a 390px screen first**.

## Scope

**In scope**
- The full Daily Race, playable end to end, client-side: daily card → race → decisions →
  result, with grading, headset modes, percentile/rank placeholders, and a share card.
- A data layer that loads a static race model + race script now and swaps to the Worker API
  (`/api/daily`, `/api/runs`) later with no UI changes.
- The grader running in a Web Worker so the race animation never stutters.
- Resume-after-refresh for an in-progress run.

**Out of scope (later phases)**
- The Worker/leaderboard backend and server-side score verification (Phase 4).
- Authoring the decision-moment option sets for the full race pool (Phase 5) — this spec
  defines the format and ships one authored race (`abu-dhabi-2021`) as the dev fixture.
- Track map, image share cards, persona vector, sound/haptics (Phase 6 polish).
- Accounts / Season mode (Phase 7).

## Dependencies and data contract

### What the UI consumes

- **`@boxthislap/sim`** (workspace package) — the only source of race behaviour:
  `initRun`, `stepLap`, `decide`, `isFinished`, `classify`, `forkRun`, `realDecisions`,
  `validateDecisions`, `DEFAULT_MODES`, and `gradeMoment`/`bandFor` with `Target`,
  `GradeOption`, `MomentGrade`. Types: `RaceModel`, `RaceState`, `CarState`, `Decision`,
  `Modes`, `RaceResult`, `RaceNote`.
- **Race model JSON** (`data/races/<id>.json`, schema v5) — fitted model + event timeline.
- **Race script JSON** (new, see below) — the authored decision moments, their options, and
  radio copy.

### The race script (new authored artifact)

The race model says *when* the game pauses (`decisionMoments` laps) but not *what to ask* or
*which options to offer*. That is authored content, one file per race, validated by its own
schema in `packages/schema/race-script.schema.json`:

```jsonc
{
  "raceId": "abu-dhabi-2021",
  "target": { "kind": "beat-rival" },          // or {"win"} / {"position","atBest":N}
  "intro": "You're Mercedes. 24 laps left, leading Max by 5s on worn hards.",
  "moments": [
    {
      "lap": 36,
      "id": "vsc-cover",
      "prompt": "Max has boxed for fresh hards under the VSC. Do you cover?",
      "options": [
        { "id": "stay", "label": "Stay out", "decisions": [] },
        { "id": "box", "label": "Box, hard",
          "decisions": [{ "lap": 36, "kind": "pit", "compound": "HARD" }] }
      ]
    }
  ]
}
```

Each option's `decisions[]` are real `Decision`s the sim understands; the grader grades them
with `gradeMoment(run, options, target)`. Standing headset modes are separate (always-live
controls, not moments). Radio copy is original (never real team radio).

## Architecture

**Stack:** Vite + React 18 + TypeScript (strict) + Tailwind v4 (all already set up in
`apps/web`). SVG for the timing tower and gap trace. No router needed at launch (one screen
flow driven by the state machine).

**Layers**
1. **Data layer** (`src/data/`) — a `DailyProvider` interface returning `{ date, raceId,
   seed, model, script }`. `StaticDailyProvider` loads a bundled/fetched model + script now;
   `ApiDailyProvider` hits `/api/daily` later. The UI depends only on the interface.
2. **Engine layer** (`src/engine/`) — thin wrappers over `@boxthislap/sim`: own the `Run`,
   expose `step()`, `apply(decision)`, `result()`, and post grading jobs to the worker.
3. **Grader worker** (`src/engine/grader.worker.ts`) — receives `(model, seed, decisions,
   options, target)`, rebuilds the run, calls `gradeMoment`, posts back `MomentGrade`.
   Keeps the ~300-sample grade off the render thread.
4. **State machine** (`src/state/`) — a typed `useReducer` store (see below).
5. **UI** (`src/screens/`, `src/components/`) — pure render from state + dispatch.

**Why a Web Worker:** `gradeMoment` runs ~300 samples × up to 4 options to the flag at each
moment; on the main thread that would freeze the clock. The worker runs it while the player
reads the options.

### Game state machine

```
loading → intro → racing ⇄ decision → finished → submitting → results
                              ↑ grading (worker) resolves while paused
```

- Modelled with `useReducer`; every transition is an explicit, testable action.
- `racing` ticks one lap every 3–5s (1×) or faster (2×); each tick calls `step()`.
- Entering a lap in `decisionMoments` transitions to `decision`, pauses the clock, and posts
  a grade job for the moment's options (so the "real team / best call" is ready at results).
- `BOX` and headset modes dispatch decisions on the current lap **without** pausing.
- The in-progress run (date, decisions, lap) persists to `localStorage` (try/catch wrapped);
  on load, a matching date resumes.

Recommended: plain typed `useReducer` + a discriminated-union state (dependency-light). XState
is a reasonable alternative if the chart grows; not needed at launch.

## Requirements

### Functional

- **FR1 Daily card** — show race title or Mystery-Race setup, the user's side, laps left, a
  one-line situation, a Start button, and yesterday's result if present.
- **FR2 Race view** — live timing tower, gap-to-rival trace, the user's tyre/age, headset
  panel, BOX button, lap counter, and a 1×/2× speed control. Laps advance automatically.
- **FR3 Standing modes** — pace (push/standard/manage), battle stance (attack/hold/defend),
  and, for eras that have them, fuel and energy. Flippable any lap; current setting always
  visible. Each flip is a `mode` decision on the current lap.
- **FR4 BOX** — always live; pressing it opens compound choice and books a pit decision for
  the current lap; cancellable until the car reaches pit entry.
- **FR5 Decision moments** — at each scripted moment the clock pauses and 3–4 options (with
  short context: gap, tyre age, pit loss) are shown; selecting one applies its decisions and
  resumes.
- **FR6 Radio moments** — driver/engineer messages rendered with original copy; the answer
  maps to the option's decisions.
- **FR7 Result** — final classification, a grade chip per call (with the probability delta on
  tap), the real team's call and its grade, percentile + rank (placeholder client-side until
  Phase 4), and a strategist line (placeholder).
- **FR8 Share** — spoiler-free text card: result line, colored grade squares, percentile,
  link (e.g. `Pit Wall #12 🏆 🟩🟩🟨🟩 P97`). Copy-to-clipboard.
- **FR9 Resume** — a refresh mid-race restores the run from `localStorage`.
- **FR10 How it works** — rules, grading explanation, data sources, "not affiliated"
  disclaimer.

### Non-functional

- **NFR1** Mobile-first at 390px; works offline for a loaded daily (model + script + sim are
  all client-side).
- **NFR2** The grade for a moment resolves within a lap-tick or two (worker, ~300 samples);
  never blocks the animation.
- **NFR3** Deterministic: the same (model, seed, decisions) renders the same race — the
  client shows exactly what the Worker will later recompute.
- **NFR4** No F1 wordmark, team liveries, or logos; team-neutral colours; tyre compounds use
  the soft/medium/hard convention **with a letter** so colour isn't the only signal.
- **NFR5** Accessible: keyboard-playable, labelled controls, visible focus.

## Screens

| Screen | Contents |
|---|---|
| Daily card | Title / Mystery setup, your side, laps left, one-line situation, Start, yesterday's result |
| Race | TimingTower, GapTrace, your tyre+age, HeadsetPanel, BoxButton, lap counter, speed control |
| Decision | Radio-style prompt, 3–4 option cards with context, select-to-commit |
| Results | Classification, per-call GradeChips, real-team calls, percentile/rank, persona, share |
| How it works | Rules, grading, data sources, disclaimer |

## Components

- **TimingTower** — ordered list from `state.order`: position, driver code, interval/gap, tyre
  compound letter + age; user and rival highlighted.
- **GapTrace** — small SVG line of the gap to the rival over recent laps.
- **HeadsetPanel** — segmented controls per mode in `Modes`; era-gated rows.
- **BoxButton** — large, thumb-reachable; opens a compound picker; cancellable.
- **RadioMessage** — engineer/driver line + option answers.
- **GradeChip** — green/yellow/orange/red (`bandFor`); shows `behindBest` on tap.
- **SpeedControl**, **LapClock**, **ResultTable**, **ShareCard**.

## Implementation steps

### 3.1 Data + engine foundation
- Define the `DailyProvider` interface and `StaticDailyProvider` (bundles `abu-dhabi-2021`
  model + an authored script).
- Add `packages/schema/race-script.schema.json` and author `data/scripts/abu-dhabi-2021.json`
  (2–4 moments; validated).
- Engine wrapper owning a `Run` with `step/apply/result`.
- **Acceptance:** a test drives a full race through the engine with scripted real decisions
  and reproduces the sim's `classify` result; the script validates against its schema.

### 3.2 State machine + race loop (no visuals)
- Typed reducer for the state chart; auto-tick with 1×/2× and pause at `decisionMoments`.
- localStorage persistence + resume.
- **Acceptance:** reducer transition tests cover every edge; a refresh mid-race resumes to the
  same lap and decisions.

### 3.3 Race screen
- TimingTower, GapTrace, tyre display, LapClock, SpeedControl wired to `RaceState`.
- BoxButton + HeadsetPanel dispatching `pit`/`mode` decisions.
- **Acceptance:** playing on 1× advances laps and the tower reorders to match `state.order`;
  a mode flip is reflected in the run's decisions.

### 3.4 Decision + grading
- DecisionModal renders the moment's options with context; selecting commits.
- Grader worker; post a job on entering a moment; stash `MomentGrade` for results.
- **Acceptance:** at the Abu Dhabi VSC moment, grading returns a `MomentGrade` with a `best`
  option and bands; the UI never drops a frame (grade off-thread).

### 3.5 Results + share
- ResultTable from `classify`; GradeChips per call vs the real-team call; placeholder
  percentile/rank/persona; ShareCard with copy-to-clipboard.
- **Acceptance:** finishing a race shows a grade per call and the real-team comparison;
  the share text is spoiler-free and copies.

### 3.6 Daily card + How-it-works + polish pass
- Daily card from the provider; How-it-works page; mobile layout + a11y pass; empty/error/
  loading states.
- **Acceptance:** full flow playable start to finish on a 390px viewport; Lighthouse a11y
  pass; keyboard-only playthrough works.

## Testing

| Layer | Tests |
|---|---|
| Engine | Full-race playthrough matches `sim.classify`; script-schema validation |
| State machine | Reducer transition + resume unit tests (vitest) |
| Grader worker | Message round-trip returns a `MomentGrade`; determinism |
| Components | Render tests for TimingTower/GradeChip from fixture state |
| E2E | One Playwright playthrough: start → make calls → results → share |

CI runs `pnpm typecheck` + `pnpm test`; the web build (`pnpm --filter @boxthislap/web build`)
must pass. Grading uses the bundled fixture (no network).

## Open decisions

- [ ] **State management:** typed `useReducer` (recommended, dependency-light) vs XState.
- [ ] **Backend now:** confirm static provider + client-side grading for this phase, Worker
  wired in Phase 4 (recommended), vs stand up a minimal Worker first.
- [ ] **Decision-moment authoring:** this spec's `race-script.json` format — confirm before
  authoring the pool in Phase 5.
- [ ] **Target per race:** `beat-rival` as the default grading target (vs `win` / `position`).
- [ ] **Mystery Race:** include the reveal mechanic now or defer to polish.

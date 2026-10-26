# F1 Pit Wall: Implementation Plan

Oct 17, 2026 · @Reuhen

## Overview

The Daily Race is the launch product. Phases run in dependency order, and their timing can shift as needed. Everything after launch (Survivor, older eras, Season mode) is Phase 7.

### Scope at launch

- One Daily Race per day from 2018 onward, the same for everyone, no login.
- The user always runs the side with the hard or controversial call.
- Pit calls, standing headset modes, and radio moments at decision points.
- Every call graded against the best option and the real team's call; percentile, leaderboard, persona, share text.
- At least 21 validated races queued on launch day.

### Build principles

1. **Simulator first.** Nothing else matters if the sim can't reproduce real races. Data and modeling come before any game code.
2. **One race end to end before many races.** Abu Dhabi 2021 goes through every layer before a second race is added.
3. **Simple models, upgraded on evidence.** Ordinary regression first; add complexity only when validation fails.
4. **One simulator, two places.** The TypeScript sim runs in the browser and in the Worker, so scores can be verified.
5. **Never trust the client.** The server recomputes every score from the user's decisions and the seed.
6. **Content is a pipeline, not a one-off.** A daily game needs 365 races a year, so race prep must be a repeatable checklist.

### Phase gates

| Gate | Closes | Pass condition |
| --- | --- | --- |
| G1: Model works | Phase 1 modeling | Python sim reproduces Abu Dhabi 2021 and Hungary 2019 finishing order and gaps within a few seconds per driver |
| G2: Sim parity | Phase 2 | TypeScript sim matches Python output on every test race; grader runs under 200 ms per decision |
| G3: Playable | Phases 3–4 | A full Daily Race is playable end to end with verified scores on the leaderboard |
| G4: Beta passed | Phase 6 beta | Beta testers finish a race without help; no sim result they call unrealistic goes unfixed |
| Launch | Phase 6 | 21+ races queued, monitoring live, legal pages up |

## Phase 0: Foundation

Set up one monorepo, two toolchains and CI before writing any model code. It saves rework later.

### Accounts

- [ ] GitHub repository (private until launch).
- [ ] Cloudflare account: Pages, Workers, D1. All have free tiers sufficient for launch.
- [ ] Domain: buy once a name is chosen. It can't contain "F1" or "Formula 1".
- [ ] Sentry (error tracking) and PostHog or Plausible (analytics): free tiers.
- [ ] Anthropic API key, needed only later for race-report extraction.

### Repo layout

```
pitwall/
  pipeline/                 Python: data → race model JSON
    pyproject.toml
    src/pipeline/
      ingest.py             FastF1 loading + cache
      clean.py              lap filtering rules
      fit.py                lap-time regression
      track.py              pit loss, dirty air, overtaking
      events.py             SC, VSC, rain, retirements
      scenario.py           takeover state, decision moments
      export.py             writes race JSON
      validate.py           replay real strategies, score error
      sim_reference.py      Python reference simulator
      cli.py                `pipeline build abu-dhabi-2021`
    notebooks/              exploration
    tests/
  packages/
    schema/                 race-model.schema.json (single source of truth)
    sim/                    TypeScript simulator (browser + Worker)
  apps/
    web/                    Vite + React + Tailwind game
    worker/                 Cloudflare Worker API (Hono) + D1 migrations
  data/
    races/                  generated race JSON, one per race
    golden/                 Python sim outputs for parity tests
  docs/
```

### Tooling

| Area | Choice | Notes |
| --- | --- | --- |
| Python env | uv | Fast installs, lockfile; Python 3.12 |
| Python libs | fastf1, pandas, numpy, statsmodels, scipy, matplotlib, pydantic, jsonschema, typer | typer for the CLI |
| Node | pnpm workspaces | One install for sim, web, worker |
| TypeScript | strict mode; vitest for tests | Shared tsconfig base |
| Lint/format | ruff (Python), Biome or ESLint + Prettier (TS) | Run in pre-commit |
| Schema | JSON Schema in packages/schema | Validated by pydantic/jsonschema on export and by zod (or ajv) on load |

### CI (GitHub Actions)

- On every push: ruff, Python tests, TypeScript type check, vitest.
- Parity job: run the TS sim on every race in data/golden and compare with Python outputs.
- Deploy: main branch deploys web to Cloudflare Pages and the Worker via Wrangler.
- FastF1 data is cached locally and not downloaded in CI; tests use small saved fixtures.

**Done when:** `pnpm test` and `uv run pytest` pass on an empty project, and a hello-world page and Worker are live on Cloudflare.

## Phase 1: Data pipeline and race model

Turn FastF1 timing into a race model that can answer "what if" questions, prove it on two races (gate G1), then turn the notebook into a repeatable CLI.

### 1.1 Ingest

- Enable the FastF1 cache (`fastf1.Cache.enable_cache('cache/')`) so each race downloads once.
- Load the race session with laps, weather and messages; skip telemetry until the track map is needed.
- Keep per lap: driver, team, lap number, lap time, compound, tire age, stint, pit in/out times, track status, position, accuracy flag.
- Save a raw snapshot (parquet) per race so later steps never re-download.

### 1.2 Clean

Clean laps are the ones that show true pace. Drop:

- laps FastF1 marks as not accurate;
- laps not run fully under green flags (track status other than green);
- pit in-laps and out-laps, and lap 1;
- traffic laps: within about 1 second of the car ahead (kept separately to fit the dirty-air penalty);
- outliers: slower than about 107% of that driver's median clean lap.

Log how many laps each rule removes. If one rule removes most of a driver's laps, the threshold is wrong for that race.

### 1.3 Fit the lap-time model

```latex
t = pace_{driver} + offset_{compound} + wear_{compound} \cdot age + fuel \cdot lap + \varepsilon
```

- Fit with ordinary least squares in statsmodels: a dummy per driver, a compound offset, a wear rate per compound (compound × tire age), and one fuel term.
- Fuel and tire wear both grow every lap, but tire age resets at each stop while lap number doesn't. Fitting across stints separates them.
- **Cliff:** plot residuals against tire age per compound. If late-stint residuals rise sharply, add a second, steeper wear rate past a fitted cliff age.
- **Noise:** each driver's residual standard deviation.
- **Sanity checks:** wear rates positive and ordered soft > medium > hard; the fuel term negative (cars get faster); driver pace order roughly matches the race.
- **Thin data:** if a compound has too few laps, borrow its offset and wear from other years at the same track.

### 1.4 Track parameters

| Parameter | Method |
| --- | --- |
| Pit loss | In-lap + out-lap minus two clean laps; median over all stops |
| Pit loss under SC/VSC | Same method, using stops made under neutralization |
| Dirty-air penalty | Mean lap-time difference of traffic laps vs clean laps, same driver and stint |
| Overtaking difficulty | Logistic regression of pass probability on pace delta and gap; pool several seasons at the same track |
| SC and VSC lap times | Median lap time under each, used to slow the field in the sim |

### 1.5 Events and scenario

- Read race control messages and track status to log SC, VSC, red flags, rain and retirements with their laps.
- Record each car's state at the takeover lap: position, gap, compound, tire age, and its real strategy.
- Mark decision moments: SC/VSC starts, the rival pitting, undercut windows (gap under pit loss), tire age near the cliff, rain. Hand-pick the final 2–4 per race in Phase 5.

### 1.6 Schema and export

- Define race-model.schema.json in packages/schema with a `schemaVersion` field; bump it on any breaking change.
- Top-level keys: race, era, track, compounds, drivers, fuelEffectPerLap, events, decisionMoments, realResult, userSide.
- export.py validates against the schema before writing data/races/\<race-id>.json.

### 1.7 Python reference simulator and validation

- A simple Python simulator (sim\_reference.py) that runs the lap loop. It exists to validate the model and to produce golden files for the TypeScript port.
- Validation: run 500 simulations with every team's real strategy. Report mean absolute error in each driver's gap to the leader, and how often the predicted finishing order matches.
- Pass bar: the main contenders' gaps within a few seconds and their finishing order correct in most runs. Tighten as the model improves.
- Save outputs for fixed seeds to data/golden/ for parity tests.

### 1.8 Sequence

| Step | Work | Output |
| --- | --- | --- |
| 1 | Notebook on Abu Dhabi 2021: load, clean, plot lap time vs tire age per stint | Cleaning rules that look right on plots |
| 2 | Fit model and track parameters; Python sim; validate Abu Dhabi 2021 and Hungary 2019 | **Gate G1** |
| 3 | Move notebook code into the pipeline package and CLI; schema; run 10 more races | `pipeline build <race>` produces validated JSON |

## Phase 2: Simulator engine

Port the Python reference sim to a pure TypeScript package with no browser or Node dependencies, so the same code runs in the game and in the Worker. Gate G2 closes this phase.

### 2.1 Core types

```ts
type RaceModel = { /* parsed race JSON, validated with zod or ajv */ };

type CarState = {
  code: string; position: number; totalTime: number;
  compound: Compound; tyreAge: number; lapsOnFuel: number;
  inPitThisLap: boolean; retired: boolean;
  modes: { pace: 'push' | 'standard' | 'manage'; battle: 'attack' | 'hold' | 'defend' };
};

type Decision =
  | { lap: number; kind: 'pit'; compound: Compound }
  | { lap: number; kind: 'mode'; key: 'pace' | 'battle'; value: string }
  | { lap: number; kind: 'radio'; momentId: string; optionId: string };

type RaceState = { lap: number; cars: CarState[]; flag: 'green' | 'sc' | 'vsc' };
```

A run is fully defined by (race model, seed, list of decisions). That is what the Worker replays.

### 2.2 Seeded randomness

- Use a small, fast seeded PRNG (for example mulberry32), never `Math.random`.
- One stream per car, derived from the daily seed, so a user's decision for their car doesn't shift random draws for every other car.

### 2.3 The lap loop

For each lap, in order:

1. Apply scripted events for this lap (SC, VSC, rain, retirements).
2. For each car, compute its lap time: pace + compound offset + wear × age (+ cliff) − fuel × lap + dirty air + mode effects + noise.
3. Under SC or VSC, replace lap times with the fitted neutralized lap time; under SC, close gaps to the car ahead.
4. Apply pit stops: add pit loss (or the cheaper SC/VSC loss), switch compound, reset tire age.
5. Resolve overtakes (2.4), then re-sort positions by total time.
6. Advance tire age and the lap counter.

### 2.4 Overtakes

- When a faster car would finish the lap ahead of the car in front, roll a pass with probability from the fitted logistic model (pace delta, gap, track difficulty, battle modes).
- Failed pass: the attacker stays behind and takes the dirty-air penalty that lap.
- Defend mode lowers the attacker's pass chance and costs the defender time; attack does the reverse with added error risk.

### 2.5 Rival policy

The direct rival reacts to the user; everyone else follows their real strategy.

| Trigger | Rival response |
| --- | --- |
| User pits under SC/VSC and rival hasn't | Rival pits next opportunity if that keeps it ahead after stops |
| User pits under green within the undercut window | Rival covers the next lap if its tires are within a few laps of its real stop |
| User stays out on old tires | Rival keeps its real strategy |
| Rain starts | Rival switches when the sim's crossover lap says intermediates are faster |

Tune these rules on test races until a fan would find the rival's reactions believable.

### 2.6 Headset effects

- Keep all mode effects in a per-era config file, not in code: lap-time delta, wear multiplier, error-risk multiplier per mode.
- Start with modest effects; calibrate by playtesting, since timing data can't measure them.

### 2.7 Grader

- At each decision moment, simulate every option N times (start with 300) from the current state to the flag.
- Use **common random numbers**: option A run 17 and option B run 17 use the same seed. This makes option comparisons far less noisy at the same N.
- Metric per option: probability of the target result (beat the rival, or win). Grade = best option's probability minus the user's option's probability.
- Bands: green within 0.5 points of best; yellow close; orange costly; red a big miss. Tune band edges on playtests.
- Also grade the real team's call with the same method, for the comparison screen.
- **Continuation (decided Oct 25, 2026):** after an option's calls, the user's car follows a "sensible strategist" in every playout: the best of no more stops or one stop at any remaining lap and compound, by the model's predicted time (`planRemainingStop`). It is deterministic and the same for every option, so options are compared on the call alone, against the sim rather than hindsight. Limitation: it plans at most one more stop.
- **Band edges at launch:** green ≤ 0.5, yellow ≤ 5, orange ≤ 15 percentage points behind the best; red beyond.

### 2.8 Performance

- Budget per decision: about 4 options × 300 runs × 25 laps × 20 cars = 600,000 car-laps. Plain loops over typed arrays handle this well under 200 ms.
- Run the grader in a Web Worker in the browser so the race animation never stutters.
- Avoid object allocation inside the lap loop; reuse arrays.

### 2.9 Parity tests

- For each race in data/golden, run the TS sim with the same seed and decisions as the Python sim and compare finishing order and times.
- Floating-point and PRNG implementations must match exactly; if they can't, compare distributions over 500 runs instead and require close agreement.
- Parity runs in CI on every push.

## Phase 3: Game frontend

Build a mobile-first single-page game in Vite + React + Tailwind. Most players will arrive from a phone via a shared link, so design for a 390 px screen first.

### 3.1 Screens

| Screen | Contents |
| --- | --- |
| Daily card | Race title (or Mystery Race setup), your side, laps left, one-line situation, Start button, yesterday's result if played |
| Race | Timing tower, gap-to-rival trace, your car's tires and age, headset panel, BOX button, lap counter, speed control |
| Decision | Radio-style prompt, 3–4 options, short context (gap, tire age, pit loss), countdown optional |
| Results | Final result, grade per call, real team's calls and grades, percentile, rank, persona, share button |
| How it works | Rules, how grading works, data sources, disclaimer |

### 3.2 Game state machine

`loading → intro → racing ⇄ decision → finished → submitting → results`

- Model it with a reducer or XState; every transition is explicit and testable.
- `racing` ticks one lap every 3–5 seconds (1×) or faster (2×). Each tick calls the sim's `stepLap`.
- `decision` pauses the clock at each decision moment from the race JSON. The grader runs in a Web Worker while the user reads the options.
- The BOX button and headset modes write decisions to the run log on the current lap without pausing.
- Persist the in-progress run to localStorage (wrapped in try/catch) so a refresh resumes the race.

### 3.3 Components

- **TimingTower:** positions, driver codes, gap to leader or interval, tire compound and age; your car and the rival highlighted.
- **GapTrace:** small line of the gap to the rival over the last laps, so trends are visible at a glance.
- **HeadsetPanel:** segmented controls for pace, energy (2026 races), fuel and battle stance; current setting always visible.
- **BoxButton:** large, thumb-reachable; once pressed, choose compound; cancellable until the car reaches the pit entry point of the lap.
- **RadioMessage:** driver and engineer messages with original lines, never real team radio quotes.
- **GradeChip:** green, yellow, orange, red, with the probability difference on tap.

### 3.4 Data loading

- On load: `GET /api/daily` returns date, race ID, seed and the race model URL.
- Race model JSON is a static file on Cloudflare Pages with long cache headers; the sim package is bundled with the app.
- The anonymous player ID is a UUID created on first visit and stored in localStorage.

### 3.5 Visual design

- Pit-wall feel: dark theme default, monospaced timing numbers, team-neutral colors (no real liveries or logos).
- Tire compounds use the standard soft/medium/hard color convention with a letter, so color isn't the only signal.
- Track map comes later (Phase 6 polish), drawn as an SVG outline from FastF1 position data.

### 3.6 Sequence

| Step | Work |
| --- | --- |
| 1 | App shell, state machine, race screen with timing tower and BOX button, sim stepping lap by lap, decision modal |
| 2 | Headset panel, grader in Web Worker, results screen, resume after refresh, mobile layout pass |

## Phase 4: Backend and leaderboard

A Cloudflare Worker (using the Hono router) with a D1 database serves the daily, verifies every score by replaying the run, and computes ranks. Gate G3 closes this phase.

### 4.1 Endpoints

| Method and path | Purpose | Response |
| --- | --- | --- |
| GET /api/daily | Today's race (Pacific time day boundary, or UTC: decide once) | date, raceId, seed, modelUrl, side |
| POST /api/runs | Submit a finished run: date, anonId, decisions | Server-computed result, grades, score, percentile, rank |
| GET /api/daily/:date/stats | Aggregate stats after playing | Score distribution, share who matched the real team, most common calls |
| GET /api/daily/:date/leaderboard | Top scores | Top 100 with anonymous display names |

### 4.2 D1 schema

```sql
CREATE TABLE daily (
  date TEXT PRIMARY KEY,          -- 2026-12-01
  race_id TEXT NOT NULL,
  seed INTEGER NOT NULL,
  side TEXT NOT NULL,             -- team the user runs
  published_at TEXT NOT NULL
);

CREATE TABLE runs (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL REFERENCES daily(date),
  anon_id TEXT NOT NULL,
  decisions TEXT NOT NULL,        -- JSON array
  score REAL NOT NULL,            -- server computed
  result TEXT NOT NULL,           -- JSON: finish, grades
  created_at TEXT NOT NULL,
  UNIQUE (date, anon_id)
);

CREATE INDEX runs_date_score ON runs (date, score);
```

### 4.3 Score verification

1. Receive decisions only, never a score from the client.
2. Load the race model and the day's seed; replay the run with the shared TS sim.
3. Run the grader for each decision; compute the score server-side.
4. Store and return the result. The client shows the server's numbers.

Worker CPU limits apply: if grading every decision on submit is too slow, lower the run count on the server, or grade asynchronously and return the finish first. Measure this before choosing.

### 4.4 Percentile and rank

- Percentile = share of today's runs with a lower score. A single indexed COUNT query is enough at launch scale.
- Cache stats per date for a minute or so to avoid recomputing on every request.

### 4.5 Abuse protection

- One run per anonId per day (the UNIQUE constraint).
- Cloudflare rate limiting on POST /api/runs per IP.
- Validate decisions against the race: laps in range, legal compounds, no decisions after the flag.
- Add Cloudflare Turnstile only if bot submissions appear.

### 4.6 Operations

- D1 migrations live in apps/worker/migrations and run via Wrangler in CI.
- Logs through Workers observability; errors to Sentry.
- A scheduled Worker (cron) checks that the next daily exists and alerts if the queue runs low.

## Phase 5: Content pipeline (alongside Phases 3–4)

A daily game lives or dies on its queue. Launch needs at least 21 validated races scheduled, and the queue must grow faster than it's used afterward.

### 5.1 Race selection

- Keep a backlog sheet: race, era, tier (iconic, good battle, midfield), the hard side, the core dilemma in one line, status.
- Save iconic races for high-attention dates like Grand Prix dates and anniversaries; good battles and midfield fights fill the rest.
- First batch candidates from 2018 onward: Abu Dhabi 2021, Hungary 2019, Silverstone 2021, Monza 2021, Brazil 2024, plus podium and midfield battles to reach 21.

### 5.2 Per-race checklist

- [ ] `pipeline build <race>` runs clean; cleaning log reviewed.
- [ ] Validation passes (contenders' gaps within a few seconds, order correct in most runs).
- [ ] Takeover lap set a few laps before the first real decision.
- [ ] 2–4 decision moments chosen, each a genuine dilemma where the grader's best option isn't obvious.
- [ ] User side set to the hard or controversial side.
- [ ] Rival identified and its reactive policy checked on a playthrough.
- [ ] Radio lines written for each decision moment (original wording).
- [ ] Title or Mystery Race setup line written; spoiler-free share text checked.
- [ ] Played through three times with different choices; results feel believable.
- [ ] Scheduled to a date in the daily table.

### 5.3 Decision-moment quality bar

- A moment fails if every option grades within 0.5 points of the best (no real choice) or one option is best by a huge margin and obvious (no tension).
- The grader output for each option at publish time is the evidence; keep it in the race folder for review.

### 5.4 Scheduling

- A `schedule` CLI command writes upcoming dates and seeds to D1 via Wrangler.
- Seeds are random per date and stored, never derived from the date, so players can't predict them.
- Target throughput: race prep should become fast enough that the queue grows faster than it's used.

## Phase 6: Polish, beta and launch

Polish and a closed beta come first, then launch. Gate G4 sits between them.

### 6.1 Share card

- **Launch version: text.** One line for the result, a row of colored squares for call grades, the percentile, and the link. Text pastes cleanly into X, Reddit and group chats.
- Example: "Pit Wall #12 🏆 🟩🟩🟨🟩 P97", with no race name for Mystery Races.
- **Later: image card.** Generate an Open Graph image in the Worker (Satori + resvg) so shared links preview well.

### 6.2 Persona

- Describe each real team's strategy style per era as a vector (aggression, stop timing, reaction to SC, risk).
- Compute the same vector from the user's calls; show the closest match.
- Write persona lines with care: playful, not insulting to any team.

### 6.3 Polish

- Track map: SVG outline from FastF1 position data, cars as dots moving each lap.
- Sound off by default; haptic tap on mobile for decision moments if supported.
- Loading and empty states; error screen with retry.
- Accessibility: keyboard play, labels on all controls, color never the only signal.

### 6.4 Analytics and monitoring

| Event | Why |
| --- | --- |
| daily\_viewed | Top of funnel |
| race\_started | Interest |
| decision\_made (moment, option, grade) | Which moments work |
| race\_finished | Completion rate |
| share\_clicked | Virality |
| player\_returned | Retention |

Targets after launch: most starters finish, a meaningful share of finishers share, and return rate is tracked. Sentry for front-end and Worker errors.

### 6.5 Legal and trust

- Name and domain without "F1" or "Formula 1"; no team logos, liveries or F1 wordmark.
- "Not affiliated with Formula 1" disclaimer in the footer and How it works page.
- Privacy page: anonymous ID, analytics, no accounts.
- Data sources credited (FastF1, Jolpica-F1).
- No ads at launch, until data terms are checked.

### 6.6 Closed beta

- 15–25 testers: F1 fans from friends, a UW club, or an F1 Discord.
- Ask three things: did any sim result feel unrealistic, was any decision confusing, would you play tomorrow.
- Fix every "unrealistic" report before launch; realism complaints kill trust fastest.

### 6.7 Launch

- Launch around a Grand Prix, when F1 attention is high.
- Post on r/formula1 (read its self-promotion rules first), F1 Twitter/X, and F1 Discords, leading with an iconic race.
- Reply to every early comment; fix reported bugs quickly.
- Keep at least 21 races queued and keep adding races faster than they're used.

## Phase 7: After launch

Add modes and eras in order of effort versus fan interest: Survivor and 2026 energy races first, the Senna era last.

### 7.1 Survivor

- Pool every validated decision moment across all races.
- Serve them back to back from a random seed; the run ends on the first orange or red call.
- Reuses the sim and grader as is; new work is a lighter UI and a Survivor leaderboard table.

### 7.2 2026 energy races

- Add an energy model behind an era flag: battery state of charge per car, harvest per lap, deploy cost per lap by mode, and a top-speed penalty when the battery is empty.
- Battery charge isn't in the public feed; estimate harvest and deploy parameters from speed traces (a car losing top speed on a straight is out of energy) and tune by playtesting.
- Add the Energy row to the headset panel (deploy, balanced, harvest) for 2026 races only.
- Choose races by rewatching where energy decided the result.

### 7.3 2011–2017 races

- Jolpica-F1 provides lap times and pit stops; tire compounds, safety car laps and weather are hand-entered from race reports in the authoring tool.
- Same tire model as the modern era.

### 7.4 Schumacher era, 1996–2009

- Lap times from Jolpica-F1; infer pit laps from slow in- and out-laps.
- New fuel model: fuel mass per car, lap-time cost per kg, refuel time added to the stop. Calls become fuel load at each stop and number of stops.
- Fuel loads were not published; estimate them from stint lengths and pace.

### 7.5 Senna era (late 1980s–1995)

- Build the reconstruction pipeline: structured results, Wikipedia, LLM extraction of race reports, a constraint solver for lap times, and the authoring tool for review.
- Curate 20–30 iconic races only; mark them "Reconstructed" in the UI.
- Headset becomes a pit board for these races.

### 7.6 Accounts and Historical Season

- Add auth (Supabase Auth or Clerk); migrate anonymous history to the new account.
- Season mode: replay a real season as one team, results and points carry over between races.
- Needs a season table in D1 and a season-progress screen; reuses everything else.

## Testing and quality gates

The simulator's realism is tested continuously, not once: every race must pass validation, and every code change must keep Python and TypeScript in agreement.

| Layer | Tests | Runs |
| --- | --- | --- |
| Pipeline | Unit tests for cleaning rules and pit-loss math on saved fixtures; schema validation on export | Every push |
| Model | Validation report per race: gap error and finishing-order accuracy over 500 runs | Every race build; blocks scheduling on failure |
| Simulator | Unit tests for lap loop, pit stops, SC bunching, overtakes; determinism test (same seed and decisions give identical output) | Every push |
| Parity | TS vs Python on every golden race | Every push |
| Grader | Known-answer cases (for example, a free SC stop must grade best); runtime budget under 200 ms | Every push |
| Worker | Endpoint tests with a local D1; replay matches client result | Every push |
| Frontend | State machine transition tests; one end-to-end playthrough with Playwright | Every push |
| Realism | Playtest each race three times; beta tester reports | Per race; during beta |

## Roadmap

&#91;embedded content: roadmap · 8 phases in order, 5 gates\]

Content work runs alongside the frontend and backend, so the queue reaches 21 races by launch. G1 and G2 are hard stops: if the model or parity fails, the schedule slips rather than shipping an unrealistic simulator.

## Open decisions

- [ ] **Name and domain.** Must not use "F1" or "Formula 1"; decide before the launch build.
- [ ] **Day boundary.** Pacific time, UTC, or the player's local midnight for the daily rollover.
- [ ] **Server grading cost.** Full grading on submit vs fewer server runs vs async grading; measure during Phase 4.
- [ ] **Data terms.** Read FOM and Jolpica-F1 terms before any monetization.
- [ ] **Monetization.** Ads, a Pro tier (archive, unlimited Survivor), or neither at first.
- [ ] **Hard side when both sides faced hard calls.** A rule for the race backlog.

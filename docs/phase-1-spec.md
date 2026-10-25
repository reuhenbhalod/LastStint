# Phase 1 Spec: Data Pipeline and Race Model

Status: draft · Owner: @Reuhen · Depends on: Phase 0 (complete)

## Purpose

Turn raw FastF1 timing into a compact, validated **race-model JSON** that the simulator can
answer "what if" questions against, and prove it reproduces real races. Phase 1 is the
project's make-or-break: nothing downstream (TS sim, game, leaderboard) is worth building
until the model passes **Gate G1**.

This spec expands the implementation plan's Phase 1 (§1.1–1.8) into ordered steps with tasks
and acceptance criteria. It targets the existing scaffold in `pipeline/src/pipeline/`.

## Scope

**In scope**
- Python pipeline: ingest → clean → fit → track params → events/scenario → export.
- A Python **reference simulator** and a **validation harness**.
- Two fully validated races: `abu-dhabi-2021` and `hungary-2019`.
- A repeatable CLI (`pipeline build <race>`), then 10 more races built through it.

**Out of scope (later phases)**
- The TypeScript simulator and parity tests (Phase 2).
- Any game UI, grading, headset effects, leaderboard (Phases 3–4).
- Pre-2018 eras, 2026 energy model, reconstruction pipeline (Phase 7).

## Target races

| Race id | Why |
| --- | --- |
| `abu-dhabi-2021` | 58 laps, late safety car, undercut/stay-out dilemma — the flagship. |
| `hungary-2019` | Strategy-decided win (two-stop overcut). A second, structurally different race guards against overfitting to one track. |

Both must pass G1 before the pipeline is generalized.

---

## 1.0 FastF1 access spike (prerequisite)

**Goal:** confirm FastF1 can pull the target races on this machine before building anything.

**Tasks**
- In `pipeline/notebooks/`, enable the cache and load `get_session(2021, 'Abu Dhabi', 'R')`;
  call `session.load()` and inspect `session.laps`.
- Confirm the columns in `ingest.LAP_COLUMNS` are present and populated.
- Repeat for `get_session(2019, 'Hungary', 'R')`.

**Acceptance**
- [ ] Both sessions load; `laps` has one row per driver per lap.
- [ ] Abu Dhabi 2021 shows 58 laps; Hungary 2019 shows 70.
- [ ] A second load reads from cache (no network).
- [ ] Decision recorded: is a VPN/region issue or rate limit a risk? If so, note the mitigation.

---

## 1.1 Ingest → `ingest.py`

**Goal:** load a race once, keep only the columns we need, snapshot to parquet so later steps
never re-download.

**Inputs:** `(year, event)` → **Outputs:** a cleaned-column laps DataFrame + `data/raw/<race-id>.parquet`.

**Tasks**
- Implement `enable_cache()` (done in scaffold) and `load_race(year, event)` returning the session.
- Extract `session.laps` projected to `LAP_COLUMNS`; coerce lap/pit times to seconds (float).
- Add a `race_id` convention helper (`abu-dhabi-2021`) and write the parquet snapshot.
- Capture race-level facts needed downstream: total laps, circuit name, session date.

**Acceptance**
- [ ] `ingest` produces a DataFrame with every driver and lap, no all-null required columns.
- [ ] Parquet snapshot round-trips (read back equals what was written).
- [ ] Unit test runs against a **small saved fixture** (a few drivers × a few laps), not the network.

---

## 1.2 Clean → `clean.py`

**Goal:** keep only laps that reflect true pace; set traffic laps aside for the dirty-air fit.

**Tasks** (drop rules, each logged with a count)
- Drop laps where `IsAccurate` is false.
- Drop laps not fully under green (`TrackStatus` != green).
- Drop pit in-laps, out-laps, and lap 1.
- Compute each lap's **gap to the car ahead** from per-lap cumulative race time + `Position`;
  split laps within `TRAFFIC_GAP_SECONDS` (1.0s) into a separate `traffic_laps` frame.
- Drop outliers slower than `OUTLIER_FACTOR` (1.07×) of that driver's median clean lap.
- Return `(clean_laps, traffic_laps, removal_log)`.

**Acceptance**
- [ ] `removal_log` reports how many laps each rule removed, per driver.
- [ ] No single rule removes the majority of a contender's laps (if it does, flag a bad threshold).
- [ ] Contenders retain enough green clean laps to fit pace (rule of thumb: ≥ ~15).
- [ ] Unit tests on a fixture assert each rule fires on a crafted example.

---

## 1.3 Fit the lap-time model → `fit.py`

**Goal:** fit `t = pace_driver + offset_compound + wear_compound·age + fuel·lap + ε`.

**Tasks**
- OLS in statsmodels: driver dummies, compound offset, compound×tyre-age wear, one fuel term
  (coefficient on lap number).
- Fit **across stints** so fuel (monotonic in lap) separates from wear (resets at each stop).
- **Cliff:** plot residuals vs tyre age per compound; if late-stint residuals rise sharply, fit a
  second, steeper wear rate past a fitted `cliffLap` (`detect_cliff`).
- **Noise:** store each driver's residual standard deviation.
- **Thin data:** if a compound has too few laps, borrow its offset/wear from other years at the
  same track; log that it was borrowed.

**Acceptance (sanity checks, enforced as tests)**
- [ ] Wear rates positive and ordered: soft > medium > hard.
- [ ] Fuel term negative (cars get faster as fuel burns).
- [ ] Fitted driver-pace order roughly matches the race's actual pace order.
- [ ] Residuals look unbiased vs tyre age after the cliff term is added.

---

## 1.4 Track parameters → `track.py`

**Goal:** fit the track-level constants the sim needs.

| Parameter | Method | Acceptance |
| --- | --- | --- |
| `pitLoss` | in-lap + out-lap − 2 clean laps; median over stops | plausible for the circuit (Yas Marina ≈ 20–22s) |
| `pitLossUnderSC` | same, using stops under neutralization | lower than green-flag pit loss |
| `dirtyAirPenalty` | mean lap delta of traffic vs clean laps, same driver/stint | positive, small (tenths to ~1s) |
| `overtakeDifficulty` | logistic regression of pass prob on pace delta + gap; pool seasons at the track | coefficients have expected sign (bigger pace edge → higher pass prob) |
| SC/VSC lap times | median lap time under each | SC slower than VSC slower than green |

**Tasks**
- If pass/no-pass examples at a single track are too thin, pool several seasons; if still thin,
  fall back to a calibrated default and **log** that it was used.

---

## 1.5 Events and scenario → `events.py`, `scenario.py`

**Goal:** build the frozen event timeline and the takeover snapshot.

**Tasks — `events.py`**
- Parse `session.race_control_messages` + `TrackStatus` into events with laps:
  `SC`, `VSC`, `RED`, `RAIN`, `RETIREMENT` (match the schema `events[].type` enum).

**Tasks — `scenario.py`**
- `state_at_takeover(laps, takeoverLap)`: per-car position, gap ahead, compound, tyre age.
- Extract each driver's **real strategy** (`realStrategy`: lap → compound) from stint changes.
- `candidate_decision_moments`: SC/VSC starts, rival pit laps, undercut windows (gap < pit loss),
  tyre age near the cliff, rain. Final 2–4 are hand-picked in Phase 5 — here just surface candidates.

**Acceptance**
- [ ] Extracted events match a hand-checked list for each target race (Abu Dhabi 2021 includes the
      late safety car).
- [ ] `stateAtTakeover` for the main contenders matches the timing screen at that lap.
- [ ] `realStrategy` reproduces each contender's actual stops.

---

## 1.6 Schema and export → `export.py`, `packages/schema`

**Goal:** assemble the race model, validate it, and write it.

**Tasks**
- Assemble a dict with all top-level keys the schema requires: `schemaVersion`, `race`, `era`,
  `track`, `compounds`, `drivers`, `fuelEffectPerLap`, `events`, `decisionMoments`, `realResult`,
  `userSide`.
- Set `era` = `2014-2025` for both target races; set `userSide` to the hard side (Mercedes/HAM for
  Abu Dhabi).
- Validate against `packages/schema/race-model.schema.json` before writing (`export.validate_model`).
- If the schema needs a new field, add it **and bump `schemaVersion`**.
- Write `data/races/<race-id>.json`.

**Acceptance**
- [ ] `write_race` output validates against the schema.
- [ ] The JSON matches the TS `RaceModel` type in `packages/sim/src/types.ts` (keep them in sync).
- [ ] A round-trip test loads the written file and re-validates it.

---

## 1.7 Reference simulator and validation → `sim_reference.py`, `validate.py`

**Goal:** a Python lap-loop simulator used to validate the model and to emit golden files for the
Phase 2 TypeScript port.

**Tasks — `sim_reference.py`**
- Implement the lap loop: for each lap, compute every car's lap time from the fitted model,
  apply events (SC/VSC neutralized lap times + bunching under SC), apply pit stops (pit loss,
  compound switch, tyre-age reset), resolve overtakes from pace delta + gap + `overtakeDifficulty`,
  re-sort by cumulative time.
- Seeded RNG so a run is reproducible; accept an optional list of decisions (real strategies here).
- `write_golden(model, seeds)`: dump finishing order + per-lap gaps for fixed seeds to `data/golden/`.

**Tasks — `validate.py`**
- `validate_race(model, runs=500)`: run the sim with every team's **real** strategy; report mean
  absolute error in each driver's gap to the leader and the share of runs whose finishing order
  matches reality. Return a `ValidationReport` with a `passed` flag.

**Acceptance (this is Gate G1 — see below)**
- [ ] Main contenders' final gaps within a few seconds of reality (mean abs error small).
- [ ] Finishing order correct in the large majority of runs.
- [ ] Golden files written for fixed seeds and committed under `data/golden/`.

---

## 1.8 CLI, generalization, and breadth → `cli.py`

**Goal:** move notebook code into the package, expose it as a CLI, and prove it generalizes.

**Tasks**
- Wire `pipeline build <race-id>` to run 1.1 → 1.6 and `pipeline validate <race-id>` to run 1.7.
- Keep a tiny race registry mapping `race-id` → `(year, event, takeoverLap, userSide)`.
- Run Hungary 2019 end to end; confirm G1 passes on it too.
- Build **10 more** 2018-onward races through the CLI (not necessarily G1-tuned yet) to shake out
  track/compound edge cases.

**Acceptance**
- [ ] `uv run pipeline build abu-dhabi-2021` produces a validated `data/races/abu-dhabi-2021.json`.
- [ ] `uv run pipeline validate abu-dhabi-2021` prints the report and exits non-zero on failure.
- [ ] 10 additional races build without crashing; any that fail validation are logged, not silently shipped.

---

## Gate G1 (exit criteria for Phase 1)

> The Python reference simulator, fed every team's real strategy, reproduces **both**
> `abu-dhabi-2021` and `hungary-2019` finishing order and the main contenders' gaps within a few
> seconds per driver, over 500 seeded runs.

If G1 fails, the schedule slips — do **not** start Phase 2. Tighten the model (prioritize tyre
wear, traffic, overtaking) rather than loosening the bar.

## Build order and dependencies

```
1.0 spike
  └─ 1.1 ingest ─ 1.2 clean ─┬─ 1.3 fit ──────────┐
                             └─ 1.4 track params ──┤
                                1.5 events/scenario┤
                                                   └─ 1.6 export ─ 1.7 sim+validate ─ 1.8 CLI/breadth
```

1.3 and 1.4 can proceed in parallel once 1.2 is done; both feed 1.6.

## Testing

- Unit tests (`pipeline/tests/`) for cleaning rules, pit-loss math, and schema validation run on
  **saved fixtures**, never the network — CI must stay offline.
- The per-race validation report is the model-level test; it blocks scheduling on failure.
- Determinism: same model + seed + decisions → identical sim output.

## Risks

| Risk | Mitigation |
| --- | --- |
| Model can't hit G1 gaps | Spend effort on tyre wear + cliff and dirty air first; they dominate realism. |
| Overtake data too thin at one track | Pool seasons; fall back to a logged calibrated default. |
| Fuel/wear not separable on a short race | Fit across all stints; sanity-check the fuel sign. |
| Schema drift between Python and TS | Single schema file is the contract; bump `schemaVersion` on any change and sync `types.ts`. |
| FastF1 fetch/region issues | Caught in 1.0 spike before real work. |

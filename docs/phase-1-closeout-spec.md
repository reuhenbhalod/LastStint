# Phase 1 Close-out Spec: Race Pool and Model Fixes

Status: superseded after Stage B by `phase-1-2-perfection-spec.md` (Oct 26, 2026) · Owner: @Abhiram · Depends on: Phase 1 S1–S6 (merged), Phase 2 S7–S9 (S9 in PR #2)

## Purpose

Finish what Phase 1 still owes before the game is built on top of it:

1. **Gate G1 on more than one race.** Abu Dhabi 2021 passes; Spain 2021 fails on two drivers (BOT 5.5s vs 5.0s, PER 14.3s vs 6.4s).
2. **The breadth step (Implementation Plan 1.8):** build 10 more races through the CLI and log any that fail.
3. **Model fixes found while building the grader.** Tyres are extrapolated past the data, and every driver currently has identical tyre wear.

All design decisions are settled in the **Decisions** section before any code is written. **Decided Oct 25, 2026: the recommended option for every decision (D0a, D1a, D2a, D3a, D4a, D5a, D6a, D7b, D8a).** After that, the stages run in order, with a commit and push at the end of each one.

## What we know going in (research done for this spec)

**Data access**

- FastF1 3.9 serves **2021–2022 without login**. Every other year (2019 Hungary, 2023, 2024 were tried) needs an F1 account: `Failed to authenticate… Set F1_USERNAME and F1_PASSWORD`.
- FastF1 enforces a **rate limit**. A full-season scan stopped after 32 races with `RateLimitExceededError`, so ingest has to be resumable and spaced out.

**Spain 2021 diagnosis.** It is not traffic; the sim actually gives these cars *less* traffic than reality.

| Driver | Real laps within 1s of the car ahead (after takeover) | Sim laps held behind |
|---|---|---|
| PER | 14 | 2.1 |
| SAI | 17 | 2.8 |
| BOT | 1 | 1.0 |

The errors build up at specific points:

- **BOT** loses about 0.3 s/lap in clean air on mediums (laps 25–40).
- **PER** matches reality until lap ~50, then loses about 0.7 s/lap extra on old mediums. After his lap-58 stop he rejoins behind RIC instead of ahead.

Both point to tyre wear that is **the same for every driver**: the model has no "PER is gentle on tyres".

**Tyre extrapolation**

- Where no cliff is fitted, `cliffLap` is set to the race length, which means "never falls off" (Spain soft, Abu Dhabi medium).
- The grader's planner can then run a tyre past the longest stint in the data. Spain soft maxes out at 32 laps in the data; "stay out" took one to 36.
- Measured impact today is small (Spain "stay out" 85% → 80% with the fix), but it will matter more as the planner explores more options.

**2021–2022 race scan** (32 of 44 scanned; the rest of 2022 is pending the rate limit). Excluded automatically:

- **Wet:** Imola 21, Hungary 21, Russia 21, Turkey 21, Imola 22, Monaco 22. There is no rain model yet.
- **Red flag:** Baku 21, Silverstone 21, Spa 21, Saudi 21, Silverstone 22. Restarts and free tyre changes aren't modelled.

## Decisions

Each decision lists options and a **recommendation**. Answers are recorded here before Stage A starts.

### D0. Branching

The Phase 2 grader (PR #2) also changes `sim.ts`, which this phase touches again.

- **a. Merge PR #2 first, then branch off `main`.** ← recommended (no stacked PRs, no conflicts)
- b. Stack this branch on `grader` and merge both later.

### D1. Data scope

- **a. Stay on 2021–2022 for Phase 1.** ← recommended. It's enough for 12 races, and there is no account or terms question yet.
- b. Set up F1 account credentials now to unlock 2018–2020 and 2023+. This raises the product doc's data-terms risk earlier than planned.

### D2. The 10 new races (plus user side and rival)

Criteria: dry, no red flag, a strategy call decided the result or a close fight, a mix of tracks and years, and the 2021 title fight weighted for iconic value.

The user side is the hard or controversial call (product doc rule). The dilemma column is the call we expect; Stage A confirms it in the data before the race is accepted.

| # | Race id | Duel (user vs rival) | Expected dilemma |
|---|---|---|---|
| 1 | bahrain-2021 | VER vs HAM | Chase on fresher tyres vs Mercedes' undercut (0.7s finish) |
| 2 | france-2021 | HAM vs VER | Cover Red Bull's second stop or stay on one stop (2.9s) |
| 3 | united-states-2021 | HAM vs VER | Undercut war; Mercedes went long (1.3s) |
| 4 | brazil-2021 | VER vs HAM | SC/VSC stop timing while defending (10.5s) |
| 5 | mexico-2021 | PER vs HAM | Fight for P2 on different strategies (target P2) |
| 6 | saudi-arabia-2022 | LEC vs VER | Late VSC with no stop, DRS duel (0.5s) |
| 7 | miami-2022 | LEC vs VER | Late SC with fresh tyres (3.8s) |
| 8 | canada-2022 | SAI vs VER | VSC/SC stop timing, 1.0s finish |
| 9 | bahrain-2022 | LEC vs VER | Late SC; VER's retirement is a frozen event |
| 10 | hungary-2022 | LEC vs VER | Ferrari's hard-tyre call (pending the rate-limited scan) |

Alternates: dutch-2021, spain-2022, qatar-2021, italy-2021.

- **a. This list.** ← recommended
- b. Edit the list (swap races or sides).

### D3. Takeover lap per race

- **a. Rule with hand override.** ← recommended. Takeover = 3 laps before the first strategic event involving the user or rival after lap 10 (their first stop, or an SC/VSC), stored in the registry and editable.
- b. Hand-pick every race.

### D4. Driver-specific tyre wear (the Spain fix)

- **a. Per-driver wear factor, shrunk toward 1.** ← recommended. Each driver's wear rate is the compound rate × their factor, fitted jointly and pulled toward 1 as if each driver had N laps of average wear. It explains PER-type drivers, gives the game "tyre whisperers", and is one number per driver. Schema v6 adds `drivers[].wearFactor`, implemented in both the Python and TS sims.
- b. Per-driver × compound pace offsets. This explains BOT-on-mediums but adds many parameters on thin data.
- c. Both a and b.
- d. Neither: accept Spain as a documented limitation.

Guard for any option: it ships only if it **improves aggregate validation across all 12 races and loses no G1 pass** (see D7). Otherwise it's reverted and logged.

**Revised Oct 25, 2026 (after prototyping a and b on the two existing races):** don't commit to a variant up front. Prototype **a** and **b** on all 12 races in Stage C, and ship whichever passes the guard (or neither).

Evidence so far, gap errors in seconds (limits: BOT 5.0, PER 6.4, the VER duel 3.0):

| | Baseline | a: wear factor | b: driver × compound |
|---|---|---|---|
| BOT | 5.7 ❌ | 5.3–5.5 ❌ | **4.7 ✅** |
| PER | 14.6 ❌ | **2.8–8.1** | 13.1 ❌ |
| VER (duel) | 0.9 ✅ | **5.7–7.7 ❌** | 2.4 ✅ |

Abu Dhabi passes in every variant. Option a's per-driver factors don't replicate between races (e.g. PER 1.12 at Abu Dhabi vs 0.85 at Spain), which points to noise. Expect Spain's PER miss to remain as a documented limitation; it looks specific to that race (old-medium stint after lap 50, rejoin position after the lap-58 stop).

### D5. Edge-of-evidence cliff

- **a. Adopt.** ← recommended. Where no cliff is fitted, set `cliffLap` to the longest stint observed on that compound; past it the sim's existing fallback (2× wear) applies. Real-strategy replays are unchanged (0/200 differ on both races).
- b. Keep "no fitted cliff = never falls off".

### D6. Lapped cars

Known limitation: pit laps and the takeover snapshot use each car's own lap count.

- **a. Fix the numbering now; still don't model laps-down in the sim.** ← recommended. Pit laps and the takeover state move to race laps, like events did in S1. Races with an SC and lapped traffic depend on it.
- b. Defer.

### D7. What "Phase 1 done" means

- a. All 12 races pass G1.
- **b. Abu Dhabi and Spain pass, and at least 8 of the 10 new races pass.** ← recommended. Failures are logged with a diagnosis and kept out of the daily pool until fixed.
- c. A majority of the 12 pass.

The G1 bar itself does not change (S4: duel 3s / 60%, podium 5s / 50%, field max(5s, 10%)).

**Fallback (added Oct 25, 2026).** If fewer than 8 of the 10 new races pass:

- A failing race may be swapped for an alternate **only** when its failure is traced to something the sim can't model by design: a race-control ruling, lapped-car handling, or an unmodelled incident. Never just because it's hard to fit.
- Spain 2021's PER miss counts as an open, documented limitation. It doesn't block Phase 1 if every other check passes.

### D8. Exclusions

- **a. Exclude wet and red-flag races from the pool until there is a rain model and a restart model.** ← recommended
- b. Attempt red-flag races by treating the red flag as a long neutralization with a free tyre change.

### Principle (not a decision): no tuning to one race

Every model change is judged on **all races at once**: aggregate gap error, count of G1 passes, and the parity suite. A change that fixes Spain but costs another race isn't shipped.

## Stages

### A. Rate-limit-safe ingest and the race registry

Tasks:

- `pipeline ingest` retries with backoff on `RateLimitExceededError`, skips races already snapshotted, and supports `--all`.
- Add the D2 races to the registry with year/event, user side, rival, `score_positions` and takeover lap (per D3).
- Ingest and commit the snapshots.
- For each race, confirm from the data that the expected dilemma exists: the user's or rival's stop timing relative to SC/VSC or the rival's stop. A race whose dilemma doesn't show up is swapped for an alternate.

Acceptance:

- [ ] All 12 snapshots committed, and a re-run of `ingest --all` downloads nothing.
- [ ] Every registry entry has a one-line dilemma confirmed against the data.

### B. Model fixes (D4, D5, D6)

Tasks:

- Lapped-car race-lap numbering (D6), with tests like S1's.
- Edge-of-evidence cliff (D5) in `assemble.py`, with a test.
- Driver wear factor (D4): fit, schema v6, Python sim + TS sim, regenerate golden files, keep parity at 40/40 (plus the new races).
- Each fix is measured on all 12 races before and after (principle above).

Acceptance:

- [ ] Python and TS tests pass; TS↔Python parity passes on every golden race.
- [ ] Each fix's before/after table is in its commit message.

### C. Validation report

Tasks:

- `pipeline validate --all --report docs/g1-report.md` writes a table: race, each G1 check, pass/fail, and a short diagnosis line for failures.
- Iterate only on the causes the report points to, keeping to the principle.

Acceptance:

- [ ] D7's bar is met, or the remaining failures are each diagnosed in the report.

### D. Close-out

Tasks:

- Update README status and the implementation plan's Phase 1 checkboxes.
- Open a PR; CI green.

Acceptance:

- [ ] PR open with the G1 report linked.

## Out of scope

Rain model, red-flag restarts, team orders, 2026 energy, the game UI (Phase 3), the backend (Phase 4).

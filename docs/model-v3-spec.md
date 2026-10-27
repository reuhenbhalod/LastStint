# Model v3 Spec: Finishing Phase 1

Status: in progress · Owner: @Abhiram

**Decided Oct 26, 2026: the recommended option for every decision** (A1a, B1a, B2a, B3a).

## Purpose

Phase 1 closed on Oct 26 with documented limits: Gate G1 passes on 1 of 16 held-out races, against the spec target of 75%. This spec answers whether that target can be met, fixes what the answer shows, and sets the bar that closes Phase 1 for real.

## Stage 0 result: the ceiling test

`pipeline/experiments/ceiling.py` hands the sim each driver's **real** pace after the takeover lap. This is cheating on purpose: it shows the best any lap-pace model could do. Each column is pass count / mean gap error.

| Pace given to the sim | Tuning (16) | Held-out (16) |
|---|---|---|
| Current model | 5 pass (+1 borderline), 3.49s | 1 pass, 5.61s |
| One offset per driver (`driver`) | 7 (+1), 2.40s | 4, 3.92s |
| One offset per driver per stint (`stint`) | 5, 2.61s | 4, 3.97s |
| Real lap-by-lap pace (`lap`) | 6, 2.34s | 5 (+1), 3.77s |
| Real lap-by-lap pace, sim traffic and noise off (`replay`) | 9, 2.00s | 6, 3.35s |

**Conclusions:**

1. **No lap-pace model can reach 75% of held-out races.** Even replaying the real lap times passes 6 of 16 (38%). The rest of the error is race mechanics (pit stops, safety cars, passing, takeover state) and the reference data itself.
2. **Most of the pace gain comes from one number per driver** (`driver`): held-out passes go from 1 to 4 and error from 5.6s to 3.9s. Finer pace (per stint, per lap) adds almost nothing.
   - This matters for the game. A per-driver pace doesn't depend on the strategy, so "what if" calls stay honest.
   - A per-stint pace would encode how the driver ran *that* strategy (for example, nursing tyres for a long stint), and would be wrong for any other strategy.
3. **Replay failures exposed real bugs.**
   - **Bahrain 2018 reference data.** The top three's final laps are stored about 53 s late, so every other finisher's real gap was about 53 s too small. GAS was scored against +8.4 s; my memory of the official result is about +62 s (not checked against a source). *Fixed:* a final lap with no lap time and an implausible timestamp step is repaired from the driver's recent laps. Bahrain 2018 drops from 17.5 s to 6.2 s.
   - **Stops straddling the takeover were charged twice (15 of 32 races).** When a driver's in-lap is the takeover lap, the in-lap's share of the stop is already in the takeover gaps, and the sim then charged the full stop again. At Paul Ricard the timing line puts about 20 of the 25 s in the in-lap, so France 2019's VER lost about 20 s for nothing. *Fixed:* such a stop is charged only its out-lap share. France 2019 drops from 6.9 s to 3.8 s.

## Decisions

← marks the recommendation.

### A. What "Phase 1 done" means

**A1. The G1 target**

- **a. Measure the model against what the data allows.**
  - **Pass bar:** the model passes at least 80% of the held-out races that the `replay` ceiling passes.
  - **Every held-out failure** is diagnosed as one of three causes: a model gap, a mechanics limit, or a data issue.
  - The 75%-of-all-races target is retired, because Stage 0 shows no pace model can reach it.
  - ← recommended
- b. Keep 75% of held-out races. Unreachable on the evidence above.
- c. Loosen the G1 tolerances (for example, a 5 s → 8 s field gap). This hides error instead of measuring it.

### B. Work

**B1. Mechanics and data audit**

- **a. Run the `replay` ceiling on every race and treat each car more than 5 s off as a bug suspect.** ← recommended
  - Investigate each one the way the two bugs above were found.
  - Fix real bugs with tests. Document real limits (for example, laps the replay can't take from data, such as yellow-flag laps).
- b. Skip; only tune the model.

**B2. Model v3 pace**

- **a. Per-driver race pace from the laps after the takeover, shrunk toward the whole-race estimate when they are few.** ← recommended
  - Choose and tune on the tuning races only, then run the held-out check once.
  - One number per driver, so it stays strategy-independent (conclusion 2).
- b. Per-stint pace. It would pass more replays, but makes "what if" answers wrong. Rejected for that reason.
- c. No pace change.

**B3. Process**

- **a. Same guard as before.**
  - Tuning races choose every change; held-out races are checked once at the end.
  - The robust two-seed-set status applies.
  - The game's sim stays in exact TS↔Python parity, and CI stays green.
  - ← recommended

## Stages

| Stage | Work | Done when |
|---|---|---|
| 0. Ceiling | `experiments/ceiling.py`; the two bug fixes | **Done** |
| 1. Audit | Replay audit on all 32 races; fix or document every suspect | **Done** (see Results) |
| 2. Model v3 | Post-takeover driver pace (B2a), tuned on the tuning races | **Done**: tuning 5 → 7 pass |
| 3. Held-out check and report | `pipeline validate --all --robust --report`, with the ceiling alongside | **Done**: A1 target not met (see Results) |
| 4. Close | Rebuild races and golden files, update `g1-report.md`, the README and this spec | CI green, merged |

## Results (Oct 26, 2026)

### Stage 1: audit

`experiments/audit.py` replays every race with real pace and flags cars more than 5 s off.

- **Fixed: Miami 2025 is a data issue, now excluded from the count.**
  - FastF1's tyre timing is corrupt for the whole field: all first stints start at lap 25 and all second stints at lap 33, while the pit flags are at laps 26–30. A fresh download has the same problem.
  - It is listed in the report as "data issue", not counted in G1, and ineligible as content.
- **Mechanics limit: lapped cars that unlap behind a safety car.**
  - Affected: Abu Dhabi 21, Bahrain 22, Miami 22, Saudi 22 ZHO, Singapore 23.
  - The sim bunches them into the leaders' queue, so they finish 20–60 s too close. In reality they unlap, then drive round to the back.
  - Almost all are outside the top 6 that G1 scores.
- **Mechanics limit: lost time the replay can't take from data.**
  - Affected: USA 2018/2021, Mexico 2018, Spain 2020 and others; single cars 5–12 s off.
  - Yellow-flag and pit laps use the model's pace even in the replay.

### Stage 2: model v3 (tuning races only)

| Shrink (laps) | Pass / borderline / fail | Mean gap error |
|---|---|---|
| None (the current model) | 5 / 1 / 10 | 3.47s |
| 0 | 7 / 1 / 8 | 2.39s |
| **5 (chosen)** | **7 / 1 / 8** | **2.34s** |
| 15 | 6 / 0 / 10 | 2.36s |
| 5, median instead of mean | 4 / 0 / 12 | 3.36s |

- **Gains:** Abu Dhabi 2018 and Bahrain 2021 now pass (fail before). Mexico 2021 moves from borderline to pass, and Mexico 2019 from fail to borderline.
- **Loss: Hungary 2019** (pass → fail). The VER–HAM duel gap misses by 0.4 s (3.4 against 3.0). HAM's fast fresh-tyre chase after his extra stop is part of his post-takeover average.

### Stage 3: held-out check (run once)

| | Before tonight | Model v3 | `replay` ceiling |
|---|---|---|---|
| Held-out (15 counted) | 1 pass, 5.61s | **4 pass, 2.56s** | 7 pass, 2.19s |
| Tuning (16) | 5 pass (+1), 3.47s | **7 pass (+1), 2.34s** | 11 pass, 2.00s |

- **A1 target: not met.**
  - The `replay` ceiling passes 7 held-out races: Austria 19, Singapore 19, France 19, 70th Anniversary 20, Portugal 20, Italy 24 and Hungary 24.
  - Model v3 passes 3 of those (France 19, Portugal 20, Italy 24), 43% against the 80% target.
  - It also passes Spain 20, which the ceiling fails.
- **Every held-out failure is diagnosed in `docs/g1-report.md`.**
- **What tonight changed:** the held-out mean gap error fell from 5.61 s to 2.56 s, within 0.4 s of the perfect-pace ceiling on average. What's left is mostly pass/fail on tight checks, such as order rates and 3-second duel gaps.
- **Note on the report's diagnoses.** Every failure now reads "race mechanics". This is partly by construction: v3's pace term is the post-takeover average that `diagnose.py` measures pace error against. The replay ceiling confirms it independently, because real pace alone doesn't make those races pass.

### Where this leaves Phase 1

- **The model is now about as good as lap pace can make it.** The remaining misses are race mechanics: passing and holding in traffic, SC bunching of lapped cars, the time lost on yellow-flag and pit laps.
- **Playable races** (G1 pass, data OK):
  - Abu Dhabi 21, Bahrain 21, Mexico 21, Miami 22, Canada 22, Bahrain 22, Abu Dhabi 18
  - France 19, Spain 20, Portugal 20, Italy 24
  - That is 11, up from 6, with Mexico 19 borderline.
- **Next options**, each a decision for the owner:
  - Mechanics work on lapped cars under SC and on passing.
  - Accept borderline races for content.
  - Close Phase 1 on this result.

## Stage 5: race mechanics (Oct 27, 2026; owner chose B: one more day on the model)

### Evidence

- **Remaining failures.** These are the races that fail even with perfect pace (`replay`), checked one by one with `experiments/audit.py` and the replay detail. They fall into four kinds:
  1. **Stop accounting.** Frozen green-stop losses are measured against the field's median lap, but the sim adds them to *its own* predicted in- and out-laps.
  2. **SC stops.** A stop under a safety car costs a flat 0.55 × a green stop. In Saudi 22, PER, RUS and OCO come out 7–10 s too fast after their SC stops.
  3. **Near-ties.** When two cars really finished within about a second, the order-rate checks ask the sim to predict a coin flip.
     - Bahrain 21 with M1: VER is 0.7 s behind HAM in reality. The sim's mean error is 0.5 s, yet the duel order rate is 56–58% against the 60% bar.
     - Singapore 23: the podium finished within 1.3 s.
  4. **Lapped cars unlapping behind a SC.** Almost always outside the top 6 that G1 scores.
- **M1 measured (tuning races only).** Each green stop's frozen loss becomes the real in- and out-laps minus the sim's own prediction for them (`pace.sim_frame_losses`).

  | | Pass / borderline (model) | Mean (model) | Pass (replay ceiling) | Mean (replay) |
  |---|---|---|---|---|
  | Without M1 | 7 / 1 | 2.34 s | 9 | 2.00 s |
  | With M1 | 7 / 1 | 2.36 s | 10 | 1.83 s |

  - **Better with M1:** Hungary 2019 passes again (2.00 → 1.27 s). Mexico 2019 moves from borderline to pass, France 2021 from fail to borderline, and Hungary 2022 halves (2.64 → 1.26 s).
  - **Worse with M1:** Abu Dhabi 2018 fails (VET duel gap 5 s), and Bahrain 2021 fails on the near-tie only.

### Decisions

← marks the recommendation.

**C1. Stop accounting (M1)**

- **a. Adopt the sim-frame loss.** ← recommended
  - It is the accounting the sim actually uses, and the replay ceiling confirms it (9 → 10 passes).
  - It brings Hungary 2019, a race the plan's G1 names, back to pass.
- b. Keep the field-median loss.

**C2. Near-ties in the G1 order checks**

- **a. Treat cars that really finished within 1.0 s of each other as tied.** ← recommended
  - The duel order check is skipped when the duel's real gap is under 1.0 s; the duel gap check still applies.
  - Podium order matches when the sim's order differs from the real one only by swaps within such ties.
  - Rationale: a check that a perfect model would fail measures luck, not the model.
- b. Keep the order checks as they are.

**C3. Cost of stops under a SC (M2)**

- **a. Measure them from data, as VSC stops already are:** the change in gap to nearby cars that didn't stop, across the neutralization. Kept only if it helps the tuning races. ← recommended
- b. Keep 0.55 × green.

**C4. Lapped cars under a SC (M3)**

- **a. Defer and document.** It changes both sims (TS and Python, in parity) and rarely touches a scored car. ← recommended
- b. Do it today.

**C5. Process**

- **a. Same guard as before.** ← recommended
  - Every change is chosen on the tuning races.
  - The held-out races are checked once at the end of the day.
  - Any G1 rule change (C2) applies to every race and is reported next to the old rule.

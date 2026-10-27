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

**Decided Oct 27, 2026: the recommended option for every decision** (C1a–C5a).

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

### Stage 5 results (Oct 27, 2026)

**Changes kept and rejected**

- **C1 (M1): kept.** Each green stop's frozen loss is the real in- and out-laps minus the sim's own prediction for them.
- **C2: in force.** Cars that really finished within 1.0 s are tied for the order checks. The report shows every race's status under both rules.
- **C3: rejected.** Calibrating the SC stop factor on the six tuning races with a SC after the takeover gives 4 passes at every value from 0.55 to 1.0, with the mean flat (2.59–2.63 s). Saudi 22 improves and Miami 24 gets worse, so 0.55 stays.
- **C4: deferred** (lapped cars under a SC).

**Tuning races**
- 8 pass / 1 borderline / 7 fail, mean 2.36 s (under the old order rule: 7 / 1 / 8).
- Hungary 2019 passes again (1.27 s), and Mexico 2019 passes.
- Abu Dhabi 2018 now fails (VET duel gap 5 s). Bahrain 2021 passes only through the near-tie rule (0.51 s mean error, real gap 0.7 s).

**Held-out check (run once, end of day)**

| Held-out (15 counted) | Model | `replay` ceiling (same rules) |
|---|---|---|
| Oct 26 | 4 pass, 2.56 s | 7 pass, 2.19 s |
| **Oct 27** | **5 pass, 2.37 s** | **11 pass, 2.06 s** |

- **The model passes:** France 19, Spain 20, Portugal 20, Italy 24 and Hungary 25 (Hungary 25 only through the near-tie rule; borderline under the old one).
- **The ceiling passes 11:** Austria 19, Singapore 19, France 19, 70th Anniversary 20, Portugal 20, Bahrain 23, Singapore 23, Japan 23, Italy 24, Hungary 24, Hungary 25.

**What this shows**

- **The mechanics fix mattered.** With M1 the sim reproduces 11 of 15 held-out races given the right pace, up from 7.
- **A1: not met.** The model passes 4 of the ceiling's 11 (36%, against the 80% bar).
- **The gap is pace again,** this time pace that varies within a driver's race (by stint or phase), which one per-driver number can't hold.
- **Next candidates** (strategy-independent, so they stay honest for what-ifs):
  - Re-test per-driver tyre wear (rejected on Oct 25, before tonight's fixes).
  - Pace that drifts over the race per driver.
- **Validated pool:** 13 races.
  - Abu Dhabi 21, Bahrain 21, Mexico 21, Miami 22, Canada 22, Bahrain 22, Hungary 19, Mexico 19
  - France 19, Spain 20, Portugal 20, Italy 24, Hungary 25
  - France 21 is borderline.

## Stage 6: the remaining list (Oct 27, 2026; owner: "start on all these")

The owner approved the whole list, so these defaults apply, each with the usual guard: tuning races choose, held-out is checked once at the end, and nothing is kept that doesn't help.

| # | Work | Default |
|---|---|---|
| D1 | Pace that changes within a driver's race | Screen two strategy-independent shapes on the tuning races: **per-driver wear** (extra s/lap per lap of tyre age) and **per-driver drift** (extra s/lap per race lap). Each slope is shrunk toward 0. A shape is built into both sims (schema, TS, Python, parity) only if it wins. |
| D2 | Lapped cars behind a SC | A lapped car (more than one green lap behind the leader) is not pulled into the leaders' queue: its gap is kept, minus the one lap it gets back by unlapping. In both sims, kept only if it helps the tuning races. |
| D3 | Races that can't be fixed | Documented in `g1-report.md` (data issue, or a named unexplained loss). |
| D4 | When the model is done | The owner's call after the held-out check. |

### Stage 6 results (Oct 27, 2026)

**D1: pace that changes within a race.** Screened on the tuning races; the baseline is 8 pass / 1 borderline, 2.36 s.

| Change | Pass / borderline | Mean | Verdict |
|---|---|---|---|
| Per-driver wear slope (shrink 10 / 30) | 6 / 0, 7 / 0 | 2.49, 2.47 s | Rejected |
| Per-driver drift over the race (shrink 10 / 30) | 6 / 2, 7 / 1 | 2.44, 2.41 s | Rejected |
| T1: pace from clear-air laps only | 5 / 0 | 4.85 s | Rejected |
| **T2: lap noise as a robust spread (1.4826 × MAD)** | **9 / 0** | **2.40 s** | **Kept** |
| T2 with the dirty-air penalty at 50 / 25 / 0% | 6 / 3, 6 / 1, 6 / 1 | 2.26, 2.21, 2.18 s | Rejected (fewer passes) |

- **Linear pace shapes don't help.**
- **T1 shows something useful.** The sim produces less traffic than real races do (Spain 21: PER spent 14 real laps within 1 s of the car ahead, against about 2 in the sim). Base pace fitted on traffic laps was compensating for that, so taking those laps out makes every driver too fast.
- **T2 is a principled fix.** The old noise was the standard deviation over every green lap, which traffic and model misfit inflate. With T2, France 21 moves from borderline to pass, and no race changes status for the worse.
- **A test fix that came with it.** The team-orders known-answer test (`tests/team-orders.test.ts`) took its lap noise from the fitted Abu Dhabi model, so T2 moved it. The scenario now pins its own noise (0.5 s), and holding up the rival leads by 10.7 points.

**D2: lapped cars behind a SC.** No general rule fits, so the sim is unchanged and this is documented as a race-control limit.
- `experiments/unlap.py` measured where cars that unlapped behind a SC actually rejoined the queue.
- **Canada 22 and Miami 22:** at its back, 0–3 s behind. That is what the sim does now.
- **Bahrain 22, Abu Dhabi 21 and Singapore 19:** race control released them late, and cars far back on track restarted 22–90 s behind the queue.
- When race control releases lapped cars isn't in the timing data, so one rule would fix two races and break two others.
- If it is ever needed, it could become a per-SC field in the event data.

**D3: races that can't be fixed.** Each is documented in `g1-report.md` (data issue or diagnosis):
- Miami 2025: data issue.
- Saudi 22: early SC with mass stops.
- Spain 21, USA 18/21, Mexico 18, Bahrain 18: single cars losing time in laps the data doesn't explain (yellow flags, pit laps).

**Held-out check (run once, end of stage 6)**

| | Tuning (16) | Held-out (15 counted) |
|---|---|---|
| Stage 5 | 8 pass / 1 borderline, 2.36 s | 5 pass, 2.37 s |
| **Stage 6** | **9 pass, 2.40 s** | **5 pass, 2.33 s** |

- **The validated pool is now 14 races:**
  - Abu Dhabi 21, Bahrain 21, France 21, Mexico 21, Miami 22, Canada 22, Bahrain 22
  - Hungary 19, Mexico 19, France 19, Spain 20, Portugal 20, Italy 24, Hungary 25
- **A1 is still not met.** The `replay` ceiling passes 11 held-out races, and the model passes 4 of them.
- **D4, when the model is done, is the owner's call.**

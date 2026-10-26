# Phase 1–2 Perfection Spec: Model v2 and a Complete Simulator

Status: decisions made (Oct 26, 2026: all recommended options) · Owner: @Abhiram

## Purpose

Fine-tuning the race model and the simulator:

1. **A model that reproduces real races.** Raise the Gate G1 pass rate on a broad, held-out set of races, so the "what if" answers can be trusted.
2. **A simulator that does everything the game needs.** Real F1 rules that change strategy, team orders, decision moments with options, scoring, and phone-ready speed.
3. **A stable, documented API** (`packages/sim`) that the UI can build against without reading the internals.

This spec replaces the remaining stages of `phase-1-closeout-spec.md` (Stages C–D, Phase 1 done). **Decided Oct 26, 2026: the recommended option for every decision** (A1a, A2a, B1a–B6a, C1a, D1a–D8a).

## Where things stand

- **Races:** 12 built (2021–2022). **G1 passes on 5/12** (Abu Dhabi 21, Mexico 21, Miami 22, Canada 22, Bahrain 22); mean gap error is 3.99s.
- **Fixes already tried** on all 12 races, none of which passed the all-races guard:

  | Fix | G1 passes | Mean gap error |
  |---|---|---|
  | Per-driver wear factor | 3/12 | 5.9s |
  | Driver × compound pace | 4/12 | 3.7s |
  | Real stop times for scripted cars | 4/12 | 3.5s |

- **Causes found:**
  - **Stop times vary ±8s around the median.** Bahrain 21 BOT +8.4s; Hungary 22 VER −4.4s/−5.1s; USA 21 VER −2.4s.
  - **Fresh tyres are faster than the model in their first laps.** −0.17s on the first clean lap, pooled over all 12 races; up to −0.5s at France, USA and Spain.
  - **The undercut is too weak.** USA 21: real gain about 6s, sim about 1s.
  - **Traffic is under-represented.** Spain 21: PER spent 14 real laps within 1s of the car ahead, against about 2 in the sim.
- **Data:** the F1 login now works. 2019 and 2023 download fully, so 2018–2025 is available, which means more races and several seasons at each track.
- **Simulator:**
  - TS↔Python parity on all golden runs.
  - Player calls, headset modes, a reactive rival (cover / go long), and a grader (~135 ms).
  - **Missing:** the two-compound rule, team orders, structured decision moments, scoring, the API doc, and phone-speed headroom.

## Exit criteria

| Gate | Pass condition |
|---|---|
| **G1 (model)** | Pass rate ≥ the D-B5 target on the **held-out** races (not the races used to tune), with every failure diagnosed in `docs/g1-report.md` |
| **G2 (sim)** | TS↔Python parity on every golden race; grader ≤ the D-D7 budget; all new rules and features covered by tests |
| **API** | `docs/sim-api.md` is enough for Reuhen to run a daily race, take calls, grade them and score the run, without reading `sim.ts` |

## Decisions

Each decision lists its options; ← marks the recommendation.

### A. Data

**A1. Validation set**

- **a. About 30 dry, non-red-flag races from 2018–2025, split into a tuning half and a held-out half.** ← recommended
  - The split is fixed before any tuning; held-out races are never used to choose a fix.
  - Includes Hungary 2019, the original G1 race.
  - Validation races use an automatic duel (winner vs runner-up); choosing the playable side stays a content task.
- b. Keep the 12 we have.
- c. Every dry race 2018–2025 (about 120). More signal, but many have no strategic contest.

**A2. Pooling seasons at the same circuit**

- **a. Use other seasons at the same circuit as a prior** for overtaking difficulty and tyre-wear shape, with a race's own data pulling away from it where it has evidence. ← recommended. The original plan §1.4 asks for this for overtaking.
- b. No pooling: each race stands alone.

### B. Model v2

Every item here ships only if it passes the **guard**: it improves mean gap error on the tuning races, loses no G1 pass there, and doesn't make the held-out races worse.

**B1. Pit-stop durations**

- **a. Frozen + sampled.** ← recommended
  - Scripted cars keep their real measured stop time (green/VSC), treated like any other frozen event.
  - New stops (the player's, the rival's reactions) draw from the measured distribution, including its slow-stop tail.
- b. Frozen only.
- c. Sampled for everyone.
- d. Keep the median.

**B2. Fresh-tyre effect**

- **a. Add a fitted new-tyre bonus that fades over the first few laps** (pooled across races). ← recommended
- b. No.

**B3. Traffic and DRS trains**

- **a. Investigate the gap first, then model it.** ← recommended. For example, a follower in a DRS train passes less often because the car ahead also has DRS, and the dirty-air penalty is re-checked.
- b. Skip.

**B4. Driver-specific tyre wear**

- **a. Re-test only once pooling (A2) and the larger set exist.** ← recommended. It was rejected on 12 races because the factors didn't replicate.
- b. Drop it for good.

**B5. G1 target**

The bar itself stays as in S4: duel 3s / 60%, podium 5s / 50%, field max(5s, 10%).

- **a. At least 75% of held-out races pass**, and every failure is diagnosed (race control, unmodelled incident, or model limit). ← recommended
- b. 90%.
- c. No numeric target: report only.

**B6. Lapped-car numbering (old D6)**

- **a. Drop it.** ← recommended. Own-lap numbering is consistent with how the sim runs every car the same number of laps, and G1 only scores lead-lap finishers.
- b. Do it anyway.

### C. Real F1 rules

**C1. Two-compound rule**

In a dry race each car must use at least two dry compounds. Today the player can finish without stopping.

- **a. Enforce it.** ← recommended
  - Track the compounds each car used before takeover (new schema field).
  - A player who finishes without satisfying the rule is disqualified (classified last), as in the real rules.
  - The grader's continuation always satisfies the rule, and the API exposes "rule satisfied?" so the UI can warn.
- b. Ignore it.

### D. Simulator features the game needs

**D1. Team orders** (product doc decision type, e.g. Pérez holding up Hamilton at Abu Dhabi 2021)

- **a. Implement two calls.** ← recommended
  - "Let your teammate past": swap if within 1s, costing the leading car a little time.
  - "Hold up the rival": your teammate defends against the rival, lowering the rival's pass chance and costing the teammate time.
  - Both are graded like any other call.
- b. Defer.

**D2. Radio moments**

- **a. Content only.** ← recommended. Each radio moment is a prompt whose options map to existing calls (pit, headset modes, team orders); no new mechanics.
  - Penalties, car damage and weather moments wait for their own models (out of scope).
- b. Also add penalty and car-damage mechanics now.

**D3. Decision-moment format** (schema v7)

- **a. `decisionMoments` becomes structured.** ← recommended
  - Each moment has `{id, lap, trigger, target, options[{id, decisions}], realOptionId}`.
  - The UI renders it directly; Phase 5 adds radio text on top.
- b. Keep plain lap numbers.

**D4. Finding decision moments automatically** (product doc open question: hand-picking won't scale to 365 races)

- **a. `pipeline moments <race>`.** ← recommended
  - Proposes moments from triggers: SC/VSC start, the rival pitting, the undercut window, approaching the cliff.
  - Builds 3–4 options for each and runs the grader.
  - Keeps only moments that pass the plan's quality bar (§5.3: neither "every option the same" nor "one obviously best").
  - A human still picks the final 2–4.
- b. Manual only.

**D5. Score** (the product doc doesn't define it)

- **a. Band points, averaged over the race's calls.** ← recommended. Green 100, yellow 70, orange 40, red 0. Tie-break: mean chance of the target, then the finishing result. Matches the share card's coloured squares and is easy to explain.
- b. Continuous: 100 × (your option's chance ÷ the best option's chance), averaged.
- c. Leave scoring to Phase 4.

**D6. Strategist persona**

- **a. Defer to Phase 6** (plan §6.2); it needs real teams' style data and copy. ← recommended
- b. Build the style-vector math now.

**D7. Performance**

- **a. Rewrite the hot loop to avoid allocations** (plan §2.8), targeting ≤ 60 ms for the grader budget case on a laptop, so a mid-range phone stays under 200 ms. Expose a grading function that runs as-is in a Web Worker. ← recommended
- b. Leave it (about 135 ms on a laptop).

**D8. API documentation for the UI**

- **a. `docs/sim-api.md` plus runnable examples (a daily race end to end), with semver for `@boxthislap/sim`.** ← recommended
- b. Code comments only.

### Fixed (not decisions)

- Rival policy, headset effects, and the decision-making features stay TypeScript-only. The Python sim remains the reference for real-strategy replays and golden parity.
- Out of scope: rain model, red-flag restarts, 2026 energy, Survivor, Historical Season, the UI itself.

## Stages

Each stage ends with tests and a commit + push. Every model change is measured on the whole set.

### S1. Validation set (A1)

Tasks:

- Choose and register about 30 races with an automatic duel (P1 vs P2), the D3 takeover rule, and a fixed tune/held-out split.
- Ingest them with the login (resumable).
- Run a baseline G1 on all of them.

Acceptance:

- [ ] Snapshots committed.
- [ ] Split recorded in the registry.
- [ ] Baseline report generated.

### S2. Two-compound rule (C1)

Tasks:

- Record compounds used before takeover (schema).
- Enforce the rule in the TS sim (disqualification), and make the continuation and rival obey it.
- `ruleSatisfied` in the API.

Acceptance:

- [ ] Tests: a no-stop run is disqualified; the continuation always complies; real-strategy parity is unchanged.

### S3. Model v2 (A2, B1–B4)

Tasks:

- Season pooling.
- Stop-time model.
- Fresh-tyre bonus.
- Traffic/DRS investigation, then a fix.
- Driver-wear re-test.
- Each item is judged by the guard; held-out races are checked only at the end.

Acceptance:

- [ ] Each shipped item's before/after table is in its commit.
- [ ] Rejected items are logged with numbers.

### S4. Game features (D1, D3, D4, D5)

Tasks:

- Team orders.
- Structured moments (schema v7).
- `pipeline moments`.
- Scoring.
- Tests for each, including a known-answer team-order case.

Acceptance:

- [ ] Abu Dhabi 2021 has auto-proposed moments that pass the quality bar.
- [ ] Scoring is tested.

### S5. Performance and API (D7, D8)

Tasks:

- Allocation-free loop with parity unchanged.
- Worker-ready grading entry point.
- `docs/sim-api.md` with an end-to-end example tested in CI.

Acceptance:

- [ ] Budget met.
- [ ] The example runs in CI.

### S6. Close-out

Tasks:

- `docs/g1-report.md` (all races, held-out highlighted).
- Plan checkboxes and README updated.
- PR with CI green.

Acceptance:

- [ ] Exit criteria met, or each miss explained in the report.

## Risks

| Risk | Mitigation |
|---|---|
| The model can't reach the B5 target | The held-out split keeps us honest; failures get diagnosed rather than tuned away. B5 option c is the fallback. |
| FastF1 rate limit with about 30 races | Resumable ingest with backoff (Stage A); the cache means each race downloads once. |
| Schema changes (v6, v7) break Reuhen's UI | Announce them in `docs/sim-api.md`, bump `schemaVersion`, and keep the API surface stable. |
| Data terms (now using an F1 account) | Product doc open question; no commercial use before it is answered. |

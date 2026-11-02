# Spec: Crew chief (more decisions, a real finish, a tidy call column)

Nov 2, 2026 · Branch `crew-chief`. Feedback: the field bunches on the last lap; the race should end when your car finishes; the player sits idle too long between calls; the boxes on the right are misaligned.

## Findings

- **The last-lap bunching is real F1, drawn badly.**
  - Before a restart, lapped cars pass the safety car and rejoin at the back of the queue (the usual rule), so the field really is nose-to-tail at 0.5 s.
  - The race model already does this. A change that kept lapped cars where they were was tried and reverted: it put lapped cars between HAM and VER and removed the famous last-lap duel.
  - On the map, though, 0.5 s behind the safety car is about 20 m, smaller than a dot. The final lap was also drawn with safety-car spacing, and the screen cut to the results at the line.
- **Early calls are free on the real path.** Graded on the real path, pace calls at laps 35 and 40 score 98% whatever you pick. Extra graded moments there would be free greens, so the quiet laps get ungraded quick calls instead.

## Decisions (Nov 2, 2026)

**D1. The race model stays as it is; the map is fixed.**
- Cars keep a minimum gap on screen, so a train reads as a train.
- Each lap is spaced by the flag it is run under (the restart lap at racing speed).
- At the flag the field runs to the line with the real finishing gaps. The race ends when your car crosses the line; then the chequered flag, then the results.

**D2. Two more graded moments** (both graded by the model; the real team's call was to stay out at both):
- Lap 44, tyres going off: stay out, or box under green (softs, mediums, hards).
- Lap 55, safety car still out: last chance to box (stay out, softs, mediums).
- That makes six moments. The combos check covers 3×4×3×4×3×3 = 1,296 paths.

**D3. Quick calls, timed.**
- Between the big moments, the engineer or driver asks something every few laps, built from the live race:
  - the rival closing or dropping back
  - the gap and the tyres
  - the rival within a second behind
- You have 8 seconds while the race keeps running. Your answer is an order (push, manage, defend…), applied from the next lap and logged like any live call. The driver asked, so he follows it.
- No answer means no change. Quick calls aren't scored.

**D4. The call column.** One card style throughout:
- The same padding and border, and a heading on each card (Radio, Gap, Headset).
- Decision options of equal height, each with its note inside the button.

## Stages

1. Map finish and spacing (D1)
2. Moments 44 and 55: moments file, `pipeline build`, brief lines, combos (D2)
3. Quick calls (D3)
4. Call column cleanup (D4)
5. Tests, E2E, docs, PR

## Done (Nov 2, 2026)

- **D1:**
  - Each lap is spaced by the flag it runs under, with a minimum on-screen gap (`spaceOut`).
  - At the flag the field runs to the line with the real gaps (`runToFlag`); finishers stop in order past the line.
  - The chequered flag shows when your car crosses, then the results.
- **D2:**
  - New moments `tyres-going` (lap 44) and `sc-last-chance` (lap 55), with their radio lines.
  - Combos: 1,296 paths, 0 live/full mismatches. Only 4 paths score 100; most land between 80 and 90.
- **D3:** quick calls after laps 39, 41, 45, 47 and 50 on the real path, built from the race (`quickCallAt`), 8 s to answer at 1× (4.5 s at 2×).
- **D4:** every card in the call column uses `.card`; options are equal height with their notes inside; the gap card has a heading and the current gap.

## Follow-up (Nov 2, 2026): lapped cars under the last safety car

- **What testers saw:** on the last laps every lapped car (NOR, OCO, LEC, ALO…, about a minute back) jumped into the queue behind the leaders. By the rules (and in races since 2022) all lapped cars do unlap and join the back of the queue, which is what the model did. Abu Dhabi 2021 was different: race control waved through only the five lapped cars between HAM and VER.
- **Decided (option 1):** a race can follow that call.
  - New `race.scUnlap: "duel"` in the model (schema, pipeline meta `sc_unlap`, both sims).
  - Only the lead lap closes up behind the safety car. Lapped cars stay where they are, a lap down. On the last lap, the lapped cars between the user's car and the rival are waved through to the back of the lead-lap queue.
  - Abu Dhabi 2021 uses it. Every other race keeps the rule, so their golden files and G1 results are unchanged.
- **Checks:**
  - Applying "duel" to every race broke Bahrain 2022 (BOT really did unlap), which is why it's per race.
  - Abu Dhabi passes G1 at the gate's 500 runs. The CLI test now uses the gate's run count, since at 150 runs GAS, a lap down in ~9% of runs (he was close to being lapped in the real race), tips it over.
  - Combos: 1,296 paths, 0 mismatches.
- **UI:** decision options have centered text; "Mercedes team manager" is set at the size of "Pit Wall".

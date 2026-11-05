# Spec: Battles you can see, and a driver with a temper

Nov 4, 2026 · branch `gameplay-fixes` (localhost only). Battles should be about the track, not a list of turn numbers. They should come up more often, and the driver's trust in the wall should swing harder.

## Decided (Nov 4, 2026, with the owner)

- **D1. Battle cam.** When a battle comes up, the map zooms onto the two cars and the corner, and the rest of the field dims. The choices are drawn on the track as coloured, numbered lines (inside / outside) that match the buttons. The map zooms back out after the corner.
- **D2. Brake-zone freeze.** The lap runs at normal speed. As your car reaches the braking zone with no call made, the race slows and stops there, waiting for you. A bar shows the cars closing on the corner.
  - The move then plays out at the corner: side by side, then PAST, HELD or CONTACT right there.
- **D3. Big trust swings.** Trust runs 0-100 and starts around 70. Every outcome moves it 2-3 times as much as now, so one or two bad calls take a calm driver to frustrated, and good calls win him back fast.
- **D4. More battles.** A battle call comes for any car within 1.5 s (now 1.0 s), asked every lap the fight lasts (now twice, then every other lap).
  - The race model already gives a pass roll to any car within 2 s, so only the asking changes: from 1.0 to 1.5 s the odds are lower and the card says so.

## Defaults (not asked; change any)

**The battle**
- **The corner:** of the track's overtaking corners, the first your car reaches this lap with time to read the card. The header names it ("Battle · T4"); the options don't.
- **The options, in plain words:**
  - Attacking:
    1. Dive up the inside (green line)
    2. Round the outside (blue line)
    3. Wait for DRS, go next lap (amber, no line)
    4. Overtake boost, if the battery has 25% (purple, on the inside line)
  - Defending:
    1. Cover the inside (green)
    2. Hold the outside line (blue)
    3. Defend hard (red, risky)
    4. Let him go
  - Each option shows a one-line effect and a small odds bar (pass or held, contact).
  - Keys 1-4 answer.
- **After your call:**
  - The chosen line stays lit and the others fade.
  - Your car moves onto its line through the braking zone.
  - At the corner, the result shows on the map and the cars take their new order.
  - No call by the time the race has waited about 8 s: the driver makes his own move (as now).
- **The result is real:**
  - When you answer, the game replays the race to the end of the lap to learn the outcome. The replay is exact, the same way a refreshed page lands on the same lap.
  - So the corner shows what the race model will record.
  - Orders you give after a battle call are booked for the next lap, so they can't change a result already shown.

**Trust**
- Trust is 0-100, starting at 70 minus 0.6 per 1% of the driver's researched ignore rate (a range of 50-80; Hamilton, who ignores 15% of calls, starts at 61, just calm). The moods are calm from 60, tense from 40, frustrated from 20, and furious below 20.
- Each outcome changes trust by about 2.5 times as much as now:

  | Outcome | Change |
  |---|---|
  | Pass called and made | +12 |
  | Pass called and failed | −6 |
  | Hold called and held | +5 |
  | Passed when he wanted to defend | −15 |
  | Told to let the rival go | −20 |
  | Contact | −25 |
  | Undercut worked | +15 |
  | A stop that lost places | −15 |
  | Micromanaging | −6 |
  | Said yes to his request | +5 |
  | Said no, and he was right | −20 |
  | Said no, and you were right | +8 |
  | Penalty | −15 |
  | Track-limits strike | −3 |
  | Told to let a car go | −8 |

- Quiet laps move trust back toward where he started, 2 a lap after 2 quiet laps, from above as well as below.
- **The change shows:** a "+12" or "−25" chip pops on the driver's trust meter with the reason, and a change of mood is said on the radio (as now).

**Unchanged**
- Graded moments, scoring, the server's checks (the same shared race model plays every call), replays, golden files and G1. The race engineer only exists in live play.

## Open at merge time (not now: localhost only)

- Trust and the battle window live in the shared race model, so runs already on the live server would replay a little differently. Before merging, version the engineer config so old runs replay on the config they were played with.
- Re-check that every daily and survivor seed still passes the seed tuner with the new battles and trust.

## Stages

1. **Race model:** the trust config and settling both ways, a 1.5 s battle window, and tests.
2. **Battle calls:** asked every lap, plain option labels with odds, and the corner chosen from where your car is.
3. **Lap clock:** normal, slow and frozen speeds (the brake-zone freeze).
4. **Result preview:** replay to the end of the lap on an answer, and the lock on later orders.
5. **Map:** the battle cam (zoom and dim), the coloured lines and brake marker, your car on its line, and the result and new order at the corner.
6. **Battle card:** the new card with the approach bar and the frozen wait.
7. **Trust chip.**
8. **Checks:** all suites, the seed tuner on every pool race (report only), and browser playthroughs.

## Done (Nov 4, 2026, localhost)

- **Race model:**
  - Trust config as above, with settling both ways after 2 quiet laps.
  - A 1.5 s battle window (`headset.json`).
  - A test pins the start range, the size of the swings and settling from above.
- **Battle calls:**
  - Asked every lap of a fight.
  - Plain labels: "Dive up the inside", "Round the outside", "Wait for DRS, go next lap", "Overtake boost"; for defending, "Cover the inside", "Hold the outside line", "Defend hard", "Let him go".
  - Each carries its odds and its line.
  - From 1.0 to 1.5 s the driver says he has to close in first.
- **Lap clock:** `useGame` has `setPace('normal' | 'slow' | 'frozen')`.
- **Result preview:** `GameSession.previewLap()` replays the call log to the end of the lap. A test checks it gives exactly what the lap then gives (order, times, notes). Calls after a battle call are booked for the next lap.
- **Map:**
  - The battle cam: the view eases onto the cars and the corner, and the field dims.
  - A green inside line and a blue outside line, with numbered badges in each option's colour beside the track; tags for "wait" and "let by"; a brake stripe; a ring and tag at the corner.
  - Your car (and the other) slide onto the called line through the braking zone.
  - The result shows at the corner, and the two cars take their new order there.
  - Geometry in `track/battle.ts`, with tests.
- **Battle card (`components/BattleCard.tsx`):**
  - The approach bar, then "Your call: he's on the brakes" with an 8 s bar.
  - Coloured, numbered moves with odds bars.
  - Then the call, and the result.
  - A banner at the bottom of the map names the fight and the corner.
- **Trust chip:** the last lap's changes pop on the driver card ("+12 pass you called", "−25 contact").
- **Checks:**
  - Suites: sim 296, web 195, worker 34, e2e 6.
  - Browser playthroughs: Canada 2022 defending (T8, T13, T1), Mexico 2021 attacking (PER past HAM at T12).
  - Seed tuner, report only: 18 of 19 daily seeds unchanged. Abu Dhabi 2021 is 0% random wins, the known exception, before and after. Bahrain 2022 slips just under the 3% band floor.
  - Survivor seeds not re-checked yet.

## Battle variety (Nov 5, 2026, localhost)

Feedback: in a close race the same battle came up at the same corner 7-8 times. Now:
- **The other driver reads you** (race model, `readMove`): the same move against the same car within two laps loses 1.0 logit. He covers the inside you dived up last lap; an attacker goes round a car that covered the inside. The card says "he's covering / expecting it now" with the lower odds, and the driver says so on the radio. Waiting and yielding are never read.
- **Different corners:** the battle rotates between the track's four best overtaking corners, never the one fought for last time against the same car when there's another.
- **Moves in the corner's words** (`cornerKind`, read from the track's shape):
  - a chicane: "Lunge into the first apex", "Cut back at the second apex";
  - a hairpin: "Late-brake up the inside", "Switchback on the exit";
  - a fast sweeper: "Around the outside, flat".
  - Tested on Monza T1/T4, Canada T10/T13, Abu Dhabi T6, Spa T1/T5, Austria T4, USA T12, Hungary T1 and Russia T2.
- **The driver's line varies** lap to lap (a few ways of putting each situation).
- **A long fight changes rhythm:** every third lap with the same car is a pressure call, not a corner. Attacking: keep the pressure on (his tyres overheat) or drop back and cool yours. Defending: push on the exits or save the tyres.

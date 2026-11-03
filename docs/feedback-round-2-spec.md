# Spec: Beta feedback, round 2 (Abu Dhabi)

Nov 2, 2026 · Second round of tester feedback. Only what shows up in the Abu Dhabi 2021 race is in scope. Two PRs:
- **PR A** (`feedback-2-ui`): fixes, layout, intro, driver personalities. No change to the race model, so the scheduled days keep working.
- **PR B** (`feedback-2-model`): more strategy and failures. Changes the model, so the scheduled days need re-pinning after merge.

## The feedback, and what we do with it

| # | Feedback | Plan |
|---|---|---|
| 1 | You are the team manager | Done in round 1 |
| 2 | More strategy choices | B1–B3 (**D2**) |
| 3 | Better track-map animation | A2 (the pit stop) |
| 4 | Survivor mode | Later (needs more races) |
| 5 | Races where you must defend | Later (needs more races) |
| 6 | Crashes, engine failures, punctures, other F1 incidents | B4 (**D1**) |
| 7 | Show HAM, not "You", on the map and standings | A3 |
| 8 | Driver attitudes | A5 (**D3**) |
| 9 | Weather and wet tyres | Later (Abu Dhabi 2021 was dry) |
| 10 | Tyre wear from track history and weather | Wear already comes from each race's real data; weather later |
| 11 | Intro / how to play | A4 |
| 12 | Auth UI (white box round the Google button) | A1 |
| 13 | Boxing puts you out halfway round the lap | A2 |
| 14 | Box animation | A2 |
| 15 | Asked to box twice, and boxed twice | A1 |
| 16–19 | Layout: player profile left, car stats right, controls under the map, headset as a map icon, gap button | A3 |
| 20 | A few seconds' wait after picking an option | A1 |

## Decisions (Nov 2, 2026)

**D1. Failures happen to the whole field.**
- Any running car can get a puncture, an engine failure or a crash. Risk rises with Push, Attack, old tyres and worn tyres (past the cliff).
- A puncture costs a slow lap to the pits plus a stop. An engine failure retires the car. A crash retires the car and can bring out a safety car (or a VSC).
- These are live-play only, like the headset and the rival's reactions. Replays, the Python reference sim, parity and G1 are unchanged.
- The rolls come from their own random stream per car, so the same seed and calls always give the same race, and the server's replay matches.
- The grader's playouts include them, so the grade prices in the risk of pushing.

**D2. More strategy, in three forms.**
- **Race plan** (B1): a new graded call when you take over (lap 35): manage to the flag, standard, attack now, or box now (mediums or hards).
- **Timing options** (B2): the stop moments gain "Box next lap" and "Box and push".
- **New headset controls** (B3): ERS (harvest / balanced / deploy / overtake, with a battery that drains and recharges) and fuel (normal / lift and coast).

**D3. Driver attitudes: one fixed personality per driver.** Three kinds:
- **Always listens:** never refuses.
- **Listens with questions:** asks "Are you sure?" on some calls. You confirm or cancel, and it rarely refuses.
- **Sometimes listens:** refuses about one call in four.

HAM is "listens with questions". The table covers the 2021 grid.

**Settled without a question:**
- **Asked to box twice.** If your car stopped in the last 3 laps (or has a stop booked), a stop moment isn't asked. The wall answers "stay out" for you, the radio says why, and the result screen marks it "Auto". It still counts as a call (stay out is the right call after a stop), so the server's checks don't change.
- **Lap the stop is drawn.** The car drives the track to pit entry, goes down the lane, stops at its garage, and rejoins from pit exit at the gap the sim gives it. It no longer pops out partway round the lap.
- **Google button.** The white box is the button's iframe painting a light background on the dark page; the fix is CSS.
- **Layout.**
  - Left: your driver's profile (name, team, attitude, tyres, stops, modes), then the standings.
  - Right: car stats (tyre life, pace against the rival, gap), and the call card when one is waiting.
  - Under the map: BOX and the quick controls.
  - Headset: an icon at the bottom right of the map that opens the headset.
  - Gap: a button on the map toggles the gap trace.
  - On a phone it all stacks.

## Stages

| # | Stage | Done when |
|---|---|---|
| A1 | Box-twice fix, Google button, resume feel | A stop moment right after a stop is auto-answered; no white box; the field moves the moment you pick |
| A2 | Pit stop animation | A stopping car drives in at PIT IN, stops at its garage, and comes out at PIT OUT, at any gap |
| A3 | Layout and HAM labels | The layout above, desktop and phone |
| A4 | Intro / how to play | First visit shows a short walkthrough; "How to play" reopens it |
| A5 | Driver attitudes | HAM questions some calls; refusals follow each driver's attitude; tests |
| A6 | Tests, E2E, docs, PR A, merge | CI green, live |
| B1 | Race plan moment (lap 35) | Graded; server verifies it |
| B2 | Timing options in stop moments | Verify accepts a moment's calls on later laps; combos check passes |
| B3 | ERS and fuel modes | Battery drains and recharges; the panel shows it |
| B4 | Failures (whole field) | Rates checked over many runs; a crash can bring a SC; the map and radio show it |
| B5 | Tests, combos, E2E, docs, PR B, merge, re-pin (with your OK) | CI green, days re-pinned |

## Progress (Nov 2, 2026)

PR A (stages A1–A6) is done:
- Web: 63 unit tests, including the auto-stay (and the server accepting it), pit-stop positions and driver attitudes.
- The browser playthrough steps through the walkthrough, and lap 55 is no longer asked after the lap-53 stop.
- The car moves the moment an option is picked (measured in the browser: it is moving within 0.6 s). Picking Box makes the car turn into the lane at the end of that lap.

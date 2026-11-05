# Strategy planner spec

Status: decided 2026-11-05. The owner chose the recommended option for D1–D6 and D8, and **B for
D7** (a strategy grade). See "Decided: the strategy grade" below.

## Goal

From the owner's list: "more strategy, more customizable for the user to choose a strategy".
Today the player reacts: the BOX button, the headset modes, the engineer's calls and the
graded moments. There is no way to say up front "one stop, hards around lap 50, push the last
ten laps" and have the race run to that plan.

The planner makes the player the strategist from the first lap of the last stint:

- At takeover the engineer brings a few plans, each with its chance of beating the rival.
- The player picks one (or builds their own), and can change it any time.
- The car runs to the plan. The engineer says when the plan is coming up, when it's gone
  stale (a safety car, the rival's stop, tyres going off) and what the new best plan is.

## What exists that it builds on

- Laps to run after takeover: 24–55 in the daily pool and 31–57 in the Gauntlet pool, so 0, 1
  and 2-stop plans are all real choices.
- `forkRun(..., { blindAfter })` already runs the race on from now without knowing its real
  future (no hindsight: a forked race gets random safety cars, not the real ones). Grading
  uses it.
- Speed: 200 full rollouts of Abu Dhabi from takeover take about 30 ms. Ranking a handful of
  plans live, in the browser, on every lap is affordable.
- A pit call is an ordinary `pit` decision, booked on its lap. Mode changes are `mode`
  decisions. So a plan needs **no new server or sim decision kinds**: the client turns the
  plan into the same calls the player makes today, as their lap comes. Server replay and
  scoring are untouched.

## What the player sees

**Plan card (at takeover, inside the race screen's call column):**

```
RACE PLAN                               chance vs Verstappen
● A  One stop · Hard on lap 50 · push last 8      41%   ← engineer's pick
○ B  No stop · manage to the flag                 28%
○ C  Two stops · Medium 44, Soft 58               33%
[ Edit plan ]
```

**Plan editor:** a lap strip (takeover to the flag) with draggable stop markers, a tyre
picker per stop, and a pace setting per stint (push, standard, manage). The chance updates
as you drag.

**During the race:**

- A plan bar under the map: "Plan A · box lap 50 for hards (in 6 laps) · 41%".
- One lap before a planned stop, the engineer asks: "Box this lap as planned?" with Box /
  Stay out one more / Change plan. No answer means the plan goes ahead.
- Re-plan prompt when the best plan beats yours by a clear margin (D5).

## Decisions

**D1. When can you plan?**
- **A (recommended):** At takeover, and edit any time during the race.
- B: Only at takeover; afterwards you can only follow it or react with BOX.

**D2. What a plan contains**
- **A (recommended):** Stops (lap and tyre) and a pace setting per stint.
- B: Stops only.
- C: Stops, pace, fuel and ERS per stint (the most control, and the most to learn).

**D3. How plans are offered**
- **A (recommended):** The engineer proposes 3 different plans (fewest stops, best chance, and
  a bold one), each with its chance. You pick one and can tweak it.
- B: A blank editor; you build it yourself.

**D4. Showing the chance of beating the rival**
- **A (recommended):** Each plan shows its chance, from blind rollouts (no hindsight), updated
  every lap.
- B: Show a rough read only ("strong", "risky"), no numbers.
- C: No chance shown; you judge it.

**D5. When the race moves away from your plan** (safety car, the rival stops, your tyres fade
faster)
- **A (recommended):** The engineer flags it and offers the new best plan when it beats yours
  by 8 points or more. You choose to switch or not.
- B: Plans silently re-rank; the bar shows if yours has slipped, no prompt.

**D6. Planned stops on the day**
- **A (recommended):** The car boxes automatically on the planned lap, after a one-lap
  heads-up you can cancel or delay.
- B: The engineer asks every time; nothing happens without your confirm.

**D7. Scoring**
- **A (recommended):** The plan isn't scored on its own. Your result and the graded moments
  stay as they are, so leaderboards and old results stay comparable.
- B: Add a "strategy" grade for the plan you picked at takeover (needs server changes and
  splits the leaderboard before and after).

**D8. The rival's strategy**
- **A (recommended):** The engineer gives an estimate, from the rival's tyres and their life
  ("Verstappen's hards should go to the end; expect no stop"), never the real race's stops.
- B: Show nothing about the rival's plan.

## Decided: the strategy grade (D7 B)

- The plan picked at takeover is graded like a decision moment. Its options are the
  engineer's three plans, plus the player's own plan if they edited one. Each is graded by its
  chance of beating the rival in blind rollouts (no hindsight), with the same bands and points
  as every call. A run's score stays the mean over its graded calls; the plan is one more call.
- It's logged as a new decision `{ kind: 'plan', lap, stops: [{ lap, compound }], pace: [...] }`
  at the takeover lap. The offered plans are rebuilt on the server from the run state
  (the generator is deterministic), and the custom plan comes from the log.
- The Worker scores from the claimed chances as today (free-plan CPU); the nightly reverify
  re-runs the plan's rollouts too, so an edited claim is caught.
- Later plan changes aren't graded (they're just the calls they make). Following the plan
  isn't required.
- Scores from before and after the change aren't comparable; old runs keep their scores.

## Out of scope

- Fuel load at the start: the game takes over mid-race, so the fuel load is already set.
- Saving plans between races.

## Build outline (after the decisions)

1. Sim helper `planChance(run, plan, samples)`: blind rollouts with the plan's calls, common
   random numbers across plans, in a Web Worker. Tests: a plan with no stops on shot tyres
   loses to one with a stop; results are the same on every run; the parent run is never
   changed.
2. Plan generator: enumerate 0, 1 and 2-stop plans on a coarse lap grid with the legal
   compounds (two-compound rule), quick-sample, refine the best, and keep three that differ.
3. Plan card, editor and plan bar; the heads-up before a planned stop; the re-plan prompt.
4. Turning a plan into calls: pit and mode decisions emitted on their laps (same path as BOX
   and the headset today), so a run replays exactly on the server.
5. Tests: unit tests for the generator and execution; e2e plays a daily on a plan to the flag
   and checks the server score matches.

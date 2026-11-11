# Versus: action

**Status:** built (Nov 10, 2026), on the `realistic-ui` branch, for testing on localhost. Builds
on `versus-spec.md`. Differences from the plan below:
- **One battle a lap at most,** at one of the track's three best overtaking corners (rotated
  lap to lap). After a battle there's a lap's break, unless the attacker waited.
- **No replay filter on the calls.** The undercut and cover calls show their own numbers
  instead: what fresh tyres take back on the out-lap, and where you'd come out.
- **Measured:** about 4 battles and 3 strategy calls in a race, on every track (plus a restart
  after a safety car). Battle picks aren't graded.

**Decided (the owner, Nov 10):**
- **The winner** is whoever is first past the flag. The calls' grades are shown as a breakdown.
- **The race** is 15 laps.
- **Battles** are the blind mind game in A1.
- **Chaos:** more of it, as in A4.

## What's wrong now (owner playtest)

- **No moments.** The cars fight, but quietly: a battle is a row of move buttons in the side
  panel for "next lap". Nothing pauses, the map doesn't go to the battle camera, and a pass or
  a hold shows only as a line in the race log.
- **Pointless questions.** The pit window asks on laps 8, 12 and 16 just because the stop is
  owed ("21 laps left in these tyres, 13 to go. Box?"). Nothing makes that lap better or worse
  than the next, so the answer doesn't matter.
- **The stop didn't show.** A boxed car never went down the pit lane on the map (the stop was
  charged, but not drawn). **Fixed** (10da43a).

## The idea

Versus should play like the last laps of a close race all the way through. The cars are kept
within striking distance, every pass is a head-to-head moment both players play, and the
strategy calls only come up when they can win or lose the race.

## A1. Battle moments (the headline)

- **When:** the cars are within 1.5 s on a green lap and the one behind reaches one of the
  track's overtaking corners (the solo battles' corners, 2 or 3 a lap).
- **What happens:**
  - The race freezes at the braking zone for both players.
  - The map goes to the battle camera on the two cars and the corner.
  - Both pick blind, with 6 s on the clock.
- **The choices:**
  - **Attacker:** inside, outside, switchback (fake one way, go the other), or wait (stay
    close and try at the next corner).
  - **Defender:** cover the inside, cover the outside, or defend hard (either side, but risky).
  - **Boost:** either player can add a boost, which spends battery. Each car has about three a
    race.
- **The result is a mind game, with the cars' stats and tyres shifting the odds:**
  - **Wrong guess:** the defender covers the wrong side and the pass is very likely.
  - **Right guess:** the defender covers the right side and the attacker is stuck. They lose a
    bit of time, and a wait keeps them close.
  - **Switchback:** it beats "cover inside" but loses to "defend hard".
  - **Contact:** when both go hard there's a chance of contact (a spin, or front wing damage
    that has to be fixed at a stop).
- **Showing it:** both lines are drawn on the map, the cars run the corner in slow motion, then
  a big result: "PASSED", "HELD", or "CONTACT".
- **Sides:** a battle can go either way. The car ahead can be repassed at the next corner.
- **Cooldown:** after a pass, the next corner can't start a new battle, so it doesn't loop.

## A2. Keeping it close

Battles only happen if the cars are near each other:
- **Out-laps:** cold tyres on an out-lap cost about 1 s. That makes the undercut and the
  overcut close, and the cars cross over near each other.
- **Dirty air is lighter:** the car behind can stay within a second on similar tyres instead
  of dropping back.
- **Starting tyres:** different starting tyres put the cars on different stints, so they swap
  places through the stops.
- **Shorter race:** 15 laps, so there's less cruising between moments.

## A3. Calls that matter (replacing the filler)

**Removed:**
- The lap 8 / 12 / 16 "the stop is still owed" asks.
- The tyre ask when the tyres will reach the flag anyway.

**Instead**, the owed stop is a banner ("Stop owed: box by lap 13"), and the Box buttons stay in
the panel as now.

**Big calls** (the race pauses, each player decides blind):

| Call | Raised when | What it shows |
|---|---|---|
| **Undercut** | Within 3 s of the car ahead and on worn tyres, while they haven't stopped | "Box now: you come out about 0.6 s ahead if Sam stays out" |
| **Cover** | The car behind is within 3 s and could undercut you | "Sam can undercut. Box to cover, or stay out and go long?" |
| **They've pitted** | As now, with the same projection | Where you'd come out, against where they are |
| **Safety car / VSC** | As now | The cheap stop, with the projection |
| **Restart** | The SC comes in | Jump early (risk a penalty), normal, or hold back for a run into turn 1 |
| **Last lap** | The final lap, gap under 1.5 s | Every overtaking corner on the last lap is a battle moment |

**Timing:**
- Strategy calls get 8 s, down from 12 s.
- Battle moments get 6 s.

**Which calls appear:** a call comes up only when the options give clearly different odds of
winning, using the grading engine's own replays. If staying out and boxing are within 5% of each
other, it isn't asked.

## A4. Chaos (same for both, seeded)

- **Safety car or VSC:** in about two races in three, up from one in three.
- **Gremlins** (rare, about one race in four), one of:
  - ERS fault for 2 laps (no boost);
  - a slow stop (+2 s);
  - a lock-up that flat-spots the tyres (they wear faster).

  Each is announced on the radio the moment it happens.
- **Rain:** still later (as in the base spec).

## A5. Who wins (decided: first past the flag)

The base spec grades the calls and shows the road result. With battles that's harder to
explain: you can win every battle and still lose the match. The options:
1. **First past the flag wins.** Simple and exciting. The calls' grades are shown as a
   breakdown.
2. **Points:** points for each battle won and for each graded call, then the road result as a
   bonus.
3. **Keep the call grades** as they are, with battle picks graded as calls too.

## Build

1. **The engine** (`packages/sim/src/versus.ts`):
   - battle moments at corners, with the pick-vs-cover resolution, boosts and contact;
   - out-lap tyre warm-up, lighter dirty air, and the race length;
   - the new triggers, and the "only if it matters" filter;
   - the restart, the gremlins and the event rates;
   - balance tests re-run.
2. **The room** (`apps/worker/src/versus.ts`): freezes mid-lap for a battle (today it only
   pauses between laps), a 6 s blind pick, and the grading or scoring per A5.
3. **The screen:**
   - the battle camera and lines on the map, and the result banner;
   - the call plates with projections, the owed-stop banner and the boost count;
   - the realistic theme throughout.
4. **Tests:** engine determinism, balance, and the two-browser match on localhost.

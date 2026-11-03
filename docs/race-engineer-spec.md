# Spec: Race engineer (you run the car, lap by lap)

Nov 3, 2026 · Branch `session-nov2-console`. Feedback: the player sits and watches dots between calls. They want to be the person on the radio calling the race: frequent calls with effects they can see in seconds, and a driver who gets fed up when the calls go wrong.

## What a race engineer really does in a race

In F1 the person on the radio is the **race engineer** (Bono for Hamilton, GP for Verstappen). Strategy is set by the strategy team on the pit wall and passed on by the race engineer. "Crew chief" is the NASCAR name for that job. Through a race, the race engineer:

- **Feeds information.** Gaps ahead and behind, the rival's lap times, who has pitted and on what tyres, laps left.
- **Sets targets.** Lap-time targets ("target 1:27.5"), tyre management ("look after the rears in sector 3"), lift and coast for fuel or brakes.
- **Runs the power unit.** ERS and battery ("harvest this lap, you'll need it to defend"), engine modes ("strat 2", "overtake button").
- **Coaches the battles.** "He has DRS, defend into turn 1." "He's weak on traction out of 9, get close there." "Don't fight him, it's not our race."
- **Calls the stops.** "Box box", plan A/B/C, undercut and overcut, covering the rival.
- **Handles trouble.** Damage ("front wing damage, losing 4 tenths, box for a new nose?"), track limits ("that's your third warning, one more is a penalty"), lapped cars and blue flags, penalties, safety-car rules (delta time, keep the tyres warm).
- **Manages the driver.** Answers questions ("Are you sure?"), absorbs complaints ("these tyres are gone!"), calms them down, and decides when to say no.
- **Brings it home.** "Last lap, bring it home." Then the post-race radio, which is warm or frosty depending on how it went.

The game already has stops, pace, battle stance, ERS, fuel, team orders and timed quick calls. What's missing:
- calls at the scale of a corner, whose result you see on the map within seconds;
- trouble to handle (damage, track limits, lapped cars);
- a driver whose mood depends on your calls;
- a call often enough that you never just watch.

## Where it hooks into the race model

- The model runs a lap at a time. Passes are rolled once a lap from the gap and pace (`resolveOrder`), and stance shifts the odds. Corner calls ("defend the inside into turn 1") become **that lap's battle call**: it changes the odds of the pass, the risk of contact and the time lost. The map then plays the result at the named corner, so you see it a few seconds after you call it.
- All new mechanics run in **live play only**, like incidents. The race replay that checks realism (G1), the golden files and the seed tuner don't change, so the 19 races stay exactly as accurate as they are now.
- Every call the player makes goes into the call log, and the server replays it, as it does today. Anything that changes the race has to be in the shared race model (`packages/sim`) so the server's replay matches.

## Decided (Nov 3, 2026)

- **D1:** race engineer.
- **D2:** something on almost every lap.
- **D3:** battle calls with any car within about 1 s. With no answer, the driver decides for himself.
- **D4:** option B. Trust also affects pace and mistakes, so trust lives in the shared race model and the server's replay computes it too.
- **D5:** damage, track limits, driver requests, lapped cars and battery calls. No brake temperatures or weather.
- **D6:** not scored directly. The results show the driver's mood and the best and worst call.
- **D7:** slow motion in battles.
- **D8:** all 19 races.

## The options as written

**D1. What the player is called.**
- **A. Race engineer (recommended).** It's the real F1 job that does everything above, and the radio becomes "you" talking to "HAM".
- B. Crew chief. That's your word for it, but it's NASCAR's term; F1 fans would notice.
- C. Keep "team manager" (what the game says now).

**D2. How often something happens.**
- **A. Something on almost every lap (recommended).**
  - A real call (a battle, a request, trouble) every 1-2 laps when anything is going on.
  - Information-only radio (gaps, the rival's times) on the quiet laps in between.
  - The big graded moments stay as they are.
- B. A call every 2-3 laps, closer to today's quick calls.

**D3. Battle calls (corner-level).** When your car is within about 1 s of another car, a battle call comes up with 5 seconds to answer. Each option changes that lap's odds of a pass, the chance of contact (front-wing damage, a puncture or a crash), the time lost and the tyre wear. The map shows the battle at the named corner.
- Defending: **cover the inside into T1**, **hold the outside line**, **defend hard (late moves, more risk)**, or **let him go, save the tyres**.
- Attacking: **dive up the inside**, **go round the outside**, **wait for DRS next lap**, or **use the overtake button** (ERS).
- Which cars?
  - **A. Any car (recommended).** Traffic, lapped cars and the cars between you and the rival all matter.
  - B. The rival only.
- No answer: **A. the driver decides for himself (recommended)**, in line with his personality. B. no change.

**D4. Driver mood (trust in you).**
- Trust starts from the driver's attitude (HAM lower than BOT) and moves with what happens.
- **Goes down when:**
  - a call costs a place ("you told me to hold the outside and he just drove past");
  - contact after a defend-hard call;
  - a stop that drops him into traffic;
  - saying no to his request and then being proved wrong;
  - micromanaging, with pace changes every lap.
- **Goes up when:** a call works (a pass, a good undercut, a clean defence), or saying no turns out right.
- Four levels: Calm → Tense → Frustrated → Furious. The radio's tone follows ("Copy." → "Why are we doing this?" → "Are you even watching?").
- Effects:
  - **A. Refusals and radio (recommended).**
    - Low trust makes him refuse more of your live calls (BOX, headset, battle). That part needs no server change.
    - When Furious, he picks his own stance for a few laps and the game logs it like any other call, so the server's replay matches without a server change either.
  - B. Also affects pace and mistakes. Frustrated drivers push, wear the tyres and make errors. It's more dramatic, but trust then has to live in the shared model and the server check grows.

**D5. New things to handle** (all live play only; tell me which to include):
- **Damage (recommended).** Contact can break the front wing, costing 0.3-0.8 s a lap.
  - The call is "box for a new nose" (the stop is about 3 s slower) or "carry on".
- **Track limits (recommended).** Defending hard and pushing build up warnings.
  - The radio warns you, and the call is "back off at T4" (about 0.1 s a lap) or "keep going".
  - A fourth strike is a 5-second penalty, added at the flag.
- **Driver requests (recommended).** He asks instead of the engineer: "These tyres are gone, I want to box", "Let me push", "Tell him to get out of the way".
  - Yes or no, and trust remembers whether you were right.
- **Lapped cars and blue flags (recommended).** A slow lapped car costs time.
  - The call is "complain to race control" or "go the long way round".
- **Battery calls (recommended).** "Battery's low and he's coming: harvest now or keep deploying?" This builds on the ERS already in the game.
- Brake temperatures. **Not recommended:** we have no real data, so it would be invented.
- Weather. **Not recommended now:** the model has no wet running, and it's a bigger job (the feature list has it separately).

**D6. Scoring.**
- **A. The new calls aren't scored directly (recommended).** They change the race, so they decide whether you beat the rival, but the score stays the mean of the graded moments. The server's scoring and the nightly re-grade stay as they are.
  - The results screen adds the driver's mood at the flag and his post-race radio, plus a "best call" and a "worst call" from the race log.
- B. Score them too. That needs new grading (each one graded by playouts), and it's a big server change.

**D7. Pace of play.**
- **A. Slow motion in battles (recommended).** The lap runs at half speed while a battle call is open, and the map zooms the cars together so you watch the move.
- B. Keep the race at the same speed.

**D8. Which races.**
- **A. All 19 at once (recommended).** Everything is built from the live race (gaps, tyres, who's near), not written per race.
- B. Abu Dhabi 2021 first, the rest after you've played it.

## Stages (after the decisions)

1. **Model:**
   - battle calls (corner options → pass odds, contact, time, wear);
   - front-wing damage and the nose-change stop;
   - track-limit strikes and the 5-second penalty;
   - lapped-car time loss.
   - All live play only, all in the call log. Unit tests for each. G1, golden files and the seed tuner unchanged.
2. **Server:** the replay accepts the new call kinds. Tests that a run with every new call replays exactly, and that a tampered one is refused.
3. **Driver mood:** trust and its events, the four levels, refusals scaled by trust, Furious taking its own stance (logged), and the radio lines per level and per driver attitude.
4. **The radio director:** picks the call for each lap (battle > trouble > driver request > the engineer's information), so there's something on almost every lap without repeating itself.
5. **Screen:**
   - the battle call (5 s, options named by corner);
   - slow motion and zoom on the map, and the pass, the failed pass or the contact shown at the corner;
   - the mood meter on the driver card;
   - damage and penalty badges.
6. **Results:** the mood at the flag, the post-race radio, and the best and worst call.
7. **Check every race:** a random-player sweep over all 19 for crashes, stuck runs and live/full mismatches; e2e playthroughs updated; docs.

## Acceptance

- Over a whole race, no stretch longer than 2 laps without a call or a radio line, on every race.
- A battle call's result shows on the map within 5 seconds of answering.
- Trust visibly moves with outcomes, and a Furious driver acts on his own, logged.
- On all 19 races: 0 live/full mismatches; the G1 results, golden files and tuned seeds unchanged; all tests and e2e green.

## Done (Nov 3, 2026)

**Race model (`packages/sim/src/engineer.ts`, `sim.ts`, `headset.json` → `engineer`).** All of it is live play only, on the same switch as crashes (`incidents`). Replays, golden files, G1 and the "real calls replay the real race" check are unchanged.
- **Battle moves** for one lap against the car directly ahead (dive up the inside, round the outside, wait for DRS, overtake button) or behind (cover the inside, hold the outside, defend hard, let him go). Each move shifts that lap's pass roll and adds its time and wear. Waiting for DRS boosts the next lap's attack. `scripts/battle-odds.ts <race>` measures them.
  - Hungary 2019, evenly matched cars: a dive takes the chance of being ahead after the lap from 14% to 23%, with about 3% contact.
  - Defending: defend hard holds 90-95%; letting him go is a pass almost every time.
  - The real overtaking data still rules, so attacking a faster car rarely works (Canada 2022: SAI on VER).
- **Contact:**
  - a front wing costs 0.3-0.8 s a lap until a stop, and the stop costs 3 s more for the nose;
  - a puncture forces a stop, on a compound that keeps the car legal;
  - a spin costs 2.5 s.
- **Track limits:** strikes, with care costing 0.1 s a lap; a 5 s penalty at strike 4, added at the flag.
- **Lapped cars:** waiting for the blue flags costs nothing extra (the measured laps include traffic); going round gains 0.2 s, with a small chance of contact.
- **Driver requests:** box or push. A "no" is judged 3 laps later, to see whether he was right.
- **Trust:**
  - starts from the driver's attitude;
  - moves with called moves, contact, stops judged once the rival has answered, requests, micromanaging and penalties;
  - quiet laps settle it.
  - Frustrated: faster, harder on the tyres, more mistakes. Furious: also picks his own battle moves.

**Server:** the call log carries the new calls (`battle`, `limits`, `blue`, `reply`). The Worker's replay and the nightly full re-grade match the game on all 19 races (`tests/engineer-verify.test.ts`).

**Game:**
- **The radio director (`game/engineerCalls.ts`)** picks each lap's call in this order:
  - a crash's safety car;
  - a battle (5 s, slow motion, named by the corner after the longest straight). A long battle is asked about every other lap after the first two; no answer means the driver picks by attitude.
  - trouble: front wing, track limits, the two-compound rule, a lapped car;
  - the driver asking;
  - the battery;
  - the engineer's quick calls.
  - A quiet lap gets an info line. Result: about one call every two laps, plus the radio in between. The test checks that no race goes more than 2 racing laps without anything being said.
- **Refusals** are scaled by mood: calm ×0.6, tense ×1, frustrated ×2, furious ×3.5. They now cover battle calls too: a refused battle call means the driver's own move.
- **Map:** the battle's corner and the other car pulse, and the result pops up at the corner ("PAST VER!", "HELD!", "CONTACT!").
- **Driver card:** a trust meter with the mood, plus badges for damage, track limits and penalties.
- **Results:** the driver after the flag (mood, his post-race radio, the best and worst call in his eyes, battles won, contact, penalties). A disqualified car shows DSQ.
- **Role:** "race engineer" throughout. How to play has two new steps.

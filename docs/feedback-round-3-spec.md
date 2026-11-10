# Feedback round 3 spec

Three items from playtesting (Nov 8, 2026). Every decision below is the owner's.

## R1. "Asking to box after 7 laps again"

**Cause.** The big calls are authored on the real race. Abu Dhabi 2021's lap-44 tyre call ("Our hards are N laps old and the lap times are starting to drop. Box?") exists because the real Hamilton's hards were about 30 laps old by then. A player who boxed at the lap-36 VSC met the same call on 7-lap-old tyres. The only guard skipped a stop question within 5 laps of a stop.

**Decision: as proposed.** `packages/sim/src/autoStay.ts` is shared by the game and the server, so both agree. The wall answers "stay out" itself when:

- a stop is booked and not yet made;
- a stop was made in the last 5 laps, or 8 laps for a safety car or VSC call, where a cheap stop can still pay on 10-lap-old tyres;
- a tyre call (trigger `cliff`) comes after your own stop, and the set you fitted is neither within 5 laps of its drop-off nor short of the flag.

How the game shows it:

- **The radio** says why: "We've just stopped", "We're boxing already" or "Tyres are still good".
- **The score:** an answer the wall gave is shown as "Auto · not scored" and left out of the score and its tie-break (`scoreRun`'s `auto`). The server applies the same rule in `verifyRun`.
- **The reference client** (`examples/daily-race.ts`) answers these calls the same way.

## R2. Battles: more information, but not too much

**Decision: a meter and tags.**

- **The meter.** One bar at the top of a battle call shows how the fight stands: "Hold 64% · He gets by 36%" when defending, "Pass 41% · Stay behind 59%" when attacking. It's the chance with no special move (the hold or wait option).
- **The options** lose their numbers. Each gets a tag instead: **Safer**, **Balanced** or **Risky**, from its contact risk compared with the others. The odds still decide the outcome; the player just doesn't see each option's exact figures.

## R3. A tutorial race

**Decision: Canada 2022, with fast-forward.**

- **The race.** No race has every kind of call; rain only happens in wet races. Canada 2022 (VER vs SAI, a validated daily race) has a VSC, a safety car, tyre calls and a rival-pit call.
- **Rain** gets a one-screen tip.
- **How it runs.** The race fast-forwards between steps, so only the laps with something to teach play at normal speed.
- **The steps**, each highlighting its control:
  1. the map and leaders;
  2. the race plan;
  3. team radio;
  4. a quick call;
  5. a battle;
  6. a big call (the VSC);
  7. Show stats;
  8. fuel;
  9. the rival-pit call;
  10. the safety car;
  11. the results.
- **Access.** Offered once to new players, replayable from How to play, skippable at any step, never scored or saved.

# Call timing spec

**Date:** Nov 9, 2026. Owner's request: new players don't have enough time to read the timed calls. Calls should still feel like on-the-spot decisions.

**Decision (the owner's): a reading pause plus slow motion.** The extra ideas were declined: more time for new players, holds per race, a lap-ahead warning and a Rookie/Pro setting.

## Timed calls

**Quick calls** (engineer or driver questions, and the driver's box request):
- The race runs in slow motion while the card is up, and goes back to full speed once it's answered or times out.
- There's a reading pause before the 8 s answer clock starts. The timer bar stays full during the pause.
- At 2x speed the answer clock is still 8 s. It used to drop to 4.5 s because it had to fit inside one lap at full speed.

**Battles:**
- The race still freezes at the braking zone.
- The 8 s wait now starts after the same reading pause.

**Battles with no corner to draw:**
- The race is held still.
- They get the same reading pause, then 8 s.

## The reading pause

`readMs` in `engineerCalls.ts` sets the pause: 1 s plus 55 ms per word of the question and its options, kept between 1.5 s and 3.5 s.

## Not changed

- **Big calls** (safety car, tyres, rival pit) still pause the race with no clock.
- **The tutorial** still waits for every answer.

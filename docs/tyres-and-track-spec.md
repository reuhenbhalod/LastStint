# Spec: Tyre guide and a better track map

Nov 2, 2026 · Branch `tyres-and-track`. Feedback: explain the options (what mediums and hards are, when each is good or bad) so players can make the call they actually mean to; a more detailed, better-looking track; a pit lane that stands apart, with the pits drawn in.

## Decisions (taken as the defaults, no open questions)

**T1. The tyre facts come from the race model, not general F1 lore.**
- Each compound's pace when new, how fast it wears, and when it falls off (`compounds` in the race file).
- What fresh tyres would gain over the laps left against staying out, from the sim's own lap-time model (`cleanLap`). This is lap time only: no stop cost, traffic or passing. The card says so, and shows the stop cost beside it.
- A short "good when / bad when" line per compound. The numbers make it specific to the moment ("lasts to the flag: 6 laps left, falls off after 19").

**T2. Explain the other options too.**
- Push / standard / manage and attack / hold / defend, from the sim's headset effects (`modeEffects`): seconds per lap, tyre wear, mistakes, passing.
- Shown under each option on the decision card, and as a tooltip on the headset buttons.

**T3. The track map: drawn detail on the FastF1 line.**
- Run-off around the circuit, and an asphalt band with white edge lines.
- Red-and-white kerbs at each corner.
- A chequered start/finish line.
- Corner numbers in badges on the outside.
- A soft glow behind your car and the rival.
- No sector colours: we have no reliable sector boundaries, so none are drawn.

**T4. A distinct pit lane.**
- The real lane runs only ~15–20 m off the straight, so at map scale it sits under the track. It's drawn offset to the inside of the straight, with tapered entry and exit, in its own colour.
- The pit building and garage boxes line it, with Mercedes' and Red Bull's boxes marked.
- Speed-limit lines mark the entry and exit ("PIT IN" / "PIT OUT").
- Stopping cars use this drawn lane and pause at their team's box.

## Done (Nov 2, 2026)

- **Tyre step:** each compound shows its pace vs softs, when it drops off, whether it lasts to the flag, the gain over the green laps left (vs staying out), and a good/bad line.
- **Other options:** every option on the card has a one-line note (the stop cost, track position, or the mode's effect). The headset buttons have the same as tooltips.
- **Track:** run-off, edges, kerbs, chequered line and corner badges.
- **Pit lane:** spread clear of the track (`spreadLane`) with garages; Mercedes and Red Bull are marked. PIT IN / PIT OUT lines. Stopping cars drive in, wait at their team's box, and drive out.
- **Fixed:** the race log held the sim's live state object, so it never saw a new lap. The pit card never showed, and the driver card's last lap and stops stayed empty. It now keeps its own copy, with a regression test.

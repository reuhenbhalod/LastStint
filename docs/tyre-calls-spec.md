# Tyre call wording spec

**Date:** Nov 9, 2026. The owner asked for prompts other than "our tyres are N laps old" and chose the recommended set.

## Problem

Four calls use one fixed sentence, built around tyre age:
- the big tyre call;
- the big pace call;
- the driver's "starting to go" quick call;
- the driver's box request.

Age says little without the tyre's life, and the same line every time reads as filler.

## Decision

The calls say what the race actually looks like, using only figures the game already uses. Only the wording changes: the options, the outcome and the score don't.

### The facts (`apps/web/src/game/tyreTalk.ts`)

Each fact is either true right now or left out.

| Fact | Said when | Example |
|---|---|---|
| **Undercut threat** | The car behind is within reach of a one-lap undercut: the gap is at least 0.8 s (closer is a fight on track) and under what a new set gains in a lap (our wear loss plus the new-tyre bonus). | "Norris is 2.1 s behind. If he stops first, he can jump us." |
| **Rejoin** | The gaps around the spot where we'd come out are clear by at least 1.5 s either way, since a stop's cost varies a little. | "Box now and we come out P6, 3.2 s behind Albon." or "…in clean air." |
| **Life left** | Always, for a slick. It's the game's tyre life (`tyreLife`) minus effective wear, against laps to go. | "About 5 laps left in these, 18 to go." / "These are past their life, 18 to go." |
| **Pace loss** | The wear loss against a new set of the same tyre is at least 0.3 s a lap. | "They're costing us 0.8 s a lap now, up 0.3 in three laps." |

### The calls

- **The tyre call:** leads with the most pressing fact. The order is undercut threat, then rejoin, then life left, then pace loss. It adds the next fact and ends with the question.
- **The pace call:** uses life left, pace loss and the undercut threat (here: "push to keep him behind"). Rejoin doesn't apply, since there's no stop.
- **Wording:** each fact has two wordings, picked by the lap, so a replay of the same day reads the same. Tyre age stays on the card's fact row.
- **The driver's lines:** "starting to go" and "I want to box" get three wordings each, picked by the lap.

## Not changed

Every other call (safety car, VSC, rain, rival pit, undercut, battles) and every option label.

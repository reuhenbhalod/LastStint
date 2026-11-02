# Spec: Beta feedback, round 1 (Abu Dhabi)

Nov 1, 2026 · Testing feedback on the Abu Dhabi 2021 beta. Only what shows up in this one race is in scope. Branch: `feedback-round-1`.

## The feedback, and what we do with it

| # | Feedback | Plan |
|---|---|---|
| 1 | After picking an option the race takes a few seconds to start again | Fix (S1). After a pause, the map's animation clock was never restarted, so the dots sat still for a whole lap tick. |
| 2 | "You beat Mercedes", not "You won" | S3. The result compares your finish with the real team's finish. |
| 3 | Drivers sometimes don't listen | S7, **D1** |
| 4 | You are the team manager (Mercedes in Abu Dhabi 2021) | S3. Wording on the intro, race and results screens. |
| 5 | More strategy choices | S6, **D2** |
| 6 | Better track-map animation | S4. Cars glide between gaps instead of jumping at each lap; a safety car on track; tyre-coloured rings. |
| 7 | Survivor mode | Out of scope (needs more races) |
| 8 | Races where you must defend | Out of scope (needs more races) |
| 9 | Show a stop on the map in the pit lane, with its details | S5. The real pit-lane path comes from FastF1 position data. A pit card shows the stop. |
| 10 | Pointer cursor on buttons | S1. Tailwind v4 dropped `cursor: pointer` on buttons; add it back. |
| 11 | Button latency | S1. Calls act at the end of the lap, so add instant "booked" feedback; also fix #1. |
| 12, 16 | Click a driver on the map (or standings) to see their profile and stats | S4. Driver card. |
| 13 | Race too fast | S1, **D4** |
| 14 | Auth and daily streaks | S8, **D3** |
| 15 | Make decision moments more obvious | S2. Radio alert over the map, the map dims, a flash, an optional radio beep. |

## Decisions (made Nov 1, 2026)

**D1. Drivers ignoring calls: real, on live calls only.** A BOX or headset call made during the race has about a 1 in 8 chance of being refused, with a radio reply ("Negative, the tyres are fine."). A refused call is not applied and is not logged, so the server's replay matches what the player saw. The roll is deterministic from (seed, lap, call), so a refresh can't re-roll it. The four graded moments are always followed.

**D2. More options per moment.**
- Lap 36 VSC: stay / mediums / hards.
- Lap 49: push / standard / manage.
- Lap 53 SC: stay / softs / mediums / hards.
- Lap 57: defend / hold / attack.

The real team's calls are unchanged. Every option is graded by the model, and the combos check covers 3×3×4×3 = 108 paths.

**D3. Real sign-in with Google, plus streaks.**
- Google Identity Services gives the browser an ID token. The Worker checks it (RS256 against Google's keys; audience, issuer and expiry) and links the browser's `anonId` to the Google account.
- The account keeps one player ID, which every signed-in device adopts. One run per day and the streak then follow the account.
- The streak is shown signed in or not: a signed-out browser has its own streak.
- Needs a Google OAuth client ID: `VITE_GOOGLE_CLIENT_ID` (site build) and `GOOGLE_CLIENT_ID` (Worker var). Without one, the sign-in button is hidden and everything else works.

**D4. Speed: 1× = 10 s per lap, 2× = 5 s.**

**Fixed (no choice needed):**
- The player is "the Mercedes pit wall" (the user's car's team, from the model).
- The result headline compares with the real result: "You beat Mercedes", "You matched Mercedes" or "Mercedes did better". "Mercedes" is the real team, i.e. what the real pit wall achieved.
- Driver names for the card come from a static 2021 grid table in the web app.

## Stages

| # | Stage | Done when |
|---|---|---|
| S1 | Pointer cursor, speed (D4), resume stall fix, instant feedback on BOX and headset calls | Picking an option starts the cars moving at once; a booked call shows straight away |
| S2 | Decision alert: banner over the map, dim + flash, decision card highlighted, optional beep (sound toggle, off by default) | A moment can't be missed on a phone or a laptop |
| S3 | Team-manager framing + "You beat Mercedes" | Intro, race header and results read as the Mercedes pit wall |
| S4 | Map: smooth motion, safety car, tyre rings, driver card on click (map + standings) | Clicking any car shows its name, team, position, gaps, tyres, stops and modes |
| S5 | Pit lane: `pipeline outline` adds the pit-lane path; a car that stops drives through it; a pit card shows the details | A stop visibly goes down the pit lane |
| S6 | More options (D2): moments file, `pipeline build`, combos check, tests | 108 combos, 0 mismatches; CI parity green |
| S7 | Driver refusals (D1) | Refused calls are never logged; tests cover determinism |
| S8 | Google sign-in + streaks (D3): migration 0004, `/api/auth/google`, `/api/me`, UI | Worker tests with a test signing key; streak on the intro and results screens |
| S9 | E2E update, docs (`status.md`), PR, merge | CI green |

## Known consequence

Changing the Abu Dhabi model (S6) changes its hash. The test days already scheduled (Nov 1–3, #1–#3) pinned the old hash, so they will refuse runs until they are re-pinned. That is a production database write, so we confirm it first.

## Progress (Nov 1, 2026)

All stages S1–S8 are done, and S9's checks pass.
- Web: 45 unit tests and the browser playthrough (which now also opens a driver card and checks the radio alert).
- Worker: 26 tests, including Google token checks against a test signing key, and streaks.
- `combos abu-dhabi-2021`: 108 combinations, 0 live/full mismatches.
- Pipeline: outline tests, including the pit lane.

Still to do:
- Re-pin the Nov 1–3 test days to the new model hash (a production database write).
- Create a Google OAuth client ID and set it in both places (see D3).

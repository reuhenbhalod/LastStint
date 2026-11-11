# B2 re-author, Nov 10 2026 (Expert rival grader fix and player stint-pace fix in)

Base: `eras-integrate-fixes` (`35975b7`), which has the Expert rival grader fix
(`eras-fix-expert-grader`) and the player's race-wide stint offset in live play
(`eras-fix-player-pace`). Each race below stopped being reachable with those fixes in and was
re-authored with the smallest change that makes it reachable at the era's difficulty and at
Legend, with stay-out never earning ★3.

No new outside facts were needed unless a row below says so. Headlines are unchanged. No team
radio is quoted. Check each row and put your initials and the date in **Owner checked**.

## Sources

| Short name | What |
|---|---|
| RAW | The race file's `realStrategy`: each car's real stops (lap, compound) |
| RACE | data/races/<id>.json at the takeover (`stateAtTakeover`) |
| earlier | Rows of an earlier sheet, still valid (named per race, not re-listed) |

## abu-dhabi-2022 (Era 10 #10, Leclerc)

**Failure:** Era reachable, but the stay-out path earned ★3 on seed 2: it never boxes, picks up a
puncture on lap 57, is forced onto hards (one stop) and finishes 17th, which met the old mastery
("exactly one stop") with every call graded clean. Legend not reachable: on seed 1 Leclerc has a
random incident on lap 21 on every path; on seed 2 the drawn SC (laps 34-38) gives the Expert
Pérez a cheap second stop and he finishes ahead on every path (by 9.7 s or more); on seed 3
(drawn SC laps 20-24) boxing on lap 21 does beat Pérez, but the old stop-21 moment graded
staying out best there (the grader's playout stops later under the SC), so every path the
search kept stayed out, never stopped and was disqualified (two-compound rule).

**Change: mastery and moments.** Side LEC (`pipeline hard-calls`: LEC 1, PER 0, unchanged),
target `beat-rival` PER, hidden (no lap of tyre management), storyline, briefing and headline
are unchanged; there is no rewrite (Leclerc really beat Pérez).

- **Mastery** `finish_position` 2, "Finish second or better, as Leclerc did" (was `stop_count`
  exactly 1, "Beat Pérez on one stop, as Leclerc did"). A one-stop count alone was met by the
  stay-out path's forced puncture stop in 17th.
- **Moments** re-authored (`pnpm --filter @laststint/sim author abu-dhabi-2022 --eras --write`,
  then the stop call moved one lap earlier by hand): **stop-20** (real: box next lap, hards),
  pace-36, pace-40, pace-44. Was: stop-21 (real: box, hards), pace-32, pace-44, pace-48. Same
  options and labels; the stop call is the same real stop (in on lap 21, out on lap 22, hards),
  now asked a lap earlier as "Box next lap, hards". On Legend seed 3 boxing at once is graded
  best (stay yellow), so the winning path is findable.
- **Reachability** (`reachability abu-dhabi-2022`, on a local Eras rebuild): PASS. Era: seed 3,
  stop-20 box-next-hard, pace-36 push, pace-40 push, pace-44 push (★1 ★2 ★3, hidden, accuracy
  100). Legend: seed 3, stop-20 box-hard, pace-36 standard, pace-40 push, pace-44 push (★1 ★2 ★3,
  hidden, accuracy 99.6). Stay-out earns no ★1 or ★3 at either level.
- **Robust G1** (`validate abu-dhabi-2022 --robust`): strict pass, mean gap error 0.54 s
  (unchanged).

| Fact | Used in | Source | Owner checked |
|---|---|---|---|
| Leclerc finished second (Verstappen won, Pérez third, 1.3 s behind Leclerc) | mastery label | earlier (swap-races-e10-e9-b, abu-dhabi-2022 "Result" row); J-res | |
| Leclerc made one stop, at the end of lap 21, onto hards (out-lap 22) | stop-20 real option (box next lap, hards) | RAW (LEC: lap 22, HARD); earlier (swap-races-e10-e9-b "Leclerc stops" row) | |

**For the owner:**
- The one-stop part of the old mastery is gone; ★3 now asks for second place with every call
  clean. If you'd rather keep the one-stop story as an objective, it could move to the hidden
  objective (`stop_count` exactly 1, in place of "no tyre management"); that was not measured.
- Legend is reachable on one of the three seeds only (seed 3). Seed 1 retires Leclerc on lap 21
  whatever the player does; seed 2's drawn SC hands the Expert Pérez the race unless the player
  takes a second stop under it (the reachability search does not play the Legend SC call or the
  BOX button).

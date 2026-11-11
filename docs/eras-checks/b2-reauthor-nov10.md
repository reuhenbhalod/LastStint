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

## turkey-2021 (Era 9 #7, Leclerc)

**Failure:** Legend not reachable. Best Legend path (seed 2: stay at lap 44, box at lap 47,
push) is ★2 ★3 hidden, but finishes 5th, behind Hamilton, so it misses ★1 (P4). With the
player's race-wide stint offset (+0.13 s/lap for Leclerc), a stop on the real lap (47) finishes
5th on every Legend seed played (Expert Hamilton gets ahead). A stop between laps 40 and 45
still makes P4 or better on Legend seed 2. The old stop-44 moment graded both box options
orange at Legend (stay 77%, box 63 to 67% on seed 2), so the search never kept them. On Legend
seed 1 Leclerc has a random incident on lap 47 on every path.

**Change: moments only.** The overlay (`data/eras/turkey-2021.json`) is unchanged: side LEC,
target `position` 4, rewrite `position` 3, mastery exactly one stop, hidden push for no more
than 9 laps, briefing and headline.

- **Moments** moved: stop-44 → **stop-43** (real: stay), pace-50 → **pace-51**, pace-54 →
  **pace-55**. stop-47 (real: box, fresh tyres) is unchanged. Same options and labels; the
  target is still P4. The earlier stop window makes the "stop before the real lap" path
  findable at Legend.
- **Reachability** (`reachability turkey-2021`): PASS. Era: seed 2, stop-43 box-hard, stop-47
  stay, pace-51 standard, pace-55 standard (★1 ★2 ★3, hidden). Legend: seed 2, stop-43
  box-hard, stop-47 stay, pace-51 push, pace-55 push (★1 ★2 ★3, hidden). Stay-out earns no star
  at either level (accuracy 64 to 73).
- **Robust G1** (`validate turkey-2021 --robust`): pass, mean gap error 0.41 s (unchanged).

| Fact | Used in | Source | Owner checked |
|---|---|---|---|
| Leclerc was still out on his first set at lap 43 (he stopped once, onto fresh tyres, after lap 47) | stop-43 real option (stay) | RAW (LEC: one stop, lap 48 out-lap); earlier (6.2-eras10-8: "Bottas re-passed him on lap 47; Leclerc then pitted") | |
| Leclerc led at the lap-38 takeover on 38-lap-old tyres | moment context (unchanged) | RACE | |

**For the owner:** `pipeline hard-calls turkey-2021` on this base now counts LEC 1, HAM 2
(chance given up LEC 4.7, HAM 19.0 pts) and would pick **HAM** as the side. The overlay still
says LEC (hard calls LEC 2, HAM 1 as recorded before the fixes). This re-author keeps Leclerc;
playing the race as Hamilton would mean a rebuild for HAM and a new eras block (target,
storyline, mastery, hidden, briefing, facts).

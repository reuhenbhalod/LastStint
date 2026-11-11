# Three Eras races swapped in Era 10 and Era 9 (owner, Nov 9): owner sign-off

Three races that fail G1 are replaced by another race of the same era, in the same slot, as
in the first four swaps (`swap-races.md`, migration 0012). Every fact below was read in the
linked source on Nov 9, 2026; nothing comes from memory. Where sources disagree, the row says
which was taken. Check each row against its links and put your initials and the date in
**Owner checked**.

| Era / slot | Removed | Why | Replacement | Robust G1 of the replacement (Eras build, rules-only overlay) |
|---|---|---|---|---|
| 10 / #1 | `monaco-2022` | Fails G1 (8.44 s, wet Monaco pace) | `bahrain-2023` | pass, 1.19 s (non-Eras build: fail, 2.87 s) |
| 9 / #2 | `spain-2021` | Fails G1 (7.69 s, race mechanics) | `styria-2021` | pass, 0.63 s (non-Eras build: pass, 0.67 s) |
| 9 / #9 | `saudi-arabia-2021` | Fails G1 (8.57 s, two red-flag restarts) | `great-britain-2021` | pass, 1.34 s (new race) |

The removed races' G1 numbers are from `docs/eras-races-report.md`. The replacements are not
authored yet (no `eras` block): side (`pipeline hard-calls`), target, storyline, mastery,
hidden objective and briefing come in B1. The proposals below are drafts.

**Wording check needed:** the great-britain-2021 sources were all read through a fetch tool
that summarises pages, so its quoted wording (and any number in it) must be checked against
the pages themselves.

## bahrain-2023 (2023 Bahrain Grand Prix)

### Sources

| Short name | What |
|---|---|
| WP | [English Wikipedia race article](https://en.wikipedia.org/wiki/2023_Bahrain_Grand_Prix) |
| MS | [Motor Sport race report (Chris Medland)](https://www.motorsportmagazine.com/articles/single-seaters/f1/alonso-joy-amid-brutal-truth-of-verstappens-2023-bahrain-gp-win-race-report/) |
| AS | [Autosport race report](https://www.autosport.com/f1/news/f1-bahrain-gp-verstappen-leads-red-bull-1-2-alonso-third/10440169/) |
| GPE | [GrandPrix.com race notes](https://www.grandprix.com/races/bahrain-gp-2023-race-notes.html) |
| Jolpica-R | [Jolpica results](https://api.jolpi.ca/ergast/f1/2023/1/results.json) |
| Jolpica-P | [Jolpica pit stops](https://api.jolpi.ca/ergast/f1/2023/1/pitstops.json?limit=100) |
| OpenF1-S | [OpenF1 stints, session 7953](https://api.openf1.org/v1/stints?session_key=7953) |
| OpenF1-RC | [OpenF1 race control, session 7953](https://api.openf1.org/v1/race_control?session_key=7953) (and `&category=SafetyCar`) |

### Facts

| Topic | Fact | Sources | Owner checked |
|---|---|---|---|
| Grid | Verstappen pole, Pérez 2nd, Leclerc 3rd, Sainz 4th, Alonso 5th, Russell 6th; Hamilton 7th, Stroll 8th. No grid penalties for the front-runners. Leclerc skipped a final Q3 run to save a set of softs. | WP, Jolpica-R, MS | |
| Laps | 57 laps, 308.238 km. | WP, AS | |
| Weather | "Clear" (WP); dry. Air/track temperatures: not in sources. | WP | |
| SC / VSC / red flag | No safety car, no red flag. One VSC for Leclerc's car: deployed lap 41, ending lap 42 (race-control lap counter). | OpenF1-RC, WP, GPE | |
| Start / lap 1 | 19 of 20 started on softs (Magnussen on hards). Pérez got away slowly and Leclerc took 2nd. Hamilton passed Alonso into Turn 4; Stroll then hit Alonso's right rear, and Alonso lost a place to Russell too. Stewards: Turn 4 incident STR/ALO reviewed, no further investigation (logged lap 3-5). | AS, MS, GPE, OpenF1-RC | |
| Stops: Verstappen | Soft (used) laps 1-14, soft (new) 15-36, hard 37-57. In-laps 14 and 36. | OpenF1-S, Jolpica-P | |
| Stops: Pérez | Soft 1-17, soft (used, age 2) 18-34, hard 35-57. In-laps 17 and 34. | OpenF1-S, Jolpica-P | |
| Stops: Leclerc | Soft (new) 1-13, hard 14-33, hard 34-39. In-laps 13 and 33. First front-runner onto hards (lap 13). | OpenF1-S, Jolpica-P, AS | |
| Stops: Sainz | Soft 1-13, hard 14-31, hard 32-57. In-laps 13 and 31; double-stacked with Leclerc at the first stop ("smart double-stack", MS). Sainz worried his second set of hards would not last to the flag (AS). | OpenF1-S, Jolpica-P, MS, AS | |
| Stops: Alonso | Soft 1-14, hard 15-34, hard 35-57. In-laps 14 and 34. Ran a longer first stint and stopped later the second time than the cars around him (AS). | OpenF1-S, Jolpica-P, AS | |
| Stops: others | Hamilton in-laps 12, 30 (S-H-H; pitted early to cover an undercut, AS). Russell 13, 31 (S-H-H). Stroll 15, 30 (S-H-H; second-stop undercut got him past Russell, AS/MS). | OpenF1-S, Jolpica-P, AS, MS | |
| Stop-lap note | GPE's lap-by-lap labels stops one lap later than Jolpica/OpenF1 (e.g. Verstappen "lap 15" and "lap 37"). Jolpica/OpenF1 in-laps taken. | GPE vs Jolpica-P | |
| Strategy shape | Red Bull was the only front-running team to use softs for both of the first two stints; the others went soft-hard-hard. GPE says teams were expected to run soft-hard-hard and Red Bull soft-medium-hard (it ran soft-soft-hard in the race, OpenF1-S). | WP, MS, GPE, OpenF1-S | |
| Pérez vs Leclerc | Pérez passed Leclerc for 2nd at Turn 1 with DRS on lap 26. | AS, WP | |
| Leclerc retirement | Lost power suddenly while running 3rd (GPE) and retired; Ferrari said it had lost the engine (AS). **Lap conflicts:** 39 laps completed (Jolpica-R, OpenF1-S stint end 39, WP table); "lap 40" (AS); "lap 41" (WP prose, GPE). | Jolpica-R, OpenF1-S, AS, WP, GPE | |
| Alonso's passes | Russell lap 13 (WP, GPE); Bottas lap 17 (GPE); Hamilton tried into Turn 4 on lap 37, was re-passed, made it at Turn 10 the next lap (WP, GPE); Sainz for 3rd with DRS, lap 45 (WP, AS) / lap 46 (GPE), after a light contact with Sainz at Turn 4 on that lap (AS). | WP, GPE, AS | |
| Other retirements / penalties | Piastri out (electrical / gearshift problem, after 13 laps). Ocon withdrew after three penalties (grid position 5 s; 10 s for not serving it properly; 5 s pit-lane speeding). Hülkenberg 15 s for track limits. No front-runner penalties. | WP, MS, AS | |
| Result | Verstappen 1:33:56.736; Pérez +11.987; Alonso +38.637; Sainz +48.052; Hamilton +50.977; Stroll +54.502; Russell +55.873. (GPE's gaps for Alonso and Russell disagree and look garbled; Jolpica/WP/AS taken.) | Jolpica-R, WP, AS | |

### Proposal (draft, for the owner)

| Item | Draft | Owner checked |
|---|---|---|
| Storyline drivers | Alonso (Aston Martin) and Sainz (Ferrari): the fight for the last podium place. | |
| Dilemma (original wording) | Ferrari put its cars on hards at lap 13; Aston Martin can stretch Alonso's softs and hold his last stop back to catch Sainz late on fresher tyres. | |
| Suggested side | Alonso (pending `pipeline hard-calls`; Sainz is the other candidate: early first stop, second stop on lap 31 with worries about the hards lasting). | |
| Target (draft) | position: Alonso on the podium (P3). Alternative: beat-rival Sainz. | |
| Side really won? | Yes: Alonso finished 3rd, ahead of Sainz. No "rewrite" in the history book. | |
| Modelling risk | **Low.** Dry, no red flag, no SC restart; one short VSC (laps 41-42) right after Leclerc's retirement, which does not decide the order. Bahrain is not a no-overtaking track. Points to watch: Leclerc's lap-39/41 engine failure must be a storyline retirement (it hands Alonso a place); start contact from Stroll on Alonso (light, no sourced damage); light Alonso/Sainz touch before the lap-45 pass. No team orders sourced. No last-lap pass. | |

### Not in sources

- Air and track temperatures.
- Any sourced damage to Alonso's car from Stroll's hit.
- Gaps between Alonso and Sainz before the final stops.

### Authored (B1, Nov 9)

Built with `user_side` SAI / `rival` ALO (`build.py`); takeover lap 10 (D3 rule). Robust G1
after the change: pass, 1.22 s. Reachability: era and Legend reachable, stay-out never ★3.

| Item | As authored | Basis | Owner checked |
|---|---|---|---|
| Side | **Sainz.** `pipeline hard-calls`: SAI 2, ALO 1 (chance given up SAI 15.7 pts, ALO 0.0). The draft above suggested Alonso; the counter puts the player in the Ferrari. | hard-call counter | |
| Target | `beat-rival` ALO. `position: 3` was tried first: the grader gives Sainz at most ~3% at any call, so it was dropped. | author output | |
| Rewrite | Yes, `beat-rival` ALO: Sainz really finished 4th, 9.4 s behind Alonso (48.052 − 38.637). Headline (original): "Sainz holds Alonso off in Bahrain". | Jolpica-R, WP, AS | |
| Storyline text | Verstappen wins from pole, Pérez second; Leclerc's engine fails while he runs third; Alonso, on a later second stop, passes Sainz for the last podium place; Sainz 4th, 9.4 s behind. | Facts rows above (Grid, Result, Leclerc retirement, Stops: Alonso, Alonso's passes) | |
| Briefing | Verstappen leads from pole, Leclerc second; Sainz fourth after ten laps; Alonso seventh after Stroll hit him on lap 1. Positions after ten laps are from the race model's takeover state (timing data). | Grid, Start / lap 1 rows; model | |
| Mastery | `stop_count` exact 3, "Beat Alonso on three stops" (a counterfactual: the best era/Legend paths take a third stop under the lap-41 VSC; with exactly two stops no clean path reached ★3 at era difficulty). | reachability | |
| Hidden | `mode_rule` push, maxLaps 0: "Beat Alonso without a single push lap". | — | |
| storylineEvents | `[41, "RETIREMENT"]` (Leclerc, so the place he hands over is always there) and `[41, "VSC"]` (the VSC for his car, laps 41-42, kept in Legend too). | SC / VSC and Leclerc retirement rows | |
| Moments | stop-13, cliff-21, stop-31, vsc-41 (`pnpm --filter @laststint/sim author bahrain-2023 --target beat-rival --eras --write`). | author output | |

### B2 re-author (Nov 10 2026)

Eras job B2, on `eras-integrate-fixes` (35975b7: Expert rival grader fix and player stint-pace
fix in). With both fixes, Legend was not reachable: best seed 1 earned ★2 ★3 and the hidden
objective at accuracy 100 but not ★1 (beat Alonso). The era level stayed reachable. Measured on
this branch (scratch playouts, not committed):

- Legend (Expert rival, threshold 90), exhaustive search on seed 2: only 7 paths are clean (no
  orange or red call), and none of them finishes ahead of Alonso. In playouts of 24 paths that
  box for mediums at lap 13, Sainz finishes behind Alonso on almost every seed (up to 50 s); the
  four playouts that beat him (seed 1: stay out on lap 31; seed 2: box for hards on lap 31) all
  take a call graded red at Legend. In the model Alonso is
  about 0.24 s a lap faster (base pace), so beating him is out of reach at Legend.
- Change: **target** `beat-rival` ALO -> `position` 4, Sainz's real result (as malaysia-2013 and
  spain-2016 went to their real P2). **Rewrite** stays `beat-rival` ALO and the headline is
  unchanged, so beating Alonso is still the history-book rewrite.
- **Mastery** unchanged (`stop_count` exact 3); label now "Finish fourth or better on three
  stops". **Hidden** unchanged (no push lap); label now "Finish fourth or better without a single
  push lap".
- **Briefing:** last sentence "Finish ahead of Alonso." -> "Bring the car home no lower than
  fourth, and beat Alonso to rewrite the day." The rest is unchanged.
- **hardCalls** re-run (`pipeline hard-calls bahrain-2023`): now SAI 2, ALO 2 (was SAI 2, ALO
  1); chance given up SAI 13.7 pts, ALO 0.0, so the side stays **Sainz** (by gave-up, the
  counter's tie-break).
- **Moments** re-authored on P4 (`pnpm --filter @laststint/sim author bahrain-2023 --eras
  --target position:4 --write`): the same four moments and options (stop-13, cliff-21, stop-31,
  vsc-41) and real options; only each moment's grading target changed (`position`, atBest 4).
- Reachability (scratch race file with the new overlay and moments): **pass**. Era and Legend
  seed 1: box-medium, stay, box-medium, box-medium (★1 ★2 ★3 hidden, accuracy 100; exhaustive
  search). Stay-out never earns ★3 (no star at Legend, ★2 only at era).
- Robust G1: **pass** (strict pass), mean gap error 1.22 s.
- The integrator must rebuild `data/races/bahrain-2023.json` so it carries the new overlay and
  moments (`test_a_non_pool_race_file_carries_its_overlay[bahrain-2023]` fails until then).

| Item | As re-authored | Basis | Owner checked |
|---|---|---|---|
| Target | `position` 4: Sainz's real finishing place | Result row (Sainz 4th, +48.052) | |
| Rewrite | unchanged: `beat-rival` ALO, "Sainz holds Alonso off in Bahrain" | Result row | |
| Mastery label | "Finish fourth or better on three stops" (counterfactual; Sainz really stopped twice) | Stops: Sainz row | |
| Hidden label | "Finish fourth or better without a single push lap" | game's choice | |
| Briefing | "... Bring the car home no lower than fourth, and beat Alonso to rewrite the day." | game advice, not a fact | |
| Side | Sainz (hard calls SAI 2, ALO 2; gave-up SAI 13.7, ALO 0.0) | hard-call counter | |

## styria-2021 (2021 Styrian Grand Prix)

### Sources

| Short name | What |
|---|---|
| WP | [English Wikipedia race article](https://en.wikipedia.org/wiki/2021_Styrian_Grand_Prix) (first ~100k characters read) |
| MS | [Motor Sport race report](https://www.motorsportmagazine.com/articles/single-seaters/f1/a-red-bull-win-from-mercedes-playbook-2021-styrian-grand-prix-report/) |
| MS-H | [Motor Sport analysis, "Sharper Red Bull bares teeth in Styria"](https://www.motorsportmagazine.com/articles/single-seaters/f1/sharper-red-bull-bares-teeth-in-styria-as-mercedes-cuts-begin-to-tell/) |
| AS | [Autosport race report](https://www.autosport.com/f1/news/styrian-gp-verstappen-dominates-to-beat-hamilton-to-victory/6615156/) |
| GPE | [GrandPrix.com race notes](https://www.grandprix.com/races/steiermark-gp-2021-race-notes.html) |
| Jolpica | [results](https://api.jolpi.ca/ergast/f1/2021/8/results.json), [pit stops](https://api.jolpi.ca/ergast/f1/2021/8/pitstops.json?limit=100) (round 8) |
| OpenF1 | Not available: the sessions query for 2021 Austria returned 404 (OpenF1 has no 2021 data), so track status could not be cross-checked there |

### Facts

| Topic | Fact | Sources | Owner checked |
|---|---|---|---|
| Grid | Qualifying: Verstappen pole (1:03.841), Bottas 2nd, Hamilton 3rd, Norris 4th, Pérez 5th, Gasly 6th. Grid: Verstappen, Hamilton, Norris, Pérez, Bottas, Gasly. | WP; Jolpica (grid VER 1, HAM 2, NOR 3, PER 4, BOT 5) | |
| Grid penalties | Bottas 3 places for dangerous driving in the pit lane (spin) in FP2. Tsunoda 3 places for impeding Bottas in qualifying (8th → 11th). | WP, GPE | |
| Laps | 71 laps, 306.452 km. | WP, Jolpica | |
| Weather | Dry. WP: partly cloudy, 25-29 °C air; light rain late did not affect the race. GPE: 40% rain chance before the race; "a few drops" reported on lap 69. AS: clouded over in the last 10 laps but rain stayed away. | WP, GPE, AS | |
| SC / VSC / red flag | None mentioned in any source read (WP, MS, AS, GPE). Not confirmable via OpenF1 (no 2021 data). | WP, MS, AS, GPE | |
| Start compounds | Verstappen, Hamilton, Bottas on mediums (WP, MS-H, AS for Bottas). Pérez on softs (AS, MS-H). Räikkönen the only starter on hards (WP). | WP, MS-H, AS | |
| Verstappen stops | One stop, mediums → hards, one lap after Hamilton. Jolpica: lap 29. AS: "around lap 29". GPE: lap 30. | Jolpica, AS, GPE | |
| Hamilton stops | Stop 1 mediums → hards: Jolpica lap 28, AS end of lap 28, GPE lap 29. Stop 2 for softs to take fastest lap: Jolpica lap 69, GPE lap 70, AS "two laps to go". Gap to Verstappen when he came in: "just over 15s" (AS) / 17 s (MS-H). He kept 2nd. | Jolpica, AS, GPE, MS-H | |
| Bottas stops | One stop, mediums → hards: Jolpica lap 27, AS end of lap 27. Came out ahead of Pérez. | Jolpica, AS, WP | |
| Pérez stops | Stop 1 softs → hards: Jolpica lap 26, AS end of lap 26 (GPE lap 27); slow left-rear, nearly five seconds in the box (MS), dropping him behind Bottas. Stop 2 for mediums: Jolpica lap 54, WP end of lap 54, AS and GPE lap 55. | Jolpica, AS, MS, WP, GPE | |
| Norris stops | One stop: Jolpica lap 31. Compound not in sources read. | Jolpica | |
| Gaps in race | End of lap 1 VER +0.9 s; lap 15 over 3 s; before stops nearly 6 s; after stops 4.4 s; lap 34 4.0 s; end of lap 46 nearly 6 s, Bottas nearly 30 s back (AS). MS-H: Verstappen "out to 4sec or so" then managed. Hamilton was never close enough to apply undercut pressure; Pérez was in the way of an early Hamilton stop (MS-H). Long-run deficit about a quarter of a second per lap (Hamilton, quoted in MS). | AS, MS, MS-H | |
| One-stop vs two-stop | MS-H: conservative tyre choice made a one-stop the optimum; almost the whole field one-stopped on hards (MS). No source read says Mercedes considered a different strategy for Hamilton. | MS, MS-H | |
| Result | 1 Verstappen 1:22:18.925; 2 Hamilton +35.743 s (fastest lap 1:07.058, lap 71); 3 Bottas +46.907 s; 4 Pérez +47.434 s; 5 Norris +1 lap; 6 Sainz +1 lap. Verstappen led every lap (WP). | Jolpica, WP, AS | |
| Bottas vs Pérez finish | Pérez needed to close a near-20 s gap on his mediums (AS), was 1.5 s behind starting the last lap and 0.5 s behind at the flag (MS); no pass. | AS, MS | |
| Retirements | Gasly (grid 6): lap 1, Leclerc hit him, left-rear puncture / suspension damage, out after 1 lap (WP, AS, Jolpica "Collision"). Russell: power unit, 36 laps per Jolpica (AS and GPE text say lap 39). No front-runner (VER, HAM, BOT, PER) retired. | WP, AS, GPE, Jolpica | |
| Contact / damage | Leclerc-Gasly lap 1: Leclerc changed front wing and fitted hards at end of lap 1, recovered to 7th. Ricciardo lost power on lap 7 (WP). Verstappen reported a brake pedal problem late on, attributed to kerbs at Turn 9/10 (AS, WP); it did not cost him. Hamilton front-right blistering in the closing stages (WP, AS, GPE). | WP, AS, GPE | |
| Race penalties | None for front-runners in sources read (GPE: Hamilton warned about track limits). | AS, GPE | |
| Title context | Not established in the sources read (championship standings before/after not fetched). WP quotes Horner calling it Red Bull's most dominant win of the year against Mercedes. | WP | |

### Proposal (draft)

| Item | Draft | Owner checked |
|---|---|---|
| Storyline drivers | Verstappen and Hamilton | |
| Dilemma (spec §4) | Hamilton sits four seconds behind on wilting mediums with Pérez in his pit window: pit early to force Red Bull's hand, stretch the stint, or gamble on a second stop? | |
| Suggested side | Hamilton (two stops, the debatable calls). Hard-call counter must confirm; Pérez (two stops, missed P3 by 0.5 s) may score higher. | |
| Target (draft) | win: Hamilton beats Verstappen (rewrite allowed: Hamilton finished 2nd). Fallback if unreachable: Pérez `beat-rival` Bottas for the podium (rewrite allowed: he finished 0.5 s short). | |
| Side really won? | No. Hamilton 2nd (+35.743 s); Pérez 4th. A rewrite is allowed for either. | |
| Modelling risk | Low for the model: dry, no SC/VSC/red flag, no team orders, no front-runner damage, no last-lap pass. Medium for the game: the real gap was 35.7 s with a ~0.25 s/lap pace deficit, so a Hamilton win may be unreachable and the dilemma is thin (sources call it an optimum one-stop). Watch: Pérez's ~5 s slow stop, the lap-1 Gasly contact (grid 6), the 0.5 s Bottas-Pérez finish, and the short (~64-68 s) lap with lapped traffic. | |

### Not in sources

- Exact lap of Verstappen's brake issue; compounds of Norris's stop; title standings before/after
  the race; any Mercedes discussion of an alternative (two-stop) plan; OpenF1 track status.

### Authored (B1, Nov 9)

Side picked by `pipeline hard-calls styria-2021` (Eras build): **VER 2, HAM 0** (chance given up:
HAM 34.0 pts, VER 0.0), so the player runs **Verstappen**, not the draft's Hamilton. Verstappen
really won, so there is no rewrite (no `rewriteCondition` / headline). No SC, VSC or red flag in
any source, so no `storylineEvents`. Moments (`author --target win --eras`): lap 28 (Hamilton's
stop) and lap 35 (tyre cliff); takeover lap 25.

| Item | Authored text / value | Facts used (rows above) | Owner checked |
|---|---|---|---|
| Target | `win` | Result: Verstappen 1st | |
| Storyline (real) | "Verstappen starts from pole on mediums, makes his only stop for hards a lap after Hamilton, leads every lap and wins by 35.7 s." | Grid; Start compounds; Verstappen stops (one stop, a lap after Hamilton); Result (+35.743 s, led every lap) | |
| Mastery | `stop_count` exact 1, "Win on one stop" | Verstappen stops (one stop) | |
| Hidden | `margin` 10 s, "Win by more than 10 seconds" (game goal; real margin 35.7 s included Hamilton's late second stop) | Result; Hamilton stops | |
| Briefing | "Red Bull Ring, 2021. Verstappen starts from pole on mediums with Hamilton alongside. You run him, nearly six seconds clear as the stops come. Mercedes can bring Hamilton in first. Win it." | Grid (VER 1, HAM 2); Start compounds; Gaps ("before stops nearly 6 s", AS); Hamilton stop 1 a lap before Verstappen's | |
| Reachability | Era (threshold 72, standard rival) and Legend (90, expert): reachable; stay-out never earns 3 stars. | `pnpm --filter @laststint/sim reachability styria-2021` | |

**Thin dilemma:** at lap 28 every option keeps a 92-98% win chance; at lap 35 a wrong stop
costs (box hard now 59%, box soft 75%, box hard next lap 70%; stay or box medium 96%). The
sources call a one-stop the optimum. The challenge sits in the hidden margin goal, not in the main target.

## great-britain-2021 (2021 British Grand Prix)

### Sources

| Short name | What |
|---|---|
| WP | English Wikipedia race article: https://en.wikipedia.org/wiki/2021_British_Grand_Prix |
| MS | Motor Sport lap-by-lap report: https://www.motorsportmagazine.com/articles/single-seaters/f1/hamilton-claws-his-way-back-to-silverstone-win-after-verstappen-crash-2021-british-gp-lap-by-lap-report/ |
| AS | Autosport race report: https://www.autosport.com/f1/news/f1-british-gp-hamilton-wins-despite-penalty-for-verstappen-crash/6633130/ |
| AS-RF | Autosport red-flag news story: https://www.autosport.com/f1/news/british-gp-red-flagged-after-hamilton-and-verstappen-clash/6633015/ |
| GPE-N | GrandPrix.com race notes: https://www.grandprix.com/races/british-gp-2021-race-notes.html |
| GPE-A | GrandPrix.com race analysis: https://www.grandprix.com/races/british-gp-2021-race-analysis.html |
| Jolpica-R | Jolpica results: https://api.jolpi.ca/ergast/f1/2021/10/results/ |
| Jolpica-P | Jolpica pit stops: https://api.jolpi.ca/ergast/f1/2021/10/pitstops/?limit=100 |

F1DB was not used. The Motor Sport main race report URL from search
(`.../hamilton-fights-back-for-famous-win-as-verstappen-hits-out-2021-british-gp-report/`) returned 404.
All pages were read through a fetch tool that summarises; check wording against the pages.

**Lap-numbering note.** Jolpica-P gives stop laps one lower than GPE-N and MS for most leaders
(Hamilton 27 vs 28, Leclerc 29 vs 30, Bottas 22 vs 23 (MS) / 21 (GPE-N), Norris 21 vs 22 (MS) /
21 (GPE-N)). AS and GPE-A agree with Jolpica (Hamilton lap 27, Leclerc lap 29). Jolpica's lap is
taken as the in-lap below; the others are recorded for the owner.

### Facts

| Topic | Fact | Sources | Owner checked |
|---|---|---|---|
| Grid set by | Friday qualifying (Hamilton fastest, 1:26.023) set the sprint grid; the 17-lap sprint set the race grid. Verstappen passed Hamilton at the sprint start and won it by 1.430 s. | WP | |
| Grid top 6 | 1 Verstappen, 2 Hamilton, 3 Bottas, 4 Leclerc, 5 Norris, 6 Ricciardo. | WP, Jolpica-R (VER grid 1, HAM 2, BOT 3, LEC 4, NOR 5, RIC 6) | |
| Grid penalties | Russell: three places for causing a collision with Sainz in the sprint (8th in sprint, 12th on the grid). Pérez: due to start at the back for power-unit elements, then started from the pit lane after a rear wing and suspension change in parc fermé. | WP; GPE-N (Pérez from pit lane on hards) | |
| Race laps | 52 laps, 306.198 km. | WP, Jolpica-R (winner 52 laps) | |
| Weather | Dry, clear. Ambient 29-31 °C, track 48-52 °C. | WP | |
| Start tyres | All on mediums except Pérez (hards, from the pit lane). | GPE-N | |
| Lap-1 contact | Hamilton and Verstappen touched at Copse on lap 1 (Hamilton's left front against Verstappen's right rear); Verstappen's right-rear tyre came off the rim and he hit the barrier at "at least 290 km/h". Verstappen out, classified 0 laps, "Collision". | WP, AS, Jolpica-R | |
| Hamilton damage | Not confirmed. A WP reference headline says Mercedes credited the red flag with saving Hamilton from retirement, but no article body read describes damage to his car. | WP (reference list only) | |
| Safety car | A safety car came out straight after the crash, before the red flag. Laps: not in sources. No VSC in any source read. | MS, AS, GPE-N | |
| Red flag | Shown for barrier repairs. Timing differs: "after the first lap was completed" (AS-RF), "after two laps" (GPE-N), "on lap 3" (MS). Duration: "approximately thirty minutes" (WP), "nearly half an hour" (AS), 36 minutes (GPE-A). Jolpica-P logs every runner's first stop on lap 2 with a ~34-minute duration, i.e. the red-flag stop. | WP, AS, AS-RF, MS, GPE-A, GPE-N, Jolpica-P | |
| Free tyre change | Drivers could change tyres under the red flag (GPE-N). Which compounds the leaders fitted for the restart: not in sources. | GPE-N | |
| Restart | Standing restart on lap 3 of 52 (AS); racing resumed at 15:42 local (GPE-N). Restart order: Leclerc, Hamilton, Bottas (GPE-N); GPE-A lists Leclerc, Hamilton, Norris, Bottas, Ricciardo, Sainz; MS lists Leclerc, Hamilton, Bottas, Norris, Ricciardo. Leclerc led by 1.2 s after the first restart lap (AS). | AS, GPE-N, GPE-A, MS | |
| Hamilton penalty | 10 s time penalty for the Verstappen collision ("predominantly, but not fully, at fault", WP), given after the restart. Served at his only racing stop. | WP, AS, MS, GPE-A | |
| Stops: Hamilton | One stop, lap 27 (Jolpica-P; AS, GPE-A) / lap 28 (GPE-N, MS), medium to hard. Stop with penalty took 14.2 s (GPE-A); Jolpica pit-lane time 40.266 s. Rejoined 5th, 35.1 s behind Leclerc (GPE-N); GPE-A says 4th behind Leclerc, Bottas, Norris. His mediums were blistering before the stop (MS). | Jolpica-P, AS, GPE-A, GPE-N, MS | |
| Stops: Leclerc | One stop, lap 29 (Jolpica-P, AS) / lap 30 (GPE-N, MS), to hards; kept the lead. AS calls it a one-stop "Plan B" strategy. First-stint compound after the restart: not in sources. | Jolpica-P, AS, GPE-N, MS | |
| Stops: Bottas | One stop, lap 22 (Jolpica-P) / 21 (GPE-N) / 23 (MS), to hards. His hards blistered badly on the long second stint (GPE-A). | Jolpica-P, GPE-N, MS, GPE-A | |
| Stops: Norris | One stop, lap 21 (Jolpica-P, GPE-N) / 22 (MS), to hards. Slow stop (WP, MS), which let Bottas past. AS's account of a slow right-rear change was unclear about which driver it meant. | Jolpica-P, GPE-N, MS, WP | |
| Pérez | Pit-lane start on hards; stops on laps 18, 38, 48 (Jolpica-P); the last, for new softs, was for the fastest-lap point (1:28.617, lap 50). | Jolpica-P, WP | |
| Leclerc engine | Power cuts / engine issue from around lap 15 (GPE-A), 17 (MS) or 20 (AS); managed with setting changes. | GPE-A, MS, AS | |
| Hamilton's chase | Passed Norris for 3rd on lap 31 (AS, GPE-A, MS). Team order: Mercedes told Bottas to let Hamilton by and he did, at Stowe, on lap 40 (MS, AS, GPE-A). Gap to Leclerc: 8.1 s on lap 40, 1.6 s on lap 48, under 1 s on lap 49 (GPE-N); 0.8 s entering lap 50 (MS). | AS, GPE-A, GPE-N, MS | |
| Winning pass | Lap 50 of 52, at Copse: Hamilton went down the inside and Leclerc ran wide. | WP, AS, GPE-N, MS | |
| Result top 6 | 1 Hamilton 1:58:23.284; 2 Leclerc +3.871; 3 Bottas +11.125; 4 Norris +28.573; 5 Ricciardo +42.624; 6 Sainz +43.454. | Jolpica-R, WP | |
| Retirements (front-runners) | Verstappen (lap 1 collision). Vettel retired after 40 laps (overheating, WP). | Jolpica-R, WP | |
| Title effect | Drivers' standings after the race: Verstappen 185, Hamilton 177 (gap cut to 8, GPE-N). Constructors: Red Bull 289, Mercedes 285. Standings before the race: not read. | WP, GPE-N | |

### Proposal (draft, for the owner)

| Item | Draft | Owner checked |
|---|---|---|
| Storyline drivers | Hamilton and Leclerc. Verstappen's crash is the title-fight backdrop (gap cut to 8 points), but he does no racing after lap 1. | |
| Dilemma (own words) | With a 10-second penalty to serve and blistering mediums, Hamilton must pick the lap to take his one stop and then run down a one-stopping Ferrari before the flag. | |
| Target (draft) | win: Hamilton, from 2nd on the restart grid, with a 10 s penalty to serve. | |
| Side really won? | Yes, Hamilton won, so no rewrite. (If the hard-call counter picks Leclerc, the target would be `defend`; he really lost, so a rewrite would apply.) | |
| Modelling risk | **High.** Red flag on lap 1-3 with a standing restart and a free tyre change (avoidable if the takeover lap is after the restart); a 10 s time penalty served at the stop that decides the strategy; a team order (Bottas, lap 40); the win comes from a pass on lap 50 of 52, final gap 3.871 s; Leclerc's intermittent engine problem; lap-1 contact (possible Hamilton damage unconfirmed). No rain. The SC was before the red flag, so no SC restart decides the result. | |

### Authoring (B1, Nov 9)

| Item | What was done | Owner checked |
|---|---|---|
| Red flag | `data/redflags/great-britain-2021.json`: flag lap 2, standing restart. The race's FastF1 timing has the red status ('5', session time 3938.8 s) inside the leader's (LEC) lap 2, and the cars enter the pit lane at the end of it. Sources' laps 1 / 2 / 3 are recorded in its `note` and in `r1-red-flags.md`. The file confirms what the timing already holds: the race file is byte-identical with and without it. Robust G1 after it: pass, 1.34 s; after the team order and the eras block: pass, 1.14 s. | |
| Takeover | Lap 24 (D3 rule), after the standing restart (lap 3/4). Order at the end of lap 24 (timing): LEC, HAM +2.4 s, SAI, BOT, NOR, ALO; LEC and HAM on 22-lap-old mediums. | |
| Side | `pipeline hard-calls`: HAM 0, LEC 0 (tie); chance given up HAM 10.3 pts, LEC 45.0, so **Leclerc**. Unlike south-africa-1983, nothing sourced stands against the Leclerc side (his engine problem was managed, not a retirement). **Owner: please confirm Leclerc.** | |
| Target | `defend` (win from the lead). Leclerc really finished 2nd, so a rewrite applies (`rewriteCondition: defend`). Draft headline is original. | |
| Mastery / hidden | Win on exactly one stop (the real plan was one stop) / win by more than 3 s (the real margin was -3.871 s). | |
| Team order | Bottas lets Hamilton by on lap 40 (`data/incidents.json` TEAM_ORDER, `m4-scripted-events.md`). Timing: HAM ahead of BOT from the end of lap 40. | |
| Penalty | Hamilton's 10 s is already in his stop: the race file's real stop (lap 28 in its numbering, Jolpica's in-lap 27) loses 33.1 s against the track's 19.4 s pit loss, so no extra event. | |
| storylineEvents | None. The only post-takeover events are the team order and Vettel's lap-41 retirement, neither part of the story. | |
| Moments | The author tool (`--target win --eras`) picked `stop-29` + three pace calls, but its "stay out" at lap 29 cancels Leclerc's only real stop: the grader then plays a legal planner stop (97%), while the race itself runs no stop (two-compound disqualification), so reachability failed. Hand-adjusted to the tool's own `rivalpit-27` candidate (the lap before Hamilton's stop) with honest options: stay out (the real plan: hards at the end of lap 29, Jolpica; lap 30 in the race file; graded 34-44%, red), box now on softs or hards, or box on lap 31 / lap 34 on softs (89-92%), then `pace-32`, `pace-36`, `pace-40` as authored. The soft options come from the model only; no source read says Ferrari considered softs. | |
| Reachability | Era (standard rival, threshold 72): reachable on seed 2 (box on lap 34 on softs). Legend (expert, 90): reachable on seed 3. Stay-out never earns 3 stars (no result star on any seed). | |

## Notes for the owner

- **Target counts** (spec §6) with the draft targets above: `win` 37 to 38 (styria-2021 and
  great-britain-2021 in, spain-2021 out), `defend` 28 to 27 (monaco-2022 out), `position` 19
  to 20 (bahrain-2023), `beat-rival` 9 to 8 (saudi-arabia-2021 out).
- **Waves** (build plan): bahrain-2023 and styria-2021 need no new model (wave A, 33 to 34);
  great-britain-2021 has a red flag (wave B, 67 to 66). Its red flag (laps 1-3) comes before
  the D3 takeover (lap 24), so the race file has no RED event and needs no
  `data/redflags/` file: FastF1's track status holds it.
- **Tracks:** bahrain-2023 is a copy of bahrain-2021 (`bahrain-1`), great-britain-2021 a copy
  of great-britain-2022 (`silverstone-8`); styria-2021's file was already in the repo
  (`2.5-track-maps.md`).
- **Incidents:** bahrain-2023 gets its lap-41 VSC (Leclerc); styria-2021 has none;
  great-britain-2021's lap-1 SC is in the 2.6 TODO list (its lap isn't in the sources read).
- **Raw data:** great-britain-2021 was ingested offline from the FastF1 cache
  (`data/raw/great-britain-2021.parquet`, `.status.json`).
- **Removed races:** their catalog rows, pools entries and `era_races` rows go. Unlike 0012's
  removed races, all three have race files that tests use as Eras-build fixtures (stint pace,
  wear shape, grader, rival policies), so their rules-only overlays (`data/eras/`), race,
  golden and raw files, build entries, tracks, red-flag files and incident entries stay.
  Deleting the overlays would turn them into non-Eras builds on the next rebuild and break
  those fixtures (tried: 87 sim tests and 2 pipeline fixture tests fail).
- **D1:** migration `0013_swap_eras_races_e10_e9.sql` renames the three `era_races` rows in
  place and deletes the removed races' `era_attempts`, `era_progress` and `history_entries`
  rows.

# R1 hand check: red flags

Simulator roadmap R1 (eras build plan 4.3). The facts behind each hand-entered red-flag file,
`data/redflags/<race-id>.json` (format: the docstring of `pipeline/src/pipeline/redflag.py`).
Every value comes from a source that was read, never from memory. Where sources disagree, the
file's `note` records both and says which was taken and why. Validated by
`pipeline/tests/test_redflag_facts.py`.

How to read the columns:
- **Flag lap (`lap`):** the leader's lap the red flag was shown on.
- **Stoppage lap (`resumeLap`):** the lap holding the stoppage. It's entered only for sources with
  no red-flag timing (TUM, Jolpica), and it comes from Jolpica's lap times: the leader's lap that
  took many times the race's median. Timed races (FastF1) take it from their own timing.
- **Restart:** standing, rolling (behind the SC), or none (the race was never resumed).
- **SC after (`restartScLaps`):** the race laps behind the SC after the stoppage lap.
- **Owner checked:** left blank for the owner to sign off.

A pattern in the timing: from about 2013 on, the cars go to the pit lane and usually cross the
timing line there, so the stoppage is the lap *after* the flag lap. In 2007-2011 they stopped on
the grid, so the flag lap holds the stoppage. Monaco 2022 is an exception, with both on lap 30.
Some press reports give the stoppage lap as "the red-flag lap", which is where most of the
conflicts below come from.

## Summary

| Race | # | Flag lap | Stoppage lap | Restart | SC after | Laps sched. / done | Main sources | Conflict? | Owner checked |
|---|---|---|---|---|---|---|---|---|---|
| monaco-2022 | 1 | 30 | 30 (Jolpica, 5.1) | rolling | 2 (31-32) | 77 / 64 (time limit) | [Autosport live](https://www.autosport.com/f1/live-text/f1-monaco-gp-live-commentary-and-updates-race-day-1114912/1114912/?p=2), [The Race](https://www.the-race.com/formula-1/massive-schumacher-crash-causes-another-monaco-gp-stoppage) | Scheduled 77 (The Race) vs 78 (Wikipedia) | |
| great-britain-2022 | 1 | 1 | 2 (Jolpica, 5.1) | standing, lap 3 | 0 | 52 / 52 | [Crash.net live](https://www.crash.net/f1/live/live-updates-f1-british-grand-prix-race-day-silverstone?page=3), [Autosport](https://www.autosport.com/f1/news/f1-british-gp-sainz-takes-maiden-win-in-dramatic-race-as-title-challengers-struggle/10332505/) | No | |
| azerbaijan-2021 | 1 | 48 | 49 (Jolpica, 5.1) | standing, lap 50 | 0 | 51 / 51 | [GrandPrix.com notes](https://www.grandprix.com/races/azerbaijan-gp-2021-race-notes.html), [Wikipedia](https://en.wikipedia.org/wiki/2021_Azerbaijan_Grand_Prix) | GrandPrix.com summary says 49 | |
| hungary-2021 | 1 | 2 | (timed; Jolpica 3) | standing, lap 4 | 0 | 70 / 70 | FastF1 timing (project cache), [Wikipedia list](https://en.wikipedia.org/wiki/List_of_red-flagged_Formula_One_races), [RaceFans](https://www.racefans.net/?p=458971), [Motor Sport](https://www.motorsportmagazine.com/articles/single-seaters/f1/esteban-ocon-dodges-chaotic-start-to-win-the-2021-hungarian-gp-as-it-happened/) | Autosport says lap 3 | |
| saudi-arabia-2021 | 1 | 13 | 14 (Jolpica, 5.1) | standing, lap 15 | 0 | 50 / 50 | [Wikipedia](https://en.wikipedia.org/wiki/2021_Saudi_Arabian_Grand_Prix), [Motor Sport lap by lap](https://motorsportmagazine.com/articles/single-seaters/f1/hamilton-emerges-from-chaos-to-win-2021-saudi-arabian-gp-lap-by-lap), [Speedcafe](https://speedcafe.com/second-red-flag-amid-championship-drama/) | RaceFans and Speedcafe say 14 (the stoppage lap) | |
| saudi-arabia-2021 | 2 | 15 | 16 (Jolpica, 5.1) | standing, lap 17 | 0 | | [Wikipedia list](https://en.wikipedia.org/wiki/List_of_red-flagged_Formula_One_races), [Wikipedia](https://en.wikipedia.org/wiki/2021_Saudi_Arabian_Grand_Prix), [Motor Sport](https://motorsportmagazine.com/articles/single-seaters/f1/hamilton-emerges-from-chaos-to-win-2021-saudi-arabian-gp-lap-by-lap) | Motor Sport says 16 | |
| italy-2020 | 1 | 26 | 27 (Jolpica, 5.1) | standing, lap 28 | 0 | 53 / 53 | [GrandPrix.com analysis](https://www.grandprix.com/races/italian-gp-2020-race-analysis.html), [Autosport](https://www.autosport.com/f1/news/151934/gasly-holds-off-sainz-to-win-topsyturvy-italian-gp), [Wikipedia](https://en.wikipedia.org/wiki/2020_Italian_Grand_Prix) | Wikipedia list says 27. **Check against the timing** | |
| azerbaijan-2017 | 1 | 22 | 23 | rolling | 0 | 51 / 51 | [Wikipedia](https://en.wikipedia.org/wiki/2017_Azerbaijan_Grand_Prix), [GTspirit](https://gtspirit.com/?p=205699), Jolpica | No | |
| monaco-2011 | 1 | 72 | 72 | rolling | 1 (73) | 78 / 78 | [Wikipedia](https://en.wikipedia.org/wiki/2011_Monaco_Grand_Prix), Jolpica | No | |
| canada-2011 | 1 | 25 | 25 | rolling | 9 (26-34) | 70 / 70 | [The Checkered Flag](https://www.thecheckeredflag.co.uk/2011/06/button-steals-last-minute-victory-in-an-epic-rain-interrupted-canadian-grand-prix/), [Autosport](https://www.autosport.com/f1/news/149951/is-buttonEURTMs-mostfamous-f1-win-overhyped), Jolpica | Wikipedia: "by lap 26", SC in "on lap 35" | |
| europe-2007 | 1 | 4 | 5 | rolling | 2 (6-7) | 60 / 60 | [GrandPrix.com notes](https://www.grandprix.com/races/european-gp-2007-race-notes-alonso-wins-wild-european-gp.html), [Wikipedia](https://en.wikipedia.org/wiki/2007_European_Grand_Prix), Jolpica | Wikipedia list: 5; race article: lap 3 | |
| brazil-2003 | 1 | 56 | n/a | none (results from lap 54) | n/a | 71 / 54 | [GrandPrix.com, FIA ruling](https://www.grandprix.com/news/the-fia-confirms-fisichella.html), [Wikipedia](https://en.wikipedia.org/wiki/2003_Brazilian_Grand_Prix) | No (the first result was taken from lap 53) | |
| belgium-1998 | 1 | 1 | n/a (start voided) | standing (full restart, 44 laps) | 2 (laps 1-2 of the restarted race) | 44 / 44 | [Wikipedia](https://en.wikipedia.org/wiki/1998_Belgian_Grand_Prix), [Autosport](https://www.autosport.com/f1/news/1998-belgian-gp-when-the-schumachers-went-to-war/10744117/) | "standing" is not stated in so many words | |
| monaco-1984 | 1 | 32 | n/a | none (results from lap 31) | n/a | 76 / 31 | [Wikipedia](https://en.wikipedia.org/wiki/1984_Monaco_Grand_Prix), [Autosport](https://www.autosport.com/f1/news/when-senna-and-bellof-starred-in-monaco-as-prost-prevailed/6530051/) | Wikipedia "end of" vs Autosport "halfway through" lap 32; the list's 31 is the results lap | |

netherlands-2023 has no file: OpenF1's race control gives its restart, and
nothing read here says it needs correcting.

## For the build (not facts, things to check)

- **Step 5.1 (Nov 7 2026): the 2020-22 races came from Jolpica, not FastF1.** FastF1 now needs
  an F1TV login, so monaco-2022, great-britain-2022, azerbaijan-2021, saudi-arabia-2021 and
  italy-2020 were built from the Jolpica dump, which has no red-flag timing. Each of their
  entries now has a `resumeLap` (the table's stoppage lap): the leader's first lap from the
  flag lap on that took over 3x the race's median lap (`redflag.stoppage_lap`), the same rule as
  the TUM races and the same laps these notes already read from Jolpica. Each entry's `source`
  ends with the lap time behind it, and the files' `timing` says Jolpica.
  `test_redflag_facts.py` checks every `resumeLap` against the committed snapshot. Only
  hungary-2021 is still timed (the project's FastF1 cache, `pipeline ingest --offline`). G1
  results: docs/g1-report.md, step 5.1 red-flag races.

- **Timed races (FastF1):** `annotate_restarts` refuses an entry whose `lap` matches no RED
  event in the timing. Only Hungary 2021 could be checked against FastF1 here (the project
  cache, `cache/2021/...`: the red status is on the leader's lap 2). For the other five, a build
  error naming the lap means the timing puts the flag one lap off. Italy 2020 (26 vs 27) is the
  most likely case.
- **Untimed races with no stoppage lap:** brazil-2003, monaco-1984 and belgium-1998 have no
  `resumeLap`. The Jolpica data has no red lap for them: the race ended at the results lap, or
  holds only the restarted race. **Rule now in the build** (`redflag.cut_at_results` /
  `race_entries`, step 5.1): a race ended under red (`"restart": "none"` with a `resultsLap`)
  has its laps after the results lap cut, so it ends there with the order at the end of that
  lap, and gets no RED event; a red flag in the first two laps before 2005, resumed, with no
  `resumeLap` is a voided start: a fresh race, no RED event, and its `restartScLaps` (none
  entered yet for belgium-1998, whose note says laps 1-2) would mark laps 1..n of the rerun
  as SC laps. Monaco 1984 has no Jolpica lap times at all.
- Extra fields beyond the documented format: top-level `scheduledLaps`, `completedLaps`,
  `timing`; per entry `note` and, for races never resumed, `resultsLap`. The loader ignores them.

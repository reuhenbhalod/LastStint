# Scout 4: Era 3 replacements for hungary-1998

Job `eras-scout4-era3`, Nov 10 2026. hungary-1998 leaves Era 3 because the Expert rival
grader fix and the player stint-pace fix make it unwinnable at Legend (owner, Nov 10). Every
fact below was read in the linked source; nothing comes from memory. Stop laps and lane times
are F1DB (`data/raw/f1db/<race>.stops.csv`); gaps are Jolpica. Check each row against its
link, then put your initials and the date in **Owner checked**.

## Robust G1 (one race per call, `pipeline validate <id> --robust`, Eras builds)

| Race | Status | Mean gap error | Failing checks (500-run detail) |
|---|---|---|---|
| canada-1996 | **pass** | 0.42 s | none |
| brazil-1999 | **pass** | 0.36 s | none |
| japan-1999 | **pass** | 4.09 s | none (FRE 8.10 / 9.86, SCH 7.71 / 9.95, IRV 4.79 / 5.00 are near their limits) |
| austria-1997 | fail | 1.56 s | podium order rate 0.38 (limit 0.50) |
| san-marino-1997 | fail | 2.14 s | duel FRE vs MSCM order rate 0.44 (0.60); podium order rate 0.44 (0.50) |
| france-1996 | fail | 3.93 s | duel VIL vs HIL gap 8.90 (3.00); podium VIL gap 8.90 (5.00) |
| argentina-1997 | fail | 3.99 s | field HAK gap 9.37 (5.00); field BER gap 13.69 (5.00); the estimated SC on laps 2-4 is unchecked |
| hungary-1999 | fail | 6.00 s | duel COU vs HAK gap 12.14 (3.00); podium COU gap 12.14 (5.00); field FRE gap 10.11 (5.00) |
| australia-1997 | fail | 1.20 s | podium order rate 0.48 (0.50); unchanged after the fix attempt below |

Only canada-1996, brazil-1999 and japan-1999 are registered and committed on this branch.

## Facts

| # | Race | Fact | Lap | Source | Note | Owner checked |
|---|---|---|---|---|---|---|
| 1 | canada-1996 | Hill had the lighter fuel load and planned to use the early laps to break away from Villeneuve | 1 | GP-CAN96 | | |
| 2 | canada-1996 | Hill said he knew Villeneuve was on a one-stop strategy and he had to get ahead at the start | 1 | GP-CAN96 | F1DB: HIL stops laps 28 and 50, VIL lap 36 | |
| 3 | canada-1996 | Hill led by nearly 11 s when he pitted on lap 28; Villeneuve then led for eight laps before his own stop | 28-36 | GP-CAN96 | | |
| 4 | canada-1996 | After his stop Villeneuve was 20 s behind Hill, out to half a minute before Hill's last stop; Hill came out of that stop with an 11 s lead | 36-50 | GP-CAN96 | | |
| 5 | canada-1996 | Villeneuve set the race's fastest lap on lap 67 of 69 and said he lost quite a bit of time behind Herbert; Hill won by 4.183 s | 67-69 | GP-CAN96, WP-CAN96 | No lap or number given for the Herbert hold-up; none entered | |
| 6 | brazil-1999 | Hakkinen's car had a temporary transmission problem on lap 4, and Barrichello and Schumacher passed him | 4 | WP-BRA99 | | |
| 7 | brazil-1999 | Schumacher led after Barrichello's lap-27 stop; Schumacher pitted on lap 38 and Hakkinen, held up behind him until then, pushed to make a gap | 27-38 | WP-BRA99 | F1DB: MSC lap 38 (32.552 s lane), HAK lap 42 (30.983 s) | |
| 8 | brazil-1999 | Hakkinen pitted on lap 42; his fast laps and a quick stop kept him ahead of Schumacher. Hakkinen won from Schumacher | 42-71 | WP-BRA99 | Timing: HAK by 4.925 s | |
| 9 | brazil-1999 | Frentzen was classified third despite running out of fuel on the final lap | 71 | WP-BRA99 | | |
| 10 | japan-1999 | Hakkinen beat Schumacher off the line and built a lead the Ferraris could not match; his win made him 1999 champion | 1 | WP-JPN99 | F1DB: HAK stops laps 19 and 38, MSC laps 22 and 37 | |
| 11 | japan-1999 | Coulthard spun into a wall on lap 34, pitted and rejoined a lap down just ahead of Schumacher, and retired later with a hydraulic failure | 34 | WP-JPN99 | Do not use the "deliberately held up" allegation as a fact | |
| 12 | australia-1997 | Williams two-stopped because of brake wear; Frentzen struggled with brakes from early on | - | GP-AUS97 | | |
| 13 | australia-1997 | Frentzen's lap-40 stop lost about six extra seconds to a right-rear tyre problem, letting Coulthard and Schumacher ahead | 40 | GP-AUS97, WP-AUS97 | Already in the race file: F1DB lane 30.845 s, the measured stop loss | |
| 14 | australia-1997 | Schumacher made a late splash-and-dash for fuel; Ferrari blamed a malfunction in the refuelling system | 51 (F1DB) | GP-AUS97 | Already in the race file as the real lap-52 stop (measured loss) | |
| 15 | australia-1997 | Frentzen's brake disc failed with three laps to go | 55 | GP-AUS97, WP-AUS97 | Already a RETIREMENT event | |

## australia-1997 fix attempt (30 minutes)

Failing check: podium order rate (COU, MSCM, HAK). The sim has Schumacher 2.7 s slower than
real (22.73 s vs 20.05 s behind Coulthard) and Hakkinen level with him (22.95 vs 22.18 s), so
second and third are a coin flip; the diagnosis is half pace, half race mechanics. In the
timing, Hakkinen lost about 10 s to Coulthard over laps 44-51 (93.9-94.2 s laps against
Schumacher's 91.8 s), which brings him close enough in the sim to beat Schumacher out of the
lap-51 splash. No source read gives a reason or number for that loss (Hakkinen only said he
never felt confident with the handling), and the sourced events (rows 13-15) are already in
the race file as measured stop losses and a retirement. `pace_skip` on those laps would make
Hakkinen faster, the wrong way, and no FAULT kind fits an unexplained slow spell. No change
went in.

## Sources

| Short name | Link |
|---|---|
| GP-CAN96 | https://www.grandprix.com/races/canadian-gp-1996.html |
| WP-CAN96 | https://en.wikipedia.org/wiki/1996_Canadian_Grand_Prix |
| WP-BRA99 | https://en.wikipedia.org/wiki/1999_Brazilian_Grand_Prix |
| WP-JPN99 | https://en.wikipedia.org/wiki/1999_Japanese_Grand_Prix |
| GP-AUS97 | https://www.grandprix.com/races/australian-gp-1997.html |
| WP-AUS97 | https://en.wikipedia.org/wiki/1997_Australian_Grand_Prix |

GrandPrix.com pages were read as HTML (curl); Wikipedia pages as their wikitext
(`action=raw`, curl).

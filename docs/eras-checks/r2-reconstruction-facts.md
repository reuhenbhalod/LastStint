# Checking the reconstruction facts (1983-1995)

The 23 Eras races from 1983 to 1995 have no lap timing. `pipeline reconstruct` rebuilds them
from anchors, and the pit stops before 1994 plus all safety cars come from a facts file a
person enters: `data/reconstruction/<race-id>.json` (format: `docs/reconstruction-facts.md`).
This pass entered every stop and safety car it could source. Check each race against its
links, then put your initials and the date in **Owner checked**.

## How to read this

- **Stops entered**: car number, driver, in-lap. Everything in a race file was read in the
  linked source; nothing comes from memory. Some in-laps are worked out from the source's wording
  rather than quoted, and their notes give the wording: great-britain-1987 Mansell 35 ("added
  20 seconds to lap 36"), mexico-1990 Piquet 44 ("two laps later" than lap 42), and the six
  france-1990 stops, marked **derived** (from Motor Sport's order of the stops and Wikipedia's
  lap-leader chart).
- **Lane times**: no source read gives pit-lane times for these races, so every `laneTime` is
  `null` and the reconstruction uses its default. Where a source gives a **stationary** time
  (wheels-off to wheels-on), it is in the stop's `note`. Stationary time is not lane time.
- **`complete.stops`** is `false` everywhere. The reports cover the front-runners' stops at
  best, never the whole field.
- **`complete.safetyCars`** is `true` before 1993 (the loader allows none). From 1993 it is
  `true` only for brazil-1993 and belgium-1995, where a lap-by-lap report covers the whole
  race. For europe-1993, australia-1993, spain-1994 and australia-1994 no source mentions a
  safety car, but none says there wasn't one, so they are left `false` for you to decide.
- **1994-95**: F1DB supplies every stop (`data/raw/f1db/<race-id>.stops.csv`) and the loader
  ignores facts-file stops, so those files carry only safety cars and notes.
- Extra keys (`name`, `note`) are for the checker; the loader ignores them.
- The format has no field for retirement causes. Causes found while reading are listed below
  (Jolpica already supplies retirement laps and statuses).

## Sources

| Short name | What |
|---|---|
| MS | Motor Sport magazine archive race report (motorsportmagazine.com/archive), linked per race |
| AS | Autosport's archive report (autosport.com 'Grand Prix Gold'), linked per race |
| GPE | GrandPrix.com Grand Prix Encyclopedia race report (grandprix.com/gpe/rrNNN.html) |
| WP | English Wikipedia race article |

## Per race

| Race | Stops entered (car, driver, in-lap) | Safety cars | Missing / doubts | Owner checked |
|---|---|---|---|---|
| south-africa-1983 | #5 Piquet 28 ([GPE](https://www.grandprix.com/gpe/rr388.html), [historyracingpedia](https://www.historyracingpedia.com/stories/nl/f1-1983-south-africa-titledecider-piquet-prost.html)) | n/a | Patrese (#6), Lauda (#8), Tambay (#27) refuelling stops are described in [MS](https://www.motorsportmagazine.com/archive/article/november-1983/66/south-african-grand-prix-9/) with no laps. The Brabham pre-race plan (laps 27, 46) is a plan, not entered. | |
| monaco-1984 | none | n/a | Laffite (#5) tyre stop, no lap ([MS](https://www.motorsportmagazine.com/archive/article/july-1984/84/reflections-in-the-monte-carlo-puddles/)). No leader stopped; no source says so outright. | |
| portugal-1984 | none | n/a | Johansson (#20) nose stop and Warwick (#16) tyre stop, no laps ([MS](https://www.motorsportmagazine.com/archive/article/november-1984/76/another-mclaren-double/)). Retirement: Mansell, brake failure, spins on laps 51-52 ([GPE](https://www.grandprix.com/gpe/rr404.html), [WP](https://en.wikipedia.org/wiki/1984_Portuguese_Grand_Prix)). | |
| germany-1986 | #20 Berger 5 (repair, two laps lost); #6 Piquet 15, 27; #5 Mansell 17; #2 Rosberg 19; #1 Prost 20; #12 Senna 21 ([AS](https://www.autosport.com/f1/feature/3783/grand-prix-gold-german-gp-1986), [MS](https://www.motorsportmagazine.com/archive/article/september-1986/35/formula-one-german-grand-prix-2), [WP](https://en.wikipedia.org/wiki/1986_German_Grand_Prix) lap-leader chart) | n/a | MS puts Piquet's stops on laps 16 and 28; Autosport says lap 15 and the end of lap 27, and WP's chart (Rosberg leads from 15 and from 27) agrees with Autosport, so 15 and 27 are entered. Berger's second tyre stop, Tambay's (#16) early stop (lost wheel weights) and Brundle's (#3) black-box stop: no laps. Storyline is fuel (195 L): Rosberg and Prost ran minimum boost and both ran dry on the last lap, Rosberg second at the start of it, Prost fourth (AS, MS); both classified a lap down (Jolpica). | |
| portugal-1985 | none | n/a | Piquet (#7) "pitted repeatedly around lap 25" then retired with a tyre problem ([WP](https://en.wikipedia.org/wiki/1985_Portuguese_Grand_Prix)): not precise enough to enter. Race cut to 67 laps on the 2-hour limit. | |
| mexico-1986 | none | n/a | Berger (#20) no stop ([WP](https://en.wikipedia.org/wiki/1986_Mexican_Grand_Prix), [MS](https://www.motorsportmagazine.com/archive/article/december-1986/15/formula-one-mexican-grand-prix-australian-grand-prix), [GPE](https://www.grandprix.com/gpe/rr435.html)). Piquet 3 stops, Mansell 2, Prost 1 (MS): **no laps, storyline gap**. | |
| hungary-1986 | #6 Piquet 35; #12 Senna 48; #5 Mansell 28, 46; #1 Prost 16 (long repair); #2 Rosberg 16 (drive-through), 17; #28 Johansson 21 (7.34 s stationary) ([MS](https://www.motorsportmagazine.com/archive/article/september-1986/61/formula-one-hungarian-grand-prix-2/)) | n/a | Rosberg's later stop, Johansson's other stop, the midfield. Prost's lap-16 stop lasted about 8 laps, so the default lane time is far too short. Rosberg retired end of lap 35 with broken rear suspension; Prost with suspension damage after Arnoux contact (MS). | |
| australia-1986 | #1 Prost 32 ([MS Dec 1986](https://www.motorsportmagazine.com/archive/article/december-1986/15/formula-one-mexican-grand-prix-australian-grand-prix), [MS Jul 2004](https://www.motorsportmagazine.com/archive/article/july-2004/142/race-86-australian-gp/)) | n/a | **Piquet's precautionary stop, after Mansell's lap-64 failure: no source read gives the lap. Storyline gap.** Retirements: Rosberg lap 63 (tyre delaminated), Mansell lap 64 (left-rear tyre exploded) (MS, WP). | |
| great-britain-1987 | #5 Mansell 35 ([MS](https://www.motorsportmagazine.com/archive/article/august-1987/57/sunrise-over-silverstone), [WP](https://en.wikipedia.org/wiki/1987_British_Grand_Prix)) | n/a | MS: "This added only 20 seconds to lap 36", with the timing line at the start of the pit lane, so the in-lap is 35. Piquet (#6) non-stop. Prost (#1) tyre stop, no lap; retired with clutch failure (MS). | |
| monaco-1988 | none | n/a | Patrese (#6) repair stop after the lap-51 Alliot collision, in-lap not given ([MS](https://www.motorsportmagazine.com/archive/article/june-1988/22/a-minute-error-of-judgement), [WP](https://en.wikipedia.org/wiki/1988_Monaco_Grand_Prix)). Senna crashed at Portier on lap 67 (WP). | |
| france-1990 | #20 Piquet 20; #1 Prost 27; #28 Berger 28; #27 Senna 30; #2 Mansell 32; #6 Patrese 33, all **derived** ([MS](https://www.motorsportmagazine.com/archive/article/august-1990/16/a-touch-of-the-sun/), [WP](https://en.wikipedia.org/wiki/1990_French_Grand_Prix) lap-leader chart, [GPE](https://www.grandprix.com/gpe/rr491.html)) | n/a | MS: Piquet in 'as the front half of the field started lap 21', Prost 'at the start of lap 28', then Berger, Senna (after two laps leading), Mansell, Patrese (after one lap leading); WP's chart (Berger 1-27, Senna 28-29, Mansell 30-31, Patrese 32, Capelli 33-77) fixes the leaders' in-laps. Capelli (#16) and Gugelmin (#15) non-stop (MS, WP). Alesi's (#4) stop (final drive failed leaving the pits), Nannini's stop, Berger's and Mansell's second stops: no laps. Prost passed Capelli on lap 78 (MS, WP chart; WP text: 77). | |
| united-states-1990 | #20 Piquet 28 ([MS](https://www.motorsportmagazine.com/archive/article/april-1990/5/phoenix-revivial), [WP](https://en.wikipedia.org/wiki/1990_United_States_Grand_Prix)) | n/a | Berger (#28) nose/wing stop: WP puts the crash on lap 9, MS has him rejoining on lap 15, so not entered. Patrese, Nannini (2), Schneider, Martini, Moreno stops: no laps. Alesi (#4) and Senna (#27) appear to have run non-stop (MS: "only Piquet stopped specifically for tyres" of the Goodyear runners). | |
| mexico-1990 | #28 Berger 13; #26 Alliot 12; #20 Piquet 44 ([MS](https://www.motorsportmagazine.com/archive/article/august-1990/6/mexican-magic), [GPE](https://www.grandprix.com/gpe/rr490.html), [WP](https://en.wikipedia.org/wiki/1990_Mexican_Grand_Prix)) | n/a | Prost (#1) and Mansell (#2): no stop in any source, but none says non-stop. Larini (#25) early stop, no lap. Senna (#27) no stop, right-rear tyre failure; WP and GPE differ on the lap (WP: three laps after lap 60; GPE: lap 63; Jolpica: 63 laps). | |
| brazil-1991 | #27 Prost 17 (WP); #5 Mansell 25 (MS), 50 (WP) | n/a | Mansell first stop: MS says 25, WP 26. MS chosen because it matches Jolpica elsewhere (Mansell retired on lap 60 with 59 laps; WP says 61). The lap-50 stop is WP only, so check it. Senna's and Patrese's single stops, Prost's second, Piquet's and Moreno's: no laps. Mansell retired with gearbox failure ([MS](https://www.motorsportmagazine.com/archive/article/may-1991/6/formula-one-brazilian-grand-prix), [WP](https://en.wikipedia.org/wiki/1991_Brazilian_Grand_Prix)). | |
| monaco-1992 | #5 Mansell 71; #20 Brundle 19 ([GPE](https://www.grandprix.com/gpe/rr522.html), [MS](https://www.motorsportmagazine.com/archive/article/july-1992/16/what-did-go-wrong), [WP](https://en.wikipedia.org/wiki/1992_Monaco_Grand_Prix)) | n/a | WP's body says Mansell led "until lap 70"; its lead section, GPE and MS say 71. 71 chosen. Senna (#1) ran non-stop on one set (WP). | |
| belgium-1992 | Wets: #5 Mansell 3, #27 Alesi 3, #19 Schumacher 4, #20 Brundle 5, #6 Patrese 6, #12 Herbert 8, #1 Senna 16. Slicks: Senna 28, Herbert 30, Schumacher 30, Brundle 31, Patrese 31, #11 Hakkinen 31, Mansell 33 (6.37 s) ([MS](https://www.motorsportmagazine.com/archive/article/october-1992/8/luck-and-judgement), [GPE](https://www.grandprix.com/gpe/rr528.html)) | n/a | Hakkinen's wet-tyre stop, Alesi's puncture stop, every midfield car. Mansell and Patrese both had loose exhausts late on (MS). | |
| hungary-1992 | #5 Mansell 61; #1 Senna 67 ([MS](https://www.motorsportmagazine.com/archive/article/september-1992/16/mansell-is-finally-crowned/), [WP](https://en.wikipedia.org/wiki/1992_Hungarian_Grand_Prix), [GPE](https://www.grandprix.com/gpe/rr527.html)) | n/a (lap-14 "SC" board shown, no car deployed: WP) | Everyone else planned to run non-stop (MS). Retirements: Patrese dropped a valve on lap 56; Schumacher's rear wing failed at the start of lap 64 (MS). | |
| brazil-1993 | Wets lap 27: #8 Senna, #12 Herbert, #19 Alliot, #4 de Cesaris, #21 Alboreto. Lap 28: #0 Hill, #30 Lehto, #11 Zanardi, #26 Blundell, #9 Warwick, #22 Badoer, #20 Comas. Lap 30: #5 Schumacher, #27 Alesi. Slicks: Herbert 37, Senna 40, Hill 41. Schumacher 41 (10 s stop-and-go) ([MS](https://www.motorsportmagazine.com/archive/article/may-1993/10/cardinal-senna)) | Laps 30-36 (MS: "came out on lap 30" ... "lap 37 before the racing resumed") | WP has the crashes on lap 27; a fan wiki says 29-38. Senna's pre-rain stop-and-go (issued lap 25, WP), Alesi's two stop-and-gos, Schumacher's slick stop, Katayama's and Suzuki's early stops: no laps. Prost (#2) stayed out on slicks and crashed on lap 29. A trial reconstruct notes "the laps behind the safety car did not settle". | |
| europe-1993 | #25 Brundle 6; #0 Hill 17, 24; #8 Senna 18, 34, 57 (drive-through, WP); #2 Prost 19, 22, 48, 53; #14 Barrichello 19, 39 ([MS](https://www.motorsportmagazine.com/archive/article/may-1993/18/opportunity-knocked), [WP](https://en.wikipedia.org/wiki/1993_European_Grand_Prix), [GPE](https://www.grandprix.com/gpe/rr535.html)) | none entered; `complete: false` | Totals (MS): Senna 5 pit calls including the drive-through (WP: 4 stops), Hill 6, Prost 7, Herbert 1, Barrichello at least 4. About 11 front-runner stops have no lap. A trial reconstruct fails the lap-1 grid-order anchor: Lehto started from the pit lane in the spare (MS), but Jolpica has him on grid 7. That is an anchor issue, not a facts one. | |
| australia-1993 | #5 Schumacher 15; #0 Hill 22 (6.41 s), 44; #8 Senna 24 (5.32 s), 55; #7 Hakkinen 26; #2 Prost 29 (7.41 s), 48 ([MS](https://www.motorsportmagazine.com/archive/article/december-1993/18/mclaren-overtakes-ferrari), [GPE](https://www.grandprix.com/gpe/rr548.html), [WP](https://en.wikipedia.org/wiki/1993_Australian_Grand_Prix)) | none entered; `complete: false` | MS has Prost leading laps 24-28, which fits a Senna in-lap of 24 if the pit entry is before the line. Hakkinen's lap-28 retirement into the pits (brakes) is not entered. Alesi 1 stop, Berger 2, Suzuki 1: no laps. Schumacher's engine failed on lap 20; Patrese's fuel pressure dropped on the last lap (WP). | |
| spain-1994 | F1DB | none entered; `complete: false` | MS gives each leader's stop one lap below F1DB (Schumacher 21/45 against 22/46, Hakkinen 30/45 against 31/46, Hill 41 against 42); F1DB kept ([MS](https://www.motorsportmagazine.com/archive/article/july-1994/12/atimely-triumph)). No safety car in WP, MS or [GPE](https://www.grandprix.com/gpe/rr553.html). | |
| australia-1994 | F1DB | none entered; `complete: false` | MS agrees with F1DB's laps ([MS](https://www.motorsportmagazine.com/archive/article/december-1994/18/game)). F1DB's Barrichello 58 and Hakkinen 62 (about 14 s each) look like the 10 s stop-and-go penalties MS puts on laps 58 and 61. No safety car in WP, MS or [GPE](https://www.grandprix.com/gpe/rr564.html). Hill retired at his lap-36 pit visit with broken suspension. | |
| belgium-1995 | F1DB | Laps 29-31 ([MS](https://www.motorsportmagazine.com/archive/article/october-1995/14/belgian-grand-prix-9/): "Safety Car appears on lap 29" ... "race proper resumes on lap 32"; [lightsoutblog](https://lightsoutblog.com/every-safety-car-deployment-at-the-belgian-grand-prix): deployed lap 29) | A fan wiki says 28-33, and a search summary claimed "six laps", but the page as fetched doesn't say that. F1DB's Hill stop on lap 33 is the pit-lane speeding stop-and-go (MS, GPE). | |

## Not found anywhere read

- Exact laps for Piquet's stop in Australia 1986 and for the Williams stops in Mexico 1986.
  Both are storyline stops. Autosport's archive (paywalled) or a contemporary lap chart would
  settle them.
- Pit-lane times for every race before 1994.
- Whether europe-1993, australia-1993, spain-1994 and australia-1994 had no safety car. No
  source read mentions one.

GrandPrix.com rate-limits requests, so its reports for Hungary 1986, Germany 1986,
Australia 1986, Britain 1987, Monaco 1988 and Brazil 1991 were not read.

# LastStint: Eras Mode Spec

You are building **Eras mode** for LastStint, a web game where players run an F1 team's pit wall in real historical races. Read this whole spec before writing code. Build in the order given in "Build order", and stop to ask before any change that breaks the race JSON schema or the D1 schema already in use by Daily and Gauntlet.

## 1. Context

LastStint already has two modes. Eras must serve a different purpose from both.

| Mode | Purpose | Player motivation |
|---|---|---|
| Daily | One shared race per day | Habit, compare with everyone |
| Gauntlet | Back-to-back decisions until a costly call | Streaks, risk |
| **Eras (this spec)** | A campaign back through F1 history | **Progression, mastery, collection** |

Eras combines three ideas:

1. **Campaign back through history.** Ten eras, ten races each, played newest first: from Era 10 (2022–2025) back to Era 1 (1983–1988). Each era unlocks with stars earned in the one before it in play order, and difficulty rises with every era.
2. **Race objectives, not just wins.** Every race awards up to three stars for different goals. Stars are hard to earn and get harder with every era.
3. **Rewrite history.** When a player changes the real outcome of a race, it's recorded in their personal **history book**, alongside community stats.

The existing simulator, grader, race JSON and score verification are reused. Eras adds progression, objectives, difficulty scaling and the history book on top.

## 2. Goals and non-goals

**Goals**
- Self-paced and replayable, with no daily limit.
- Completing the campaign takes real skill and many replays; nobody clears it in a day by winning races alone.
- A long tail for completionists after the map is cleared.
- New eras can be released over time as content drops.

**Non-goals**
- No energy systems, attempt limits or timers that gate play.
- Eras progress never requires playing Daily or Gauntlet.
- No changes to Daily or Gauntlet behavior.

## 3. Glossary

- **Era:** a group of 10 races from one period of F1, with its own simulator rules.
- **Play order:** the order players meet eras, newest first. Play order 1 is Era 10; play order 10 is Era 1.
- **Attempt:** one playthrough of one race. Each attempt gets a fresh seed.
- **Star:** one of three per-race achievements (Result, Strategist, Mastery).
- **Rewrite:** a result that changes the race's real storyline, recorded in the history book.
- **Hidden objective:** an extra objective revealed only after earning all three stars on a race.
- **Legend difficulty:** a harder second pass of a cleared era, with its own three stars per race.
- **Accuracy:** a 0–100 score of how close the player's calls were to the best options, from the existing grader.

## 4. Eras and races

Players start at Era 10 and move back through the timeline to Era 1. The eras below are listed in play order (newest first); the play order on each heading is what counts. Race IDs follow the repo's convention, `<event-slug>-<year>` (for example `abu-dhabi-2021`), as `pipeline/ingest.py:default_race_id` makes them. Each race's one-line dilemma is the storyline it's built around; use it for the race intro and the history book.

**Do not invent race facts.** Lap numbers, results, strategies and events come from the data pipeline or from facts entered and checked by a person. If a race detail is missing, leave it as a TODO and flag it; never fill it in from memory.

### Era 10: Ground-effect era (2022–2025) · play order 1
| # | Race ID | Dilemma | Target (draft) |
|---|---|---|---|
| 1 | bahrain-2023 | Ferrari stops early for hards; Aston Martin stretches Alonso's softs to catch Sainz late | position: Alonso on the podium |
| 2 | great-britain-2023 | Box from third now, or hold out on old mediums and gamble on a neutralisation | position: Piastri on the podium |
| 3 | hungary-2022 | Ferrari's hard-tyre gamble | beat-rival: Leclerc ahead of Verstappen |
| 4 | japan-2023 | Russell stretches his first set while the field stops twice: hold on one stop, or stop again and attack | beat-rival: Russell ahead of Hamilton |
| 5 | netherlands-2023 | Rain at the start and the finish | position: Alonso P2 or better |
| 6 | emilia-romagna-2024 | Imola's one-stop chess: pit first to chase the leader, or stretch the mediums and trust the hards to the flag | win: Norris beats Verstappen |
| 7 | hungary-2024 | McLaren team orders | team: McLaren 1–2 |
| 8 | belgium-2023 | Verstappen wins from sixth after a gearbox penalty | win: Verstappen from P6 |
| 9 | australia-2025 | Wet-dry chaos | defend: Norris holds P1 |
| 10 | abu-dhabi-2022 | Second in the title on strategy: Pérez's mediums grain while Ferrari stretches Leclerc's stint | beat-rival: Leclerc ahead of Pérez |

### Era 9: The 2021 title fight · play order 2
| # | Race ID | Dilemma | Target (draft) |
|---|---|---|---|
| 1 | bahrain-2021 | Track limits and the undercut | defend: Hamilton holds off Verstappen |
| 2 | styria-2021 | Hamilton on wilting mediums four seconds back: pit early, stretch the stint, or stop twice | win: Hamilton beats Verstappen |
| 3 | azerbaijan-2021 | Tyre failure, then the restart | defend: Pérez holds the lead at the restart |
| 4 | france-2021 | Red Bull's two-stop beats Hamilton | win: Verstappen chases Hamilton |
| 5 | hungary-2021 | Hamilton alone on the grid at the restart | position: Hamilton on the podium |
| 6 | russia-2021 | Norris stays on slicks as the rain arrives | defend: Norris holds P1 |
| 7 | turkey-2021 | Hamilton argues against pitting | position: Hamilton limits the damage (P4 or better) |
| 8 | netherlands-2021 | Mercedes splits its cars against a quicker Red Bull: Hamilton undercuts, Bottas runs long | defend: Verstappen wins from pole |
| 9 | great-britain-2021 | A 10-second penalty to serve at the one stop, then a one-stopping Ferrari to catch | win: Hamilton from P2 at the restart, with a 10 s penalty |
| 10 | abu-dhabi-2021 | The finale | beat-rival: title to whoever finishes ahead |

### Era 8: Mercedes vs Ferrari (2017–2020) · play order 3
| # | Race ID | Dilemma | Target (draft) |
|---|---|---|---|
| 1 | monaco-2017 | Ferrari overcuts Vettel past Räikkönen | defend: Räikkönen holds P1 |
| 2 | azerbaijan-2017 | Red flag chaos | win: Ricciardo from P10 |
| 3 | germany-2018 | Vettel crashes in the rain; Hamilton stays out from 14th | win: Hamilton from P14 |
| 4 | russia-2018 | Bottas told to let Hamilton through | team: Mercedes 1–2, Hamilton ahead |
| 5 | germany-2019 | Rain and constant tyre swaps | win: Verstappen through the rain |
| 6 | hungary-2019 | Mercedes switches to two stops to catch Verstappen | win: Hamilton catches Verstappen |
| 7 | brazil-2019 | Late safety car chaos | position: Gasly on the podium |
| 8 | italy-2020 | Red flag and a pit-lane penalty hand Gasly the win | defend: Gasly holds the lead to the flag |
| 9 | turkey-2020 | Hamilton's worn intermediates win the title | win: Hamilton from P6 for the title |
| 10 | sakhir-2020 | Mercedes' pit stop mix-up costs Russell | defend: Russell holds P1 |

### Era 7: Hybrid turbo (2014–2016) · play order 4
| # | Race ID | Dilemma | Target (draft) |
|---|---|---|---|
| 1 | bahrain-2014 | Hamilton vs Rosberg, the Duel in the Desert | defend: Hamilton holds off Rosberg |
| 2 | canada-2014 | Both Mercedes have power failures | defend: Rosberg nurses a failing car to the win |
| 3 | hungary-2014 | Safety car chaos | beat-rival: Hamilton from the pit lane, ahead of Rosberg |
| 4 | monaco-2015 | Mercedes' unnecessary stop costs Hamilton the win | defend: Hamilton holds P1 |
| 5 | hungary-2015 | Chaos, Vettel wins | win: Vettel takes the lead |
| 6 | united-states-2015 | Hamilton clinches the title in mixed conditions | beat-rival: Hamilton ahead of Rosberg and Vettel for the title |
| 7 | spain-2016 | Mercedes cars collide; Red Bull's split strategy | defend: Verstappen holds off Räikkönen |
| 8 | monaco-2016 | The tyres aren't ready at Ricciardo's stop | defend: Ricciardo holds P1 |
| 9 | great-britain-2016 | A wet start that dries: when to switch tyres, Verstappen vs Rosberg | position: Verstappen on the podium |
| 10 | abu-dhabi-2016 | Hamilton backs Rosberg into the pack | deny: Hamilton keeps Rosberg P4 or lower |

### Era 6: Fast-wearing tyres (2010–2013) · play order 5
| # | Race ID | Dilemma | Target (draft) |
|---|---|---|---|
| 1 | bahrain-2012 | Räikkönen closes in on Lotus' fresher softs: cover the undercut at the last stop, or trust Red Bull's own plan | defend: Vettel holds P1 |
| 2 | abu-dhabi-2010 | Ferrari covers the wrong car and loses the title | position: Alonso P4 or better for the title |
| 3 | china-2011 | Hamilton's three stops beat Vettel's two | win: Hamilton beats Vettel |
| 4 | italy-2010 | Button blinks first: does Alonso stay out one more lap and trust his crew to win it in the pit lane? | win: Alonso gets ahead of Button at the stops |
| 5 | australia-2013 | Lotus is kind to its tyres: stretch Räikkönen to two stops while the Ferraris and Red Bulls stop three times | win: Räikkönen from P7 |
| 6 | europe-2012 | Alonso wins from 11th in Valencia | win: Alonso from P11 |
| 7 | abu-dhabi-2012 | Vettel from the pit lane to the podium | position: Vettel from the pit lane to the podium |
| 8 | brazil-2012 | Vettel recovers from a first-lap spin to win the title | position: Vettel high enough for the title |
| 9 | malaysia-2013 | Multi 21 team orders | defend: Webber holds P1 |
| 10 | spain-2013 | Alonso wins on four stops | win: Alonso on four stops |

### Era 5: Alonso, Räikkönen, Hamilton (2005–2009) · play order 6
| # | Race ID | Dilemma | Target (draft) |
|---|---|---|---|
| 1 | san-marino-2005 | Alonso holds off Schumacher | defend: Alonso holds off Schumacher |
| 2 | japan-2005 | Räikkönen from 17th to win | win: Räikkönen from P17 |
| 3 | hungary-2006 | Button's first win, in the rain | win: Button from P14 |
| 4 | brazil-2006 | Alonso protects the title | position: Alonso P8 or better for the title |
| 5 | china-2007 | McLaren leaves Hamilton out on worn tyres | position: Hamilton finishes high enough to clinch |
| 6 | europe-2007 | Rain chaos at the Nürburgring | win: Alonso chases Massa |
| 7 | brazil-2007 | Three-way title decider | deny: Räikkönen wins, Hamilton kept P6 or lower |
| 8 | monaco-2008 | Hamilton's puncture stop turns into a win | win: Hamilton after the puncture |
| 9 | brazil-2008 | Glock on dry tyres in the rain, last-corner title | position: Hamilton P5 or better for the title |
| 10 | brazil-2009 | Button clinches the title from 14th | position: Button from P14, high enough for the title |

### Era 4: Ferrari dynasty (2000–2004) · play order 7
| # | Race ID | Dilemma | Target (draft) |
|---|---|---|---|
| 1 | germany-2000 | Barrichello stays on slicks in the rain | win: Barrichello from P18 |
| 2 | japan-2000 | A pit stop decides the title | beat-rival: Schumacher ahead of Häkkinen |
| 3 | malaysia-2001 | Ferrari's double stop in a downpour | win: Schumacher recovers the lead |
| 4 | austria-2002 | Team orders on the final lap | team: Ferrari 1–2 |
| 5 | brazil-2003 | Red flag chaos | win: Fisichella in the chaos |
| 6 | hungary-2003 | Alonso's first win on Renault's fuel strategy | defend: Alonso holds P1 |
| 7 | united-states-2003 | The rain tyre gamble | win: Schumacher on the right tyre |
| 8 | japan-2003 | Schumacher needs one point | position: Schumacher P8 or better for the title |
| 9 | france-2004 | Ferrari's four-stop strategy | win: Schumacher beats Alonso |
| 10 | monaco-2004 | A safety car shapes the stops | defend: Trulli holds P1 |

### Era 3: Refuelling returns (1994–1999) · play order 8
| # | Race ID | Dilemma | Target (draft) |
|---|---|---|---|
| 1 | spain-1994 | Schumacher stuck in fifth gear | position: Schumacher P2 stuck in fifth gear |
| 2 | australia-1994 | Schumacher vs Hill for the title | beat-rival: Schumacher ahead of Hill |
| 3 | belgium-1995 | Schumacher from 16th on slicks in the wet | win: Schumacher from P16 |
| 4 | spain-1996 | Schumacher's rain masterclass | win: Schumacher in the rain |
| 5 | hungary-1997 | Hill's Arrows almost wins | defend: Hill holds P1 |
| 6 | europe-1997 | The title decider at Jerez | beat-rival: Villeneuve ahead of Schumacher |
| 7 | hungary-1998 | Ferrari switches to three stops mid-race | win: Schumacher on three stops |
| 8 | belgium-1998 | Rain, a mass crash, Jordan's first win | team: Jordan 1–2 |
| 9 | malaysia-1999 | Ferrari team orders for Irvine's title push | deny: Irvine wins, Häkkinen kept P3 or lower |
| 10 | europe-1999 | Rain chaos, Stewart's only win | win: Herbert from P14 |

### Era 2: Senna vs Prost (1989–1993) · play order 9
| # | Race ID | Dilemma | Target (draft) |
|---|---|---|---|
| 1 | france-1990 | Capelli's Leyton House runs non-stop and leads; Prost closes in | win: Capelli from P7, with no tyre stop |
| 2 | united-states-1990 | Alesi in the Tyrrell vs Senna | defend: Alesi holds off Senna |
| 3 | mexico-1990 | Prost from 13th to the win on tyre strategy | win: Prost from P13 |
| 4 | brazil-1991 | Senna stuck in sixth gear | defend: Senna holds P1 stuck in sixth |
| 5 | monaco-1992 | Mansell pits for fresh tyres and chases Senna | win: Mansell chases Senna |
| 6 | belgium-1992 | Schumacher's first win, timing the switch to slicks | win: Schumacher times the slicks |
| 7 | hungary-1992 | Mansell's puncture stop with the title on the line | position: Mansell P2 or better for the title |
| 8 | brazil-1993 | Rain arrives mid-race | win: Senna in the rain |
| 9 | europe-1993 | Constant wet-dry tyre calls at Donington | win: Senna through the wet-dry calls |
| 10 | australia-1993 | Senna's last win | defend: Senna holds P1 |

### Era 1: Turbo era (1983–1988) · play order 10
| # | Race ID | Dilemma | Target (draft) |
|---|---|---|---|
| 1 | south-africa-1983 | Brabham's planned refuelling stops decide the title | position: Piquet high enough for the title |
| 2 | monaco-1984 | Rain, Prost leads, Senna closing | defend: Prost holds off Senna |
| 3 | portugal-1984 | Lauda needs second place to win the title by half a point | position: Lauda P2 or better for the title |
| 4 | germany-1986 | The McLarens save fuel to the 195-litre limit and run dry on the last lap | position: Rosberg makes the fuel last, P2 or better |
| 5 | portugal-1985 | Senna's first win, in heavy rain | defend: Senna holds P1 in the rain |
| 6 | mexico-1986 | Berger wins without a tyre stop | win: Berger with no tyre stop |
| 7 | hungary-1986 | Piquet vs Senna, tyres vs track position | beat-rival: Piquet ahead of Senna |
| 8 | australia-1986 | Mansell's tyre explodes; pit Piquet as a precaution? | position: Mansell P3 or better for the title |
| 9 | great-britain-1987 | Mansell pits for fresh tyres and chases down Piquet | win: Mansell chases Piquet |
| 10 | monaco-1988 | Senna leads by nearly a minute; tell him to slow down? | defend: Senna holds the lead to the flag |

### Which driver the player runs (decided Nov 7)
Each race is played from one driver's side. When both drivers in a race's storyline faced hard calls, the player gets **the driver with more hard calls**.

- **A hard call** is a decision moment where the best two options are within 5 percentage points of each other on the grader's chance of meeting the target. In other words, the second-best option is graded green or yellow, so the choice is a genuine dilemma. The 5-point edge lives in config (`HARD_CALL_EDGE`, default `BAND_EDGES.yellow`).
- **The pipeline counts them** for each storyline driver. It runs the moment finder and the grader from each driver's side on the real race, and writes the counts into the race model (`eras.hardCalls`, section 11).
- **`userSide`** is the driver with the higher count.
- **A tie** goes to the side whose real calls gave up the most chance against the best option: the more controversial side.
- The counts are rebuilt whenever the race is rebuilt, and checked in the content checklist.

### Data availability by era

Checked against the sources on Nov 4–5, 2026. Sources, adapters and licences are in `docs/simulator-roadmap.md`.

| Eras | Source | What's automated | What's entered by hand or estimated |
|---|---|---|---|
| 10, 9 (2023+) | OpenF1 | Everything | Decision moments, objectives, radio lines |
| 10, 9, 8 (2018–2022) | Races already built, or in the local FastF1 cache. Otherwise 2018–19 from TUM, and 2020–22 from Jolpica lap times and stops (no F1TV subscription, decided Nov 7) | Everything for built/cached races; lap times and stops otherwise | Same; plus tyre compounds and safety cars (estimated) for 2020–22 races from Jolpica |
| 8 (2017), 7 (2014–2017) | TUM f1-timing-database (CC BY-NC-SA, accepted Nov 7: credit TUM on a credits page; race files built from it carry the same licence), Jolpica | Lap times, gaps, compounds, tyre age, stops, SC/VSC | Incident causes |
| 6 (2010–2013) | Jolpica lap times; stops from Jolpica (2011+) or F1DB (2010) | Lap times, stops | Tyre compounds (estimated), safety cars, weather |
| 5, 4 (2000–2009) | Jolpica lap times; f1db stops | Lap times, stops | Compounds (estimated), fuel loads (estimated), safety cars, weather |
| 3 (1996–1999) | Jolpica lap times; F1DB stops | Lap times, stops | Same as above |
| 3 (1994–1995) | F1DB stops and fastest laps; Jolpica results | Results, stops, fastest laps | Reconstruction of the laps |
| 2, 1 (1983–1993) | Jolpica results; F1DB fastest laps | Results | Full reconstruction: race reports, solver |

Every race, however it was built, must pass the existing validation test before it can be published. Mark races built by full reconstruction as **Reconstructed** in the UI. Races that need a model not built yet (red flags, car faults, wet races before 2018, refuelling) stay **Draft** until it lands; see `docs/simulator-roadmap.md` for which races each model unblocks.

## 5. Campaign structure

- The map shows all ten eras in timeline order. Era 10 (play order 1) is unlocked from the start.
- An era unlocks when the player has **70% of the stars (21 of 30)** in the era before it in play order (Era 9 unlocks from Era 10, and so on back to Era 1).
- Within an unlocked era, all ten races are open and can be played in any order.
- **Sharing with Daily and Gauntlet (decided Nov 7):** an Eras race can also be in the Daily or Gauntlet pool. Five of the 100 are already in the Daily pool (`abu-dhabi-2021`, `bahrain-2021`, `france-2021`, `russia-2021`, `hungary-2019`) and stay there; none are in the Gauntlet. `data/pools.json` gains an `eras` block, and the pools rule becomes: a race is in at most one of Daily and Gauntlet, and in Eras as well if it's one of the 100.
- **Test:** all ten eras and all 100 races are up at once, including Draft races, so the whole campaign can be played through.
- **Production:** eras are released one at a time, in play order, by setting `released_at`. An unreleased era shows as "Coming soon" with its date range.
- The unlock threshold lives in config as a share (`ERA_UNLOCK_SHARE = 0.7`, decided Nov 7), not in code. With 10 races an era needs 21 stars; the count is `ceil(0.7 × 3 × races)`.

## 6. Stars and objectives

Each race awards three stars. They're earned independently and kept permanently: a star earned on any attempt stays earned.

| Star | Name | Condition |
|---|---|---|
| ★1 | Result | Achieve the race's target, such as finishing ahead of the rival or reaching a set position |
| ★2 | Strategist | Race accuracy at or above the era's threshold (see section 7) |
| ★3 | Mastery | The race's authored mastery objective **and** no call graded orange or red (more than 5 percentage points behind the best option; `BAND_EDGES` in `packages/sim/src/grade.ts`) |

### Targets (★1)
Every race has one target, set in `eras.target`. Each race's draft target is in its table in §4. The drafts are written from the storyline driver's side. If the hard-call counter puts the player on the other side, the target is rewritten in step 6.2. The position numbers in the drafts must be checked against the real standings before a race is published (§19).

| Type | Means | Grader `Target` | Races (draft) |
|---|---|---|---|
| `win` | Chase down the win from behind | `win` | 37 |
| `defend` | Start in the lead and keep it to the flag | `win`, starting from P1 | 25 |
| `position` | Reach a set position, such as P3 to win the title | `position` | 21 |
| `beat-rival` | Finish ahead of a named car, wherever that is | `beat-rival` | 10 |
| `team` | A team result, such as a 1–2 in a set order | `team` (new) | 4 |
| `deny` | Keep a rival at or below a set position, such as out of the top 3 to stop their title | `deny` (new) | 3 |

Every era has at least three different target types.

### Accuracy
- Per decision: `decisionAccuracy = max(0, 100 − 2.5 × winChanceLost)`, where `winChanceLost` is the percentage points the player's option gave up versus the best option, from the grader.
- Race accuracy is the mean across all graded decisions. Headset modes are graded in summary, as in the existing review screen.
- The 2.5 multiplier lives in config.

### Mastery objectives
Each race has one authored mastery objective chosen from these types. The evaluator must support all of them.

| Type | Parameters | Example |
|---|---|---|
| `stop_count` | `max` or `exact` | Win on a one-stop |
| `beat_real_call` | — | Do better than the real team's result |
| `finish_position` | `position` | Finish P1 |
| `margin` | `seconds` | Win by more than 5 seconds |
| `compound_rule` | `mustUse` / `mustAvoid` | Finish without using the soft tyre |
| `mode_rule` | `mode`, `maxLaps` | Push for no more than 5 laps |
| `no_neutralized_stop` | — | Win without pitting under the safety car or VSC |
| `team_result` | `positions` | Both cars in the points |

### Hidden objectives
- Each race has one hidden objective, using the same types.
- It stays hidden until the player has all three stars on that race, then shows as a new challenge.
- Completing it adds a history book collectible, not a star. It doesn't count toward era unlocks.

### Evaluation
- Stars and objectives are evaluated **on the server** from the verified replay, as scores are today. The client may show a preview, but only the server writes progress.

## 7. Difficulty scaling

Difficulty rises with play order, so every era completed makes the next one harder. Each era's rules (refuelling, tyre wars, wet calls) change how strategy works, but these knobs are what make the progression harder.

| Play order | Era | ★2 accuracy threshold | Information shown | Rival policy | Decision timer |
|---|---|---|---|---|---|
| 1 | 10 | 70 | Full | Standard | 45 s |
| 2 | 9 | 72 | Full | Standard | 45 s |
| 3 | 8 | 75 | Full | Standard+ | 45 s |
| 4 | 7 | 78 | Reduced | Standard+ | 45 s |
| 5 | 6 | 80 | Reduced | Smart | 30 s |
| 6 | 5 | 82 | Reduced | Smart | 30 s |
| 7 | 4 | 84 | Limited | Smart | 30 s |
| 8 | 3 | 86 | Limited | Expert | 20 s |
| 9 | 2 | 88 | Minimal | Expert | 20 s |
| 10 | 1 | 90 | Minimal | Expert | 20 s |

**Information levels**
- **Full:** exact gaps, gap trend graph, exact tyre ages for all cars, rival's compound.
- **Reduced:** no gap trend graph; every other car's tyre age shown as a 5-lap range on multiples of 5 (for example, "15–20 laps"). Your own car's tyre age stays exact. The width is `tyreAgeRangeLaps` in the era difficulty config (decided Nov 7).
- **Limited:** as Reduced, plus rival fuel load hidden in refuelling eras, and gaps rounded to 0.5 s.
- **Minimal:** as Limited (each level hides everything the level above hides; decided Nov 7), plus gaps to the cars directly ahead and behind only, updated once per lap.

The levels apply everywhere a gap or a tyre age shows: the standings, the leaders beside the map, the driver card, the car stats, the decision card, and the engineer's radio and quick calls (decided Nov 7). At Minimal the standings show only your interval to the car ahead and the car behind's interval to you, and the radio talks about the gap to the rival only when he is directly ahead or behind. Outside Eras nothing changes.

**Era presentation (not difficulty):** prompts follow the era's style. In Eras 1–2, decisions appear as short pit-board messages, since team radio was limited then; from Era 3 on, they appear as team radio. This changes how prompts look, not what information the player gets.

**Rival policies** (definitions decided Nov 7)
- **Standard:** today's rival, unchanged, so Daily and Gauntlet are unaffected. It covers stops under the safety car or VSC, and covers a green-flag undercut when its own planned stop is within 4 laps (`COVER_WINDOW`); otherwise it follows its real strategy.
- **Standard+:** Standard, and it also covers a green-flag undercut when its own planned stop is within 7 laps (4 + 3).
- **Smart:** Standard+, plus:
  - **Overcut:** when the player pits under green and the rival doesn't cover, the rival moves its next planned stop to the lap the sim predicts gives it the lowest remaining race time, never later than tyre life minus `GO_LONG_MARGIN`.
  - **Wet tyres:** it switches on the crossover lap, the first lap a fresh set of inters or wets is faster than its slicks (pit loss excluded; a tie keeps the slicks).
- **Expert:** Smart, plus:
  - **Earlier reactions:** under green it covers on the same lap the player stops, and it switches to wet tyres one lap before the crossover.
  - **Its own grader:** at each decision point it runs the grader for itself and takes the best option. Its decision points are the player's stops, each safety car or VSC that starts next lap, the lap before its own planned stop, and the wet crossover. Its options are Smart's move, stay out, or box now. Its target is finishing ahead of the player.
  - **Cost:** 100 samples per decision, run in the background grading workers. Playouts inside an Expert race use Smart rivals (no grading inside grading).
  - **Server check:** the client submits the rival's chosen option at each point; the server checks it's a legal option and replays the race with it, and the nightly job re-grades in full (the claimed-grades pattern).

**Decision timer:** every decision in every era is timed (decided Nov 7); the length follows the table. When it runs out, the default option is chosen: stay out, or keep the current mode. The timer is an accessibility risk, so include a setting to turn it off; doing so marks that attempt's stars as "untimed" but still awards them.

Quick calls and battles use the same timer in Eras, not their own short ones (decided Nov 7). The race holds while a quick call waits, as it already does for a battle at the braking zone. When the timer runs out, the outcome is the same as no answer today: the driver makes his own move, or nothing changes. With the timer turned off, these calls wait too. Outside Eras their timers are unchanged.

All values in this table live in an era difficulty config, not in code.

## 8. Rewrite history and the history book

### Rewrites
- Each race defines a `storyline`: what really happened (for example, "Verstappen wins the race and the title") and, usually, a `rewriteCondition` (for example, "user's driver finishes ahead of the rival").
- A race the Eras side really won has no `rewriteCondition` (owner decision, Nov 8 2026): no result rewrites history there, so the race has no rewrite to collect, no rewrite headline and no rewrite stat. Its storyline keeps `real` only.
- When a verified attempt meets the rewrite condition, the server records a history book entry with the date, accuracy and stars of that attempt.
- Each entry has an authored, original headline, for example: "You won Lewis his eighth title." Never quote real team radio. The headline is required with a rewrite condition and left out without one.

### The history book
A page showing the player's progress across everything collectible.

| Collectible | Count |
|---|---|
| Stars | 300 (10 eras × 10 races × 3) |
| Legend stars | 300 |
| Rewrites | 100, less one for each race without a rewrite condition |
| Hidden objectives | 100 |
| Era badges | 30 (Cleared, Mastered, Legend for each era) |
| **Total** | **830**, less the races without a rewrite condition |

The rewrites total counts the races that have a rewrite condition. A race whose storyline isn't written yet still counts as one (its rewrite is still to come); one authored without a rewrite condition doesn't.

- Show an overall completion percentage and per-era progress.
- Each rewrite shows a community stat: "Only 9% of strategists rewrote this race." Compute it from verified attempts and cache it.
- Era badges:
  - **Cleared:** at least 1 star on all 10 races.
  - **Mastered:** 30 of 30 stars.
  - **Legend:** 30 of 30 Legend stars.

### Legend difficulty
- Unlocks for an era once it's Cleared.
- Uses the hardest settings regardless of era: accuracy threshold 90, Minimal information, Expert rival, 20 s timer.
- Safety cars and VSCs happen at random laps at the track's historical rate, instead of on their real laps, so memorizing the race doesn't help. Events that define the storyline (for example, the Abu Dhabi 2021 late safety car) are flagged `storylineEvent: true` and always happen on their real lap.
- No random safety cars before 1993, in any difficulty. In a race before 1993 nothing the sim makes up brings out a safety car or VSC: Legend draws none, a crash in live play brings out none, and the grader's playouts draw none. The race's real events, storyline events included, still happen (decided Nov 7).
- Calls follow the safety cars. A decision moment tied to a real safety car or VSC that Legend removed is dropped, and each drawn safety car or VSC brings the same call a real one would (stay out, or box for each compound). Other moments don't change. Like the draws, the calls come from the attempt's seed (decided Nov 7).
- Stops pay the real conditions. A scripted car's real stop costs what a stop costs on that lap in this Legend race: a stop that was under a real safety car but is now on a green lap costs a green stop's time, and a stop that now falls under a drawn safety car or VSC costs that stop's time (decided Nov 7).
- Legend has its own three stars per race, tracked separately.

### Leaderboards
- Each race has a permanent leaderboard ranked by best accuracy, with a separate board for Legend.
- Show the player's rank and the top 100.
- Leaderboards, including Legend, never reset, even when an era gets a content update (decided Nov 7).

## 9. Attempts and seeds

- Each attempt starts with `POST /api/eras/attempts`, which returns a fresh server-generated seed. Never derive seeds from the date or the race.
- The attempt is submitted with its decisions; the server replays it with that seed, evaluates stars, objectives and rewrites, then writes progress.
- Players can replay any race as often as they like. Progress keeps the best result per star.
- Abandoned attempts expire after 24 hours.

## 10. Accounts and progress

- Eras progress is stored in D1, keyed by the player.
- Anonymous players are keyed by their existing anonymous ID, with a persistent banner: "Sign in to save your progress across devices."
- On sign-in, merge anonymous progress into the account by keeping the best result per star and every history book entry.
- If accounts aren't built yet, ship anonymous progress first and add the merge later. Flag this to the user before starting section 10.

## 11. Race JSON additions

Add an optional `eras` block to the race model JSON. Daily and Gauntlet ignore it. Bump `schemaVersion` and update the shared JSON Schema.

```json
"eras": {
  "eraId": 9,
  "order": 10,
  "target": "finish_ahead_of_rival",
  "storyline": {
    "real": "Verstappen wins the race and the title",
    "rewriteCondition": { "type": "finish_ahead_of_rival" },
    "headline": "You won Lewis his eighth title"
  },
  "mastery": { "type": "no_neutralized_stop", "label": "Win without pitting under the safety car" },
  "hidden": { "type": "margin", "seconds": 3, "label": "Win by more than 3 seconds" },
  "hardCalls": { "VER": 6, "HAM": 4 },
  "reconstructed": false,
  "briefing": "Short era-appropriate intro shown before the race."
}
```

Events that must never move in Legend difficulty get `"storylineEvent": true` in the existing `events` array.

## 12. Data model (D1)

```sql
CREATE TABLE eras (
  id INTEGER PRIMARY KEY,             -- 1..10
  name TEXT NOT NULL,
  years TEXT NOT NULL,                -- "2022–2025"
  play_order INTEGER NOT NULL UNIQUE, -- Era 10 = 1 (newest first)
  released_at TEXT                    -- NULL = coming soon in production; ignored on test
);

CREATE TABLE era_races (
  race_id TEXT PRIMARY KEY,           -- "abu-dhabi-2021"
  era_id INTEGER NOT NULL REFERENCES eras(id),
  position INTEGER NOT NULL,          -- 1..10 within the era
  published INTEGER NOT NULL DEFAULT 0, -- 0 = Draft: playable on test only
  UNIQUE (era_id, position)
);

CREATE TABLE era_attempts (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  race_id TEXT NOT NULL REFERENCES era_races(race_id),
  legend INTEGER NOT NULL DEFAULT 0,
  seed INTEGER NOT NULL,
  decisions TEXT,                     -- JSON, NULL until submitted
  accuracy REAL,
  result TEXT,                        -- JSON: finish, grades, objectives met
  untimed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  submitted_at TEXT
);

CREATE TABLE era_progress (
  player_id TEXT NOT NULL,
  race_id TEXT NOT NULL,
  legend INTEGER NOT NULL DEFAULT 0,
  star_result INTEGER NOT NULL DEFAULT 0,
  star_strategist INTEGER NOT NULL DEFAULT 0,
  star_mastery INTEGER NOT NULL DEFAULT 0,
  hidden_done INTEGER NOT NULL DEFAULT 0,
  best_accuracy REAL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (player_id, race_id, legend)
);

CREATE TABLE history_entries (
  player_id TEXT NOT NULL,
  race_id TEXT NOT NULL,
  attempt_id TEXT NOT NULL REFERENCES era_attempts(id),
  achieved_at TEXT NOT NULL,
  PRIMARY KEY (player_id, race_id)
);

CREATE INDEX era_attempts_race_accuracy ON era_attempts (race_id, legend, accuracy);
```

Era unlock state and badges are derived from `era_progress`, not stored.

## 13. API

| Method and path | Purpose |
|---|---|
| GET /api/eras | All eras with release state, the player's stars per era, and unlock state |
| GET /api/eras/:eraId | The era's 10 races with the player's stars, hidden objective state and best accuracy |
| POST /api/eras/attempts | Start an attempt: `{ raceId, legend }` → `{ attemptId, seed, modelUrl, difficulty }` |
| POST /api/eras/attempts/:id | Submit decisions; server replays and returns stars, objectives, accuracy, rewrite, rank |
| GET /api/history | The player's history book: entries, collectible counts, completion % |
| GET /api/eras/races/:raceId/stats | Community stats: rewrite %, star rates |
| GET /api/eras/races/:raceId/leaderboard?legend= | Top 100 and the player's rank |

In production, reject attempts on locked or unreleased eras, unpublished (Draft) races, and Legend attempts on eras not yet Cleared. On test (`ERAS_TEST_MODE=true` in the worker's config), every era and race is open and unlocked, and Draft races show a Draft badge; locks and Legend gating are still computed and shown, so they can be tested.

## 14. Screens

1. **Era map:** a horizontal timeline from 2025 back to 1983 (play order, left to right), one node per era with stars (for example, "24/30") and a lock. Unreleased eras appear as "Coming soon."
2. **Era detail:** the era's name, years and short briefing, then 10 race cards with stars, best accuracy and a Reconstructed badge where relevant. A Legend toggle appears once the era is Cleared.
3. **Race intro:** the dilemma, the three objectives (★3 shown in full), the era's difficulty settings and the information level.
4. **Race:** the existing race screen, with information and timer adjusted to the era's difficulty.
5. **Results:** the existing review screen, plus stars earned this attempt, a "new star" animation, the rewrite headline if earned, and the community stat.
6. **History book:** completion %, per-era progress, rewrite entries with headlines, badges.

## 15. Content checklist (per race)

Add these to the existing race checklist for any race in Eras:
- [ ] `eras` block filled in, validated against the schema.
- [ ] Storyline written; a rewrite condition and an original headline unless the Eras side really won (then neither).
- [ ] Mastery and hidden objectives chosen and parameters set.
- [ ] **Reachability check:** an automated run confirms at least one decision path earns all three stars and the hidden objective at that era's difficulty, and at Legend.
- [ ] **Difficulty check:** ★3 is not reachable with the "stay out every time" path.
- [ ] Hard-call counts computed for each storyline driver; `userSide` is the driver with more (ties: the more controversial side).
- [ ] Storyline events flagged.
- [ ] Reconstructed flag set correctly.
- [ ] Facts checked against sources; no invented details.

## 16. Release plan

1. **Test:** all ten eras and all 100 races go up together on test (`ERAS_TEST_MODE`), Draft races included, for a full play-through.
2. **Production:** release one era at a time in play order (Era 10 first) by setting its `released_at`. An era is released only when all 10 of its races have passed validation and the content checklist.

Never release an era in production with fewer than 10 published races.

## 17. Build order

1. Schema: race JSON `eras` block, era difficulty config, D1 migrations.
2. Objective evaluator and star logic, with unit tests for every objective type.
3. Difficulty: information levels and rival policies in the simulator, behind the era config.
4. API endpoints and server-side evaluation.
5. Screens: Era map, Era detail, Race intro, Results additions.
6. History book and community stats.
7. Leaderboards.
8. Legend difficulty.
9. Account merge (only once accounts exist).

## 18. Acceptance criteria

- A new player sees Era 10 unlocked and Eras 9–1 locked.
- Winning every Era 10 race once gives 10 stars, not enough to unlock Era 9.
- Era 9 unlocks at exactly 21 stars (70%) in Era 10.
- Every race's `userSide` matches its `eras.hardCalls` (the higher count, or the tie rule).
- On test, all ten eras and all 100 races are playable, Draft races carry a Draft badge, and locks still display correctly.
- In production, only released eras and published races can be started; an attempt on anything else is rejected.
- Difficulty settings for each attempt match the era's row in the difficulty table.
- Stars persist across attempts; a worse attempt never removes a star.
- Every objective type has passing unit tests, including edge cases (retirements, red flags, ties).
- Server evaluation matches the client preview on every test race.
- A tampered submission (changed accuracy, stars or result) is rejected or corrected by the server.
- The history book counts match the database exactly.
- Legend safety cars move between attempts, except storyline events.
- Turning off the timer still awards stars, marked untimed.
- Daily and Gauntlet behave exactly as before.

## 19. Rules for building this

- Don't invent race facts, quotes or results. Use pipeline data or person-checked facts, and leave TODOs otherwise.
- All radio lines and headlines are original writing.
- No F1 logos, team liveries or the "F1" wordmark in the UI.
- All tunable numbers go in config: unlock threshold, accuracy multiplier, era difficulty table.
- Ask before changing any schema already used by Daily or Gauntlet.

## 20. Open questions

None. All were decided on Nov 7, 2026. The build plan is `docs/eras-build-plan.md`.


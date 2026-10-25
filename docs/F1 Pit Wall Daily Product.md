# F1 Pit Wall: Product Doc

Oct 17, 2026 · @Reuhen

## Summary

F1 Pit Wall (working name) is a free daily web game where you run the pit wall for a Formula 1 team in the deciding laps of a real race. Every day, everyone gets the same real race situation, from the Senna era to today: the real running order, gaps and tires, plus the safety cars, crashes and weather that actually happened.

You make the calls a race strategist makes: when to pit, which tires to fit, and what to say on the headset (push or save tires, attack or defend, team orders). A race simulator built from real timing data plays out your calls. It grades each one against the best possible call and against what the real team did, then ranks you against everyone who played.

## How it plays

A Daily Race takes 3–5 minutes and asks for 2–4 real decisions plus ongoing headset calls.

1. **Open the daily.** No login. The user sees today's race card: either an iconic named race ("Abu Dhabi 2021: Hamilton vs Verstappen") or a Mystery Race ("You're P3, 8 laps left, 2.1s behind").
2. **Take the hard side.** The user always runs the side with the hard or controversial call, never the easy one. Abu Dhabi 2021 is always Mercedes and Hamilton.
3. **Take over.** Control starts a few laps before the first real decision, not at a fixed lap. The user sees a live timing tower, the gap to the rival, tire age and compound, and the headset panel.
4. **Race.** Laps tick by automatically (about 3–5 seconds each). The BOX button and the standing headset modes are always live.
5. **Decision moments.** The game pauses at safety cars, undercut windows, tire cliffs, rain, the rival pitting, or a driver radio message, and offers 3–4 options.
6. **Finish.** The race plays out to the flag. The user sees the result, a grade on every call, the team's real call for comparison, their percentile and rank, and a strategist persona.
7. **Share.** A spoiler-free share card, then the option to play Survivor.

## Game modes

Launch with the Daily Race only, add Survivor next, and build Historical Season once accounts exist.

| Mode | What it is | Session | Accounts | Phase |
| --- | --- | --- | --- | --- |
| Daily Race | One real race situation per day, the same for everyone, with a leaderboard and percentile | 3–5 min | Not needed | Launch |
| Survivor | Random real strategy moments back to back; one costly call ends the run | Open-ended | Not needed | Phase 2 |
| Historical Season | Replay a real season as one team, race by race; results and championship points carry over | 3–5 min per race | Required | Phase 3 |

### Later ideas

- **Weather races category.** Deciding when to switch to intermediates is the most dramatic call in F1. Candidates: Brazil 2016, Hungary 2021, Brazil 2024.
- **Head-to-head.** Two friends each run one side of the same real duel. Built for streamers.
- **Live race-day mode.** During a real Grand Prix, users submit pit calls lap by lap and get scored against what actually happens. Hardest to build, but gives engagement every race weekend.

## Race pool

Iconic duels alone run out in about two months, so a daily game needs the second and third tiers too. FastF1's detailed timing goes back to 2018, which gives about 190 races through 2026. Older eras extend the pool back to the late 1980s (see Historical data). Counts below are rough estimates, not a hard count.

| Tier | Approx. count | Examples | Use for |
| --- | --- | --- | --- |
| Iconic duels (title fights, famous strategy calls) | 40–60 | Abu Dhabi 2021, Silverstone 2021, Hungary 2019, Monza 2021, Brazil 2024 | Weekends, race weeks, anniversaries |
| Good battles (win or podium decided by strategy) | 150+ | About one per race | Weekdays |
| Any battle where strategy matters, incl. midfield points fights | Many hundreds | Several per race | Weekdays; fans of smaller teams like Alpine, Aston Martin, Haas |

A daily needs 365 races a year, so the calendar mixes all three tiers.

## Historical data

Every era back to Senna can be in the game, but each older era has less public data. Schumacher-era races can be mostly automated from lap times; Senna-era races must be hand-built from lap charts and race reports.

| Era | Public data | Missing | How to fill it |
| --- | --- | --- | --- |
| 2018–now | [FastF1](https://docs.fastf1.dev/data_reference/index.html): lap times, tires, pit stops, weather, race control, positions | Nothing major | Automated pipeline |
| 2011–2017 | [Jolpica-F1](https://www.mintlify.com/TracingInsights-Archive/Stats/data-collection/overview): lap times and pit stops | Tire compounds, safety car laps, weather | Hand-enter from race reports |
| 1996–2010 (Schumacher era) | Jolpica-F1: lap times | Pit stops, fuel loads, tires, safety cars | Infer stops from slow in- and out-laps; estimate fuel loads; hand-enter events |
| Before 1996 (Senna era) | Jolpica-F1: results and qualifying only | All lap timing | Hand-build from published lap charts and race reports |

Jolpica-F1 is the maintained successor to the shut-down Ergast API, with the same interface. FastF1 already wraps it, so the pipeline needs no new library.

### Why results aren't enough

Results are the final scorecard: finishing order, grid, total race time, laps completed and retirement reasons. The game needs the state of the race on every lap: each car's position and gap, who had pitted, what tires they were on, and how fast they were lapping. It's the difference between a box score and play-by-play, and for the Senna era only the box score exists in an API. The reconstruction pipeline below fills that gap.

### Each era plays differently

The simulator needs a rule set per era, because the strategy calls themselves change.

| Era | Main strategy problem | Calls the user makes |
| --- | --- | --- |
| 2026 onward | Battery energy: about half the power is electric, but recoverable energy is limited | Deploy or harvest; when to spend energy to attack or defend |
| 2014–2025 | Tire wear, plus fuel and energy saving | Undercut or overcut, pit under a VSC, how hard to manage the tires |
| 2010–2013 | Fast-wearing tires, no refueling | Two stops or three, when to switch tires |
| 1994–2009 | Fuel load: it sets how long a car runs and how heavy it is | Fuel at each stop, short-fill to jump a rival, push on light fuel |
| Late 1980s–1993 | Tires and weather, plus fuel limits | Tire changes in mixed weather, saving fuel to reach the finish |

- **Example races.** Schumacher's switch to three stops at Hungary 1998 for the refueling era; Donington 1993 for mixed-weather tire calls.
- **2026 energy.** A car with a full battery can pass one with an empty battery easily, so deploy versus harvest is a real call. Albert Park in Australia was especially hard on energy in the opening round. The public timing feed doesn't include battery charge, so it must be estimated from speed traces (a car losing top speed on a straight is running out of energy). Pick the best 2026 energy races by rewatching them; they haven't been identified yet.
- **Radio by era.** Team radio was limited in older eras. For those races the headset becomes a pit board: fewer, blunter messages.

### Race reconstruction pipeline

For races without lap data, the pipeline derives believable lap-by-lap timing from what is known. Results fix the end of the race; facts from the middle of the race narrow down how it got there. Results alone aren't enough: many different races end with the same result.

#### Inputs

| Input | What it constrains | Source |
| --- | --- | --- |
| Final results and total times | Each car's lap times must add up to its total time | Jolpica-F1 |
| Position on each lap | Who was ahead of whom at every point | Lap charts; Wikipedia lap leaders |
| Pit stop and retirement laps | When cars lost time or dropped out | Race reports, read by an LLM |
| Fastest laps and the lap they were set on | How fast each car could actually go | Formula1.com results archive |
| Weather and incidents | Laps where everyone slowed down | Race reports |

Position on each lap is the most valuable input. With it and the official totals, the reconstruction is solid; without it, the middle of the race is guesswork. Hunt for lap-by-lap positions first for each Senna-era race.

#### Layers

1. **Structured data.** Results, grid, retirement laps and fastest laps from Jolpica-F1 and the Formula1.com results archive, which lists fastest laps with lap numbers for races back to the 1980s.
2. **Semi-structured data.** Wikipedia race articles: summaries, retirements, lap leaders. Openly licensed (CC BY-SA), usable with attribution.
3. **LLM extraction.** Claude reads race reports with a fixed output schema and returns events ("lap 34, Senna pits, slicks to wets") with the source sentence for each, so every event can be checked.
4. **Reconstruction solver.** Solves for lap times that satisfy every constraint at once: totals, positions, pit and retirement laps, fastest laps. The result must pass the same validation test as every other race.
5. **Authoring tool.** An internal admin page to review extracted events, hand-enter lap charts, and fix anything wrong. It writes the same race model JSON as the automated pipeline.

#### Stack and terms

- **Stack:** Python with requests and BeautifulSoup (Playwright for JavaScript-heavy pages), the Claude API with a JSON schema for extraction, SciPy for the solver.
- **Terms:** facts like lap numbers and positions generally aren't copyrightable, but site terms often forbid scraping. Formula1.com and paid lap-chart sites like Forix likely do. Wikipedia and Jolpica-F1 are the safe base; for the rest, read the terms, ask permission, or hand-enter. Only 20–30 iconic Senna-era races are needed, so hand entry is realistic.

### Plan and caveats

1. **Launch** with 2018 onward.
2. **2026 energy races** next, to get the newest mechanic in early.
3. **2011–2017**, with tire compounds and events hand-entered.
4. **Schumacher era**, mostly automated from Jolpica-F1 lap times, with pit stops inferred and fuel loads estimated.
5. **Senna era** last: build the reconstruction pipeline for a curated set of iconic races.

- **Label reconstructions.** Mark rebuilt races "Reconstructed" in the UI so fans know the data isn't official timing.
- **Terms of use.** Ergast data came with its own terms of use. Check Jolpica-F1's terms before relying on it commercially.

## Grading and scoring

Every call is graded on how it changed the user's chance of the target result, not on whether it worked. A good call that didn't pay off is still a good call.

- **How a call is graded.** At each decision, the simulator runs every option the user had a few hundred times and measures each option's chance of the target result (win, beat the rival, or finish position). The user's call is compared with the best option.
- **Grade bands.** Green: best call, or within half a point of the best. Yellow: close. Orange: costly. Red: a big miss.
- **Real-team comparison.** Each call also shows what the real team did and how that call grades, so the user can see whether they beat the real strategists.
- **End of race.** The result, a grade per call, a percentile against everyone who played, and a rank on the daily leaderboard.
- **Strategist persona.** The user's calls are matched to a real team's style, such as "You strategize like Ferrari 2022." F1 fans joke about Ferrari strategy constantly, so this is the most shareable line.
- **Share card.** Spoiler-free: result, call grades as colored squares, percentile. Example: "You won Lewis his 8th | 4/4 elite calls | P97."
- **Fairness.** Each daily race uses a fixed random seed, so everyone faces the same race, and the server can replay any submitted run to verify the score.

## Design decisions

### 1. Pace the race around decisions, not laps

- Laps tick by automatically, about 3–5 seconds each, with a live timing tower and gap to the rival.
- A BOX button is always live, so the user can call a stop at any time. That standing option creates the tension.
- The game pauses only at real decision moments: safety car or VSC, gap entering undercut range, tire cliff, rain starting, or the rival pitting.
- Takeover starts a few laps before the first real decision. Target 2–4 real calls and 3–5 minutes per race.

### 2. Abu Dhabi 2021 shows where the idea breaks

- **The Red Bull side is too easy.** Pitting Max for fresh softs under the late safety car cost nothing. So the user always runs Mercedes. The same rule applies to every race: the user gets the side with the hard or controversial call.
- **Mercedes fans know the answer.** Start at the VSC around lap 36, the real first dilemma: Red Bull pitted Max for fresh tires and Mercedes kept Lewis out. Grade against the sim's best call, not hindsight, since pitting from the lead hands Max track position.
- **Race control can't be simulated.** The finish hinged on a contested ruling about which lapped cars could unlap. Rule: crashes, safety cars and weather happen when they really did, and their timing doesn't change.

### 3. The direct rival must react

The earlier plan had rivals follow their real strategies. That doesn't hold: if the user pits Lewis under the safety car, Red Bull would respond. Give the direct rival a simple reactive policy (cover the stop, go long, or switch tires), or users will exploit a rival that never responds. The rest of the field keeps its real strategies.

### 4. Add decision types beyond pit calls

- **Tire management:** push or conserve, which changes both pace and wear. The most common real call.
- **Team orders:** let a teammate past, or have him hold up the rival. Pérez holding up Hamilton was decisive in Abu Dhabi 2021.
- **Driver instructions:** defend or attack, save energy or deploy it.

### 5. Hide non-iconic races until the end

Show a "Mystery race" setup such as "You're P3, 8 laps left, 2.1s behind" and reveal the race at the end. Guessing the race is a second hook and stops users playing from memory. On iconic days, lead with the name, since the name is the draw.

## Headset calls

The headset gives the user something to do on every lap, which fixes the quiet-lap problem without forcing a prompt every lap. Pit calls become one tab among several.

### Two kinds of radio

- **Standing modes** sit on the headset panel and stay set until the user changes them. The user can flip them any lap, and their effect builds over time.
- **Radio moments** pop up at decision points, often as a message from the driver that the user must answer.

### Standing modes

| Mode | Options | Sim effect (to calibrate) |
| --- | --- | --- |
| Pace | Push / Standard / Manage tires | Push is faster per lap but wears tires faster and adds error risk; Manage does the reverse |
| Energy | Deploy / Balanced / Harvest | Limited battery budget per stint; Deploy helps attack and defend, Harvest stores it for later |
| Fuel | Normal / Lift and coast | Slower laps in exchange for fuel or brake margin |
| Battle stance | Attack / Hold gap / Defend | Attack raises overtake chance and risk; Defend lowers the rival's chance but costs time |

### Radio moments

- **Driver asks for a stop.** "Tires are gone, box?" The user decides whether to trust it. Drivers are sometimes wrong, which makes this a real call.
- **Team orders.** Swap positions with your teammate, or have him hold up the rival.
- **Fight or let go.** "Don't fight him, we're racing someone else" versus defending hard.
- **What to tell the driver.** Give the true gap, or hold information back to keep him calm. This could tie into an error-rate mechanic.
- **Penalties.** Give a place back now, or risk a time penalty for gaining an advantage off track.
- **Car problems.** Brake temps rising or damage after contact: manage it, keep pushing, or retire the car.
- **Weather.** "Rain at turn 4": stay out on slicks, or switch now.

### Notes

- The sim effects of radio calls can't be measured directly from FastF1. They'll be calibrated estimates, tuned until replays feel right.
- Write original radio lines. Don't reuse real team radio quotes.
- Cap each pause at 3–4 options so decisions stay quick.

## Simulation model

The simulator is the product's core and its biggest risk. If it can't reproduce real races, its "what if" answers can't be trusted.

### The race model file

The Python pipeline turns raw FastF1 timing for each race into one compact JSON file of fitted parameters and an event timeline, a few hundred KB instead of gigabytes of telemetry.

```json
{
  "race": { "id": "abu-dhabi-2021", "laps": 58, "takeoverLap": 34, "seed": 81723 },
  "track": { "pitLoss": 21.4, "pitLossUnderSC": 12.1, "overtakeDifficulty": 0.62, "dirtyAirPenalty": 0.35 },
  "compounds": {
    "SOFT":   { "offset": 0.0,  "degPerLap": 0.085, "cliffLap": 18 },
    "MEDIUM": { "offset": 0.45, "degPerLap": 0.05,  "cliffLap": 30 },
    "HARD":   { "offset": 0.85, "degPerLap": 0.03,  "cliffLap": 45 }
  },
  "drivers": [
    { "code": "HAM", "team": "Mercedes", "basePace": 87.9, "noise": 0.25,
      "stateAtTakeover": { "position": 1, "gapAhead": 0, "compound": "HARD", "tyreAge": 20 },
      "realStrategy": [{ "lap": 14, "to": "HARD" }] }
  ],
  "fuelEffectPerLap": 0.055,
  "events": [
    { "lap": 36, "type": "VSC", "laps": 2 },
    { "lap": 53, "type": "SC", "laps": 4 }
  ],
  "decisionMoments": [36, 45, 53, 58],
  "realResult": ["VER", "HAM", "SAI"]
}
```

Values above are illustrative, not fitted.

| Field | What it holds | How it's derived |
| --- | --- | --- |
| track.pitLoss / pitLossUnderSC | Time a stop costs, normally and under a safety car | Measured from real stops at that track |
| track.overtakeDifficulty | How likely a faster car gets past | Estimated from real passes vs pace gaps |
| track.dirtyAirPenalty | Time lost per lap stuck behind a car | Estimated from following-car lap times |
| compounds | New-tire offset, wear per lap, cliff lap per compound | Fitted from real stints |
| drivers.basePace / noise | Underlying pace with tire and fuel removed; lap-to-lap inconsistency | Fitted per driver |
| drivers.stateAtTakeover | Real position, gap, compound, tire age at takeover | Read from timing data |
| drivers.realStrategy | What each team really did | Read from timing data |
| fuelEffectPerLap | Pace gained as fuel burns off | Fitted; without it, tire wear looks wrong |
| events | Safety cars, VSCs, rain, retirements on the laps they happened | Race control and timing data |
| decisionMoments | Laps where the game pauses for a call | Hand-picked per race, or detected |
| realResult | Actual finishing order | Timing data |

### Lap-time formula

```latex
t_{lap} = basePace + offset_{c} + deg_{c} \cdot age + cliff(age) - fuel \cdot lap + traffic + radio + \varepsilon
```

The radio term is the effect of the user's headset modes (push, manage, deploy, defend). It can't be measured from FastF1, so those values are calibrated estimates. Each lap the sim runs this for every car, applies pit stops and events, and decides overtakes from the gap, the pace difference and overtakeDifficulty.

### Rules

- **Fixed events.** Crashes, safety cars and weather happen on the laps they really did, whatever the user does. Race control decisions are frozen.
- **Reactive rival.** The direct rival follows a simple policy that responds to the user: cover a stop, go long, or switch tires. The rest of the field follows its real strategies.
- **Seeded randomness.** One seed per daily, so the race is identical for everyone and replayable on the server.

### Validation test

Feed every team's real strategy into the sim. It must reproduce the real finishing order and gaps within a few seconds per driver. Run this on every race before it enters the daily pool.

## Tech stack

Heavy work happens offline in Python, the simulator runs in the browser, and a thin serverless backend handles scores. Hosting stays close to free and every call feels instant.

| Layer | Choice | Why |
| --- | --- | --- |
| Data pipeline | Python, FastF1, Jolpica-F1 API, pandas; plus a hand-entry authoring tool for older races | FastF1 only exists in Python. Runs offline (locally or in GitHub Actions), never on a server. |
| Race model output | One JSON file per race | Fitted parameters plus event timeline; small enough to ship to the browser. |
| Simulator | TypeScript, runs in the browser | Thousands of sims in milliseconds with no server cost. The same code runs in the Worker to verify scores. |
| Frontend | Vite + React + Tailwind (or Next.js static export) | Standard and fast. SVG for the track map and timing tower. |
| Backend | Cloudflare Workers + D1 (SQLite) | Leaderboards, daily race selection, percentiles, score verification. |
| Hosting | Cloudflare Pages | Free tier, global CDN, same platform as the Workers. |
| Users | Anonymous ID in localStorage at launch; Supabase Auth or Clerk later | No login wall for the daily. Accounts arrive with Historical Season. |
| Analytics | PostHog or Plausible | Funnel: started, finished, shared. |

The simulator is written in TypeScript rather than Python so one engine runs in both the browser and the Worker. Without server-side verification, anyone can post a perfect score from the browser console.

## Architecture

&#91;embedded content: architecture · build time and play time\]

The pipeline runs offline once per race. At play time the browser runs the simulator and grades calls, and the Worker reruns the same simulator from the seed before any score reaches the leaderboard.

## Example flow: Abu Dhabi 2021 as Mercedes

About four minutes, four decisions, each one heavy.

1. **Lap 36, VSC.** Max pits for fresh hards. Do you cover?
2. **Lap \~45.** The gap is shrinking fast. Push, or save the tires?
3. **Lap 53, safety car.** Pit from the lead, or stay out?
4. **Last lap, after the restart.** Attack or defend instructions, then the result.

Example share card: "You won Lewis his 8th | 4/4 elite calls | P97." Don't fill the quiet laps with forced decisions.

## Build plan

The Daily Race can launch in about four weeks if the simulator passes validation in week 1. Nothing else starts until it does.

| Phase | Scope | Exit criteria |
| --- | --- | --- |
| Week 1 | Python pipeline for one race (Abu Dhabi 2021) | Sim reproduces the real finishing order and gaps within a few seconds per driver |
| Week 2 | Port the sim to TypeScript; bare-bones UI with timing tower, BOX button, decision prompts, result screen | TypeScript output matches the Python reference |
| Week 3 | Grading, headset modes, share card, Worker leaderboard with score verification; 10–15 more races | A full daily playable end to end |
| Week 4 | Track map, radio-style prompts, polish; launch on r/formula1 and F1 Twitter | Public launch |
| Phase 2 | Survivor mode; grow the race pool toward a full year of dailies | 365 validated race situations queued |
| Phase 3 | Accounts and Historical Season mode | First full season playable |

## Risks

Simulator realism and data rights are the two risks that could sink the product; the rest are design problems with known fixes.

| Risk | Why it matters | Mitigation |
| --- | --- | --- |
| Simulator realism | F1 fans will spot a fake-feeling undercut immediately | Validation test on every race; spend most effort on tire wear, traffic and overtaking difficulty |
| Data rights | FastF1 pulls F1's live timing feed, owned by Formula One Management; unlike nflverse, it isn't openly licensed | Keep it non-commercial-looking at first; read FOM's terms before turning on ads |
| Trademarks | "F1", team logos and liveries are protected | No F1 wordmark, logos or liveries; "not affiliated" disclaimer; final name must drop "F1" |
| Frozen events | Users may argue a call would have changed race control decisions | State the rule up front: events happen when they really did |
| Exploitable rivals | Rivals that ignore the user's moves are easy to game | Reactive policy for the direct rival |
| Radio effects are guesses | No data on what push or defend does to pace | Calibrate until replays feel right; keep effects modest |
| Content runway | Iconic duels run out in about two months | Mix in podium and midfield battles; Mystery Race format |
| Lopsided sides | One side of a duel can be trivially easy (Red Bull at Abu Dhabi) | Always assign the side with the hard or controversial call; never offer the easy side |

## Market

The licensed F1 manager game has been discontinued, and the daily-game format is proven in the NFL. Competing F1 daily games haven't been surveyed yet.

- **[Two-Minute Drill](https://nfl2mindrill.com)** proves the format. It's a free, fan-made daily game built on public nflverse data: one real NFL ending per day, every call graded on win chance, then a percentile, a rank and a matching head coach. It runs on Cloudflare Workers with ads and a Pro tier.
- **F1 Manager is gone.** [Frontier ended the F1 Manager series](https://traxion.gg/f1-manager-2025-cancelled-as-sales-below-expectations) after sales stayed below expectations, and F1 Manager 2024 was the last release. Fans on Steam are still asking for a replacement, so demand exists, but a full licensed manager game is a large build. A daily browser game is a far smaller bet that serves the same itch.
- **Audience.** F1 fans are online and argue about strategy calls after every race. Iconic races carry built-in nostalgia, and fans of smaller teams get almost no content about their own team, which midfield dailies can serve.

## Open questions

- [ ] **Name.** "F1 Pit Wall" is a working name; the final name can't use the F1 wordmark.
- [ ] **Competitors.** Are there existing F1 daily strategy or prediction games? Survey before launch.
- [ ] **Data terms.** What do FOM's terms allow for fan projects using live timing data, with and without ads?
- [ ] **Monetization.** Ads, a Pro tier (archive of past dailies, unlimited Survivor), or both? Not before the data terms question is answered.
- [ ] **Side assignment.** Decided: always the hard or controversial side. Still open: how to choose when both sides faced hard calls.
- [ ] **Decision moments.** Hand-pick per race, or detect automatically from the race model? Hand-picking won't scale to 365 races.
- [ ] **Accounts.** Which auth provider for Historical Season, and how anonymous progress carries over.

## Sources

- [Two-Minute Drill](https://nfl2mindrill.com): the NFL daily game this is modeled on
- [F1 Manager 2025 reportedly cancelled as sales below expectations (Traxion)](https://traxion.gg/f1-manager-2025-cancelled-as-sales-below-expectations)
- [Frontier ends F1 Manager series due to lack of success (Galaxus)](https://galaxus.de/en/page/frontier-ends-f1-manager-series-due-to-lack-of-success-35710)
- [FastF1](https://github.com/theOehrly/Fast-F1): Python library for F1 timing data
- [FastF1 data reference](https://docs.fastf1.dev/data_reference/index.html): timing data from 2018; older results via Jolpica-F1
- [F1 Stats Archive data availability](https://www.mintlify.com/TracingInsights-Archive/Stats/data-collection/overview): Jolpica-F1 lap times from 1996, pit stops from 2011
- [Why the 2026 rules turned strategy into an energy battle (Grandprix247)](https://www.grandprix247.com/formula-1-news/why-the-2026-formula-1-rules-has-turned-race-strategy-into-an-energy-management-battle)
- [Albert Park exposes the 2026 energy problem (PlanetF1)](https://www.planetf1.com/f1-data/f1-2026-energy-problem-albert-park-battery-recovery)
- [Formula1.com results archive: Monaco 1988 fastest laps](https://www.formula1.com/en/results.html/1988/races/529/monaco/fastest-laps.html)

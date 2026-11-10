# Three Era 3 races swapped by robust-G1 stats (owner pre-approved, Nov 9, overnight): owner sign-off

The owner pre-approved (Nov 9) swapping each failing Eras race for the next-best race by stats.
Era 3 had four failing races (hungary-1997, belgium-1998, malaysia-1999, europe-1999) and three
picks that pass robust G1, so the three with the worst robust-G1 mean gap error went out, worst
first, each replaced by the best remaining pick in the same era and slot, as in the earlier
swaps (`swap-races.md` / migration 0012, `swap-races-e10-e9.md` / 0013,
`swap-races-e10-e9-b.md` / 0014). D1 migration 0022 renames the three `era_races` rows.
hungary-1997 (fail, 2.57 s, the fourth-worst) stays in place.

Every fact below was read in the linked source on Nov 9, 2026; nothing comes from memory.
Where sources disagree, the row says so. "Not in sources" means no opened source gave the
number. Check each row against its links and put your initials and the date in
**Owner checked**.

| Era / slot | Removed | Removed race's robust G1 | Replacement | Replacement's robust G1 (mean gap error) |
|---|---|---|---|---|
| 3 / #10 | `europe-1999` | fail, 10.26 s (field SCH gap error, the second shower's wet pace) | `san-marino-1999` | pass, 0.91 s (strict pass) |
| 3 / #8 | `belgium-1998` | fail, 5.11 s (field DIN gap error, the SC restart) | `germany-1996` | pass, 1.27 s (strict pass) |
| 3 / #9 | `malaysia-1999` | fail, 2.96 s (duel IRV vs HAK gap error, Ferrari's team orders) | `germany-1997` | pass, 1.41 s (strict pass) |
| 3 / #5 | `hungary-1997` | fail, 2.57 s | stays | – |

The removed races' numbers are from `docs/eras-races-report.md`. The replacements' numbers were
measured on an Eras build with a rules-only overlay (`pipeline build <id>`, then
`pipeline validate <id> --robust`, one race per call) and re-measured on this branch with the
same result. Their raw data (Jolpica laps, F1DB stops and fastest laps) was ingested by the
Era 3 scout.

The replacements are not authored yet (no `eras` block): side (`pipeline hard-calls`), target,
storyline, mastery, hidden objective and briefing come in B1. The proposals below are drafts,
and so are the spec §4 rows written from them. The `user_side` / `rival` pairs in `build.py`
(MSCM vs COU, HIL vs BER, BER vs FIS) are provisional; `pipeline hard-calls` settles each one.
The removed races keep their race files, overlays, build entries, track files and incidents as
Eras-build fixtures.

**Wording check needed:** san-marino-1999's Jolpica grid puts Villeneuve 14th and Trulli 5th,
where Wikipedia and GrandPrix.com have Villeneuve 5th; check the built race's grid before
authoring. germany-1997's GrandPrix.com race report could not be opened (HTTP 429); nothing in
its section relies on it.

## san-marino-1999 (1999 San Marino Grand Prix)

Replaces `europe-1999` (Era 3 #10). Robust G1: pass, mean gap error 0.91 s.

### Sources

| Short name | What | URL |
|---|---|---|
| WP | English Wikipedia race article | https://en.wikipedia.org/wiki/1999_San_Marino_Grand_Prix |
| AS-L | Autosport (Atlas F1) race review and lap-by-lap, Lupini | http://atlasf1.autosport.com/99/san/lupini.html |
| AS-T | Autosport (Atlas F1) column on overtaking/traffic, Tytler | http://atlasf1.autosport.com/99/san/tytler.html |
| GPE | GrandPrix.com race report and classification | https://www.grandprix.com/gpe/rr633.html |
| Jolpica | Results, `api.jolpi.ca/ergast/f1/1999/3/results.json` | https://api.jolpi.ca/ergast/f1/1999/3/results.json |

OpenF1, TUM and Jolpica pit-stop data do not cover 1999. No Motor Sport race report was found
(only its database entry). F1DB was not consulted.

### Facts

| Topic | Fact | Sources | Owner checked |
|---|---|---|---|
| Date / laps | 2 May 1999, Imola, 62 laps, 305.660 km | WP, GPE, Jolpica | |
| Weather | "Sunny, mild, dry, 23 °C" (WP infobox). AS-L and GPE do not mention weather | WP | |
| Grid top 6 | Häkkinen (McLaren) 1:26.362, Coulthard (McLaren) 1:26.384, M. Schumacher (Ferrari) 1:26.538, Irvine (Ferrari) 1:26.993, Villeneuve (BAR) 1:27.313, Barrichello (Stewart) 1:27.409 | WP, GPE | |
| Grid discrepancy | Jolpica gives Villeneuve grid 14 and Trulli grid 5; WP and GPE give Villeneuve 5th (GPE: Trulli 14th). Taken: WP/GPE. Check before a build uses Jolpica grids | WP, GPE, Jolpica | |
| Grid penalties | None in sources | WP, GPE, AS-L | |
| SC / VSC / red flag | None mentioned in any source (no safety car rule applies only before 1993, so a real SC would have been reported) | WP, AS-L, GPE | |
| Start | Häkkinen led from Coulthard and M. Schumacher. Villeneuve stayed on the grid (no gears; gearbox, 0 laps). Trulli went off at Tamburello on lap 1 (0 laps); AS-L says he made contact with de la Rosa | WP, AS-L, GPE | |
| Early strategy read | AS-L lap 1: Häkkinen "almost certainly on a two stop strategy", Coulthard "on a one stop". GPE: Häkkinen was "on a different strategy to Coulthard" | AS-L, GPE | |
| Gaps, opening stint | Lap 7: McLarens 5.4 s apart, Coulthard 3.3 s ahead of Schumacher. Lap 17: Häkkinen's lead ~12 s (AS-L) / 13 s at end of lap 17 (GPE) | AS-L, GPE | |
| Häkkinen crash | Went into the wall exiting the final chicane, driver error he admitted. Lap: 17 laps completed (WP, GPE, Jolpica); AS-L lap-by-lap puts it on lap 18 "after completing the previous lap", its report text says while completing his 16th lap. Taken: 17 laps completed | WP, AS-L, GPE, Jolpica | |
| After lap 17 | Coulthard led Schumacher by 3.7 s; Irvine 9.7 s back in 3rd. Lap 23: still 3.3 s between Coulthard and Schumacher | AS-L | |
| Schumacher stop 1 | Lap 31, short: 6.9 s (AS-L lap-by-lap) / 6.1 s (AS-L report text). Pitted "long before his expected single stop"; first lap after it was half a second quicker than Häkkinen's best. Fill size: not in sources (only "so little fuel") | AS-L | |
| Coulthard stop | Lap 35, 9.2 s, "fullish fuel load"; one stop only. Rejoined behind Schumacher | AS-L | |
| Ferrari decision | Schumacher: "We left ourselves the option of a one or two stop race depending on the circumstances ... I could tell David was on a one stop race but the final decision was up to Ross Brawn." (Driver press quote, not team radio.) WP: Schumacher stopped earlier and for less time, which let him pass Coulthard | AS-L, WP | |
| Traffic | Lap 37 on: Coulthard held up by backmarkers, gap 6.8 s to 19 s in four laps; past them by lap 42 (gap 20 s). Ron Dennis said backmarkers took away Coulthard's chance to win; Coulthard called the traffic the worst he could remember | AS-L, AS-T | |
| Schumacher stop 2 | Lap 45 from the lead, "a quick stop", with a 23 s gap (AS-L lap-by-lap; report text: "safe 22 second lead"). Duration and fill: not in sources. Rejoined in the lead | AS-L, WP | |
| Closing gaps | Lap 49: 7.1 s; lap 55: 5.7 s; finish 4.265 s | AS-L, Jolpica | |
| Compounds | Not in sources (1999 grooved tyres; no compound per stint reported) | — | |
| Other stops | Irvine lap 29 (8.3 s, one stop). Hill laps 29 (7.6 s) and 49 (6.6 s). Barrichello laps 24 (8.1 s) and 43. Alesi three stops, laps 15, 30, 45. Herbert lap 31, 13 s, full fuel. Fisichella first stop lap 35, 11.4 s | AS-L | |
| Retirements | Irvine engine, 3rd at the time: 46 laps (Jolpica, GPE); WP text and AS-L say lap 47. Frentzen spun off on Irvine's oil (46 laps). R. Schumacher 28 laps (Jolpica: throttle; GPE: engine; AS-L: airbox fire). Herbert engine 3 laps from the end, Zanardi spun on its fluid (both 58 laps, classified 10th/11th). Wurz and de la Rosa collided at Tosa, lap 5. Panis 48 (throttle), Diniz 49 (spun), Takagi 29 (fuel pressure) | WP, AS-L, GPE, Jolpica | |
| Team orders | None in sources. Contact: Wurz/de la Rosa lap 5; Trulli/de la Rosa at the start (AS-L) | WP, AS-L | |
| Penalties | None in sources | WP, GPE | |
| Top 6 | 1 M. Schumacher (Ferrari) 1:33:44.792; 2 Coulthard +4.265; 3 Barrichello +1 lap; 4 Hill +1 lap; 5 Fisichella (from 16th) +1 lap; 6 Alesi +1 lap | WP, GPE, Jolpica | |
| Minor discrepancy | 7th: Jolpica/WP Salo (BAR); GPE prints Zonta | Jolpica, GPE | |

### Proposal (draft)

- **Storyline drivers:** Häkkinen (crash from a ~12-13 s lead, 17 laps) and Irvine (engine,
  from 3rd, lap 46/47).
- **Dilemma:** Coulthard is on one long stop; Ferrari can switch to two short ones and
  sprint, but backmarkers decide whether it pays.
- **Side:** Schumacher (the strategy call is Ferrari's). Coulthard is the alternative
  (beat-rival, one stop); the hard-call counter picks the side at build time.
- **Target (draft):** win: Schumacher from P3, two stops.
- **Side really won?** Yes, so no rewrite (history book).
- **Risk: medium.** No SC and a clean dry race help; the key stop laps (31/45, 35) come from
  one source (AS-L), fill sizes and compounds are not in sources, two stop durations and the
  Häkkinen/Irvine laps conflict, and Jolpica's Villeneuve/Trulli grid swap must be corrected
  if a build reads it.

## germany-1996 (1996 German Grand Prix)

Replaces `belgium-1998` (Era 3 #8). Robust G1: pass, mean gap error 1.27 s.

### Facts

| Topic | Facts verified | Sources | Owner checked |
|---|---|---|---|
| Event | Round 11 of 1996, Hockenheimring, 28 July 1996. 45 laps of 6.823 km (307.035 km). | WP, Jolpica | |
| Grid top 6 | Hill 1:43.912, Berger 1:44.299, Schumacher 1:44.477, Häkkinen 1:44.644, Alesi 1:44.670, Villeneuve 1:44.842. Then Coulthard 7, Irvine 8, Barrichello 9, Brundle 10. Hill took pole on a late run in the final minutes (AS, GPE). | WP, AS, GPE, Jolpica (grid) | |
| Grid penalties / qualifying issues | No grid penalties in sources. Minardi protested Hill's pole (he missed a weight check); the stewards threw it out (GPE, AS). Lavaggi (Minardi) outside 107%, did not start. Forti withdrew. Villeneuve "ran into trouble with the stewards for crossing the track" on Saturday (GPE); no penalty outcome in sources. | GPE, AS, WP | |
| Weather | Race dry. WP infobox: sunny, dry. AS: brief showers in the morning, race "hot and dry". GPE: cloudy Sunday; rain after the warm-up meant an extra 15-minute practice session. | WP, AS, GPE | |
| SC / VSC / red flag | None reported in any source opened (no source mentions a safety car or a stoppage). VSC did not exist in 1996. | WP, AS, GPE | |
| Start | Hill (and Schumacher) started badly; Berger and Alesi passed Hill into Turn 1. Order at the first chicane: Berger, Alesi, Hill, Schumacher, Villeneuve, Coulthard (AS). Schumacher squeezed Häkkinen toward the pit wall and Häkkinen backed off (GPE). Coulthard passed Villeneuve for 5th on lap 1 (AS, GPE). | AS, GPE | |
| Lap leaders | Berger laps 1-23, Hill 24-34, Berger 35-42, Hill 43-45. | WP (lap-leader chart) | |
| Strategy, top teams | Hill on two stops; both Benettons on one (GPE, AS). Schumacher and Villeneuve stopped once (AS lap-by-lap: "one and only stops"). Coulthard and Irvine on two (AS). The Benettons held Hill up in the first stint; Williams brought Hill in late with a small fuel load so he would have clear track while the Benettons stopped (GPE). | GPE, AS | |
| Stops: Hill | Lap 20, 8.1 s, "just 8.1s worth of fuel", rejoined behind Schumacher and Villeneuve (AS). Lap 34, 8.2 s; his lead over Berger was 16.7 s against about 26 s needed, so he rejoined behind Berger (AS; GPE: "came in on lap 34 and emerged just behind Berger, but ahead of Alesi"). Fastest laps on laps 22-26, best 1:46.504 (AS; WP fastest lap lap 26). Fuel in litres: not in sources. | AS, GPE, WP | |
| Stops: Benettons | Alesi lap 22 (10.3 s); Berger lap 23 (11.2 s). Benetton fuelled to the finish (AS). | AS | |
| Stops: others | Schumacher and Villeneuve lap 22 (11.7 s, 11.3 s) and nearly collided leaving the pits (AS; GPE: Schumacher swerved into Villeneuve's path). Villeneuve then passed Schumacher at the first chicane (lap 23, AS). Coulthard laps 16 and 33 (7.6 s, 7.0 s). Irvine laps 15 and 31 (9.9 s, 7.7 s). Häkkinen lap 13 (8.3 s). Panis lap 8 (flat-spotted tyres), then again at mid-distance (GPE). Brundle lap 23, puncture (AS, GPE). | AS, GPE | |
| Tyre compounds | Not in sources. | | |
| Final laps | Hill attacked Berger for laps 35-42 but could not pass. Berger's Renault engine failed exiting the Clark chicane on lap 43 (AS: "two laps to go"; GPE: "three laps from home"; MS: "within two and a half laps"). Jolpica: Berger 42 laps, Engine, classified 13th. | AS, GPE, MS, Jolpica, WP | |
| Top 6 with gaps | Hill 1:21:43.417; Alesi +11.452; Villeneuve +33.926; Schumacher +41.517; Coulthard +42.196; Barrichello +1:42.099. Panis 7th +1:43.912. | Jolpica, AS, GPE | |
| Retirements | Verstappen lap 1: AS says he ran into Herbert at the first chicane; GPE says contact with Katayama (front wing damage, clutch burned out rejoining). **Sources disagree on whom he hit.** Häkkinen lap 13, gearbox/transmission leaving the pits. Diniz 19 laps (Jolpica: engine; GPE: throttle). Katayama spun/crashed (AS lap 20; Jolpica 19 laps). Herbert 25 laps (Jolpica: vibrations; GPE: gearbox electronics; AS: downshift problems). Irvine lap 35 (AS; Jolpica 34 laps, engine; GPE: gearbox oil lost). Berger lap 43, engine. | Jolpica, AS, GPE | |
| Penalties / team orders | No race penalties in sources. No team orders in sources. Panis was shown the chequered flag a lap early and ignored it (GPE). | AS, GPE | |
| Championship | After the race: Hill 73, Villeneuve 52 (21 points). | WP, AS | |

### Proposal (draft, for the owner)

| Item | Proposal |
|---|---|
| Storyline drivers | Hill and Berger |
| Dilemma (original wording) | Boxed in behind two one-stopping Benettons: when should Hill make a short first stop to find clear air, and can he build enough of a gap to jump Berger? |
| Side | Hill (to be confirmed by `pipeline hard-calls`). Berger is a poor side: his lap-43 engine failure has no sourced avoidable call. |
| Target (draft) | win: Hill (stretch reading: be ahead of Berger before his lap-43 failure) |
| Did the side really win? | Yes. Hill won, so no rewrite. (He won only after Berger's engine failed; on the road the two-stop lost.) |
| Modelling risk | **Medium** |

**Why medium risk:**
- **Scripted rival retirement decides the win:** Berger's engine failure on lap 43 must be a
  storyline event; with it, "win" may be too easy unless the target needs Hill ahead on merit.
- **Refuelling:** fill sizes in litres are not in sources (only Hill's 8.1 s / 8.2 s stops and
  "fuelled to the finish" for Benetton).
- **No passing for 8 laps:** Hill couldn't pass Berger on laps 35-42; the overtaking model must
  keep that.
- **Lap-1 contact** (Verstappen; sources disagree who) and a pit-exit near-collision
  (Schumacher-Villeneuve), neither involving the storyline cars.
- Not flagged: wet race (dry; morning rain only), SC or red flag (none), grid penalties (none),
  team orders (none).

### Sources

| Short name | What |
|---|---|
| WP | [English Wikipedia, 1996 German Grand Prix](https://en.wikipedia.org/wiki/1996_German_Grand_Prix) and its lap-leader chart [Template:F1Laps1996](https://en.wikipedia.org/wiki/Template:F1Laps1996) (GER) |
| AS | [Autosport (Atlas F1) race review, Toby Waller](http://atlasf1.autosport.com/96/ger/waller2.html), incl. lap-by-lap; stop times there are stationary times |
| GPE | [GrandPrix.com race report "Lucky seven"](https://www.grandprix.com/gpe/rr592.html) |
| MS | [Motor Sport, September 1996, "Benetton: The Great Pretender?"](https://www.motorsportmagazine.com/archive/article/september-1996/16/the-great-pretender/) |
| Jolpica | [Results](https://api.jolpi.ca/ergast/f1/1996/11/results/), fetched 2026-11-09. Jolpica has no pit-stop data for 1996. |

## germany-1997 (1997 German Grand Prix)

Replaces `malaysia-1999` (Era 3 #9). Robust G1: pass, mean gap error 1.41 s.

### Sources

| Short name | What | URL |
|---|---|---|
| WP | English Wikipedia race article | https://en.wikipedia.org/wiki/1997_German_Grand_Prix |
| AS-G | Atlas F1 (Autosport) race review, Max Galvin | http://atlasf1.autosport.com/97/ger/galvin.html |
| AS-O | Atlas F1 (Autosport) 2001 German GP preview, O'Keefe (looks back at 1997) | https://atlasf1.autosport.com/2001/ger/preview/okeefe.html |
| GPE-R | GrandPrix.com, Joe Saward review of the year 1997 | https://www.grandprix.com/features/joe-saward/news-feature-review-of-the-year-1997.html |
| Jolpica | Results, `api.jolpi.ca/ergast/f1/1997/10/results.json` (pit-stop endpoint: no data for 1997) | https://api.jolpi.ca/ergast/f1/1997/10/results.json |

Not opened (HTTP 429 every attempt): GrandPrix.com race report https://www.grandprix.com/gpe/rr607.html.
Nothing below relies on it. Motor Sport has no race report linked on its database page.

### Facts

| # | Fact | Sources | Owner checked |
|---|---|---|---|
| 1 | **Grid:** Berger (Benetton) pole 1:41.873, Fisichella (Jordan) 2nd +0.023, Häkkinen (McLaren) 3rd, M. Schumacher (Ferrari) 4th, Frentzen (Williams) 5th, Alesi (Benetton) 6th; R. Schumacher 7th, Coulthard 8th, Villeneuve 9th, Irvine 10th. Fisichella's first front-row start. | WP, Jolpica | |
| 2 | **Grid penalties:** none in sources. | WP | |
| 3 | **Laps:** 45 (307.035 km). | WP, Jolpica | |
| 4 | **Weather:** "Sunny, dry track" (WP). AS-G does not describe race-day weather. | WP | |
| 5 | **SC / VSC / red flag:** none mentioned in any source (SC era, but none reported). | WP, AS-G | |
| 6 | **Lap 1:** Irvine, on the inside of Frentzen at the first corner, clipped Frentzen's right-front with his left-rear, puncturing both; both out (Jolpica: collision, 1 lap). Frentzen touched Coulthard, damaging his front wing; Coulthard pitted and retired (Jolpica: transmission, lap 1; WP text says damage from the incident). Marques failed before Turn 1 (gearbox, 0 laps). | AS-G, WP, Jolpica | |
| 7 | **Berger's strategy:** two stops, so he needed to build a lead early (GPE-R, AS-G). Led laps 1-16, first stop lap 17 (fuel and tyres), second stop lap 34 (AS-G; AS-O: lap 34). Rejoined behind Fisichella after the lap-34 stop and retook the lead at the second chicane on the same lap (AS-G); "repassed him on fresh tires" (AS-O). GPE-R says a blown engine on Magnussen's Stewart cost him a couple of seconds before that stop; WP says Barrichello's engine smoke. Sources disagree; no lap or gap given. Stop durations: not in sources (AS-G cites a 22 s minimum for the lap-34 stop). | GPE-R, AS-G, AS-O, WP | |
| 8 | **Fisichella's strategy:** one stop, lap 24 (AS-G); led from Berger's first stop until his own stop (GPE-R), and again briefly on lap 34. Left-rear tyre failure with 6 laps to go (AS-G; AS-O: "exploded" on the straight to the stadium); limped to the pits, new tyre, retired with radiator damage (WP: lap 40; Jolpica: 40 laps, classified 11th, +5 laps). GPE-R calls it a costly error under pressure from Berger. | AS-G, AS-O, GPE-R, WP, Jolpica | |
| 9 | **Other stops (AS-G):** M. Schumacher, R. Schumacher, Häkkinen, Villeneuve lap 23; Trulli lap 24 (one stop); Alesi two stops, laps 16 and 31; Hill early (~lap 16, lap not stated). Fuel loads: not in sources. | AS-G | |
| 10 | **M. Schumacher's extra stop:** pitted "with six laps left" on worn tyres and low fuel, a 5.8 s stop, rejoining ahead of Häkkinen (AS-O); "an extra pit stop for fuel" and gearbox trouble (GPE-R). AS-G does not mention it. Exact lap: not in sources. | AS-O, GPE-R | |
| 11 | **Häkkinen:** one stop (lap 23), finished 3rd. | AS-G, AS-O | |
| 12 | **Retirements:** Villeneuve spun off lap 33 (WP: trying to pass Trulli; AS-G: trying to outbrake Fontana into the second chicane; sources disagree). Barrichello engine (33), Salo clutch (33), Magnussen engine (27, Jolpica; AS-G says lap 28), Katayama out of fuel (23), Herbert and Diniz collided (8). | WP, AS-G, Jolpica | |
| 13 | **Penalties / team orders:** none in sources. | WP, AS-G | |
| 14 | **Result:** Berger 1:20:59.046; M. Schumacher +17.527; Häkkinen +24.770; Trulli +27.165 (from 11th); R. Schumacher +29.995; Alesi +34.717. Fastest lap Berger 1:45.747 (lap 9, WP). Berger's 10th and last win; Benetton's last win (AS-O). | Jolpica, WP, AS-O | |

### Strategy dilemmas

- **Berger:** two-stopper needing to pull clear on light fuel; after the second stop he comes
  out behind the one-stopping Fisichella and must pass on track (facts 7-8).
- **Fisichella:** one stop from the front row; can he hold off a lighter, fresher Benetton
  (fact 8)? His race then ends with a tyre failure (no sourced avoidable call).
- **M. Schumacher:** one stop but short of fuel, forced into a late extra stop (fact 10).

### Proposal (draft, for the owner)

- **Storyline drivers:** Berger, Fisichella.
- **Dilemma (original):** "Two stops and a light car against a one-stopping Jordan: make the
  gap, then pass him again."
- **Side:** Berger (to be confirmed by `pipeline hard-calls`). Fisichella is the alternative,
  but his tyre failure is a storyline retirement with no sourced avoidable call, so his side
  can't reach a win (cf. the south-africa-1983 Piquet decision).
- **Target (draft):** win: Berger from pole on two stops.
- **Did that side really win?** Yes, so no rewrite (history book).
- **Risk: medium.** Pros: dry, no SC, clear sourced stop laps for the front-runners.
  Concerns: no lap-time-based stop data (Jolpica has no 1997 pit stops) so stop laps rest on
  AS-G alone; Fisichella's tyre failure and Schumacher's fuel-short stop need FAULT / refuel
  modelling; two source conflicts (Berger delay cause, Villeneuve's spin) to settle; lap of
  Schumacher's extra stop not sourced.

# Seven Era 4 races swapped (owner pre-approved, Nov 9, overnight): owner sign-off

The owner pre-approved (Nov 9) swapping each failing Eras race for the next-best race by the
stats. In Era 4 all seven failing races were swapped: the replacements were picked by robust-G1
mean gap error from the candidates that pass, and paired worst-out with best-in (the removed
race with the worst mean gap error took the best replacement). Each replacement takes the
removed race's slot, as in the earlier swaps (`swap-races.md` / migration 0012,
`swap-races-e10-e9.md` / 0013, `swap-races-e10-e9-b.md` / 0014); this batch is migration 0021.
Every fact below was read in the linked source on Nov 9, 2026; nothing comes from memory. Where
sources disagree, the row says so. Check each row against its links and put your initials and
the date in **Owner checked**.

| Era / slot | Removed | Robust G1 of the removed race | Replacement | Robust G1 of the replacement (Eras build, rules-only overlay) | Owner checked |
|---|---|---|---|---|---|
| 4 / #1 | `germany-2000` | fail, 5.81 s (field DLR gap, the two sourced SCs) | `canada-2003` | pass, 1.00 s mean gap error (new race) |  |
| 4 / #3 | `malaysia-2001` | fail, 7.04 s (field SCH gap, wet pace) | `san-marino-2000` | pass, 0.75 s mean gap error (new race) |  |
| 4 / #5 | `brazil-2003` | fail, 5.55 s (duel FIS vs RAI, last-lap pass) | `hungary-2001` | pass, 1.24 s mean gap error (new race) |  |
| 4 / #6 | `hungary-2003` | fail, 7.08 s (field SCH gap, Williams stint pace) | `austria-2001` | pass, 0.62 s mean gap error (new race) |  |
| 4 / #7 | `united-states-2003` | fail, 10.25 s (duel MSCM vs RAI, Bridgestone wet pace) | `france-2001` | pass, 0.59 s mean gap error (new race) |  |
| 4 / #8 | `japan-2003` | fail, 4.05 s (duel MSCM vs RAI, stint pace) | `italy-2001` | pass, 1.62 s mean gap error (new race) |  |
| 4 / #10 | `monaco-2004` | fail, 4.61 s (podium BAR gap) | `san-marino-2003` | pass, 1.44 s mean gap error (new race) |  |

The removed races' numbers are from `docs/eras-races-report.md` (integration w1/w3). The
replacements' numbers were measured here, one race per call (`pipeline validate <id> --robust`),
on race files rebuilt from the committed ingest output. austria-2001 and canada-2003 pass robust
G1 but not the strict check. japan-2000, austria-2002 and france-2004 (passing, authored) stay.

The replacements are not authored yet (no `eras` block): side (`pipeline hard-calls`), target,
storyline, mastery, hidden objective and briefing come in B1. The dilemmas and targets in the
spec (section 4) and the proposals below are drafts. The `user_side` / `rival` pairs in
`build.py` are provisional and don't always match the proposals: hungary-2001 is built as
MSCM vs BAR (proposal: Coulthard), italy-2001 as MON vs BAR (proposal: Barrichello),
san-marino-2003 as MSCM vs RAI (proposal: Räikkönen) and france-2001 as MSCM vs SCH (proposal:
Ralf Schumacher). `pipeline hard-calls` settles each one.

**Era 4 now has two Imola races** (san-marino-2000 and san-marino-2003) and no Monaco. Both
were picked on the stats alone; a different pick for one of them is the owner's call.

**Sources to know about:** several rows cite Atlas F1 race reviews at atlasf1.autosport.com
(Autosport's archive of its Atlas F1 magazine). If the owner doesn't count that as "Autosport",
those rows need another source (the stop laps also match the Jolpica lap times, as each sheet
says). Jolpica has no pit-stop data before 2011; the build takes stops from F1DB.

**Data entered from these facts:** austria-2001's estimated safety car (laps 2-3 in the Jolpica
estimate; Wikipedia: from lap 1, in at the end of lap 3) is marked `confirmed` in
`data/estimates/austria-2001.sc.json` (no change to the built race: an unchecked "likely"
period applies the same SC). No incidents were entered: the only SC is before the takeover and
no single car caused it. Tomáš Enge (italy-2001, Prost) was added to `data/drivers.json` with
F1DB's code ENG (`2.6-drivers-incidents.md`), and italy-2001 was re-ingested
(`pipeline jolpica italy-2001 --event Italian --force`) so his laps carry that code instead of
Jolpica's reference `enge` (his F1DB stop and fuel stints now join; robust G1 1.66 s -> 1.62 s).

## canada-2003 (2003 Canadian Grand Prix)

Replaces `germany-2000` (Era 4 #1; fail, 5.81 s (field DLR gap, the two sourced SCs)). Robust G1: pass, 1.00 s mean gap error. Built (provisionally) as MSCM vs SCH.

Candidate to replace a failing Era 4 (2000-2004) race. Simulator check passes (1 s). Every fact
below was read in the linked source (fetched 2026-11-09). Where sources disagree, the row says so.
No safety-car, VSC or red-flag laps exist for this race in OpenF1 (OpenF1 starts in 2023).

### Sources

| Short name | What | URL |
|---|---|---|
| WP | English Wikipedia race article | https://en.wikipedia.org/wiki/2003_Canadian_Grand_Prix |
| Jolpica | Results and lap-by-lap timings (positions, lap times) | https://api.jolpi.ca/ergast/f1/2003/8/results.json, https://api.jolpi.ca/ergast/f1/2003/8/laps.json (offsets 0-1000) |
| GPE | GrandPrix.com race notes | https://www.grandprix.com/races/canadian-gp-2003-race-notes-schumacher-takes-68th-victory-in-montreal.html |
| AS | Autosport race report | https://www.autosport.com/f1/news/schumacher-wins-canadian-gp-to-take-wc-lead-5063320/5063320/ |
| AF1 | Atlas F1 (Autosport) race review, with a pit-stop table | http://atlasf1.autosport.com/2003/can/elizalde.html |

Jolpica has no pit-stop data for 2003 (`pitstops.json` total 0). The stop laps below come from
AF1 and match the one slow lap (99-109 s against ~77-80 s) for each car in Jolpica's lap times.

### Facts

| Topic | Fact | Sources | Owner checked |
|---|---|---|---|
| Race | 15 June 2003, round 8 of 16, Circuit Gilles Villeneuve, 70 laps of 4.361 km (305.270 km). | WP, Jolpica | |
| Grid top 6 | R. Schumacher (Williams-BMW) pole 1:15.529, Montoya (Williams) 2nd, M. Schumacher (Ferrari) 3rd, Alonso (Renault) 4th, Barrichello (Ferrari) 5th, Webber (Jaguar) 6th. | WP, Jolpica | |
| Grid penalties | None reported. Räikkönen spun in qualifying, set no time and started from the pit lane (Jolpica grid 20); Firman also started from the pit lane (WP). | WP, Jolpica | |
| Weather | Dry. Partly cloudy and mild, air max 19.3 °C, track 32 °C (WP). Wet earlier in the weekend limited dry running (Webber, GPE). | WP, GPE | |
| SC / VSC / red flag | None mentioned by WP, AS, GPE or AF1. Jolpica lap times show no neutralised laps. (VSC did not exist in 2003.) | WP, AS, GPE, AF1, Jolpica | |
| Lap 1-2 contact | Barrichello hit the back of Alonso and pitted for a new nose (lap 2 stop, AF1). Pizzonia ran into Trulli (puncture; accounts of the cause differ, GPE). Trulli later retired from the damage (22 laps, Jolpica "Accident"). | WP, GPE, AF1, Jolpica | |
| Montoya spin | Montoya spun at the exit of the final chicane on lap 2 and fell to 5th; he called it his own fault. | WP, AS, GPE | |
| Leaders by lap | R. Schumacher laps 1-19, M. Schumacher lap 20, Alonso 21-25, M. Schumacher 26-48, Alonso 49-54, M. Schumacher 55-70. | Jolpica (laps) | |
| Stops: M. Schumacher | Two stops: lap 21 (stationary 10.6 s, AF1 text) and lap 48. Rejoined ahead of Ralf after the first stop. | AF1, Jolpica, AS | |
| Stops: R. Schumacher | Two stops: lap 20 (8.8 s stationary, kept his front tyres: "fell in love with them", GPE) and lap 46 (AF1) / end of lap 45 (AS), rear tyres only both sources; fronts did the whole race. Lost time in traffic after the second stop (AS). | AF1, AS, GPE, Jolpica (slow lap 46) | |
| Stops: Montoya | Two stops: lap 19 (WP, AF1) and lap 45 (9.2 s, AF1). | WP, AF1, Jolpica | |
| Stops: Alonso | Two stops: lap 26 (rear tyres only, AF1) and lap 55 (6.6 s, AF1). Led until his first stop. | AF1, AS, WP, Jolpica | |
| Stops: Räikkönen | One stop, lap 33, earlier than planned after a right-rear puncture / lost tread. | AF1, GPE, AS | |
| Stops: Barrichello | Lap 2 (nose) and lap 39; lost a bargeboard after his second stop (AS). | AF1, AS, Jolpica | |
| Stop durations | AF1's text and its own table disagree (table pit-lane times ~28-37 s). Use laps only. | AF1 | |
| Fuel | Michael said he ran "virtually the same fuel load" as the Williams, "just a little bit more". Fill amounts: not in sources. | GPE | |
| Tyres | Ferrari on Bridgestone; Williams, Renault, McLaren, Jaguar, Toyota on Michelin. Ralf had graining in the first stint. Compound per stint: not in sources. | AF1, GPE | |
| Brakes | Michael had brake problems for much of the race and had to preserve them (Todt, Michael via GPE); he slowed to save tyres and brakes late on (WP). Villeneuve and Pizzonia retired with brake failures. | GPE, WP, AS | |
| Team orders | None reported (AF1: none mentioned; Frank Williams said Montoya would have "had a bigger go"). | AF1, GPE | |
| Penalties | None reported in the race. | WP, AS, GPE | |
| Result top 6 | M. Schumacher 1:31:13.591; R. Schumacher +0.784; Montoya +1.355; Alonso +4.481; Barrichello +1:04.261; Räikkönen +1:10.502. Fastest lap Alonso 1:16.040, lap 53. Michael took the championship lead. | Jolpica, WP, AS | |
| Retirements | Frentzen 6 laps (electronics), Villeneuve 14 (brakes), Firman 20 (engine), Fisichella 20 (gearbox), Trulli 22 (accident damage), Heidfeld 47 (engine), Coulthard 47 (gearbox), Button 51 (gearbox), Wilson 60 (gearbox). Da Matta (64, suspension) and Pizzonia (64, brakes) were classified 11th/10th. | Jolpica, WP | |
| Discrepancy | AS appears to attribute the lap-2 spin to Ralf; WP, GPE and Jolpica positions show it was Montoya (5th on lap 2). Montoya taken. | AS, WP, GPE, Jolpica | |

### Proposal (draft, for owner)

| Item | Proposal | Owner checked |
|---|---|---|
| Storyline drivers | Michael Schumacher (Ferrari) and Ralf Schumacher (Williams). | |
| Side | Michael Schumacher, pending `pipeline hard-calls` (Ralf is the alternative: lost by 0.784 s, front tyres kept through both stops). | |
| Dilemma (original wording) | Fading brakes and one more lap of fuel than his brother: stop a lap after Ralf to jump him, then hold off three cars inside five seconds. | |
| Target (draft) | win: M. Schumacher from P3 (beat-rival R. Schumacher if a softer target is wanted). | |
| Did the side really win? | Yes, so no rewrite (history book). | |
| Risk | Medium. Margins are tiny (top 4 inside 4.5 s), so small pace errors flip the result; the brake problem and Ralf's / Alonso's rear-only tyre changes may not be modelled; stop durations in AF1 are inconsistent; no compound data. Positives: dry, no SC, clean stop laps confirmed by two independent sources. | |

## san-marino-2000 (2000 San Marino Grand Prix)

Replaces `malaysia-2001` (Era 4 #3; fail, 7.04 s (field SCH gap, wet pace)). Robust G1: pass, 0.75 s mean gap error. Built (provisionally) as MSCM vs HAK.

Candidate to replace a failing Era 4 race. Simulator check: pass (0.75 s). Every fact below
was read in the linked source (fetched 2026-11-09). Where sources disagree, the row says so.
"Not in sources" means no source read gives the number. Check each row and put your initials
and the date in **Owner checked**.

### Sources

| Short name | What | URL |
|---|---|---|
| WP | English Wikipedia race article (raw wikitext) | https://en.wikipedia.org/wiki/2000_San_Marino_Grand_Prix |
| AS-L | Autosport (Atlas F1) race review, Lupini, with RaceFax lap-by-lap, pit-lane times and fastest laps | http://atlasf1.autosport.com/2000/san/lupini.html |
| GPE | GrandPrix.com race report and classification | https://www.grandprix.com/gpe/rr649.html |
| Jolpica | Results and qualifying, `api.jolpi.ca/ergast/f1/2000/3/results.json`, `.../qualifying.json` | https://api.jolpi.ca/ergast/f1/2000/3/results.json |

OpenF1 and TUM do not cover 2000. Motor Sport, Autosport (other than Atlas F1) and F1DB were
not consulted.

### Facts

| Topic | Fact | Sources | Owner checked |
|---|---|---|---|
| Date / laps | 9 April 2000, Imola (4.933 km), 62 laps; round 3 of 17 | WP, Jolpica | |
| Weather | WP infobox: "Overcast, mild, dry; 16 °C". WP text: cool and overcast at the start, 60% chance of rain. No rain reported in any source | WP | |
| Tyres available | Bridgestone soft and medium dry compounds (WP). GPE: Häkkinen "appeared" the only one of the top four on the softer tyre; M. Schumacher, Coulthard, Barrichello "reported" on mediums. Race-day compounds per stint: not in sources | WP, GPE | |
| Grid top 6 | Häkkinen (McLaren) 1:24.714, M. Schumacher (Ferrari) 1:24.805, Coulthard (McLaren) 1:25.014, Barrichello (Ferrari), R. Schumacher (Williams) 1:25.871, Frentzen (Jordan) 1:25.892 | Jolpica, GPE | |
| Grid discrepancy | Barrichello's time: GPE 1:25.242; Jolpica gives 1:25.871 (same as R. Schumacher, likely a Jolpica error). Order agrees | GPE, Jolpica | |
| Grid penalties | None in sources. Heidfeld's engine would not fire for the formation lap; started from the pit lane, then served a penalty because the team worked on the car (GPE: "illegally") | WP, GPE, AS-L | |
| SC / VSC / red flag | None mentioned in any source | WP, AS-L, GPE | |
| Start | Häkkinen led; M. Schumacher had wheelspin and moved across on Coulthard; Barrichello took 3rd round the outside at Tamburello. Villeneuve 9th to 5th. Lap 1: Häkkinen, M. Schumacher +1.206, Barrichello, Coulthard, Villeneuve, Trulli | WP, AS-L, GPE | |
| Opening stint gaps | Lead ~1.0-1.3 s for the first laps (GPE, AS-L); 3.0 s by lap 20 (GPE); 3.3 s by lap 22 (WP, AS-L). Barrichello and Coulthard ~30 s behind M. Schumacher by laps 22-24 (AS-L) | GPE, AS-L, WP | |
| Coulthard stop 1 | End of lap 25, 26.663 s in the pit lane (AS-L), longer fill to outlast Barrichello; a first-gear glitch, rejoined 7th, still behind Barrichello | AS-L, WP, GPE | |
| Leaders' stop 1 | Häkkinen and M. Schumacher both end of lap 27. Pit-lane time: Häkkinen 25.270 s, Schumacher 26.716 s (AS-L). Stationary: Häkkinen 7.6 s, Schumacher "nearly 10 s" (GPE). Ferrari (Brawn) gave Schumacher more fuel for a longer middle stint (WP, AS-L). Fill litres: not in sources (GPE estimates ~25 kg extra; estimate, not a measured fill) | AS-L, GPE, WP | |
| Barrichello stop 1 | Lap 28, 24.730 s pit lane (AS-L); 7.7 s stationary (WP); short fill kept him ahead of Coulthard | AS-L, WP | |
| After stop 1 | Lap 32: Häkkinen leads M. Schumacher by 4.6 s (AS-L); WP says 4.5 s; Barrichello ~30-35 s back with Coulthard close behind | AS-L, WP | |
| Häkkinen problems | Ran over debris, damaged splitter/front downforce (laps 33-40, AS-L); lead nearly 5 s by lap 39 (WP, GPE). Lap 43 (WP, GPE; AS-L places it on lap 48 in its lap-by-lap): brief electronic engine cut-out at the end of the main straight, cost ~2 s | WP, GPE, AS-L | |
| Diniz incident | M. Schumacher nearly hit Diniz at Acque Minerali when Diniz moved over, lost ~1-1.7 s (lap 43, WP, GPE). Not contact | WP, GPE, AS-L | |
| Häkkinen stop 2 | End of lap 44, 25.748 s pit lane (AS-L); 8.3 s stationary (WP); lead was 2.7 s (WP); rejoined ~20 s behind (GPE) | AS-L, WP, GPE | |
| Schumacher stop 2 | Lap 48, 21.6 s ahead the lap before; 22.889 s pit lane (AS-L, GPE); 6.2 s stationary (WP); rejoined 3.7 s ahead. GPE: gained 1.5 s on the in-lap, 3 s on the out-lap and ~3 s in the pit lane through the smaller fill | AS-L, GPE, WP | |
| Barrichello / Coulthard stop 2 | Together, lap 46 (AS-L, GPE) / lap 47 (WP). Pit lane: Coulthard 24.857 s, Barrichello 26.284 s; Coulthard came out ahead and finished ~38-40 s clear | AS-L, GPE, WP | |
| Other stops (AS-L pit-lane table) | Villeneuve 28, 43; Salo 26, 42; Diniz 25, 44; R. Schumacher 29; Irvine 23, 44; Trulli 23, 44 (WP: first stop lap 24, 9.3 s). One-stoppers: Fisichella 40, Wurz 38, Herbert 32 (Benetton and Herbert one-stop "a major error", GPE) | AS-L, GPE, WP | |
| Lap-number caveat | AS-L/GPE second-stop laps for Barrichello/Coulthard (46) and Trulli/Irvine (44 vs WP 46) differ from WP by one or two laps; Jolpica retirement laps are one lower than AS-L's. Use one convention when building | — | |
| Penalties | Verstappen 10 s stop-go for blocking: lap 23 (WP); AS-L's lap 11 entry calls it a penalty but WP and GPE say lap 11 was an unscheduled stop for a right-front wheel problem. Heidfeld penalty (see grid). No others | WP, GPE, AS-L | |
| Retirements | Frentzen gearbox (4 laps, Jolpica); Button engine and Gené spun on his oil (5 laps); Heidfeld hydraulics (22); Alesi hydraulics (25); R. Schumacher fuel system, from ~6th (45; GPE "fuel pressure", WP "fuel supply pick-up"); de la Rosa spun off, suspension (49; WP: left-rear suspension, lap 52); Trulli gearbox stuck in 6th (58, classified 15th) | Jolpica, WP, GPE, AS-L | |
| Team orders | None in sources. AS (via WP) says Barrichello appeared hesitant to pass M. Schumacher at the start | WP | |
| Contact | None between cars in sources | WP, GPE, AS-L | |
| Fastest lap | Häkkinen 1:26.523, lap 60 | WP, AS-L | |
| Top 6 | 1 M. Schumacher (Ferrari) 1:31:39.776; 2 Häkkinen +1.168; 3 Coulthard +51.008; 4 Barrichello +1:29.276; 5 Villeneuve (BAR) +1 lap; 6 Salo (Sauber) +1 lap | Jolpica, GPE, AS-L | |
| Driver quote (press, not radio) | M. Schumacher: "The four laps before the second pit stop was the decisive moment when I pushed very hard" (AS-L); "Those four laps were crucial" (WP) | AS-L, WP | |

### Proposal (draft)

- **Storyline drivers:** Häkkinen (the rival leads to lap 44, then has splitter damage and a
  lap-43 engine cut-out; faults, not retirements) and R. Schumacher (fuel-system retirement from
  ~6th, lap 45/46). Coulthard (stuck behind Barrichello until the second stops) is the
  alternative.
- **Dilemma:** Ferrari takes the bigger fill at the first stop and bets that four extra laps on
  a light car will jump the McLaren at the second.
- **Side:** M. Schumacher (the strategy call is Ferrari's). Coulthard vs Barrichello
  (beat-rival, fill split) is the alternative; the hard-call counter picks the side at build
  time.
- **Target (draft):** win: M. Schumacher from P2, two stops, ahead of Häkkinen.
- **Side really won?** Yes, so no rewrite (history book).
- **Risk: medium.** Dry, no SC, well documented, with pit-lane times for every stop (AS-L).
  But the winning margin is 1.168 s and the overcut gained only ~3.7 s, so it depends on the
  in/out-lap and fill-time model; Häkkinen's two faults (splitter, engine cut) helped Ferrari
  and are not modelled as events; fill litres and per-stint compounds are not in sources;
  several stop and retirement laps differ by one between sources; Jolpica's Barrichello
  qualifying time looks wrong.

### Authored (B1, Nov 9 2026)

Eras content in `data/eras/san-marino-2000.json` (eraId 4, order 3) and moments in
`data/moments/san-marino-2000.json`. The storyline and briefing are original wording built only
from the facts above; no team radio is quoted.

| Item | Authored | From | Owner checked |
|---|---|---|---|
| Side | M. Schumacher. `pipeline hard-calls`: MSCM 0, HAK 0, a tie settled by chance given up (MSCM 45.3 pts, HAK 7.7) | `pipeline hard-calls` | |
| Target | `win` (from P2 at the takeover, lap 24) | Grid, Opening stint gaps, Top 6 | |
| Rewrite | None: Schumacher really won, so no rewrite condition or headline (history book) | Top 6 | |
| Storyline (real) | Häkkinen leads from pole, 3.3 s clear after 22 laps; Ferrari give Schumacher the bigger fill at the lap-27 stops; Häkkinen runs with a damaged splitter and loses ~2 s to an engine cut-out; Häkkinen stops on lap 44, Schumacher four laps later on lap 48, rejoins ahead and wins by 1.168 s | Opening stint gaps, Leaders' stop 1, Häkkinen problems, stop 2 rows, Top 6 | |
| Mastery | Win on two stops (`stop_count` exact 2, Schumacher's real count) | Leaders' stop 1, Schumacher stop 2 | |
| Hidden | Win by more than 1.2 s (`margin` 1.2; his real margin was 1.168 s) | Top 6 | |
| Briefing | Imola, Häkkinen on pole and 3.3 s ahead after 22 laps, two refuelling stops each | Grid, Opening stint gaps | |
| storylineEvents | `[46, "RETIREMENT"]`: R. Schumacher's fuel-system retirement (Jolpica 45 laps; the race file's event is the lap after) is kept in Legend | Retirements | |
| Moments | `rivalpit-27` (real: box, mediums, fill 21 laps = laps 28-48), `pace-36`, `pace-40`, `rivalpit-44` (Häkkinen's second stop; real: stay out), `stop-48` (real: box, mediums, fill 14 laps = laps 49-62); graded on `win`. Compounds are the build's (per-stint compounds are not in sources) | `pnpm --filter @laststint/sim author san-marino-2000 --target win --eras` | |

Robust G1 (Eras build, this branch): pass (strict pass), 0.75 s mean gap error. Reachability:
pass at era difficulty (threshold 84, Smart rival) and at Legend (90, Expert rival), all three
stars and the hidden objective on the real calls (box 27, stay 44, box 48); the stay-out path
earns no star.

## hungary-2001 (2001 Hungarian Grand Prix)

Replaces `brazil-2003` (Era 4 #5; fail, 5.55 s (duel FIS vs RAI, last-lap pass)). Robust G1: pass, 1.24 s mean gap error. Built (provisionally) as MSCM vs BAR.

Candidate to replace a failing Era 4 race. Simulator check: pass (1.24 s). Every fact below
was read in the linked source (fetched 2026-11-09). Where sources disagree, the row says so.
"Not in sources" means no source read gives the number. Check each row and put your initials
and the date in **Owner checked**.

### Sources

| Short name | What | URL |
|---|---|---|
| WP | English Wikipedia race article (wikitext read; its formula1.com citations were not opened) | https://en.wikipedia.org/wiki/2001_Hungarian_Grand_Prix |
| AS-E | Autosport (Atlas F1) race review, Elizalde: report, pit-stop table, fastest laps, lap-by-lap | http://atlasf1.autosport.com/2001/hun/elizalde.html |
| GPE | GrandPrix.com race report and classification | https://www.grandprix.com/gpe/rr676.html |
| Jolpica | Results, `api.jolpi.ca/ergast/f1/2001/13/results.json` | https://api.jolpi.ca/ergast/f1/2001/13/results.json |

Jolpica has no 2001 qualifying (`qualifying.json` empty) and no pit-stop data before 2011.
OpenF1 and TUM do not cover 2001. The Motor Sport database page has no report text. F1DB was
not consulted. An Autosport (classic) Reuters item (atlasf1-report id 347) was opened but holds
no race facts.

### Facts

| Topic | Fact | Sources | Owner checked |
|---|---|---|---|
| Date / laps | 19 August 2001, Hungaroring, round 13, 77 laps of 3.975 km (306.069 km infobox; 306.075 km in WP text) | WP, GPE, Jolpica | |
| Weather | Dry. WP: "Hot, dry and partially cloudy" (infobox); race text: hot and humid, some cloud, air 27-33 °C, track 40-41 °C, 20% chance of rain forecast (none fell in any source) | WP | |
| Grid top 6 | M. Schumacher (Ferrari) 1:14.059, Coulthard (McLaren) 1:14.860, Barrichello (Ferrari) 1:14.953, R. Schumacher (Williams) 1:15.095, Trulli (Jordan) 1:15.394, Häkkinen (McLaren) 1:15.411. Grid = qualifying order (Jolpica grid column agrees) | WP, AS-E, Jolpica | |
| Pole-time discrepancy | WP infobox says 1:14.082; WP table, WP text and AS-E say 1:14.059. Taken: 1:14.059 | WP, AS-E | |
| Grid penalties | None in sources. Coulthard started in the spare McLaren (gearbox problem on his race car, WP) | WP | |
| Pre-race | M. Schumacher ran through the turn 12 gravel on the way to the grid; bargeboard/turning vane changed on the grid | WP, AS-E | |
| Strategy expectation | WP: tyre consistency was expected to allow one stop; two stops theorised to help keep track position. In the race the front-runners all stopped twice (Häkkinen three times) | WP, AS-E | |
| SC / VSC / red flag | None mentioned in any source. Only local yellows for Button's stalled car on the start/finish line (lap 35) | WP, AS-E | |
| Start | Barrichello passed Coulthard into turn 1 for 2nd. Irvine spun into the turn 1 gravel (0 laps, Jolpica; AS-E lap-by-lap says he clashed with Fisichella, AS-E report and GPE quote Irvine saying it was his own fault). Marques off after contact with Frentzen on lap 1 | WP, AS-E, GPE, Jolpica | |
| Penalty | Button: 10 s stop-go for jumping the start, served lap 6 | WP, AS-E | |
| Early gaps | End lap 1: M. Schumacher 1.3 s ahead of Barrichello, Coulthard ~0.5 s further back. Lap 5: Ralf 6.8 s (WP) / ~7 s (AS-E) behind. Lap 6: lead 1.4 s | WP, AS-E | |
| Barrichello slowing Coulthard | From lap 12 Barrichello slowed and Coulthard was stuck behind him; WP says by about a second a lap; AS-E lap-by-lap: gap grows "dramatically" on lap 12, and Barrichello "slows again" on lap 24, lead to nearly 10 s. GPE calls it "strategic work". Described as a tactic, not an explicit team order | WP, AS-E, GPE | |
| Trulli queue | Trulli (5th) held up Häkkinen, Heidfeld, Montoya, Räikkönen from about lap 8-9 until his stop; Häkkinen tried and failed to pass | WP, AS-E | |
| M. Schumacher stop 1 | End of lap 28 (WP; AS-E lap-by-lap and pit table lap 28; AS-E report text says lap 27). Stationary 8.4 s; lead before it 12.8 s (WP) / "more than six seconds" (AS-E text). Rejoined 3rd, ahead of Ralf | WP, AS-E | |
| Barrichello stop 1 | End of lap 31 (WP, AS-E lap-by-lap, pit table; AS-E text says lap 30). 9.1 s, 91 litres of fuel (WP). Stayed out to delay Coulthard (WP) | WP, AS-E | |
| Coulthard stop 1 | Lap 32 (AS-E lap-by-lap, pit table; AS-E text says lap 31; WP "the next lap"). ~8 s stationary (AS-E); came out ahead of Barrichello | WP, AS-E | |
| Middle stint | Lap 33: M. Schumacher 14 s ahead of Coulthard. Coulthard got it to 11 s by lap 38 and no closer | AS-E, WP | |
| M. Schumacher stop 2 | Lap 52; Ralf stopped the same lap | WP, AS-E | |
| Barrichello stop 2 | Lap 53, 8.5 s stationary; rejoined 3rd behind Michael | WP, AS-E | |
| Coulthard stop 2 | Lap 54 (Coulthard led laps 53-54, WP). Fuel rig jammed/would not engage for about two seconds (WP: two seconds; GPE: two seconds slower in the pit lane than his first stop; AS-E: "a few vital seconds"); Barrichello took 2nd. WP says the gap to Barrichello had been 22.6 s | WP, AS-E, GPE | |
| Pit-lane times (AS-E table) | M. Schumacher 30.2 (lap 28), 30.7 (52); Barrichello 30.7 (31), 30.1 (53); Coulthard 29.5 (32), 31.6 (54); R. Schumacher 31.2 (30), 32.0 (52); Häkkinen 28.6 (38), 28.4 (56), 26.2 (71). Fill sizes other than Barrichello's 91 l: not in sources | AS-E | |
| Häkkinen strategy | One of the last to stop first (lap 38, AS-E). McLaren short-fuelled his second stop (lap 56) to jump Ralf, planning a late splash; he rejoined still behind Ralf and made a third stop for fuel on lap 71, staying 5th | GPE, AS-E, WP | |
| Compounds | Not in sources (2001 grooved tyres; Bridgestone vs Michelin, no compound per stint reported) | — | |
| Trulli | Fuel nozzle stuck on lap 29 stop, ~5 s extra, dropped to 12th (WP, GPE) / 10th (AS-E); retired hydraulics, 53 laps (Jolpica, AS-E) / "lap 54" (GPE, AS-E lap-by-lap) | WP, AS-E, GPE, Jolpica | |
| Other retirements | Burti spun 8 laps; Bernoldi spun 11; Button spun 34 (stalled on the straight); Alonso brakes/spun 37; Panis electrical 58; Frentzen spun 63; Marques 63; Fisichella engine 67. GPE prints Frentzen "Engine" and Marques "Spin"; Jolpica gives Frentzen "Spun off", Marques "Oil pressure"; WP says Marques stopped for low fuel pressure. Taken: Jolpica laps | WP, AS-E, GPE, Jolpica | |
| Contact | Irvine/Fisichella lap 1 (AS-E only); Trulli/Heidfeld brush at turn 1 (GPE; AS-E: Ralf/Trulli bump with Heidfeld); Frentzen/Marques lap 1 | AS-E, GPE, WP | |
| Overtaking | Only one real on-track pass (Alesi on de la Rosa, lap 10) per AS-E and GPE | AS-E, GPE | |
| End of race | Michael slowed at the end; Barrichello held off Coulthard (WP). Barrichello within 8 s of Michael with ten laps to go (AS-E) | WP, AS-E | |
| Top 6 | 1 M. Schumacher (Ferrari) 1:41:49.675; 2 Barrichello +3.363; 3 Coulthard +3.940; 4 R. Schumacher +49.687; 5 Häkkinen +1:10.293; 6 Heidfeld +1 lap | WP, AS-E, GPE, Jolpica | |
| Fastest lap | Häkkinen 1:16.723, lap 51 (WP, AS-E fastest-lap table; AS-E results header says lap 52) | WP, AS-E, GPE | |
| Titles | Win clinched M. Schumacher's 4th title and equalled Prost's 51 wins; Ferrari 1-2 clinched the constructors' title | WP, AS-E, GPE | |

### Proposal (draft)

- **Storyline drivers:** Trulli (stuck fuel nozzle lap 29, then hydraulics, 53 laps) and
  Irvine (spun off at turn 1, 0 laps). Alternative: Button (stop-go lap 6, spun lap 34).
- **Dilemma:** A Ferrari is backing you into the pack on a track with no passing; stay out
  longer or stop shorter to break free, knowing a slow fuel rig can undo it.
- **Side:** Coulthard (beat-rival Barrichello). Alternative: Häkkinen's short-fuel gamble vs
  Ralf (position P4). The hard-call counter picks the side at build time.
- **Target (draft):** beat-rival: Coulthard finishes ahead of Barrichello (real gap 0.577 s).
- **Side really won?** No (Coulthard 3rd, behind Barrichello), so a rewrite is allowed.
- **Risk: medium-high.** Clean dry race, no SC, small final gap. But the result turns on
  Barrichello's deliberate slowing (laps 12-31) and Coulthard's ~2 s rig delay, neither of
  which a plain rival model reproduces; first-stop laps differ by one between AS-E's text and
  its own tables; fill sizes are missing except Barrichello's 91 l.

## austria-2001 (2001 Austrian Grand Prix)

Replaces `hungary-2003` (Era 4 #6; fail, 7.08 s (field SCH gap, Williams stint pace)). Robust G1: pass, 0.62 s mean gap error. Built (provisionally) as COU vs MSCM.

Candidate to replace a failing Era 4 race; passes the simulator check (0.62 s). Every row was read
in the linked source (fetched 2026-11-09). Where sources disagree, the row says so. Nothing comes
from memory, and team radio is not quoted. Check each row and initial **Owner checked**.

### Sources

| Short name | What | URL |
|---|---|---|
| WP | English Wikipedia race article | https://en.wikipedia.org/wiki/2001_Austrian_Grand_Prix |
| GPE | GrandPrix.com race report | https://www.grandprix.com/gpe/rr669.html |
| AS | Atlas F1 (Autosport) race review, with pit-stop table and lap-by-lap | http://atlasf1.autosport.com/2001/aut/elizalde.html |
| Jolpica | Results | https://api.jolpi.ca/ergast/f1/2001/6/results.json |

### Facts

| Topic | Fact | Sources | Owner checked |
|---|---|---|---|
| Grid | M. Schumacher pole (1:09.562), Montoya 2nd, R. Schumacher 3rd, Barrichello 4th, Trulli 5th, Heidfeld 6th; Coulthard 7th, Häkkinen 8th, Räikkönen 9th, Panis 10th. No grid penalties named. | WP, Jolpica | |
| Laps / date | 71 laps (307.146 km), 13 May 2001, A1-Ring/Spielberg (round 6). | WP, GPE, Jolpica | |
| Weather | Dry, sunny and warm (air 18-19 °C). | WP | |
| Start | Launch-control trouble: Häkkinen, Frentzen, Trulli and Heidfeld stalled or were slow away (WP). Häkkinen out after lap 1 (transmission), Frentzen 0 laps (gearbox) (Jolpica). Montoya led from the start; M. Schumacher fell behind both Williams. Coulthard 7th to 5th. | WP, GPE, Jolpica | |
| Safety car | One period from lap 1 (stranded cars on the grid); in at the end of lap 3 (WP); AS lap chart: racing resumed lap 4. GPE mentions it without laps. No red flag in any source. | WP, AS, GPE | |
| Lap 15/16 | M. Schumacher went round the outside of Montoya at turn 2; both ran off line (no contact per GPE: "slid offline"). Schumacher to 6th, Montoya 7th; Barrichello led. Lap 16 (WP, GPE, AS lap-by-lap); AS race text says lap 15. | WP, GPE, AS | |
| Stops | All one stop (AS pit table): M. Schumacher lap 46, Räikkönen lap 46 (long stop, 41.4 s pit-lane time), Barrichello lap 47 (WP also says 46 once), Coulthard lap 50 (AS table; GPE "three fast laps later"). Coulthard's stationary time 8 s (AS, WP); Schumacher 8.7 s (AS). Verstappen two stops, laps 23 and 45 (AS). Fuel loads: not in sources. Compounds: one tyre per supplier then; no compound given. | AS, WP, GPE | |
| Overcut | Coulthard leaned the engine out early to save fuel, ran three laps longer than Barrichello and rejoined ahead (WP: by 1.3 s); his car got quicker as the fuel load fell (GPE). | WP, GPE | |
| Fastest lap | Coulthard 1:10.843: lap 48 (WP) vs lap 70 (GPE). Disagree; not needed. | WP, GPE | |
| Team order | Ferrari asked Barrichello to give 2nd to M. Schumacher with three laps left (AS, GPE); he did so at the last corner of lap 71 (WP, AS). | WP, AS, GPE | |
| Retirements | R. Schumacher lap 10 brakes; Montoya lap 41 hydraulics (AS text says 42); Fisichella 3, Bernoldi 17, Marques 25, Alonso 38, de la Rosa 48, Button 60 (Jolpica). | Jolpica, WP, AS | |
| Penalties | Trulli disqualified (black flag, lap 14) for leaving the pit lane against the red light (WP; Jolpica "Disqualified", 14 laps). Villeneuve 10 s stop-go for pit-lane speeding (WP). | WP, Jolpica | |
| Result | Coulthard 1:27:45.927; M. Schumacher +2.190; Barrichello +2.527; Räikkönen +41.593; Panis +53.775; Verstappen +1 lap (Jolpica; GPE gives +2.191/+2.528). | Jolpica, GPE | |

### Proposal (draft, owner decides)

- **Storyline drivers:** Coulthard (McLaren, P7) and Barrichello (Ferrari, P4).
- **Dilemma (original wording):** Coulthard has saved fuel from P7; stay out three laps longer than
  the Ferrari and hope the lighter car makes the overcut stick.
- **Target:** win: Coulthard from P7 (one stop, overcut Barrichello). Alternative if the hard-call
  counter picks Barrichello: beat-rival, Barrichello ahead of Coulthard (he finished 3rd after the
  team order, so a rewrite is allowed there).
- **Did that side really win?** Coulthard: yes, so no rewrite (history book). Barrichello: no.
- **Risk: medium.** Facts are clean and agree. Risks: the start (four launch-control failures,
  Trulli DQ) and the lap 1-3 safety car need modelling; the win margin at the stop is small (1.3 s
  out of the pits, 2.19 s at the flag); the Ferrari team order is a scripted swap of 2nd/3rd on the
  final lap; fuel loads are not in sources, so the real fill must come from the pit-stop data.

## france-2001 (2001 French Grand Prix)

Replaces `united-states-2003` (Era 4 #7; fail, 10.25 s (duel MSCM vs RAI, Bridgestone wet pace)). Robust G1: pass, 0.59 s mean gap error. Built (provisionally) as MSCM vs SCH.

Picked by stats to replace a failing Era 4 race; passes the simulator check (0.59 s). Every
fact below was read in the linked source (fetched Nov 9, 2026); nothing comes from memory.
Where sources disagree, the row says so. Put your initials and the date in **Owner checked**.

### Sources

| Short name | What |
|---|---|
| WP | [English Wikipedia, 2001 French Grand Prix](https://en.wikipedia.org/wiki/2001_French_Grand_Prix) |
| GPE | [GrandPrix.com, French GP 2001](https://www.grandprix.com/races/french-gp-2001.html) |
| AS | [Autosport, "Michael Schumacher Takes 50th GP Win in France"](https://www.autosport.com/f1/news/michael-schumacher-takes-50th-gp-win-in-france-5057330/5057330/) |
| Jolpica | `api.jolpi.ca/ergast/f1/2001/10/results.json` and `.../laps.json` (lap times and positions). Jolpica has no pit-stop data for 2001; stop laps below are read from slow laps (about 1:33-1:38 against about 1:17). |

### Facts

| Topic | Fact | Sources | Owner checked |
|---|---|---|---|
| Event | Round 10, Magny-Cours, July 1, 2001; 72 laps. | WP, Jolpica | |
| Grid | R. Schumacher pole (1:12.989, first career pole), M. Schumacher 2nd (+0.010), Coulthard 3rd, Häkkinen 4th, Trulli 5th, Montoya 6th; Frentzen 7, Barrichello 8 (handling balance problem), Heidfeld 9, Villeneuve 10. No grid penalties reported. | WP, Jolpica, AS | |
| Starts | Häkkinen did not start: a gearbox component was incorrectly fitted (WP); AS says he stalled on the grid and was left in the pit lane. De la Rosa's throttle failed on the formation lap; he started from the pit lane. | WP, AS, GPE | |
| Weather | Hot and clear (WP: air 25-29 °C, track 40-51 °C); "dry and sunny" (AS). | WP, AS | |
| SC / VSC / red flag | None reported in any source read (VSC did not exist in 2001). | WP, GPE, AS | |
| Tyres | Williams on Michelin; GPE says Montoya's Michelins were harder, ruling out one stop but allowing a longer first stint; Bridgestone runners had "rather better tires than of late". Compound names: not in sources. | GPE | |
| Strategy norm | Two stops were standard (WP). Fuel loads: not in sources. | WP | |
| R. Schumacher stops | Led from pole with about a three-second lead (GPE). First stop lap 24 (WP "about lap 24", GPE) / lap 25 (AS); a right-rear wheel problem made it 2.8 s slower than Michael's (WP, GPE). He said the second set of tyres "didn't work at all" (GPE, post-race quote). Second stop lap 44 (WP; AS "with 28 laps remaining"). Jolpica slow laps: 25 and 45. | WP, GPE, AS, Jolpica | |
| M. Schumacher stops | Stopped one lap after Ralf (lap 26 per WP and AS; GPE "one lap after"), a 7.7 s stop, and came out ahead. Second stop lap 45 (WP, AS). Jolpica slow laps: 26 and 46. Led laps 31-45 and 51-72 in Jolpica positions. | WP, GPE, AS, Jolpica | |
| Montoya | Longer first stint; led after the Schumachers' first stops (Jolpica P1 laps 27-30); stopped lap 30 (WP, GPE), rejoined 5th (WP) / 4th (AS); GPE says the stop cost about 25 s. Led laps 46-50 (WP; Jolpica agrees). Second stop: Jolpica slow lap 51. Retired with a smoking engine, lap 52 (Jolpica, AS) / 53 (WP text, GPE text) while set for a podium (AS). | WP, GPE, AS, Jolpica | |
| Williams team order | Williams tried to order Ralf to let Montoya through; Ralf did not, citing earpiece/radio problems (WP); GPE says this cost Montoya an estimated 6-12 s over about six laps, the paddock doubted the radio story, and a pitboard finally told Ralf to pit. AS reports no team order. | WP, GPE, AS | |
| Barrichello | First of the leaders to stop (lap 21, rejoined 7th, WP); Ferrari switched him to three stops mid-race (WP, GPE); second stop lap 36 (WP). Jolpica slow laps: 22, 37, 55. Third stop cost him 2nd to Ralf (AS). Held off Coulthard from about lap 58 to 68 (WP). | WP, GPE, AS, Jolpica | |
| Coulthard | 10 s stop-go for 85 km/h in the 80 km/h pit lane (speed limiter disengaged by mistake), given lap 31, served next lap; lost 26.8 s, 3rd to 5th (WP). Jolpica slow laps: 27 (stop), 33 (stop-go), 52 (stop). Fastest lap 1:16.088, lap 53 (AS; Jolpica lap 53). | WP, AS, Jolpica | |
| Ferrari instruction | Ferrari told Michael to ease off to protect the car (WP). | WP | |
| Other incidents | Irvine and Frentzen at the Imola chicane, lap 42: Frentzen gave the place back (WP); AS says Irvine's pass under braking was not within the rules. Fisichella suspension vibration after contact with Verstappen; Verstappen fuel-rig failure at his first stop; Frentzen fuel-nozzle delay (WP). | WP, AS | |
| Retirements | Villeneuve engine/electrical, 5 laps (Jolpica; texts say lap 6-7); Bernoldi engine, 17; Montoya engine, 52; Irvine engine (pneumatic valves, WP), 54; Alonso engine, 65; Button fuel pressure, 68 (classified 16th); Häkkinen DNS. | Jolpica, WP, AS | |
| Result | M. Schumacher 1:33:35.636 (50th win); R. Schumacher +10.399; Barrichello +16.381; Coulthard +17.106; Trulli +1:08.285; Heidfeld +1 lap. | Jolpica, WP, AS | |

### Proposal (draft, for the owner)

| Item | Draft |
|---|---|
| Storyline drivers | Ralf Schumacher (Williams-Michelin, pole) and Michael Schumacher (Ferrari). Barrichello (three-stop from P8 to P3) is the strongest alternative side; run `pipeline hard-calls` to pick. |
| Dilemma (original) | Pole on Michelins with a three-second lead: stop when the plan says, or stretch the stint before your brother's Ferrari jumps you in the pits? |
| Target | win: R. Schumacher from pole (beat Michael, who jumped him at the first stops). If the side is Barrichello: position, podium from P8. |
| Side really won? | No. Ralf finished 2nd (+10.399), so a rewrite is allowed. (Barrichello really did finish 3rd, so no rewrite if he is the side.) |
| Risk | Medium. The 2.8 s slow stop and Ralf's poor second tyre set are not strategy choices and may need scripting; Coulthard's stop-go, Montoya's lap-52 engine failure and Häkkinen's DNS must be storyline events; stop laps differ by one between sources (WP/GPE vs AS); no sourced fuel loads; the team-order story differs between sources. No SC, dry, so the model fit should hold. |

### Authored (Eras B1, Nov 9 2026)

Authored from the facts above (no new source read). "Timing" is the Jolpica laps as built into
`data/races/france-2001.json` (Eras build, takeover lap 21 by the D3 rule). The storyline and
briefing are original wording; no team radio is quoted.

| Item | Value | Fact it rests on | Source | Owner checked |
|---|---|---|---|---|
| Side | MSCM. `pipeline hard-calls`: MSCM 0, SCH 0; chance given up 0.0 each, so the tie stays on the race file's side (MSCM). Not the draft above (Ralf) | the grader, not a fact | - | |
| Target | `win` (MSCM is P2 at the takeover) | MSCM P2, 2.418 s behind SCH at the end of lap 21 | Timing | |
| Rewrite | none: the side really won | M. Schumacher won (50th win) | Jolpica, WP, AS | |
| Storyline | "Ralf Schumacher leads from his first pole" | R. Schumacher pole, first career pole; led from pole | WP, GPE | |
| Storyline | "Michael stops a lap after him at the first round of stops and comes out ahead" | Michael stopped one lap after Ralf and came out ahead | WP, GPE, AS | |
| Storyline | "Montoya, on a longer first stint, leads twice before his engine fails" | longer first stint; P1 laps 27-30 and 46-50; engine, lap 52/53 | GPE, WP, Jolpica, AS | |
| Storyline | "Michael wins by 10.4 s from Ralf for his 50th Grand Prix win" | R. Schumacher +10.399; 50th win | Jolpica, WP, AS | |
| Briefing | "21 laps in. Your brother Ralf leads from pole in the Williams, about two and a half seconds ahead of you; Coulthard's McLaren is third" | SCH, MSCM, COU P1-P3 at the end of lap 21, MSCM 2.418 s behind | Timing; WP (grid) | |
| Briefing | "Two stops is the norm here, and Ralf will stop first" | two stops standard; Michael stopped one lap after Ralf | WP, GPE | |
| Mastery | `margin` 5 s: "Win by more than 5 seconds" | the game's choice. Michael's real margin (10.399 s) was tried first and can't be earned at Legend against the Expert rival (reachability: Legend ★3 not reached); 5 s and 8 s both pass, 5 s kept for slack | Jolpica (margin); reachability | |
| Hidden | `mode_rule` push, 0 laps: "Win without a single push lap" | the game's choice; Ferrari told Michael to ease off to protect the car | WP | |
| storylineEvents | [53, RETIREMENT] (Montoya's engine) | Montoya's engine, lap 52 (Jolpica, AS) / 53 (WP, GPE); model event lap 53 | Jolpica, WP, AS, GPE | |
| Moments | stop-25 (real: box, fill 20 laps), pace-29, stop-45 (real: box), pace-53; `pnpm --filter @laststint/sim author france-2001 --target win --eras --write` | Michael's real stops on laps 26 and 46 (out-laps) | Timing, WP, AS | |

Checks: robust G1 pass, 0.59 s (before and after the overlay). Reachability
(`pnpm --filter @laststint/sim reachability france-2001`): pass at era difficulty (threshold 84,
Smart rival) and Legend (90, Expert), all three stars and the hidden objective; the stay-out
path earns no star. Not modelled: Ralf's 2.8 s slow first stop (it is in his real stop loss),
the Williams team-order dispute, Coulthard's stop-go (in his real strategy as a stop on lap 33).

## italy-2001 (2001 Italian Grand Prix)

Replaces `japan-2003` (Era 4 #8; fail, 4.05 s (duel MSCM vs RAI, stint pace)). Robust G1: pass, 1.62 s mean gap error. Built (provisionally) as MON vs BAR.

Candidate to replace a failing Era 4 race. Simulator check: pass (1.66 s; 1.62 s after the re-ingest above). Every fact below
was read in the linked source (fetched 2026-11-09). Where sources disagree, the row says so.
"Not in sources" means no source read gives the number. Check each row and put your initials
and the date in **Owner checked**.

### Sources

| Short name | What | URL |
|---|---|---|
| WP | English Wikipedia race article (first 100k characters read) | https://en.wikipedia.org/wiki/2001_Italian_Grand_Prix |
| AS | Autosport (Atlas F1) race review, Elizalde | http://atlasf1.autosport.com/2001/ita/elizalde.html |
| GPE | GrandPrix.com race report | https://grandprix.com/gpe/rr678.html |
| MS | Motor Sport "Flashback to Monza 2001" | https://www.motorsportmagazine.com/articles/single-seaters/f1/flashback-to-monza-2001-a-race-no-one-wanted/ |
| Jolpica | Results, `api.jolpi.ca/ergast/f1/2001/15/results.json` | https://api.jolpi.ca/ergast/f1/2001/15/results.json |

OpenF1 and Jolpica pit-stop data do not cover 2001. F1DB was not consulted.

### Facts

| Topic | Fact | Sources | Owner checked |
|---|---|---|---|
| Date / laps | 16 September 2001, Monza, 53 laps, 306.749 km | WP, Jolpica | |
| Weather | Sunny, partly cloudy; air 19 °C, track 26 °C; no rain | WP | |
| Context | Five days after the 11 September attacks: no podium celebration or champagne, Ferrari ran black nose cones without sponsor logos. Zanardi was critically injured in a CART race the day before. M. Schumacher proposed a no-overtaking pact for the first two chicanes; Villeneuve refused (also Briatore and Walkinshaw, WP) and it failed | WP, GPE, MS | |
| Grid top 6 | Montoya (Williams-BMW) 1:22.216, Barrichello (Ferrari) 1:22.528, M. Schumacher (Ferrari) 1:22.624, R. Schumacher (Williams-BMW) 1:22.841, Trulli (Jordan) 1:23.126, Coulthard (McLaren) 1:23.148 | WP, Jolpica | |
| Grid penalties | None. Heidfeld (8th, hydraulic failure) and Fisichella (fuel leak) started from the pit lane | WP, GPE | |
| SC / VSC / red flag | None in sources; local yellows only (Button lap 1, Yoong/Bernoldi late) | WP | |
| Lap 1 | Montoya led. R. Schumacher passed his brother at the first chicane; Michael retook the place before/into the Lesmos. Button hit Trulli, who retired (0 laps, "Collision"); Button pitted for a front wing | WP, AS, GPE, Jolpica | |
| Lead change | Lap 9: Barrichello took the lead as Montoya, with a blistered rear tyre (Montoya press quote, AS), was slow out of the Roggia chicane | WP, AS, MS | |
| Gaps, opening stint | Barrichello's lead: >3 s lap 12, >5 s laps 13-14, nearly 9 s lap 16 (AS); "10-second lead in 10 laps" (GPE); about 9 s at his stop (AS) | AS, GPE | |
| Strategies | Ferrari two stops, Williams (Montoya) one stop. GPE: Barrichello "had a much lighter fuel load". Brawn: two stops partly over brake overheating, and "I didn't really see the point in following a couple of ultra-quick BMWs down the straight" (press quote) | WP, AS, GPE, MS | |
| M. Schumacher stops | Lap 18, stationary 10.4 s (AS text), rejoined 4th; second stop lap 40 (WP) | AS, WP | |
| Barrichello stop 1 | Lap 19. Ferrari had to switch refuelling hoses/rig; stationary 16.3 s (AS). Time lost: about 6 s (AS) / "six or seven precious seconds" (GPE) / 6-7 s (WP). Rejoined 3rd, ahead of M. Schumacher (AS). AS pit table gives 30.7 s (pit-lane time, presumably) | AS, GPE, WP | |
| Barrichello stop 2 | Lap 41 (fuel); rejoined behind Montoya, who took the lead (lap 41/42, WP). Duration: not in sources | AS, WP | |
| Montoya stop | One stop, lap 28, stationary 11.9 s, hard Michelins (AS); WP: lap 28 or 29 (sources differ). Front wing adjusted; ended with "way too much understeer" (GPE) | AS, WP, GPE | |
| Gap Montoya / Barrichello | 23.4 s on lap 20, 25.8 s on lap 27 (GPE). Who led which of these is as GPE states it; check | GPE | |
| R. Schumacher | Led after Montoya's stop (lap 28/29); one stop, lap 35; Barrichello regained the lead lap 36 (WP). Ran wide and lost 2nd to Barrichello on lap 47. Fastest lap 1:25.073, lap 39 (AS) | WP, AS | |
| Other stops | Villeneuve one stop lap 34, de la Rosa one stop lap 36 (WP). Verstappen (from 19th to 5th in seven laps) stopped early (GPE) | WP, GPE | |
| Compounds | Montoya: hard Michelin (AS). Ferrari (Bridgestone) compounds: not in sources | AS | |
| Fill sizes | Not in sources (only "much lighter fuel load", GPE) | — | |
| Retirements | Trulli 0 laps (collision); Button 4 (engine); Coulthard 6 (engine; text lap 7); Irvine 14 (engine); Häkkinen 19 (gearbox; lost 2nd first, WP lap 19-21); Verstappen 25 (Jolpica: fuel pressure; GPE: engine); Frentzen 28 (gearbox); Yoong 44 (spun off); Bernoldi 46 (crankshaft) | Jolpica, WP, GPE, AS | |
| Team orders | None. Barrichello: "We have equal treatment and we are allowed to race each other basically" (press quote) | AS, GPE, MS | |
| Penalties | None in sources | WP, GPE | |
| Top 6 | 1 Montoya 1:16:58.493 (WP text: 1:16:58.393); 2 Barrichello +5.175; 3 R. Schumacher +17.335; 4 M. Schumacher +24.991; 5 de la Rosa +1:14.984; 6 Villeneuve +1:22.469 | Jolpica, WP, GPE | |
| Note | Montoya's first F1 win | WP, MS | |

### Proposal (draft)

- **Storyline drivers:** Coulthard (engine, 6 laps, from P6) and Häkkinen (gearbox, 19 laps,
  after losing 2nd).
- **Dilemma:** Ferrari runs light on two stops to escape Montoya's one-stop Williams, but a
  slow first fill hands back most of the margin.
- **Side:** Barrichello (the two-stop call and the rig delay). Montoya is the alternative
  (defend on one stop, really won); the hard-call counter picks at build time.
- **Target (draft):** win: Barrichello from P2 (beat Montoya, 5.175 s short).
- **Side really won?** No (Barrichello 2nd), so a rewrite is allowed. If Montoya is the side,
  he won: no rewrite.
- **Risk: medium.** Dry, no SC, clean sources. Risks: the rig delay (~6-7 s lost) needs a
  sourced pit-delay fault; Montoya's stop lap differs (28 vs 29); fill sizes and Ferrari
  compounds are not in sources; Barrichello's second-stop duration unknown.

## san-marino-2003 (2003 San Marino Grand Prix)

Replaces `monaco-2004` (Era 4 #10; fail, 4.61 s (podium BAR gap)). Robust G1: pass, 1.44 s mean gap error. Built (provisionally) as MSCM vs RAI.

Candidate to replace a failing Era 4 (2000-2004) race. It passes the simulator check (1.44 s).
Every fact below was read in the linked source on Nov 9, 2026; nothing comes from memory. Where
sources disagree, the row says so. Check each row against its links and put your initials and
the date in **Owner checked**.

### Sources

| Short name | What |
|---|---|
| WP | English Wikipedia race article (raw wikitext): https://en.wikipedia.org/wiki/2003_San_Marino_Grand_Prix |
| GPE | GrandPrix.com race report: https://www.grandprix.com/gpe/rr701.html |
| GPE-N | GrandPrix.com race notes (press conference and team statements): https://www.grandprix.com/races/san-marino-gp-2003-race-notes-schumacher-wins-emotional-san-marino-win.html |
| AS-A | Autosport's Atlas F1 archive, race review by Pablo Elizalde, with pit-stop table and lap-by-lap: http://atlasf1.autosport.com/2003/san/elizalde.html |
| Jolpica-R | Jolpica results: https://api.jolpi.ca/ergast/f1/2003/4/results.json |
| Jolpica-L | Jolpica lap timings: https://api.jolpi.ca/ergast/f1/2003/4/laps.json (offsets 0-1100, limit 100; 1,102 timings) |

Jolpica has no pit-stop data for 2003 (pitstops endpoint: total 0). OpenF1 starts in 2023; F1DB
was not needed. No Motor Sport race report was found. All pages were downloaded and read as page
text (no summarising fetch tool). AS-A is hosted on autosport.com (Atlas F1 was Autosport's
magazine); if the owner does not count it as "Autosport", every stop lap it gives is also derived
from Jolpica-L.

**Jolpica-L derived values.** The lap after the in-lap is ~19-25 s slow (the stationary time
lands on it), so the stop lap is the slow lap minus one. Gaps are summed lap times. They agree
with AS-A's stop laps for every front-runner below.

### Facts

| Topic | Fact | Sources | Owner checked |
|---|---|---|---|
| Grid top 6 | 1 M. Schumacher (Ferrari) 1:22.327, 2 R. Schumacher (Williams) +0.014, 3 Barrichello (Ferrari), 4 Montoya (Williams), 5 Webber (Jaguar), 6 Räikkönen (McLaren). Villeneuve 7, Alonso 8, Button 9, Panis 10, Coulthard 12. | WP, Jolpica-R, AS-A | |
| Grid penalties | None. Verstappen, Firman and Wilson started from the pit lane; Pizzonia stalled and started from the pit lane a lap down. | WP, AS-A, GPE | |
| Race laps | 62 laps, 305.609 km (4.933 km lap). | WP, Jolpica-R | |
| Weather | Dry. "Dry and clear" (WP race section); infobox "mostly cloudy", maximum 13 degrees ambient (WP); sun through a cloudy sky, dry track (AS-A). Track temperature: not in sources. | WP, AS-A | |
| SC / VSC / red flag | None. No source mentions a safety car; Renault's engine manager said there was no accident on track (GPE-N). | GPE-N, AS-A, GPE, WP | |
| Tyres | Ferrari, BAR, Sauber, Jordan, Minardi on Bridgestone; Williams, McLaren, Renault, Toyota, Jaguar on Michelin (AS-A results). Ron Dennis cited a marginal disadvantage in one area of tyre performance (GPE-N). Compound names: not in sources. | AS-A, GPE-N | |
| Strategy split | Ferrari and Williams three stops; McLaren two (GPE, GPE-N, AS-A). Räikkönen's two-stop was "the exception to the rule" (AS-A). Renault switched Alonso from three to two stops during the race (GPE-N, Gascoyne). BAR two stops. | GPE, GPE-N, AS-A | |
| Fuel loads | Litres or laps of fuel: not in sources. BAR said it qualified on the same fuel as the front row (GPE-N). Barrichello said McLaren showed more fuel all weekend (GPE-N). | GPE-N | |
| Stops: M. Schumacher | Three: laps 18, 34, 49. Lap 17 fastest lap (1:22.491) to jump Ralf; emerged ahead of him (GPE, AS-A). | AS-A, GPE, Jolpica-L | |
| Stops: R. Schumacher | Three: laps 16, 31, 48. Selected the wrong gear leaving his first stop and lost seconds (GPE-N, Berger). | AS-A, GPE-N, Jolpica-L | |
| Stops: Barrichello | Three: laps 17, 33, 50. Came out behind Ralf each time; at the third a front-left wheel problem (AS-A) cost time (Brawn: "a problem during the third pit stop", GPE-N). | AS-A, GPE, GPE-N, Jolpica-L | |
| Stops: Räikkönen | Two: laps 22 and 44. Trouble finding first gear at the second stop (GPE-N, his own account); time lost: not in sources. | AS-A, GPE-N, Jolpica-L | |
| Stops: Coulthard | Two: laps 21 and 45. | AS-A, Jolpica-L | |
| Stops: Alonso | Two: laps 14 and 39. | AS-A, Jolpica-L | |
| Stops: Montoya | Four visits: laps 17, 30, 32, 49. Arrived too fast at the first; at lap 30 the fuel rig put in too little fuel and he had to return (lap 32, AS-A, Jolpica-L; GPE says "three laps later"). | AS-A, GPE, GPE-N, Jolpica-L | |
| Leaders | R. Schumacher laps 1-15; M. Schumacher 16-18; Räikkönen 19-22; M. Schumacher 23-49 and 51-62; Barrichello lap 50 (Michael let him by after his last stop while Rubens was on his in-lap, AS-A, GPE-N). | Jolpica-L, AS-A, GPE-N | |
| Gaps | Lap 10: Ralf leads Michael by 0.5 s, Barrichello 0.9 s and Montoya 2.1 s behind Michael, Räikkönen 5.5 s. After the first stops Michael was 2.5+ s ahead of Ralf (GPE), more than six seconds by lap 22 (AS-A). Lap 40 (Räikkönen not yet in for his second stop): Räikkönen 1.6 s behind Michael (Jolpica-L). | Jolpica-L, GPE, AS-A | |
| Barrichello's pass | Passed Ralf on lap 52 out of the final chicane for 3rd; then closed on Räikkönen but could not pass (only close enough on the last lap, GPE-N). | GPE, AS-A, GPE-N | |
| Result top 6 | 1 M. Schumacher 1:28:12.058; 2 Räikkönen +1.882; 3 Barrichello +2.291; 4 R. Schumacher +8.803; 5 Coulthard +9.411; 6 Alonso +43.689. (7 Montoya +45.271, 8 Button +1 lap.) Michael's lap times fell by up to two seconds late on (AS-A); Jolpica-L: lead 17.0 s at lap 55. | Jolpica-R, GPE, AS-A, Jolpica-L | |
| Retirements | Villeneuve 19 (engine; fire at first stop), Wilson 23 (fuel rig failed), Verstappen 38 (electrical), Firman 51 (oil line, Jolpica; engine, GPE), Webber 54 (driveshaft). Fisichella classified 15th, 57 laps (engine). No front-runner retired. | Jolpica-R, GPE, GPE-N | |
| Penalties | Webber drive-through for pit-lane speeding (penalty taken lap 20, AS-A; ~24 s total, Jaguar). | AS-A, GPE, GPE-N | |
| Contact | Fisichella and Trulli touched at Rivazza (lap 34, AS-A). Coulthard and Villeneuve nearly collided at the start. None among front-runners. | GPE, AS-A | |
| Team orders | Only Michael letting Barrichello by for a lap after his third stop (above). | AS-A, GPE-N | |

### Proposal (draft, for the owner)

- **Storyline drivers:** Kimi Räikkönen (McLaren) and Michael Schumacher (Ferrari).
- **Dilemma (original wording):** From sixth in a slower McLaren, on a track with no overtaking,
  does Räikkönen run long on two stops while the Ferraris and Williams sprint on three?
- **Draft target:** `win`: Räikkönen from P6 (rewrite allowed). Fallback `position`: P2 or better.
  Michael's side would be `defend` (keep the lead through three stops). Run `pipeline hard-calls`
  for the side; Räikkönen has the strategy call and both stop timings (22, 44).
- **Did that side really win?** Räikkönen: no (2nd, +1.882 s). Michael: yes, so no rewrite if he
  is the side.
- **Risk: medium-high.** The win target is not supported by any source: the 1.9 s margin is soft,
  because Michael cruised late (lead 17 s at lap 55), so a "win" depends on the model, not history.
  Fuel loads are not sourced, so fills must come from the reconstruction/model; Montoya's short
  fill (lap 30) and Barrichello's slow third stop need scripting, and Michael letting Barrichello by
  is a scripted team-order lap. Positives: dry, no SC or red flag, every front-runner's stop laps
  agree between AS-A and Jolpica-L.

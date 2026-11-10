# Seven Era 5 races swapped (owner, Nov 9, overnight, by stats): owner sign-off

Seven Era 5 (2005-2009) races that fail G1 are replaced by the next-best Era 5 race by robust-G1
mean gap error, each in the old race's slot, as in the earlier swaps (`swap-races.md` /
migration 0012, `swap-races-e10-e9.md` / 0013, `swap-races-e10-e9-b.md` / 0014). The owner
approved swapping failing Eras races for the next-best race by stats ahead of time (Nov 9); the
picks were made overnight without the owner, so every row below still needs the owner's check.
D1 migration 0020 (`apps/worker/migrations/0020_swap_eras_races_era5.sql`) renames the seven
`era_races` rows and deletes the removed races' attempts, progress and history entries.

Every fact below was read in the linked source on Nov 9, 2026; nothing comes from memory. Where
sources disagree, the row says so. Check each row against its links and put your initials and
the date in **Owner checked**. No team radio is quoted.

## The swaps

| Era / slot | Removed | Removed race's robust G1 (fail; mean gap error, main failing check) | Replacement | Replacement's robust G1 (Eras build, rules-only overlay) | Provisional build pair (`build.py`) |
|---|---|---|---|---|---|
| 5 / #2 | `japan-2005` | 4.48 s, Räikkönen's last stint: duel RAI vs FIS | `europe-2009` | pass, 1.04 s | HAM vs BAR |
| 5 / #3 | `hungary-2006` | 11.35 s, de la Rosa's dry-labelled wet stint: podium HEI | `france-2007` | pass, 0.57 s | MAS vs RAI |
| 5 / #4 | `brazil-2006` | 6.99 s, Schumacher's charge: duel ALO vs MSCM | `san-marino-2006` | pass, 0.79 s | ALO vs MSCM |
| 5 / #5 | `china-2007` | 7.62 s, wet pace: field VET | `great-britain-2007` | pass, 0.58 s | HAM vs RAI |
| 5 / #8 | `monaco-2008` | 2.48 s (2.4784), old inters: field BAR | `bahrain-2006` | pass, 1.39 s | ALO vs MSCM |
| 5 / #9 | `brazil-2008` | 5.57 s, estimated compounds and Trulli's train: field GLO | `turkey-2008` | pass, 0.98 s (strict status fail) | HAM vs MAS |
| 5 / #10 | `brazil-2009` | 3.77 s, Vettel's field gap | `malaysia-2006` | pass, 1.10 s | ALO vs FIS |

**How the races were picked.** All nine Era 5 races that fail G1 in `docs/eras-races-report.md`
(integration wave 3) were candidates; with seven passing replacements, the seven with the worst
mean gap error leave: hungary-2006 (11.35 s), china-2007 (7.62 s), brazil-2006 (6.99 s),
brazil-2008 (5.57 s), japan-2005 (4.48 s), brazil-2009 (3.77 s) and monaco-2008. monaco-2008 and
europe-2007 tie at 2.48 s in the report; re-run here at full precision (robust G1, one race per
call, on this branch's base) monaco-2008 is 2.4784 s and europe-2007 2.4771 s, so monaco-2008
leaves. europe-2007 (2.48 s) and brazil-2007 (2.00 s) stay in Era 5, still failing G1.

The replacements, best first (robust G1 mean gap error from the Era 5 scout run, on race files
rebuilt here byte-identical): france-2007 0.57 s, great-britain-2007 0.58 s, san-marino-2006
0.79 s, turkey-2008 0.98 s, europe-2009 1.04 s, malaysia-2006 1.10 s, bahrain-2006 1.39 s. They
were paired with the removed races in that order, the best replacement into the worst race's
slot. That leaves Era 5 out of date order (play order: san-marino-2005, europe-2009, france-2007,
san-marino-2006, great-britain-2007, europe-2007, brazil-2007, bahrain-2006, turkey-2008,
malaysia-2006); **owner to decide** whether to reorder the slots by date instead (a later
migration). turkey-2008 passes robust G1; its strict status (`validate.robust_status` `strict_status`) is fail.

Other Era 5 candidates the scout measured and did not pick: europe-2005 fail 3.89 s,
france-2006 fail 2.84 s, germany-2008 fail 6.68 s, italy-2007 fail 3.88 s, turkey-2006 fail
4.39 s, italy-2009 not measured (the check stopped with `KeyError: 'BAR'`), spain-2009 not
measured.

**Not authored yet.** The replacements have rules-only overlays (`data/eras/<id>.json`): side
(`pipeline hard-calls`), target, storyline, mastery, hidden objective and briefing come in B1.
The dilemmas and targets in spec §4 and the proposals below are drafts. The `user_side` /
`rival` pairs in `build.py` are the scout's provisional pairs and don't always match the
proposals: great-britain-2007 is built HAM vs RAI while its proposal suggests Alonso vs
Räikkönen; malaysia-2006 is built ALO vs FIS while its proposal's rival is Button. france-2007's
spec target is written `defend` (Massa started on pole and led the first stint) where its sheet
drafted "win: Massa from pole". `pipeline hard-calls` settles each side.

**Wording check needed:** several sources were read through a fetch tool that summarises pages
(each section's notes say which: france-2007's Autosport pages, san-marino-2006's Wikipedia,
Autosport and Motor Sport, europe-2009's Motor Sport, Autosport and GrandPrix.com; turkey-2008's
Autosport tyre table is partly garbled). Check those rows against the pages themselves.

**Other files.** Yuji Ide (Super Aguri, 2006) is added to `data/drivers.json` (key and code IDE,
Jolpica id `ide`, car number 23, neutral attitude). Track outlines: five f1db SVG layouts
(four already used, plus `silverstone-7`, new, start line and pit lane by judgement) and two
reuse copies (bahrain-2006 from bahrain-2021, turkey-2008 from turkey-2021); see
`2.5-track-maps.md`. The lap-1 safety cars of san-marino-2006 and turkey-2008 are not in the
built race models (see `2.6-drivers-incidents.md`). The removed races keep their overlays,
race files and build entries: tests use them as Eras-build fixtures.

## europe-2009 (2009 European Grand Prix, Valencia): swap candidate for Era 5

Replaces `japan-2005` (Era 5 #2). Robust G1: pass, 1.04 s.

Picked by stats to replace a failing Era 5 (2005-2009) race; passes the simulator check (1.04 s).
Every fact below was read in the linked source (fetched Nov 9, 2026); nothing comes from memory.
Where sources disagree, the row says so. Check each row against its links and put your initials
and the date in **Owner checked**.

### Sources

| Short name | What |
|---|---|
| WP | [English Wikipedia race article](https://en.wikipedia.org/wiki/2009_European_Grand_Prix) (raw wikitext, full article read) |
| MS | [Motor Sport race report](https://www.motorsportmagazine.com/articles/single-seaters/f1/2009-european-grand-prix-report/) |
| AS | [Autosport report, "Barrichello wins again five years later"](https://www.autosport.com/f1/news/barrichello-wins-again-five-years-later-4431860/4431860/) |
| GPE | [GrandPrix.com race page](https://www.grandprix.com/races/european-gp-2009.html) |
| GPE-N | [GrandPrix.com race notes](https://www.grandprix.com/races/european-gp-2009-race-notes-barrichello-wins-european-gp.html) (lap-by-lap notes with gap tables) |
| Jolpica | [results](https://api.jolpi.ca/ergast/f1/2009/11/results.json) (round 11); the [pit stops](https://api.jolpi.ca/ergast/f1/2009/11/pitstops.json?limit=100) endpoint returned no data (none before 2011) |
| OpenF1 | Not used: no 2009 data |

Caveat: MS, AS, GPE and GPE-N were read through a fetch tool that summarises pages, so lap numbers
and compounds should be checked against the pages themselves. One GPE summary wrongly said
Barrichello started on pole (WP, MS and Jolpica all say grid 3); that line was dropped.

### Facts

| Topic | Fact | Sources | Owner checked |
|---|---|---|---|
| Grid | Hamilton pole (1:39.498), Kovalainen 2nd, Barrichello 3rd, Vettel 4th, Button 5th, Räikkönen 6th; Rosberg 7th, Alonso 8th, Webber 9th, Kubica 10th. Hamilton's first pole of 2009; first all-KERS front row (WP marks that line "citation needed"). | WP, Jolpica, MS | |
| Grid penalties | None in any source read. Jolpica grid matches qualifying order. | Jolpica, WP | |
| Qualifying fuel | Barrichello set his time with "significantly more fuel" than the cars around him, McLarens included (MS). Fuel-adjusted, Barrichello was fastest, Kovalainen 0.216 s behind, Hamilton 3rd (WP). GPE-N: Barrichello carried 3-4 more laps of fuel than the McLarens to his first stop. | MS, WP, GPE-N | |
| Laps | 57 laps of 5.419 km, 308.883 km. | WP, Jolpica | |
| Weather | Hot and dry. Start: air 31 °C, track 49 °C (WP). MS: oppressive heat. | WP, MS | |
| SC / VSC / red flag | None mentioned in any source read (WP, MS, AS, GPE, GPE-N). No VSC existed in 2009. Not cross-checkable via OpenF1. | WP, MS, AS, GPE, GPE-N | |
| Start / lap 1 | Hamilton, Kovalainen, Barrichello top three after lap 1; Räikkönen 6th → 4th; Button dropped to 9th (WP). Grosjean tapped Badoer into a spin; Glock and Buemi collided; Grosjean, Glock, Buemi pitted for repairs (WP, GPE). | WP, GPE, GPE-N | |
| Compounds | Both McLarens started on super-softs and made their first stops on them; Barrichello and Button started on softs (GPE, AS for McLarens). Final stint: Barrichello on super-softs, Hamilton and Räikkönen on softs (MS). GPE-N words it as Barrichello on the harder tyre early and the softer one from about lap 39, Hamilton on the harder one. | GPE, AS, MS, GPE-N | |
| Refuelling | 2009 rules: top-10 qualifiers could not refuel before the race (WP). Two stops for all front-runners. Both leaders fuelled to the finish at their second stops (GPE-N). Fill quantities: not in sources. | WP, GPE-N | |
| Hamilton stops | Stop 1: lap 16 (MS, GPE, GPE-N) / lap 15 (WP), rejoined 6th. Stop 2: lap 37 (WP, MS, GPE-N; AS "three laps sooner" than Barrichello). McLaren called him in, then tried to keep him out a lap to save fuel as Barrichello closed, but he was already committed; tyres were not ready and had to be brought out, 13.4 s stationary (MS, GPE-N, WP "tyres still in their blankets"). GPE says the call was around lap 36. | WP, MS, AS, GPE, GPE-N | |
| Kovalainen stops | Lap 17 (MS, GPE-N) / one lap after Hamilton (WP); lap 38 (GPE-N). Lost a place at both stops: Barrichello at the first, Räikkönen at the second (AS, WP). | MS, GPE-N, AS, WP | |
| Barrichello stops | Stop 1: lap 20 (MS, GPE-N) / lap 19 (WP), rejoined 2nd behind Hamilton, ahead of Kovalainen. Stop 2: lap 40 (WP, MS) / lap 39 (GPE-N), 6.8 s stationary (MS), rejoined in the lead by just over 6 s (MS). | MS, GPE-N, WP | |
| Räikkönen stops | Lap 19 (GPE-N) / lap 18 (WP); lap 39 (GPE-N). Jumped Kovalainen at the second stops. | GPE-N, WP, AS | |
| Button stops | Lap 19 (GPE-N) / lap 18 (WP); lap 43 (GPE-N) / 42 (GPE) / 41 (WP). | GPE-N, GPE, WP | |
| Vettel stops | Lap 16 (GPE, GPE-N) / lap 15 (WP): fuel rig failed to fuel the car, back in next lap (lap 17, GPE), rejoined 15th (GPE-N). | GPE, GPE-N, WP | |
| Gaps in race (GPE-N) | Lap 7: HAM +4.6 KOV, +6.5 BAR, +7.9 RAI. Lap 12: KOV 6.3, BAR 8.1, RAI 11.0. Lap 21: HAM leads BAR by 3.2, KOV 7.6. Lap 30: BAR 4.1, KOV 8.9, RAI 14.5. Lap 36: 3.6 s between Hamilton and Barrichello (GPE-N says Hamilton's lead; the GPE summary worded it the other way; the lap-30 table has Hamilton leading). Lap 41: BAR leads Rosberg (yet to stop) 2.9, HAM 6.0. Lap 50: BAR leads HAM by 5.9, RAI 14.6, KOV 20.2. AS: Barrichello needed the gap to Hamilton down to about two seconds before the stops. | GPE-N, GPE, AS | |
| Result | 1 Barrichello 1:35:51.289; 2 Hamilton +2.358; 3 Räikkönen +15.994; 4 Kovalainen +20.032; 5 Rosberg +20.870; 6 Alonso +27.744; 7 Button +34.913. Barrichello's first win since China 2004 (WP). Hamilton closed late as Barrichello eased off (GPE, AS). Fastest lap Glock 1:38.683, lap 55. | Jolpica, WP, AS, GPE | |
| Retirements | Vettel: engine; Jolpica 23 laps; WP "lap 24", GPE lap 23, GPE-N lap 25. Buemi: brakes; Jolpica 41 laps (AS lap 42, GPE-N ~44). Nakajima: puncture (lap 38, GPE), classified 18th, 54 laps. | Jolpica, WP, GPE, GPE-N, AS | |
| Penalties | Badoer drive-through, lap 33, crossing the pit-exit line (GPE-N). Button cut the chicane side by side with Webber early on and gave the place back; no penalty (AS, GPE-N, WP). | GPE-N, AS, WP | |
| Team orders | None in sources read. | — | |
| Title context | Before the race Button led Webber by 18.5 pts; Barrichello 4th, 3 pts behind Vettel (WP). After it Barrichello moved to 2nd (WP). | WP | |
| Whitmarsh view | McLaren's Martin Whitmarsh suggested Barrichello might have won even without the slow stop (MS). | MS | |

### Strategy dilemmas

1. **Hamilton / McLaren (lap 36-37):** leading by about 3.6 s on a shorter fuel load than
   Barrichello, with the Brawn quicker on its heavier, longer stint: pit now, or stretch one more
   lap; the team changed its mind mid-call and the stop went wrong (13.4 s).
2. **Barrichello / Brawn:** heavier first stint (3-4 extra laps) and a longer middle stint to
   jump both McLarens at the stops; needed the gap down to about 2 s before Hamilton's stop.
3. **Kovalainen vs Räikkönen** at the second stops (Räikkönen stopped later, jumped him).

### Proposal (draft)

| Item | Draft | Owner checked |
|---|---|---|
| Storyline drivers | Barrichello and Hamilton | |
| Dilemma (spec §4) | Hamilton leads on the lighter tank while Barrichello's longer-fuelled Brawn keeps closing: box now and cover him, or stretch the stint and risk losing the lead in the pits? | |
| Suggested side | Hamilton (the two timing calls against the overcut). The hard-call counter must confirm; Barrichello (longer stints) may score as high. | |
| Target (draft) | win: Hamilton beats Barrichello (rewrite allowed). If the counter picks Barrichello: defend, keep the win against Hamilton (no rewrite; he really won). | |
| Side really won? | Hamilton: no, 2nd by 2.358 s. Barrichello: yes. | |
| Modelling risk | Low to medium. Dry, no SC/red flag, no team orders, no front-runner contact. Watch: refuelling fills are not in sources (only "fuelled to the finish" at stop 2); Hamilton's 13.4 s stop is a crew error, about 6.6 s longer than Barrichello's, so a fair Hamilton win is plausible against a 2.358 s margin (balance it); first-stop lap disputes (WP is one lap earlier than MS/GPE-N throughout); super-soft/soft compound pairs; Vettel's fuel-rig double stop and Valencia's thin overtaking. | |

### Not in sources

- Fuel quantities at any stop; Kovalainen's and Räikkönen's stationary times; exact lap of
  Button's chicane cut (GPE-N: lap 1, per a lap-6 radio report, not quoted); any track-status
  data (OpenF1 has no 2009).

## france-2007 (2007 French Grand Prix): swap candidate for Era 5, facts sheet

Replaces `hungary-2006` (Era 5 #3). Robust G1: pass, 0.57 s.

Every fact below was read in the linked source on 2026-11-09; nothing comes from memory.
Where sources disagree, the row says so. Check each row and put your initials and the date in
**Owner checked**.

### Sources

| Short name | What |
|---|---|
| WP | [English Wikipedia race article](https://en.wikipedia.org/wiki/2007_French_Grand_Prix) (raw wikitext read) |
| GPE | [GrandPrix.com race notes, "Raikkonen heads Ferrari 1-2 in France"](https://www.grandprix.com/races/french-gp-2007-race-notes-raikkonen-heads-ferrari-1-2-in-france.html) (lap-by-lap, read in full) |
| AS-r | [Autosport race report, "Raikkonen leads Ferrari 1-2 in France"](https://www.autosport.com/f1/news/raikkonen-leads-ferrari-1-2-in-france-4411833/4411833/) |
| AS-f | [Autosport feature, "The complete 2007 French GP review"](https://www.autosport.com/motorsport/feature/1129/the-complete-2007-french-gp-review) |
| Jolpica-r | [Jolpica results, 2007 round 8](https://api.jolpi.ca/ergast/f1/2007/8/results/) |
| Jolpica-q | [Jolpica qualifying, 2007 round 8](https://api.jolpi.ca/ergast/f1/2007/8/qualifying/) |
| F1DB | F1DB v2026.19.0 `f1db-races-pit-stops.csv`, raceId 776 (local cache `pipeline/cache/eras-sources/f1db`) |

Notes on sources:
- **AS-r and AS-f blocked direct download (HTTP 403)**; both were read only through a fetch
  tool's summary and its verbatim extracts. Verify their rows against the pages.
- Jolpica has **no pit-stop data** for this race (`pitstops` returns 0); F1DB does.
- OpenF1 starts in 2023, so it has nothing here. Motor Sport: no 2007 race report found
  (only a results database page).

### Facts

| Topic | Fact | Sources | Owner checked |
|---|---|---|---|
| Grid | Massa pole (1:15.034), Hamilton 2nd, Räikkönen 3rd, Kubica 4th, Fisichella 5th, Kovalainen 6th; Heidfeld 7th, Trulli 8th, Rosberg 9th, Alonso 10th. | WP, Jolpica-r | |
| Grid penalties | None for the front-runners. Sato: ten-place grid penalty (a drive-through from Indianapolis he could not serve). Alonso set no Q3 time (gearbox), classified 10th. Sutil started from the pit lane (GPE: pushed off the grid at the start of the formation lap; spare car). | WP, GPE, AS-f | |
| Laps | 70 laps of 4.411 km, 308.586 km. | WP, Jolpica-r | |
| Weather | Cloudy (WP infobox); "cloudy and dry" (AS-r, AS-f). | WP, AS-r, AS-f | |
| Safety car / red flag | None reported. GPE's lap-by-lap notes mention none; AS-f mentions none. | GPE, AS-f | |
| Start / lap 1 | Massa kept the lead; Räikkönen passed Hamilton into Turn 1. Davidson hit Liuzzi at the first corner, both out. Trulli hit Kovalainen at the Adelaide hairpin: Trulli out, Kovalainen rejoined a lap down. | WP, GPE, AS-r | |
| Gaps, first stint | Lap 10: Massa 3.6 s ahead of Räikkönen. Lap 15: 4.6 s. | GPE | |
| Hamilton | Three stops: laps 16, 37, 51 (GPE, F1DB). Hard to soft at the first stop (GPE). GPE: his "short" (three-stop) strategy failed; after the last stop he was 32.9 s behind the leader (lap 51). | GPE, F1DB, AS-f | |
| Massa | Two stops: laps 19 and 43 (GPE, F1DB). Stayed on the harder compound at the first stop (GPE). Second-stop compound: **not in sources**. | GPE, F1DB | |
| Räikkönen | Two stops. First: lap 21 (GPE, WP) / lap 22 (F1DB, AS-f table). Second: lap 46 (GPE, F1DB). Hard tyres at both stops (GPE). AS-f: he made use of "three extra light-fuel laps" before his second stop. | GPE, WP, F1DB, AS-f | |
| Gaps, middle | Lap 25: Räikkönen 1.9 s behind Massa; Hamilton 8.6 s further back; Kubica another 13.2 s. Lap 43 (Massa's second stop): Massa still 2.0 s ahead, 30.3 s ahead of Hamilton. | GPE | |
| The pass | Lap 46: Räikkönen rejoined just ahead of Massa, who was trying to pass the lapped Williams of Wurz (GPE). AS-r: Räikkönen came out 1.8 s ahead. Massa said afterwards he lost the win in traffic in the second stint (AS-f, WP, GPE; press quotes, not radio). | GPE, AS-r, AS-f, WP | |
| Kubica | Two stops: laps 19 and 45 (GPE, F1DB); soft at the second (GPE). Briefly ahead of Hamilton after Hamilton's lap 37 stop; Hamilton re-passed half a lap later. | GPE, F1DB | |
| Heidfeld | Two stops: laps 22 and 47 (F1DB); soft at the second (GPE). | F1DB, GPE | |
| Fisichella | Two stops: laps 19 and 50. | GPE, F1DB | |
| Alonso | Stops laps 16 and 37 (GPE, F1DB; WP says 35). Soft to hard at the first stop (GPE). AS-f: switched from three stops to two and was fuelled to the finish, heavy for the last 33 laps. Long fight with Heidfeld (passed lap 33, chicane) and Fisichella (passed lap 22; finished behind him). | GPE, F1DB, WP, AS-f | |
| Button | Stops laps 32 and 50 (F1DB, GPE). **Conflict:** GPE twice calls him "one-stop" but also lists a lap-50 stop. | GPE, F1DB | |
| Fuel loads | No litres or kg given. AS-f: McLaren ran lighter than the cars around them; at mid-race the Ferraris were fuelled for one more stop. | AS-f | |
| Penalties | Sutil: drive-through (pit-lane speeding, AS-f), served lap 35 (GPE). Sato: grid penalty (above). No front-runner penalties. | AS-f, GPE, WP | |
| Retirements | Liuzzi (0 laps), Trulli, Davidson (1 lap, collisions), Albers lap 29 (left his stop with the fuel hose attached; Jolpica: 28 laps, "Refuelling"), Speed lap 57 (gearbox; Jolpica: 55 laps). No top-six car retired. | Jolpica-r, GPE, WP | |
| Team orders | None in any source read. | GPE, AS-f | |
| Result | 1 Räikkönen 1:30:54.200; 2 Massa +2.414; 3 Hamilton +32.153; 4 Kubica +41.727; 5 Heidfeld +48.801; 6 Fisichella +51.940 (AS-r/AS-f: +52.210); 7 Alonso +56.516; 8 Button +58.885. **Conflict:** WP's prose lists "Fisichella, Heidfeld"; its table and Jolpica have Heidfeld 5th. | Jolpica-r, WP, AS-r | |

### Dilemma, side and target (drafts)

| Item | Draft | Basis | Owner checked |
|---|---|---|---|
| Storyline drivers | Massa and Räikkönen (Ferrari team-mates, two stops each, decided at the second stops). | GPE, AS-f | |
| Dilemma | Leading by two seconds with traffic ahead, Massa must choose: box first and risk the lapped cars, or stretch the stint and match Räikkönen's fuel. | GPE, AS-f | |
| Target | win: Massa from pole (real: 2nd, 2.414 s behind). Alternative side: win as Räikkönen from P3. | Jolpica-r | |
| Did the side win? | Massa: no, so a rewrite is allowed. Räikkönen: yes (no rewrite). `pipeline hard-calls` picks the side. | Jolpica-r | |
| Risk | **Medium.** Dry, no SC, clean stop data (F1DB). Risks: the outcome depends on traffic (Wurz) and on the first fill fixing the second-stop lap; Räikkönen's first stop is lap 21 or 22 depending on source; no fuel numbers; no second-stop compound for Massa. | | |

## san-marino-2006 (2006 San Marino Grand Prix): swap candidate for Era 5

Replaces `brazil-2006` (Era 5 #4). Robust G1: pass, 0.79 s.

Candidate to replace a failing Era 5 (2005-2009) race. It passes the simulator check (0.79 s).
Every fact below was read in the linked source on Nov 9, 2026; nothing comes from memory. Where
sources disagree, the row says so. Check each row against its links and put your initials and
the date in **Owner checked**.

### Sources

| Short name | What |
|---|---|
| WP | English Wikipedia race article: https://en.wikipedia.org/wiki/2006_San_Marino_Grand_Prix |
| AS | Autosport race report: https://www.autosport.com/f1/news/schumacher-fends-off-alonso-to-imola-win-4400855/4400855/ |
| AS-R | Autosport "Complete 2006 San Marino GP Review": https://www.autosport.com/general/news/the-complete-2006-san-marino-gp-review-5076917/5076917/ |
| GPE-N | GrandPrix.com race notes: https://www.grandprix.com/races/san-marino-gp-2006-race-notes-schumacher-wins-san-marino-gp.html |
| MS | Motor Sport feature (2006 mentioned briefly): https://www.motorsportmagazine.com/articles/single-seaters/f1/norris-vs-verstappen-recalled-great-imola-duels-of-alonso-schumacher/ |
| Jolpica-R | Jolpica results: https://api.jolpi.ca/ergast/f1/2006/4/results/ |
| Jolpica-L | Jolpica lap timings: https://api.jolpi.ca/ergast/f1/2006/4/laps/ (offsets 0-1100, limit 100) |

Jolpica has no pit-stop data for 2006 (the pitstops endpoint returned no races). F1DB and OpenF1
were not used (OpenF1 starts in 2023). No Motor Sport race report for 2006 was found; only a
feature that mentions it. GPE-N was read in full as page text; WP, AS, AS-R and MS were read
through a fetch tool that summarises, so check wording against the pages.

**Jolpica-L derived values.** Stop laps and gaps marked "Jolpica-L" were worked out from the lap
timings, not stated in the API: the lap after the in-lap is ~20 s slow (stationary time lands on
it), and gaps are summed lap times. They agree with GPE-N's stated stop laps for every driver
below.

### Facts

| Topic | Fact | Sources | Owner checked |
|---|---|---|---|
| Grid top 6 | 1 M. Schumacher (Ferrari) 1:22.795, 2 Button (Honda) 1:22.988, 3 Barrichello (Honda), 4 Massa (Ferrari), 5 Alonso (Renault), 6 R. Schumacher (Toyota). Montoya 7, Räikkönen 8, Fisichella 11. | WP, Jolpica-R (grid column) | |
| Pole record | Schumacher's 66th pole, beating Senna's record of 65. | WP, GPE-N | |
| Grid penalties | None in any source read. | WP | |
| Race laps | 62 laps, 305.609 km. | WP, Jolpica-R | |
| Weather | Sunny (dry). Temperatures: not in sources. | WP, AS | |
| Lap-1 incident | Ide (Super Aguri) hit Albers (MF1) at the Villeneuve chicane; the MF1 rolled and landed upside down, Albers unhurt (0 laps, "Accident"). Ide pitted, rejoined after a long stop (12 minutes, AS-R); stewards reprimanded him. | WP, AS-R, Jolpica-R | |
| Safety car | One SC at the start for the Albers crash. Length differs: two laps (WP, AS-R), one lap (GPE-N). Jolpica-L: Schumacher's lap 2 took 2:30.440 against ~1:26-1:27 racing laps. No red flag in any source. | WP, AS-R, GPE-N, Jolpica-L | |
| Fuel loads | Alonso started heavy, heavier than Schumacher (AS, AS-R); Button on a light three-stop plan (AS-R). Litres or laps of fuel: not in sources. | AS, AS-R | |
| Tyres | Bridgestone (Ferrari) vs Michelin (Renault) (AS). Ferrari fitted Schumacher with a used set for the middle stint; he had grip trouble and graining (AS, AS-R, WP). Compound names: not in sources. | AS, AS-R, WP | |
| Stops: Schumacher | Two: laps 20 and 42. | GPE-N, AS-R, Jolpica-L | |
| Stops: Alonso | Two: laps 25 and 41. Led laps 21-25 while Schumacher was in the pits (Jolpica-L leader per lap). | GPE-N, AS, AS-R, Jolpica-L | |
| Stops: Massa | Two: laps 19 and 41. | GPE-N, AS-R, Jolpica-L | |
| Stops: Montoya | Two: laps 23 and 44. McLaren's strategy got him past Massa at the last stops (AS). Led laps 43-44 (Jolpica-L). | GPE-N, AS-R, AS, Jolpica-L | |
| Stops: Räikkönen | Two: laps 22 and 47. | GPE-N, AS-R, Jolpica-L | |
| Stops: Button | Three: laps 15, 30, 44. At the second the car left with the fuel rig still attached (lollipop raised too soon, AS-R; nozzle stuck and torn from the rig, WP); about 15 s lost (AS-R). | GPE-N, AS, AS-R, WP, Jolpica-L | |
| Stops: Barrichello | Two: laps 14 and 34. First stop 15 s, dropped him to 13th (WP). | GPE-N, WP, Jolpica-L | |
| Stops: Fisichella | Laps 29 (Jolpica-L; GPE-N's text is cut off at that lap number) and 48 (GPE-N, Jolpica-L). | GPE-N, Jolpica-L | |
| Gap, first stint | Schumacher led Button by 2.4 s at lap 10 (GPE-N); led by 13 s before the first stops (AS). Jolpica-L: Alonso 13.6 s behind at lap 20. | GPE-N, AS, Jolpica-L | |
| Alonso's charge | After his first stop Alonso was 11.2 s behind (AS) / 11 s on lap 26 (GPE-N), then 5 s lap 30, 4.6 s lap 31, 2.4 s lap 33, 0.4 s lap 34 (GPE-N). He stayed within ~0.3-0.6 s to lap 41 but could not pass; Imola is hard to overtake on (WP). | GPE-N, AS, WP, Jolpica-L | |
| Key call (lap 41) | Renault pitted Alonso early to try to undercut Schumacher (AS-R). Ferrari brought Schumacher in the next lap (AS-R, GPE-N); his in-lap / out-lap was fast enough to come out ahead (AS, AS-R); Alonso's out-lap was not quick enough (WP). Jolpica-L: Alonso 0.6 s behind after both had stopped (lap 43). | AS-R, AS, GPE-N, WP, Jolpica-L | |
| Final stint | Alonso followed within 0.3-0.4 s (GPE-N lap 50: 0.3 s); three laps from the end he ran wide at the Villeneuve chicane, giving Schumacher a two-second lead (AS; WP says he ran wide chasing). MS: late on the leader had degrading front tyres and the chaser healthier rubber. | GPE-N, AS, WP, MS | |
| Result top 6 | 1 M. Schumacher 1:31:06.486; 2 Alonso +2.096; 3 Montoya +15.868; 4 Massa +17.096; 5 Räikkönen +17.524; 6 Webber +37.739. (7 Button +39.635, 8 Fisichella +40.200.) | Jolpica-R, WP | |
| Retirements | Albers 0 laps (accident), Trulli 5 (steering), Ide 23 (suspension), Klien 40 (hydraulics), Sato 44 (spun off / accident), Coulthard 47 (driveshaft). No front-runner retired. | Jolpica-R, WP | |
| Penalties, contact, team orders | Only Ide's reprimand for the lap-1 contact. No other penalties, contact among front-runners or team orders in any source read. | WP, AS-R, AS | |

### Proposal (draft, for the owner)

- **Storyline drivers:** Fernando Alonso (Renault) and Michael Schumacher (Ferrari).
- **Dilemma (original wording):** Glued to a grip-starved Ferrari on a track where nobody passes,
  does Renault gamble on stopping a lap early, or wait for Schumacher to blink?
- **Draft target:** `beat-rival`: Alonso finishes ahead of Schumacher (equivalent to `win`).
  Schumacher's side would be `defend` (keep the lead through the lap-41/42 stops). Run
  `pipeline hard-calls` to choose the side; Alonso has the timing call (lap 41) and the long
  first stint.
- **Did that side really win?** Alonso: no (2nd, +2.096 s), so a rewrite is allowed. Schumacher:
  yes, so no rewrite if he is the side.
- **Risk: medium.** The whole story depends on Schumacher's mid-race graining on used tyres,
  which is a per-stint effect for one car (B3 "per-stint wear for scripted cars" is not built);
  without it Alonso may not catch him. The Imola pass is effectively impossible, so the result
  turns on a one-lap undercut margin (0.6 s after both stops). Fuel loads are not sourced, so the
  real fills must come from the reconstruction/model, not from these sheets. Safety-car length
  is disputed (1 vs 2 laps). Positives: dry, no red flag, every front-runner's stop laps agree
  across GPE-N, AS-R and Jolpica lap timings.

## great-britain-2007 (2007 British Grand Prix): swap candidate, Era 5

Replaces `china-2007` (Era 5 #5). Robust G1: pass, 0.58 s.

Every fact below was read in the linked source on 2026-11-09; nothing comes from memory. Where
sources disagree, the row says which was taken. Check each row against its links and put your
initials and the date in **Owner checked**.

### Sources

| Short name | What |
|---|---|
| WP | [English Wikipedia, 2007 British Grand Prix](https://en.wikipedia.org/wiki/2007_British_Grand_Prix) (first 100,000 characters of the page text read) |
| AS | [Autosport, "The Complete 2007 British GP Review"](https://www.autosport.com/general/news/the-complete-2007-british-gp-review-5078406/5078406/) (includes a lap-by-lap log) |
| GPE | [GrandPrix.com 2007 British GP page](https://www.grandprix.com/races/british-gp-2007.html) (race notes summary and results header) |
| GPE-inc | [GrandPrix.com race incidents](https://www.grandprix.com/races/british-gp-2007-race-incidents.html) |
| Jolpica | [api.jolpi.ca/ergast/f1/2007/9/results.json](https://api.jolpi.ca/ergast/f1/2007/9/results.json) (Jolpica has no pit-stop rows for this race: `pitstops.json` total 0) |
| F1DB | F1DB v2026.19.0 CSV (local cache `pipeline/cache/eras-sources/f1db`): `f1db-races.csv` race 777, `f1db-races-pit-stops.csv`, `f1db-races-starting-grid-positions.csv` |

The GrandPrix.com race notes page (`british-gp-2007-race-notes-raikkonen-wins-british-gp.html`)
returned HTTP 429 twice and was not read. OpenF1 has no 2007 data.

### Facts

| Topic | Fact | Sources | Owner checked |
|---|---|---|---|
| Grid | Hamilton pole (1:19.997), Räikkönen 2nd (1:20.099), Alonso 3rd (1:20.147), Massa 4th (1:20.265), Kubica 5th (1:20.401), R. Schumacher 6th (1:20.516); Kovalainen 7th, Fisichella 8th. | F1DB grid, WP, Jolpica | |
| Grid penalties / pit-lane starts | No grid penalties for the top six in any source. Massa stalled on the grid; the start was aborted (AS) and WP says this led to a second formation lap. Massa then started from the pit lane (WP, AS, GPE), as did Sato (WP, AS; GPE-inc: Sato changed to his race chassis). Jolpica still lists Massa grid 4. Rosberg qualified out in Q1 with an engine issue (WP). | WP, AS, GPE, GPE-inc, Jolpica | |
| Laps | 59 laps run, 60 scheduled (F1DB: laps 59, scheduled laps 60; 303.216 km of 308.355 km; WP infobox "59 laps (scheduled 60)"). GPE results header: 59 laps. No source read states the reason for the cut. | F1DB, WP, GPE | |
| Weather | Dry and sunny (WP infobox "Dry and sunny"; AS "Weather: Sunny"). | WP, AS | |
| SC / VSC / red flag | None mentioned in WP, AS or GPE-inc. (No VSC in 2007.) | WP, AS, GPE-inc | |
| Tyres | Bridgestone for all (F1DB). Räikkönen started on the softer tyre (AS). Hamilton started on the prime and used the softer tyre only in his final stint, which he regretted (AS). Alonso switched to soft at his stop (AS; which stop is not clear in the text read). WP mentions no compounds. | AS, F1DB | |
| Fuel | No fuel weights in any source read. Massa qualified "on a slightly heavier fuel load" (AS). Alonso ran a heavier first stint than the others, then "took on a light fuel load" at his first stop (GPE); WP says he was short-fuelled to jump into the lead and so had to stop early. Räikkönen tried to "save some fuel and look after tyres" early on (GPE). | AS, GPE, WP | |
| Stops: Hamilton | Lap 16 and lap 38 (F1DB pit lane times 26.170 s, 25.557 s; AS). At the first stop he almost left before the fuel nozzle was released (GPE-inc, AS, WP); he rejoined 5th (WP). | F1DB, AS, GPE-inc, WP | |
| Stops: Räikkönen | Lap 18 and lap 43 (F1DB 26.975 s, 24.181 s; AS). Rejoined ahead of Hamilton at the first; kept the lead at the second (AS: rejoined about four seconds clear of Alonso on lap 43). WP's text says "three laps later" than Hamilton (lap 19); F1DB and AS (lap 18) taken. | F1DB, AS, WP | |
| Stops: Alonso | Lap 20 and lap 37 (F1DB 24.065 s, 25.923 s; AS). The lap-20 stop was short and he rejoined just ahead of Räikkönen (AS). WP's text implies about lap 22; F1DB and AS taken. | F1DB, AS, WP | |
| Stops: others | Massa laps 20 and 45; Kubica 16 and 40; Heidfeld 19 and 42 (F1DB). Barrichello and Button one-stopped from far back to 9th and 10th (WP; GPE: Barrichello "single-stop"). | F1DB, AS, WP, GPE | |
| Leaders | Hamilton laps 1-15 (AS), Räikkönen briefly during the first stops, Alonso from his lap-20 stop, Räikkönen for good after his lap-43 stop (AS calls him the "third and final leader"). AS is inconsistent on exact lead laps; WP gives no lap chart numbers in the text read. Räikkönen pulled away from the lighter-then-heavier Alonso in the middle stint by 0.9-1.3 s a lap (AS search summary; not re-checked in the page text). | AS, WP | |
| Fastest lap | Räikkönen 1:20.638, lap 17. | WP | |
| Result (top 6) | Räikkönen 1:21:43.074; Alonso +2.459; Hamilton +39.373; Kubica +53.319; Massa +54.063 (from the pit lane); Heidfeld +56.336. All 59 laps. Kovalainen 7th, Fisichella 8th (+1 lap). | Jolpica, WP | |
| Retirements | Webber lap 8 hydraulics; Sutil 16 engine; R. Schumacher 22 wheel (AS: suspension); Speed 29 accident; Davidson 35 mechanical; Trulli 43; Liuzzi 53 gearbox, classified 16th (Jolpica laps). AS and GPE-inc give some laps one or two higher (Sutil 17, Speed 30, Trulli pitted lap 43); Jolpica laps completed taken. | Jolpica, WP, AS, GPE-inc | |
| Contact | Wurz and Speed collided at Club after being lapped; Speed out (GPE-inc lap 30; AS gives Vale in one place, Club in another). Rosberg went onto the grass after a brush with Coulthard, lap 9 (GPE-inc). No front-runner contact. | GPE-inc, AS | |
| Penalties / team orders | None in any source read. | WP, AS, GPE-inc | |

### Proposal (draft, for the owner)

| Item | Draft | Owner checked |
|---|---|---|
| Storyline drivers | Räikkönen (Ferrari) and Alonso (McLaren) | |
| Dilemma (original wording) | Two-stopping at Silverstone with fuel deciding the order: short-fill Alonso to jump Räikkönen at the first stops, or run long like Ferrari and win it at the second? | |
| Suggested side | Alonso: his short fill at the first stop and early second stop (lap 37 vs Räikkönen's 43) are the debatable calls. Räikkönen's side is the same race from the other pit wall. Final choice from `pipeline hard-calls`. | |
| Target (draft) | beat-rival: Alonso finishes ahead of Räikkönen (equivalently win, since Hamilton finished 39 s back) | |
| Did the side really win? | Alonso: no (2nd by 2.459 s), so a history-book rewrite is allowed. If the side ends up Räikkönen (who won), no rewrite. | |
| Modelling risk | **Medium.** Dry, no SC or red flag, no penalties, no team orders, no front-runner contact or failure. The outcome is decided by refuelling fill sizes, which no source gives as numbers (only "light fuel load"), so the real fills must come from stop spacing. Massa's pit-lane start and the 59-of-60 lap distance need the race file to match. Compound choice (prime/soft) matters to Hamilton's stints and is only partly sourced. | |

### Not in sources

- Fuel weights or fill amounts for any car.
- Gaps between Räikkönen and Alonso at each stop (only the ~4 s after Räikkönen's lap-43 stop, AS).
- Which stop Alonso took soft tyres at; Räikkönen's and Alonso's compounds per stint.
- The reason the race was shortened from 60 to 59 laps.

## bahrain-2006 (2006 Bahrain Grand Prix): swap candidate, Era 5

Replaces `monaco-2008` (Era 5 #8). Robust G1: pass, 1.39 s.

Every fact below was read in the linked source (fetched 2026-11-09); nothing comes from memory.
Where sources disagree, the row says so. Check each row against its links and put your initials
and the date in **Owner checked**. Motor Sport: no race report on this race found. OpenF1 does
not cover 2006; Jolpica has no 2006 pit-stop data.

### Sources

| Short name | What |
|---|---|
| WP | [English Wikipedia race article](https://en.wikipedia.org/wiki/2006_Bahrain_Grand_Prix) |
| AS-R | [Autosport, "The Complete 2006 Bahrain GP Review"](https://www.autosport.com/general/news/the-complete-2006-bahrain-gp-review-5076835/5076835/) |
| AS-N | [Autosport race news, "Alonso beats Schumacher to Bahrain win"](https://autosport.com/f1/news/50044/alonso-beats-schumacher-to-bahrain-win) |
| GPE | [GrandPrix.com race notes](https://www.grandprix.com/races/bahrain-gp-2006-race-notes-alonso-wins-bahrain-gp.html) |
| Jolpica-R | [Jolpica results](https://api.jolpi.ca/ergast/f1/2006/1/results.json) |
| Jolpica-Q | [Jolpica qualifying](https://api.jolpi.ca/ergast/f1/2006/1/qualifying.json) |

### Facts

| Topic | Fact | Sources | Owner checked |
|---|---|---|---|
| Grid | M. Schumacher pole (1:31.431), Massa 2nd (1:31.478), Button 3rd (1:31.549), Alonso 4th (1:31.702), Montoya 5th, Barrichello 6th; Webber 7th. Räikkönen started 22nd (last): suspension failed on his first timed lap in qualifying. Monteiro started from the pit lane (car problem on the way to the grid). No grid penalties for the front-runners. Ferrari's front row suspected of owing "something to a light fuel load" (AS-R); Webber and Montoya qualified heavy (AS-R); Alonso ran fuel-saving laps in final qualifying to stretch his first stint (AS-R). Fuel quantities: not in sources. | Jolpica-Q, Jolpica-R, WP, AS-R | |
| Laps | 57 laps, 308.238 km (5.412 km lap). | WP | |
| Weather | "Fine, Dry and Hot"; air 23 °C, track 40 °C dropping to 34 °C. | WP | |
| SC / VSC / red flag | None mentioned in any source read (no VSC existed in 2006). | WP, AS-R, AS-N, GPE | |
| Start / lap 1 | Schumacher led from Massa into Turn 1; Alonso passed Massa (Turn 3, AS-N) for 2nd. Heidfeld hit Rosberg at the first corner (Rosberg's front wing damaged, pitted end of lap 1). Albers out with a broken driveshaft at the start. Button fell to 6th, then re-passed Barrichello (lap 3 for good). | AS-N, AS-R, WP, GPE | |
| Massa | Spun at Turn 1 on lap 8 (GPE: lap 7), missing Alonso by inches; pitted lap 8 for flat-spotted tyres, airgun failure, stationary 46.8 s (team section 46.7 s); rejoined last; second stop lap 33; finished 9th. | AS-R, AS-N, GPE, Jolpica-R | |
| Stops: Schumacher | Two stops: lap 15 (8.2 s, AS-N) and lap 36. Led by about 7 s by lap 15 (AS-N). | AS-R, AS-N, GPE | |
| Stops: Alonso | Two stops: lap 19 (about 8 s; "four laps later", AS-N) and lap 39 (7.7 s stationary, "a second less than Schumacher had been", AS-R). Ran about 1 s behind Schumacher at laps 25 and 31 (GPE). | AS-R, AS-N, GPE | |
| The decisive stop | On lap 39, three laps after Schumacher's final stop, Alonso rejoined alongside the Ferrari, had the inside into Turn 1 and took the lead. AS-R: 1.2 s margin at the stops; final margin about equal to the gap between the two cars' final stop times. Schumacher closed to 0.4 s around lap 52 but could not pass. | AS-R, AS-N, WP | |
| Stops: Räikkönen | One stop, lap 30 (11 s stationary, AS-N), from 3rd, dropped to 6th, climbed back to 3rd; ran a heavy fuel load from 22nd on the grid. | AS-R, AS-N, GPE | |
| Stops: Button | Two stops, laps 18 and 40. Passed Montoya for 3rd on lap 11 (AS-N; GPE: lap 10), and again for 4th on lap 28 (GPE); lost places in the stops (WP). Finished 0.632 s behind Räikkönen. | AS-R, GPE, WP, Jolpica-R | |
| Stops: others | Montoya laps 23 (GPE: 22-23, from the lead) and 44. Webber laps 23 and 39. Barrichello lap 16 (GPE; no other stop listed), lost third gear about lap 20, finished 15th. Coulthard one stop, lap 30. Ralf Schumacher three stops, Trulli two. | AS-R, GPE, AS-N, Jolpica-R | |
| Retirements | Albers lap 0/1 (driveshaft); Fisichella lap 21 (Jolpica: 21 laps; "hydraulics", Jolpica/WP; AS-N: engine mapping; GPE: electronic failure); Villeneuve engine (Jolpica: 29 laps; AS: lap 30); Ide mechanical (Jolpica: 35 laps; AS: lap 36). | Jolpica-R, WP, AS-R, AS-N, GPE | |
| Penalties / contact | Ide drive-through (lap 3) for Super Aguri staying on the grid too long. Heidfeld/Coulthard contact lap 15; Heidfeld reprimanded after the race for moves on Coulthard and Ralf Schumacher. No front-runner penalties. Team orders: none in sources. | AS-R, AS-N, WP | |
| Result | Alonso 1:29:46.205; Schumacher +1.246; Räikkönen +19.360; Button +19.992; Montoya +37.048; Webber +41.932; Rosberg +1:03.043; Klien +1:06.771; Massa +1:09.907. | Jolpica-R, WP, AS-N | |

### Proposal (draft, for the owner)

| Item | Draft | Owner checked |
|---|---|---|
| Storyline drivers | Alonso (Renault) and M. Schumacher (Ferrari): the fight for the win decided at the second stops. | |
| Dilemma (original wording) | Schumacher pits first on lap 36; Renault can keep Alonso out three more laps on a lighter tank and gamble that the overcut puts him ahead at pit exit. | |
| Suggested side | Alonso (pending `pipeline hard-calls`). Alternative: Räikkönen (one-stop from last; mostly a pace story, fewer calls). | |
| Target (draft) | win: Alonso from P4. Alternative: beat-rival Schumacher. | |
| Side really won? | Yes: Alonso won. No "rewrite" in the history book. | |
| Modelling risk | **Medium.** Dry, no SC, no red flag. But the win came by 1.246 s after a side-by-side pit exit, so the sim's stop time and refuel rate decide it (stop times 7.7 s vs about 8.7 s). Fuel loads unknown. Massa's 46.8 s stop and Räikkönen's start from 22nd must be modelled (scripted). Fisichella's retirement is not on the player's car. | |

### Not in sources

- Fuel loads (litres / laps) for any car; Schumacher's second-stop stationary time (only implied about 8.7 s).
- Lap-by-lap gaps beyond those quoted (laps 5, 8, 15, 23, 25, 31, 45, 52).
- Tyre compounds and tyre makers for each stint.
- Any safety car, team order or Motor Sport race report.

## turkey-2008 (Era 5 swap candidate): facts sheet

Replaces `brazil-2008` (Era 5 #9). Robust G1: pass, 0.98 s (strict: fail; robust: pass).

Sim check: passes (0.98 s). Every fact below was read in the linked source; "not in sources"
where a number was not given. No team radio quoted.

### Facts

| # | Fact | Source(s) | Owner checked |
|---|---|---|---|
| 1 | Istanbul Park, 11 May 2008, round 5 of 18. 58 laps, 309.396 km. | WP, Jolpica | |
| 2 | Weather: sunny, dry, up to 17 °C. | WP | |
| 3 | Grid top 6: Massa (Ferrari) pole 1:27.617, Kovalainen (McLaren), Hamilton (McLaren), Räikkönen (Ferrari), Kubica (BMW Sauber), Webber (Red Bull). Then Alonso 7, Trulli 8, Heidfeld 9, Coulthard 10. | WP, Jolpica (grid column) | |
| 4 | Grid penalty: Fisichella, three places for leaving the pit lane on a red light in P1; qualified 19th, started 20th. No other grid penalty reported. | WP, Jolpica (grid 20) | |
| 5 | Q3 cars could not refuel before the race (2008 rule). Fuel loads/car weights: not in sources. | WP | |
| 6 | Hamilton chose the wrong tyre in qualifying (skipped a softer-compound run, low grip late in the lap). | WP, MS | |
| 7 | Lap 1: Räikkönen squeezed at the start, his front wing touched Kovalainen's left-rear: Kovalainen puncture, pitted lap 2, dropped to last. Räikkönen kept the damaged wing all race. | WP, MS | |
| 8 | Lap 1: Vettel/Sutil contact (Vettel puncture, Sutil new front wing). Fisichella and Nakajima collided at Turn 1; Fisichella out on the spot (0 laps), Nakajima retired (1 lap). | WP, Jolpica | |
| 9 | Safety car: deployed lap 1 after the collision, withdrawn end of lap 2 ("only remained out for one lap"). No VSC (not in use in 2008), no red flag reported. | WP, GPE | |
| 10 | Why Hamilton three-stopped: Bridgestone feared his front-right tyre could fail as it did in Istanbul 2007 (blowout 15 laps from the end); internal construction issue linked to Turn 8 loads and his driving style; concern raised before Saturday qualifying; McLaren ran him lighter and added a stop as a precaution. | AS-tyre, GPE, MS, WP | |
| 11 | Stops (WP narrative): Alonso lap 15 (first of the leaders); Hamilton laps 16, 32, 45; Massa laps 18, 40; Kubica lap 18; Räikkönen laps 21, 43; Heidfeld around lap 21; Kovalainen laps 2 (puncture), 50. Räikkönen ran two laps longer than Kubica before the first stops (GPE). | WP, GPE | |
| 12 | Compounds (Autosport tyre table, partly garbled; its finish column is wrong): Massa Hard-Hard-Soft; Kubica Hard-Hard-Soft; Heidfeld Hard-Hard-Soft; Alonso Soft-Hard-Hard; Kovalainen Soft-Hard-Soft. Hamilton's and Räikkönen's rows: not reliable / not in sources. McLaren "not well adapted to the softer of the two compounds" (MS). | AS-strat, MS | |
| 13 | Refuel amounts per stop: not in sources. | — | |
| 14 | Lap 24: Hamilton, lighter on fuel, passed Massa at Turn 12 for the lead. Same lap Bourdais retired (rear suspension, Turn 12; Jolpica 24 laps, "Suspension"). | WP, Jolpica | |
| 15 | Lap 32 Hamilton stopped, rejoined 3rd, 2.6 s behind Räikkönen. Lap 43: after Räikkönen's last stop, Hamilton led Massa by 14.4 s, Räikkönen ~7 s further back. Lap 45 Hamilton's third stop: rejoined behind Massa, ahead of Räikkönen; order held to the flag. | WP | |
| 16 | Result: Massa 1:26:49.451; Hamilton +3.779; Räikkönen +4.271; Kubica +21.945; Heidfeld +38.741; Alonso +53.724. (WP text says 3.7 s; table 3.779.) Massa's third straight Istanbul win. | Jolpica, WP, MS | |
| 17 | Retirements: Fisichella (collision, lap 0), Nakajima (collision, lap 1), Bourdais (suspension, lap 24). | Jolpica, WP | |
| 18 | Race penalties: none reported. Team orders: none reported. | WP | |

### Strategy dilemma

- **McLaren / Hamilton:** forced three-stop on a light car versus Ferrari's two-stop. He has to
  build a gap on a light car (he led by 14.4 s before his last stop) and still rejoin ahead of
  Massa; he came out behind and lost by 3.8 s.
- **Ferrari / Massa:** when to answer Hamilton's lap-24 pass; stop later (lap 40) and keep the
  track position on the two-stop.
- Räikkönen: driving a damaged wing, stopped latest (21, 43); finished 0.5 s behind Hamilton.

### Proposal (draft, owner to decide)

- **Storyline drivers:** Hamilton (side) and Massa (rival). Räikkönen as a third threat.
- **Dilemma (original wording):** "A tyre warning forces Hamilton onto three stops: can a light
  McLaren build enough of a gap to beat Massa's two-stop Ferrari?"
- **Target (draft):** win: Hamilton from P3 on three stops (beat Massa). Fallback:
  beat-rival Räikkönen / position P2.
- **Did that side really win?** No (Hamilton 2nd, +3.779 s), so a history-book rewrite is allowed.
  If the hard-call counter picks Massa, he really won: no rewrite, target "defend".
- **Side check needed:** `pipeline hard-calls turkey-2008` (Hamilton has more calls: 3 stops).
- **Risk:** medium. Gaps, laps and stop laps are well sourced (WP narrative, consistent with
  GPE). Weak points: no fuel load or fill amounts (real calls need `{laps:n}` fills, so derive
  from stop laps only); Hamilton's compound sequence not reliably sourced; the three-stop is a
  forced tyre-safety call, which the game must present without implying a free choice; stop laps
  come from WP narrative only (no Jolpica pit data for 2008).

### Sources

| Short name | URL | Read |
|---|---|---|
| WP | https://en.wikipedia.org/wiki/2008_Turkish_Grand_Prix | 2026-11-09 |
| Jolpica | https://api.jolpi.ca/ergast/f1/2008/5/results.json (pitstops endpoint: 0 rows) | 2026-11-09 |
| GPE | https://www.grandprix.com/races/turkish-gp-2008.html | 2026-11-09 |
| MS | https://www.motorsportmagazine.com/reports/f1/2008-turkish-grand-prix-report/ | 2026-11-09 |
| AS-tyre | https://www.autosport.com/f1/news/tyre-problem-specific-to-hamilton-4421765/4421765/ | 2026-11-09 |
| AS-strat | https://www.autosport.com/f1/news/tyre-strategies-turkish-gp-4429804/4429804/ (table partly garbled) | 2026-11-09 |

### Authored (B1, Nov 9): Hamilton, P2 or better

Branch `eras-author-turkey-2008` (base `eras-swap-era5`). Content in `data/eras/turkey-2008.json`
and `data/moments/turkey-2008.json`; the race file is the integrator's to rebuild.

- Robust G1 (`pipeline validate turkey-2008 --robust`, Eras build with this overlay): pass,
  0.98 s (strict status fail), unchanged by the overlay.
- `pipeline hard-calls turkey-2008`: HAM 0, MAS 0; chance given up HAM 109.3 pts, MAS 14.7 →
  side **Hamilton** (tie broken by chance given up), rival Massa. Hamilton didn't win, so the
  history-book rewrite is allowed (on a win).
- Target: **position 2** (owner-accepted pattern: a position target when beating the rival is
  unreachable). With a win target (`author --target win`) no searched path won: the real calls
  (soft, soft, hard on laps 16, 32, 45) finish 0.3-5.4 s behind Massa on seeds 2-4 and win
  only on seed 5; the reachability search (seeds 1-3) never earned ★1. The win stays as the
  rewrite condition.
- Moments (`pnpm --filter @laststint/sim author turkey-2008 --eras --target position:2 --write`):
  stop-16, pace-29, stop-32, pace-37, stop-45. Real calls carry fills derived from the stop
  laps (no source gives fill amounts, fact 13): stop-16 box-soft `{laps:16}`, stop-32 box-soft
  `{laps:13}`, stop-45 box-hard `{laps:13}`; the other pit options use the standard fill.
  The compounds are the build's estimates (Hamilton's sequence is not reliably sourced, fact 12;
  the build has Massa starting on softs where AS-strat's table says hards).
- Mastery: exactly three stops (Hamilton's real, tyre-safety plan). Hidden: no more than 30
  laps on push (the passing path pushes from lap 29 to the flag).
- storylineEvents: none. The only event after the takeover (lap 13) is Bourdais's retirement,
  which Legend keeps anyway; the lap-1 safety car is not in the built model.
- Reachability (`pnpm --filter @laststint/sim reachability turkey-2008`): **pass** at era
  difficulty (threshold 82, Smart rival) and at Legend (90, Expert rival), all three stars and
  the hidden objective on seed 2 (stop-16 box-soft, pace-29 push, stop-32 box-soft, pace-37
  push, stop-45 box-hard). Stay-out never earns ★3 (seeds 1-3, both levels).

| Authored text | Wording | Rests on | Owner checked |
|---|---|---|---|
| Storyline (real) | A tyre warning puts Hamilton on three stops in a light McLaren. He passes Massa for the lead on lap 24 and is 14.4 s clear of him on lap 43, but after his last stop on lap 45 he rejoins behind him. Massa wins by 3.8 s, his third Istanbul win in a row, with Räikkönen half a second behind Hamilton. | Facts 10, 14, 15, 16 (3.779 s; Räikkönen +4.271 s, 0.492 s behind Hamilton) | |
| Headline (rewrite, original) | Hamilton's three stops beat Massa in Istanbul | Rewrite on a win | |
| Briefing | Istanbul, 2008. Massa takes pole for Ferrari, Hamilton qualifies third. Bridgestone fears for Hamilton's front-right tyre, so McLaren run him light on three stops. You run Hamilton, second and 1.2 s behind Massa after 13 laps. Finish second at least, and beat Massa's two-stop Ferrari if you can. | Facts 3, 10, 11 (Massa two stops); P2 and 1.2 s at lap 13 from the race model (Jolpica lap times, `stateAtTakeover`), not from a written source | |
| Target | Finish second or better | Fact 16 (real P2) | |
| Mastery | Finish second or better on three stops | Facts 10, 11 | |
| Hidden | Finish second or better pushing for no more than 30 laps | Game objective, no fact | |

## malaysia-2006 (2006 Malaysian Grand Prix): swap candidate, Era 5

Replaces `brazil-2009` (Era 5 #10). Robust G1: pass, 1.10 s.

Every fact below was read in the linked source (fetched 2026-11-09); nothing comes from memory.
Where sources disagree, the row says so. Check each row against its links and put your initials
and the date in **Owner checked**.

GrandPrix.com (rr752) and Motor Sport could not be read this session (GPE returned HTTP 429;
Motor Sport's database page has no report text). Facts rest on WP, AS and Jolpica only.

### Sources

| Short name | What |
|---|---|
| WP | [English Wikipedia race article](https://en.wikipedia.org/wiki/2006_Malaysian_Grand_Prix) (read as wikitext) |
| AS | [Autosport race report, "Fisichella leads Renault 1-2 in Malaysia"](https://www.autosport.com/f1/news/fisichella-leads-renault-1-2-in-malaysia-4401711/4401711/) (includes provisional results) |
| Jolpica-R | [Jolpica results](https://api.jolpi.ca/ergast/f1/2006/2/results.json) |
| Jolpica-Q | [Jolpica qualifying](https://api.jolpi.ca/ergast/f1/2006/2/qualifying.json) |
| Jolpica-L | Jolpica lap times per driver, e.g. [Alonso](https://api.jolpi.ca/ergast/f1/2006/2/drivers/alonso/laps.json?limit=100) (also fisichella, button, montoya, massa, michael_schumacher) |

Not read: GPE race report (https://www.grandprix.com/gpe/rr752.html, HTTP 429), Motor Sport race
report (none found). Jolpica has no pit-stop data before 2011.

### Facts

| Topic | Fact | Sources | Owner checked |
|---|---|---|---|
| Grid | Fisichella pole (1:33.840), Button 2nd, Rosberg 3rd, Webber 4th, Montoya 5th, Räikkönen 6th; Alonso 7th. Michael Schumacher qualified 4th but started 14th. | Jolpica-R, Jolpica-Q, WP | |
| Alonso's qualifying | Alonso "could only manage 7th place after a problem with his fuel calculation meant he was carrying too much fuel during the session" (Q3 was run on race fuel). | WP | |
| Grid penalties | 10-place engine-change penalties: M. Schumacher (to 14th), R. Schumacher (22nd), Coulthard (19th), Barrichello (20th), Massa (21st). **Conflict:** WP prose says Massa changed engines twice and lost 20 places; WP footnote says a 10-place penalty. Grid slots from Jolpica-R. | WP, Jolpica-R | |
| Laps | 56 laps, 310.408 km. | WP, AS, Jolpica-R | |
| Weather | Dry. Track 37 °C, air 33 °C, humidity 61% at the start (AS). WP infobox "Fine"; WP prose "a little overcast and with a possibility of rain later"; AS results header "Cloudy". No rain is reported in the race. | AS, WP | |
| SC / VSC / red flag | Neither WP nor AS mentions a safety car or red flag (Räikkönen's lap-1 crash into the turn-8 gravel is not followed by any SC in either report). No VSC existed in 2006. An explicit "no safety car" statement: not in sources. | WP, AS | |
| Start / lap 1 | Fisichella led into Turn 1; Alonso went from 7th to 3rd round the outside of Turn 1 while Rosberg and Webber fought. Räikkönen crashed out on lap 1 after contact from Klien's Red Bull (rear suspension; AS: "appeared to collide"). | WP, AS, Jolpica-R | |
| Stop-lap method | Jolpica has no pit data for 2006. In-laps below are read from Jolpica-L: the slow lap (~114-121 s vs ~96-99 s) is the lap that contains the stop, i.e. in-lap + 1 (checked against AS: Fisichella "after 17", Alonso "end of lap 26" and "after 43 laps", Massa "after 29 laps"). | Jolpica-L, AS | |
| Stops: Fisichella | Two stops, in-laps 17 and 38. Set a run of fastest laps in the first stint. | Jolpica-L, AS | |
| Stops: Alonso | Two stops, in-laps 26 and 43. First stint 10 laps longer than Fisichella's (WP). Second stop "a rapid 6.4 seconds in-and-out" (AS); "a quick splash-and-dash" (WP). Rejoined 2nd, behind Fisichella and ahead of Button. Fuel load figures: not in sources. | Jolpica-L, AS, WP | |
| Stops: Button | Two stops, in-laps 19 and 38. Led laps 18-19 (AS: "between laps 18 and 20"). After the first stop he rejoined behind Montoya (not yet stopped); before the second stop he was stuck behind Sato and a Toro Rosso, and pitted to escape the traffic; rejoined behind Montoya (AS: "wound up running fourth behind the slower Montoya"). | Jolpica-L, AS, WP | |
| Stops: Montoya | Two stops, in-laps 23 and 42. | Jolpica-L, AS | |
| Stops: Massa | One stop, in-lap 29, from 21st on the grid; ran 4th before stopping, rejoined 7th-8th. | Jolpica-L, AS, WP | |
| Stops: M. Schumacher | Two stops, in-laps 23 and 45. Rejoined after the second stop just behind Massa, who led him through Turn 1 and kept the place to the flag. | Jolpica-L, WP | |
| Strategy shape | Renault ran Alonso long on his heavy qualifying fuel, then two short stints; he was "still on a two-stopper" (WP). Lead order by lap (Jolpica-L): Fisichella 1-17, Button 18-19, Alonso 20-26, Fisichella 27-38, Alonso 39-43, Fisichella 44-56. | WP, AS, Jolpica-L | |
| Team orders | None in WP or AS. | WP, AS | |
| Retirements | Räikkönen lap 1 (accident); Rosberg after 6 laps (engine fire); Coulthard 10 laps (stuck in sixth gear; Jolpica: hydraulics); Webber 15 laps (WP: hydraulics; AS: sparks, "engine expiry"); Klien 26 laps (hydraulics; AS: probably the Räikkönen damage); Ide 33; Speed 41 (clutch); Heidfeld 48 laps (engine, from 5th, about eight laps from the end). | Jolpica-R, WP, AS | |
| Penalties in the race | Barrichello: stop-go for pit-lane speeding (WP: 10-second stop-and-go; AS: "10-second penalty"), which wasted his one-stop strategy. No front-runner penalties. | WP, AS | |
| Result | Fisichella 1:30:40.529; Alonso +4.585; Button +9.631; Montoya +39.351; Massa +43.254; M. Schumacher +43.854; Villeneuve +1:20.461; R. Schumacher +1:21.288. Fastest lap Alonso 1:34.803 (lap 45, WP). | Jolpica-R, AS, WP | |

### Proposal (draft, for the owner)

| Item | Draft | Owner checked |
|---|---|---|
| Storyline drivers | Alonso (Renault) and Button (Honda). Alternative pair: Massa vs M. Schumacher (one stop vs two, from the back). | |
| Dilemma (original wording) | Stuck with a heavy tank after a fuel mistake in qualifying, Alonso starts 7th: how long can Renault stretch the first stint, and how little fuel is enough at the last stop to come out ahead of Button? | |
| Suggested side | Alonso (pending `pipeline hard-calls`; Fisichella is the other Renault, pole and the simpler race). | |
| Target (draft) | beat-rival: Alonso finishes ahead of Button (real result P2, 5.046 s ahead). Alternative: position P2 or better. Not "win": nothing read says Alonso could have beaten Fisichella. | |
| Side really won? | Alonso did not win the race (2nd), but he did meet the drafted target (ahead of Button). No rewrite needed for beat-rival/position. | |
| Modelling risk | **Low to medium.** Dry, no SC/red flag reported, refuelling era. Points to watch: Alonso's start fuel must reflect the heavy Q3 load (amount not in sources); his 7th-to-3rd first lap; Button's two stints lost behind Montoya and backmarkers (traffic); Räikkönen's lap-1 crash and Heidfeld's late engine failure (storyline retirements; Heidfeld's hands 5th to Massa); Massa holding off M. Schumacher for the last ~10 laps. Stop laps come from lap-time inference, not a pit-stop feed. | |

### Not in sources

- Fuel loads (litres or laps) for any car, including Alonso's heavy Q3 load.
- An explicit statement that there was no safety car.
- Tyre choices (one Michelin/Bridgestone spec per weekend; compounds not reported).
- Gap between Alonso and Button before the final stops.
- GrandPrix.com and Motor Sport reports (not read; see above).

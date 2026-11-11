# Five Era 8 races swapped (owner pre-approved, Nov 9, overnight): owner sign-off

The owner approved (Nov 9) swapping failing Eras races for the next-best race by stats. Three
Era 8 races are replaced by a 2017-2018 race in the same slot, as in the earlier swaps
(`swap-races.md` and migration 0012, `swap-races-e10-e9.md` and 0013, `swap-races-e10-e9-b.md`
and 0014); this batch is D1 migration 0017. A second batch (phase 3) swaps the last two failing
Era 8 races, italy-2020 and sakhir-2020, for two Chinese Grands Prix in D1 migration 0023 (see
"Second batch" below). The replacements were picked by robust-G1 mean gap
error; each pick replaces one of the five failing Era 8 races, worst first. Every fact below
was read in the linked source on Nov 9, 2026; nothing comes from memory. Where sources
disagree, the row says which was taken. Check each row against its links and put your initials
and the date in **Owner checked**.

| Era / slot | Removed | Why | Replacement | Robust G1 of the replacement (Eras build, rules-only overlay) |
|---|---|---|---|---|
| 8 / #2 | `azerbaijan-2017` | Fails G1 (5.85 s, red flag and SC restarts) | `australia-2018` | pass, 1.06 s (new race) |
| 8 / #1 | `monaco-2017` | Fails G1 (2.98 s, Bottas in Monaco traffic) | `australia-2017` | pass, 2.11 s (new race) |
| 8 / #4 | `russia-2018` | Fails G1 (2.46 s, the cars around Mercedes' swap) | `spain-2017` | pass, 2.57 s (new race) |
| 8 / #8 | `italy-2020` | Fails G1 (2.17 s, duel GAS vs SAI after the red-flag restart) | `china-2017` | pass, 0.78 s (new race; second batch) |
| 8 / #10 | `sakhir-2020` | Fails G1 (2.43 s, duel RUS vs PER through the late SC queue) | `china-2018` | pass, 2.26 s (new race; second batch) |

The removed races' G1 numbers are from `docs/eras-races-report.md`. The replacements' numbers
were measured here on fresh TUM builds (`pipeline validate <id> --robust`, one race per call).
italy-2020 (2.17 s) and sakhir-2020 (2.43 s) also failed G1 but were the two least-bad of the
five, so they stayed in the first batch; the second batch replaces them. The removed races keep their rules-only overlays, race files, track files
and build entries as Eras-build fixtures.

The replacements are not authored yet (no `eras` block): target, storyline, mastery, hidden
objective and briefing come in B1, and the proposals below are drafts. `pipeline hard-calls`
was run once on each first build (into a scratch directory, not into `data/eras/`):

| Race | Hard calls | Side | Did the side really win? |
|---|---|---|---|
| `australia-2017` | VET 1, HAM 1; chance given up tied (11.0 pts each) | VET (the race file's side) | Yes: no rewrite |
| `australia-2018` | VET 2, HAM 0 | VET | Yes: no rewrite |
| `spain-2017` | VET 1, HAM 1; chance given up VET 37.3, HAM 8.3 | VET | No (2nd, +3.490 s): a rewrite is allowed |

`build.py` sets these sides (spain-2017 was first built as HAM and moved to VET after the
count). The spec's draft targets (§4) follow them; the proposals below were written before the
count and sometimes take the other side.

**Wording check needed:** spain-2017's Motor Sport, Autosport and Autosport strategy rows came
through a fetch tool that summarises pages; check their wording against the pages. Track maps
are in `2.5-track-maps.md` (Melbourne copies of `australia-2010`, `melbourne-1`; Barcelona a copy
of `spain-2020`, `catalunya-4`), and the SC/VSC causes in `2.6-drivers-incidents.md`.

## australia-2018 (2018 Australian Grand Prix)

Replaces `azerbaijan-2017` (Era 8 #2). Robust G1 1.06 s.

### Sources

| Short name | What |
|---|---|
| WP | [English Wikipedia, 2018 Australian Grand Prix](https://en.wikipedia.org/wiki/2018_Australian_Grand_Prix) (raw wikitext read) |
| MS | [Motor Sport, 2018 F1 Australian Grand Prix report](https://www.motorsportmagazine.com/reports/f1/2018-f1-australian-grand-prix-report/) |
| AS-race | [Autosport, "Vettel jumps Hamilton to win in Melbourne"](https://autosport.com/f1/news/135022/vettel-jumps-hamilton-to-win-in-melbourne) |
| AS-data | [Autosport, "Hamilton: I could've avoided defeat with right data"](https://www.autosport.com/f1/news/135031/hamilton-i-couldve-avoided-defeat-with-right-data) |
| AS-flaw | [Autosport, "How Hamilton's needless loss revealed a Mercedes flaw"](https://www.autosport.com/f1/news/how-hamiltons-needless-loss-revealed-a-mercedes-flaw-5110682/5110682/) |
| GPE | [GrandPrix.com, Australian GP 2018 Sunday team quotes](https://www.grandprix.com/races/australian-gp-2018-sunday-team-quotes.html) |
| Jolpica | [api.jolpi.ca/ergast/f1/2018/1/results.json](https://api.jolpi.ca/ergast/f1/2018/1/results.json), [pitstops.json](https://api.jolpi.ca/ergast/f1/2018/1/pitstops.json?limit=100) |
| OpenF1 | Not used: OpenF1 has no 2018 sessions. |

### Facts

| Topic | Fact | Sources | Owner checked |
|---|---|---|---|
| Grid | Hamilton pole (1:21.164), Räikkönen 2nd, Vettel 3rd, Verstappen 4th, Magnussen 5th, Grosjean 6th, Hülkenberg 7th, Ricciardo 8th, Sainz 9th, Alonso 10th. | WP, Jolpica | |
| Grid penalties | Ricciardo: three places for not slowing enough under a red flag in practice 2. Bottas: five places for a gearbox change after his Q3 crash at Turn 2; started 15th. | WP, Jolpica | |
| Laps | 58 laps (307.574 km). | WP, Jolpica | |
| Weather | Race: sunny (WP infobox); "warm but gusty" (MS). Saturday morning rain had made qualifying damp early. Dry race. | WP, MS | |
| VSC / SC / red flag | Magnussen stopped on lap 22 (AS-race) with a wheel not fitted properly after his stop. Grosjean stopped at Turn 2 on lap 24 with the same problem, which brought out the VSC (WP; AS-race: lap 24). AS-flaw says the VSC was deployed on lap 26 of 58; WP has Vettel pitting under it on lap 26. The VSC became a full safety car on lap 27 (WP); the SC came in at the end of lap 31 (WP, MS). No red flag. | WP, MS, AS-race, AS-flaw | |
| Tyres | Räikkönen and Vettel started on ultrasofts and changed to softs; Hamilton changed to softs (AS-flaw; MS: Räikkönen and Hamilton to softs on laps 18 and 19). Hamilton's start compound: not stated in the text read (MS implies ultrasoft). Ricciardo ran a longer first stint (MS). Verstappen, Alonso, Ricciardo compounds: not in sources. | AS-flaw, MS, WP | |
| Stops (front-runners) | One stop each, Jolpica laps: Räikkönen 18, Hamilton 19, Verstappen 21 (WP: lap 20; MS: two laps before the VSC), Bottas 25, Vettel 26, Ricciardo 26, Alonso 26. Vettel, Ricciardo and Alonso stopped under the VSC. None of the top ten pitted again after the SC (WP). | Jolpica, WP, MS | |
| Why Hamilton stopped | Mercedes pitted Hamilton a lap after Räikkönen to cover the undercut (WP, AS-flaw). Hamilton had led Räikkönen by 3.9 s before that stop (AS-flaw). Ferrari's plan was to draw that stop and keep Vettel out (AS-flaw). | AS-flaw, WP | |
| The gap at the VSC | Hamilton's lead of about 9 s over Vettel became a deficit of about 13-14 s after his stop; 13.079 s at the end of his out-lap, then he took about 0.42 s a lap (AS-flaw). Gap when the VSC came out: 11.614 s (AS-data, AS-flaw); MS says 11.4 s (taken: 11.614). Vettel rejoined about 0.6 s ahead (AS-flaw). | AS-flaw, AS-data, MS | |
| Mercedes' error | Mercedes' software said Hamilton was safe from a VSC stop; the margin it thought he needed is 13.6 s in MS and 15 s in AS-flaw (sources disagree). MS: the real requirement was about 10 s. Mercedes only found out when Vettel came out in front (AS-data). Hamilton and Wolff said he had pace in reserve to build a bigger gap in the first stint (AS-data). | MS, AS-flaw, AS-data | |
| After the SC | Hamilton followed Vettel for 26 laps without passing. He locked up into Turn 9 on lap 47 and lost 1.7 s (MS; AS-race: "about a dozen laps left", almost 3 s). He got back into DRS range with five laps left, then his rear tyres overheated (AS-race). Ricciardo chased Räikkönen to the flag and set the fastest lap; Alonso held off Verstappen (WP). | MS, AS-race, WP | |
| Contact / damage | No contact between the leaders. Verstappen damaged his floor/diffuser on a kerb at Turns 11-12 around lap 4-6 (MS: lap 6; GPE: "about lap four or five"), then spun at Turn 1 (WP: lap 9; MS: lap 10) and fell to 8th. | MS, GPE, WP, AS-flaw | |
| Retirements | Sirotkin lap 4 (brakes), Ericsson lap 5 (steering), Gasly lap 13 (engine), Magnussen lap 22 and Grosjean lap 24 (wheels; Haas fined €10,000 for unsafe release). Front-runners: Magnussen (P5 grid) and Grosjean (P6 grid) only. | Jolpica, WP, GPE | |
| Team orders | None found in any source. | WP, MS, AS-race | |
| Result | Vettel 1:29:33.283; Hamilton +5.036; Räikkönen +6.309; Ricciardo +7.069; Alonso +27.886; Verstappen +28.945. Hülkenberg, Bottas, Vandoorne, Sainz complete the top ten. | Jolpica, AS-race, WP | |

### Storyline proposal (draft, owner decides)

| Item | Proposal |
|---|---|
| Storyline drivers | Hamilton (Mercedes, leading on pole) and Vettel (Ferrari, running long in 3rd). |
| Dilemma (original wording) | Räikkönen dives in for softs from second: cover him at once, or stay out and keep Vettel's long stint under watch? |
| Side | Hamilton is the likely pick (the cover call on lap 19, and how hard to push for a VSC-proof gap), but `pipeline hard-calls` decides. |
| Target (draft) | `win`: Hamilton (equivalently `beat-rival` Vettel). |
| Did the side really win? | No: Hamilton 2nd, +5.036 s. A rewrite is allowed. If the side is Vettel, he really won: no rewrite. |

### Modelling risk: medium

- The deciding swing is about 1 s: Vettel came out about 0.6 s ahead after an 11.6 s gap. A small error in VSC pit loss flips the lead.
- The VSC (lap 24-26 start) and SC (laps 27-31) have to be scripted from the real race; the source lap of the VSC start is inconsistent (24 vs 26).
- Haas retirements are wheel faults (storyline retirements of non-player cars), simple to script.
- Albert Park: Hamilton could not pass in 26 laps; the sim's following/overtaking must hold the order, or the player's "win" becomes too easy.
- Missing numbers: Hamilton's and Red Bull/McLaren start compounds, lap-by-lap gaps other than those above.

## australia-2017 (2017 Australian Grand Prix)

Replaces `monaco-2017` (Era 8 #1). Robust G1 2.11 s.

### Sources

| Short name | What | URL |
|---|---|---|
| WP | English Wikipedia race article | https://en.wikipedia.org/wiki/2017_Australian_Grand_Prix |
| MS | Motor Sport race report | https://www.motorsportmagazine.com/articles/single-seaters/f1/2017-australian-grand-prix-report/ |
| AS | Autosport race report (with results table) | https://www.autosport.com/f1/news/f1-australian-grand-prix-vettel-jumps-hamilton-for-first-2017-win-5018623/5018623/ |
| Jolpica | Results and pit stops, `api.jolpi.ca/ergast/f1/2017/1/results.json`, `.../pitstops.json` | https://api.jolpi.ca/ergast/f1/2017/1/results.json |

OpenF1 has no 2017 sessions ("No results found"). The GrandPrix.com race-notes/report URLs tried
returned only the current news index; no GPE content used. F1DB not consulted.

### Facts

| Topic | Fact | Sources | Owner checked |
|---|---|---|---|
| Date / laps | Melbourne, 57 laps, 302.271 km (scheduled 58 laps; one lap cut after an aborted start) | WP, MS | |
| Aborted start | Start aborted (Pérez initially in the wrong slot, small brake fire on Kvyat's car, a marshal's alarm button), distance cut by one lap | MS | |
| Weather | Partly cloudy, 24 °C air, 31-36 °C track (WP infobox); MS: track about 38 °C, high temperatures overheated Mercedes' tyres. Dry | WP, MS | |
| Grid top 6 | Hamilton (Mercedes) 1:22.188, Vettel (Ferrari) 1:22.456, Bottas (Mercedes) 1:22.481, Räikkönen (Ferrari) 1:23.033, Verstappen (Red Bull) 1:23.485, Grosjean (Haas) 1:24.074. Massa 7th | WP, Jolpica | |
| Grid penalties | Ricciardo five places (gearbox), then stopped on the way to the grid and started from the pit lane, two laps down (MS, AS). Stroll five places (gearbox), grid 20 (Jolpica); WP's numbers for Stroll don't reconcile | WP, MS, AS, Jolpica | |
| SC / VSC / red flag | None mentioned in any source read | WP, MS, AS | |
| Tyres | Allocation: 7 ultrasoft, 4 supersoft, 2 soft sets per driver (WP). Hamilton, Vettel, Bottas started on ultrasofts (MS) | WP, MS | |
| Opening stint | Hamilton pushed from lap 8 and led by 1.8 s on lap 13; his ultrasofts then overheated and he had to ease off. Vettel within 1.3 s on lap 16 (MS). Vettel within a second before Hamilton's stop (AS). MS also says Vettel needed ~22 s on Hamilton and the gap "hovered at 21 s" (unreconciled in MS) | MS, AS | |
| Hamilton stop | End of lap 17, ultrasoft to soft, 3.3 s stationary (MS). Lap 17 (AS, Jolpica) | MS, AS, Jolpica | |
| Hamilton behind Verstappen | Rejoined behind Verstappen (not yet stopped); could not pass (short DRS zone, turbulence). Number of laps held up: not in sources (WP: "several laps") | MS, AS, WP | |
| Vettel stop | Lap 23 (AS, Jolpica), ultrasoft to soft, 0.3 s quicker than Hamilton's stop (MS). MS: Ferrari had planned lap 22. Rejoined ahead of Hamilton and Verstappen | AS, MS, Jolpica | |
| Other stops | Verstappen lap 25 (on super-softs for stint 2, AS); Bottas lap 25, to softs; Räikkönen lap 26, softs (MS, AS, Jolpica). Massa lap 20 (Jolpica). All six front-runners one stop | MS, AS, Jolpica | |
| Gaps | Vettel 6 s up on Hamilton when Verstappen pitted on lap 25 (MS); lead grew to almost 10 s (AS) | MS, AS | |
| Top 6 | 1 Vettel (Ferrari) 1:24:11.672; 2 Hamilton +9.975; 3 Bottas +11.250; 4 Räikkönen +22.393; 5 Verstappen +28.827; 6 Massa +1:23.386 (last car on the lead lap) | WP, AS, Jolpica | |
| Minor discrepancy | 8th/9th: Jolpica/WP Sainz 8th, Kvyat 9th; MS text (as read) gives Kvyat 8th. Taken: Jolpica | Jolpica, WP, MS | |
| Retirements | Grosjean 13 laps (water leak: WP, Jolpica; MS: suspected turbo), from P6. Palmer 15 (brakes). Ericsson 21 (Jolpica/WP hydraulics; AS: collision; MS: damage from turn 3 incident). Ricciardo 25 laps (Jolpica/AS power unit; WP fuel cell; MS fuel-flow metering fault; WP prose says lap 26). Stroll 40 (brakes; MS hydraulics). Magnussen 46 (Jolpica suspension; AS puncture). Alonso 50 (Jolpica vibrations; WP/AS floor; MS front suspension). Wehrlein withdrawn | WP, MS, AS, Jolpica | |
| Contact | Magnussen hit Ericsson on the opening lap (AS; MS: turn 3 incident) | AS, MS | |
| Penalties in race | None in sources | WP | |
| Team orders | None in sources | WP, MS, AS | |
| Strategy verdict | Hamilton said the race plan wasn't the optimum one and Mercedes lacked Ferrari's pace on ultrasofts in the heat (press comment, MS) | MS | |

### Proposal (draft)

- **Storyline drivers:** Grosjean (water leak from P6, 13 laps) and Ricciardo (pit-lane start
  two laps down, out after 25 laps).
- **Dilemma:** Hamilton's ultrasofts are fading and he must pit into Verstappen's traffic;
  Ferrari can stay out and overcut, or cover him.
- **Side:** Vettel (the overcut is Ferrari's call). Hamilton is the alternative (stop lap 17
  vs staying out); the hard-call counter picks the side.
- **Target (draft):** win: Vettel from P2, one stop, beat Hamilton.
- **Side really won?** Yes (Vettel), so no rewrite (history book). If Hamilton is the side, he
  lost, so a rewrite is allowed.
- **Risk: medium-high.** Clean dry race, no SC, stop laps agree across MS/AS/Jolpica. But the
  whole story rests on Hamilton being stuck behind Verstappen, and the dirty-air model is off,
  so the sim may not reproduce the jump; laps held up and the exact Hamilton-Vettel gap are not
  in sources; several retirement causes conflict.

## spain-2017 (2017 Spanish Grand Prix)

Replaces `russia-2018` (Era 8 #4). Robust G1 2.57 s.

### Sources

| Short name | What |
|---|---|
| WP | English Wikipedia race article (raw wikitext): https://en.wikipedia.org/wiki/2017_Spanish_Grand_Prix |
| MS | Motor Sport race report: https://www.motorsportmagazine.com/articles/single-seaters/f1/2017-spanish-grand-prix-report/ |
| AS | Autosport race report: https://www.autosport.com/f1/news/129511/hamilton-denies-vettel-in-spanish-gp-thriller |
| AS-S | Autosport strategy story (Wolff on the VSC call): https://www.autosport.com/f1/news/lewis-hamilton-spanish-gp-mercedes-strategy-call-was-magic-5016008/5016008/ |
| Jolpica-R | Jolpica results: https://api.jolpi.ca/ergast/f1/2017/5/results/ |
| Jolpica-P | Jolpica pit stops: https://api.jolpi.ca/ergast/f1/2017/5/pitstops/?limit=100 |
| Jolpica-Q | Jolpica qualifying: https://api.jolpi.ca/ergast/f1/2017/5/qualifying/ |

Not used: OpenF1 (no 2017 data), F1DB. GrandPrix.com has only results tables for this race; the
race-notes URL pattern returned the homepage. MS, AS and AS-S were read through a fetch tool that
summarises, so check wording against the pages. WP and Jolpica were read raw.

### Facts

| Topic | Fact | Sources | Owner checked |
|---|---|---|---|
| Grid top 6 | 1 Hamilton (1:19.149), 2 Vettel (+0.051 s), 3 Bottas, 4 Räikkönen, 5 Verstappen, 6 Ricciardo. Alonso 7th. | WP, MS, Jolpica-Q, Jolpica-R | |
| Grid penalties | Vandoorne: ten places for extra power-unit elements (grid 20). None in the top 6. | WP, Jolpica-R | |
| Race laps | 66 laps, 4.655 km, 307.104 km. | WP, Jolpica-R | |
| Weather | Sunny, dry. Temperatures: not in sources. | WP | |
| Start | Vettel passed Hamilton into Turn 1 and led. | WP, MS, AS | |
| Lap-1 contact | At Turn 1 Bottas touched Räikkönen, sending the Ferrari into Verstappen; both retired with suspension/steering damage (Jolpica: Räikkönen 0 laps, Verstappen 1 lap, "Collision damage"). Massa and Alonso also touched: Massa puncture, pitted end of lap 1; Alonso forced off. | WP, MS, AS, Jolpica-R, Jolpica-P | |
| Bottas damage | "Slightly handicapped" by the incident (WP). Not described further. | WP | |
| Early gaps | Vettel led Hamilton by 2.2 s after lap 1, 2.7 s on lap 3, 2.3 s on lap 11 (Bottas 8 s further back). | MS | |
| Stops: Vettel | Two stops: lap 14 to new softs (covering the undercut; minor front-left delay, AS), lap 37 to mediums, run to the flag. Start compound: not stated in sources. | Jolpica-P, WP, MS, AS | |
| Stops: Hamilton | Two stops: lap 21 to mediums (seven laps after Vettel, rejoined ~7 s behind), lap 36 to softs under the end of the VSC, run to the flag. Started on softs ("ran long on softs early", AS-S). | Jolpica-P, WP, MS, AS-S | |
| Stops: Bottas | One stop, lap 26 (Jolpica-P; "about lap 27", MS). Compounds: not in sources. Retired lap 38, engine (Jolpica: 38 laps, "Power Unit"). | Jolpica-P, Jolpica-R, MS, WP | |
| Stops: Ricciardo | Laps 21 and 38. Compounds: not in sources. | Jolpica-P | |
| Team tactics | Mercedes left Bottas out as a blocker; Vettel lost over 6 s to him over three laps (WP: about 4 s) and passed him on lap 25 on the outside of the pit straight with a wheel on the grass. | MS, WP | |
| VSC | Vandoorne hit Massa at Turn 1 and ended in the gravel (out after 32 laps, "Collision", Jolpica). Lap: 33 (AS-S) / 34 (MS); "just over thirty laps remaining" (WP). End lap: not in sources. No safety car, no red flag in any source read. Vandoorne got a grid penalty for the next race. | AS-S, MS, WP, Jolpica-R | |
| The VSC call | Vettel led by 7.7 s at the VSC (MS; "nearly eight", AS-S). Mercedes stopped Hamilton on lap 36 as the VSC was ending so Ferrari could not react; Wolff put the VSC pit loss at about 12-13 s vs about 21 s under green. Vettel stopped under green one lap later. | AS-S, MS, Jolpica-P, WP | |
| Pit-exit fight | Vettel came out of the pits alongside Hamilton and squeezed him; Hamilton went off/into the run-off and stayed behind. Contact: WP and AS say they touched wheels; MS says no contact, Hamilton crossed the white lines to avoid one. | WP, AS, MS | |
| Pass for the lead | Lap 44, pit straight into Turn 1, around the outside with DRS, on softs vs mediums. | WP, MS, AS | |
| Result top 6 | 1 Hamilton 1:35:56.497; 2 Vettel +3.490; 3 Ricciardo +1:15.820; 4 Pérez +1 lap; 5 Ocon +1 lap; 6 Hülkenberg +1 lap. | Jolpica-R, WP | |
| Penalties | Wehrlein: 5 s for passing the wrong side of the pit-entry bollard; 7th on the road, classified 8th. | WP, AS | |
| Other | Magnussen, 9th, punctured after contact with Kvyat and fell to 14th. Fastest lap Hamilton 1:23.593, lap 64. Points gap after the race: Vettel leads by 6. | WP, AS | |

### Proposal (draft, for the owner)

- **Storyline drivers:** Vettel (Ferrari) and Hamilton (Mercedes).
- **Dilemma (original):** Under a late virtual safety car with a 7.7 s lead, do you box now on
  the slower medium you still owe, or stay out and risk the Mercedes stopping cheaply behind you?
- **Side:** set by `pipeline hard-calls`. Both cars face the VSC call; Hamilton also has the
  stay-out-long call after Vettel's lap-14 stop.
- **Draft target:** if Vettel: `win` (beat Hamilton). If Hamilton: `win` from pole after losing
  the lead at the start.
- **Really won?** Hamilton yes (no rewrite if he is the side). Vettel no (rewrite allowed).
- **Risk: low-medium.** Dry, one VSC, no SC/red flag, sim already passes. Risks: VSC lap (33 vs 34)
  and end lap not sourced; start compounds of Vettel and Bottas and Ricciardo's compounds not in
  sources; two lap-1 retirements of front-runners (storyline events); pit-exit contact disputed
  (MS vs WP/AS); Bottas as a scripted blocker on a one-stop.

### Authored (B1, Nov 9)

Built as an Eras build with `user_side` VET / `rival` HAM (`build.py`); takeover lap 11 (D3
rule). Robust G1: pass, 2.57 s. Reachability: era (threshold 75, Standard+ rival) and Legend
(threshold 90, Expert rival) reachable, stay-out never ★3.

| Item | As authored | Basis | Owner checked |
|---|---|---|---|
| Side | **Vettel.** `pipeline hard-calls`: VET 1, HAM 1, tie broken by chance given up (VET 37.3 pts, HAM 8.3). | hard-call counter | |
| Target | `win` (beat Hamilton and everyone else). | draft target above | |
| Rewrite | Yes, `win`: Vettel really finished 2nd, +3.490 s (Jolpica-R). Headline (original): "Vettel holds off Mercedes to win in Barcelona". | Jolpica-R | |
| Storyline text | Hamilton wins by 3.5 s; Vettel leads from the start and stops on lap 14; Mercedes leaves Bottas out to hold him up, then stops Hamilton as the VSC ends; Vettel stops a lap later under green, comes out alongside Hamilton and is passed for the lead on lap 44. The VSC lap is left out of the text (33 or 34 in the sources). | Result, Start, Stops: Vettel, Team tactics, The VSC call, Pit-exit fight, Pass for the lead rows | |
| Briefing | Hamilton's pole by 0.051 s; Vettel passed him into Turn 1 and leads by just over two seconds after ten laps (MS: 2.3 s on lap 11; the model has 2.39 s at the takeover); Bottas third, about eight seconds further back (MS). Vettel's start compound is not in the sources, so the briefing does not name it. | Grid, Start, Early gaps rows | |
| Mastery | `stop_count` exact 2, "Win on two stops, as Vettel made". | Stops: Vettel row; reachability | |
| Hidden | `margin` 3.5 s, "Win by more than 3.5 seconds, Hamilton's real margin" (3.490 s). | Result row | |
| storylineEvents | `[34, "VSC"]` (Vandoorne/Massa; lap 34 from the built model's TUM track status and MS; kept in Legend too, so the VSC call is always there). The lap-1 retirements of Räikkönen and Verstappen happen before the takeover and are in the model's start state. | VSC row | |
| Moments | From the author tool unchanged (`author spain-2017 --target win --eras --write`): stop-14 (real box softs), pace-27, pace-31, vsc-34 (real stay; box next lap on mediums grades best), stop-37 (real box mediums). The model's stop laps are one later than Jolpica's (VET 15 and 38). | author output | |
| Reachability paths | Era and Legend (seed 2): softs at 14, standard pace at 27 and 31, box next lap on mediums under the VSC, stay at 37: ★1 ★2 ★3, hidden. Stay-out: no ★3 on any seed (best ★2 at era difficulty, seed 3). | reachability | |

## Second batch (phase 3): italy-2020 and sakhir-2020

The last two failing Era 8 races are replaced in their own slots (D1 migration 0023). The picks
were chosen by robust-G1 mean gap error among the 2017-2020 races not already in Eras; the
numbers below were measured on fresh TUM builds with the sides the hard-call count gave
(`pipeline validate <id> --robust`, one race per call, Eras build, rules-only overlay):

| Era / slot | Removed (robust G1) | Replacement | Robust G1 of the replacement |
|---|---|---|---|
| 8 / #8 | `italy-2020` (fail, 2.17 s) | `china-2017` | pass, mean gap error 0.78 s |
| 8 / #10 | `sakhir-2020` (fail, 2.43 s) | `china-2018` | pass, mean gap error 2.26 s |

italy-2020 and sakhir-2020 keep their rules-only overlays, race files, track files and build
entries as Eras-build fixtures. The e2e red-flag playthrough moves from italy-2020 to the
authored azerbaijan-2021, and the worker's "no Eras target yet" test uses a stand-in file under
china-2018's id.

`pipeline hard-calls` was run on each first build (into a scratch directory, not into
`data/eras/`), and again on the rebuild with the new side (same counts):

| Race | First build's side | Hard calls | Side | Did the side really win? |
|---|---|---|---|---|
| `china-2017` | VET | HAM 1, VET 0; chance given up HAM 15.0, VET 12.7 pts | HAM | Yes (Hamilton won by 6.250 s): no rewrite |
| `china-2018` | RIC | BOT 3, RIC 2; chance given up BOT 85.0, RIC 2.0 pts | BOT | No (2nd, +8.894 s): a rewrite is allowed |

`build.py` sets these sides (rival VET and RIC). Both proposals below were written before the
count and take the other side or leave it open; the spec's draft targets (§4) follow the count:
china-2017 `defend` (Hamilton leads at the takeover, lap 31, in the built model) and china-2018
`win` (Bottas second at the takeover, lap 14, in the built model). Track maps are copies of
`china-2024` (`shanghai-1`, F1DB v2026.19.0 CSV: 2017 round 2 and 2018 round 3 on the same
layout) in `2.5-track-maps.md`; the SC/VSC rows are in `2.6-drivers-incidents.md`.

## china-2017 (2017 Chinese Grand Prix)

Replaces `italy-2020` (Era 8 #8). Robust G1 0.78 s.

### Sources

| Short name | What |
|---|---|
| WP | [English Wikipedia, 2017 Chinese Grand Prix](https://en.wikipedia.org/wiki/2017_Chinese_Grand_Prix) |
| MS | [Motor Sport, 2017 Chinese Grand Prix report](https://www.motorsportmagazine.com/articles/single-seaters/f1/2017-chinese-grand-prix-report/) |
| AS | [Autosport, Vettel on the safety car timing](https://www.autosport.com/f1/news/sebastian-vettel-timing-of-f1-safety-car-unfortunate-in-chinese-gp-5017032/5017032/) |
| GPE | [GrandPrix.com, race notes](https://www.grandprix.com/races/chinese-gp-2017-race-notes-hamilton-wins-chinese-grand-prix.html) |
| Jolpica-R | [api.jolpi.ca/ergast/f1/2017/2/results.json](https://api.jolpi.ca/ergast/f1/2017/2/results.json) |
| Jolpica-P | [api.jolpi.ca/ergast/f1/2017/2/pitstops.json](https://api.jolpi.ca/ergast/f1/2017/2/pitstops.json?limit=100) |
| OpenF1 | Not used: no 2017 sessions (`/v1/sessions?year=2017` returns "No results found"). |

### Facts

| Topic | Fact | Sources | Owner checked |
|---|---|---|---|
| Date / laps | 9 April 2017, Shanghai International Circuit, 56 laps (305.066 km). | WP, Jolpica-R | |
| Grid top 6 | Hamilton (Mercedes) pole, Vettel (Ferrari) 2nd, Bottas (Mercedes) 3rd, Räikkönen (Ferrari) 4th, Ricciardo (Red Bull) 5th, Massa (Williams) 6th. Verstappen started 16th. | WP, Jolpica-R | |
| Grid penalties | Grosjean and Palmer five places each for ignoring yellow flags in qualifying; Giovinazzi five places for a gearbox change (15th to 18th). Palmer started from the pit lane after pitting on the formation lap for slicks. None affects the top 6. | WP | |
| Weather | Light rain at the start, drying later (WP infobox); damp track at the start, the main straight stayed wetter. Nearly all started on intermediates; Sainz the only starter on super-soft slicks. | WP | |
| VSC | Stroll spun into the gravel after contact with Pérez (Stroll out, 0 laps). WP and AS place the VSC in the first lap; GPE says it ended at the end of lap 3; GPE gives no start lap. | WP, AS, GPE, Jolpica-R | |
| Vettel's VSC stop | Inters to slicks at the end of lap 2 (MS; Jolpica-P lap 2). Compound: not in sources. Hülkenberg had pitted just before (MS; Jolpica-P lap 1). | MS, WP, AS, Jolpica-P | |
| Mercedes stayed out | Mercedes judged the slick window not yet open on lap 3 and not worth giving up the lead for. | MS | |
| Safety car | Giovinazzi crashed on the start-finish straight on a wet patch (lap 4 per MS; GPE lists it under lap 3; Jolpica-R: 3 laps completed). SC withdrawn at the end of lap 7 (GPE). Under the SC every car ran through the pit lane whether stopping or not (MS). | MS, GPE, WP, Jolpica-R | |
| Stops under the SC | Hamilton, Bottas, Ricciardo, Räikkönen and Verstappen pitted (GPE; Jolpica-P lap 4 for all five). Hamilton went onto softs (MS); other compounds not in sources. Vettel rejoined 6th, behind Verstappen, so the others got their stops for free (MS). Jolpica-P also lists ~17 s entries on laps 4-6 for most cars: these match the pit-lane passes behind the SC, not stops. | GPE, MS, Jolpica-P | |
| Bottas | Spun behind the SC while warming his tyres and fell to 12th. | WP, GPE | |
| Overtakes | Verstappen from 16th made up many places on lap 1 and passed Ricciardo for 2nd on lap 11 (WP). Vettel was stuck behind Räikkönen until lap 20 (MS, WP; GPE: about lap 19), passed Ricciardo on lap 22 (WP), with contact between them (MS), and passed Verstappen when he locked up (lap 29 WP; lap 27 MS). | WP, MS, GPE | |
| Second stops | Sources differ by about a lap. Verstappen fresh super-softs the lap after his lock-up (lap 30 WP; Jolpica-P 29); Ricciardo super-softs lap 33 (MS, Jolpica-P; GPE 34); Vettel new softs (lap 35 GPE; Jolpica-P 34; MS "two laps before Hamilton"), rejoined 3rd; Bottas softs (lap 35 GPE; Jolpica-P 35); Hamilton softs (lap 36 MS, GPE, Jolpica-P; WP 37), kept the lead; Räikkönen super-softs lap 39 (MS, GPE, Jolpica-P), from 2nd to 6th. Red Bull's super-soft choice committed them to two stops (MS). Ferrari tried to keep Räikkönen on one stop (MS). | WP, MS, GPE, Jolpica-P | |
| Late race | Vettel was told he needed about 0.7 s a lap (MS); afterwards he said a bit over half a second (AS). Hamilton set the fastest lap, 1:35.378 on lap 44 (WP), with the gap at 7.7 s (MS). | MS, AS, WP | |
| Result top 6 | Hamilton 1:37:36.158; Vettel +6.250; Verstappen +45.192; Ricciardo +46.035; Räikkönen +48.076; Bottas +48.808. | Jolpica-R, WP | |
| Retirements | Stroll collision (0 laps), Giovinazzi accident (3), Vandoorne fuel pressure (17), Kvyat hydraulics (18), Alonso driveshaft (33). | Jolpica-R, WP | |
| Penalties | Hülkenberg 5 s for passing under the VSC and 10 s for passing Ericsson under the SC (WP); GPE mentions only a 5 s penalty for passing Ericsson under the SC. Vettel was investigated for starting out of position; no action (WP). | WP, GPE | |
| Team orders | None reported. Räikkönen held Vettel up until about lap 20. | WP, MS | |
| Vettel's view | He called the SC timing unlucky because it wiped out the gain from his early stop, and said Hamilton did the best job (paraphrased). | AS | |

### Storyline proposal (draft, owner decides)

| Item | Proposal |
|---|---|
| Storyline drivers | Hamilton (Mercedes, pole) and Vettel (Ferrari, P2 start). |
| Side | **Hamilton** by the hard-call count (HAM 1, VET 0). The sourcing sheet had proposed Vettel (the VSC slick call), but that call is before the takeover (lap 31). |
| Dilemma (original wording) | Vettel stops first for fresh softs: cover him at once, or stay out and defend the lead on older tyres? |
| Target (draft) | `defend`: Hamilton holds P1 ahead of Vettel (he leads at the takeover in the built model). |
| Did the side really win? | Yes: no rewrite (history book). |
| Risk | Medium. The wet-to-dry opening (inters, VSC, SC through the pit lane) is all before the takeover, so the played part is dry. Stop laps differ by about a lap between sources; most early slick compounds are not in sources. The built model has Alonso's retirement on lap 35 as an event. |

## china-2018 (2018 Chinese Grand Prix)

Replaces `sakhir-2020` (Era 8 #10). Robust G1 2.26 s.

### Sources

| Short name | What |
|---|---|
| WP | [English Wikipedia, 2018 Chinese Grand Prix](https://en.wikipedia.org/wiki/2018_Chinese_Grand_Prix) (raw wikitext read) |
| MS | [Motor Sport, 2018 Chinese Grand Prix report (Mark Hughes)](https://www.motorsportmagazine.com/articles/single-seaters/f1/2018-chinese-grand-prix-report/) |
| AS-race | [Autosport, "Chinese Grand Prix: Ricciardo wins, Verstappen and Vettel collide"](https://autosport.com/f1/news/135405/ricciardo-wins-vettel-and-verstappen-collide) |
| AS-merc | [Autosport, "Mercedes F1 team explains Chinese Grand Prix strategy miscue"](https://autosport.com/f1/news/135484/mercedes-explains-china-strategy-miscue-further) |
| GPE | [GrandPrix.com, "Race Analysis - Sister Act"](https://www.grandprix.com/races/chinese-gp-2018-race-analysis.html) |
| Jolpica | [api.jolpi.ca/ergast/f1/2018/3/results.json](https://api.jolpi.ca/ergast/f1/2018/3/results.json), [pitstops.json](https://api.jolpi.ca/ergast/f1/2018/3/pitstops.json?limit=100), [qualifying.json](https://api.jolpi.ca/ergast/f1/2018/3/qualifying.json) |
| OpenF1 | Not used: OpenF1 has no 2018 sessions. |

### Facts

| Topic | Fact | Sources | Owner checked |
|---|---|---|---|
| Grid | Vettel pole (1:31.095, track record), Räikkönen 2nd, Bottas 3rd, Hamilton 4th, Verstappen 5th, Ricciardo 6th, Hülkenberg 7th, Pérez 8th, Sainz 9th, Grosjean 10th. | WP, Jolpica, MS | |
| Grid penalties | None in the top six. Ericsson: five places for ignoring double yellows (started 20th). Ricciardo's turbo failed in FP3; the new power unit was fitted in time for Q1 (MS: "45sec to spare"; GPE: "about a minute"). | WP, MS, GPE, Jolpica | |
| Laps | 56 laps (305.066 km). | WP, Jolpica | |
| Weather | Sunny (WP infobox). Race-day track temperature "around 20deg C higher" than practice (MS; exact figure not given). Dry race. | WP, MS | |
| Start tyres | Ferrari and Mercedes on softs (used in Q2); Red Bulls on ultrasofts. | MS, GPE, AS-race | |
| Lap 1 | Vettel kept the lead; Bottas 2nd, Verstappen passed Räikkönen for 3rd, Hamilton 5th, Ricciardo 6th. | WP, MS, GPE | |
| First stops | Jolpica laps: Verstappen 17, Ricciardo 17 (double stop, both to mediums), Hamilton 18 (mediums), Bottas 19 (mediums, 1.8 s stationary per MS), Vettel 20 (mediums), Räikkönen 27 (mediums). Vettel led Bottas by 3.4 s at the end of lap 18 (MS); Bottas undercut him. Ferrari kept Räikkönen out to hold Bottas up; Bottas passed him at Turn 1 at the start of lap 27 (GPE: lap 27; MS: end of lap 26). | Jolpica, MS, GPE, AS-race | |
| Safety car | Hartley and Gasly (Toro Rosso) collided at the hairpin on lap 30 (WP, GPE). SC deployed on lap 31 (GPE, MS), just after Bottas and Vettel had passed the pit entry (MS). SC in on lap 35 (MS: "stayed out until the 35th lap"), 21 laps to go. No VSC, no red flag found in any source. | WP, GPE, MS | |
| SC stops | Verstappen and Ricciardo both pitted on lap 31 (Jolpica) for new softs (double stop). Bottas, Vettel, Hamilton and Räikkönen stayed out on mediums. Restart order (MS): Bottas (16-lap-old mediums), Vettel (15), Hamilton (17), Verstappen (new softs), Räikkönen (8), Ricciardo (new softs). | Jolpica, MS, AS-race, GPE | |
| Why Hamilton stayed out | Mercedes judged track position worth more than fresher tyres: few passes had been made despite compound differences, the medium could do 40 laps, and a stop risked losing places to Ricciardo and Räikkönen (AS-merc, Vowles; MS). Mercedes did not expect the soft to be that fast (AS-merc). | AS-merc, MS, GPE | |
| Recovery | Ricciardo passed Räikkönen; Verstappen went off at Turn 7 trying to pass Hamilton on lap 39 and Ricciardo got by (WP, MS). Ricciardo passed Hamilton at the hairpin on lap 40 (GPE, MS), Vettel for 2nd on lap 42 (GPE), Bottas for the lead on lap 45 (WP; AS-race: "with 12 laps to go they were nose-to-tail"). Pass location for the lead: Turn 6 (MS, AS-race top) vs Turn 4 (AS-race body). | WP, GPE, MS, AS-race | |
| Contact | Lap 43: Verstappen hit Vettel at the hairpin, both spun; Vettel's floor was damaged, he fell to 8th (passed by Hülkenberg, then Alonso on the penultimate lap). | WP, MS, AS-race | |
| Penalties | Verstappen +10 s (Vettel collision): 4th on the road, 5th classified. Gasly +10 s (Hartley collision). | WP, MS, AS-race, Jolpica | |
| Retirements | Hartley only (51 laps, "Collision damage"). No front-runner retired. | Jolpica | |
| Team orders | Toro Rosso told Hartley to let Gasly through (MS; the cause of the collision). Haas swapped Grosjean and Magnussen (MS). Ferrari used Räikkönen's long stint to hold Bottas up (MS, AS-race); no explicit order quoted. | MS, AS-race | |
| Result | Ricciardo 1:35:36.380; Bottas +8.894; Räikkönen +9.637; Hamilton +16.985; Verstappen +20.436; Hülkenberg +21.052. Then Alonso, Vettel, Sainz, Magnussen. | Jolpica | |
| Lap-by-lap gaps | Only those above (3.4 s at lap 18; Verstappen ~7 s behind Vettel after the stops, MS; Ricciardo 2.8 s off the lead after passing Hamilton, AS-race). Others: not in sources. | MS, AS-race | |

### Storyline proposal (draft, owner decides)

| Item | Proposal |
|---|---|
| Storyline drivers | Bottas (Mercedes, P3 grid, in the lead after undercutting Vettel) and Ricciardo (Red Bull, P6 grid, two stops). |
| Side | **Bottas** by the hard-call count (BOT 3, RIC 2). The sourcing sheet had proposed Hamilton or Ricciardo. |
| Dilemma (original wording) | A safety car with 25 laps left: give up the lead for fresh softs, or stay out on old mediums and hold off the Red Bulls? |
| Target (draft) | `win`: Bottas from P2 (second at the takeover in the built model), ahead of Ricciardo. |
| Did the side really win? | No: Bottas 2nd, +8.894 s. A rewrite is allowed. |
| Risk | Medium-high. The race turns on the soft-vs-old-medium pace gap after the SC (laps 31-35 in the built model); the overtaking model must hold passes before the SC and allow them after. Bottas had passed the pit entry when the SC came out (MS), so a stop under it would really have come a lap later. Vettel's lap-43 damage and Verstappen's 10 s penalty are not scripted in the build. |

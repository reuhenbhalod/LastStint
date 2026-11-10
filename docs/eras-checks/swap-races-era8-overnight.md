# Three Era 8 races swapped (owner pre-approved, Nov 9, overnight): owner sign-off

The owner approved (Nov 9) swapping failing Eras races for the next-best race by stats. Three
Era 8 races are replaced by a 2017-2018 race in the same slot, as in the earlier swaps
(`swap-races.md` and migration 0012, `swap-races-e10-e9.md` and 0013, `swap-races-e10-e9-b.md`
and 0014); this batch is D1 migration 0017. The replacements were picked by robust-G1 mean gap
error; each pick replaces one of the five failing Era 8 races, worst first. Every fact below
was read in the linked source on Nov 9, 2026; nothing comes from memory. Where sources
disagree, the row says which was taken. Check each row against its links and put your initials
and the date in **Owner checked**.

| Era / slot | Removed | Why | Replacement | Robust G1 of the replacement (Eras build, rules-only overlay) |
|---|---|---|---|---|
| 8 / #2 | `azerbaijan-2017` | Fails G1 (5.85 s, red flag and SC restarts) | `australia-2018` | pass, 1.06 s (new race) |
| 8 / #1 | `monaco-2017` | Fails G1 (2.98 s, Bottas in Monaco traffic) | `australia-2017` | pass, 2.11 s (new race) |
| 8 / #4 | `russia-2018` | Fails G1 (2.46 s, the cars around Mercedes' swap) | `spain-2017` | pass, 2.57 s (new race) |

The removed races' G1 numbers are from `docs/eras-races-report.md`. The replacements' numbers
were measured here on fresh TUM builds (`pipeline validate <id> --robust`, one race per call).
italy-2020 (2.17 s) and sakhir-2020 (2.43 s) also fail G1 but are the two least-bad of the five,
so they stay in place. The removed races keep their rules-only overlays, race files, track files
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

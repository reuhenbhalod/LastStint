# Six Era 7 races swapped (owner's Nov 9 pre-approval, picked by robust G1): owner sign-off

The owner pre-approved (Nov 9) swapping failing Eras races for the next best race by the
numbers. Era 7 had eight races failing robust G1; the six worst (by status, then mean gap error
in `docs/eras-races-report.md`) are replaced, worst first, by the six Era 7 candidates that pass,
best first. Each replacement takes the old race's era and slot, as in the earlier swaps
(`swap-races.md` / migration 0012, `swap-races-e10-e9.md` / 0013, `swap-races-e10-e9-b.md` /
0014); here the D1 migration is 0018. Every fact below was read in the linked source on Nov 9,
2026; nothing comes from memory. Where sources disagree, the row says which was taken. Check each
row against its links and put your initials and the date in **Owner checked**.

| Era / slot | Removed | Its robust G1 (races report) | Replacement | Robust G1 of the replacement (Eras build, rules-only overlay) |
|---|---|---|---|---|
| 7 / #8 | `monaco-2016` | fail, 13.71 s (a wet race with no rain data, the SC) | `bahrain-2015` | pass, 0.71 s |
| 7 / #5 | `hungary-2015` | fail, 6.80 s (race mechanics: ALO 20 s, VET vs KVY) | `abu-dhabi-2015` | pass, 0.76 s |
| 7 / #4 | `monaco-2015` | fail, 4.60 s (the SC and Monaco traffic) | `singapore-2014` | pass, 0.85 s |
| 7 / #2 | `canada-2014` | fail, 2.99 s (duel ROS vs RIC, Ricciardo's late passes) | `brazil-2014` | pass, 1.41 s |
| 7 / #3 | `hungary-2014` | fail, 2.72 s (tyre wear on long last stints) | `canada-2016` | pass, 1.97 s |
| 7 / #9 | `great-britain-2016` | fail, 1.95 s (podium order rate) | `malaysia-2015` | pass, 2.02 s |

`united-states-2015` (fail, 1.88 s) and `bahrain-2014` (fail, 1.22 s) also fail but stay in
place: only six candidates passed. The other seven Era 7 candidates measured failed (russia-2014
1.55 s, austria-2014 1.63 s, japan-2016 2.60 s, spain-2014 3.05 s, singapore-2016 3.55 s,
germany-2014 3.64 s, belgium-2015 9.15 s). The replacements' numbers were measured on TUM
ingests (`pipeline validate <id> --robust`, one race per call) with rules-only overlays; the race
files rebuilt here are byte-identical to the measured ones (bahrain-2015 differs only in its
`name`, now spelled "Räikkönen").

The replacements are not authored yet (no `eras` block): side (`pipeline hard-calls`), target,
storyline, mastery, hidden objective and briefing come in B1. The proposals below are drafts.
The `user_side` / `rival` pairs in `build.py` are provisional; `pipeline hard-calls` settles
each one. Targets in spec §4 (drafts) follow the proposals, except:

- **singapore-2014** is entered as `defend: Hamilton wins from pole` (the sheet proposed `win`),
  because Hamilton started on pole and led, which is what `defend` means in spec §4.
- **malaysia-2015**'s dilemma is reworded for the catalog and spec: the lap-4 safety car comes
  before the takeover (lap 14 in the built model), so the player can't make that call. The
  catalog line now starts after it: Vettel stayed out and leads, and two stops must last while
  Mercedes, on hards, stops three times (MS, GPE, AS rows below).

**Wording check needed:** malaysia-2015's Wikipedia, GrandPrix.com, Autosport and Motor Sport
rows came through a fetch tool that summarises pages; check their wording against the pages.

## bahrain-2015 (2015 Bahrain Grand Prix)

Replaces `monaco-2016` in Era 7 #8.

Every fact below was read in the linked source (fetched 2026-11-09); nothing comes from memory.
Where sources disagree, the row says so. Check each row against its links and put your initials
and the date in **Owner checked**. GrandPrix.com was rate-limited ("Public traffic is temporarily
busy") on every try and is not used. OpenF1 has no 2015 data.

### Sources

| Short name | What |
|---|---|
| WP | [English Wikipedia race article](https://en.wikipedia.org/wiki/2015_Bahrain_Grand_Prix) (read as wikitext via `action=raw`) |
| MS | [Motor Sport race report](https://www.motorsportmagazine.com/articles/single-seaters/f1/2015-bahrain-gp-report/) |
| AS | [Autosport race report](https://www.autosport.com/f1/news/f1-bahrain-gp-lewis-hamilton-wins-ahead-of-kimi-raikkonen-5008192/5008192/) |
| AS-B | [Autosport: brake problems nearly cost Mercedes](https://www.autosport.com/f1/news/118601/brake-problems-nearly-cost-mercedes) |
| Jolpica-R | [Jolpica results](https://api.jolpi.ca/ergast/f1/2015/4/results.json) |
| Jolpica-Q | [Jolpica qualifying](https://api.jolpi.ca/ergast/f1/2015/4/qualifying.json) |
| Jolpica-P | [Jolpica pit stops](https://api.jolpi.ca/ergast/f1/2015/4/pitstops.json?limit=100) |
| Jolpica-L | Jolpica laps per driver (`api.jolpi.ca/ergast/f1/2015/4/drivers/<id>/laps.json?limit=100`, HAM/RAI/ROS/VET/BOT); positions per lap and gaps summed from lap times |

### Facts

| Topic | Fact | Sources | Owner checked |
|---|---|---|---|
| Grid | Hamilton pole (1:32.571), Vettel 2nd (1:32.982), Rosberg 3rd, Räikkönen 4th, Bottas 5th, Massa 6th, Ricciardo 7th, Hülkenberg 8th. | Jolpica-Q, Jolpica-R, WP | |
| Grid changes / penalties | Massa's Williams did not get away for the formation lap (a sensor shut the engine down, MS) and he started from the pit lane (Jolpica still lists grid 6). Button (McLaren) did not start: ERS problem. Maldonado lined up in the wrong slot (18th): 5 s penalty, served at his first stop (MS). Sainz: 5 s penalty for taking too long on the reconnaissance lap (MS). No front-runner penalties. | WP, MS, Jolpica-R | |
| Laps | 57 laps, 308.238 km, 5.412 km lap. | WP, Jolpica-R | |
| Weather | Night race, dry. Sunny, clear; air 24-26 °C, track 28-31 °C, wind 1.5 m/s from the north (WP infobox, citing motorsport-total.com). | WP | |
| Tyres | Medium (prime) and soft (option). | WP | |
| SC / VSC / red flag | None mentioned for the race in any source read (red flags only in practice). | WP, MS, AS | |
| Start / early laps | Hamilton led away. Vettel held 2nd and backed Rosberg up; Räikkönen went round the outside of Rosberg for 3rd. Rosberg retook 3rd from Räikkönen on lap 4 (DRS, into Turn 1, MS) and passed Vettel for 2nd at the end of lap 9 (WP; Jolpica-L: ROS P2 from lap 9). | WP, MS, AS, Jolpica-L | |
| Stops: Hamilton | Soft-soft-medium (MS). In-laps 15 and 33 (Jolpica-P); WP says laps 16 and 34. A front-wheel delay at the first stop cost about half a second (MS). | Jolpica-P, WP, MS | |
| Stops: Rosberg | Soft-soft-medium (MS). In-laps 14 and 34 (Jolpica-P); WP says lap 15 for the first. Brought in before Hamilton at the first stops to cover Vettel; Hamilton stopped first at the second stops, which left Rosberg behind Vettel (MS). | Jolpica-P, WP, MS | |
| Stops: Vettel | Soft-soft-medium (MS). In-laps 13 and 32 (Jolpica-P, MS: "lap 13", "lap 32"); WP says lap 14 and lap 34. First front-runner to stop. Unscheduled third stop for a new nose: in-lap 36 (Jolpica-P, 33.9 s pit time), "next lap" after the lap-36 error (WP); about 10 s stationary, 23 s lost overall (MS). | Jolpica-P, MS, WP | |
| Stops: Räikkönen | Soft-medium-soft: in-lap 17 for mediums (WP says 18), in-lap 40 for softs (WP: lap 40). Last of the top four to stop each time. Ferrari judged the soft faster for the short final stint; Räikkönen questioned it because he was quick on the mediums, then accepted it was right (MS). Ferrari split the strategies so he would not be stuck behind Vettel (MS). | Jolpica-P, WP, MS | |
| Stops: Bottas, Ricciardo | Bottas in-laps 14 and 33; Ricciardo 14 and 35. Compounds: not in sources. | Jolpica-P | |
| Undercuts | Vettel's early stops jumped Rosberg both times (WP, AS). After the first round, Rosberg passed Vettel into Turn 1 with DRS as Hamilton rejoined (WP, AS). | WP, AS | |
| Räikkönen leads | Räikkönen led laps 16-17 and 34-39 while the others had stopped (Jolpica-L positions); Hamilton passed him shortly before his second stop (MS; Jolpica-L: HAM P1 on lap 40). | Jolpica-L, MS | |
| Vettel's errors | Locked up and ran wide at the Turn 8 hairpin; slid into the Turn 11 run-off on lap 26 (MS). Ran wide at the final corner on lap 36 while defending from Rosberg, letting him through and breaking the front-wing/nose (WP, MS; Jolpica-L: ROS ahead from lap 36). Then could not pass Bottas for 4th. | MS, WP, AS, Jolpica-L | |
| Räikkönen's charge | Fourteen laps from the end he was 15 s behind Rosberg and closing by more than a second a lap (WP). First flying lap after his stop: 1:36.3, against high-1:38/1:39 laps by the Mercedes (MS). Jolpica-L gap to Rosberg: 18.6 s end of lap 41, 1.2 s end of lap 54. | WP, MS, Jolpica-L | |
| Mercedes brakes | Mercedes chose brake-duct cooling for peak pace, so both drivers managed brake temperatures all race (MS). Rosberg's brake-by-wire failed into Turn 1 two laps from the end; he ran wide and Räikkönen passed him (MS, AS-B; WP: lap 56; Jolpica-L: RAI P2 from lap 56). Hamilton got a brake-by-wire failure on the run into the last lap and did the final lap without it (AS-B, MS). Wolff: the system falls back to conventional brakes at very high temperatures (AS-B). | MS, AS-B, WP, Jolpica-L | |
| Retirements | Sainz: front-left wheel problem right after leaving the pits, 29 laps (Jolpica "Engine"; WP/AS: wheel; WP: lap 30). Verstappen: electrical, 34 laps. Button: did not start. Ricciardo's engine failed on the final straight of the last lap; he coasted over the line, 6th. | Jolpica-R, WP, AS | |
| Team orders | None sourced. | WP, MS, AS | |
| Result | Hamilton 1:35:05.809; Räikkönen +3.380; Rosberg +6.033; Bottas +42.957; Vettel +43.989; Ricciardo +1:01.751; Grosjean +1:24.763. | Jolpica-R, WP, AS | |

### Proposal (draft, for the owner)

| Item | Draft | Owner checked |
|---|---|---|
| Storyline drivers | Räikkönen (Ferrari) and Rosberg (Mercedes); Hamilton as the leader to catch. | |
| Dilemma (original wording) | Ferrari runs Räikkönen long and against the grain: mediums in the middle, then a late sprint on softs. Is it enough to reel in the Mercedes before the flag? | |
| Suggested side | Räikkönen (pending `pipeline hard-calls`): offset stint lengths and compounds, the last car of the top four to stop each time. | |
| Target (draft) | win: Räikkönen from P4 (he lost by 3.380 s). Alternative: beat-rival Rosberg. | |
| Side really won? | No: Räikkönen finished 2nd. A rewrite is allowed for the win target; with beat-rival Rosberg the side did really win (no rewrite). | |
| Modelling risk | **Medium.** Dry, no SC/VSC/red flag, so the race is clean to simulate. Points to watch: Rosberg's lap-56 brake-by-wire failure decides 2nd and needs a FAULT event (otherwise Räikkönen may not pass him); Hamilton's last-lap brake-by-wire loss shrinks the winning gap; Vettel's lap-36 wing damage and extra stop needs a FAULT/damage event (it hands Bottas 4th); Massa's pit-lane start (Jolpica says grid 6); Ricciardo's last-lap engine failure (he still finishes); stop laps differ by one between WP and Jolpica (Jolpica in-laps taken). | |

### Not in sources

- Bottas's and Ricciardo's compounds.
- Gap between Räikkönen and Hamilton at the moment of the lap-40 pass (only lap-sum gaps from Jolpica-L).
- Whether the Rosberg brake-by-wire failure lost a measurable amount of time beyond the place.

## abu-dhabi-2015 (2015 Abu Dhabi Grand Prix)

Replaces `hungary-2015` in Era 7 #5.

Picked by stats to replace a failing Era 7 race; passes the simulator check (0.76 s). Every fact
below was read in the linked source (fetched 2026-11-09); nothing comes from memory. Where
sources disagree, the row says so. No team radio is quoted; radio exchanges are paraphrased
from the reports. Check each row and put your initials and the date in **Owner checked**.

### Sources

| Short name | What |
|---|---|
| WP | [English Wikipedia: 2015 Abu Dhabi Grand Prix](https://en.wikipedia.org/wiki/2015_Abu_Dhabi_Grand_Prix) |
| MS | [Motor Sport magazine: 2015 Abu Dhabi GP report](https://www.motorsportmagazine.com/reports/f1/2015-abu-dhabi-gp-report) |
| GPE | [GrandPrix.com race notes: "Rosberg wins third race in a row"](https://www.grandprix.com/races/abu-dhabi-gp-2015-race-notes-rosberg-wins-third-race-in-a-row.html) |
| Jolpica | `api.jolpi.ca/ergast/f1/2015/19/results.json` and `.../pitstops.json?limit=100` (fetched 2026-11-09) |

Not opened (rate-limited, HTTP 429): the GrandPrix.com race report "The Trilogy"
(`grandprix.com/races/abu-dhabi-gp-2015-race-report-the-trilogy.html`). OpenF1 has no 2015 data.

### Facts

| # | Topic | Fact | Sources | Owner checked |
|---|---|---|---|---|
| 1 | Grid top 6 | Rosberg pole (1:40.237), Hamilton 2nd, Räikkönen 3rd, Pérez 4th, Ricciardo 5th, Bottas 6th. | WP, Jolpica (grid 1-6) | |
| 2 | Grid penalties | Grosjean (gearbox) and Stevens (control electronics) took five-place grid penalties; Merhi started from the pit lane (suspension change out of parc fermé). Vettel was out in Q2 (16th in qualifying, WP) and started 15th (Jolpica grid 15). | WP, Jolpica | |
| 3 | Laps | 55. | WP, Jolpica | |
| 4 | Weather | Dry and clear; air 25-27 °C, track 28-29 °C (WP). Warm and dry, sun setting at the start (GPE); dusk into night under floodlights (MS). | WP, GPE, MS | |
| 5 | SC / VSC / red flag | None mentioned in any source read. MS notes that a safety car after Rosberg's second stop but before Hamilton's would have helped Hamilton. | WP, MS, GPE | |
| 6 | Tyres available | Super-soft (option) and soft (prime). | MS | |
| 7 | Rosberg stops | Started on super-softs; stopped end of lap 10 to softs, then lap 31 to fresh softs (MS, GPE, Jolpica laps 10 and 31; WP's text says lap 32). Two stops. | MS, GPE, Jolpica, WP | |
| 8 | Hamilton stops | Started on super-softs; stopped lap 11 to softs, then lap 41 to softs (MS, GPE, Jolpica laps 11 and 41; WP's text says lap 42). Two stops. | MS, GPE, Jolpica, WP | |
| 9 | Räikkönen stops | Stops lap 10 and lap 31/32: Jolpica 10 and 32, MS end of lap 10 and lap 32, GPE laps 10 and 31. The second was slow (about 4 s lost, WP; Jolpica 25.6 s pit time vs about 21.6 s for Rosberg). Compounds: not in sources. | Jolpica, MS, GPE, WP | |
| 10 | Vettel stops | Started on softs (prime/prime/option). Stops lap 23 to softs (GPE, Jolpica) and lap 39 to super-softs (MS, GPE, Jolpica). WP gives lap 24 and lap 41. | MS, GPE, Jolpica, WP | |
| 11 | Pérez stops | Super-soft start; lap 6 to softs (Jolpica 6; GPE lap 7) and lap 27 (Jolpica, GPE). Second-stop compound: not in sources. | MS, GPE, Jolpica | |
| 12 | Ricciardo stops | Super-soft start; lap 6 to softs (Jolpica 6; GPE lap 7) and lap 26 (Jolpica, GPE). Second-stop compound: not in sources. | MS, GPE, Jolpica | |
| 13 | Gaps during the race | Lap 12: Rosberg 4.2 s ahead of Vettel (not yet stopped), Hamilton 6.3 s, Räikkönen 9.8 s (GPE). Hamilton passed Vettel for 2nd on lap 13 (GPE) / lap 14 (WP). Lap 30: Rosberg 1.3 s ahead of Hamilton (GPE; MS "1.3sec by lap 29"). After Rosberg's lap-31 stop Hamilton led; Hamilton's stop came with the gap just under 10 s and he rejoined about 12 s behind (MS). Lap 50: Rosberg 6.8 s ahead (GPE). | GPE, MS, WP | |
| 14 | Result top 6 | Rosberg; Hamilton +8.271 s; Räikkönen +19.430; Vettel +43.735; Pérez +1:03.952; Ricciardo +1:05.010. | WP, Jolpica, MS | |
| 15 | Retirements | Maldonado, lap 1 collision (Jolpica: 0 laps, "Collision"). All others classified (Merhi 3 laps down). | WP, Jolpica, GPE | |
| 16 | Contact | Lap 1: Nasr/Alonso contact sent Alonso into Maldonado (WP, MS, GPE). Bottas and Button collided in the pit lane (lap 8, GPE; Jolpica both stopped lap 8); Bottas lost his front wing. Verstappen flat-spotted his fronts locking up (lap 20, MS; WP lap 21) and pitted (Jolpica lap 20). | WP, MS, GPE, Jolpica | |
| 17 | Penalties | Alonso drive-through (lap 1 incident). Bottas 5 s (pit-lane collision). Verstappen 5 s for forcing Button off (GPE: after lap 45; WP lap 46) plus a penalty for ignoring blue flags (MS: drive-through, then 20 s for gaining an advantage off track; dropped to 16th). | WP, MS, GPE | |
| 18 | Team orders / instructions | Hamilton was told to run the same power modes as Rosberg, and disputed it (MS). GPE says Vettel let Räikkönen through for 3rd on lap 36; WP says Räikkönen passed Vettel on lap 16. The two may be different moments; not reconciled. | MS, GPE, WP | |
| 19 | The strategy dilemma | Hamilton (P2) asked whether he could skip his second stop and run to the flag; the team advised against it (GPE, WP, MS). MS: Mercedes had considered lengthening his middle stint by about 10 laps to reach the last 14 laps on tyres 0.8-1 s faster than Rosberg's, needing a gap of about 13-14 s that he couldn't quite build. Running to the end needed the lap-11 tyres to last 44 laps; the longest any other softs lasted was 31. Mercedes later worked out he would have been passed around lap 46 on tyres 2.5 s slower. Hamilton had no compound preference for the final stint, and his engineer chose softs over super-softs (super-softs grained quickly). | MS, GPE, WP | |

### Proposal (draft)

| Item | Draft |
|---|---|
| Storyline drivers | Hamilton (player side if the hard-call counter agrees) and Rosberg |
| Dilemma (original wording) | Second to your team-mate: stretch the softs, or skip the last stop and gamble on Rosberg's tyres fading? |
| Target | `beat-rival`: Hamilton beats Rosberg (which here means winning from P2) |
| Did that side really win? | No. Hamilton finished 2nd, 8.271 s behind, so a rewrite (history book) is allowed. |
| Risk | **Medium-high.** No SC/VSC to shuffle things, and Mercedes' own sums (MS) say both alternatives (no stop, longer stint) fall short. The win may be unreachable in the sim. Fallback target: `position` P2 for Hamilton (low risk, but a weak storyline). Lap disagreements (WP +1 lap on several stops) should be settled from Jolpica/TUM when building. Run `pipeline hard-calls` before fixing the side. |

### Authored (B1, Nov 9)

Built as an Eras build with `user_side` HAM / `rival` ROS (`build.py`); takeover lap 8 (D3
rule). Robust G1: pass, 0.76 s. Reachability: era (threshold 78, Standard+ rival) and Legend
(threshold 90, Expert rival) reachable, stay-out never ★3.

| Item | As authored | Basis | Owner checked |
|---|---|---|---|
| Side | **Hamilton.** `pipeline hard-calls`: HAM 2, ROS 1 (chance given up HAM 23.7 pts, ROS 1.0). | hard-call counter | |
| Target | `beat-rival` Rosberg (draft target above). | rows 1, 14 | |
| Rewrite | Yes, `beat-rival` ROS: Hamilton really finished 2nd, +8.271 s. Headline (original): "Hamilton turns the tables on Rosberg at Yas Marina". | row 14 | |
| Storyline text | Rosberg wins from pole by 8.3 s; both Mercedes stop for softs early (Rosberg lap 10, Hamilton lap 11); Rosberg stops again on lap 31; Hamilton leads, asks to run to the flag without a second stop, and is brought in on lap 41, rejoining about 12 s behind. Jolpica stop laps taken (WP is one lap later). | rows 7, 8, 13, 14, 19 | |
| Briefing | Season finale; Rosberg pole and leads Hamilton by just under three seconds after seven laps (TUM timing in `data/raw`: 2.78 s at the end of lap 7), both on super-softs (rows 7, 8), Räikkönen third (TUM lap 7 position). | rows 1, 7, 8; TUM | |
| Mastery | `stop_count` exact 2, "Beat Rosberg on two stops, as Hamilton made". | row 8; reachability | |
| Hidden | `mode_rule` manage, maxLaps 0, "Beat Rosberg without a single lap of tyre management" (a game rule, no fact). | reachability | |
| storylineEvents | None: no SC, VSC or red flag in any source (row 5), and the only retirement (Maldonado, lap 1) is before the takeover. | rows 5, 15 | |
| Moments | From the author tool unchanged (`author abu-dhabi-2015 --rival ROS --target beat-rival --eras --write`): stop-11 (real box; the model's MEDIUM is the real soft, its SOFT the super-soft), pace-20, cliff-25 (real stay), pace-28, rivalpit-31 (Rosberg's second stop), stop-41 (real box). | author output | |
| Reachability paths | Era (seed 1): box softs (model MEDIUM) at 11, standard at 20 and 28, box next lap on softs at 25, stay at 31 and 41: ★1 ★2 ★3, hidden. Legend (seed 3): the same with the first stop a lap later (12). Stay-out: no ★3 on any seed (best ★2 at era difficulty). The winning line stops for the second time at 26, fifteen laps before Hamilton really did. | reachability | |

## singapore-2014 (2014 Singapore Grand Prix)

Replaces `monaco-2015` in Era 7 #4.

Every fact below was read in the linked source on 2026-11-09; nothing comes from memory.
Where sources disagree, the row says so. Check each row and put your initials and the date in
**Owner checked**.

### Sources

| Short name | What |
|---|---|
| WP | [English Wikipedia race article](https://en.wikipedia.org/wiki/2014_Singapore_Grand_Prix) (first ~100k characters read) |
| MS | [Motor Sport, 2014 Singapore GP report](https://www.motorsportmagazine.com/reports/f1/2014-singapore-gp-report/) |
| GPE | [GrandPrix.com race notes](https://www.grandprix.com/races/singapore-gp-2014-race-notes-hamilton-wins-signapore-gp.html) |
| Jolpica-r | [Jolpica results, 2014 round 14](https://api.jolpi.ca/ergast/f1/2014/14/results/?limit=100) |
| Jolpica-p | [Jolpica pit stops, 2014 round 14](https://api.jolpi.ca/ergast/f1/2014/14/pitstops/?limit=100) |

OpenF1 has no 2014 data. GPE's lap numbers run one higher than Jolpica's in-laps for most stops
(it seems to count the lap after the stop), as in other GPE race notes. Lap numbers below use
Jolpica unless marked.

### Facts

| Topic | Fact | Sources | Owner checked |
|---|---|---|---|
| Grid | Qualifying: Hamilton pole (1:45.681), Rosberg 2nd (1:45.688), Ricciardo 3rd, Vettel 4th, Alonso 5th, Massa 6th. Jolpica grid: HAM 1, ROS 2, RIC 3, VET 4, ALO 5, MAS 6. | WP, Jolpica-r | |
| Grid penalties / starts | No grid penalties for the top six in the sources read. Rosberg started from the pit lane (steering-wheel control fault from a wiring loom problem, WP; "electronic problem", GPE). Jolpica still lists him as grid 2. Kobayashi did not start (power unit, Jolpica; oil pressure on the formation lap, WP). | WP, GPE, Jolpica-r | |
| Laps | Scheduled 61 laps (308.965 km); 60 run (303.900 km). The flag came out a lap early because the two-hour limit was reached (GPE; WP says the race ended under the two-hour limit because of the safety car). Winner's time 2:00:04.795. | WP, GPE, Jolpica-r | |
| Weather | Dry and clear; air about 28-30 °C, track about 33-37 °C. Night race. | WP | |
| Safety car | One SC for debris after Sutil squeezed Pérez into the wall (Pérez's front wing broke). Out on lap 30 (WP; GPE says 31), withdrawn at the end of lap 37 (WP, MS; GPE: in on lap 37). MS: laps 30 to 37. | WP, MS, GPE | |
| VSC / red flag | None mentioned (the VSC did not exist in 2014). | WP, MS, GPE | |
| Hamilton stops | Three: in-laps 13, 26, 52 (Jolpica-p). Lap 26 onto super-softs; lap 52 onto softs (the prime he still had to use, MS), a 2.9 s stop (GPE). First-stop compound: not in sources. MS: 8.8 s ahead of Vettel at his first stop. | Jolpica-p, WP, MS, GPE | |
| Hamilton's final-stop gap | He needed about 27 s to come out ahead of Vettel (MS). 24 s on lap 50 (MS); 25.2 s on lap 51 (GPE). He wanted to pit for tyre wear but was told to build the lead over three more laps (WP). He rejoined just behind Vettel and passed him the lap after (MS; lap 53, GPE; lap 54, WP). | MS, GPE, WP | |
| Vettel stops | Two: in-laps 12 and 25 (Jolpica-p). Lap 25 onto softs (WP), then to the flag on tyres 27 laps old (MS). Red Bull had planned three stops (Horner, MS). He doubted the softs would last (MS). | Jolpica-p, WP, MS | |
| Ricciardo stops | Two: in-laps 12 and 27 (Jolpica-p), same plan as Vettel (MS); onto softs on lap 27 (GPE). An intermittent power loss during the race (MS). | Jolpica-p, MS, GPE | |
| Alonso stops | Three: in-laps 12, 24 and 31 (Jolpica-p). Lap 24 onto super-softs (WP); the last stop came under the SC, onto primes (MS, GPE), so he could reach the end without another stop (WP). | Jolpica-p, WP, MS, GPE | |
| Massa stops | Two: in-laps 10 and 22 (Jolpica-p). Super-softs at the first stop, softs at the second (GPE gives laps 10 and 23). | Jolpica-p, GPE | |
| Vergne stops | Three: in-laps 11, 24, 44 (Jolpica-p); softs at the last (GPE). | Jolpica-p, GPE | |
| Result | 1 Hamilton 2:00:04.795; 2 Vettel +13.534; 3 Ricciardo +14.273; 4 Alonso +15.389; 5 Massa +42.161; 6 Vergne +56.801; 7 Pérez +59.038; 8 Räikkönen +1:00.641. Hamilton took the championship lead. | Jolpica-r, WP | |
| Retirements | Rosberg 13 laps (Jolpica: electrical; stalled in the pits, could not find first gear, retired in the garage, WP/GPE). Gutiérrez 17 laps (electrical). Sutil 40 laps (water pressure). Button 52 laps (car shut down, GPE). Kobayashi DNS. Chilton classified +1 lap. No top-six car retired. | Jolpica-r, WP, GPE | |
| Penalties | Vergne: two 5 s penalties for track limits while defending, added to his time; he kept 6th (MS; WP and GPE mention one). Sutil: 5 s penalty (GPE: track limits). Exact laps: not consistent in sources. | MS, WP, GPE | |
| Contact | Sutil–Pérez at Turn 8 (lap 30, WP), causing the SC. | WP, MS | |
| Team orders | None at Red Bull or Mercedes in the sources read. Toro Rosso: Vergne asked for Kvyat to be moved aside to get at Magnussen (MS). WP: suspicion of coded Red Bull messages; the FIA was satisfied. | MS, WP | |

### Dilemma, side and target (drafts)

| Item | Draft | Basis | Owner checked |
|---|---|---|---|
| Storyline drivers | Hamilton and Vettel. | MS, WP, GPE | |
| Dilemma | After the safety car Hamilton is on super-softs and still owes a stop for the harder tyre: how many laps can he push to build a big enough gap before he comes in, while Vettel tries to run his softs to the flag? | MS, WP | |
| Target | win: Hamilton (needs ~27 s, MS, or a pass after the final stop). Alternative from Vettel's side: win by making the two-stop last. | MS, Jolpica-r | |
| Did the side win? | Hamilton: yes, so no rewrite. Vettel: no (2nd), rewrite allowed. The side should come from `pipeline hard-calls`. | Jolpica-r | |
| Risk | Medium. The race ended on the two-hour limit (60 of 61 laps), the SC lap differs by one between sources (30 vs 31), first-stop compounds are not in sources, and Rosberg's pit-lane start is listed as grid 2 in Jolpica. | WP, GPE, Jolpica-r | |

## brazil-2014 (2014 Brazilian Grand Prix)

Replaces `canada-2014` in Era 7 #2.

Sim check: passes (1.41 s). Every fact below was read in the linked source; "not in sources"
where a number was not given. No team radio quoted.

### Facts

| # | Fact | Source(s) | Owner checked |
|---|---|---|---|
| 1 | Interlagos (Autódromo José Carlos Pace), 9 Nov 2014, round 18 of 19. 71 laps of 4.309 km, 305.909 km. Pirelli brought Medium and Soft (switched from Hard/Medium after the resurfacing). | WP, Jolpica | |
| 2 | Weather: dry and sunny, air 23-24 °C, track 46-50 °C; forecast rain did not come. | WP | |
| 3 | Grid top 6: Rosberg (Mercedes) pole 1:10.023, Hamilton (Mercedes), Massa (Williams), Bottas (Williams), Button (McLaren), Vettel (Red Bull). Then Magnussen 7, Alonso 8, Ricciardo 9, Räikkönen 10. | WP, Jolpica (grid column) | |
| 4 | Grid penalties: Kvyat 10 places (engine penalty carried from USA; qualified 14th, started 17th per Jolpica); Pérez 7 places (avoidable accident with Sutil in USA; started 18th per Jolpica). Sutil started from the pit lane (cooling reconfigured). | WP, Jolpica, MS | |
| 5 | Start tyres: top ten on Softs (Q2 tyre rule), four cars on Mediums. | WP, MS | |
| 6 | SC / VSC / red flag: none reported in the race (VSC only tested in practice in 2014). | WP, MS, GPE | |
| 7 | Stops (Jolpica in-laps): Rosberg 7, 26, 50; Hamilton 8, 28, 51; Massa 5, 25, 50; Button 6, 27, 50; Vettel 6, 24, 48; Alonso 7, 28, 52; Bottas 6, 26, 42; Räikkönen 8, 35 (only two-stopper, GPE/MS). WP narrative: Massa end of lap 5 (blistered Softs), Rosberg end of lap 7, Hamilton end of lap 8, Rosberg's 2nd lap 26, Hamilton's 2nd lap 28, Rosberg's 3rd lap 50. | Jolpica, WP, MS | |
| 8 | Compounds: leaders Soft first stint, then Mediums (MS: "options, then mediums"; WP: Massa Soft to Medium). Exact compound per later stint: not in sources. | MS, WP | |
| 9 | Hamilton's lap-28 spin: Mercedes kept him out a lap longer than Rosberg (MS: strategist Vowles trying an overcut); on worn rears, after an energy-recovery setting change without a brake-bias change, he locked the rears at Turn 4 (Descida do Lago) and spun; rejoined after ~7 s, pitted that lap, came out 7.4 s behind (WP, GPE; MS 7.5 s). GPE puts the spin "around lap 26"; WP and Jolpica in-lap say 28. | WP, MS, GPE, Jolpica | |
| 10 | Gaps: Rosberg +0.8 s after lap 1; ~2 s around lap 14; Hamilton 2.1 s behind at start of lap 20; within 1 s before Rosberg's 2nd stop (MS); ~5 s by lap 35; 1.9 s at start of lap 50; 0.8 s at start of the final lap. | WP, MS, GPE | |
| 11 | Massa: five-second penalty for pit-lane speeding (served at his lap-25/26 stop); also stopped in McLaren's box at his final stop. GPE calls it a stop-and-go; WP and MS say 5 s (taken: 5 s). | WP, MS, GPE | |
| 12 | Bottas: slow stops (seat belts undone, ~14 s lost, MS; front-wing adjustment at lap 44 stop, WP); finished 10th. Räikkönen: front jack dropped early at lap-35 stop. | WP, MS | |
| 13 | Result: Rosberg 1:30:02.555; Hamilton +1.457; Massa +41.031; Button +48.658; Vettel +51.420; Alonso +1:01.906. Mercedes' 11th one-two of 2014. | Jolpica, WP | |
| 14 | Retirements: Ricciardo (front-left suspension, lap 39 / 39 laps); Grosjean (engine smoke, lap 65; classified 17th, 63 laps). | WP, Jolpica, MS | |
| 15 | Contact: none between front-runners reported. Team orders: none reported. Hülkenberg (lap 9-13) and Kvyat led during the first stop cycle (later stops). | WP, GPE | |
| 16 | Title context: Hamilton led Rosberg by 24 pts before, 17 after; Abu Dhabi (double points) decided it. | WP, GPE | |

### Strategy dilemma

- **Mercedes / Hamilton:** the overcut. Rosberg pits lap 26; Hamilton stays out to try to jump
  him on worn rears, spins, and loses ~7 s. Then he must close a 7.4 s gap with one stop left
  and try again at the final stops (laps 50/51). Lost by 1.457 s.
- **Rosberg:** cover Hamilton at every stop (he stopped first each time: 7, 26, 50).
- Massa: early blistering forced a lap-5 stop, plus a 5 s penalty; 3rd anyway.
- Räikkönen: the only two-stop (8, 35), dropped from 4th to 7th on 25-lap-old tyres.

### Proposal (draft, owner to decide)

- **Storyline drivers:** Hamilton (side) and Rosberg (rival).
- **Dilemma (original wording):** "Stay out to overcut your team-mate on fading rears, or pit
  with him and fight on track?"
- **Target (draft):** win: Hamilton from P2 (beat Rosberg). Fallback: beat-rival Rosberg is the
  same thing here; position P2 too easy.
- **Did that side really win?** No (Hamilton 2nd, +1.457 s), so a history-book rewrite is
  allowed. If the hard-call counter picks Rosberg, he really won: no rewrite, target "defend".
- **Side check needed:** `pipeline hard-calls brazil-2014` (likely Hamilton: the lap-28 call).
- **Risk:** medium. Stop laps (Jolpica), gaps and result are well sourced and consistent. Weak
  points: the decisive time loss is a driver spin, not a strategy call (the sim must either
  script it as a storyline event or the extra-lap call must carry the cost); compounds after
  stint 1 not sourced; spin lap differs (GPE ~26 vs WP/Jolpica 28); a two-Mercedes race leaves
  little else in play.

### Sources

| Short name | URL | Read |
|---|---|---|
| WP | https://en.wikipedia.org/wiki/2014_Brazilian_Grand_Prix | 2026-11-09 |
| Jolpica | https://api.jolpi.ca/ergast/f1/2014/18/results.json and /pitstops.json | 2026-11-09 |
| MS | https://www.motorsportmagazine.com/articles/single-seaters/f1/2014-brazilian-gp-report/ | 2026-11-09 |
| GPE | https://www.grandprix.com/races/brazilian-gp-2014-race-report-down-to-the-wire.html | 2026-11-09 |

## canada-2016 (2016 Canadian Grand Prix)

Replaces `hungary-2014` in Era 7 #3.

Every fact below was read in the linked source (fetched 2026-11-09); nothing comes from memory.
Where sources disagree, the row says so. Put your initials and the date in **Owner checked**.
Simulator check: passed (1.97 s).

### Sources

| Short name | What |
|---|---|
| WP | [English Wikipedia race article](https://en.wikipedia.org/wiki/2016_Canadian_Grand_Prix) (short race report; qualifying table, infobox) |
| MS | [Motor Sport race report](https://www.motorsportmagazine.com/reports/f1/2016-canadian-grand-prix/) |
| AS | [Autosport, "Lewis Hamilton wins F1 Canadian Grand Prix to close on Nico Rosberg"](https://www.autosport.com/f1/news/124752/hamilton-beats-vettel-to-close-on-rosberg) |
| GPE | [GrandPrix.com race notes, "Hamilton wins in Montreal"](https://www.grandprix.com/races/canadian-gp-2016-race-notes-hamilton-wins-in-montreal.html) and [race results](https://www.grandprix.com/races/canadian-gp-2016-race-results.html) |
| J-res | [Jolpica results](https://api.jolpi.ca/ergast/f1/2016/7/results.json) |
| J-pit | [Jolpica pit stops](https://api.jolpi.ca/ergast/f1/2016/7/pitstops.json?limit=100) |
| OpenF1 | Not used: OpenF1 has no 2016 sessions (its data starts in 2023) |

### Facts

| Topic | Fact | Sources | Owner checked |
|---|---|---|---|
| Grid | Hamilton pole (1:12.812), Rosberg 2nd (1:12.874), Vettel 3rd (1:12.990), Ricciardo 4th, Verstappen 5th, Räikkönen 6th; Bottas 7th, Massa 8th. | WP, J-res | |
| Grid penalties | None in the top six. Sainz five places for a gearbox change after a qualifying crash: started 20th (J-res, AS, GPE; MS says 21st). Kvyat and Ericsson three places each (Monaco incidents). Haryanto at the back after a qualifying crash (MS). | J-res, AS, GPE, MS, WP | |
| Laps | 70 laps (305.270 km), round 7. | WP, J-res | |
| Weather | Dry. Cloudy, cool (12 C air, 21-23 C track, WP infobox); "cool, cloudy and blustery" (MS); rain spitting before the start (GPE). Low track temperatures meant much less tyre degradation than expected (MS). | WP, MS, GPE | |
| Tyres | Allocation soft, supersoft, ultrasoft (WP). The soft was the compulsory race tyre (MS, AS). Pirelli expected about 25 laps from ultrasofts and about 50 from softs (MS; AS: Pirelli predicted the soft could run 50). Top ten started on ultrasofts (GPE). | WP, MS, AS, GPE | |
| Start / contact | Vettel passed both Mercedes to lead into Turn 1. Hamilton and Rosberg touched at Turn 1; Rosberg went off and fell to about 9th-10th (AS: 9th then 10th by end of lap 1; GPE: 10th). Hamilton 2nd. No penalty reported for the contact. Nasr and Magnussen touched and the Sauber spun (GPE). | AS, MS, GPE, WP | |
| SC / VSC / red flag | One VSC, for Button's McLaren engine failure: MS says lap 10; Button classified at 9 laps (J-res). No safety car or red flag in any source. VSC end lap: not in sources. | MS, AS, J-res, WP | |
| Vettel stops | Two. 1st under the VSC, ultrasoft to supersoft: end of lap 11 (AS, J-pit 11; GPE says lap 10). 2nd to soft: lap 37 (J-pit, GPE; AS "around" 13 laps after Hamilton; MS says lap 36), from a 9.5 s lead, rejoining about 7 s behind (MS; AS 7.8 s). | AS, J-pit, GPE, MS | |
| Hamilton stops | One, lap 24 (J-pit, AS, MS "end of the 24th lap"; GPE implies 25), to softs for 46 laps (AS, MS). GPE says ultrasoft: conflicts with AS/MS; AS/MS taken. Hamilton stayed out under the VSC. | J-pit, AS, MS, GPE | |
| Räikkönen stops | Two. 1st under the VSC: lap 11 (J-pit; GPE says 14), supersofts (MS: told to box late, already committed). 2nd lap 33 to soft (J-pit, MS, GPE). | J-pit, MS, GPE | |
| Bottas stop | One, lap 23 (J-pit, MS; GPE 24), to soft (GPE). Williams aimed for one stop (MS). | J-pit, MS, GPE | |
| Verstappen stops | Two: lap 20 to soft (J-pit, MS, GPE), lap 46 (J-pit, GPE) to ultrasoft (MS) / soft (GPE): unresolved. | J-pit, MS, GPE | |
| Ricciardo stops | Two: lap 21 and lap 38 (J-pit, MS; GPE 39). 2nd stop for "another set of softs" after front-tyre damage (MS); GPE gives ultrasoft at the 1st stop. | J-pit, MS, GPE | |
| Rosberg stops | Two: lap 21 to soft (J-pit, GPE), lap 51 to soft after a slow right-rear puncture (J-pit, MS, GPE); the 2nd was an extra stop (WP, GPE). | J-pit, MS, GPE, WP | |
| Pit loss | Jolpica durations for the leaders 22.2-23.6 s (pit-lane time). | J-pit | |
| Key gaps | After Hamilton's stop he rejoined about 13 s behind Vettel (MS); lap 25: Vettel led Hamilton by 13.2 s (GPE). Lap 40: Hamilton +6.6 s on Vettel; lap 50: 4.8 s; lap 60: 5.5 s (GPE). Vettel closed to 4.3 s after 55 laps, then locked up into the final chicane on laps 56 and 61 and fell back to 6.7 s (AS). | GPE, MS, AS | |
| Why Ferrari lost | Ferrari expected rivals to two-stop and pitted Vettel under the VSC; Mercedes, Red Bull and Williams aimed for one stop and gained track position; Ferrari misjudged the low degradation in the cold (MS). Ferrari's team principal later called the decision wrong (WP, paraphrased; not team radio). | MS, WP | |
| Result | Hamilton 1:31:05.296; Vettel +5.011; Bottas +46.422; Verstappen +53.020; Rosberg +1:02.093; Räikkönen +1:03.017; Ricciardo +1:03.634 (last on lead lap). Fastest lap Rosberg 1:15.599, lap 60. | J-res, GPE, WP | |
| Late fight | Rosberg passed Ricciardo on lap 54 and Räikkönen three laps later (MS), then could not pass Verstappen; spun on lap 69 attempting it at the final chicane (AS, GPE, MS). | MS, AS, GPE | |
| Retirements | Button engine, 9 laps (J-res, GPE; AS table says gearbox). Palmer water leak, 16 laps (J-res; AS text says lap 18). Massa engine/overheating, 35 laps (J-res; AS text "after 37 laps"). No top-six retirements. | J-res, GPE, AS, MS | |
| Penalties / team orders | No in-race penalties to front-runners in any source. Team orders: none in sources. | | |
| Championship | After the race: Rosberg 116, Hamilton 107, Vettel 78 (AS). | AS | |
| Not in sources | VSC end lap; Verstappen's 2nd-stop compound and Ricciardo's 1st-stop compound (sources conflict); exact Vettel 1st-stop lap (10 vs 11) and 2nd (36 vs 37); Räikkönen 1st stop (11 vs 14). | | |

### Draft storyline

| Item | Draft | Owner checked |
|---|---|---|
| Storyline drivers | Vettel (Ferrari, led from the start, two-stopped) and Hamilton (Mercedes, one stop). | |
| Dilemma (original wording) | A virtual safety car hands Ferrari a cheap stop from the lead: take it and commit to two, or stay out and trust the tyres to last in the cold? | |
| Hard-call candidates | Vettel lap 10-11 (box under the VSC or stay out); Vettel's 2nd-stop timing/compound; Hamilton lap 24 (how long to extend, then soft to the flag). `pipeline hard-calls` should pick the side; Vettel looks likeliest. | |
| Suggested side and target | Vettel: `win` (beat Hamilton, P1). He finished 2nd, 5.0 s behind, so he did not really win; a rewrite is allowed. If Hamilton is picked: `win` from pole; he really won, so no rewrite. | |
| Modelling risk | **Medium.** For: dry, one VSC, no SC/red flag, no front-runner contact after lap 1, sim check passed (1.97 s). Against: the counterfactual (Vettel stays out and one-stops) depends entirely on the sim reproducing unusually low wear in cold conditions; the VSC lap (10/11) and Vettel's stop laps differ between sources; compounds conflict for Hamilton (AS/MS soft vs GPE ultrasoft), Verstappen and Ricciardo; Vettel's lock-ups (laps 56, 61) cost ~2.4 s that the sim will not reproduce; Rosberg's lap-1 off and puncture shape the mid-field order. | |

## malaysia-2015 (2015 Malaysian Grand Prix)

Replaces `great-britain-2016` in Era 7 #9.

Every fact below was read in the linked source on 2026-11-09; nothing comes from memory.
Where sources disagree, the row says so. Check each row and put your initials and the date in
**Owner checked**. OpenF1 has no 2015 data. TUM (2014-2019) was not read for this sheet.

### Sources

| Short name | What |
|---|---|
| WP | [English Wikipedia race article](https://en.wikipedia.org/wiki/2015_Malaysian_Grand_Prix) |
| GPE | [GrandPrix.com race notes](https://www.grandprix.com/races/malaysian-gp-2015-race-notes-vettel-wins-malaysian-gp-for-ferrari.html) |
| AS | [Autosport race report](https://www.autosport.com/f1/news/f1-malaysian-gp-sebastian-vettel-and-ferrari-defeat-mercedes-5009109/5009109/) |
| MS | [Motor Sport, Mark Hughes race report](https://www.motorsportmagazine.com/reports/f1/2015-malaysian-gp-report/) |
| Jolpica-r | [Jolpica results, 2015 round 2](https://api.jolpi.ca/ergast/f1/2015/2/results/) |
| Jolpica-p | [Jolpica pit stops, 2015 round 2](https://api.jolpi.ca/ergast/f1/2015/2/pitstops/?limit=100) |

WP, GPE, AS and MS were read through a fetch tool that summarises; check their wording.

### Facts

| Topic | Fact | Sources | Owner checked |
|---|---|---|---|
| Grid | Hamilton pole (1:49.834, by 0.074 s), Vettel 2nd, Rosberg 3rd, Ricciardo 4th, Kvyat 5th, Verstappen 6th; Massa 7th, Bottas 8th. Räikkönen 11th. Q3 was wet (rain after Q2, half-hour delay, intermediates). | WP, Jolpica-r | |
| Grid penalties | None for the top 6. Grosjean two places (left the pit lane out of order): qualified 8th, started 10th. Stevens did not start (fuel system). | WP, Jolpica-r | |
| Laps | 56 laps, 310.408 km. | WP, Jolpica-r | |
| Weather | Dry and sunny, air 32-33 °C; track 53-58 °C (WP infobox), 61 °C (WP text), about 60 °C at the 3 pm start (MS). | WP, MS | |
| Tyres available | Hard (prime) and medium (option). | WP, MS | |
| Safety car | One. Ericsson into the Turn 1 gravel on lap 4 (WP, GPE, AS); MS says lap 3. GPE: Hülkenberg and Ericsson touched. In at the end of lap 6 (GPE, MS); WP: racing resumed lap 7. **Conflict** on the deploy lap (4 vs 3). | WP, GPE, AS, MS | |
| VSC / red flag | None mentioned. | WP, GPE | |
| SC split | Most cars pitted, both Mercedes for hards (MS, AS, GPE). Vettel, Hülkenberg, Grosjean, Sainz and Pérez stayed out (GPE, MS). Vettel led the restart and was about 10 s clear when the SC period ended (MS). | GPE, MS, AS, WP | |
| Vettel stops | Two: Jolpica laps 17, 37; WP and GPE 18, 38; MS 17, 37; AS lap 17 and "14 laps to go". Tyres: medium start, medium (stop 1), hard (stop 2) (MS, GPE). **Conflict** on laps (off-by-one; AS's second stop disagrees with all). | Jolpica-p, WP, GPE, MS, AS | |
| Hamilton stops | Three: Jolpica laps 4 (SC), 24, 38; MS 24, 38; WP 24, 39; GPE 39. Tyres: medium start, hard (SC), medium, hard (MS; AS agrees). About 24 s behind Vettel at his lap 24 stop (MS). | Jolpica-p, MS, WP, GPE, AS | |
| Rosberg stops | Three: Jolpica laps 4 (SC), 26, 41; GPE 26, 41. Tyres: medium start, hard (SC), hard, medium (MS, GPE). Mercedes split strategies at the second stop (AS). | Jolpica-p, GPE, MS, AS | |
| Räikkönen | Puncture after contact with Nasr on lap 1, back to the pits (Jolpica: stop lap 2), then stops 14 and 34; recovered to 4th. | WP, GPE, AS, Jolpica-p | |
| Gaps in the race | Vettel's lead: lap 15 HAM 9.2 s, ROS 17.8 s; lap 30 HAM 19.3, ROS 32.9, RAI 38.5; lap 45 HAM 11.4, ROS 22.4, RAI 45.1; lap 50 HAM 10.2. | GPE | |
| Result (top 6) | Vettel 1:41:05.793; Hamilton +8.569; Rosberg +12.310; Räikkönen +53.822; Bottas +1:10.409 (passed Massa on the last lap, WP); Massa +1:13.586. Verstappen 7th. | Jolpica-r, WP | |
| Retirements | Ericsson 3 laps (spun off); Alonso 21 (ERS, Jolpica; power unit, WP); Button 41 (turbo); Maldonado 47 (Jolpica "Retired"; WP brakes); Stevens DNS. | Jolpica-r, WP | |
| Penalties | Maldonado 10 s (exceeding the SC delta time, lap 16, WP). Hülkenberg 10 s (hit Kvyat at Turn 2, AS; GPE ties one penalty to the Ericsson incident). Pérez 10 s (spun Grosjean, lap 31, served at his lap 37 stop, GPE). | WP, GPE, AS | |
| Contact | Lap 1: Bottas-Maldonado (Maldonado puncture), Nasr-Räikkönen. Hülkenberg-Kvyat around lap 26; Pérez-Grosjean about lap 31. | WP, GPE, AS | |
| Team orders | None among front-runners. Ricciardo let Kvyat through for 11th around lap 26 (WP). Mercedes told Rosberg Vettel would stop one fewer time (GPE, paraphrase). | WP, GPE | |
| Why it worked | Mercedes could not stop the medium overheating at ~60 °C and took hards; the Ferrari was kinder to its tyres, so it could two-stop while Mercedes three-stopped (MS). Mercedes' last-stint hards lacked pace (AS). | MS, AS | |

### Proposal

| Item | Proposal |
|---|---|
| Storyline drivers | Vettel (Ferrari, stays out under the lap-4 SC, two stops) and Hamilton (Mercedes, pits under the SC for hards, three stops). |
| Dilemma (original wording) | The safety car comes out on lap 4 in 60-degree heat: give up the lead for fresh hards, or stay out and trust the Ferrari to make two stops last. |
| Draft target | win: Vettel from P2. (If `pipeline hard-calls` picks Hamilton: beat-rival Vettel.) |
| Side really won? | Vettel yes, so no rewrite. Hamilton no (2nd, 8.569 s). |
| Risk | Low to medium. Dry, one SC, full Jolpica stops and compounds from MS/GPE. Risks: stop laps off by one between sources (Jolpica vs WP/GPE); the SC deploy lap (3 vs 4); the outcome depends on the model getting Ferrari's tyre-wear edge in the heat. |

## Notes for the owner

- Track maps: five reuse an existing outline on the same f1db layout (bahrain-2015 from
  bahrain-2021, abu-dhabi-2015 from abu-dhabi-2020, brazil-2014 from brazil-2019, canada-2016
  from canada-2019, malaysia-2015 from the f1db `sepang-1` drawing as malaysia-2013);
  singapore-2014 ran on `marina-bay-2`, which no 2018+ race shares, so it is drawn from f1db's
  SVG with a hand-set start line and auto-placed corners (`2.5-track-maps.md`).
- Incidents: singapore-2014's SC (lap 31 in the built model) and canada-2016's VSC (lap 11) are
  in `data/incidents.json` (display only); the rest have none in the built models
  (`2.6-drivers-incidents.md`).
- The removed races keep their race files, overlays, track files and build entries as Eras-build
  fixtures; their attempts, stars and history-book entries are deleted by migration 0018.

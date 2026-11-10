# Era 6 races swapped (owner, Nov 9, overnight): owner sign-off

The owner pre-approved (Nov 9) swapping failing Eras races for the next-best race by stats.
Two rounds: the first (below) swapped three races; the second ("Second round", after
malaysia-2013) swapped four more. In the first round, in Era 6 the three races with the worst robust-G1 status and mean gap error in
`docs/eras-races-report.md` go, worst first, and each takes the best remaining candidate by
robust-G1 mean gap error, in the old race's slot (migration 0019, as 0012-0014 did). The other
four Era 6 races that fail or are borderline (brazil-2012, abu-dhabi-2012, spain-2013,
china-2011) stay in place. Every fact below was read in the linked source on Nov 9, 2026;
nothing comes from memory. Where sources disagree, the row says so. Check each row against its
links and put your initials and the date in **Owner checked**.

| Era / slot | Removed | Why (robust G1, races report) | Replacement | Robust G1 of the replacement (Eras build, rules-only overlay) |
|---|---|---|---|---|
| 6 / #4 | `monaco-2011` | Fails, 5.73 s (HAM and WEB a lap down at the red-flag restart) | `italy-2010` | pass, 0.79 s (new race) |
| 6 / #5 | `canada-2011` | Fails, 4.45 s (lap pace on the drying track) | `australia-2013` | pass, 1.74 s (new race) |
| 6 / #1 | `australia-2010` | Fails, 3.74 s (two-stoppers stuck in the one-stop train) | `bahrain-2012` | pass, 1.98 s (new race) |

The removed races' numbers are from `docs/eras-races-report.md`. The replacements' numbers were
measured on local builds (`pipeline build <id>`, then `pipeline validate <id> --robust`, one race
per call); the race files and goldens are left for the integrator to rebuild and commit.

**Sides.** A local `pipeline hard-calls` run (written to a scratch directory, not to the
overlays) gives: italy-2010 ALO 0, BUT 0, Alonso by chance given up (38.0 vs 30.3 pts);
australia-2013 RAI 2, ALO 0; bahrain-2012 VET 3, RAI 1. So bahrain-2012 is built and drafted
from Vettel's side (defend from pole), not the Räikkönen draft in its proposal below; Vettel
really won, so no rewrite. The overlays stay rules-only: side, target, storyline, mastery,
hidden objective and briefing come in B1. The proposals below are drafts.

**Wording check needed:** australia-2013's Autosport live text and "top 10 races" rows came
through a fetch tool that summarises pages. Check their wording against the pages.

**italy-2010's stops in the build** come from F1DB (`data/raw/f1db/italy-2010.stops.csv`, CC BY 4.0), as for the other 2010 races; the stop laps in its facts below were read from Jolpica lap times and the race reports.

**Not confirmed by track-status data:** none of the three has an OpenF1 session or TUM data, so
"no safety car" rests on the race reports and on the Jolpica SC estimate (no periods found in
`data/estimates/<id>.sc.json` for any of them).

## italy-2010 (2010 Italian Grand Prix; Era 6 #4, replaces monaco-2011)

### Facts

| Topic | Facts verified | Sources | Owner checked |
|---|---|---|---|
| Grid top 6 | Alonso pole (1:21.962), Button 2nd (1:22.084), Massa 3rd, Webber 4th, Hamilton 5th, Vettel 6th; Rosberg 7th, Hulkenberg 8th, Kubica 9th, Barrichello 10th. Alonso's first Ferrari pole "in almost two years" (AS). Hamilton qualified without the F-duct, Button with it (AS). | Jolpica, WP, AS | |
| Grid penalties | Petrov five places (15th to 20th) for blocking Glock in Q1; Glock five places for a gearbox change, to the back (WP, AS; Jolpica grid: PET 20, GLO 24). Kobayashi started from the pit lane with a gearbox problem (WP, GPE, AS). No penalties in the top 6. | WP, AS, GPE, Jolpica | |
| Race laps, weather | 53 laps, 306.720 km (5.793 km lap), 12 September 2010. Sunny (WP infobox, AS); dry throughout (no source mentions rain). | WP, AS, Jolpica | |
| Championship before / after | Before: Hamilton led, Webber 3 points behind; Vettel, Button and Alonso had not scored in Belgium (WP). After: Webber 187, Hamilton 182, Alonso 166, Button 165, Vettel 163 (GPE, AS). Constructors: Red Bull 350, McLaren 347, Ferrari 290. | WP, GPE, AS | |
| Background | Ferrari went before the FIA World Motor Sport Council the Wednesday before the race over team orders at the German GP; no further sanction (WP). No team orders reported in this race. | WP | |
| Tyres at the start | The top ten all started on the soft (option) Bridgestones (GPE). Button changed to the "prime" (harder) tyre at his stop (AS). Vettel ran softs until lap 52, then a one-lap stint on hards (AS). | GPE, AS | |
| Start and lap 1 | Button passed Alonso into the first chicane. Contact at the apex took a piece from Button's diffuser and Alonso's nose (AS; WP: "light damage"). Hamilton tried to pass Massa at the second chicane, touched him, broke his right-front suspension and stopped in the Lesmo gravel: out on lap 1, "Collision" (Jolpica: 0 laps). Hamilton took the blame (AS). Kobayashi retired on lap 1, gearbox. End of lap 1: Button, Alonso, Massa, Rosberg, Kubica, Hulkenberg, Vettel, Schumacher, Webber, Buemi (GPE). Sutil went through the gravel and pitted at once (lap 3, GPE) for hards to the flag (AS). | WP, AS, GPE, Jolpica | |
| First stint | Button and Alonso ran under a second apart most of the stint: 0.6 s at lap 10, 0.9 s at lap 20, 0.9 s at lap 30 (GPE). Button's lead peaked at about 1.5 s around lap 20 (AS; GPE says 1.6 s on lap 13). Alonso tried to pass on track but couldn't (AS). The McLaren was quicker through the Lesmos, the Ferrari on the straights (AS). Tyres held up "extremely well", so most of the field stopped in the final third (AS). | GPE, AS | |
| Vettel's problem | Lap 20: Vettel reported an engine problem and Webber passed him (WP, GPE, AS). AS says it was a briefly binding brake: a couple of laps about 2 s off the pace, then back up to speed. **WP says engine; AS says brake.** | WP, GPE, AS | |
| Stops: Button | One stop. **Sources disagree on the lap:** AS race text lap 35; WP lap 36; GPE lap 37 ("pits from the lead, rejoining in third"). Jolpica lap times: slow in-lap 36 (1:29.169), 3rd at the end of lap 36, out-lap 37 (1:43.835). **In-lap 36 is taken.** Soft to prime (AS). Computed gap before it: Button 0.96 s ahead of Alonso at the end of lap 35. | Jolpica, WP, AS, GPE | |
| Stops: Alonso (the overcut) | One stop, one lap after Button (WP, AS, GPE). Jolpica lap times: in-lap 37 (1:28.594), out-lap 38 (1:44.227). Rejoined just ahead, side by side through Turns 1-2, and held the inside (WP, AS, GPE). Ferrari's stop was 0.8 s quicker than McLaren's (AS). Button blamed a lack of grip on the cold prime tyre (AS). Computed gap at the end of lap 38: Alonso 0.48 s ahead. Stationary times: **not in sources**. | Jolpica, WP, AS, GPE | |
| Stops: Massa | One stop, the lap after Alonso; led for two laps, rejoined 3rd behind Button (WP, GPE; AS: "couldn't quite beat Button in his stop"). Jolpica: in-lap 38. Compound: **not in sources** (top ten started on softs, GPE). | WP, GPE, AS, Jolpica | |
| Stops: Vettel (long stint) | Stayed out on softs until lap 52 of 53, then one lap on hards; rejoined 4th, ahead of Rosberg and Webber (AS, GPE, WP). Jolpica: in-lap 52, out-lap 53. Computed gap to Rosberg at the end of lap 52: about 18.4 s; finished 1.746 s ahead. Rosberg said only a small late braking error let Vettel get far enough ahead (AS). | AS, GPE, WP, Jolpica | |
| Stops: Rosberg, Webber, others | Rosberg and Webber lap 35 (GPE; Jolpica: in-lap 35). Kubica lap 34, slow stop, dropped behind Hulkenberg (GPE, AS). Hulkenberg the same lap as Button (GPE). Petrov stayed out until lap 51 (AS). | GPE, AS, Jolpica | |
| SC / VSC / red flag | None. No opened source reports a safety car or red flag (VSC did not exist in 2010). | WP, AS, GPE | |
| Penalties / incidents | Alguersuari drive-through for gaining an advantage at the second chicane (GPE, AS). Hulkenberg repeatedly cut chicanes defending from Webber with no penalty (AS, GPE); Webber passed him for 6th on lap 50 (GPE; WP: "four laps to go"). Yamamoto's stop: a mechanic was hit and taken to hospital (AS, GPE). | GPE, AS, WP | |
| Retirements | Hamilton lap 1 (collision), Kobayashi lap 1 (gearbox), Senna (hydraulics; lap 11 WP, lap 13 GPE, Jolpica 11 laps), Trulli (gearbox; Jolpica 46 laps, WP lap 46, GPE lap 49). Di Grassi stopped on the last lap with a suspension failure but was classified (WP, AS). | Jolpica, WP, GPE, AS | |
| Result top 6 | Alonso 1:16:24.572; Button +2.938; Massa +4.223; Vettel +28.196 (Jolpica; AS +28.193); Rosberg +29.942; Webber +31.276. Fastest lap Alonso 1:24.139 (AS; Jolpica lap 52). Ferrari's first home win since 2006 (WP). | Jolpica, AS, GPE, WP | |

### Strategy dilemma

- **Alonso / Ferrari:** stuck within a second of Button on equal tyres with no way past on
  track. Button stops first (in-lap 36); stay out one more lap on the old softs and trust a
  quick stop to come out ahead (the real call, in-lap 37), or cover Button and box the same lap.
  Margin at the exit: about half a second (computed), helped by a 0.8 s quicker stop (AS).
- **Button / McLaren:** led, stopped first, and lost the lead on the out-lap on a cold prime.
  Staying out longer is the alternative; sources don't say whether McLaren considered it.
- **Vettel / Red Bull:** from 7th after lap 1 and losing time around lap 20, run the softs to
  lap 52 and use clear air to jump Rosberg and Webber (the real call, P4).
- Massa stopped a lap after Alonso, so the team's order of stops favoured Alonso (sources give
  no team instruction; not a team order as reported).

### Proposal (draft, for the owner)

| Item | Proposal |
|---|---|
| Storyline drivers | Alonso and Button |
| Dilemma (original wording) | Button blinks first: does Alonso stay out one more lap and trust his crew to win the race in the pit lane? |
| Side | Alonso (to be confirmed by `pipeline hard-calls`; Vettel's lap-52 gamble is the alternative side) |
| Target (draft) | win: Alonso from pole, beating Button by getting ahead at the stops |
| Did the side really win? | Yes. Alonso won, so no rewrite (history book) is allowed. |
| Modelling risk | **Medium** |

**Why medium risk:**
- **Sub-second overcut:** the win came down to about 0.5 s at the pit exit and a 0.8 s quicker
  stop; pit-loss and out-lap noise can flip the real call either way.
- **Cold-tyre out-lap:** Button's lost grip on the prime is part of the story; the sim's
  out-lap penalty has to show it.
- **Lap-1 contact:** Hamilton (P5 grid) out after touching Massa; Alonso and Button touched with
  light damage. Hamilton's retirement must be scripted.
- **Vettel's lap-20 slowdown** (engine per WP, brake per AS): a couple of laps 2 s off, needed
  for the Vettel side or the P4-P6 order.
- **Stop-lap disagreement:** AS 35/36, WP 36/37, GPE 37/38; Jolpica lap times give in-laps 36/37.
- Not flagged: rain (sunny), safety car / VSC / red flag (none), team orders (none reported),
  a last-lap pass.

### Authored content (B1, Nov 9)

Eras job B1, built and checked on branch `eras-author-italy-2010` (base `eras-swap-era6`).
Storyline and briefing are original wording; no team radio is quoted. Every fact rests on a
row in **Facts** above (read Nov 9, 2026).

- Robust G1 (`pipeline validate italy-2010 --robust`, Eras build): **pass** (strict), mean gap
  error 0.79 s, before and after the overlay.
- Reachability (`pnpm --filter @laststint/sim reachability italy-2010`): **pass** at era
  difficulty (threshold 80, Smart rival) and at Legend (90, Expert rival): all three stars and
  the hidden objective on seed 2 (stop-37 box-hard, then push-attack, push, push). The
  stay-out path never earns ★1 or ★3 at either level (it can earn ★2 at era difficulty).
- Moments (`pnpm --filter @laststint/sim author italy-2010 --target win --eras --write`):
  stop-37 (real option box-hard: in-lap 37, out-lap 38), pace-41, pace-45, pace-49
  (`data/moments/italy-2010.json`). The author tool also offered rivalpit-36 (Button's in-lap:
  stay 42%, box next lap on hards 42%), not kept because stop-37 is the same call one lap later.
  Takeover lap 33 (build): Button P1, Alonso P2 0.809 s behind, both on 33-lap-old softs.

| Item | Value | Fact it rests on | Source | Owner checked |
|---|---|---|---|---|
| Side | ALO (hard calls ALO 0, BUT 0; chance given up ALO 38.0, BUT 30.3 pts; `pipeline hard-calls`) | the grader, not a fact | - | |
| Target | `win` | Alonso won; Button 2nd, +2.938 | Jolpica, AS, GPE, WP | |
| Rewrite | none: the side really won | Alonso won | Jolpica | |
| Storyline | "Button takes the lead from Alonso at the first chicane" | Button passed Alonso into the first chicane | AS | |
| Storyline | "for more than 30 laps the two run within two seconds of each other on the same soft tyres, Alonso unable to find a way past" | 0.6 s lap 10, 0.9 s lap 20, 0.9 s lap 30; lead peaked about 1.5 s (AS) / 1.6 s (GPE); Alonso couldn't pass on track; top ten started on softs | GPE, AS | |
| Storyline | "Button stops first. Alonso stays out one more lap, a quicker Ferrari stop puts him out just ahead, and he holds the inside through the first chicane" | Alonso stopped one lap after Button; Ferrari's stop 0.8 s quicker; rejoined just ahead, side by side through Turns 1-2, held the inside | WP, AS, GPE, Jolpica | |
| Storyline | "Alonso wins Ferrari's home race by 2.938 s" | Button +2.938 | Jolpica | |
| Briefing | "Button took the lead from you at the first chicane" | as above | AS | |
| Briefing | "33 laps in he is still less than a second ahead, on the same soft tyres" | build state at takeover (lap 33): 0.809 s; GPE 0.9 s at lap 30, computed 0.96 s at lap 35 | build, GPE, Jolpica | |
| Briefing | "You can't pass him on track, and each of you has one stop to make" | Alonso couldn't pass on track (AS); both one stop (WP, AS, GPE) | AS, WP, GPE | |
| Mastery | `margin` 3 s: "Win by more than 3 seconds" (beat the real margin) | Button +2.938 | Jolpica | |
| Hidden | `stop_count` exact 1: "Win on one stop" | the game's choice; Alonso really stopped once | WP, AS, GPE | |
| storylineEvents | none | no SC, VSC or red flag; the only event after the takeover is Trulli's retirement (not part of the story); Hamilton's and Kobayashi's lap-1 retirements are before the takeover | WP, AS, GPE; 2.6 | |

Rejected objectives (reachability): hidden `mode_rule` push at most 8, 10 or 12 laps, and
hidden `margin` 4 s or 5 s, all met at era difficulty but not at Legend (Legend's winning paths push from lap 41 to the
flag, and none of the searched paths wins by 4 s).

`data/races/italy-2010.json`, its golden and `races.gen.ts` are for the integrator to rebuild
(`pipeline build italy-2010`); this branch does not commit them.

### Sources

| Short name | What |
|---|---|
| WP | [English Wikipedia, 2010 Italian Grand Prix](https://en.wikipedia.org/wiki/2010_Italian_Grand_Prix) (text and infobox) |
| AS | [Autosport, "The complete 2010 Italian GP review"](https://www.autosport.com/f1/news/the-complete-2010-italian-gp-review-5081604/5081604/) |
| GPE | [GrandPrix.com race notes](https://www.grandprix.com/races/italian-gp-2010-race-notes-alonso-wins-italian-gp-for-ferrari.html) (the race report page returned "busy" and was not read) |
| Jolpica | [Results](https://api.jolpi.ca/ergast/f1/2010/14/results/) and per-driver lap times (`api.jolpi.ca/ergast/f1/2010/14/drivers/<id>/laps/`, alonso, button, massa, vettel, rosberg, webber), fetched 2026-11-09. Jolpica has no pit-stop data for 2010; stop laps come from slow in/out-laps and position changes. |

## australia-2013 (2013 Australian Grand Prix; Era 6 #5, replaces canada-2011)

### Sources

| Short name | What |
|---|---|
| WP | [English Wikipedia race article](https://en.wikipedia.org/wiki/2013_Australian_Grand_Prix) (raw wikitext read) |
| AS-live | [Autosport live text, 2013 Australian GP](https://www.autosport.com/f1/live-text/2013-australian-grand-prix-the-australian-grand-prix-45802/45802/) (only laps ~53-58 and post-race came through) |
| AS-top10 | [Autosport, "Kimi Raikkonen's top 10 F1 races ranked"](https://www.autosport.com/f1/news/kimi-raikkonens-top-10-f1-races-ranked-japanese-gp-belgian-gp-and-more-5114475/5114475/) |
| MS | [Motor Sport, Nigel Roebuck, May 2013](https://www.motorsportmagazine.com/archive/article/may-2013/50/nigel-roebuck-4/) |
| GPE | [GrandPrix.com race notes](https://www.grandprix.com/races/australian-gp-2013-race-notes-raikkonen-wins-australian-gp.html) |
| Jolpica-r | [Jolpica results, 2013 round 1](https://api.jolpi.ca/ergast/f1/2013/1/results/) |
| Jolpica-p | [Jolpica pit stops, 2013 round 1](https://api.jolpi.ca/ergast/f1/2013/1/pitstops/?limit=100) |

AS-live and AS-top10 were read through a fetch tool that summarises; check their wording.

### Facts

| Topic | Fact | Sources | Owner checked |
|---|---|---|---|
| Grid | Vettel pole, Webber 2nd, Hamilton 3rd, Massa 4th, Alonso 5th, Rosberg 6th; Räikkönen 7th, Grosjean 8th. Qualifying was rained off on Saturday; Q2 and Q3 ran on Sunday morning. | WP, Jolpica-r | |
| Grid penalties | None for the front-runners. Pic was outside 107% in Q1 and started 22nd by the stewards' leave. Hülkenberg (grid 11) did not start: fuel system problem. | WP, Jolpica-r, AS-live | |
| Laps | 58 laps, 307.574 km (5.303 km lap). | WP, Jolpica-r | |
| Weather | Race dry ("Scattered Clouds, Fine and Dry", WP infobox); AS-live: temperatures "pretty low". Qualifying was wet. | WP, AS-live | |
| Tyres available | Super-soft and medium. | WP | |
| Safety car / VSC / red flag | None mentioned in WP, GPE or AS-live. No timing source checked (no OpenF1 for 2013). Treat as "none" only after a check. | WP, AS-live | |
| Start | Webber had an ECU problem and no KERS off the line; dropped to 7th (WP). Massa 2nd, Alonso 3rd (passed Hamilton at Turn 3), Räikkönen 5th, passed Hamilton for 4th on lap 2 at Turn 11. Vettel led by about 2 s after lap 1. | WP, AS-top10 | |
| Start tyres | The leaders started on super-softs; Sutil and Pérez started on mediums. Button switched super-soft → medium after 4 laps. | WP, AS-live | |
| Räikkönen stops | Two: laps 9 and 34 (Jolpica-p). After the first stop: mediums (WP: the quartet on "fresher mediums"). Final-stint compound: not in sources. Fastest lap on old tyres: lap 56 and "23rd lap on the same set" (WP); MS says the penultimate lap (57). **Conflict** on lap. | Jolpica-p, WP, MS, AS-top10, GPE | |
| Alonso stops | Three: laps 9, 20, 39. Lap 20 was an early second stop that jumped Sutil and Vettel, who stopped a lap later (WP). AS-live: he undercut Massa. Compounds after stop 1: not in sources. | Jolpica-p, WP, AS-live, AS-top10 | |
| Vettel stops | Three: laps 7, 21, 37. MS: "severe tyre graining problems". | Jolpica-p, WP, MS | |
| Massa stops | Three: laps 8, 23, 36. Stayed out too long at stop 2 and dropped back (WP); held up by Sutil, stopped early on lap 36 (WP). | Jolpica-p, WP | |
| Hamilton stops | Three: laps 13, 31, 42. Ran long hoping for two stops; Alonso passed him on lap 32 and he flat-spotted a tyre and pitted "immediately" (WP). **Conflict:** Jolpica has the stop on lap 31. Third stop when two stops would not work (WP). | Jolpica-p, WP | |
| Webber stops | Three: laps 5, 18, 38. Slow first stop (jack problem, WP). | Jolpica-p, WP | |
| Sutil stops | Two: laps 21 and 46. Started on mediums, led in the first part of the race; had to fit super-softs at the last stop (both compounds rule) and was passed by Hamilton and Webber on lap 51 (WP). | Jolpica-p, WP, AS-live | |
| Rosberg | One stop (lap 14), retired: electrical, 26 laps. | Jolpica-p, Jolpica-r, WP | |
| Gaps in the race | Räikkönen led Alonso by 16 s before his second stop (WP, "16 second lead"). Alonso closed to 4.4 s with 14 laps to go (AS-top10). Lap 53: 6.1 s (AS-live). Lap 55: over 8 s after Alonso nearly hit Pic's Caterham while lapping it (AS-live, WP). | WP, AS-top10, AS-live | |
| Result (top 6) | Räikkönen; Alonso +12.451; Vettel +22.346; Massa +33.577; Hamilton +45.561; Webber +46.800. Sutil 7th +1:05.068. Räikkönen two stops, next five three stops (GPE). | Jolpica-r, WP, GPE | |
| Retirements | Ricciardo 39 laps (Jolpica: hydraulics; WP: exhaust. **Conflict**); Rosberg 26 (electrical); Maldonado 24 (spun off at Turn 1, AS-live); Hülkenberg DNS. | Jolpica-r, WP, AS-live | |
| Penalties | None in the race found in the sources read. | WP, AS-live | |
| Contact | None reported. Vergne's failed attack on Grosjean at Turn 1 on lap 55 let Pérez through (AS-live). | AS-live | |
| Team orders | None mentioned. | WP, AS-live | |
| Plan | MS: two stops was "always the team's plan, should it look attainable" (Lotus). | MS | |

### Proposal

| Item | Proposal |
|---|---|
| Storyline drivers | Räikkönen (Lotus, two stops) and Alonso (Ferrari, three stops, early lap-20 undercut). |
| Dilemma (original wording) | Lotus is kind to its tyres: stretch Räikkönen to two stops while the Ferraris and Red Bulls stop three times. |
| Draft target | win: Räikkönen from P7. (If `pipeline hard-calls` picks Alonso: beat-rival Räikkönen.) |
| Side really won? | Räikkönen yes, so no rewrite. Alonso no (2nd, 12.451 s). |
| Risk | Medium. No timing source for SC status or compounds after stop 1; the both-compounds rule matters (Sutil); Webber's start, Rosberg's retirement and Hamilton's flat-spot stop (lap 31/32 conflict) need storyline handling. |

### Authored (B1, Nov 9)

Timing = Jolpica laps and stops (CC BY-NC-SA 4.0) in `data/raw/australia-2013.parquet`, as built
into `data/races/australia-2013.json` (Eras build, base `eras-swap-era6`).

- Robust G1 (`pipeline validate australia-2013 --robust`): **pass** (strict pass), mean gap
  error 1.74 s, before and after the overlay.
- Reachability (`pnpm --filter @laststint/sim reachability australia-2013`): **pass** at era
  difficulty (threshold 80, Smart rival) and at Legend (90, Expert rival): all three stars and
  the hidden objective on seed 1. The stay-out path earns no star on any seed.
- Moments (`pnpm --filter @laststint/sim author australia-2013 --target win --eras --write`):
  pace-29, stop-34 (real call box-hard, 87%), pace-41, pace-45 (`data/moments/australia-2013.json`).
  Takeover lap 17, after the first stops. The author tool lists no stop call for Alonso's lap-20
  or lap-39 stops (no tension for Räikkönen).

| Item | Value | Fact it rests on | Source | Owner checked |
|---|---|---|---|---|
| Side | RAI (hard calls RAI 2, ALO 0; `pipeline hard-calls`) | the grader, not a fact | - | |
| Target | `win` | Räikkönen won | Jolpica-r, WP | |
| Rewrite | none: the side really won | Räikkönen won | Jolpica-r, WP | |
| Storyline | "Sutil leads the middle of the race on a medium-tyre start" | Sutil started on mediums and led in the first part of the race; SUT P1 at the end of laps 16-17 | WP; Timing | |
| Storyline | "Räikkönen, seventh on the grid, makes his tyres last for two stops while Alonso, Vettel and Massa stop three times" | grid 7th; RAI stops 9, 34; ALO 9, 20, 39; VET 7, 21, 37; MAS 8, 23, 36 | Jolpica-r, Jolpica-p, GPE | |
| Storyline | "he wins by 12.451 s from Alonso" | Alonso +12.451 | Jolpica-r | |
| Briefing | "you run Räikkönen fifth after the first stops, behind Vettel, Massa and Alonso" | end of lap 17 (takeover): SUT, VET, MAS, ALO, RAI P1-P5 | Timing | |
| Briefing | "the Ferraris and Red Bulls will stop three times" | Alonso, Massa, Vettel, Webber three stops each | Jolpica-p | |
| Briefing | "Lotus wants two stops to work" | two stops "always the team's plan, should it look attainable"; Räikkönen two stops, next five three | MS; GPE | |
| Mastery | `margin` 12.5 s: "Win by more than 12.5 seconds" (beat the real margin) | Alonso +12.451 | Jolpica-r | |
| Hidden | `stop_count` exact 1 from the takeover: "Win on two stops in all" | Räikkönen's lap-9 stop is before the takeover; his real race was two stops (9, 34) | Jolpica-p | |
| storylineEvents | none | no safety car, VSC or red flag in the sources read; the three retirements (MAL, ROS, RIC) are not the side's story | WP, AS-live, GPE | |

## bahrain-2012 (2012 Bahrain Grand Prix; Era 6 #1, replaces australia-2010)

### Sources

| Short name | What |
|---|---|
| WP | [English Wikipedia race article](https://en.wikipedia.org/wiki/2012_Bahrain_Grand_Prix) (raw wikitext) |
| AS | [Autosport, "How Lotus finally delivered on its promise" (Adam Cooper, 23 Apr 2012)](https://www.autosport.com/f1/news/how-lotus-finally-delivered-on-its-promise-5098562/5098562/) |
| Jolpica-R | [Jolpica results](https://api.jolpi.ca/ergast/f1/2012/4/results.json) |
| Jolpica-P | [Jolpica pit stops](https://api.jolpi.ca/ergast/f1/2012/4/pitstops.json?limit=100) |

Not used: OpenF1 has no 2012 data; TUM covers 2014-2019 only. The GrandPrix.com 2012 race-notes
URL redirected to a current index page and its race report URL returned HTTP 429; the Motor Sport
database page has no report text. No Motor Sport race report was found.

### Facts

| Topic | Fact | Sources | Owner checked |
|---|---|---|---|
| Grid | Vettel pole (1:32.422), Hamilton 2nd, Webber 3rd, Button 4th, Rosberg 5th, Ricciardo 6th; Grosjean 7th, Pérez 8th, Alonso 9th, di Resta 10th, Räikkönen 11th (out in Q2, beaten by Grosjean's last lap). Alonso and di Resta set no Q3 time to save tyres. | WP, Jolpica-R | |
| Penalties (grid) | Maldonado and Schumacher five-place gearbox penalties (start 21st and 22nd). Vergne reprimanded (weighbridge). No penalties for the top 11. | WP | |
| Tyres available | Soft (option) and medium (prime). All but Kobayashi started on softs. Räikkönen saved a set of softs in qualifying (WP: he and Rosberg were the only top-nine drivers on softs on lap 21; AS: he was "on his second set of new options while most of his rivals had gone to primes"). | WP, AS | |
| Laps | 57. | WP, Jolpica-R | |
| Weather | Dry; "warm cloudy conditions", ambient 27 °C, track 32 °C at the start. | WP | |
| SC / VSC / red flag | None mentioned in WP's race account. No source states it explicitly; race-control data: not in sources. | WP | |
| Start / lap 1 | Top three held position; Webber had no KERS on lap 1. Grosjean, Alonso and Räikkönen gained; Ricciardo fell from 6th to 11th; Button to 6th. Vettel led by more than 2 s after lap 1. Kovalainen pitted after lap 1 with a puncture (possible contact with Ricciardo, who damaged his front wing). | WP | |
| Early passes | Grosjean passed Webber (lap 4) and Hamilton (lap 7) with DRS. Räikkönen passed Button (lap 7) and Alonso (lap 9). | WP | |
| Stops: Vettel | In-laps 11, 25, 39 (Jolpica-P). Last stint on mediums (WP); Lotus knew "he had a new set of primes in his pocket" (AS). Earlier compounds: not in sources. | Jolpica-P, WP, AS | |
| Stops: Räikkönen | In-laps 11, 24, 39. Second stint on new softs (AS, WP); last stint on mediums (WP). Lotus "thought about undercutting him" at the last stop but decided against it, partly because it was less confident in its pit stops than Red Bull (AS, Permane). | Jolpica-P, WP, AS | |
| Stops: others | Grosjean 10, 25, 40; Webber 9, 23, 39; Rosberg 8, 22, 36; di Resta 14, 33 (two-stop); Alonso 9, 23, 37; Hamilton 9, 23, 36. All top 10 on mediums after the last stops (WP). Compounds per stop: not in sources. | Jolpica-P, WP | |
| Hamilton's stops | Left-rear wheel-nut problem at both of the first two stops: 28.341 s (lap 9) and 30.622 s (lap 23, stationary ~12.2 s). WP: he lost about 15 s in the pits. | WP, Jolpica-P | |
| Räikkönen vs Vettel | Gap 4.2 s on lap 12 after the first stops, then came down (AS). Räikkönen caught Grosjean but needed time to pass; AS gives the pass at Turn 1 on lap 24, before his own stop. He was in DRS range of Vettel from lap 33 and tried the inside then the outside at Turn 1 on lap 36 without success. After the lap-39 stops the gap went from under 1 s to more than 3 s. | AS, WP | |
| Contact / stewards | Rosberg forced Hamilton (after lap 9 stops) and Alonso (around lap 23) wide before Turn 4; reviewed after the race; no penalty (WP: "lucky not to get penalised"). | WP | |
| Retirements | Maldonado lap 25 (left-rear puncture, spin); Pic 24 laps (engine); Senna 54 laps (vibration, classified); Button 55 laps (exhaust/differential, classified 18th; he had a left-rear puncture and pitted on lap 53 while chasing di Resta for 6th). | Jolpica-R, Jolpica-P, WP | |
| Team orders | None sourced. | | |
| Fuel | Vettel was told to stop at the pit exit after the flag, most likely due to low fuel (WP). | WP | |
| Result | Vettel 1:35:10.990; Räikkönen +3.333; Grosjean +10.194; Webber +38.788; Rosberg +55.460; di Resta +57.543 (held off Alonso +57.803). | Jolpica-R, WP | |

### Proposal (draft, for the owner)

| Item | Draft | Owner checked |
|---|---|---|
| Storyline drivers | Räikkönen (Lotus) and Vettel (Red Bull). | |
| Dilemma (original wording) | Räikkönen starts 11th with an extra new set of softs; Lotus can try an early last stop to jump Vettel, or match him and rely on raw pace. | |
| Suggested side | Räikkönen (pending `pipeline hard-calls`; Vettel is the other candidate). | |
| Target (draft) | win: Räikkönen from P11 (equivalently beat-rival Vettel). Fallback: position P2. | |
| Side really won? | No: Räikkönen finished 2nd, 3.333 s behind. A rewrite is allowed. | |
| Modelling risk | **Medium.** Dry, no SC or red flag sourced, real stop laps from Jolpica. Risks: per-stop compounds mostly not in sources (only the last stints and Räikkönen's second stint); new-vs-used set advantage drives the story; Hamilton's two slow stops (~6-8 s extra each) need scripting; Rosberg's defensive moves and Button's late puncture/retirement are storyline events; no OpenF1/TUM laps for 2012, so data comes from FastF1/Jolpica only. | |

### Not in sources

- Safety car / VSC status from race control (none mentioned, not stated).
- Compound for each stint except Räikkönen's 2nd stint and the top 10's last stints.
- Laps of Rosberg's moves on Hamilton and Alonso (only "after the lap-9 stops" and "lap 23" context).
- Gap between Räikkönen and Vettel at specific laps other than lap 12 (4.2 s) and after lap 39 (>3 s).

## malaysia-2013 re-authored (Era 6 #9, Webber; not swapped)

malaysia-2013 was authored but not reachable after the integration-8 rebuild (no path earned
★1). Re-authored on Nov 9 on a local Eras build (`pipeline build malaysia-2013`; robust G1
pass, 0.90 s). `pipeline hard-calls`: WEB 2, VET 1 (chance given up WEB 15.3, VET 35.3 pts), so
the side stays Webber. With `win`, the author tool's best option at each stop gave Webber a
win chance of 7-36%, and reachability found no winning path at either level. Following the
owner-accepted "position target when beating the draft rival is unreachable" pattern, the
target is now Webber's real result, P2.

- Target `position` 2 (was `win`). Rewrite stays `win` (Webber didn't really win). Headline
  unchanged: "Webber keeps Vettel behind and wins in Sepang".
- Mastery: stop_count exact 3, "Finish second or better on three more stops" (as Webber made).
  Hidden: compound_rule mustUse HARD, "Finish second or better with a stint on the hard tyre"
  (Webber's last stint was on hards).
- Briefing: last sentence now "Bring the car home second or better." (was "Stay ahead of
  Vettel to the flag.").
- Moments (`author malaysia-2013 --eras --target position:2 --write`): stop-19 (real
  box-soft), pace-24, stop-31 (real box-soft), pace-36, stop-43 (real box-hard).
- Storyline events: none (no SC; the wet start is weather, before the takeover).
- Reachability: PASS. Era (80, Smart): stop-19 box-soft, pace-24 push, stop-31 box-soft, pace-36
  push-attack, stop-43 box-hard, accuracy 100, seed 1. Legend (90, Expert): PASS, same path,
  seed 1. Stay-out: no ★3 at either level.

| Fact | Used in | Source | Owner checked |
|---|---|---|---|
| Vettel won, Webber P2 +4.298 s | target, storyline | earlier (6.2-eras7-4: JOL; WP) | |
| Webber's stops after the lap-16 takeover: out-laps 20, 32 (SOFT), 44 (HARD) | mastery, hidden, moments | earlier (6.2-reauthor-modern: RAW) | |
| Webber grid 5, Vettel pole; at lap 16 WEB P1, VET 2.4 s behind | briefing | earlier (6.2-reauthor-modern: JOL; RACE) | |
| Hold-position order after the last stops, Vettel's lap-46 pass | storyline | earlier (6.2-eras7-4: WP) | |

## Second round: four more Era 6 races (owner pre-approved, Nov 9)

The same pre-approval, a second time: the four Era 6 races that still fail or are borderline in
`docs/eras-races-report.md` (spain-2013, brazil-2012, abu-dhabi-2012, china-2011) each take a
new race picked by robust-G1 mean gap error, in the old race's slot (migration 0025, as 0019).
malaysia-2013 stays (re-authored above). Candidates were scouted on local Eras builds
(rules-only overlays); bahrain-2013, italy-2012, united-states-2012 and hungary-2013 failed
robust G1 and turkey-2011 (pass, 1.56 s) was the next pick not taken. Every fact below was read in
the linked source on Nov 9, 2026; nothing comes from memory. Check each row and put your
initials and the date in **Owner checked**.

| Era / slot | Removed | Why (robust G1, races report) | Replacement | Robust G1 of the replacement (Eras build, rules-only overlay) | Owner checked |
|---|---|---|---|---|---|
| 6 / #10 | `spain-2013` | Fails, 1.59 s (duel RAI vs ALO gap error 3.28 / 3.23 [3.00]); authored but not reachable since integration 8 | `abu-dhabi-2011` | pass, 0.87 s (new race) | |
| 6 / #8 | `brazil-2012` | Fails, 3.56 s (Vettel's last wet stint; duel VET vs ALO gap error 6.12 / 6.09 [3.00]) | `china-2013` | pass, 0.95 s (new race) | |
| 6 / #7 | `abu-dhabi-2012` | Fails, 1.72 s (duel VET vs BUT gap error 3.4 / 3.22 [3.00]) | `germany-2012` | pass, 1.24 s (new race) | |
| 6 / #3 | `china-2011` | Borderline, 1.47 s (podium order rate 0.49 [0.50]) | `germany-2013` | pass, 1.25 s (new race) | |

The removed races' numbers are from `docs/eras-races-report.md`. The replacements' numbers were
measured on local builds (`pipeline build <id>`, then `pipeline validate <id> --robust`, one race
per call, Nov 9; the same on the scouting builds and on this branch's rebuilds). Race files,
goldens and `races.gen.ts` are left for the integrator to rebuild and commit. The removed
races keep their overlays (spain-2013 and china-2011 authored), race files, tracks, build
entries and incidents as Eras-build fixtures.

**Sides.** Local `pipeline hard-calls` runs (written to a scratch directory, not to the
overlays): abu-dhabi-2011 HAM 3, ALO 1; china-2013 ALO 2, RAI 1; germany-2012 BUT 2, VET 0;
germany-2013 RAI 1, VET 0. The overlays stay rules-only: side, target, storyline, mastery,
hidden objective and briefing come in B1. The proposals below are drafts; where a proposal's
side differs from the hard-call side, the note above it says so.

**Wording check needed:** china-2013's Autosport and Motor Sport rows came through a fetch tool
that summarises pages. Check their wording against the pages.

**Track status:** none of the four has an OpenF1 session or TUM data. abu-dhabi-2011,
china-2013 and germany-2012: no safety car rests on the race reports and on the Jolpica SC
estimate (no periods). germany-2013: the estimate finds one SC, laps 24-29 (`likely`,
`data/estimates/germany-2013.sc.json`, left `unchecked`), against lap 23 (WP) or 22 (MS) in
the sources, whose end lap no source gives; check it against a race-control source before
confirming.

## abu-dhabi-2011 (2011 Abu Dhabi Grand Prix; Era 6 #10, replaces spain-2013)

**Side and target.** `pipeline hard-calls` (local run): HAM 3, ALO 1 (chance given up HAM 1.7, ALO 108.0 pts), so the race is drafted from Hamilton's side, not the Alonso draft in the proposal below. Hamilton really won, so no rewrite. Spec §4 draft: "Three seconds clear of Alonso on the same tyres: box first for the last stint to cover the undercut, or stay out and risk Ferrari going longer"; target `defend: Hamilton holds P1` (Hamilton leads at the lap-13 takeover in the local build). The 3 s and "same tyres" are the computed 3.2 s at the end of lap 39 (GPE: 3.1 s) and both cars' soft second stints (GPE). In the facts below, gaps marked "computed" are sums of Jolpica lap times, not a published figure; "not in sources" means no opened source gave the number.

### Facts

| Topic | Facts verified | Sources | Owner checked |
|---|---|---|---|
| Grid top 6 | Vettel pole (1:38.481, on his last lap), Hamilton 2nd (1:38.622), Button 3rd (1:38.631), Webber 4th (1:38.858), Alonso 5th (1:39.058), Massa 6th (1:39.695); Rosberg 7th, Schumacher 8th, Sutil 9th, di Resta 10th. Vettel's 14th pole of the season, equalling Mansell's 1992 record (WP; GPE: 14th pole). Qualifying had a red flag for a loose bollard Massa drove over (WP). | WP, GPE, Jolpica | |
| Grid penalties | Maldonado ten places for his ninth engine of the season, started 23rd. Barrichello set no time (oil leak) but was allowed to start 24th (WP; Jolpica grid MAL 23, BAR 24). No penalties in the top 6. | WP, Jolpica | |
| Race laps, weather | 55 laps, 305.470 km. Fine and dry, air 25 °C (WP infobox). No source mentions rain. Twilight race (AS live). | WP, AS live | |
| Tyres at the start | The front nine started on softs; di Resta (10th) started on mediums (GPE). Compound for the final stints: GPE says "medium"; AS live calls Webber's last-lap tyre "hard". **Sources differ on the name; GPE's medium is taken.** | GPE, AS live | |
| Start and lap 1 | Vettel led into Turn 1, then spun at Turn 2 with a punctured right-rear tyre; he got back to the pits with damage and retired (WP, GPE; Jolpica: 1 lap, "Puncture"). Cause not established: Horner suspected debris, Pirelli found none on a circuit walk (GPE news). Hamilton led from there. Alonso passed Webber on the outside and Button under braking for 2nd; Button kept 3rd (GPE). Computed end of lap 1: Alonso +2.6 s, Button +3.3 s, Webber +3.9 s. | WP, GPE, GPE news, Jolpica | |
| First stint | Gaps (GPE): lap 5 Alonso 2.7 s, Button 5.7 s, Webber 6.9 s; lap 15 Alonso 1.9 s, Button 12.3 s, Webber 13.1 s. Button reported a KERS problem around lap 12, working again by lap 32 (GPE); his pace on the soft was poor (GPE). Webber and Button side by side on lap 15; Button held (GPE). | GPE, Jolpica | |
| Stops: Hamilton | Two stops. Jolpica pit data: laps 16 and 40 (stationary-plus-lane 19.439 s and 19.350 s). GPE reports them as laps 17 (softs) and 40 (mediums). | Jolpica, GPE | |
| Stops: Alonso | Two stops. Jolpica: laps 16 and 43 (20.211 s, 21.314 s). GPE: lap 17 (softs), lap 44 (from the lead, rejoined behind Hamilton). Computed: 3.2 s behind at the end of lap 39 (GPE: closed to 3.1 s on lap 39); led by about 20 s while Hamilton stopped; rejoined 4.5 s behind at the end of lap 44 (GPE: 4.4 s). He ran three laps longer on softs and gained nothing. | Jolpica, GPE | |
| Stops: Button | Two stops. Jolpica: laps 16 and 36. GPE: lap 17 (softs), lap 37 from third (mediums). | Jolpica, GPE | |
| Stops: Webber (three stops) | Jolpica: laps 17, 35 (no duration listed), 54. GPE: lap 18 from the lead with a slow 9.4 s stop (Jolpica duration 25.182 s, the slowest of the leaders' first stops); lap 35 from 5th onto softs again; the mandatory medium on the final lap (GPE; AS live: one lap on the other compound), rejoining 4th behind Button. Fastest lap 1:42.612 on lap 51 (WP, GPE results). Computed: 9.7 s ahead of Button at lap 51 (AS live) was not enough; finished 9.9 s behind him. | Jolpica, GPE, AS live, WP | |
| Stops: Massa, Rosberg | Massa: Jolpica laps 15 and 40 (GPE 16 softs, 40). Rosberg: Jolpica 17 and 48 (GPE 18, 49). | Jolpica, GPE | |
| Second stint | Computed Hamilton-Alonso gap: 3.4 s (lap 18), 5.1 s (lap 30), 3.2 s (lap 39). Alonso set 1:44.2 on lap 33 (GPE). After the stops: 6.0 s on lap 50 (GPE), 8.457 s at the flag. | Jolpica, GPE | |
| SC / VSC / red flag | None in the race. No opened source reports a safety car or red flag (VSC did not exist in 2011). Red flag in qualifying only (WP). | WP, GPE | |
| Penalties | **Sources differ.** WP: Maldonado 30 s and Alguersuari 20 s time penalties for ignoring blue flags, neither changing a position. GPE: Maldonado drive-through (lap 32) and Senna drive-through (lap 38), both for blue flags. AS live: Maldonado ignored blue flags. None involves the top 6. | WP, GPE, AS live | |
| Contact / team orders | No car-to-car contact reported among the front-runners (GPE). Massa hit a winglet dropped by another car on lap 45 and spun on lap 49, continuing (GPE). No team orders reported. | GPE | |
| Retirements | Vettel lap 1 (puncture), d'Ambrosio 18 laps (brakes), Buemi 19 laps (hydraulics; GPE: retired in the pit lane on lap 21), Ricciardo 48 laps (alternator; Jolpica "Mechanical"; GPE lap 52, AS live lap 53). | Jolpica, WP, GPE, AS live | |
| Result top 6 | Hamilton 1:37:11.886; Alonso +8.457; Button +25.881 (Jolpica, GPE; WP +25.871); Webber +35.784; Massa +50.578; Rosberg +52.317. Only race of 2011 with no Red Bull on the podium (WP). | Jolpica, GPE, WP | |

### Strategy dilemma

- **Alonso / Ferrari:** 2-4 s behind Hamilton all race on the same two-stop plan. Both stopped
  together on lap 16. For the second stop Hamilton went first (in-lap 40); Ferrari kept Alonso
  out three more laps on old softs (in-lap 43) and he came out 4.5 s behind (computed). Undercut
  (stop first, or stop on lap 39-40 with Hamilton) versus overcut was the call.
- **Hamilton / McLaren:** leading with Alonso 3 s back, box first for mediums to cover an
  undercut (the real call), or stay out and risk Alonso's softs.
- **Webber / Red Bull:** three stops on softs, mediums only on the final lap; lost the lead
  phase to a 9.4 s stop (GPE) and ended 4th, about 10 s behind Button's two-stop.
- **Button:** two stops with KERS trouble; held 3rd.

### Proposal (draft, for the owner)

| Item | Proposal |
|---|---|
| Storyline drivers | Alonso and Hamilton |
| Dilemma (original wording) | Three seconds behind on the same tyres: does Alonso jump first for the final stint, or stay out and hope Hamilton's new mediums are slow to wake up? |
| Side | Alonso (to be confirmed by `pipeline hard-calls`; Webber's soft-tyre three-stop is the alternative side) |
| Target (draft) | win: Alonso from P5, beating Hamilton at the second stops |
| Did the side really win? | No. Alonso was 2nd, 8.457 s behind, so a rewrite (history book) is allowed. (If the side is Hamilton, he really won: no rewrite.) |
| Modelling risk | **Medium** |

**Why medium risk:**
- **Pole-sitter out on lap 1:** Vettel's puncture must be scripted (storyline retirement, cause
  unconfirmed in sources).
- **Win needs ~8.5 s:** Alonso's real gap at the flag; reachable only if an earlier second stop
  is worth several seconds in the model. Reachability must be checked.
- **Slow stop:** Webber's 9.4 s stop (GPE) shapes the P3-P5 order.
- **Lap numbering:** GPE stop laps are mostly one higher than Jolpica's pit data; Jolpica taken.
- **Compound name:** medium (GPE) versus hard (AS live).
- Not flagged: rain, safety car / VSC / red flag (none), team orders (none), contact at the front.

### Sources

| Short name | What |
|---|---|
| WP | [English Wikipedia, 2011 Abu Dhabi Grand Prix](https://en.wikipedia.org/wiki/2011_Abu_Dhabi_Grand_Prix) (text and infobox) |
| GPE | [GrandPrix.com race notes](https://www.grandprix.com/races/abu-dhabi-gp-2011-race-notes-hamilton-wins-abu-dhabi-gp.html) and [results](https://www.grandprix.com/races/abu-dhabi-gp-2011-race-results.html) |
| GPE news | [GrandPrix.com, "Pirelli investigates Vettel failure"](https://www.grandprix.com/news/pirelli-investigates-vettel-failure.html) |
| AS live | [Autosport live text](https://www.autosport.com/f1/live-text/2011-abu-dhabi-grand-prix-the-abu-dhabi-grand-prix-45976/45976/) (laps 51-55 only) |
| Jolpica | [Results](https://api.jolpi.ca/ergast/f1/2011/18/results/), [pit stops](https://api.jolpi.ca/ergast/f1/2011/18/pitstops/?limit=100) and lap times (`api.jolpi.ca/ergast/f1/2011/18/drivers/<id>/laps/`, hamilton, alonso, button, webber), fetched 2026-11-09 |

Not used: the Motor Sport report URL returned 404; an Autosport "post-race press conference: Abu
Dhabi" page turned out to be 2010 and was discarded.

### Authored content (B1, Nov 9)

Eras job B1, built and checked on branch `eras-author-abu-dhabi-2011-p3` (base
`eras-swap-era6-p3`). Storyline and briefing are original wording; no team radio is quoted.
Every fact rests on a row in **Facts** above (read Nov 9, 2026) or on the race's timing.

- Robust G1 (`pipeline validate abu-dhabi-2011 --robust`, Eras build of this branch): **pass**
  (strict), mean gap error 0.87 s (same figure as the swap job).
- Side (`pipeline hard-calls abu-dhabi-2011`): HAM 3, ALO 1 (chance given up HAM 1.7, ALO 108.0
  pts). Hamilton really won, so no rewrite.
- Reachability (`pnpm --filter @laststint/sim reachability abu-dhabi-2011`): **pass** at era
  difficulty (threshold 80, Smart rival) and at Legend (90, Expert rival): all three stars and
  the hidden objective on seed 1 (rivalpit-16 box-hard, pace-21 standard, cliff-26 stay, stop-40
  box-soft at era difficulty; stop-40 stay at Legend). The stay-out path never earns ★1 or ★3 at
  either level, nor the hidden objective (it can earn ★2).
- Moments (`pnpm --filter @laststint/sim author abu-dhabi-2011 --target win --eras --write`):
  rivalpit-16, pace-21, cliff-26 (`data/moments/abu-dhabi-2011.json`), plus **stop-40 added by
  hand** (the spec's dilemma: box first to cover Alonso, or stay out). The tool graded stop-40
  "no-choice" (stay 100%, box-soft 100%, box-hard and box-next-hard 98%); it is kept so the
  real second stop can be played. Real options: rivalpit-16 box-hard, cliff-26 stay, stop-40
  box-soft; pace-21 has none. Takeover lap 13 (build): Hamilton P1, Alonso P2 2.347 s behind,
  both on 13-lap-old softs.
- **Compounds in the model differ from the sources.** The build's compound estimate (no tyre
  data for 2011) gives Hamilton soft, then the prime (labelled HARD) from lap 17, then soft from
  lap 41; GPE has softs at the first stop and mediums at the second. So the real options above
  are "Box, hards" on lap 16 and "Box, softs" on lap 40. The storyline and briefing name no
  compound after the start for this reason. A tyre-facts override for dry compounds would be
  model work (B3); not done here.

| Item | Value | Fact it rests on | Source | Owner checked |
|---|---|---|---|---|
| Side | HAM (hard calls HAM 3, ALO 1; `pipeline hard-calls`) | the grader, not a fact | - | |
| Target | `defend` (spec §4: "defend: Hamilton holds P1") | Hamilton led from lap 1 after Vettel's retirement and won | WP, GPE, Jolpica | |
| Rewrite | none: the side really won | Hamilton 1st, Alonso +8.457 | Jolpica, GPE | |
| Storyline | "Vettel leads into the first corner from pole, then spins at Turn 2 with a punctured right-rear tyre and is out on the first lap" | Vettel pole; led into Turn 1, spun at Turn 2 with a punctured right-rear, retired (Jolpica: 1 lap, "Puncture") | WP, GPE, Jolpica | |
| Storyline | "so Hamilton leads with Alonso second" | Hamilton led from there; Alonso passed Webber and Button for 2nd | GPE | |
| Storyline | "Both make their first stop on lap 16" | Jolpica pit data: HAM and ALO lap 16 (GPE: lap 17) | Jolpica, GPE | |
| Storyline | "McLaren bring Hamilton in again on lap 40; Ferrari keep Alonso out three laps longer on old tyres, and he rejoins more than four seconds behind" | Jolpica: HAM lap 40, ALO lap 43; rejoined 4.5 s behind (computed) / 4.4 s (GPE); "ran three laps longer on softs" | Jolpica, GPE | |
| Storyline | "Hamilton wins by 8.457 s, and for the only time in 2011 no Red Bull is on the podium" | Alonso +8.457; only race of 2011 with no Red Bull on the podium | Jolpica, GPE, WP | |
| Briefing | "Vettel's pole came to nothing: a right-rear puncture put him out on the first lap" | as above | WP, GPE, Jolpica | |
| Briefing | "leading after 13 laps, 2.3 s clear of Alonso's Ferrari, both on softs" | build state at takeover (lap 13): HAM P1, ALO P2 2.347 s (sum of Jolpica lap times); the front nine started on softs and neither stopped before lap 16 | build, Jolpica, GPE | |
| Mastery | `margin` 8 s: "Win by more than 8 seconds" | Alonso +8.457 (8.5 s was not reached at Legend; 8 s was) | Jolpica | |
| Hidden | `mode_rule` push at most 0 laps: "Win without a single push lap" (as bahrain-2012) | the game's choice | - | |
| storylineEvents | none | Vettel's retirement is before the takeover; no SC, VSC or red flag; the retirements after the takeover (d'Ambrosio, Buemi, Ricciardo) are not part of the story | WP, GPE, Jolpica | |

Rejected objectives (reachability): mastery `margin` 8.5 s (met at era difficulty, not at
Legend); hidden `stop_count` exact 2 (the stay-out path met it too).

`data/races/abu-dhabi-2011.json`, its golden and `races.gen.ts` are for the integrator to
rebuild (`pipeline build abu-dhabi-2011`); this branch does not commit them.

## china-2013 (2013 Chinese Grand Prix; Era 6 #8, replaces brazil-2012)

**Side and target.** `pipeline hard-calls` (local run): ALO 2, RAI 1 (chance given up ALO 1.7, RAI 1.7 pts), so the race is drafted from Alonso's side, not the Vettel draft in the proposal below. Alonso really won, so no rewrite. Spec §4 draft: "Ferrari's softs last only a handful of laps: commit Alonso to three stops and find a way past the cars running long on mediums"; target `win: Alonso from P3`. Sourced in the facts below: soft "guaranteed a pitstop within a handful of laps" (MS), Alonso's three stops and soft start, Vettel and Hülkenberg starting on mediums, Alonso fast through traffic on mediums (AS). OpenF1 has no 2013 data and TUM starts in 2014, so there is no timing source for track status or per-stint compounds. No GrandPrix.com 2013 race report or notes page was found by search; the Autosport live-text archive (live.autosport.com) refused the connection.

### Sources

| Short name | What |
|---|---|
| WP | [English Wikipedia race article](https://en.wikipedia.org/wiki/2013_Chinese_Grand_Prix) (raw wikitext read) |
| AS | [Autosport race report, "Chinese GP: Alonso takes commanding victory for Ferrari"](https://www.autosport.com/f1/news/chinese-gp-alonso-takes-commanding-victory-for-ferrari-4464410/4464410/) |
| MS | [Motor Sport, Nigel Roebuck, June 2013](https://www.motorsportmagazine.com/archive/article/june-2013/50/nigel-roebuck/) |
| Jolpica-r | [Jolpica results, 2013 round 3](https://api.jolpi.ca/ergast/f1/2013/3/results/) |
| Jolpica-q | [Jolpica qualifying, 2013 round 3](https://api.jolpi.ca/ergast/f1/2013/3/qualifying/) |
| Jolpica-p | [Jolpica pit stops, 2013 round 3](https://api.jolpi.ca/ergast/f1/2013/3/pitstops/?limit=100) |

AS and MS were read through a fetch tool that summarises; check their wording.

### Facts

| Topic | Fact | Sources | Owner checked |
|---|---|---|---|
| Grid | Hamilton pole (1:34.484), Räikkönen 2nd, Alonso 3rd, Rosberg 4th, Massa 5th, Grosjean 6th; Ricciardo 7th, Button 8th (token Q3 lap, 2:05.673), Vettel 9th and Hülkenberg 10th (no Q3 time). | WP, Jolpica-q, Jolpica-r | |
| Q3 tyre choice | Mercedes, Lotus, Ferrari and Toro Rosso used the soft and took the top seven places; Red Bull, McLaren and Sauber ran mediums in Q3 and set no time (MS). WP: Vettel aborted his lap after a braking problem; Hülkenberg saved tyres. **Conflict:** Button has a Q3 time (token lap) in WP/Jolpica. | MS, WP, Jolpica-q | |
| Grid penalties | Webber (14th in qualifying) ran out of fuel in Q2, could not give the 1-litre sample, was sent to the back; Red Bull then changed his gearbox, so he started from the pit lane. No penalties for the top 6. | WP | |
| Laps | 56 laps, 305.066 km (5.451 km lap). | WP, Jolpica-r | |
| Weather | Cloudy (WP infobox); dry (AS). Temperatures: not in sources. | WP, AS | |
| Tyres available | Medium (prime) and soft (option). MS: soft about 1.5 s a lap quicker in qualifying but "guaranteed a pitstop within a handful of laps". | WP, MS | |
| Safety car / VSC / red flag | None mentioned in WP, AS or MS. No timing source checked. Treat as "none" only after a check. | WP, AS | |
| Start tyres | Alonso, Räikkönen, Hamilton, Massa on softs; Vettel and Hülkenberg on mediums. Button: not in sources (MS: mediums in Q3). | AS, MS | |
| Start | Hamilton led; Alonso, Massa, then a slow-starting Räikkönen. Webber pitted at the end of lap 1. Alonso and Massa passed Hamilton together at Turn 1: lap 4 (WP), lap 5 (AS). **Conflict.** | WP, AS, Jolpica-p | |
| Alonso stops | Three: laps 6, 23, 41 (Jolpica-p; WP same). Switched to mediums after the soft stint; fast through traffic on mediums (AS). Passed Vettel for the lead on lap 28 (WP). Compound per stop: not in sources. | Jolpica-p, WP, AS | |
| Räikkönen stops | Three: laps 6, 21, 34 (Jolpica-p; WP same). Compounds: not in sources. | Jolpica-p, WP | |
| Hamilton stops | Three: laps 5, 21, 37 (Jolpica-p; WP mentions 21 and 37). Softs "faded quicker" (AS). Brawn: rubber marbles on the front wing caused understeer until they fell off (MS). | Jolpica-p, WP, AS, MS | |
| Vettel stops | Two: laps 14, 31 (Jolpica-p), 51. **Conflict:** WP has the second stop on lap 29 ("new hard compound tyres"); Jolpica has Hülkenberg, not Vettel, on lap 29. Ran mediums and left the softs to the final five laps (AS). Led after the lap-23 stops until Alonso passed him on lap 28 (WP). | Jolpica-p, WP, AS | |
| Massa stops | Three: laps 7, 19, 36. Stayed out one lap longer than most, then faded (AS). | Jolpica-p, WP, AS | |
| Button stops | Two: laps 23 and 49 (two-stop strategy, AS). McLaren told him to race Vettel, not the leaders (MS). | Jolpica-p, WP, AS, MS | |
| Hülkenberg | Led after the lap 6-7 stops on Vettel's strategy (WP, AS). Stops 14, 29, 36; slow stop and a very short middle stint on softs, finished 10th (AS). | Jolpica-p, WP, AS | |
| End of race | Vettel closed a 10 s gap to Hamilton to a few tenths within five laps (WP); about 3 s a lap after his late stop (AS); Hamilton held 3rd by 0.203 s. Fastest lap: Vettel 1:36.808, lap 53 (WP infobox). | WP, AS, Jolpica-r | |
| Result (top 6) | Alonso 1:36:26.945; Räikkönen +10.168; Hamilton +12.322; Vettel +12.525; Button +35.285; Massa +40.827. Ricciardo 7th +42.691. | Jolpica-r, WP, AS | |
| Retirements | Gutiérrez 4 laps (ran into the back of Sutil at the hairpin, lap 5 per WP); Sutil 5 laps (damage; exhaust fire in the pits, WP); Webber 15 laps (right-rear wheel came off at the hairpin after a lap-14 stop following contact with Vergne); Rosberg 21 laps (suspension). | Jolpica-r, WP | |
| Contact | Di Resta and Sutil touched on lap 1, no damage; Gutiérrez into Sutil; Webber into Vergne (lap 14); Räikkönen nudged Pérez's McLaren (lap 15, WP) and tore his nose but did not pit for it (WP, AS). | WP, AS | |
| Penalties | Webber's pit-lane start only. No in-race penalties found. | WP | |
| Team orders | None found. WP reports a radio instruction to Vettel not to resist Alonso's attack (not quoted here). | WP | |

### Proposal

| Item | Proposal |
|---|---|
| Storyline drivers | Vettel (Red Bull, medium-medium-soft, two stops from P9) and Alonso (Ferrari, soft start, three stops from P3). |
| Dilemma (original wording) | Start on the long-lasting medium and save the soft for a short sprint at the end: when do you bolt it on to catch the podium? |
| Draft target | position: Vettel P3 or better (finished 4th, 0.203 s short). If `pipeline hard-calls` picks Alonso: win from P3. |
| Side really won? | Vettel no (4th), so a rewrite is allowed. Alonso yes (won by 10.168 s), so no rewrite. |
| Risk | Medium. No timing source for SC status or compounds per stint; Vettel's second-stop lap conflicts (29 WP / 31 Jolpica); Räikkönen's nose damage, Hamilton's marbles and four retirements (incl. Webber's wheel, Rosberg) need storyline handling; the both-compounds rule shapes Vettel's soft stint. |

## germany-2012 (2012 German Grand Prix; Era 6 #7, replaces abu-dhabi-2012)

**Side and target.** `pipeline hard-calls` (local run): BUT 2, VET 0 (chance given up BUT 2.0, VET 22.3 pts), so Button, as proposed. Button did not win (P2, 6.949 s behind Alonso), so a rewrite is allowed. Spec §4 draft: the proposal's dilemma, lightly reworded; target `win: Button from P6`. The build notes Vettel's 20 s post-race penalty (and Button's +2.268 s difference against the summed laps) as quirks: the laps order is used.

### Sources

| Short name | What |
|---|---|
| WP | [English Wikipedia race article](https://en.wikipedia.org/wiki/2012_German_Grand_Prix) (raw wikitext) |
| AS-race | [Autosport, "Fernando Alonso holds off Vettel and Button to take third win of 2012 in the German GP"](https://www.autosport.com/f1/news/fernando-alonso-holds-off-vettel-and-button-to-take-third-win-of-2012-in-the-german-gp-4456411/4456411/) (provisional results table) |
| AS-quali | [Autosport, "Fernando Alonso grabs pole at wet Hockenheim ahead of German Grand Prix"](https://www.autosport.com/f1/news/fernando-alonso-grabs-pole-at-wet-hockenheim-ahead-of-german-grand-prix-4456471/4456471/) |
| AS-pen | [Autosport, "Sebastian Vettel's German Grand Prix penalty came after FIA warning over off-track moves"](https://www.autosport.com/f1/news/sebastian-vettels-german-grand-prix-penalty-came-after-fia-warning-over-off-track-moves-4456335/4456335/) |
| AS-pit | [Autosport, "McLaren bullish after new pitstop record during the German Grand Prix"](https://www.autosport.com/f1/news/mclaren-bullish-after-new-pitstop-record-during-the-german-grand-prix-4456362/4456362/) |
| GPE | [GrandPrix.com, "Race Report - Alonso wins tight Hockenheim battle"](https://www.grandprix.com/races/german-gp-2012-race-report-alonso-wins-tight-hockenheim-battle.html) |
| Jolpica-R | [Jolpica results](https://api.jolpi.ca/ergast/f1/2012/10/results.json) |
| Jolpica-P | [Jolpica pit stops](https://api.jolpi.ca/ergast/f1/2012/10/pitstops.json?limit=100) |

Not used: OpenF1 has no 2012 data; TUM covers 2014-2019 only. Motor Sport has only a database
page for this race (no report text found). The Autosport live commentary (live.autosport.com,
id 497) refused the connection and its web.archive.org copy could not be fetched, so nothing
from it is used (a search-result summary of it is not counted as a source).

### Facts

| Topic | Fact | Sources | Owner checked |
|---|---|---|---|
| Qualifying | Wet: Q1 fully dry, rain arrived just before Q2 (AS-quali). Alonso pole 1:40.621; Vettel 1:41.026; Webber 1:41.496; Schumacher 1:42.459; Hülkenberg 1:43.501; Maldonado 1:43.950; Button 1:44.113; Hamilton 1:44.186; di Resta 1:44.889; Räikkönen 1:45.811. | AS-quali, WP | |
| Grid (after penalties) | Alonso 1, Vettel 2, Schumacher 3, Hülkenberg 4, Maldonado 5, Button 6; Hamilton 7, Webber 8, di Resta 9, Räikkönen 10, Kobayashi 12, Pérez 17, Grosjean 19, Rosberg 21. | WP, Jolpica-R | |
| Grid penalties | Webber, Rosberg, Grosjean: five places each for gearbox changes. Pérez: five places for impeding Alonso and Räikkönen in Q2. | WP, AS-quali | |
| Laps | 67 (306.458 km). | WP, Jolpica-R | |
| Weather (race) | Dry; "dry and sunny" on the grid, air 20-21 °C, track 30-32 °C (infobox: "Fine and Dry", air 22 °C, track 30 °C). | WP | |
| Tyres | Pirelli medium (prime) and soft (option). Alonso led the first stint on softs; Alonso and Vettel changed to mediums at the first stops. Schumacher's last stint was on fresh softs. Other compounds per stint: not in sources. | WP, AS-race | |
| SC / VSC / red flag | None mentioned in GPE, AS-race or WP. No source states it explicitly; race-control data: not in sources. | GPE, AS-race | |
| Lap 1 | Hamilton, Massa, Senna and Grosjean delayed in first-lap incidents (contact or debris) and pitted early (AS-race). Hamilton's puncture came from debris from Massa's front wing (GPE). Jolpica-P: Massa, Senna, Grosjean in on lap 1, Hamilton lap 3. | AS-race, GPE, Jolpica-P | |
| Stops: Alonso | In-laps 18, 41 (two stops). | Jolpica-P | |
| Stops: Vettel | In-laps 20, 41. | Jolpica-P | |
| Stops: Button | In-laps 19, 40. Stopped one lap before Vettel at the final stops (AS-race); McLaren's 2.31 s stationary time (FIA timed 2.4 s) was "decisive to get past Vettel" (AS-pit); GPE: the early second stop from third, with the record stop, moved him ahead of Vettel into 2nd. | Jolpica-P, AS-race, AS-pit, GPE | |
| Stops: others | Räikkönen 11, 38; Kobayashi 22, 43; Pérez 17, 40 (first stop earlier than planned, GPE); Webber 12, 40; Schumacher 14, 36, 52 (three stops); Hülkenberg 12, 31, 46; Rosberg 12, 32, 50; Hamilton 3, 31, 47. | Jolpica-P, GPE, AS-race | |
| Button's race | Passed Schumacher and Hülkenberg early; gained on the leaders when Hamilton unlapped himself from Vettel; after the final stops held off Vettel at the hairpin and chased Alonso. | AS-race | |
| Hamilton | After his puncture and second stop he rejoined just behind the leaders, unlapped himself by passing Vettel into the Turn 6 hairpin and ran wheel-to-wheel with Alonso (GPE). Retired, puncture: 56 laps (Jolpica-R, WP); AS-race's provisional table says lap 58. The only retirement (GPE). | GPE, Jolpica-R, WP, AS-race | |
| Vettel's pass and penalty | On the penultimate lap Vettel went round the outside of Button into the hairpin and used the run-off on the exit to pass. Stewards added 20 s to his race time (instead of a drive-through) for not using the track "at all times", dropping him from 2nd to 5th; Räikkönen inherited 3rd. | AS-pen, AS-race, GPE, WP | |
| Other | Räikkönen was delayed early behind Hamilton, letting di Resta past (GPE). Maldonado had high tyre wear and fell to 15th (AS-race). Webber struggled on the prime (GPE). | GPE, AS-race | |
| Team orders | None sourced. | | |
| Result | Alonso 1:31:05.862; Button +6.949 (Jolpica-R, AS-race; WP says +6.931); Räikkönen +16.409; Kobayashi +21.925; Vettel +23.732 (road gap +3.732 before the 20 s, AS-race); Pérez +27.896; Schumacher +28.970 (AS-race provisional +28.960); Webber +46.941. | Jolpica-R, WP, AS-race | |

### Proposal (draft, for the owner)

| Item | Draft | Owner checked |
|---|---|---|
| Storyline drivers | Button (McLaren) and Alonso (Ferrari); Vettel is the third car in the fight. | |
| Dilemma (original wording) | Button sits third behind Alonso and Vettel: McLaren can bring the last stop forward a lap to jump the Red Bull, then has to find a way past the Ferrari on fresher tyres. | |
| Suggested side | Button (pending `pipeline hard-calls`; Alonso and Vettel are the other candidates). | |
| Target (draft) | win: Button from P6 (beat Alonso). Fallback: position P2 or better on the road (beat Vettel without relying on his penalty). | |
| Side really won? | No: Button was classified 2nd, 6.949 s behind Alonso (and was 3rd on the road before Vettel's penalty). A rewrite is allowed. | |
| Modelling risk | **Medium.** Dry race, no SC/red flag mentioned, real stop laps from Jolpica, two-stop leaders. Risks: compounds known only for Alonso/Vettel's first two stints and Schumacher's last stint; the gaps between the leaders during the race are not in sources (only "never a huge lead"); Vettel's 20 s post-race penalty must be applied as a storyline event or his road finish modelled; Hamilton's unlapping and lap-1 debris stops (Massa, Senna, Grosjean, Hamilton) need scripting; the 2.31 s record stop vs normal stop loss sets the undercut margin. Qualifying was wet but the race dry, so no wet model is needed. | |

### Not in sources

- Safety car / VSC status from race control (none mentioned, not stated).
- Tyre compound for each stint, except Alonso's and Vettel's soft-then-medium and Schumacher's final softs.
- Gaps between Alonso, Button and Vettel at any lap during the race.
- The lap Hamilton unlapped himself; the lap of Hamilton's puncture beyond "opening lap" (pit in-lap 3, Jolpica).
- Fuel figures (no refuelling in 2012).

## germany-2013 (2013 German Grand Prix; Era 6 #3, replaces china-2011)

**Side and target.** `pipeline hard-calls` (local run): RAI 1, VET 0 (chance given up RAI 7.0, VET 5.7 pts), so Räikkönen, as proposed. Räikkönen did not win (P2, 1.008 s behind Vettel), so a rewrite is allowed. Spec §4 draft: the proposal's dilemma with "ageing mediums" changed to "ageing tyres" (his middle-stint compound is not in the sources); target `win: Räikkönen from P4`. The safety car is entered in `data/incidents.json` at the built model's lap 24 (sources: lap 23 WP, lap 22 MS); the SC estimate stays unchecked.

### Sources

| Short name | What |
|---|---|
| WP | [English Wikipedia race article](https://en.wikipedia.org/wiki/2013_German_Grand_Prix) (raw wikitext) |
| MS | [Motor Sport, "2013 German Grand Prix report"](https://www.motorsportmagazine.com/articles/single-seaters/f1/2013-german-grand-prix-report/) |
| AS-K | [Autosport, "Raikkonen suspects last stop not needed"](https://autosport.com/f1/news/108644/raikkonen-suspects-last-stop-not-needed) |
| AS-V | [Autosport, "Sebastian Vettel says Nurburgring win a huge relief"](https://www.autosport.com/f1/news/german-gp-sebastian-vettel-says-nurburgring-win-a-huge-relief-4466682/4466682/) |
| GPE | [GrandPrix.com, Sunday team quotes](https://www.grandprix.com/races/german-gp-2013-sunday-team-quotes.html) |
| Jolpica-R | [Jolpica results](https://api.jolpi.ca/ergast/f1/2013/9/results.json) |
| Jolpica-P | [Jolpica pit stops](https://api.jolpi.ca/ergast/f1/2013/9/pitstops.json?limit=100) |
| Jolpica-Q | [Jolpica qualifying](https://api.jolpi.ca/ergast/f1/2013/9/qualifying.json) |

Not used: OpenF1 has no 2013 data; TUM covers 2014-2019 only. No GrandPrix.com race report was
found for this race (only results and team quotes).

### Facts

| Topic | Fact | Sources | Owner checked |
|---|---|---|---|
| Grid | Hamilton pole (1:29.398), Vettel 2nd, Webber 3rd, Räikkönen 4th, Grosjean 5th, Ricciardo 6th; Massa 7th, Alonso 8th, Button 9th, Hülkenberg 10th, Rosberg 11th (out in Q2 after a team mistake). Massa and Alonso started on mediums; Button and Hülkenberg set no Q3 time to save tyres. | WP, Jolpica-R, Jolpica-Q | |
| Penalties (grid) | None in sources; Jolpica grid matches the qualifying order for the top 6. | Jolpica-R | |
| Tyres | Pirelli changed the rear construction (Kevlar instead of steel belts) after the Silverstone failures; swapping left/right tyres was banned. Compounds on offer: soft and medium (named in the race account). | WP, AS-V | |
| Laps | 60 (5.148 km). | WP, Jolpica-R | |
| Weather | Dry, "Sunny" (WP); MS mentions "the prevailing heat"; teams cite hotter-than-expected temperatures (GPE: Ferrari, Mercedes, Renault). Temperature figures: not in sources. | WP, MS, GPE | |
| Start | Vettel led from Turn 1; Webber 2nd, Hamilton 3rd. | WP, MS, AS-V | |
| SC / VSC / red flag | One safety car for Bianchi's Marussia (engine failure, fire; the car rolled back across the track). Deployed lap 23 (WP) / lap 22 (MS: "neutralised for five laps"). Exact in-lap of the SC: not in sources. No red flag; VSC did not exist in 2013. | WP, MS | |
| Stops: Vettel | In-laps 7, 24 (under SC), 41 (Jolpica-P; MS gives lap 6 for the first). Mediums from the first stop (MS). Under the SC: scrubbed mediums, keeping one new set (MS); last stint new mediums (AS-K). Horner: without the SC they would have run "another five to seven laps" (MS). Red Bull stopped him a lap after Grosjean to cover him, rather than risk "conceding the lead to Kimi if he didn't need to stop" (MS). | Jolpica-P, MS, AS-K | |
| Stops: Räikkönen | In-laps 8, 24 (under SC), 49 (Jolpica-P; WP: lap 49). First stint softs (worn softs, WP's general account); last stint scrubbed softs (MS), "softs" (WP, AS-K). Held up by Hamilton after his first stop (GPE, Permane and Räikkönen). Led from lap 41 when Vettel and Grosjean stopped (WP). | Jolpica-P, WP, MS, AS-K, GPE | |
| Stops: Grosjean | In-laps 13, 24 (under SC), 40 (Jolpica-P; MS: final stop lap 40). First stint softs (GPE, Grosjean); led before his first stop (WP). Last stint new mediums (AS-K). MS: Grosjean had the greater tyre range, so the SC "didn't do Grosjean any favours". | Jolpica-P, MS, AS-K, GPE, WP | |
| Stops: others | Alonso 12, 24, 49 (started on mediums; last stint softs per WP; MS says lap 13, "one before Grosjean"). Hamilton 6, 22, 45. Button two-stop, 21 and 47. Webber 8 (2:42.042 s in pit, wheel loss), 23, 38. Hamilton and Button stopped shortly before the SC (MS). | Jolpica-P, WP, MS | |
| Webber wheel | At his first stop the right-rear wheel was not attached, came off in the pit lane and hit a FOM cameraman; Webber rejoined a lap down and regained the lead lap under the SC (WP, GPE Horner). Lap: Jolpica in-lap 8; MS lap 7 ("one lap after Vettel"); WP's "a lap later" than Grosjean's lap-13 stop conflicts with both. | WP, MS, GPE, Jolpica-P | |
| Retirements | Massa lap 3-4 (spun at Turn 1 after locking the rears, engine stalled; Jolpica: 3 laps, "Spun off"; MS: lap 4). Bianchi 21 laps (engine, fire). Vergne 22 laps (hydraulics, during the SC). | Jolpica-R, WP, MS | |
| Penalties / fines | Red Bull fined €30,000 (Webber's wheel); Force India €5,000 (unsafe release of di Resta into Vergne's path). No driver penalties sourced. | WP, MS | |
| Contact | None between front-runners sourced. | | |
| Team orders | Lotus told Grosjean not to hold Räikkönen up (WP); Räikkönen passed him within "a few laps" of his lap-49 stop (WP); exact lap: not in sources. Grosjean: letting Räikkönen by was sensible as they were on different strategies (GPE). | WP, GPE | |
| Lotus decision | Permane: Lotus considered running Räikkönen on a two-stop but saw his tyre performance dropping (GPE). Boullier: "Kimi's pace was beginning to drop" and the tyres would not last (MS). Räikkönen afterwards wondered whether he could have gone to the end (AS-K). | GPE, MS, AS-K | |
| Result | Vettel 1:41:14.711; Räikkönen +1.008; Grosjean +5.830; Alonso +7.721; Hamilton +26.927; Button +27.996. Webber 7th +37.562. Fastest lap Alonso 1:33.468 (lap 51). | Jolpica-R, WP | |

### Proposal (draft, for the owner)

| Item | Draft | Owner checked |
|---|---|---|
| Storyline drivers | Räikkönen (Lotus) and Vettel (Red Bull). | |
| Dilemma (original wording) | Räikkönen inherits the lead when Vettel and Grosjean make their last stops: stay out to the flag on ageing mediums, or stop for softs and hunt Vettel down in the final ten laps. | |
| Suggested side | Räikkönen (pending `pipeline hard-calls`; Grosjean is the alternative Lotus side). | |
| Target (draft) | win: Räikkönen from P4 (equivalently beat-rival Vettel). Fallback: position P2. | |
| Side really won? | No: Räikkönen finished 2nd, 1.008 s behind Vettel. A rewrite is allowed. | |
| Modelling risk | **Medium.** Dry, one SC with real stop laps from Jolpica. Risks: SC lap differs (WP 23 vs MS 22) and its end lap is not in sources; Webber's lost wheel (~2 min stop, lap down, back on the lead lap via SC) needs scripting; per-stint compounds only partly sourced; one-off tyre construction this race; Lotus team-order swap needs a storyline event; no OpenF1/TUM laps for 2013. | |

### Not in sources

- Lap the safety car came in, and an agreed lap it came out.
- Lap Räikkönen passed Grosjean after his last stop.
- Compounds for Räikkönen's and Grosjean's middle stints, Vettel's first stint (only "mediums from the first stop"), and the rest of the top 6 except where listed.
- Air and track temperatures.
- Gaps during the race (only the final classification).

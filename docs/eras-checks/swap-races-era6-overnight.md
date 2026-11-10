# Three Era 6 races swapped (owner, Nov 9, overnight): owner sign-off

The owner pre-approved (Nov 9) swapping failing Eras races for the next-best race by stats.
In Era 6 the three races with the worst robust-G1 status and mean gap error in
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

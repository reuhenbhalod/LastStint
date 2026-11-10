# Five more Eras races swapped in Era 10 and Era 9 (owner, Nov 9, second batch): owner sign-off

Five races are replaced by another race of the same era, in the same slot, as in the first
batch (`swap-races-e10-e9.md`, migration 0013) and the first four swaps (`swap-races.md`,
migration 0012). Every fact below was read in the linked source on Nov 9, 2026; nothing comes
from memory. Where sources disagree, the row says which was taken. Check each row against its
links and put your initials and the date in **Owner checked**.

| Era / slot | Removed | Why | Replacement | Robust G1 of the replacement (Eras build, rules-only overlay) |
|---|---|---|---|---|
| 10 / #2 | `great-britain-2022` | Fails G1 (2.03 s, the late-SC sprint) | `great-britain-2023` | pass, 1.56 s (new race) |
| 10 / #4 | `singapore-2023` | Fails G1 (3.69 s, race mechanics) | `japan-2023` | pass, 2.35 s (non-Eras holdout build before) |
| 10 / #6 | `miami-2024` | Fails G1 (2.79 s, SC mechanics) | `emilia-romagna-2024` | pass, 0.88 s (new race) |
| 10 / #10 | `monaco-2025` | Fails G1 (3.28 s, the Monaco queue) | `abu-dhabi-2022` | pass, 0.54 s (new race) |
| 9 / #8 | `brazil-2021` | Fails G1 (1.91 s, Hamilton's pass on Verstappen) | `netherlands-2021` | pass, 1.76 s (new race) |

The removed races' G1 numbers are from `docs/eras-races-report.md`. The replacements' numbers
were measured on the same race files (rebuilt here byte-identical); japan-2023's was re-run
here (`pipeline validate japan-2023 --robust`). australia-2025 (Era 10) and hungary-2021
(Era 9) are approved for swapping out too, but their replacements aren't chosen yet, so they
stay in place.

The replacements are not authored yet (no `eras` block): side (`pipeline hard-calls`), target,
storyline, mastery, hidden objective and briefing come in B1. The proposals below are drafts.
The `user_side` / `rival` pairs in `build.py` are provisional and don't always match the
proposals (abu-dhabi-2022 is built as LEC vs PER, great-britain-2023 as NOR vs HAM, japan-2023
keeps its holdout entry with no side); `pipeline hard-calls` settles each one.

**Wording check needed:** some quotes and numbers came through a fetch tool that summarises
pages: great-britain-2023's "Norris tyre call" row is from an Autosport search summary, and
abu-dhabi-2022's GrandPrix.com notes lost some lap numbers in the fetched text. Check those
against the pages themselves.

## great-britain-2023 (2023 British Grand Prix)

Lap numbers: OpenF1 gives the in-lap (last lap of the stint); GPE counts the lap the car came out on, so its stop laps are often one higher.

### Sources

| Short name | What |
|---|---|
| WP | English Wikipedia, https://en.wikipedia.org/wiki/2023_British_Grand_Prix |
| AS | Autosport race report, https://www.autosport.com/f1/news/f1-british-gp-race-report/10493893/ |
| GPE | GrandPrix.com race notes, https://www.grandprix.com/races/britain-gp-2023-race-notes.html |
| Jolpica | https://api.jolpi.ca/ergast/f1/2023/10/results.json (fetched 2026-11-09) |
| OpenF1 | session_key 9126: `/v1/stints`, `/v1/pit`, `/v1/race_control`, `/v1/weather` (fetched 2026-11-09) |

### Facts

| Topic | Fact | Sources | Owner checked |
|---|---|---|---|
| Grid | Verstappen pole, Norris 2nd, Piastri 3rd, Leclerc 4th, Sainz 5th, Russell 6th; Hamilton 7th, Albon 8th. Pérez started 15th. | WP, Jolpica | |
| Grid penalties | Bottas was disqualified from qualifying (could not give a 1-litre fuel sample) and started last, 20th. No penalties in the top 6. | WP, Jolpica (BOT grid 20) | |
| Laps | 52. | Jolpica, AS | |
| Weather | Dry race. Drops of rain after the start and dark clouds around lap 21 (GPE); WP says the rain was never heavy enough for wet tyres. OpenF1 weather shows no rainfall samples; air 20.0-22.5 C, track 27.7-38.2 C. Nobody used intermediates or wets (OpenF1 stints). | GPE, WP, OpenF1 | |
| Start | Norris took the lead from Verstappen at Turn 1; Piastri 3rd. Hamilton ran wide, dropped to 9th and re-passed Gasly on lap 1. | GPE, AS | |
| Lead change | Verstappen passed Norris with DRS on lap 5 (AS, GPE; WP says "by lap 4") and led every lap after. | AS, GPE, WP | |
| Starting tyres | Top 15 on mediums except Russell and Ocon on softs (GPE). OpenF1: VER, NOR, HAM, PIA, PER, LEC, SAI, ALO, ALB on mediums; RUS on used softs. | GPE, OpenF1 | |
| Early stops | Leclerc in-lap 18, mediums to hards (OpenF1; GPE lap 19, rejoined 12th). Sainz in-lap 26, hards (OpenF1; GPE lap 27, from 5th to 12th). Russell in-lap 28, mediums (GPE lap 29, from 4th to 9th). Pérez in-lap 28, softs. | OpenF1, GPE, AS | |
| Piastri stop | In-lap 29, mediums to new hards (OpenF1; AS lap 29; GPE lap 30, from 3rd, rejoined 6th). Lead at the time 8.1 s (AS). | OpenF1, AS, GPE | |
| VSC / SC | Magnussen's engine failed on the Wellington straight: lap 32 (AS, GPE, WP; Jolpica MAG 31 laps; OpenF1 race control logs the VSC and the SC on lap 33). VSC first, then a full safety car. SC in at the end of lap 38 (GPE; OpenF1 "safety car in this lap" on lap 38); racing resumed lap 39 (AS). Clean-up took over 12 minutes (AS). | AS, GPE, WP, OpenF1, Jolpica | |
| Red flag | None in the race (OpenF1 race control: no red flag). A red flag in Q1 only (Magnussen stopped). | OpenF1, WP | |
| Stops under SC | In-lap 33 (OpenF1): Verstappen mediums to softs, Norris mediums to new hards, Hamilton mediums to softs, Alonso to softs; Albon in-lap 32 to softs; Leclerc's second stop in-lap 32, hards to mediums. Hamilton jumped Piastri to 3rd. | OpenF1, AS, GPE | |
| Order behind SC | Verstappen (S), Norris (H), Hamilton (S), Piastri (H), Russell (M), Alonso (S), Sainz (H), Pérez (S), Albon (S), Leclerc (M). | GPE | |
| Restart | Verstappen pulled 1.2 s clear by the line (AS). Hamilton went side by side with Norris on lap 40 (GPE) over two laps (AS); Norris held 2nd. Piastri held off Russell. | AS, GPE | |
| Norris tyre call | After the race Norris said he would have preferred softs and that the team chose hards (press comment reported by AS search summary; not team radio, paraphrased). | AS | |
| Gaps lap 45 | VER, NOR +3.6, HAM +5.0, PIA +6.7, RUS +8.5, ALO +11.9, PER +12.7. | GPE | |
| Result top 6 | Verstappen 1:25:16.938; Norris +3.798; Hamilton +6.783; Piastri +7.776; Russell +11.206; Pérez +12.882. Then Alonso, Albon, Leclerc, Sainz. | Jolpica, WP, GPE | |
| Fastest lap | Verstappen, lap 42, 1:30.275. | WP | |
| Retirements | Ocon lap 9, hydraulics (AS) / oil leak (WP table; WP text says lap 12); Jolpica 9 laps. Magnussen lap 31-32, engine. Gasly 46 laps after contact with Stroll at Club; classified 18th. | Jolpica, AS, WP | |
| Penalties | Stroll 5 s for the collision with Gasly, dropping him to 14th (Jolpica 14th; WP summary said 12th, Jolpica taken). Black-and-white track-limits flags: Stroll lap 43, Russell and Norris lap 48. | Jolpica, AS, GPE, OpenF1 | |
| Contact | Pérez and Hulkenberg touched (no lap given; Hulkenberg pitted). Stroll and Gasly at Club. | GPE, AS | |
| Team orders | None in any source read. | WP, AS, GPE | |
| Pit-stop times | Front-runners' stationary+lane times (OpenF1 `pit_duration`): VER 29.0, NOR 28.4, HAM 29.1, PIA 28.6 s. | OpenF1 | |

### Proposal (draft, for the owner)

- **Key dilemmas.** (1) McLaren stopped Piastri from 3rd on lap 29, three laps before the
  Magnussen VSC/SC; Hamilton and Norris stopped cheaply under it and Hamilton took 3rd.
  (2) Under the SC, Norris got hards while Verstappen and Hamilton behind him took softs for a
  14-lap sprint; Norris held 2nd.
- **Storyline drivers:** Hamilton (gains under the SC, attacks on softs) and Norris (team-mate,
  holds 2nd on hards). Verstappen runs as the scripted leader.
- **Side:** Piastri (pending `pipeline hard-calls`; Norris is the alternative: one hard call,
  the SC tyre choice).
- **Dilemma (original wording):** Box from third now, or hold out on old mediums and gamble on
  a neutralisation?
- **Target (draft):** position: Piastri on the podium (P3 or better).
- **Did the side really win it?** No: Piastri finished 4th, 0.993 s behind Hamilton. A rewrite
  is allowed. (If the side becomes Norris, target position P2 is what really happened.)
- **Risk: medium.** The dilemma depends on the lap-32/33 SC landing after Piastri's window;
  the legend/drawn-SC handling must place it there. Lap numbering differs by one between sources
  (OpenF1 lap 33 vs reports lap 32 for the VSC/SC; GPE stop laps +1). The P3-P4 margin is under
  1 s, so the target is sensitive to soft-vs-hard pace after the restart. Sim pass margin is
  1.56 s, not wide. Dry race and no penalties at the front keep the build simple.

### Not in sources

- No source read gives Piastri's gap to Hamilton just before his stop, or the field's gaps at
  lap 32.
- Ocon's retirement lap and cause disagree (lap 9 vs 12; hydraulics vs oil leak).
- Pérez-Hulkenberg contact lap: not in sources.
- Motor Sport report not opened.

## japan-2023 (2023 Japanese Grand Prix)

### Sources

| Short name | What |
|---|---|
| WP | [English Wikipedia race article](https://en.wikipedia.org/wiki/2023_Japanese_Grand_Prix) |
| AS | [Autosport race report](https://www.autosport.com/f1/news/f1-japanese-gp-race-report/10524573/) |
| AS10 | [Autosport, "10 things we learned at the 2023 F1 Japanese Grand Prix"](https://www.autosport.com/f1/news/10-things-we-learned-at-the-2023-f1-japanese-grand-prix/10525290/) |
| GPE | [GrandPrix.com race notes](https://www.grandprix.com/races/japanese-gp-2023-race-notes.html) |
| MS-d | [Motor Sport, Chris Medland's 2023 Japanese GP diary](https://www.motorsportmagazine.com/articles/single-seaters/f1/leclerc-got-lost-amid-suzuka-chaos-2023-japanese-gp-diary/) |
| MS-p | [Motor Sport, "Perez's Japan GP was so bad he retired twice"](https://www.motorsportmagazine.com/articles/single-seaters/f1/perezs-japan-gp-was-so-bad-he-retired-twice-up-down-in-suzuka/) |
| Jolpica-r | [Jolpica results, 2023 round 16](https://api.jolpi.ca/ergast/f1/2023/16/results/) |
| Jolpica-p | [Jolpica pit stops, 2023 round 16](https://api.jolpi.ca/ergast/f1/2023/16/pitstops/?limit=100) |
| OF1-s | [OpenF1 stints, session 9173](https://api.openf1.org/v1/stints?session_key=9173) |
| OF1-rc | [OpenF1 race control, session 9173](https://api.openf1.org/v1/race_control?session_key=9173) |

Note: round 17 in Jolpica is Qatar. Japan 2023 is **round 16** (Jolpica-r confirms Suzuka).

### Facts

| Topic | Fact | Sources | Owner checked |
|---|---|---|---|
| Grid | Verstappen pole, Piastri 2nd, Norris 3rd, Leclerc 4th, Pérez 5th, Sainz 6th; Hamilton 7th, Russell 8th, Alonso 10th. | WP, Jolpica-r | |
| Grid penalties | None for the front-runners. Sargeant set no qualifying time, started from the pit lane after parc fermé changes and got a 10 s penalty (new chassis) (WP). Jolpica lists him as grid 20, not 0. | WP, Jolpica-r | |
| Laps | 53 laps, 307.471 km. | WP, Jolpica-r | |
| Weather | Sunny; dry race. | WP | |
| Safety car | Lap 1 SC for debris (Bottas/Albon contact). Deployed lap 1, "SC in this lap" on lap 4; GPE: in at the end of lap 4. | WP, AS, GPE, OF1-rc | |
| VSC | Brief VSC on lap 14 (OF1-rc: deployed and ending on lap 14) for debris after Pérez hit Magnussen at Turn 11 (lap 12 per WP and GPE; OF1-rc notes it on lap 13). | WP, GPE, OF1-rc | |
| Red flag | None in the race (OF1-rc has none; WP mentions red flags only in Q1 and FP2). | WP, OF1-rc | |
| Verstappen stops | Two: in-laps 16 and 37 (Jolpica-p, OF1-s). Medium, Medium, Hard (OF1-s). GPE gives laps 17 and 38 (it counts the lap after, consistently, for every driver). | Jolpica-p, OF1-s, GPE | |
| Norris stops | In-laps 17 and 36. Medium, Hard, Hard. | Jolpica-p, OF1-s | |
| Piastri stops | In-laps 13 and 35. Medium, Hard, Hard. AS and AS10 say his first stop came under the VSC and undercut Norris; GPE says he pitted under the VSC. **Conflict:** OF1-s ends his first stint on lap 13 and OF1-rc puts the VSC on lap 14. I could not confirm from timing data that the stop was under the VSC. | Jolpica-p, OF1-s, OF1-rc, AS, AS10, GPE | |
| Leclerc stops | In-laps 17 and 34. Medium, Medium, Hard. | Jolpica-p, OF1-s | |
| Hamilton stops | In-laps 16 and 34. Medium, Hard, Hard. AS10: he undercut Sainz at his second stop. | Jolpica-p, OF1-s, AS10 | |
| Sainz stops | In-laps 18 and 38. Medium, Medium, Hard. | Jolpica-p, OF1-s | |
| Russell stops | One stop, in-lap 24. Medium, then Hard to the flag. GPE: the only front-runner not yet stopped around lap 20; led-to-second on track, rejoined 9th, back up to 2nd on track by lap 26. | Jolpica-p, OF1-s, GPE, AS | |
| Alonso stops | In-laps 11 and 25. Soft (3 laps old), Hard, Hard. | Jolpica-p, OF1-s | |
| Gaps (GPE) | Lap 20: Verstappen led Russell by 2.6 s. Lap 30: Norris 13.8 s behind Verstappen, Piastri 18.2 s, Russell 7th at 33.6 s. Lap 40: Norris 15.2 s, Russell 22.4 s, Piastri 23.3 s, Leclerc 25.8 s, Hamilton 30.4 s, Sainz 36.3 s. | GPE | |
| Russell passed | Norris passed Russell lap 38, Piastri lap 40, Leclerc lap 45 (Turn 1 outside), Hamilton lap 49 (on team order), Sainz lap 50. | GPE | |
| McLaren order | Norris retook 2nd from Piastri on lap 26 (GPE) / start of lap 27 (AS). AS10: Norris was waved through after discussion about Russell's one-stop threat; Piastri's pace on the hards was weaker. GPE records no team order. Final gap Norris–Piastri about 17 s. | AS, AS10, GPE | |
| Mercedes orders | AS10: with five laps left Russell let Hamilton through after Hamilton complained on the radio; then Hamilton was asked to give Russell DRS against Sainz; Sainz passed Russell anyway. AS calls the DRS plan botched. GPE puts the swap on lap 49. | AS, AS10, GPE | |
| Contact / damage | Lap 1: Pérez squeezed Hamilton onto the grass and they touched (WP, GPE, AS); Pérez needed a new front wing. Whether Hamilton's car was damaged: **not in sources**. Lap 16: Hamilton wide (Degner 1, AS10); Russell passed; OF1-rc notes a Russell/Hamilton Turn 14 incident on lap 18, no further action. | WP, GPE, AS, AS10, OF1-rc | |
| Penalties | Pérez: 5 s for an SC infringement (lap 9, OF1-rc) and 5 s for the Magnussen collision (lap 15, OF1-rc). He retired, rejoined to serve the penalty, then retired again (WP, MS-p; GPE says he rejoined lap 39 and retired lap 40). Jolpica: 15 laps, retired. Sargeant: 5 s for hitting Bottas. | WP, MS-p, GPE, OF1-rc, Jolpica-r | |
| Retirements | Pérez, Bottas (lap 7, Jolpica), Stroll, Sargeant, Albon. No top-six car retired. | Jolpica-r, WP | |
| Result | 1 Verstappen 1:30:58.421; 2 Norris +19.387; 3 Piastri +36.494 (first podium); 4 Leclerc +43.998; 5 Hamilton +49.376; 6 Sainz +50.221; 7 Russell +57.659. | WP, Jolpica-r, AS | |

### Proposal (draft, for the owner)

| Item | Draft | Basis | Owner checked |
|---|---|---|---|
| Storyline drivers | Russell and Hamilton (Mercedes split strategies). | AS10, GPE | |
| Dilemma | Russell is stretching his first set while everyone else stops twice: hold track position on one stop, or come in again and attack. | GPE, AS10 | |
| Target | beat-rival: Russell finishes ahead of Hamilton (real: Russell 7th, Hamilton 5th). Alternative: position, Russell top 5. | Jolpica-r | |
| Did the side win? | No. Russell finished 7th and behind Hamilton, so a rewrite is allowed. | Jolpica-r | |
| Alternative side | Piastri vs Norris (early stop, then the lap 26/27 swap). Real result Norris ahead; a rewrite would be allowed for Piastri. | AS, AS10 | |

### Modelling risk (medium)

- Rain: none (dry, sunny).
- Red flags: none.
- SC restart: lap 1–4 SC only; it did not decide the result.
- VSC: lap 14; it gave Piastri's first stop a benefit (sources disagree on whether he stopped under it).
- Team orders: two, McLaren (lap 26/27) and Mercedes (lap 49). The Mercedes one is the storyline's result.
- Contact: Hamilton lap 1 with Pérez; damage not in sources.
- One-stop against two-stop with hard-tyre fade: the model needs Russell's late-stint wear to come out right.
- Last-lap pass: none. Hamilton held off Sainz to the line.
- Suzuka is not a Monaco-style track.

### Authored (B1, Nov 9)

Built with `user_side` RUS / `rival` HAM (`build.py`; before, the holdout entry's automatic
duel was NOR vs VER, where the counter gave VER 3, NOR 0); takeover lap 11 (D3 rule). Robust G1
after the change (Eras build, with the two team orders below): pass, 1.97 s (2.35 s before the
team orders). Reachability: era and Legend reachable, stay-out never ★3.

Timing: lap-end positions and gaps from the race's FastF1 snapshot (`data/raw/japan-2023.parquet`).

| Item | As authored | Basis | Owner checked |
|---|---|---|---|
| Side | **Russell.** `pipeline hard-calls`: RUS 2, HAM 1 (chance given up RUS 4.0 pts, HAM 0.7). | hard-call counter | |
| Team order (McLaren) | `TEAM_ORDER` lap 27, PIA lets NOR by (`data/incidents.json`). AS10: Norris came back past after discussion of Russell's one-stop threat, Piastri slower on the hards (no lap). GPE: "Norris gets by on fresher tyres for second place" in its lap-26 entries (no order mentioned). Timing: PIA ahead at the end of lap 26 (0.4 s), NOR ahead from the end of lap 27, so 27 is the sims' lap. | AS10, GPE, Timing | |
| Team order (Mercedes) | `TEAM_ORDER` lap 49, RUS lets HAM by. GPE lap 49: "Mercedes gives Russell the instruction to swap places, and Hamilton goes by Russell at the first corner to take fifth place." AS10: with five laps left, after a radio protest (not quoted). Timing: HAM ahead from the end of lap 49. For the player it is a comply/ignore call (moment `teamorder-49-ham`; real option comply). | GPE, AS10, Timing | |
| Target | `position: 6` (Russell sixth or better). The draft `beat-rival` HAM was tried first: the grader gives Russell at most ~9-10% at any call against Hamilton's two-stop, and no path on the reachability seeds beat him at era difficulty or Legend, so it was dropped. Sixth means beating Sainz (6th) or a car ahead. | author and reachability output | |
| Rewrite | Yes, `position: 6`: Russell really finished 7th (Jolpica-r). Headline (original): "Russell turns Suzuka's split strategy into sixth". | Jolpica-r | |
| Storyline text | Verstappen wins by 19.4 s; Russell runs long on his first mediums and stops once while Hamilton stops twice; with five laps left Mercedes swaps them, Sainz passes Russell too, and Russell finishes 7th, 8.3 s behind Hamilton in 5th (57.659 − 49.376). | Result, Russell stops, Hamilton stops, Russell passed, Mercedes orders rows; AS10 (19.4 s) | |
| Briefing | Verstappen leads from pole with the two McLarens behind him; Russell eighth after ten laps on mediums, right behind Hamilton (7th); Mercedes splits its strategies. Positions after ten laps from the timing; starting compound from OF1-s. | Grid row, Russell stops row, Timing | |
| Mastery | `stop_count` exact 2, "Finish sixth or better on two stops" (a counterfactual: Russell really stopped once; no clean one-stop path reached ★1 on the reachability seeds). | reachability | |
| Hidden | `compound_rule` mustUse SOFT, "Finish sixth or better with a stint on softs". | — | |
| storylineEvents | `[14, "VSC"]` (the Pérez/Magnussen debris VSC, kept in Legend too, so the cheap-stop call is always there). | VSC row | |
| Moments | Hand-adjusted. The author tool (`author japan-2023 --target position:6 --eras`) kept vsc-14, pace-19, stop-24, pace-27 but offered only one-stop answers (its later calls graded "no-choice"), and with them neither difficulty was reachable. Authored: vsc-14 (author's; real stay), stop-17 (stay / mediums / hards; real stay, the lap the leaders stop), stop-24 (author's; real box hards), stop-39 (stay / softs / mediums / hards; real stay, after Hamilton's second stop), teamorder-49-ham (comply / ignore; real comply). Every option is graded by the grader as live play grades it. | author and reachability output | |
| Reachability paths | Era (seed 1): box mediums under the VSC, stay at 17 and 24, softs at 39, comply: ★1 ★2 ★3, hidden. Legend (seed 1): stay under the VSC, mediums at 17, stay at 24, softs at 39, comply: ★1 ★2 ★3, hidden. Stay-out never earns ★3 (it stops once). | reachability | |

Fetch note: AS10's wording came through a fetch tool that summarises pages; check the two
team-order rows against the article.

Schema: `teamOrder` is added to the moment `trigger` enum in `packages/schema/race-model.schema.json`
(the sim's `DecisionMoment` type already had it; no race file used it before this one).

## emilia-romagna-2024 (2024 Emilia Romagna Grand Prix)

### Sources

| Short name | What |
|---|---|
| WP | [English Wikipedia, 2024 Emilia Romagna Grand Prix](https://en.wikipedia.org/wiki/2024_Emilia_Romagna_Grand_Prix) |
| AS-race | [Autosport, "F1 Imola GP: Verstappen wins after late pressure from Norris"](https://www.autosport.com/f1/news/f1-imola-gp-race-report/10612923/) |
| AS-Stella | [Autosport, "McLaren unsure Norris could have passed Verstappen to win F1 Imola GP"](https://www.autosport.com/f1/news/mclaren-unsure-norris-could-have-passed-verstappen-to-win-f1-imola-gp/10612990/) |
| AS-VER | [Autosport, "Verstappen 'almost ended in the grandstands' amid Imola F1 hard tyre struggles"](https://www.autosport.com/f1/news/verstappen-almost-ended-in-the-grandstands-amid-imola-f1-hard-tyre-struggles/10613038/) |
| MS | [Motor Sport, "Did Norris need just one more lap at Imola? That we're asking says it all"](https://www.motorsportmagazine.com/articles/single-seaters/f1/did-norris-need-just-one-more-lap-at-imola-that-were-asking-says-it-all/) |
| Jolpica | [api.jolpi.ca/ergast/f1/2024/7/results.json](https://api.jolpi.ca/ergast/f1/2024/7/results.json) |
| OF1-stints | [api.openf1.org/v1/stints?session_key=9515](https://api.openf1.org/v1/stints?session_key=9515) |
| OF1-pit | [api.openf1.org/v1/pit?session_key=9515](https://api.openf1.org/v1/pit?session_key=9515) |
| OF1-rc | [api.openf1.org/v1/race_control?session_key=9515](https://api.openf1.org/v1/race_control?session_key=9515) |
| OF1-wx | [api.openf1.org/v1/weather?session_key=9515](https://api.openf1.org/v1/weather?session_key=9515) |
| OF1-gap | [intervals, car 4](https://api.openf1.org/v1/intervals?session_key=9515&driver_number=4), read against [laps, car 4](https://api.openf1.org/v1/laps?session_key=9515&driver_number=4) and [laps, car 1](https://api.openf1.org/v1/laps?session_key=9515&driver_number=1) (gap = last interval sample before each lap's start) |

### Facts

| Topic | Fact | Sources | Owner checked |
|---|---|---|---|
| Grid | Verstappen pole (1:14.746), Norris 2nd, Leclerc 3rd, Sainz 4th, Piastri 5th, Russell 6th; Tsunoda 7th, Hamilton 8th. Piastri qualified 2nd but got a three-place grid penalty for impeding Magnussen in Q1. Alonso started from the pit lane (car changed in parc fermé); Sargeant set no time inside 107% and was allowed to start. | WP, Jolpica (grid VER 1, NOR 2, LEC 3, SAI 4, PIA 5, RUS 6, HAM 8) | |
| Laps | 63 laps (309.049 km). | WP, Jolpica | |
| Weather | Dry. WP infobox: partly cloudy. Race control: 10% risk of rain. OpenF1 weather: no rainfall in any sample; air 24.0-26.1 °C, track 38.6-46.0 °C. | WP, OF1-rc, OF1-wx | |
| SC / VSC / red flag | None in the race. Race control has no SC, VSC or red-flag message; WP mentions red flags only in practice. | OF1-rc, WP | |
| Start | Norris reacted slightly better at the lights but ran wide at the first braking point; Verstappen kept him out of DRS (DRS enabled lap 2). | AS-race, OF1-rc | |
| Start tyres | All front-runners on mediums (VER, NOR, LEC, SAI, PIA, HAM, RUS); Pérez on hards. | OF1-stints | |
| Stops: Norris | One stop, medium → hard (used set, age 1), lap 22; first of the leaders to stop. | AS-race, OF1-pit, OF1-stints | |
| Stops: Verstappen | One stop, medium → new hard, lap 24 ("two laps later", AS-race). WP says Sainz briefly led before Verstappen retook the lead on lap 27 (Sainz stopped on lap 27, OF1-pit). | AS-race, OF1-pit, OF1-stints, WP | |
| Stops: others | Piastri lap 23 (M → H, used set), Leclerc lap 25 (M → new H), Sainz lap 27 (M → H), Hamilton lap 27 (M → H), Pérez lap 37 (H → M). Russell two stops: lap 21 (M → H) and lap 52 (H → used M), taking fastest lap (1:18.589, lap 54). Piastri undercut Sainz for 4th. | OF1-pit, OF1-stints, AS-race, WP | |
| Gap Verstappen-Norris | OF1-gap: 2.7 s at the start of lap 10, 5.9 s lap 20, 6.5 s lap 22 (AS-race: lead 6.5 s by lap 22), 6.4 s lap 30, 7.4 s lap 45, 5.7 s lap 50, 3.1 s lap 55, 1.6 s lap 58, 1.0 s at the start of lap 63. AS-race: Verstappen began the final stint 5.6 s ahead. WP: Norris "closed the gap from six seconds in the final 15 laps". Never in DRS range (AS-race, AS-VER, MS). | OF1-gap, AS-race, WP, MS, AS-VER | |
| Tyres (hard) | Verstappen: after the first 5-10 laps on hards the tyres fell out of the operating window, "like driving on ice"; he was not sure they would last, and nearly went off at Turn 7. Stella: McLaren lost too much time in the first stint behind Verstappen; tyre management was key. Norris worked his hards better in the second stint (AS-race). | AS-VER, AS-Stella, AS-race | |
| Leclerc | Got within DRS range of Norris by lap 43, then an off at the Variante Alta chicane cost him momentum. | AS-race, WP | |
| Penalties / warnings | Albon: stop/go penalty for an unsafe release with a loose wheel (race control: "10 second stop/go", lap 22; WP: lap-10 stop); Williams retired him (51 laps, Jolpica). Verstappen formally warned for track limits (three violations, AS-VER). Zhou/Ocon T9 incident lap 56: no further investigation. | OF1-rc, WP, AS-race, AS-VER, Jolpica | |
| Contact | None between front-runners reported. Hamilton went through the Acque Minerali gravel; Pérez ran into a gravel trap. | WP, AS-race | |
| Team orders | Not in sources. | — | |
| Retirements (front-runners) | None; the top 9 completed all 63 laps. Only retirement: Albon. | Jolpica | |
| Result | Verstappen 1:25:25.252; Norris +0.725; Leclerc +7.916; Piastri +14.132; Sainz +22.325; Hamilton +35.104. Russell 7th (+47.154), Pérez 8th. | Jolpica, WP, AS-race | |
| Could Norris have won? | Norris: "one or two more laps" and he would have had him. Stella unsure: 63 laps is already many; it was Verstappen, who got the most out of what he had. | AS-race, AS-Stella, MS | |

### Proposal (draft, for the owner)

| Item | Proposal | Owner checked |
|---|---|---|
| Storyline drivers | Verstappen (Red Bull) and Norris (McLaren). | |
| Dilemma | Imola's one-stop chess: pit first to chase the leader, or eke out the mediums and trust the hards to last to the flag. | |
| Side | Pick with `pipeline hard-calls`. Norris made the first move (lap 22); Verstappen covered on lap 24 and then nursed hards out of their window. | |
| Target (draft) | Norris side: `win` (beat Verstappen; history-book rewrite allowed, he lost by 0.725 s). Verstappen side: `defend` (hold the win; no rewrite, he really won). | |
| Side really won? | Verstappen yes; Norris no. | |
| Risk | **Medium.** Clean dry race, no SC/VSC, no faults, all front-runners one-stop, so it is cheap to build and gap data is complete. But: (1) the real story is tyre pace in the last 15 laps, not a pit call, so the hard-call count may be low and the decision moments thin; (2) a 0.725 s margin makes the target very sensitive to the 0.88 s sim error, so a Norris `win` may be easy or the Verstappen `defend` may fail by chance; (3) Verstappen's hard-tyre drop-off needs to show in the model or the late charge won't appear. | |

### Not in sources

- Exact lap of Sainz's brief lead (WP gives only "retook it on lap 27").
- Team orders: none mentioned.
- No source gives a lap for Verstappen's Turn 7 near-off.
- Albon's penalty: race control says "10 second stop/go"; WP calls it a ten-second penalty (same thing; the stop lap is lap 10 per WP).

## abu-dhabi-2022 (2022 Abu Dhabi Grand Prix)

### Sources

| Short name | What |
|---|---|
| WP | [English Wikipedia race article](https://en.wikipedia.org/wiki/2022_Abu_Dhabi_Grand_Prix) |
| AS | [Autosport race report, "Verstappen dominates finale, Leclerc takes second in championship"](https://www.autosport.com/f1/news/f1-abu-dhabi-gp-verstappen-dominates-finale-leclerc-takes-second-in-championship/10402859/) |
| MS1 | [Motor Sport, "How Ferrari strategy won the race (for runner-up) in Abu Dhabi"](https://www.motorsportmagazine.com/articles/single-seaters/f1/who-would-have-thought-ferrari-strategy-won-the-race-for-runner-up-in-abu-dhabi/) |
| MS2 | [Motor Sport, "Red Bull swerved the hazard of Perez beating Verstappen: Abu Dhabi GP analysis"](https://www.motorsportmagazine.com/articles/single-seaters/f1/red-bull-swerved-the-hazard-of-perez-beating-verstappen-abu-dhabi-gp-analysis) |
| GPE | [GrandPrix.com race notes](https://www.grandprix.com/races/abu-dhabi-gp-2022-race-notes.html) (a lap-by-lap transcript; some lap numbers are missing in the fetched text) |
| J-res | [Jolpica results](https://api.jolpi.ca/ergast/f1/2022/22/results.json) |
| J-pit | [Jolpica pit stops](https://api.jolpi.ca/ergast/f1/2022/22/pitstops.json?limit=100) |
| OpenF1 | Not available: the 2022 race session query returned HTTP 404 (`api.openf1.org/v1/sessions?year=2022&country_name=United%20Arab%20Emirates&session_name=Race`) |

### Facts

| Topic | Fact | Sources | Owner checked |
|---|---|---|---|
| Grid | Verstappen pole (1:23.824), Pérez 2nd (1:24.052), Leclerc 3rd (1:24.092), Sainz 4th, Hamilton 5th, Russell 6th. Norris started 7th. WP says Verstappen gave Pérez a tow on his final Q3 lap. | WP, J-res | |
| Grid penalties | Ricciardo three places (collision with Magnussen at São Paulo): qualified 11th, started 13th. No penalties in the top six. | WP, J-res | |
| Laps | 58 laps (306.183 km). Final round of 2022 (round 22). | WP, J-res | |
| Weather | Clear (dry). | WP | |
| Start tyres | Front-runners on mediums (Verstappen, Pérez, Leclerc, Sainz, Hamilton, Russell); Magnussen and Bottas on hards, Gasly on softs. | GPE (AS implies mediums for VER/LEC/PER: they changed from mediums to hards) | |
| SC / VSC / red flag | None. No source mentions a safety car, VSC or red flag (WP, AS, MS1, MS2, GPE). Not confirmed by track-status data (OpenF1 has no 2022 session). | WP, AS, MS1, MS2, GPE | |
| Verstappen stops | One stop, lap 20 (J-pit); GPE says lap 21; AS "five laps" after Pérez. Medium to hard (AS, GPE). MS2: one stop partly because he had only one fresh set of hards left. | J-pit, GPE, AS, MS2 | |
| Leclerc stops | One stop, lap 21 (J-pit, GPE; MS1 "end of lap 21"). Medium to hard (AS, GPE). Extended his first stint about six laps beyond Pérez's (MS1, AS). | J-pit, GPE, MS1, AS | |
| Pérez stops | Two stops: laps 15 and 33 (J-pit; AS and MS2 agree; GPE says 16 and 34). First stop medium to hard (AS; MS1 "pitted for the hard at the end of lap 15"); GPE says to medium at the first stop and hard at the second. Sources disagree on the first-stop compound; AS/MS1 taken. Second-stop compound: hard per GPE only. | J-pit, AS, MS1, MS2, GPE | |
| Sainz stops | Two stops, laps 17 and 39 (J-pit). GPE: about lap 16 to medium, lap 39 to hard. | J-pit, GPE | |
| Hamilton stop | One stop, lap 18 (J-pit), to hard (GPE). Retired after 55 laps, hydraulics (J-res; WP: stuck in seventh gear). | J-pit, GPE, J-res, WP | |
| Russell stops | Two stops, laps 15 and 39 (J-pit). 5 s penalty for an unsafe release into Norris's path at the first stop, served at the second (WP, AS, GPE). | J-pit, WP, AS, GPE | |
| Pit loss | Jolpica stop durations for the leaders 21.3-22.7 s (pit-lane time). | J-pit | |
| Why the strategies split | Pirelli recommended two stops and most of the field did so (MS1). Pérez's mediums grained (right-front, MS2) from about lap 9 (MS1); he stopped first on lap 15 under Leclerc's undercut threat (MS2). By about lap 32 Leclerc had closed in and a Ferrari radio call, later revealed as a dummy, suggested an undercut; Red Bull then switched Pérez to two stops (MS1, AS). Pérez was told to consider a one-stop but thought his tyres were degrading when they were only graining (MS2). Red Bull did not ask Verstappen to let Pérez by (MS2). | MS1, MS2, AS | |
| Pace | On his last set of hards Pérez was at least 0.5 s a lap faster than Leclerc (MS1; MS2 about 0.7 s); lapping Albon and Gasly cost him time (MS2; AS: Gasly held him up on lap 56). He was about 20 s behind Leclerc after his second stop with 25 laps left (MS2). | MS1, MS2, AS | |
| Gaps to Verstappen | Lap 10: PER 3.2, LEC 6.3, SAI 9.3. Lap 25: PER 2.4, LEC 6.5. Lap 35: LEC 5.0, PER 23.8. Lap 45: LEC 7.3, PER 17.2. Lap 56: LEC 8.1, PER 10.3. Lap 57: Pérez 1.7 s behind Leclerc. (GPE's lap 35 Pérez figure may be garbled.) | GPE | |
| Result | Verstappen 1:27:45.914; Leclerc +8.771; Pérez +10.093; Sainz +24.892; Russell +35.888; Norris +56.234 (fastest lap 1:28.391, lap 44, WP). Leclerc finished 1.3 s ahead of Pérez (MS1, AS). Championship: Leclerc 2nd on 308, Pérez 3rd on 305 (WP). | J-res, WP, MS1, AS | |
| Contact / team orders | Lap 1: Hamilton and Sainz touched at Turn 6; Hamilton cut the corner over the kerb. He was told to give the place back (lap 4, GPE; lap 5, WP), did, and Sainz pulled away (WP). GPE says Hamilton retook 4th on lap 5 (conflict with WP). | WP, AS, GPE | |
| Other incidents | Schumacher and Latifi collided at Turn 5 (lap 39, WP/GPE; lap 40, AS); Schumacher 5 s penalty. Pérez locked up at Turn 6 several times (AS, incl. lap 45 while passing Hamilton). | WP, AS, GPE | |
| Retirements | Alonso, water leak (27 laps, J-res; WP lap 27; AS/GPE lap 28). Hamilton, hydraulics (55 laps). Latifi, collision damage per J-res (55 laps; AS: told to retire on the final lap). No top-three retirements. | J-res, WP, AS, GPE | |
| Not in sources | SC/VSC confirmation from track-status data; Verstappen's/Leclerc's exact compound beyond "medium to hard" in AS/GPE; Pérez's first-stop compound (AS/MS1 hard vs GPE medium) is unresolved; Sainz's and Russell's compounds only from GPE; exact Pérez-Leclerc gap per lap other than GPE's table. | | |

### Proposal (draft, for the owner)

| Item | Draft | Owner checked |
|---|---|---|
| Storyline drivers | Pérez and Leclerc (second in the championship decided on strategy); Verstappen leads unchallenged. | |
| Dilemma (original wording) | Second in the title rides on the finale: Pérez's mediums are graining and Ferrari is stretching Leclerc's stint. Stop early and commit to two, or nurse the hards to the flag? | |
| Hard-call candidates | Pérez lap 15 (stop early under undercut threat or stay out); Pérez lap 33 (second stop vs one-stop, triggered by a Ferrari dummy call); Leclerc lap 21 (how long to extend, then run to the end). `pipeline hard-calls` should pick the side; Pérez looks likeliest. | |
| Suggested side and target | Pérez: `beat-rival` Leclerc (finish ahead of him). He finished 3rd, 1.3 s behind, so he did not really win the fight; a rewrite is allowed. If Leclerc is picked: `defend` P2 from Pérez; he really did it, so no rewrite. `win` is a poor fit (Verstappen +8.8 s, unchallenged). | |
| Modelling risk | **Medium.** For: dry, clear, no SC/VSC/red flag reported, no contact or damage among the top three, few stops, and the sim check passed (0.54 s). Against: the decisive margin is 1.3 s, so small pace or traffic errors flip the outcome; Pérez's loss depends on graining (not true wear), traffic from lapped cars and Yas Marina's difficulty of passing, which the sim may not reproduce; sources disagree on Pérez's first-stop compound and stop laps (Jolpica 15/33 vs GPE 16/34); the no-SC claim rests on absence in reports, not on track-status data. | |

## netherlands-2021 (2021 Dutch Grand Prix)

**Lap counting:** the sources count pit laps differently. GPE notes and the MS race report give
stops one lap earlier than Autosport (AS) and the MS lap-by-lap (Hamilton 20 vs 21, Verstappen 21
vs 22, Hamilton 39 vs 40, Verstappen 40 vs 41). This is probably the in-lap vs out-lap convention,
but no source says which it uses. OpenF1 has no 2021 race session (`/v1/sessions?year=2021&
country_name=Netherlands` returned "No results found"), so it could not settle it. The race's
`data/raw` snapshot comes from Jolpica (Jolpica's lap counting).

### Sources

| Short name | What |
|---|---|
| WP | [English Wikipedia, 2021 Dutch Grand Prix](https://en.wikipedia.org/wiki/2021_Dutch_Grand_Prix) (qualifying, grid notes, results table; no race prose) |
| Jolpica | [api.jolpi.ca/ergast/f1/2021/13/results.json](https://api.jolpi.ca/ergast/f1/2021/13/results.json) (fetched 2026-11-09) |
| GPE | [GrandPrix.com race notes](https://www.grandprix.com/races/dutch-gp-2021-race-notes.html) |
| MS-LBL | [Motor Sport lap by lap](https://www.motorsportmagazine.com/articles/single-seaters/f1/verstappen-the-home-hero-with-zandvoort-victory-2021-dutch-gp-lap-by-lap/) |
| MS | [Motor Sport race report](https://www.motorsportmagazine.com/articles/single-seaters/f1/orange-army-hails-verstappen-victory-2021-dutch-grand-prix-race-report/) |
| AS | [Autosport race report](https://www.autosport.com/f1/news/verstappen-takes-home-win-at-dutch-gp/6661121/) |
| AS-strat | [Autosport: Mercedes concedes it got the strategy wrong](https://www.autosport.com/f1/news/mercedes-concedes-it-got-f1-dutch-gp-strategy-wrong/6661186/) |
| OpenF1 | Queried; no 2021 data |

### Facts

| Topic | Fact | Sources | Owner checked |
|---|---|---|---|
| Grid top 6 | Verstappen pole (1:08.885), Hamilton (1:08.923), Bottas, Gasly, Leclerc, Sainz. | WP, Jolpica | |
| Grid penalties | Pérez: back of grid for power-unit elements, then pit-lane start for a new energy store. Latifi: five-place gearbox penalty, then pit-lane start for a front wing and nose change. (Jolpica lists both with grid 0.) | WP, Jolpica, MS | |
| Laps | 72 laps (306.587 km). | WP, Jolpica | |
| Weather | Sunny (WP infobox). No source mentions rain. | WP | |
| SC / VSC / red flag | None mentioned in any race source read. Only incident flag: Vettel spun at Turn 5 (lap 36, GPE; about lap 37, MS-LBL), double-waved yellows in sector 1. Bottas lost about 1.5 s avoiding him (MS-LBL). | GPE, MS-LBL, AS, MS | |
| Start tyres | "The top ten starting on soft tyres" (GPE). Expected plan was softs, then hards between laps 25 and 30 (GPE). Hamilton's first stop was softs to mediums (AS). | GPE, AS | |
| Verstappen stops | Stop 1: lap 21 (GPE) / 22 (AS, MS-LBL), to mediums, a lap after Hamilton; quicker stop than Hamilton's (MS, AS). Stop 2: lap 40 (GPE) / 41 (AS, MS-LBL), to hards, a lap after Hamilton; rejoined in the lead, 2.9 s ahead (GPE). MS-LBL calls his first stop slow, which contradicts MS and AS. | GPE, AS, MS, MS-LBL | |
| Hamilton stops | Stop 1: lap 20 (GPE, MS) / 21 (AS, MS-LBL), softs to mediums, an undercut try. Slow front-right change (AS); 3.6 s, 0.9 s slower than Verstappen (MS). Rejoined 3rd, 13 s behind Bottas (AS). Stop 2: lap 39 (GPE) / 40 (AS, MS-LBL), to another (scrubbed, AS) set of mediums. He came out in lapped traffic (AS, AS-strat, MS-LBL). Stop 3: lap 70 (GPE, MS-LBL), to softs, for fastest lap. | GPE, AS, MS, MS-LBL, AS-strat | |
| Bottas stops | Run long for a one-stop (MS, AS-strat, MS-LBL). Led after the leaders' first stops; Verstappen passed him on lap 30 (AS). GPE: on lap 30 Bottas let Hamilton through for 2nd. Stop 1: lap 32, to mediums (GPE, AS); MS-LBL says about lap 29. A lapped Vettel cost him about 1 s at Turn 3 (AS). Stop 2: lap 67/68, a precautionary stop of about 5 s (AS: vibration) onto softs (MS-LBL, GPE). | GPE, AS, MS, MS-LBL, AS-strat | |
| Gasly stops | Lap 24 (GPE) / 25 (MS-LBL), from 4th to mediums, rejoined 7th. Second stop: not in sources. | GPE, MS-LBL | |
| Leclerc stops | To hards from 4th (GPE); lap not in sources. Finished on hards (AS). | GPE, AS | |
| Sainz stops | Lap 32, to hards (GPE). | GPE | |
| Result top 6 | 1 Verstappen 1:30:05.395; 2 Hamilton +20.932; 3 Bottas +56.460 (GPE: +56.450); 4 Gasly, 5 Leclerc, 6 Alonso (grid 9), all +1 lap. Sainz 7th. | WP, Jolpica, AS, GPE | |
| Gaps during the race | Verstappen over Hamilton: 2.8 s (lap 10), 1.6 s (lap 32), 3.0 s (lap 41), 3.1 s (lap 50), 3.2 s (lap 60), 4.0 s (lap 65). (GPE gives these with no driver labels; read as leader to 2nd.) The final 20.9 s includes Hamilton's lap-70 stop. | GPE, WP | |
| Retirements | Mazepin: 41 laps, hydraulics (Jolpica); water leak (WP); retired by Haas lap 44 (MS-LBL). Tsunoda: 48 laps, power unit (Jolpica); "engine failure" (WP); technical issue lap 51 (MS-LBL). Russell: 69 laps, gearbox (Jolpica), classified 17th; WP lists a battery problem. WP's cause for Schumacher does not match Jolpica (+3 laps, classified 18th). | Jolpica, WP, MS-LBL, AS | |
| Penalties | Russell: five seconds for pit-lane speeding (GPE). No other race penalties in sources. | GPE | |
| Contact | Lap 1: Giovinazzi hit the back of Alonso; both continued (MS-LBL). Pérez locked up and flat-spotted his tyres behind Mazepin around lap 8-9 and had to make an extra stop (MS, MS-LBL). | MS-LBL, MS | |
| Team orders | Bottas was used as a one-stop buffer for Hamilton (MS-LBL). McLaren let Norris past Ricciardo for 10th around lap 47 (MS-LBL). GPE: Bottas let Hamilton through on lap 30. Bottas went for fastest lap against instructions, then Hamilton stopped for it (MS-LBL, AS). | MS-LBL, GPE, AS | |
| Fastest lap | Hamilton 1:11.097 on lap 72, a lap record (WP, Jolpica, GPE). Bottas 2nd fastest on lap 69 (Jolpica). | WP, Jolpica, GPE | |
| Strategy (Mercedes) | Mercedes saw "a sniff of an undercut" with Hamilton but mistimed it. It avoided a one-stop for Hamilton because the hard tyre was unknown. Hamilton's second stop was wasted in traffic, and it did not expect Red Bull to switch to hards, which removed any chance of forcing a third stop (Wolff, AS-strat). | AS-strat | |

### Proposal (draft, for the owner)

| Item | Draft | Owner checked |
|---|---|---|
| Dilemma (original wording) | Mercedes uses both cars against a quicker Red Bull: Hamilton undercuts, Bottas runs long. Does Verstappen cover each stop, and does he gamble on the unknown hard? | |
| Side | Verstappen (draft). `pipeline hard-calls` decides. Hamilton had more stops (3) and made the strategy calls, so he may win the count. | |
| Target | `defend`: Verstappen wins from pole, covering Hamilton's two undercut attempts (laps 20/21 and 39/40). Alternative if the side is Hamilton: `beat-rival` Verstappen. | |
| Side really won? | Verstappen: yes (so no rewrite). Hamilton: no (2nd, +20.932). | |
| Storyline drivers | Hamilton (undercut threat, two-stop, late fastest-lap stop); Bottas (long first stint, leads, later stop for softs). | |
| Risk | **Medium.** (1) Stop laps are off by one lap between sources. (2) No SC/VSC, and Verstappen won by 20.9 s, so a Hamilton-side `beat-rival` target may be out of reach (the gap was 3-4 s before Hamilton's lap-70 stop). (3) A Verstappen `defend` target may be too easy. (4) Bottas's 2nd stop and Hamilton's 3rd were fastest-lap stops, not strategy calls. (5) Leclerc's and Gasly's second stop laps are not in sources. (6) Retirement causes differ between WP and Jolpica. (7) No OpenF1 or `data/raw` data to cross-check. | |

## Notes for the owner

- **Spec §4 dilemmas and draft targets** are taken from each race's proposal: great-britain-2023
  `position` (Piastri on the podium), japan-2023 `beat-rival` (Russell ahead of Hamilton),
  emilia-romagna-2024 `win` (Norris beats Verstappen), abu-dhabi-2022 `beat-rival` (Pérez ahead
  of Leclerc), netherlands-2021 `defend` (Verstappen wins from pole).
- **Target counts** (spec §6): `win` 38 to 37 (miami-2024 and brazil-2021 out,
  emilia-romagna-2024 in), `defend` 27 to 25 (great-britain-2022, singapore-2023 and
  monaco-2025 out, netherlands-2021 in), `position` 20 to 21 (great-britain-2023), `beat-rival`
  8 to 10 (japan-2023, abu-dhabi-2022).
- **Waves** (build plan): all five replacements need no new model (wave A, 34 to 35);
  great-britain-2022 had a red flag (wave B, 66 to 65).
- **Tracks** (`2.5-track-maps.md`): great-britain-2023 is a copy of great-britain-2022
  (`silverstone-8`), japan-2023 of japan-2024 (`suzuka-2`), abu-dhabi-2022 of abu-dhabi-2021
  (`yas-marina-2`), netherlands-2021 of netherlands-2022 (`zandvoort-5`); emilia-romagna-2024
  is from the MultiViewer circuit API (Imola, key 6; it serves the 2022 lap, same `imola-3`
  layout) with a stand-in pit lane.
- **Incidents** (`2.6-drivers-incidents.md`): japan-2023 gets its lap-14 VSC (debris from Pérez
  and Magnussen) and great-britain-2023 its lap-33 SC (Magnussen); abu-dhabi-2022,
  emilia-romagna-2024 and netherlands-2021 have none. japan-2023's lap-1 SC is before the
  takeover and isn't entered.
- **Raw data:** abu-dhabi-2022 and netherlands-2021 are Jolpica builds (`data/raw/*.jolpica.json`,
  `.parquet`, `.status.json`, `data/estimates/*.sc.json`: estimated compounds and SC);
  emilia-romagna-2024 and great-britain-2023 are OpenF1 ingests (`.parquet`, `.status.json`,
  `.weather.json`). OpenF1 lists two 2024 races in Italy, so emilia-romagna-2024 is found by
  `location` (`ingest.ingest_openf1`, new `location` argument); great-britain-2023 is found by
  OpenF1's country name, "United Kingdom". japan-2023's raw files were already in the repo.
- **Removed races:** their catalog rows, pools entries and `era_races` rows go. As in the first
  batch, their rules-only overlays (`data/eras/`), race, golden and raw files, build entries,
  tracks, red-flag files and incident entries stay as Eras-build fixtures (owner-approved);
  `packages/sim/tests/min-stops.test.ts` reads monaco-2025's.
- **D1:** migration `0014_swap_eras_races_e10_e9_b.sql` renames the five `era_races` rows in
  place and deletes the removed races' `era_attempts`, `era_progress` and `history_entries`
  rows.

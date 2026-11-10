# australia-2025 swapped for saudi-arabia-2023 in Era 10 (owner, Nov 9, third batch): owner sign-off

One race is replaced by another race of the same era, in the same slot, as in the second batch
(`swap-races-e10-e9-b.md`, migration 0014), the first batch (`swap-races-e10-e9.md`, migration
0013) and the first four swaps (`swap-races.md`, migration 0012). Every fact below was read in
the linked source on Nov 9, 2026; nothing comes from memory. No team radio is quoted
(GrandPrix.com prints some; it is not reused). Where sources disagree, the row says which was
taken. Check each row against its links and put your initials and the date in **Owner checked**.

| Era / slot | Removed | Why | Replacement | Robust G1 of the replacement (Eras build, rules-only overlay) |
|---|---|---|---|---|
| 10 / #9 | `australia-2025` | Fails G1 (3.43 s, wet-dry duel VER vs NOR) | `saudi-arabia-2023` | pass, 1.03 s (new race, with the `pace_skip` fix) |

australia-2025's G1 number is from `docs/eras-races-report.md`. saudi-arabia-2023's was re-run
here on the merged branch (`pipeline validate saudi-arabia-2023 --robust`: pass, 1.03 s). It
passes only with the sourced fix in `fix-saudi-arabia-2023.md` (Verstappen's post-restart laps
21-22, when he was told to manage his tyres until DRS was enabled on lap 23, are left out of his
pace fit: Eras-only registry key `pace_skip`); without it the race fails (1.88 s). The owner
approved the swap knowing this. That sheet is not redone here.

The replacement is not authored yet (no `eras` block): target, storyline, mastery, hidden
objective and briefing come in B1. `pipeline hard-calls saudi-arabia-2023` (run here, overlay
written to a scratch copy only) gives **VER 2, PER 0**, so the side is Verstappen. The
`user_side` / `rival` pair in `build.py` (PER / VER) is provisional and is left as it was
measured; authoring sets the side. The proposals below are drafts.

The removed race keeps its overlay, race file and build entry (Eras-build fixtures). D1
migration 0015 renames the era_races row and deletes australia-2025's attempts, progress and
history entries.

## Sources

| Short name | What |
|---|---|
| WP | English Wikipedia, https://en.wikipedia.org/wiki/2023_Saudi_Arabian_Grand_Prix (read as wikitext, `action=raw`) |
| AS | Autosport race report (Boxall-Legge, 19 Mar 2023), https://www.autosport.com/f1/news/f1-saudi-arabian-gp-perez-cruises-to-red-bull-1-2-as-penalty-denies-alonso-podium/10446042/ , read via Wayback copy https://web.archive.org/web/20230326210112/https://www.autosport.com/f1/news/f1-saudi-arabian-gp-perez-cruises-to-red-bull-1-2-as-penalty-denies-alonso-podium/10446042/ |
| GPE | GrandPrix.com race notes, https://www.grandprix.com/races/saudi-arabian-gp-2023-race-notes.html |
| Jolpica-R | https://api.jolpi.ca/ergast/f1/2023/2/results.json |
| Jolpica-P | https://api.jolpi.ca/ergast/f1/2023/2/pitstops.json?limit=100 |
| OpenF1 | session 7779: https://api.openf1.org/v1/stints?session_key=7779 , https://api.openf1.org/v1/race_control?session_key=7779 , https://api.openf1.org/v1/weather?session_key=7779 |

## Facts

| Item | Fact | Source | Owner checked |
|---|---|---|---|
| Laps / track | 50 laps of the 6.174 km Jeddah Corniche Circuit, 19 March 2023 | WP | |
| Grid top 6 | Pérez 1, Alonso 2, Russell 3, Sainz 4, Stroll 5, Ocon 6 (Hamilton 7) | Jolpica-R, GPE | |
| Penalties / grid | Leclerc qualified 2nd, 10-place grid penalty (control electronics over quota), started 12th. Verstappen: driveshaft failure in Q2, qualified and started 15th (no penalty) | WP, Jolpica-R, GPE | |
| Weather | Clear (WP infobox). OpenF1: air 25.8-26.4 °C, track 29.9-34.3 °C, no rainfall | WP, OpenF1 | |
| Start | Alonso led into Turn 1; 5 s penalty for incorrect starting location (race control, lap 2). Pérez retook the lead at the start of lap 4 (AS; WP "stay in the lead for three laps") | WP, AS, OpenF1 | |
| SC / VSC / red flag | Stroll stopped on track (WP: lap 17; GPE: lap 18); SC deployed lap 18 per race control, "in this lap" lap 20; WP: SC left at end of lap 20. DRS re-enabled lap 23. No VSC, no red flag in race control | WP, GPE, OpenF1 | |
| Stops before the SC | Stroll lap 13, Gasly 14, Sainz 15, Leclerc 16, Ocon 16 (Jolpica-P; GPE has Leclerc/Ocon lap 17). Sainz M->H, Leclerc S->H (OpenF1) | Jolpica-P, OpenF1, GPE | |
| Front-runners' stops (under SC) | Pérez, Alonso, Russell, Verstappen, Hamilton all stopped lap 18 (Jolpica-P), one stop each. PER, ALO, RUS, VER medium -> hard; HAM started on hard, -> medium (32-lap medium stint, AS). Alonso served his 5 s penalty at this stop (Jolpica-P pit-stop duration 26.879 s vs ~20.7-21.1 s for the other four) | Jolpica-P, OpenF1, AS, WP | |
| Restart order | Pérez, Alonso, Russell, Verstappen, Sainz, Hamilton | WP, GPE | |
| VER recovery | Passed Russell with DRS (AS: into Turn 27) and Alonso for 2nd on lap 25 (GPE; WP "end of the following lap"). Gap to Pérez then 5.4 s (AS); 5.0 s at lap 30 and 4.4 s at lap 40 (GPE); VER reported a driveshaft concern, gap back to 5.2 s (AS); 7.1 s before the last lap (AS); fastest lap 1:31.906 on lap 50 (WP) | AS, GPE, WP | |
| Team orders | None imposed between the Red Bulls: AS says Pérez asked to slow things down and was told it was open season (paraphrase). GPE: Leclerc wanted team orders to pass Sainz (not given in sources) | AS, GPE | |
| Result top 6 | Pérez 1:21:14.894; Verstappen +5.355; Alonso +20.728; Russell +25.866; Hamilton +31.065; Sainz +35.876 | Jolpica-R, GPE | |
| Alonso post-race | 10 s penalty after the podium (jack touching car while serving the 5 s), dropping him to 4th; rescinded on Aston Martin's petition for review, 3rd reinstated | WP, GPE, OpenF1 | |
| Other penalties / flags | Hamilton black-and-white flag for weaving on the straight (lap 9) | OpenF1 | |
| Contact | Lap 1: Piastri hit Gasly exiting Turn 2, pitted for a front wing (Jolpica-P lap 1); Norris ran over debris, pitted lap 2 | WP, Jolpica-P | |
| Retirements | Stroll lap 16 classified, engine (WP); Albon 27 laps, brakes (WP, Jolpica-R). Bottas 49 laps, lapped | WP, Jolpica-R | |

## Strategy dilemmas (from sources)

1. **SC on lap 18 vs early stoppers.** Sainz, Leclerc and Ocon had stopped for hards on laps
   15-16; the SC let the leaders stop cheaply (WP, Jolpica-P). Faced by everyone ahead of the
   SC; it decided Pérez, Alonso, Russell and Verstappen stopping on the same lap.
2. **Verstappen from 15th on mediums:** stay out on the opening stint to the SC or stop early;
   then a 30-lap chase of a 5.4 s gap to Pérez on hards with a driveshaft concern (AS, GPE).
3. **Hamilton's contra strategy** (hard start, medium finish; AS).
4. **Alonso's penalty:** served at the SC stop; Russell told to keep within 5 s (AS).

## Proposal

| Item | Proposal | Owner checked |
|---|---|---|
| Storyline drivers | Verstappen (side: `pipeline hard-calls` VER 2, PER 0) and Pérez | |
| Dilemma (original) | From 15th on the grid, Verstappen has to time his only stop and chase down his own team-mate | |
| Draft target | `win`: Verstappen from P15 (target position 1; real road gap to Pérez 5.355 s, Jolpica-R) | |
| Side really won? | No: Verstappen finished 2nd, so a history-book rewrite is allowed (hard-calls picked Verstappen; Pérez, who really won, would get no rewrite) | |
| Risk | **Medium.** G1 now passes (1.03 s) only with the `pace_skip` fix; reachability of a VER win is unmeasured and needs ~5.4 s found over 30 laps with no SC after lap 20, so it depends on stop timing before the SC. Lap numbers differ by one between WP/GPE and Jolpica/OpenF1 for Stroll and the Leclerc/Ocon stops (Jolpica/OpenF1 taken). Alonso's post-race penalty saga is not needed for the story | |

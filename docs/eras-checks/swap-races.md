# Four Eras races swapped (owner, Nov 7): owner sign-off

Four of the 100 races can't be built as authored, so each is replaced by another race of the
same era, in the same slot. Every fact below was read in the linked source; nothing comes from
memory. Where sources disagree, the row says which was taken. Check each row against its links
and put your initials and the date in **Owner checked**.

| Era / slot | Removed | Why | Replacement |
|---|---|---|---|
| 10 / #8 | `brazil-2024` | Wet all race: can't be built | `belgium-2023` |
| 7 / #9 | `brazil-2016` | Wet all race: can't be built | `great-britain-2016` |
| 2 / #1 | `japan-1989` | Senna disqualified after winning on the road: no road gap | `france-1990` |
| 1 / #4 | `san-marino-1985` | Prost disqualified after winning on the road: no road gap | `germany-1986` |

Each replacement's facts support its storyline; none was stopped.

## Sources

| Short name | What |
|---|---|
| WP | English Wikipedia race article (and its lap-leader chart template) |
| MS | Motor Sport magazine archive race report |
| AS | Autosport archive report |
| GPE | GrandPrix.com race report or race notes |
| FIA | FIA race report (api.fia.com) |
| RF | RaceFans |
| Jolpica | Jolpica results (`api.jolpi.ca/ergast/f1/<year>/<round>/results`, fetched Nov 7, 2026) |

## Per race

| Race | Facts verified | Sources | Dilemma (spec §4) | Target (draft) | Owner checked |
|---|---|---|---|---|---|
| `belgium-2023` (Era 10 #8) | **Grid:** Verstappen fastest in qualifying but a five-place grid penalty (one of the two sets of gearbox parts changed beyond his allocation) put him 6th; Leclerc pole, Pérez 2nd, Hamilton 3rd (Jolpica: VER grid 6). **Race:** 44 laps. Sainz and Piastri collided at Turn 1 (Piastri out). Verstappen passed Hamilton on lap 6 and Leclerc on lap 9, then Pérez on the Kemmel straight on lap 17 for a lead he kept. **Stops:** Verstappen end of lap 14 and lap 30 (FIA; OpenF1: in-laps 14 and 30); Pérez lap 12 (FIA) / 14 (WP), OpenF1 in-lap 13. **Weather:** dry with a shower from about lap 18-20; nobody pitted for intermediates. **SC/VSC/red flag:** none (OpenF1 track status: green and yellow only). **Result:** Verstappen won by 22.305 s from Pérez, Leclerc 3rd. | [WP](https://en.wikipedia.org/wiki/2023_Belgian_Grand_Prix), [FIA](https://api.fia.com/news/f1-max-verstappen-wins-belgian-grand-prix-ahead-sergio-perez-and-charles-leclerc), [RF penalty](https://www.racefans.net/2023/07/28/verstappen-to-get-grid-penalty-for-gearbox-change-at-spa/), [GPE notes](https://www.grandprix.com/races/belgian-gp-2023-race-notes.html), Jolpica, OpenF1 | Verstappen wins from sixth after a gearbox penalty | win: Verstappen from P6 | |
| `great-britain-2016` (Era 7 #9) | **Grid:** Hamilton pole, Rosberg 2nd, Verstappen 3rd, Ricciardo 4th; Vettel started 11th on a grid penalty. **Race:** 52 laps; rain just before the start, so it started behind the safety car on full wets; the SC came in at the end of lap 5. Wehrlein's spin into the Turn 1 gravel brought a brief VSC, under which Hamilton, Rosberg, Verstappen and Pérez changed to intermediates (end of lap 7, GPE; TUM: all three leaders in on lap 7). Verstappen passed Rosberg for 2nd (lap 16, WP; "shortly after lap 15", GPE). Slicks: Hamilton and Rosberg end of lap 17, Verstappen after leading lap 18 (GPE; TUM: in-laps 17, 17, 18). Rosberg retook 2nd on lap 38, then had a gearbox problem and was told to avoid seventh gear. **Penalty:** Rosberg 10 s after the race for the radio instruction, dropping him to 3rd. **Weather:** wet at the start, dry later. **Red flag:** none. **Result:** Hamilton, Verstappen, Rosberg (after the penalty), Ricciardo. | [WP](https://en.wikipedia.org/wiki/2016_British_Grand_Prix), [GPE report](https://www.grandprix.com/races/british-gp-2016-race-report-home-alone.html), Jolpica, TUM | A wet start that dries: when to switch tyres, Verstappen vs Rosberg | position: Verstappen on the podium | |
| `france-1990` (Era 2 #1) | **Grid:** Mansell pole, Berger, Senna, Prost, Nannini, Patrese, Capelli 7th, Boutsen, Piquet, Gugelmin 10th (WP, MS, Jolpica). **Race:** 80 laps, hot, dry and sunny; no safety car (before 1993). Berger led laps 1-27. Goodyear and Pirelli predicted at least one tyre stop (MS); the leaders stopped from lap 20 on, and Capelli led from the end of lap 33 with Gugelmin 2nd: Leyton House was "the only team to attempt to race without stopping for fresh tyres" (WP), and both stayed out on the same tyres (MS). Prost passed Gugelmin on lap 54; Gugelmin's engine lost oil pressure a few laps later (Jolpica: 58 laps). Prost caught Capelli about lap 60 but could not pass until lap 78, three from the end, as Capelli's Judd hesitated (MS, WP chart, GPE; WP's text says lap 77). **Penalties:** none in the race (de Cesaris disqualified: Jolpica; underweight: WP). **Result:** Prost won by 8.626 s from Capelli; Senna, Piquet, Berger, Patrese. Stops entered in the reconstruction facts (r2 check). | [WP](https://en.wikipedia.org/wiki/1990_French_Grand_Prix), [MS](https://www.motorsportmagazine.com/archive/article/august-1990/16/a-touch-of-the-sun/), [GPE](https://www.grandprix.com/gpe/rr491.html), [Autosport archive](https://www.autosport.com/f1/news/archive-when-the-french-gp-almost-produced-f1s-greatest-shock/6578642/), Jolpica | Capelli's Leyton House runs non-stop and leads; Prost closes in | win: Capelli from P7, with no tyre stop | |
| `germany-1986` (Era 1 #4) | **Grid:** Rosberg pole, Prost, Senna, Berger, Piquet, Mansell (WP, AS, Jolpica). **Race:** 44 laps of the long Hockenheim (6.802 km, WP; 6.797 km, MS), dry (WP); no safety car (before 1993). The 1986 limit was 195 litres; Rosberg and Prost ran minimum boost from the start and their read-outs said they would finish on zero (AS, MS). Senna led lap 1, Rosberg from lap 2, Piquet passed him on lap 6. Piquet stopped twice for tyres (laps 15 and 27, AS; MS says 16 and 28) and took the lead for the last time on lap 39. **Last lap:** Rosberg began it 2nd and ran dry at the first chicane; Prost, 4th after Senna passed him late on, ran dry in the stadium's last two corners, got out and pushed, then walked away (pushing could mean exclusion, MS). Both were classified a lap down ("Out of fuel", Jolpica). Senna also ran out just past the line. **Result:** Piquet, Senna, Mansell, Arnoux, Rosberg 5th, Prost 6th. Stops entered in the reconstruction facts (r2 check). | [WP](https://en.wikipedia.org/wiki/1986_German_Grand_Prix), [AS](https://www.autosport.com/f1/feature/3783/grand-prix-gold-german-gp-1986), [MS](https://www.motorsportmagazine.com/archive/article/september-1986/35/formula-one-german-grand-prix-2), Jolpica | The McLarens save fuel to the 195-litre limit and run dry on the last lap | position: Rosberg makes the fuel last, P2 or better | |

## Notes for the owner

- **germany-1986's target** is written from Rosberg's side (pole, led most laps, 2nd when he
  ran dry). Prost's side is the same call; the hard-call counter (spec §4) picks the side when
  the race is built. "Win" was not drafted: nothing read says the McLarens could have beaten
  Piquet's Honda on fuel.
- **france-1990's target** is from Capelli's side, the strategy call (stop or run to the flag).
  It changes the target counts in spec §6: `beat-rival` 10 to 9, `position` 18 to 19 (with
  germany-1986), `win` stays 37.
- **Wave A** (build plan phase 3) gains `belgium-2023` (it needs only the existing wet model),
  so it is now 33 races and wave B 67.
- **Red flags:** `data/redflags/brazil-2016.json` is removed; neither new race had a red flag.
- **D1:** migration `0012_swap_eras_races.sql` renames the four `era_races` rows in place and
  deletes the removed races' `era_attempts`, `era_progress` and `history_entries` rows.

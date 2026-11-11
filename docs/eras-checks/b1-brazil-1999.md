# B1: Eras content for brazil-1999 (Era 3, #7, swapped in for hungary-1998)

Eras job `eras-swap-hungary-1998`, Nov 10 2026. The owner approved (Nov 10) putting in the
Expert rival grader fix and the player stint-pace fix, and swapping hungary-1998 out of Era 3
for a race that can be won. This sheet records the pick, the swap and the authored content.
Nothing comes from memory. The storyline, dilemma and briefing are original wording; no team
radio is quoted. Check each row against its source, then put your initials and the date in
**Owner checked**.

## Sources

| Short name | Link |
|---|---|
| WP-BRA99 | https://en.wikipedia.org/wiki/1999_Brazilian_Grand_Prix (wikitext, `action=raw`, read Nov 10 2026) |
| Timing | Jolpica-F1 laps and results (CC BY-NC-SA 4.0) in `data/raw/brazil-1999.parquet` and `data/raw/brazil-1999.jolpica.json`, as built into `data/races/brazil-1999.json` |
| F1DB | F1DB v2026.19.0 (CC BY 4.0): stops in `data/raw/f1db/brazil-1999.stops.csv`; `f1db-races.csv` (layout `interlagos-2`, 4.309 km); `f1db-drivers.csv` (Sarrazin's abbreviation SAR) |
| Scout | `docs/eras-checks/scout4-era3.md` (job `eras-scout4-era3`), rows 6-9 |

## The pick

Candidates are the races the Era 3 scouts measured. Every robust-G1 run below is on this branch
(base `eras-integrate-fixes`, which has both fixes), one race per call
(`pipeline validate <id> --robust`, Eras builds, rules-only overlays). The numbers match the
scout's, which were measured without the fixes.

| Race | Robust G1 | Mean gap error | Notes |
|---|---|---|---|
| brazil-1999 | **pass** (strict pass) | **0.36 s** | lowest; picked |
| canada-1996 | pass (strict pass) | 0.42 s | not authored |
| japan-1999 | pass (strict pass) | 4.09 s | not authored; near several limits (scout) |
| others | fail | - | see the scout sheet |

brazil-1999 has the lowest mean gap error of the three passing races, and as authored below it
is reachable at era difficulty and at Legend, so it is the pick. canada-1996 and japan-1999 keep
their rules-only overlays and build entries as measured candidates.

## Model status (with the eras block)

- Robust G1 (`pipeline validate brazil-1999 --robust`): **pass** (strict pass), mean gap error
  0.36 s.
- Reachability (`pnpm --filter @laststint/sim reachability brazil-1999`): **pass** at era
  difficulty (threshold 86, Expert rival; all three stars and the hidden objective on seed 2:
  stop-42 box, pace-59 push and attack, pace-63 push, battle-66 hold) and at Legend (threshold 90,
  Expert rival; seed 3: stop-42 box, pace-59 push, pace-63 push, battle-66 defend). The stay-out
  path earns no star on any seed (accuracy 75.0).

## Facts

| # | Fact | Lap | Source | Note | Owner checked |
|---|---|---|---|---|---|
| 1 | Häkkinen started from pole and led away | 1 | WP-BRA99 | Timing: grid 1 | |
| 2 | On lap 4 Häkkinen's car had a temporary transmission malfunction and could not select gears; Barrichello took the lead and Schumacher also passed him | 4 | WP-BRA99 | | |
| 3 | Barrichello led until his stop on lap 27; Schumacher then took the lead | 27 | WP-BRA99 | F1DB: BAR stop lap 27 | |
| 4 | Schumacher pitted on lap 38, which let Häkkinen past; Häkkinen had been held up by Schumacher and tried to build a gap to stay ahead after his own stop | 38 | WP-BRA99 | F1DB: MSC lap 38, lane 32.552 s | |
| 5 | Lapped traffic delayed Häkkinen at first, then he set a couple of fast laps; he pitted on lap 42 and, with a quick stop, kept the lead over Schumacher | 42 | WP-BRA99 | F1DB: HAK lap 42, lane 30.983 s | |
| 6 | One stop each for Häkkinen and Schumacher | 38, 42 | F1DB | | |
| 7 | Häkkinen won from Schumacher by 4.925 s; Frentzen third | 72 | Timing, WP-BRA99 | Jolpica: 5763.785 s and 5768.710 s. WP's lead says "71-lap race" but its infobox and Jolpica give 72 laps | |
| 8 | At the end of lap 35 (the takeover, D3 rule) Schumacher led, Häkkinen was second 1.146 s behind | 35 | Timing | | |
| 9 | No SC, VSC or red flag is reported. Wurz and Hill collided on lap 10 and Sarrazin crashed on the pit straight on lap 31 after a wing failure | 10, 31 | WP-BRA99 | Jolpica estimate: no periods (`data/estimates/brazil-1999.sc.json`) | |
| 10 | Barrichello's race ended with a blown engine on lap 42 (Diniz spun off on the same lap) | 42 | WP-BRA99 | Already RETIREMENT events in the race file (Jolpica laps) | |
| 11 | Stéphane Sarrazin (Minardi, number 20) drove; F1DB abbreviation SAR | - | F1DB, Timing | drivers.json key SARS (SAR is Logan Sargeant's) | |

## Content

| Item | Value | Rests on | Owner checked |
|---|---|---|---|
| Side | **Häkkinen (HAK)**. `pipeline hard-calls`: HAK 0, MSCM 0, chance given up 0.0 / 0.0, so the race file's side stands. Rival MSCM | the grader, not a fact | |
| Target (★1) | **win** (Häkkinen from P2 at the lap-35 takeover, 1.1 s behind Schumacher) | 7, 8 | |
| Rewrite | none: the side really won | 7 | |
| Storyline (real) | "Häkkinen leads from pole until a transmission glitch on lap 4 lets Barrichello and Schumacher by. Schumacher leads after Barrichello's lap-27 stop, with Häkkinen held up behind him. Ferrari bring Schumacher in on lap 38; Häkkinen pushes for a few laps, stops on lap 42 and comes out still in front. He wins by 4.9 s." | 1-5, 7 | |
| Dilemma (catalog, spec §4) | "Held up behind Schumacher until Ferrari stops first: four laps to push and overcut him" | 4, 5 | |
| Briefing | "Interlagos, 1999. Häkkinen started on pole, but a transmission glitch on lap 4 dropped him behind Barrichello and Schumacher. You run Häkkinen, second after 35 laps and 1.1 s behind Schumacher, both on one stop. Ferrari will pit first: stay out, find the time and win." | 1, 2, 6, 8 | |
| Mastery | `margin` 4.9 s: "Win by more than 4.9 seconds" (his real margin, 4.925 s) | 7 | |
| Hidden | `stop_count` exact 1: "Win on one stop", Häkkinen's real count | 6 | |
| storylineEvents | none: the retirements after the takeover (Fisichella, Barrichello, Diniz, Zanardi, Villeneuve, de la Rosa) are not storyline cars, and neither storyline car retires | 10 | |
| Incidents | `data/incidents.json` `brazil-1999: []` | 9 | |
| Moments | `pnpm --filter @laststint/sim author brazil-1999 --target win --eras --write`: stop-42 (real: box, fill 30 laps, to the flag), pace-59, pace-63, battle-66. Not hand-adjusted. The stop lap is the sourced in-lap 42; the race file's real stop is on the out-lap 43 | 5 | |

## Swap wiring

- `data/pools.json` eras block: Era 3 #7 hungary-1998 -> brazil-1999.
- D1 migration `apps/worker/migrations/0029_swap_eras_races_era3_c.sql` renames the era_races
  row and deletes hungary-1998's attempts, progress and history entries (test in
  `apps/worker/test/eras-migration.test.ts`).
- Catalog dilemma, spec §4 row (target counts unchanged: win for win), build plan appendix,
  appendix entries fixture (from the Jolpica ingest), incidents (none) and the 2.6 row, track
  file (copy of brazil-2019, `interlagos-2`, via `pipeline/scripts/eras_tracks.py`) and the 2.5
  row, F1DB `APPENDIX_RACES`.
- Stéphane Sarrazin added to `data/drivers.json` (key SARS, code SAR, F1DB) and brazil-1999
  re-ingested (`pipeline jolpica brazil-1999 --force`) so his laps carry the key.
- hungary-1998 stays as a rules-only Eras-build fixture: its eras block and its moments file are
  removed (the no-argument reachability run no longer covers it once its race file is rebuilt),
  and it is in the swapped-out list in `packages/sim/tests/pools.test.ts`.

The race files and goldens (brazil-1999, hungary-1998), `races.gen.ts`, `sc_rates.json` and the
legend fixture must be regenerated by the integrator; this branch does not commit them.

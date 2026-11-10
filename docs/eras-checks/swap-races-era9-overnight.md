# Era 9 race swapped overnight (owner pre-approved, Nov 9): owner sign-off

The owner pre-approved (Nov 9) swapping each failing Eras race for the next-best race by
stats. The pick is the race of the same era with the lowest robust-G1 mean gap error. One race
is replaced in Era 9, in the same slot, as in the earlier batches (`swap-races.md`, 0012;
`swap-races-e10-e9.md`, 0013; `swap-races-e10-e9-b.md`, 0014). D1 migration
`0016_swap_eras_races_e9.sql` renames the row.

Every fact below was read in the linked source on Nov 9, 2026. Nothing comes from memory.
Where sources disagree, the row says which one was taken. Check each row against its links and
put your initials and the date in **Owner checked**.

| Era / slot | Removed | Why | Replacement | Robust G1 of the replacement |
|---|---|---|---|---|
| 9 / #5 | `hungary-2021` | Fails G1: mean gap error 4.36 s (podium HAM gap error 7.82 / 8.15 [5.00], +3 more), the worst in Era 9 | `portugal-2021` | pass (strict pass), mean gap error 0.77 s |

The removed race's numbers are from `docs/eras-races-report.md`. The replacement's number was
re-run here on its committed race file (`pipeline validate portugal-2021 --robust`), and it
matches the scout's run. hungary-2021 was the only race left to swap in Era 9. Its
overlay (rules only), race file, build entry and track file stay as Eras-build fixtures.

**portugal-2021 is a Gauntlet (survivor) race**, so it becomes a shared race, like the five Daily
ones (eras build plan, "Shared races"). Its race file, its golden and its Gauntlet hash
(`099e1d5a…`) stay frozen. Its Eras content goes only into `data/eras/portugal-2021.json`, which
the Worker merges in at serve time (`apps/worker/src/erasOverlay.ts`). For now that overlay
holds only the 2021 rules, as the earlier replacements' overlays did. Until B1 authoring, the
Eras model plays the race file's side (VER) and Daily moments, and `reachability:shared` skips
the race because it has no `eras` block.

**Side (draft, for B1):** `pipeline hard-calls portugal-2021`, run on the file merged with the
rules-only overlay (written to a scratch directory, not into the overlay), counts **HAM 1,
VER 0**: Hamilton by hard calls. Chance given up: VER 6.0 points, HAM 0.0. The race file plays
Verstappen (`build.py` user_side VER, rival HAM), so B1 must write `eras.userSide: "HAM"` and
`eras.hardCalls` into the overlay. It must also write `decisionMoments` authored from Hamilton's
side into the overlay, because the Daily moments are Verstappen's. Hamilton really won, so the
race has no rewrite condition or history-book headline (owner decision, Nov 8).

## portugal-2021 (2021 Portuguese Grand Prix)

**Lap counting:** GrandPrix.com (GPE) and Motor Sport's lap by lap (MS-LBL) agree on the
front-runners' stop laps (Verstappen 36, Bottas 37, Hamilton 38, Pérez 52). These are also the
race file's stop laps. The Jolpica pit-stop endpoint gives each of them one lap earlier (35, 36,
37, 51). Jolpica also lists a stop for all 19 running cars on laps 2 and 3. That matches GPE's
note that the field drove through the pit lane behind the safety car to avoid the debris, so
those entries aren't tyre stops. OpenF1 has no 2021 session (`/v1/sessions?year=2021&country_name=Portugal`
returned "No results found"). Autosport's race report answered 403 to a plain fetch, so it
wasn't read.

### Sources

| Short name | What |
|---|---|
| WP | [English Wikipedia, 2021 Portuguese Grand Prix](https://en.wikipedia.org/wiki/2021_Portuguese_Grand_Prix) (raw wikitext: infobox, qualifying and race tables, a short race paragraph, result notes) |
| Jolpica | [api.jolpi.ca/ergast/f1/2021/3/results.json](https://api.jolpi.ca/ergast/f1/2021/3/results.json) and [/pitstops.json](https://api.jolpi.ca/ergast/f1/2021/3/pitstops.json?limit=100) (fetched 2026-11-09) |
| GPE | [GrandPrix.com race notes](https://www.grandprix.com/races/portuguese-gp-2021-race-notes.html) (Mark Karp) |
| MS-LBL | [Motor Sport lap by lap](https://www.motorsportmagazine.com/articles/single-seaters/f1/hamilton-seizes-portimao-victory-2021-portuguese-grand-prix-lap-by-lap-report/) |
| F1DB | [f1db 2021 round 3](https://github.com/f1db/f1db/blob/be8174f1e1433baadfb818dfb13af9bbf447fb16/src/data/seasons/2021/races/03-portugal/race.yml) and the v2026.19.0 CSV (`f1db-races.csv`) |
| OpenF1 | Queried; no 2021 data |

The pages were fetched whole (curl) and read as text, not through a summarising tool.

### Facts

| Topic | Fact | Sources | Owner checked |
|---|---|---|---|
| Event | Round 3 of 2021, 2 May 2021, Algarve International Circuit (Portimão). Layout `portimao-1`, clockwise, 4.653 km, 15 turns. Held behind closed doors. | WP, F1DB, Jolpica | |
| Laps | 66 laps (306.826 km). | WP, Jolpica, F1DB | |
| Weather | WP infobox: light cloud. GPE: a sunny day. No source mentions rain. | WP, GPE | |
| Tyres | Pirelli brought C1, C2, C3 as hard, medium, soft. | WP | |
| DRS | Two zones: a new one between Turns 4 and 5, and the main straight's zone shortened by 120 m, its detection point moved to after the start of Turn 15. | WP | |
| Grid top 6 | Bottas pole (1:18.348), Hamilton (1:18.355), Verstappen, Pérez, Sainz, Ocon; then Norris, Leclerc, Gasly, Vettel. Verstappen's first Q3 lap was deleted for track limits. | WP, Jolpica, GPE | |
| Start tyres | The front four on mediums; Sainz, Ocon, Norris, Gasly and Vettel on softs (GPE). Ricciardo started on mediums (MS-LBL). | GPE, MS-LBL | |
| Start | Bottas kept the lead. Hamilton held off Verstappen for 2nd (MS-LBL; WP's race paragraph has Verstappen 2nd into Turn 1). Sainz passed a slow-starting Pérez for 4th. | MS-LBL, WP, GPE | |
| Safety car | Räikkönen hit Giovinazzi's car and lost his front wing on the main straight: end of lap 1 (WP), as the field crossed the line for lap 2 (MS-LBL), lap 2 (GPE). Räikkönen retired (Jolpica: Collision damage, 1 lap). Giovinazzi continued without damage (WP). SC withdrawn on the opening of lap 7 (MS-LBL). The field drove through the pit lane to avoid the debris (GPE). | WP, MS-LBL, GPE, Jolpica | |
| Restart | Bottas restarted the pack late. Hamilton was caught out and Verstappen went round the outside into 2nd at Turn 1. | MS-LBL | |
| Hamilton retakes 2nd | Entering lap 11, Verstappen got out of shape at Turn 14; Hamilton passed him with DRS into Turn 1. | MS-LBL | |
| Gaps lap 15 | Bottas leads Hamilton by 0.7 s; Verstappen +2.2, Pérez +10.0, Norris +12.1, Sainz +13.7, Leclerc +15.1. Pérez passed Norris for 4th on lap 15. | GPE, MS-LBL | |
| Lead change | Hamilton passed Bottas around the outside of Turn 1 on lap 20 (GPE: "on lap 20"; MS-LBL: "going onto lap 20"). | GPE, MS-LBL | |
| First stops (midfield) | Sainz lap 22 from 6th, softs to mediums, rejoined 15th. Norris and Ocon lap 23. Gasly lap 25. Leclerc lap 26, mediums to hards, the first front-runner on hards. | GPE, MS-LBL | |
| Hamilton's tyres | GPE quotes Hamilton telling the team about the tyre wear. Team radio: not quoted or used. | GPE | |
| Verstappen | Complained he couldn't use third gear (GPE, no lap given; around lap 28-30 in the notes' order). | GPE | |
| Gaps lap 30 | Hamilton leads Bottas by 3.3 s; Verstappen +3.7, Pérez +12.7. | GPE | |
| Mercedes' undercut plan | Bottas was told he'd be pitted to protect against a Red Bull undercut if the gap reached 3.5 s. By lap 34 it was around that, but Verstappen fell out of DRS range and Mercedes kept both cars out. | MS-LBL | |
| Leaders' stops | Verstappen lap 36 from 3rd, to hards; rejoined behind Pérez (GPE). Bottas lap 37 from 2nd, to hards, came out ahead of Verstappen; on cold tyres he got out of shape at Turn 4 and Verstappen passed him into Turn 5 (GPE; MS-LBL: "allowing Verstappen a run down the hill"). Hamilton lap 38, to hards, rejoined with the lead in hand (MS-LBL) / 2nd ahead of Verstappen behind the unstopped Pérez (GPE). | GPE, MS-LBL; race file stop laps 36 / 37 / 38 | |
| Gaps lap 40 | Pérez (not stopped) leads Hamilton by 11.8 s; Verstappen +14.9, Bottas +18.3. | GPE | |
| Pérez | Kept out as long as possible for one stop onto softs (MS-LBL). Hamilton passed him with DRS on lap 51. Pérez stopped on lap 52 for softs and rejoined 4th. | MS-LBL, GPE | |
| Bottas chase | Toto Wolff told Bottas to push on lap 44 (MS-LBL; GPE: Wolff urged him). Bottas got within 1.7-1.8 s of Verstappen. On lap 55 he lost power: an exhaust temperature sensor (MS-LBL); a power-unit sensor warning (GPE). Fixed quickly, but it ended his chase. | MS-LBL, GPE | |
| Gaps lap 53 / 60 | Lap 53: Hamilton leads Verstappen by 4.9 s, Bottas +6.5, Pérez +32.5. Lap 60: Verstappen +5.2, Bottas +10.4, Pérez +37.8. | GPE | |
| Late stops for fastest lap | Bottas lap 64 for softs, Verstappen lap 65 for softs (GPE; MS-LBL: "with three to go"). | GPE, MS-LBL | |
| Fastest lap | Bottas 1:19.865 on lap 65. Verstappen's 1:19.849 on lap 66 was deleted for track limits. | WP, GPE, Jolpica | |
| Result top 6 | Hamilton 1:34:31.421; Verstappen +29.148; Bottas +33.530; Pérez +39.735; Norris +51.369; Leclerc +55.781. Then Ocon, Alonso, Ricciardo, Gasly (points). | Jolpica, WP, GPE | |
| Alonso's gap | Jolpica gives Alonso (8th) "+1.808" (millis 5673229, 1.808 s after the winner's 5671421), which can't be right for 8th place behind Ocon at +1:03.749. GPE gives +1m04.808s, which was taken. | GPE, Jolpica | |
| Retirements | Räikkönen only (lap 1, collision damage). 19 classified. | Jolpica | |
| Penalties | Mazepin: 5 s for ignoring blue flags; no change to his last place. | WP | |
| SC / VSC / red flag after the takeover (lap 32) | None in WP, GPE or MS-LBL. The built race file has no events. | WP, GPE, MS-LBL | |
| Team orders | None in any source read. | WP, GPE, MS-LBL | |
| Championship | Hamilton's 97th win; leads Verstappen by 8 points. | GPE, MS-LBL | |

### Proposal (draft, for the owner)

- **Key dilemma.** Hamilton leads on mediums from lap 20, with Bottas and Verstappen close
  behind, and everyone needs one stop to hards. Red Bull stops Verstappen first (lap 36). Bottas
  covers him a lap later and loses the place on cold tyres. Hamilton stops last (lap 38) and
  keeps the lead. Then he has to pass a one-stopping Pérez, who is kept out until lap 52.
- **Target (draft):** `defend`: Hamilton holds P1. He leads at the lap-32 takeover (race file
  `stateAtTakeover` position 1). In the spec §4 table this is
  "defend: Hamilton holds P1".
- **Catalog dilemma (in `catalog.ts` and spec §4):** "Leading on worn mediums with Verstappen in
  the mirrors: stop for hards before Red Bull tries the undercut, or stretch the stint". Original
  wording; nothing quoted.
- **No rewrite:** Hamilton really won.
- **Left for B1:** eras block (side HAM, hardCalls, target, storyline real text, mastery, hidden,
  briefing), decisionMoments from Hamilton's side, all in `data/eras/portugal-2021.json` only;
  then `pnpm --filter @laststint/worker reachability:shared portugal-2021`.

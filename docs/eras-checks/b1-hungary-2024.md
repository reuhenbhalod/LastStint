# B1: hungary-2024 (Era 10)

Eras job B1, Nov 9 2026. hungary-2024 passes robust G1 at `eras` 973d827 (2.52 s; LEC 4.82 /
4.83, VER 4.77 / 4.89 [5.00]) but wasn't authored. It is an Eras-only race (in no Daily or
Gauntlet pool; checked in `data/pools.json`), so its overlay is built into its race file, as for
europe-1997 (`docs/eras-checks/b1-europe-1997.md`). Every fact below was read in the linked
source; nothing comes from memory. Check each row against its link, then put your initials and
the date in **Owner checked**.

Where the content lives:
- `data/eras/hungary-2024.json`: the `eras` block (target, storyline, mastery, hidden, briefing,
  `eraId`, `order`, `hardCalls` / `userSide`). No `storylineEvents`: the race has no safety car
  or VSC; Verstappen's lap-63 contact is already a storyline event (A4), and Legend always keeps
  retirements and team orders (`legend.ts isKept`).
- `data/moments/hungary-2024.json`: the four decision moments, built into the race file.
- `data/incidents.json` (unchanged): McLaren's swap on lap 68 (TEAM_ORDER, M4, sourced to
  WP-HUN24) and Verstappen's lap-63 contact (FAULT/damage, A4, `docs/eras-checks/a4-contact-damage.md`).
- `data/races/hungary-2024.json`: rebuilt (`uv run pipeline build hungary-2024`), now from
  Piastri's side (`userSide` PIA, `rival` NOR; it was built for Norris before). Golden unchanged.

## Sources

| Short name | Link |
|---|---|
| WP-HUN24 | https://en.wikipedia.org/wiki/2024_Hungarian_Grand_Prix (read as wikitext, `action=raw`) |
| GP-HUN24 | https://www.grandprix.com/races/hungarian-gp-2024-race-notes.html (page HTML read directly, tags stripped) |
| JOL-PITS | https://api.jolpi.ca/ergast/f1/2024/13/pitstops.json (CC BY-NC-SA 4.0) |
| JOL-L14 | https://api.jolpi.ca/ergast/f1/2024/13/laps/14.json |
| JOL-LAPS | https://api.jolpi.ca/ergast/f1/2024/13/drivers/piastri/laps.json and `.../norris/laps.json` |
| JOL-ST12 | https://api.jolpi.ca/ergast/f1/2024/12/driverStandings.json (standings before the race; not used in the text) |

Both GP-HUN24 and WP-HUN24 were read as the page text itself, not through a summarising tool.

## Side (owner decision: Eras plays the side with more hard calls)

`pipeline hard-calls hungary-2024` (grader samples: default), run before and after the `eras`
block was written (same result):

| Race | Hard calls | Chance given up by the real calls (pts) | Eras side | Owner checked |
|---|---|---|---|---|
| hungary-2024 | PIA 2, NOR 0 | PIA 2.7, NOR 99.7 | PIA (more hard calls) | |

So the player runs Piastri, not Norris. The McLaren team order is given to Norris (the rival),
so it stays a scripted event (`TEAM_ORDER`, lap 68) and is not a player moment.

## The race: facts used in the authored text

| Item | Fact | Source | Owner checked |
|---|---|---|---|
| Event | Hungaroring, 21 July 2024, round 13 of 2024, 70 laps | WP-HUN24 | |
| Grid | Norris on pole, Piastri second (classification "Grid" column); McLaren's first front-row lockout since the 2012 Brazilian GP | WP-HUN24 (GP-HUN24: "the first McLaren front row in 12 years") | |
| Start | Piastri took the lead from Norris at the start / into the first corner | WP-HUN24; GP-HUN24 | |
| Takeover | End of lap 14 (the race file's takeover): Piastri P1, Norris P2 3.408 s behind (sum of each driver's first 14 Jolpica lap times; the race file's `gapAhead` 3.408), Verstappen P3. Briefing: "3.4 s" | JOL-L14 (positions), JOL-LAPS (gap) | |
| First stops | Norris stopped first (Jolpica: lap 17, Piastri lap 18; GP-HUN24 gives laps 17 and 19), both onto hards; Piastri stayed ahead | JOL-PITS; GP-HUN24 | |
| Second stops | Norris stopped first again (Jolpica: lap 45, Piastri lap 47; GP-HUN24: laps 45 and 48), onto mediums; Norris took the lead by the undercut | JOL-PITS; GP-HUN24; WP-HUN24 ("gained the lead via an undercut") | |
| Norris's lead | About six seconds: GP-HUN24 has 6.0 s at lap 65; WP-HUN24 "a six-second lead" | GP-HUN24; WP-HUN24 | |
| Team order | McLaren asked Norris to swap with Piastri over the closing stages (WP: "over a twenty-lap period"); he slowed on the start-finish straight on lap 68 and gave Piastri the lead | WP-HUN24; JOL-LAPS (PIA P1 at the end of lap 68) | |
| Result | Piastri won (his first F1 win), Norris second, 2.141 s behind; McLaren's first one-two since the 2021 Italian GP; Hamilton third | WP-HUN24; GP-HUN24 | |

Not used: anything from team radio (GP-HUN24 quotes McLaren's messages to Norris; never quoted).

## The `eras` block

| Field | Value | Basis | Owner checked |
|---|---|---|---|
| `eraId` / `order` | 10 / 7 | `data/pools.json` eras["10"], seventh; spec §4 Era 10 table, #7 | |
| Target | `team` [2, 2]: both McLarens in the top two, in either order ("Bring the McLarens home one-two") | Spec §4 draft "team: McLaren 1–2", the same form as austria-2002's ★1. Piastri ahead isn't needed for ★1 (that's the mastery) | |
| Storyline (`real`) | Piastri leads from the start; Norris stops first both times and comes out ahead after the second stops, then pulls about six seconds clear; McLaren keep asking him to give the lead back, and he does on lap 68: Piastri wins his first GP by 2.1 s, McLaren's first one-two since the 2021 Italian GP | Rows above | |
| Rewrite | None. Piastri really won and McLaren really finished one-two (owner decision: no rewrite if the side really won). History-book totals drop by one (tests updated) | WP-HUN24 | |
| Mastery | `finish_position` 1: "Win the race yourself" | The real result was P1, so this asks for the win plus no orange or red call (★3 rule) | |
| Hidden | `mode_rule` push, `maxLaps` 0: "Finish without a single push lap" | A margin objective (5 s, then 3 s) was tried first and was not reachable at Legend: the sim's Piastri wins there by 0.3-1.5 s | |
| Briefing | Hungaroring, July 2024; Norris pole, Piastri alongside, McLaren's first front-row lockout since 2012, Piastri led into the first corner; you run Piastri, 3.4 s ahead of Norris after 14 laps, Verstappen third | Rows above | |

## Moments (`pnpm --filter @laststint/sim author hungary-2024 --target team:2:2 --eras --write`)

Grades are the author run's (team target, takeover state).

| Moment | Options | Real | Note |
|---|---|---|---|
| stop-18 | stay / box softs / box mediums / box hards / box hards next lap | box hards (the race file's stop on lap 19, from the timing; the call is made on lap 18) | stay 78% red, softs 90% orange, mediums 95%, hards 94% green |
| pace-22 | push / standard / manage / push and attack | — | standard 93% green; manage orange |
| pace-26 | push / standard / manage / push and attack | — | push and standard 93% green; manage orange |
| stop-47 | stay / box softs / box mediums / box hards / box hards next lap | box mediums (race file: lap 48) | stay 0% red; every box option 98-99% |

The moment finder's `rivalpit-45` (Norris's second stop) graded no-choice on the team target (every
option 99%), so it was not kept.

## Reachability (`pnpm --filter @laststint/sim reachability hungary-2024`)

| Level | Result | Best path | Stay-out |
|---|---|---|---|
| Era (threshold 70, Standard) | ★1 ★2 ★3, hidden yes, accuracy 100 | stop-18 box hards, pace-22 standard, pace-26 standard, stop-47 box hards next lap | no ★1, no ★3, on seeds 1-3 (accuracy 40-44) |
| Legend (90, Expert) | ★1 ★2 ★3, hidden yes, accuracy 100 | stop-18 box mediums, pace-22 manage, pace-26 manage, stop-47 box softs | no ★1, no ★3, on seeds 1-3 |

The real path (hards, standard, standard, mediums) also earned all three stars at era difficulty
(seed 2, in a run of the same moments with the earlier margin objective); it has no push lap, so
it meets the hidden objective too.

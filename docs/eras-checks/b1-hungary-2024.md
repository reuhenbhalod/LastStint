# B1: Eras content for hungary-2024 (Era 10, #7)

Eras job B1 (author a passing race), Nov 9 2026. Every fact below was read in the linked
source on Nov 9 2026. Nothing comes from memory. The storyline and briefing are original
wording; no team radio is quoted. Check each row against its source, then put your initials
and the date in **Owner checked**.

## Sources

| Short name | Link |
|---|---|
| WP-HUN24 | https://en.wikipedia.org/wiki/2024_Hungarian_Grand_Prix (read as plain text, MediaWiki `action=raw`) |
| Timing | FastF1 live timing (`data/raw`), as built into `data/races/hungary-2024.json` |
| A4 | `docs/eras-checks/a4-contact-damage.md` (VER-HAM contact, lap 63) |
| M4 | `docs/eras-checks/m4-scripted-events.md` (McLaren team order, lap 68) |

## Model status

- Robust G1 before (`eras` at abcf03c, `pipeline validate hungary-2024 --robust`): **pass** on
  both seed sets, mean gap error 2.52 s. Closest checks: field LEC 4.82 / 4.83, VER 4.77 / 4.89
  (limit 5.00). The A4 borderline (LEC 5.02 on one seed set) no longer reproduces on `eras`, so
  no model change was made.
- After authoring (registry duel PIA vs NOR, overlay side PIA): **pass** on both seed sets,
  2.52 s; duel PIA vs NOR gap error 0.53 / 0.57 (limit 3.00), order rate 0.99.
- Reachability (`pnpm --filter @laststint/sim reachability hungary-2024`): pass at era
  difficulty (threshold 70, Standard rival) and at Legend (90, Expert rival). The stay-out path
  never earns a star. It does meet the hidden objective (no soft tyre) on two seeds, but not ★3.

## Content

| Item | Value | Fact it rests on | Source | Owner checked |
|---|---|---|---|---|
| Side | PIA (hard calls PIA 2, NOR 0; `pipeline hard-calls`) | the grader, not a fact | - | |
| Target | `team`, positions [2, 2]: both McLarens in the top two (spec: "team: McLaren 1-2") | Piastri won, Norris second, +2.141 | WP-HUN24 classification | |
| Rewrite | none: the side really won | Piastri won | WP-HUN24 | |
| Storyline | "Piastri leads from the first corner, but Norris gets ahead with the earlier second stop..." | "Polesitter Lando Norris lost position to teammate Oscar Piastri at the start"; "Norris was first up to pit for mediums ... soon after, race-leading Piastri came in for mediums"; Norris "had gained the lead via an undercut" | WP-HUN24 race report | |
| Storyline | "...McLaren tell Norris to give the place back; he does on lap 68" | "McLaren invoked team orders asking Norris ... to swap positions with Piastri. Eventually, Norris slowed down at the start-finish straight on lap 68" | WP-HUN24; M4 | |
| Storyline | "Piastri takes his first win by 2.1 s" | "giving Piastri the lead and eventual maiden race win"; NOR +2.141 | WP-HUN24 | |
| Storyline | "McLaren's first one-two since Italy 2021" | "This was McLaren's first 1–2 finish since the 2021 Italian Grand Prix." | WP-HUN24 | |
| Briefing | "Norris and Piastri lock out the front row, McLaren's first since Brazil 2012" | "Oscar Piastri qualified second, which meant that McLaren secured a front-row lockout, their first since the 2012 Brazilian Grand Prix." (Norris on pole) | WP-HUN24 qualifying report | |
| Briefing | "Piastri takes the lead from Norris at the start" | as above | WP-HUN24 | |
| Briefing | "You run Piastri, 3.4 s ahead of Norris after 14 laps" | PIA P1, NOR P2 gap 3.408 s at the end of lap 14 (the takeover lap, D3 rule) | Timing | |
| Mastery | `stop_count` exact 2: "McLaren one-two on two more stops, as Piastri made" | PIA stopped on laps 19 (hard) and 48 (medium) | Timing | |
| Hidden | `compound_rule` mustAvoid SOFT: "McLaren one-two without running the soft tyre" | PIA ran medium, hard, medium | Timing | |
| storylineEvents | [63, FAULT] (VER's contact; already flagged by the build), [68, TEAM_ORDER] | VER-HAM contact lap 63; the team order on lap 68 | A4; M4 | |

## Notes

- The hidden objective was first "win by more than 3 s", then 2 s: neither is reachable at
  Legend (the Expert Norris finishes too close after the scripted swap). The no-soft rule is
  reachable on both difficulties.
- Moments (`pnpm --filter @laststint/sim author hungary-2024 --target team:2:2 --eras --write`):
  stop-18, pace-22, pace-26, stop-47 (`data/moments/hungary-2024.json`).
- The registry entry in `pipeline/build.py` was a validation race (automatic duel); it is now
  registered PIA vs NOR, as hungary-2022 was for its side.
- `data/races/hungary-2024.json` must be rebuilt by the integrator (`pipeline build
  hungary-2024`); this branch does not commit it.

---

## Appendix: the PC authoring of this race (integrations B and C, origin/eras)

Merged in integration PC (Nov 10 2026). This race was authored twice, on the Mac (above) and on
the PC (below). The game ships the Mac content above (`data/eras`, `data/moments` from local
`eras`, validated in the 100-race set); the PC sheet is kept as written, so its sourced rows
can be checked too. Facts it states about content that is not shipped don't apply.

## B1: hungary-2024 (Era 10)

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

### Sources

| Short name | Link |
|---|---|
| WP-HUN24 | https://en.wikipedia.org/wiki/2024_Hungarian_Grand_Prix (read as wikitext, `action=raw`) |
| GP-HUN24 | https://www.grandprix.com/races/hungarian-gp-2024-race-notes.html (page HTML read directly, tags stripped) |
| JOL-PITS | https://api.jolpi.ca/ergast/f1/2024/13/pitstops.json (CC BY-NC-SA 4.0) |
| JOL-L14 | https://api.jolpi.ca/ergast/f1/2024/13/laps/14.json |
| JOL-LAPS | https://api.jolpi.ca/ergast/f1/2024/13/drivers/piastri/laps.json and `.../norris/laps.json` |
| JOL-ST12 | https://api.jolpi.ca/ergast/f1/2024/12/driverStandings.json (standings before the race; not used in the text) |

Both GP-HUN24 and WP-HUN24 were read as the page text itself, not through a summarising tool.

### Side (owner decision: Eras plays the side with more hard calls)

`pipeline hard-calls hungary-2024` (grader samples: default), run before and after the `eras`
block was written (same result):

| Race | Hard calls | Chance given up by the real calls (pts) | Eras side | Owner checked |
|---|---|---|---|---|
| hungary-2024 | PIA 2, NOR 0 | PIA 2.7, NOR 99.7 | PIA (more hard calls) | |

So the player runs Piastri, not Norris. The McLaren team order is given to Norris (the rival),
so it stays a scripted event (`TEAM_ORDER`, lap 68) and is not a player moment.

### The race: facts used in the authored text

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

### The `eras` block

| Field | Value | Basis | Owner checked |
|---|---|---|---|
| `eraId` / `order` | 10 / 7 | `data/pools.json` eras["10"], seventh; spec §4 Era 10 table, #7 | |
| Target | `team` [2, 2]: both McLarens in the top two, in either order ("Bring the McLarens home one-two") | Spec §4 draft "team: McLaren 1–2", the same form as austria-2002's ★1. Piastri ahead isn't needed for ★1 (that's the mastery) | |
| Storyline (`real`) | Piastri leads from the start; Norris stops first both times and comes out ahead after the second stops, then pulls about six seconds clear; McLaren keep asking him to give the lead back, and he does on lap 68: Piastri wins his first GP by 2.1 s, McLaren's first one-two since the 2021 Italian GP | Rows above | |
| Rewrite | None. Piastri really won and McLaren really finished one-two (owner decision: no rewrite if the side really won). History-book totals drop by one (tests updated) | WP-HUN24 | |
| Mastery | `finish_position` 1: "Win the race yourself" | The real result was P1, so this asks for the win plus no orange or red call (★3 rule) | |
| Hidden | `mode_rule` push, `maxLaps` 0: "Finish without a single push lap" | A margin objective (5 s, then 3 s) was tried first and was not reachable at Legend: the sim's Piastri wins there by 0.3-1.5 s | |
| Briefing | Hungaroring, July 2024; Norris pole, Piastri alongside, McLaren's first front-row lockout since 2012, Piastri led into the first corner; you run Piastri, 3.4 s ahead of Norris after 14 laps, Verstappen third | Rows above | |

### Moments (`pnpm --filter @laststint/sim author hungary-2024 --target team:2:2 --eras --write`)

Grades are the author run's (team target, takeover state).

| Moment | Options | Real | Note |
|---|---|---|---|
| stop-18 | stay / box softs / box mediums / box hards / box hards next lap | box hards (the race file's stop on lap 19, from the timing; the call is made on lap 18) | stay 78% red, softs 90% orange, mediums 95%, hards 94% green |
| pace-22 | push / standard / manage / push and attack | — | standard 93% green; manage orange |
| pace-26 | push / standard / manage / push and attack | — | push and standard 93% green; manage orange |
| stop-47 | stay / box softs / box mediums / box hards / box hards next lap | box mediums (race file: lap 48) | stay 0% red; every box option 98-99% |

The moment finder's `rivalpit-45` (Norris's second stop) graded no-choice on the team target (every
option 99%), so it was not kept.

### Reachability (`pnpm --filter @laststint/sim reachability hungary-2024`)

| Level | Result | Best path | Stay-out |
|---|---|---|---|
| Era (threshold 70, Standard) | ★1 ★2 ★3, hidden yes, accuracy 100 | stop-18 box hards, pace-22 standard, pace-26 standard, stop-47 box hards next lap | no ★1, no ★3, on seeds 1-3 (accuracy 40-44) |
| Legend (90, Expert) | ★1 ★2 ★3, hidden yes, accuracy 100 | stop-18 box mediums, pace-22 manage, pace-26 manage, stop-47 box softs | no ★1, no ★3, on seeds 1-3 |

The real path (hards, standard, standard, mediums) also earned all three stars at era difficulty
(seed 2, in a run of the same moments with the earlier margin objective); it has no push lap, so
it meets the hidden objective too.

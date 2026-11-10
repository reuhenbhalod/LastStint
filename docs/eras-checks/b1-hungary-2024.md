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

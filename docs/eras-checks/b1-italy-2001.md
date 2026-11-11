# B1: Eras content for italy-2001 (Era 4, #8)

Eras job B1 (author a passing race), Nov 9 2026. italy-2001 replaced japan-2003 in Era 4 slot #8
(owner pre-approved swap; `swap-races-era4-overnight.md`, which holds the race's full fact
table). Every fact below was read in the linked source on Nov 9 2026 (WP re-read for this job).
Nothing comes from memory. The storyline and briefing are original wording; no team radio is
quoted. Check each row against its source, then put your initials and the date in
**Owner checked**.

## Sources

| Short name | Link |
|---|---|
| WP | https://en.wikipedia.org/wiki/2001_Italian_Grand_Prix (read as plain text, MediaWiki `action=raw`) |
| AS | Autosport (Atlas F1) race review, Elizalde: http://atlasf1.autosport.com/2001/ita/elizalde.html (as recorded in `swap-races-era4-overnight.md`) |
| GPE | GrandPrix.com race report: https://grandprix.com/gpe/rr678.html (as recorded in `swap-races-era4-overnight.md`) |
| Timing | Jolpica-F1 lap positions (CC BY-NC-SA 4.0) in `data/raw/italy-2001.parquet`, as built into `data/races/italy-2001.json` |

## Model status

- Robust G1 (`pipeline validate italy-2001 --robust`, Eras build, base `eras-swap-era4`,
  with the full overlay): **pass** (strict pass), mean gap error 1.62 s.
- Reachability (`pnpm --filter @laststint/sim reachability italy-2001`): **pass** at era
  difficulty (threshold 84, Smart rival) and at Legend (90, Expert rival), all three stars and
  the hidden objective (era: seed 1; Legend: seed 1). The stay-out path never earns ★3 (it
  never earns ★1: without the stop Montoya can't reach the flag on his tank).
- Re-author (B2, Nov 9, branch `eras-author-italy-2001-p3`, base `eras` at `d036ef6`): with
  the regenerated `data/sc_rates.json` (Monza 0.273 SCs per race) the `win` target was not
  reachable at Legend. Robust G1 re-run on the local Eras build: **pass** (strict), 1.62 s.
  Hard calls re-run: MON 1, BAR 0 (side unchanged).

## Content

| Item | Value | Fact it rests on | Source | Owner checked |
|---|---|---|---|---|
| Side | MON (hard calls MON 1, BAR 0; chance given up MON 0.3, BAR 5.3; `pipeline hard-calls`) | the grader, not a fact | - | |
| Target | `position` 2: top two (re-authored Nov 9, B2; owner-accepted pattern: a position target when beating the draft rival is unreachable; see Notes). The moments stay graded on the win | Montoya "won the 53-lap race from pole position", Barrichello 2nd; MON P2 at the takeover (end of lap 16), so `defend` doesn't fit | WP; Timing | |
| Rewrite | none: the side really won | Montoya 1st, Barrichello 2nd "5.175 seconds behind" | WP | |
| Storyline | "Montoya leads from pole until a blistered tyre slows him out of a chicane and Barrichello ... passes him on lap 9" | Montoya "led until he exited a chicane slowly due to a tyre blister and was overtaken by Barrichello on the ninth lap" | WP; AS | |
| Storyline | "lighter on fuel for two stops" | Ferrari "were planning for two stops"; "Barrichello (on a lighter fuel load)" | WP; GPE | |
| Storyline | "Barrichello's first stop runs six or seven seconds long while Ferrari switch to Schumacher's refuelling rig" | "his refuelling rig failed to work after it had been re-programmed and Ferrari mechanics switched to his teammate's refuelling rig, keeping Barrichello stationary for around six to seven seconds longer than planned" | WP; AS; GPE | |
| Storyline | "Montoya stops once, after 28 laps" | Williams "were planning a one-stop strategy"; stop "on lap 29" (WP, the out-lap) / lap 28 (AS); MON P1 at the end of lap 28, P3 at the end of lap 29 | WP; AS; Timing | |
| Storyline | "takes the lead for good at Barrichello's second stop" | "Montoya took over the position on lap 42 when Barrichello made a pit stop for the second time for fuel"; MON P1 from lap 42 to the flag | WP; Timing | |
| Storyline | "wins by 5.2 s, his first Formula 1 win" | "5.175 seconds behind Montoya"; "achieved his maiden Formula One victory" | WP | |
| Briefing | "Montoya starts from pole for Williams, but Barrichello's Ferrari, lighter on fuel for two stops, has passed him" | as the storyline rows above | WP | |
| Briefing | "second and 8.6 s behind after 16 laps, on one stop. Bring it home in the top two." (the last sentence is the game's target, not a fact) | MON P2, 8.637 s behind BAR at the end of lap 16 (the takeover lap, D3 rule); AS: Barrichello's lead "nearly 9 s" on lap 16; one-stop plan as above | Timing; AS; WP | |
| Mastery | `stop_count` exact 1: "Top two on one stop" | Montoya's real strategy (one stop) | WP | |
| Hidden | `mode_rule` push, max 0 laps: "Top two without a single push lap" | the game's choice, not a fact | - | |
| storylineEvents | none | no safety car, VSC or red flag in the race (local yellows only); the real retirements after the takeover (HAK, VERO, FRE, BERN, YOO) are kept in Legend anyway | WP | |
| Real fill | stop-28 "Box, mediums" carries `{laps: 25}` (to the flag) | one stop on lap 28 of 53; fill sizes themselves are not in sources | WP; AS | |

## Notes

- Moments (`pnpm --filter @laststint/sim author italy-2001 --target win --eras --write`):
  stop-28, pace-32, pace-36 (`data/moments/italy-2001.json`). The race is an easy win at era
  difficulty (Smart Barrichello ends 14-21 s behind), so most candidates were "no-tension" or
  "no-choice"; the lap-19 and lap-41 rival-stop calls were not kept (staying out is 95-99%).
- Rejected objectives (reachability at Legend): mastery `margin` 5.2 s (beat the real margin),
  4 s and 2.5 s. Legend's Expert Barrichello and random safety cars leave only a narrow win
  (0.3 s on seed 2; seed 1 lost by 8 s), so a margin above 0.3 s is not reachable. Hidden
  `stop_count` exact 1 became the mastery.
- The `user_side` / `rival` pair in `build.py` (MON vs BAR) already matches the hard-call side.
- `data/races/italy-2001.json` and its golden must be rebuilt by the integrator
  (`pipeline build italy-2001`); this branch does not commit them.
- B2 re-author (Nov 9): every moment path played at Legend (Expert Barrichello) on seeds 1-3.
  Seed 1 (no drawn SC): Expert Barrichello finishes 4-13 s ahead on every path that reaches the
  flag (the Smart rival at era difficulty ends 7-17 s behind). Seed 2 (drawn SC): Montoya wins
  only with a push lap (`box-next-medium` + `push` at lap 32 or 36), which the hidden objective
  forbids, and the search's best non-push path is 1.7 s behind. Seed 3 (drawn SC lap 24-28):
  Montoya P2-P6. So the win is not reachable with this hidden objective, and dropping the hidden
  objective would leave a win only on a push path at seed 2. The target became `position` 2
  (the accepted pattern), mastery and hidden kept with "Top two" labels. Moments unchanged
  (still graded on the win; real call `box-medium` keeps its `{laps: 25}` fill).

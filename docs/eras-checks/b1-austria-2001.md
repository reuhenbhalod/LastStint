# B1: Eras content for austria-2001 (Era 4, #6)

Eras job B1 (author a passing race), Nov 9 2026. austria-2001 replaced hungary-2003 in the Era 4
swaps (`swap-races-era4-overnight.md`, owner pre-approved Nov 9). Every fact below was read in
the linked source on Nov 9 2026. Nothing comes from memory. The storyline and briefing are
original wording; no team radio is quoted. Check each row against its source, then put your
initials and the date in **Owner checked**.

## Sources

| Short name | Link |
|---|---|
| WP | https://en.wikipedia.org/wiki/2001_Austrian_Grand_Prix (read as plain text, MediaWiki `action=raw`, "Race" and "Post-race" sections) |
| SW | `docs/eras-checks/swap-races-era4-overnight.md`, austria-2001 section (WP, GrandPrix.com, Atlas F1 and Jolpica rows read for the swap) |
| Jolpica | https://api.jolpi.ca/ergast/f1/2001/6/results.json (via SW) |
| Timing | Jolpica-F1 lap times and F1DB stops in `data/raw/austria-2001.parquet`, as built into `data/races/austria-2001.json` |

## Model status

- **Rival changed from MSCM to BAR** (`build.py`, entry name "Coulthard vs Barrichello"). With
  MSCM as the rival, the Legend run was unreachable: the Expert Schumacher won every seed (by
  2-12 s, whatever lap Coulthard stopped on, laps 44-50), so ★1 (win) was never earned. The
  storyline pair in the swap sheet's proposal is Coulthard and Barrichello, and the real dilemma
  is the overcut on Barrichello (WP: Barrichello believed he would have won "had Coulthard not
  remained on track for another three laps"). With BAR as the rival, Schumacher runs his real
  race (lap-46 stop) as a scripted car.
- Takeover moves from lap 43 to lap 44 with the new pair (D3 rule).
- Robust G1 (`pipeline validate austria-2001 --robust`, Eras build of this branch, base
  `eras-swap-era4`): **pass** (strict fail), mean gap error 0.70 s (0.62 s with the MSCM rival).
- `pipeline hard-calls austria-2001`: COU 0, BAR 0 (chance given up 0.0 each; it was COU 0,
  MSCM 0 with the old rival too). Tie: side COU, by the race file.
- Reachability (`pnpm --filter @laststint/sim reachability austria-2001`): **pass** at era
  difficulty (threshold 84, Smart rival) and at Legend (90, Expert rival), all three stars and
  the hidden objective on seed 1. Stay-out never earns ★1 or ★3 on any seed.

## Content

| Item | Value | Fact it rests on | Source | Owner checked |
|---|---|---|---|---|
| Side | COU (hard calls COU 0, BAR 0; tie, race-file side) | the grader, not a fact | - | |
| Target | `win` (spec §4: "win: Coulthard from P7"); not `defend`, since he is second at the takeover | Coulthard won; P2 behind Barrichello at the end of lap 44 | WP classification; Timing | |
| Rewrite | none: the side really won | Coulthard 1st, 1:27:45.927 | WP; Jolpica | |
| Storyline | "Montoya leads from the start" | "Montoya moved ahead of the slow starting Michael Schumacher for the lead"; Montoya "led the first 16 laps" | WP | |
| Storyline | "until Schumacher goes for the lead at turn 2 on lap 16 and both run off the road, which hands Barrichello the lead" | at the start of lap 16, towards turn two, Schumacher "drew alongside Montoya"; Montoya ran "into the gravel trap", Schumacher "ran wide onto some grass"; "Barrichello took the lead" (AS race text says lap 15, SW) | WP; SW | |
| Storyline | "Coulthard, up from seventh on the grid, has saved fuel" | grid 7; "driving conservatively earlier in the race"; Coulthard: able to "lean the engine out early on ... and save quite a few laps of fuel" (press conference, paraphrased) | WP | |
| Storyline | "he stops three laps after Barrichello, comes out ahead and wins by 2.19 s" | Barrichello pitted at the end of lap 47; Coulthard "remained on the circuit for the next three laps"; "rejoined the circuit 1.3 seconds ahead of Barrichello"; MSC +2.190 | WP; Jolpica; Timing (BAR in-lap 47, COU in-lap 50) | |
| Storyline | "Ferrari have Barrichello give second to Schumacher at the last corner" | "he obeyed at the end of lap 71 by going wide exiting the final corner ... to yield second to Michael Schumacher" | WP | |
| Briefing | "Schumacher started on pole and Coulthard seventh" | pole M. Schumacher 1:09.562; Coulthard 7th | SW (WP, Jolpica) | |
| Briefing | "second after 44 laps, a second behind Barrichello with Schumacher right behind you, and none of the three has stopped" | end of lap 44: BAR P1, COU P2 +1.07 s, MSCM P3 +0.58 s behind COU; their first stops come on laps 46 (MSCM), 47 (BAR), 50 (COU) | Timing; WP; SW (AS pit table) | |
| Briefing | "You saved fuel early: stay out longer than the Ferrari and win" | the fuel-saving quote above; the dilemma in spec §4 | WP | |
| Mastery | `margin` 2.2 s: "Win by more than 2.2 seconds" (beat Coulthard's real 2.19 s) | MSC +2.190 (GrandPrix.com +2.191) | Jolpica; SW | |
| Hidden | `stop_count` exact 1: "Win on one stop" | every front-runner stopped once (AS pit table); the game's choice | SW | |
| storylineEvents | none | no SC or VSC after the takeover (the only SC, laps 1-3, is before it); Legend keeps retirements (DLR, BUT) anyway | WP; SW | |
| Real call fill | stop-50 `box-medium` carries `{laps: 21}` (to the flag) | fuel loads are not in sources (SW); the fill is the race file's own (one stop, 21 laps to go) | Timing | |

## Notes

- Moments (`pnpm --filter @laststint/sim author austria-2001 --target win --eras --write`):
  stop-50 (stay 0% red, box-medium 79% green = the real call, box-next 65% orange), pace-56,
  pace-60, pace-64 (push green each time) in `data/moments/austria-2001.json`. The lap-47
  "rival pits" call (stay out, the real overcut) was dropped by the tool as no-tension (stay
  76% green, box 33-39% red).
- Rejected objective (reachability): hidden `mode_rule` push 0 laps (push is the green pace
  call, so no full path met it).
- `data/races/austria-2001.json` and its golden must be rebuilt by the integrator
  (`pipeline build austria-2001`); this branch does not commit them.

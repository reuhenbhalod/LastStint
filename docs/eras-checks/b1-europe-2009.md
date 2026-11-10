# B1: europe-2009 (2009 European Grand Prix, Valencia), Era 5 #2: owner sign-off

Eras job B1 (author a passing race), Nov 9 2026, on `eras-swap-era5`. The race came in for
japan-2005 in the overnight Era 5 swap; its facts were read on Nov 9 2026 and are recorded in
`swap-races-era5-overnight.md` (section "europe-2009"), which this sheet cites row by row.
Nothing comes from memory. The storyline, headline and briefing are original wording; no team
radio is quoted. Check each row against its source, then put your initials and the date in
**Owner checked**.

## Sources

| Short name | Link |
|---|---|
| SW | `docs/eras-checks/swap-races-era5-overnight.md`, europe-2009 section (its WP, MS, AS, GPE, GPE-N and Jolpica rows) |
| WP | https://en.wikipedia.org/wiki/2009_European_Grand_Prix |
| MS | https://www.motorsportmagazine.com/articles/single-seaters/f1/2009-european-grand-prix-report/ |
| AS | https://www.autosport.com/f1/news/barrichello-wins-again-five-years-later-4431860/4431860/ |
| GPE-N | https://www.grandprix.com/races/european-gp-2009-race-notes-barrichello-wins-european-gp.html |
| Jolpica | https://api.jolpi.ca/ergast/f1/2009/11/results.json |

MS, AS and GPE-N were read through a summarising fetch tool (see SW); their rows need a wording
check.

## Model status

- Rebuilt locally as an Eras build (`uv run pipeline build europe-2009`; not a shared race).
- Robust G1 (`pipeline validate europe-2009 --robust`): **pass** (strict pass), mean gap error
  1.04 s, same as the swap scout.
- Side (`pipeline hard-calls europe-2009`): hard calls HAM 1, BAR 0; chance given up HAM 0.0,
  BAR 0.0, so **Hamilton** (as the swap sheet suggested). Rival Barrichello.
- Takeover lap 13 (D3 rule, `build.py`).
- Moments (`pnpm --filter @laststint/sim author europe-2009 --target win --eras --write`):
  stop-16, rivalpit-20, stop-37, rivalpit-40, pace-45, battle-51 (`data/moments/europe-2009.json`),
  as the tool picked them. The real calls carry the real fills: box-hard at 16 with 21 laps
  (to lap 37), box-hard at 37 with 20 laps (to the flag; GPE-N: both leaders fuelled to the
  finish at their second stops). The other pit options use the standard fill.
- Reachability (`pnpm --filter @laststint/sim reachability europe-2009`): **pass** at era
  difficulty (threshold 82, Smart rival) and at Legend (90, Expert rival): ★1 ★2 ★3 and the
  hidden objective on seed 1 (stop-16 box-soft, rivalpit-20 stay, stop-37 box-hard, rivalpit-40
  stay, pace-45 standard, battle-51 defend). Stay-out never earns ★1 or ★3 (it earns ★2 at era
  difficulty on accuracy 83.3).
- `storylineEvents`: none. The race had no safety car, VSC or red flag (SW, "SC / VSC / red
  flag"); the three retirements (VET lap 24, BUE 43, NAK 56 in the model) are kept in Legend
  anyway.

## Content

| Item | Value | Fact it rests on | Source | Owner checked |
|---|---|---|---|---|
| Side | HAM (hard calls HAM 1, BAR 0) | the grader, not a fact | - | |
| Target | `win` | Hamilton finished 2nd, +2.358 s | Jolpica; SW "Result" | |
| Rewrite | allowed, condition `win`: the side didn't win | Barrichello won | Jolpica; WP | |
| Headline | "Hamilton keeps Barrichello behind at Valencia" | original wording, the rewrite | - | |
| Storyline | "Hamilton starts from pole and leads both stints" | pole 1:39.498; lap 7, 12, 21, 30 gap tables have Hamilton leading; Barrichello rejoined 2nd behind Hamilton after his first stop | WP, Jolpica; GPE-N; MS (SW "Grid", "Gaps", "Barrichello stops") | |
| Storyline | "Barrichello, fuelled for longer, stays within a few seconds" | Barrichello qualified with "significantly more fuel" (MS), 3-4 laps more than the McLarens (GPE-N); gaps 3.2 s lap 21, 4.1 s lap 30, 3.6 s lap 36 | MS, GPE-N (SW "Qualifying fuel", "Gaps") | |
| Storyline | "McLaren calls Hamilton in on lap 37, then tries to keep him out a lap; the tyres aren't ready and he is stationary for 13.4 s" | stop 2 lap 37 (WP, MS, GPE-N); team tried to keep him out a lap to save fuel, he was already committed, tyres not ready, 13.4 s stationary | WP, MS, GPE-N (SW "Hamilton stops") | |
| Storyline | "Barrichello stops three laps later, rejoins in the lead" | AS: Hamilton stopped "three laps sooner"; Barrichello stop 2 lap 40 (WP, MS), rejoined in the lead by just over 6 s (MS) | AS, WP, MS (SW "Barrichello stops") | |
| Storyline | "and wins by 2.358 s, his first win since China 2004" | Hamilton +2.358; first win since China 2004 | Jolpica; WP (SW "Result") | |
| Briefing | "Hamilton takes his first pole of the year with Kovalainen beside him" | Hamilton pole, his first of 2009; Kovalainen 2nd on the grid | WP, Jolpica (SW "Grid") | |
| Briefing | "leading his team-mate by 6.3 s after 12 laps, with Barrichello 8.1 s back on a heavier Brawn" | GPE-N lap-12 table: KOV 6.3, BAR 8.1 behind Hamilton; Barrichello's heavier fuel load | GPE-N; MS (SW "Gaps", "Qualifying fuel") | |
| Mastery | `margin` 2.4 s: "Win by more than 2.4 seconds" (beat Barrichello's real winning margin) | +2.358 | Jolpica | |
| Hidden | `mode_rule` push at most 10 laps: "Win pushing for no more than 10 laps" | game rule, not a fact | - | |
| Eras slot | eraId 5, order 2 | the swap (migration 0020) | SW "The swaps" | |

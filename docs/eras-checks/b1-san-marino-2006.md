# B1: Eras content for san-marino-2006 (Era 5, #4)

Eras job B1 (author a passing race), Nov 9 2026. san-marino-2006 replaced brazil-2006 in the
overnight Era 5 swap (`swap-races-era5-overnight.md`, whose san-marino-2006 section holds the
race's full facts table). Every fact below was read in the linked source on Nov 9 2026. Nothing
comes from memory. The storyline, headline and briefing are original wording; no team radio is
quoted. Check each row against its source, then put your initials and the date in
**Owner checked**.

## Sources

| Short name | Link |
|---|---|
| WP | https://en.wikipedia.org/wiki/2006_San_Marino_Grand_Prix (read as plain text, MediaWiki `action=raw`) |
| GPE-N | GrandPrix.com race notes: https://www.grandprix.com/races/san-marino-gp-2006-race-notes-schumacher-wins-san-marino-gp.html (read as page text) |
| Timing | Jolpica-F1 lap timings (CC BY-NC-SA 4.0) in `data/raw/san-marino-2006.parquet`, as built into `data/races/san-marino-2006.json` (positions and gaps summed from lap times) |
| SW | `docs/eras-checks/swap-races-era5-overnight.md`, section san-marino-2006 (stop laps, gaps, result) |

## Model status

- Robust G1 (`pipeline validate san-marino-2006 --robust`, Eras build of this branch, base
  `eras-swap-era5`): **pass** (strict pass), mean gap error 0.79 s, before and after the overlay.
- Side: `pipeline hard-calls san-marino-2006` gives ALO 0, MSCM 0, chance given up 0.0 each, so
  it ties on both counts and keeps the race file's side, **ALO**. Alonso did not win, so the
  rewrite is allowed. **Owner to confirm** the side (a 0-0 tie, as south-africa-1983 was).
- Reachability (`pnpm --filter @laststint/sim reachability san-marino-2006`): **pass** at era
  difficulty (threshold 82, Smart rival; seed 2) and at Legend (90, Expert rival; seed 3), all
  three stars and the hidden objective on one path. Stay-out never earns ★1 or ★3.

## Content

| Item | Value | Fact it rests on | Source | Owner checked |
|---|---|---|---|---|
| Side | ALO (hard calls 0-0, chance given up 0.0-0.0; race-file side) | the grader, not a fact | - | |
| Target | `position` 2 | Alonso finished 2nd, +2.096 s | WP classification; SW | |
| Rewrite | `win`: "Alonso turns the tables on Schumacher at Imola" | Schumacher won, Alonso 2nd | WP classification | |
| Storyline | "Schumacher takes a record 66th pole and leads" | "broke Ayrton Senna's record of 65 poles"; "led the field away from a record 66th pole position" | WP; GPE-N | |
| Storyline | "Alonso runs five laps longer to his first stop on lap 25" | Schumacher "came into the pits on lap 20"; Alonso's first stop lap 25 | WP; SW (GPE-N, Jolpica-L) | |
| Storyline | "catches the graining Ferrari and is right behind it from lap 34" | Schumacher's "car developed graining in its tyres"; gap "11 seconds on lap 26 ... to 0.4 seconds on lap 34" | WP; GPE-N | |
| Storyline | "Imola gives him no way past" | "could not pass him. The Imola circuit is renowned for being difficult to overtake on" | WP | |
| Storyline | "Renault stop him first on lap 41, Ferrari answer a lap later, and Schumacher comes out ahead" | "On lap 41 Alonso and Massa pitted, followed by Schumacher and Webber on lap 42, Schumacher getting out in front of Alonso" | GPE-N; WP | |
| Storyline | "Alonso finishes second, 2.1 s behind" | Alonso +2.096 | WP classification | |
| Briefing | "you run Alonso's Renault, third and 10.8 s behind him after 17 laps" | lap 17 (the takeover lap, D3 rule): MSCM P1, MAS P2 +10.2 s, ALO P3 +10.8 s | Timing | |
| Briefing | "Schumacher will be the first of the two to stop" | Schumacher lap 20, Alonso lap 25 | WP; SW | |
| Briefing | "Passing here is close to impossible, so the pit stops decide it" | as the "no way past" row | WP | |
| Mastery | `stop_count` max 2: "Finish second or better on no more than two stops" | Alonso stopped twice (laps 25 and 41) | SW | |
| Hidden | `mode_rule` push at most 10 laps: "Finish second or better pushing for no more than 10 laps" | the game's choice (as san-marino-2005) | - | |
| storylineEvents | none | the lap-1/2 safety car (WP: two laps; GPE-N: one lap) is before the takeover and not in the race model (`2.6-drivers-incidents.md`); the model's only events are backmarker retirements (Ide, Klien, Sato, Coulthard) | WP; GPE-N; SW | |

## Notes

- Moments (`pnpm --filter @laststint/sim author san-marino-2006 --target beat-rival --eras
  --write`): rivalpit-20, stop-25, cliff-28, stop-41, pace-45, battle-56
  (`data/moments/san-marino-2006.json`). They are graded on **beating Schumacher**, the race's
  real dilemma; graded on P2 or better instead, stop-25/stop-41 are 0% vs ~90%+ and every other
  call is "no tension" (Alonso was 13 s clear of Montoya at the flag). The real calls carry the
  real fills: stop-25 `{laps:16}` (to lap 41), stop-41 `{laps:21}` (to the flag).
- ★1 is P2 or better (owner-accepted pattern: a position target when beating the draft rival is
  unreachable). With `beat-rival` MSCM as the target, reachability failed at era difficulty
  (Smart rival: no path earned ★1; best ★2 ★3 hidden) and passed at Legend. Beating Schumacher
  is the rewrite (`win`).
- The swap sheet's risk (Schumacher's mid-race graining is not modelled per stint, B3) shows in
  the grades: the beat-rival win chances are 20-40% for most calls, 82% for the real lap-41
  stop.
- `data/races/san-marino-2006.json`, its golden and `races.gen.ts` must be built by the
  integrator (`pipeline build san-marino-2006`); this branch does not commit them.

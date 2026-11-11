# B1: Eras content for australia-2018 (Era 8, #2)

Eras job B1 (author a passing race), Nov 9 2026. australia-2018 replaced azerbaijan-2017 in the
Era 8 swap (`swap-races-era8-overnight.md`, owner pre-approved). Every fact below was read in
the linked source on Nov 9 2026. Nothing comes from memory. The storyline and briefing are
original wording; no team radio is quoted. Check each row against its source, then put your
initials and the date in **Owner checked**.

## Sources

| Short name | Link |
|---|---|
| WP | https://en.wikipedia.org/wiki/2018_Australian_Grand_Prix (read as plain text, MediaWiki `action=raw`, "Race" section and classification) |
| Timing | TUM timing (CC BY-NC-SA 3.0) in `data/raw/australia-2018.parquet`, as built into `data/races/australia-2018.json` |
| SW8 | `docs/eras-checks/swap-races-era8-overnight.md` (australia-2018 facts: Jolpica stops and result, Motor Sport, Autosport) |

## Model status

- Robust G1 (`pipeline validate australia-2018 --robust`, Eras build of this branch, base
  `eras-swap-era8`): **pass** (strict pass), mean gap error 1.06 s, with the rules-only overlay
  and with the authored one.
- Reachability (`pnpm --filter @laststint/sim reachability australia-2018`): **pass** at era
  difficulty (threshold 75, Standard+ rival) and at Legend (90, Expert rival), all three stars
  and the hidden objective. Era: the real calls (stay on lap 19, box for the harder tyre under
  the lap-26 VSC). Legend (seed 2): box on lap 19, stay out under the VSC. The stay-out path
  never earns ★1 or ★3 (it earns ★2 on clean calls at era difficulty, not at Legend).

## Content

| Item | Value | Fact it rests on | Source | Owner checked |
|---|---|---|---|---|
| Side | VET (hard calls VET 2, HAM 0; `pipeline hard-calls`) | the grader, not a fact | - | |
| Target | `win` (spec §4: "win: Vettel from P3, ahead of Hamilton") | Vettel won, Hamilton 2nd | WP classification | |
| Rewrite | none: the side really won | "Vettel took the chequered flag to win" | WP | |
| Storyline | "Hamilton leads from pole" | grid after penalties led by Hamilton; "the top three stayed in the same order they started"; "Hamilton led Räikkönen, Vettel, ..." | WP | |
| Storyline | "Räikkönen and then Hamilton stop early for softs while Vettel stays out" | "On lap 18 Räikkönen pitted for softs. On lap 19 Hamilton pitted for softs to cover Räikkönen"; Vettel pitted on lap 26 | WP | |
| Storyline | "Both Haas cars retire after their stops with loosely fitted wheels" | Magnussen "retired the next lap due to a cross-threaded wheel-nut being fitted loosely"; Grosjean retired "after pitting with the same problem as his teammate" | WP | |
| Storyline | "under the virtual safety car for Grosjean's car Vettel makes his only stop and comes out ahead of Hamilton" | Grosjean's retirement resulted "in a Virtual Safety Car (VSC) being called out. On lap 26 Vettel pitted under the VSC and emerged ahead of Hamilton and Räikkönen"; "None of the top ten pitted again"; one stop each (Jolpica) | WP; SW8 | |
| Storyline | "Hamilton stays second to the flag, and Vettel wins by 5.036 s" | top ten after the SC "Vettel, Hamilton, ..."; classification Hamilton "+5.036"; VET, HAM P1-P2 on every lap from 19 to 58 | WP; Timing | |
| Briefing | "Hamilton leads from pole with Räikkönen second, and you run Vettel in third, sixteen laps in" | HAM, RAI, VET P1-P3 at the end of lap 16 (the takeover lap) | Timing; WP | |
| Briefing | "Räikkönen and Hamilton will stop before you" | Räikkönen lap 18, Hamilton lap 19, Vettel lap 26 | WP | |
| Briefing | "Cover them or stay out longer, and find a way to come out ahead of Hamilton without having to pass him on the track" (B2, Nov 10: was "Stay out longer than they do and ...") | game advice, not a fact | - | |
| Mastery | `stop_count` exact 1: "Win on one stop, as Vettel did" (B2, Nov 10: was `margin` 5.1 s) | Vettel's only stop was on lap 26 under the VSC; "None of the top ten pitted again"; one stop each | WP; SW8 (Jolpica stops) | |
| Hidden | `margin` 3 s: "Win by more than 3 seconds" (B2, Nov 10: was `margin` 10 s) | the game's choice, set from the model (Legend's only clean winning path wins by 3.61 s) | - | |
| storylineEvents | [23, RETIREMENT] (MAG), [25, RETIREMENT] (GRO), [26, VSC], [28, SC] | Magnussen and Grosjean retirements; VSC then "On lap 27 the full-course Safety Car was called out. The safety car came in at the end of lap 31"; the model's laps come from the TUM track status (`data/incidents.json`, VSC 26 and SC 28, as in SW8) | WP; SW8; Timing | |

## Notes

- Moments (`pnpm --filter @laststint/sim author australia-2018 --target win --eras --write`):
  rivalpit-19, stop-26, battle-31, pace-36, pace-40 (`data/moments/australia-2018.json`).
  Graded on the win. rivalpit-19 (Hamilton covers Räikkönen): stay 96%, box 2-71%. stop-26
  (the VSC): box for the harder tyre 96%, stay 59%. In the model the start tyre is SOFT and
  the real change is to HARD (the model's labels for the two compounds Vettel used; SW8 has
  him from ultrasofts to softs, and WP has Räikkönen and Hamilton pitting "for softs").
- Rejected objectives (reachability): hidden `no_neutralized_stop` ("win without stopping under
  the VSC or SC"): Legend reaches it (box on lap 19, stay under the VSC), era difficulty does
  not, even with a beam of 16. Hidden margin 12 s: era reaches it, Legend's best path does not.
- Model gap seen but not changed: on the real calls the model's Vettel wins by more than 10 s,
  against 5.036 s in the race (SW8: Hamilton lost time with a lock-up on lap 47 and his rear
  tyres overheated, but closed back to DRS range). That makes the 5.1 s mastery easy at era
  difficulty; the hidden 10 s is set from the model, not from history.
- `data/races/australia-2018.json` and its golden must be rebuilt by the integrator
  (`pipeline build australia-2018`); this branch does not commit them.

## B2 re-author (Nov 10 2026)

Eras job B2, on `eras-integrate-fixes` (35975b7: Expert rival grader fix and player stint-pace
fix in). With both fixes, reachability failed at Legend: best seed 2 earned ★1 ★2 but not ★3
(accuracy 100). Measured on this branch (scratch playouts, not committed):

- Legend (Expert rival, threshold 90): the only green call at rivalpit-19 is box for mediums
  (stay is red, 12-22%). The only clean path that wins is seed 2: box-medium on lap 19, stay out
  under the VSC, attack, push, push; it wins by 3.61 s. No clean Legend path wins by 5.1 s
  (seed 1, stay then box next lap for mediums, wins by 8.0 s but stay at lap 19 is red), and no
  Legend path of any kind wins by 10 s. The win itself stays reachable, so the target stays
  `win` and there is still no rewrite (Vettel really won).
- Era difficulty (Standard+, threshold 75): the clean winning path is the real one (stay, box
  for the harder tyre under the VSC); it wins by 9.8-10.6 s on seed 1. Box on lap 19 is red at
  era difficulty, so the era and Legend paths share only "win on one stop" and "win by more
  than about 3.6 s".
- Change: mastery `margin` 5.1 s -> `stop_count` exact 1 ("Win on one stop, as Vettel did");
  hidden `margin` 10 s -> `margin` 3 s; briefing's last sentence no longer tells the player to
  stay out (at Legend the winning call is to cover the early stoppers). Target, storyline,
  storylineEvents and side (VET, hard calls VET 2, HAM 0) unchanged.
- Moments: re-run `author australia-2018 --target win --eras` on this branch; it picks the same
  five moments and `data/moments/australia-2018.json` is byte-identical, so it is unchanged.
- Reachability (scratch race file with the new eras block): **pass**. Era seed 1: stay, box-hard,
  hold, push, standard (★1 ★2 ★3 hidden, accuracy 100). Legend seed 2: box-medium, stay, attack,
  push, push (★1 ★2 ★3 hidden, accuracy 100; 3.61 s against the 3 s hidden). The stay-out path
  never earns ★3 (it never stops, so it is not classified).
- Robust G1: **pass** (strict pass), mean gap error 1.06 s.
- The integrator must rebuild `data/races/australia-2018.json` so it carries the new overlay
  (`test_a_non_pool_race_file_carries_its_overlay[australia-2018]` fails until then).

# B1: Eras content for australia-2017 (Era 8, #1)

Eras job B1 (author a swapped-in passing race), Nov 9 2026. australia-2017 replaced
monaco-2017 in Era 8 #1 (owner pre-approved swap, migration 0017). Every fact below was read in
the sources listed in `docs/eras-checks/swap-races-era8-overnight.md` (section
"australia-2017") or in the race's timing; nothing comes from memory. The storyline and
briefing are original wording; no team radio is quoted. Check each row against its source, then
put your initials and the date in **Owner checked**.

## Sources

| Short name | Link |
|---|---|
| WP | https://en.wikipedia.org/wiki/2017_Australian_Grand_Prix |
| MS | https://www.motorsportmagazine.com/articles/single-seaters/f1/2017-australian-grand-prix-report/ |
| AS | https://www.autosport.com/f1/news/f1-australian-grand-prix-vettel-jumps-hamilton-for-first-2017-win-5018623/5018623/ |
| Jolpica | https://api.jolpi.ca/ergast/f1/2017/1/results.json and `.../2017/1/pitstops.json` (CC BY-NC-SA 4.0) |
| Timing | TUM timing (CC BY-NC-SA 3.0) in `data/raw/australia-2017.parquet`, as built into `data/races/australia-2017.json` |
| SW8 | `docs/eras-checks/swap-races-era8-overnight.md` (the facts table for this race, read from WP, MS, AS, Jolpica) |

## Model status

- Robust G1 (`pipeline validate australia-2017 --robust`, Eras build of this branch, base
  `eras-swap-era8`): **pass** (strict pass), mean gap error 2.11 s, before and after the
  overlay (same figure as the swap job).
- Reachability (`pnpm --filter @laststint/sim reachability australia-2017`): **pass** at era
  difficulty (threshold 75, Standard+ rival) and at Legend (90, Expert rival), all three stars
  and the hidden objective. The stay-out path never earns ★1 or ★3 (no stop breaks the
  two-compound rule).

## Content

| Item | Value | Fact it rests on | Source | Owner checked |
|---|---|---|---|---|
| Side | VET (hard calls VET 1, HAM 1; chance given up tied, 11.0 pts each; the race file's side) | the grader, not a fact; a tie keeps the race file's side, as in south-africa-1983 | - | |
| Target | `win` | Vettel won; Hamilton 2nd +9.975 s | WP, AS, Jolpica | |
| Rewrite | none: the side really won | Vettel 1st | WP, AS, Jolpica | |
| Storyline | "Hamilton leads from pole" | Hamilton pole 1:22.188; HAM P1 at the end of laps 1-16 | WP, Jolpica; Timing | |
| Storyline | "his tyres overheat on a hot track" | Hamilton's ultrasofts overheated from about lap 13 and he had to ease off; track about 38 °C, high temperatures overheated Mercedes' tyres | MS | |
| Storyline | "He stops on lap 17 and rejoins behind Verstappen, who has not stopped yet, and can't find a way past" | Hamilton stopped at the end of lap 17; rejoined behind Verstappen (not yet stopped) and could not pass; HAM P5 behind VER at the end of lap 18 | MS, AS, Jolpica, WP; Timing | |
| Storyline | "Ferrari keep Vettel out until lap 23" | Vettel stopped on lap 23 | AS, Jolpica; Timing | |
| Storyline | "he rejoins ahead of them both" | Vettel rejoined ahead of Hamilton and Verstappen | MS, AS; Timing (end of lap 24: VET P3, VER P4, HAM P5) | |
| Storyline | "wins by 9.975 s" | Hamilton +9.975 | WP, AS, Jolpica | |
| Briefing | "Hamilton started on pole and leads; you run Vettel second, 1.5 s behind him after 14 laps" | HAM P1, VET P2 +1.53 s at the end of lap 14 (the takeover lap); MS: Vettel within 1.3 s on lap 16 | Timing; MS | |
| Briefing | "It's hot, and the Mercedes is struggling with its tyres" | 24 °C air, 31-36 °C track (WP); track about 38 °C, high temperatures overheated Mercedes' tyres (MS) | WP, MS | |
| Briefing | "Hamilton will stop first, and Verstappen, fifth, will still be out when he does" | HAM stop lap 17, VET lap 23, VER lap 25; VER P5 at the end of lap 14 | Jolpica; Timing | |
| Mastery | `margin` 8 s: "Win by more than 8 seconds" | Vettel's real margin was 9.975 s (Hamilton +9.975). Below it on purpose: Legend's best path wins by more than 8 s but not by 9 s (reachability), so beating the real margin is not reachable at Legend | WP, AS, Jolpica | |
| Hidden | `stop_count` exact 1: "Win on one stop" | Vettel stopped once (lap 23) | Jolpica; Timing | |
| storylineEvents | [15, RETIREMENT] (Grosjean) | Grosjean retired after 13 laps (water leak: WP, Jolpica; MS: suspected turbo), running 6th from P6 on the grid; his last timed lap is 14 and the race file's RETIREMENT event is on lap 15 | WP, Jolpica, MS; Timing | |

## Notes

- Moments (`pnpm --filter @laststint/sim author australia-2017 --target win --eras --write`):
  rivalpit-17 (Hamilton stops: stay 84% real, box-next-hard 49%), stop-23 (real box-hard 100%,
  stay 96%), cliff-33 (stay 100% real; any box 1-74%) in `data/moments/australia-2017.json`.
  pace-18 was a "keep" too but lost to the spacing rule; every later pace moment is no-choice.
- Rejected mastery margins (reachability): 10 s (beat the real margin) and 9 s: not reachable at
  Legend (best path ★1 ★2, no ★3). 8 s and 7 s are reachable at both levels; 8 s is the closest
  to the real margin.
- Model note, not changed: the race file's retirement events sit one to four laps after the
  Jolpica lap counts (GRO 13 -> 15, PAL 15 -> 18, ERI 21 -> 24, RIC 25 -> 29, STR 40 -> 43, MAG
  46 -> 50, ALO 50 -> 53); TUM's last timed laps are one lap after Jolpica's. Robust G1 passes
  with it.
- Model laps: Hamilton's and Vettel's real stops are on laps 17 and 23 in the timing (pit-in);
  the race file's real strategy puts the new tyre on laps 18 and 24.
- Compounds: the model's SOFT / MEDIUM / HARD are the race's ultrasoft / supersoft / soft. The
  storyline and briefing name no compound.
- `data/races/australia-2017.json` and its golden must be rebuilt by the integrator
  (`pipeline build australia-2017`); this branch does not commit them.

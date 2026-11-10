# B1: Eras content for germany-1997 (Era 3, #9)

Eras job B1 (author a swapped-in passing race), Nov 9 2026. The race facts and their sources are
in `docs/eras-checks/swap-races-era3-overnight.md`, section "germany-1997" (facts 1-14, read on
Nov 9 2026); this sheet cites them by number. Nothing comes from memory. The storyline and
briefing are original wording; no team radio is quoted. Check each row against its source, then
put your initials and the date in **Owner checked**.

## Sources

| Short name | Link |
|---|---|
| Swap | `docs/eras-checks/swap-races-era3-overnight.md`, germany-1997 facts (WP, AS-G, AS-O, GPE-R, Jolpica as linked there) |
| Timing | Jolpica-F1 laps (CC BY-NC-SA 4.0) in `data/raw/germany-1997.parquet`, F1DB stops (`data/raw/f1db/germany-1997.stops.csv`), as built into `data/races/germany-1997.json` |

## Model status

- Robust G1 (`pipeline validate germany-1997 --robust`, Eras build of this branch, base
  `eras-swap-era3`): **pass** (strict pass), mean gap error 1.41 s, before and after the overlay.
- Reachability (`pnpm --filter @laststint/sim reachability germany-1997`): **pass** at era
  difficulty (threshold 86, Expert rival) and at Legend (90, Expert rival), all three stars and
  the hidden objective (seed 2 at era difficulty, seed 1 at Legend), on the real calls (box lap
  17, stay at Fisichella's stops, box lap 34). The stay-out path earns no star on any seed
  (accuracy 75.0).

## Content

| Item | Value | Fact it rests on | Source | Owner checked |
|---|---|---|---|---|
| Side | **BER**. `pipeline hard-calls`: hard calls BER 0, FIS 0; chance given up BER 0.0, FIS 2.3, so the tool picks FIS. Overridden to Berger as for south-africa-1983 (owner, Nov 8): the tie is on chance given up only, and Fisichella's race ends with a tyre failure and radiator damage that no source ties to an avoidable call. Owner please confirm. | Fisichella's left-rear failure with six laps to go, retired (fact 8) | Swap | |
| Target | `defend` | Berger pole (fact 1), led laps 1-16 (fact 7); P1 at the end of lap 14, the takeover lap | Swap; Timing | |
| Rewrite | none: the side really won | Berger 1st (fact 14) | Swap | |
| Storyline | "Berger leads from pole on two stops against Fisichella's one-stopping Jordan" | facts 1, 7, 8 | Swap | |
| Storyline | "Fisichella leads between Berger's stops; Berger rejoins behind him after his second stop on lap 34 and passes him again at the second chicane on the same lap" | facts 7, 8 | Swap (AS-G, AS-O, GPE-R) | |
| Storyline | "Fisichella's left-rear tyre fails with six laps to go" | fact 8 | Swap (AS-G) | |
| Storyline | "Berger wins by 17.5 s from Michael Schumacher" | M. Schumacher +17.527 (fact 14) | Swap (Jolpica) | |
| Briefing | "Berger took pole, 0.023 s ahead of Fisichella's Jordan" | fact 1 | Swap (WP, Jolpica) | |
| Briefing | "leading Fisichella by 11.8 s after 14 laps" | BER P1, FIS P2 +11.793 s at the end of lap 14 (MSCM P3 a further 0.97 s back) | Timing | |
| Briefing | "with Benetton planning two stops" | fact 7 | Swap (GPE-R, AS-G) | |
| Mastery | `margin` 17.5 s: "Win by more than 17.5 seconds" (Berger's real margin, 17.527 s) | fact 14 | Swap | |
| Hidden | `stop_count` exact 2: "Win on two stops" | Berger's two stops, laps 17 and 34 (fact 7) | Swap | |
| storylineEvents | [41, RETIREMENT] (FIS), so Legend keeps Fisichella's retirement | retired lap 40, 40 laps completed (fact 8; the race file's event is on lap 41, the lap after his last) | Swap; Timing | |

## Notes

- Moments (`pnpm --filter @laststint/sim author germany-1997 --target win --eras --write`):
  stop-17 (real: box, fill 17 laps), rivalpit-24 (real: stay; Fisichella's one stop),
  stop-34 (real: box, fill 11 laps), rivalpit-39 (real: stay; Fisichella's limp to the pits
  after the tyre failure), in `data/moments/germany-1997.json`. Every pit option carries a fill
  (refuelling era); the two real calls carry the real fills (lap 17 to 34, lap 34 to the flag).
  The pace calls were all "no choice" except pace-18 (not picked).
- The stop laps in the moments follow AS-G (in-laps 17 and 34); the race file's real stops are
  on the out-laps (18, 35).
- Schumacher's late extra stop (fact 10) has no sourced lap; the race file runs his stops from
  the timing, nothing was added.
- `data/races/germany-1997.json` and its golden must be rebuilt by the integrator
  (`pipeline build germany-1997`); this branch does not commit them.

# B1: Eras content for germany-2013 (Era 6, #3)

Eras job B1 (author a swapped-in passing race), Nov 9 2026. The race facts and their sources are
in `docs/eras-checks/swap-races-era6-overnight.md`, section "germany-2013" (facts table, read on
Nov 9 2026); this sheet cites them by topic. Nothing comes from memory. The storyline, headline
and briefing are original wording; no team radio is quoted. Check each row against its source,
then put your initials and the date in **Owner checked**.

## Sources

| Short name | Link |
|---|---|
| Swap | `docs/eras-checks/swap-races-era6-overnight.md`, germany-2013 facts (WP, MS, AS-K, AS-V, GPE, Jolpica as linked there) |
| WP | [English Wikipedia, 2013 German Grand Prix](https://en.wikipedia.org/wiki/2013_German_Grand_Prix) |
| GPE | [GrandPrix.com, Sunday team quotes](https://www.grandprix.com/races/german-gp-2013-sunday-team-quotes.html) |
| Timing | Jolpica-F1 laps (CC BY-NC-SA 4.0) in `data/raw/germany-2013.parquet`, as built into `data/races/germany-2013.json` |

## Model status

- Robust G1 (`pipeline validate germany-2013 --robust`, Eras build of this branch, base
  `eras-swap-era6-p3`): **pass** (strict pass), mean gap error 1.25 s before the team order
  below, **1.31 s** with it.
- Reachability (`pnpm --filter @laststint/sim reachability germany-2013`): **pass** at era
  difficulty (threshold 80, Smart rival; seed 2) and at Legend (90, Expert rival; seed 3), all
  three stars and the hidden objective, on the real calls (box for hards under the safety car
  on lap 24, stay at Vettel's last stop, box for softs on lap 49). The stay-out path earns no
  ★3 on any seed (accuracy 79.6-82.9).
- Win target tried first: not reachable at either level (Räikkönen finishes P2-P4 behind
  Vettel on every searched path and seed, with Grosjean ahead of him before the team order
  was entered). Target set to a top-two finish (owner-accepted pattern: a position target when
  beating the draft rival is unreachable); the rewrite stays a win.

## Content

| Item | Value | Fact it rests on | Source | Owner checked |
|---|---|---|---|---|
| Side | **RAI**. `pipeline hard-calls`: hard calls RAI 1, VET 0 (chance given up RAI 7.0, VET 5.7 pts) | – | local run, Nov 9 | |
| Target | `position` 2 ("top two"). Räikkönen is P3 at the end of lap 21 (the takeover), 12.9 s behind Vettel with Grosjean between them | Timing (stateAtTakeover: VET P1, GRO P2 +2.082 s, RAI P3 a further 10.806 s) | Timing | |
| Rewrite | `rewriteCondition` win; headline "Räikkönen's late softs catch Vettel at the Nürburgring" (original). Allowed: Räikkönen finished 2nd, 1.008 s behind | Result | Swap (Jolpica-R) | |
| Storyline | "Vettel leads from the first corner" | Start: Vettel led from Turn 1 | Swap (WP, MS, AS-V) | |
| Storyline | "Räikkönen, fourth on the grid" | Grid | Swap (WP, Jolpica) | |
| Storyline | "stops under the safety car for Bianchi's burning Marussia" | SC for Bianchi (engine failure, fire); Räikkönen in-lap 24 under the SC | Swap (WP, MS, Jolpica-P) | |
| Storyline | "then leads when Vettel and Grosjean make their last stops" | Led from lap 41 when Vettel and Grosjean stopped | Swap (WP) | |
| Storyline | "With his pace dropping, Lotus bring him in for softs on lap 49" | Boullier: his pace was beginning to drop (MS); in-lap 49, last stint softs | Swap (MS, Jolpica-P, WP, AS-K) | |
| Storyline | "he passes Grosjean and finishes second, 1.008 s behind Vettel" | Passed Grosjean after his stop (WP); result +1.008 | Swap (WP, Jolpica-R) | |
| Briefing | "Hamilton took pole, but Vettel has led since the first corner" | Grid, Start | Swap | |
| Briefing | "third after 21 laps and 12.9 s behind him, with your team-mate Grosjean in between" | end of lap 21: VET, GRO +2.1 s, RAI +12.9 s | Timing | |
| Briefing | "Lotus are weighing two stops against three" | Permane: Lotus considered running Räikkönen on a two-stop | Swap (GPE) | |
| Mastery | `stop_count` exact 2 after the takeover: "Finish second or better on two more stops, as Räikkönen made" | in-laps 24 and 49 | Swap (Jolpica-P) | |
| Hidden | `mode_rule` manage, 0 laps: "Finish second or better without a single lap managing the tyres" | game objective, no fact | – | |
| storylineEvents | [24, SC], so Legend keeps the Bianchi safety car (the race's stops hinge on it) | SC lap 23 (WP) / 22 (MS); the built model's SC is lap 24, 6 laps (Jolpica estimate, unchecked) | Swap; Timing | |
| Team order (new incident) | `TEAM_ORDER` lap 55, GRO lets RAI by (`data/incidents.json`, row added to `2.6-drivers-incidents.md`). WP: Lotus told Grosjean not to hold Räikkönen up, and he passed within a few laps of his lap-49 stop (no lap). GPE (Grosjean): sensible, as they were on different strategies. Timing: GRO ahead at the end of lap 54, RAI ahead from the end of lap 55, kept as the sims' lap (as for japan-2023) | WP, GPE, Timing | |

## Notes

- Moments (`pnpm --filter @laststint/sim author germany-2013 --target position:2 --eras
  --write`): sc-24 (real: box, hards), battle-29, pace-33, pace-37 (no real option),
  rivalpit-41 (real: stay; Vettel's last stop), stop-49 (real: box, softs), in
  `data/moments/germany-2013.json`. Not a refuelling race: no fills.
- The model calls Räikkönen's middle stint "HARD" (2013's medium; the compound is not in the
  sources). The grader rates the real lap-49 stop red against staying out to the flag before
  the race is played (stay 74%, box softs 49% for a top two); Räikkönen afterwards wondered
  whether the stop was needed (AS-K). On the reachability paths the stop grades green.
- The safety car's laps (24-29) remain the unchecked Jolpica estimate (sources: out on lap 23 or
  22, no end lap).
- `data/races/germany-2013.json` and its golden must be rebuilt by the integrator
  (`pipeline build germany-2013`); this branch does not commit them.

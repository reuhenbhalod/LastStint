# B1: Eras content for china-2018 (Era 8, #10)

Eras job B1 (author a passing race), Nov 9 2026. china-2018 replaced sakhir-2020 in the second
Era 8 swap batch (`swap-races-era8-overnight.md`, owner pre-approved). Every fact below was read
in the linked source on Nov 9 2026. Nothing comes from memory. The storyline, headline and
briefing are original wording; no team radio is quoted. Check each row against its source, then
put your initials and the date in **Owner checked**.

## Sources

| Short name | Link |
|---|---|
| WP | https://en.wikipedia.org/wiki/2018_Chinese_Grand_Prix (read as plain text, MediaWiki `action=raw`, "Race" section and classification) |
| Timing | TUM timing (CC BY-NC-SA 3.0) in `data/raw/china-2018.parquet`, as built into `data/races/china-2018.json` |
| SW8 | `docs/eras-checks/swap-races-era8-overnight.md`, china-2018 section (Jolpica stops and result, Motor Sport, Autosport, GrandPrix.com) |

## Model status

- Robust G1 (`pipeline validate china-2018 --robust`, Eras build of this branch, base
  `eras-swap-era8-p3`): **pass** (strict pass), mean gap error 2.26 s, with the authored overlay.
- Reachability (`pnpm --filter @laststint/sim reachability china-2018`): **pass** at era
  difficulty (threshold 75, Standard+ rival) and at Legend (90, Expert rival), all three stars
  and the hidden objective. Era (seed 2): stay at stop-19 and cliff-26, box for the harder tyre
  under the lap-31 SC, push at pace-34. Legend (seed 2): the same, but box at cliff-26 as well
  (two stops). The stay-out path never earns ★1 or ★3 (it earns ★2 on most seeds).

## Content

| Item | Value | Fact it rests on | Source | Owner checked |
|---|---|---|---|---|
| Side | BOT (hard calls BOT 3, RIC 2; chance given up BOT 85.0, RIC 2.0; `pipeline hard-calls`) | the grader, not a fact | - | |
| Target | `win` (spec §4: "win: Bottas from P2, ahead of Ricciardo") | Ricciardo won, Bottas 2nd | WP classification | |
| Rewrite | condition `win`; headline "Bottas holds off the Red Bulls to win in Shanghai" (original; a what-if, not a fact) | Bottas finished 2nd, +8.894 s, so a rewrite is allowed | WP classification | |
| Storyline | "Ricciardo wins by 8.894 s" | Ricciardo 1:35:36.380, Bottas "+8.894" | WP classification; SW8 | |
| Storyline | "Bottas undercuts Vettel at the first stops and passes Räikkönen, who stays out long, for the lead" | "After the first pit stops, Bottas managed to undercut Vettel and subsequently overtook Kimi Räikkönen, who had not yet stopped, for the lead"; Jolpica stops Bottas 19, Vettel 20, Räikkönen 27 | WP; SW8 | |
| Storyline | "When the Toro Rosso collision brings out the safety car" | "On Lap 30, the Toro Rosso cars of Brendon Hartley and Pierre Gasly collided at the hairpin ... resulted in the safety car being brought out"; SC on lap 31 (SW8: GPE, MS) | WP; SW8 | |
| Storyline | "both Red Bulls stop at once for new softs while Mercedes keeps Bottas out on old mediums" | "both Red Bull cars pitted for fresh tyres on the same lap"; Verstappen and Ricciardo lap 31 for new softs, Bottas stayed out on 16-lap-old mediums (SW8: Jolpica, MS) | WP; SW8 | |
| Storyline | "Ricciardo works his way forward and passes Bottas for the lead on lap 45" | Ricciardo passed Räikkönen, Hamilton and Vettel; "On Lap 45 Ricciardo overtook Bottas for the lead of the race"; RIC P1 at the end of lap 45 | WP; Timing | |
| Briefing | "Vettel leads from pole and you run Bottas second, fourteen laps in, with Verstappen third and Ricciardo sixth" | Vettel pole; VET, BOT, VER, RAI, HAM, RIC P1-P6 at the end of lap 14 (the takeover lap) | WP; SW8; Timing | |
| Briefing | "Mercedes and Ferrari started on softs, the Red Bulls on ultrasofts, and everyone will stop for mediums" | start tyres (SW8: MS, GPE, AS-race); first stops all to mediums (SW8: Jolpica, MS) | SW8 | |
| Briefing | "Get ahead of Vettel, then keep both Red Bulls behind you to the flag" | game advice, not a fact | - | |
| Mastery | `margin` 8.9 s: "Win by more than 8.9 seconds, Ricciardo's real margin" | Bottas "+8.894" | WP classification | |
| Hidden | `mode_rule` manage, max 0 laps: "Win without a lap managing the tyres" | the game's choice | - | |
| storylineEvents | [31, SC], [53, RETIREMENT] (HAR) | SC on lap 31 (SW8); Hartley the only retirement, 51 laps, "Collision damage" (SW8: Jolpica); the model's laps come from the build (`data/incidents.json`, timing) | SW8; Timing | |

## Notes

- Moments (`pnpm --filter @laststint/sim author china-2018 --target win --eras --write`):
  stop-19, pace-22, cliff-26, sc-31, pace-34 (`data/moments/china-2018.json`), graded on the win.
  sc-31 is the race's dilemma: stay out (the real call) 9%, box for the harder tyre 90%.
  stop-19 (real call box-hard) 88%, stay 96%. cliff-26 (real call stay) 90%.
- Compound labels: the model's names sit one step harder than the race's (start SOFT/MEDIUM for
  the Red Bulls' ultrasofts and the others' softs, HARD for the mediums, MEDIUM for the Red
  Bulls' SC softs), and the model's stop laps are one later than Jolpica's.
- Rejected hidden objectives (reachability): margin 15 s, 12 s and 10 s (Legend's best path wins
  by between 8.9 and 10 s); `stop_count` exactly 1 (era reaches it, but Legend's one-stop path
  misses the 8.9 s mastery).
- Not scripted in the build (as in SW8): Vettel's lap-43 damage and Verstappen's 10 s penalty.
- `data/races/china-2018.json`, its golden and `races.gen.ts` must be rebuilt by the integrator
  (`pipeline build china-2018`); this branch does not commit them.

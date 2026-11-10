# B1: Eras content for china-2017 (Era 8, #8)

Eras job B1 (author a swapped-in passing race), Nov 9 2026. china-2017 replaced italy-2020 in
Era 8 #8 (owner pre-approved swap, migration 0023). Every fact below was read in the sources
listed in `docs/eras-checks/swap-races-era8-overnight.md` (section "china-2017"), in the
English Wikipedia article (raw wikitext, re-read for this sheet) or in the race's timing;
nothing comes from memory. The storyline and briefing are original wording; no team radio is
quoted. Check each row against its source, then put your initials and the date in
**Owner checked**.

## Sources

| Short name | Link |
|---|---|
| WP | https://en.wikipedia.org/wiki/2017_Chinese_Grand_Prix |
| MS | https://www.motorsportmagazine.com/articles/single-seaters/f1/2017-chinese-grand-prix-report/ |
| GPE | https://www.grandprix.com/races/chinese-gp-2017-race-notes-hamilton-wins-chinese-grand-prix.html |
| Jolpica | https://api.jolpi.ca/ergast/f1/2017/2/results.json and `.../2017/2/pitstops.json` (CC BY-NC-SA 4.0) |
| Timing | TUM timing (CC BY-NC-SA 3.0) in `data/raw/china-2017.parquet`, as built into `data/races/china-2017.json` |
| SW8 | `docs/eras-checks/swap-races-era8-overnight.md` (the facts table for this race, read from WP, MS, AS, GPE, Jolpica) |

## Model status

- Robust G1 (`pipeline validate china-2017 --robust`, Eras build of this branch, base
  `eras-swap-era8-p3`): **pass** (strict pass), mean gap error 0.78 s, before and after the
  overlay (same figure as the swap job).
- Reachability (`pnpm --filter @laststint/sim reachability china-2017`, default beam): **pass**
  at era difficulty (threshold 75, Standard+ rival) and at Legend (90, Expert rival), all three
  stars and the hidden objective on one path (rivalpit-34 = box-soft, then standard / push /
  standard). The stay-out path never earns ★3 (no stop, and its lap-34 call grades orange).

## Content

| Item | Value | Fact it rests on | Source | Owner checked |
|---|---|---|---|---|
| Side | HAM (hard calls HAM 1, VET 0; chance given up HAM 15.0, VET 12.7 pts) | the grader, not a fact | - | |
| Target | `defend` | Hamilton led at the takeover (lap 31: HAM P1, VET P2 +11.0 s) and won; Vettel 2nd +6.250 s | Timing; WP, Jolpica | |
| Rewrite | none: the side really won | Hamilton 1st | WP, Jolpica | |
| Storyline | "Rain before the start leaves the track damp" | considerable rain on the morning of the race; the track was damp before the race | WP | |
| Storyline | "Vettel changes to slicks early under the virtual safety car" | the VSC for Stroll's car, during which Vettel pitted for slicks (Jolpica: lap 2) | WP, MS, Jolpica | |
| Storyline | "a safety car soon after lets Hamilton and the others change for free" | Giovinazzi's crash brought out the SC; most drivers changed to slicks as it led the field through the pits; the others got their stops for free (MS); Hamilton stopped on lap 4 | WP, MS, GPE, Jolpica | |
| Storyline | "Hamilton leads from pole while Vettel loses laps stuck behind Räikkönen" | Hamilton pole, led throughout; Räikkönen held up Vettel until lap 20 | WP, MS, Jolpica | |
| Storyline | "Vettel makes his second stop two laps before Hamilton" | Vettel lap 34, Hamilton lap 36 (Jolpica; MS "two laps before Hamilton"; GPE lap 35 for Vettel; WP lap 37 for Hamilton) | Jolpica, MS, GPE, WP | |
| Storyline | "Hamilton keeps the lead to win by 6.250 s" | Hamilton kept the lead through his stop; Vettel +6.250 | MS, GPE, Jolpica, WP | |
| Briefing | "The early rain has gone and the track is dry" | the track would dry out as the day progressed (WP); light rain at the start, drying later (WP infobox); the model's wetness is at most 0.03 from lap 20 on | WP; Timing | |
| Briefing | "You run Hamilton, leading from pole, 11 s ahead of Vettel after 31 laps" | HAM P1, VET P2 +11.0 s at the end of lap 31 (the takeover lap); WP: 10.6 s when Vettel took second on lap 29 | Timing; WP | |
| Briefing | "Both of you have one more stop to make, and Vettel, on older tyres, will come in first" | both stopped once more (VET 34, HAM 36); Vettel's slicks went on at lap 2, Hamilton's at lap 4 | Jolpica, MS; Timing | |
| Mastery | `stop_count` exact 1: "Win on one stop" | Hamilton stopped once after the takeover (lap 36). Chosen because the model's no-stop path wins too: a margin mastery (6.25 s) gave the stay-out path ★3 | Jolpica; Timing | |
| Hidden | `margin` 6.25 s: "Win by more than 6.25 seconds" | Hamilton's real margin was 6.250 s (beat it) | WP, Jolpica | |
| storylineEvents | [35, RETIREMENT] (Alonso) | Alonso retired after 33 laps, driveshaft; the race file's RETIREMENT event is on lap 35 | Jolpica, WP; Timing | |

## Notes

- Moments: `pnpm --filter @laststint/sim author china-2017 --target win --eras --write` picked
  stop-36 (stay 91% green, box-soft 90%, real box-medium 72% red), pace-39, pace-43, pace-47.
  With those, reachability at the default beam failed (the no-stop paths filled the beam; a
  one-stop ★3 path exists at beam 30). Hand-adjusted (owner-accepted pattern): stop-36 replaced
  by the author tool's rivalpit-34 (Vettel stops: real stay 77% orange, box-soft 88% green,
  box-medium 75%, box-next-medium 77%; inters and wets 0%), same option set as the tool builds;
  pace-39, pace-43 and pace-47 kept as the tool wrote them. This is the dilemma the swap sheet
  proposed (cover Vettel at once, or stay out on older tyres). ★3 needs a counterfactual call
  (covering Vettel at once); the real call (stay, stop two laps later) grades orange.
- Rejected objectives: mastery `margin` 6.25 s with hidden `stop_count` 1: the stay-out path
  earned ★3 at both levels (the model's best path is no stop at all; Hamilton's mediums last
  to the flag and the two-compound rule was met by the inters).
- Model compounds: the model's MEDIUM is the race's soft and SOFT is the super-soft (Red Bull's
  super-softs show as SOFT in the timing). The storyline and briefing name no compound.
- Model laps: Hamilton's and Vettel's real stops are pit-ins on laps 36 and 34 in the timing;
  the race file's real strategy puts the new tyre on laps 37 and 35.
- `data/races/china-2017.json` and its golden must be rebuilt by the integrator
  (`pipeline build china-2017`); this branch does not commit them.

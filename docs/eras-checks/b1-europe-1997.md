# B1: europe-1997 (Era 3), and brazil-2019 re-checked after A4

Eras job B1, Nov 8 2026. europe-1997 passed robust G1 (1.20 s, integration 8) but wasn't
authored. It is an Eras-only race (in no Daily or Gauntlet pool), so its overlay is built into
its race file, as for the Eras 1-2 races (`docs/eras-checks/6.2-eras1-2-final.md`). Every fact
below was read in the linked source; nothing comes from memory. Check each row against its
link, then put your initials and the date in **Owner checked**.

Where the content lives:
- `data/eras/europe-1997.json`: the `eras` block (target, storyline, mastery, hidden, briefing,
  `eraId`, `order`, `hardCalls` / `userSide`). No `storylineEvents`: the race has no safety car,
  and Legend always keeps retirements and team orders (`legend.ts isKept`).
- `data/moments/europe-1997.json`: the five decision moments, built into the race file.
- `data/incidents.json` (unchanged): McLaren's swap on lap 67 and Villeneuve's let-bys on lap 69
  (TEAM_ORDER, M4/S9), already sourced to WP-EUR97.

## Sources

| Short name | Link |
|---|---|
| WP-EUR97 | https://en.wikipedia.org/wiki/1997_European_Grand_Prix (read as wikitext, `action=raw`) |
| GPE-EUR97 | https://www.grandprix.com/gpe/rr614.html |
| MS-EUR97 | https://www.motorsportmagazine.com/articles/single-seaters/f1/michael-schumachers-moment-of-madness-at-jerez-1997/ |
| JOL-LAPS | https://api.jolpi.ca/ergast/f1/1997/17/drivers/villeneuve/laps.json and `.../michael_schumacher/laps.json` (CC BY-NC-SA 4.0) |
| JOL-L19 | https://api.jolpi.ca/ergast/f1/1997/17/laps/19.json |
| JOL-ST16 | https://api.jolpi.ca/ergast/f1/1997/16/driverStandings.json |
| WP-BRA19 | https://en.wikipedia.org/wiki/2019_Brazilian_Grand_Prix (via `docs/eras-checks/a4-contact-damage.md`) |

GPE-EUR97 and MS-EUR97 were read through a fetch tool (a summary of the page, not the page
itself), so their rows need a check against the page.

## Side (owner decision: Eras plays the side with more hard calls)

`pipeline hard-calls europe-1997` (grader samples: default), run before and after the `eras`
block was written (same result):

| Race | Hard calls | Chance given up by the real calls (pts) | Counter's side | Eras side | Owner checked |
|---|---|---|---|---|---|
| europe-1997 | VIL 0, MSCM 0 | VIL 0.3, MSCM 0.0 | VIL (tie rule) | VIL (the registry side, unchanged) | |

## The race: facts used in the authored text

| Item | Fact | Source | Owner checked |
|---|---|---|---|
| Event | Jerez, 26 October 1997, the 17th and last race of the season, 69 laps | WP-EUR97 | |
| Championship | Schumacher led with 78 points, Villeneuve second on 77 | WP-EUR97; JOL-ST16 has Villeneuve on 77 after round 16 (Jolpica lists no Schumacher: his 1997 points were later removed, WP-EUR97) | |
| Title rule | Villeneuve had won two more races than Schumacher, so a tie on points went to him; he had to finish in the points and ahead of Schumacher to be champion | WP-EUR97 (JOL-ST16: Villeneuve 7 wins) | |
| Qualifying | Villeneuve, Schumacher and Frentzen all set 1:21.072; Villeneuve set it first and took pole, Schumacher second, Frentzen third | WP-EUR97; GPE-EUR97 (grid order) | |
| Start | Schumacher led into the first corner; Frentzen also passed Villeneuve, and let him by on lap 8 under team orders | WP-EUR97; GPE-EUR97 | |
| Takeover | End of lap 19 (the race file's takeover): Schumacher P1, Villeneuve P2, 5.584 s behind (sum of each driver's first 19 Jolpica lap times; the race file's `gapAhead` 5.584). Briefing: "5.6 s" | JOL-L19 (positions), JOL-LAPS (gap) | |
| First stops | Schumacher stopped on lap 22, Villeneuve the lap after; both kept their places | WP-EUR97; GPE-EUR97 ("on the next lap") | |
| Second stops | Laps 43 (Schumacher) and 44 (Villeneuve); the order stayed the same, with Villeneuve closer | WP-EUR97; GPE-EUR97 | |
| Before the collision | Villeneuve went into lap 48 less than a second behind (Jolpica: 0.385 s at the end of lap 47) | WP-EUR97; JOL-LAPS | |
| Collision | Lap 48, at the Dry Sac corner: Villeneuve went for the inside, Schumacher turned in on him; Schumacher retired. Jolpica has Schumacher on 47 laps | WP-EUR97; GPE-EUR97; MS-EUR97 (lap 48); JOL-LAPS | |
| Villeneuve's car | Damaged (WP: battery mounts; MS: sidepod, electrical parts dislodged); slower than the cars behind for the rest of the race | WP-EUR97; MS-EUR97; GPE-EUR97 | |
| The finish | On the last lap both McLarens caught Villeneuve, who let them through (Häkkinen had taken second back from Coulthard under team orders); Villeneuve third, 1.803 s behind Häkkinen, Berger 0.116 s behind him; champion by three points | WP-EUR97 (GPE-EUR97: Coulthard let Häkkinen by three laps from the end, "probably" on orders) | |

## The `eras` block

| Field | Value | Basis | Owner checked |
|---|---|---|---|
| `eraId` / `order` | 3 / 6 | `data/pools.json` eras["3"], sixth | |
| Target | beat-rival MSCM ("Finish ahead of him") | The spec §4 draft (Villeneuve ahead of Schumacher), which is the title condition (WP-EUR97). Note: Schumacher's lap-47 retirement is a real event and always happens in live play, so ★1 needs Villeneuve to finish; the grader doesn't know it's coming (docs/eras-grader.md), so the calls before lap 47 grade on beating him on the road | |
| Storyline (`real`) | Schumacher leads from the first corner; both stop twice and keep their places; lap 48 at Dry Sac, Schumacher turns into him and is out; the damaged Williams slows; Villeneuve lets both McLarens through on the last lap and takes third and the title | Rows above | |
| Rewrite | None. Villeneuve really met the target and won the title, as south-africa-1983 (Piquet third and champion) has none. The history-book rewrite totals drop by one (tests updated). **Owner to confirm**: portugal-1984 (Lauda second and champion) does have a rewrite (`win`) | Owner decision "no rewrite if the side really won"; precedent | |
| Mastery | `beat_real_call`: "Beat Villeneuve's real third place and still take the title" (P2 or better) | Real result P3 (WP-EUR97). Needs ignoring the last-lap let-by | |
| Hidden | `finish_position` 1: "Win the race as well as the title" | — | |
| Briefing | Jerez, October 1997, last race; Schumacher leads by a point, 78 to 77; Villeneuve has more wins, so he's champion if he scores and finishes ahead; three drivers on the same qualifying time, Villeneuve on pole but Schumacher led into turn 1; you run Villeneuve, second after 19 laps, 5.6 s behind | Rows above | |

## Moments (`pnpm --filter @laststint/sim author europe-1997 --target beat-rival --eras --write`)

| Moment | Options | Real | Note |
|---|---|---|---|
| stop-23 | stay / box mediums (real fill) / box next lap | box (the race file's stop on lap 24, from F1DB stops: the call is made on lap 23; WP: the lap after Schumacher's lap 22) | Kept though every option grades alike (no-choice): a refuelling car has no other way to its fill |
| stop-44 | stay / box mediums (real fill) / box next lap | box | as above |
| pace-47 | push / standard / manage / push and attack | — | Push and push-attack grade red (11% against 100%); standard and manage green |
| pace-51 | push / standard / manage / push and attack | — | as above |
| teamorder-69-hak | Let HAK through / Ignore the order | comply | The real call (comply arms both let-bys on lap 69, HAK and COU) |

Authoring changes (`packages/sim/scripts/authoring.ts`): a team order to the player's car is now
kept as the moment finder offers it (it used to be rewritten into a pit call, which threw "no
stop on the final lap"), and always kept; a refuelling race's real stops are kept when the
verdict is no-choice. `packages/schema/race-model.schema.json`: `teamOrder` added to the
decision-moment triggers (the sim's `MomentTrigger` already had it since M4). **Owner to
confirm** the schema addition (spec §19: ask before changing a schema Daily uses; the change is
additive and no Daily or Gauntlet file changes).

## Reachability (`pnpm --filter @laststint/sim reachability europe-1997`)

| Level | Result | Best path | Stay-out |
|---|---|---|---|
| Era (threshold 86, Expert) | ★1 ★2 ★3, hidden yes, accuracy 100 | stop-23 box, stop-44 box, pace-47 standard, pace-51 standard, team order ignore | no ★1 (runs dry), no ★3, on seeds 1-3 |
| Legend (90, Expert) | ★1 ★2 ★3, hidden yes, accuracy 100 | same | no ★1, no ★3, on seeds 1-3 |

The real path (box, box, comply) earns ★1 and ★2 but not ★3 (third place).

## brazil-2019 after A4

A4 added Hamilton's and Albon's lap-70 contact (`fault: "damage"`, one lap, a storyline event).
Its race file on `eras` already carries both. A contact over in its own lap leaves no call
(`moments.ts`), so no moment changed. Re-checked, nothing re-authored:

| Check | Result | Owner checked |
|---|---|---|
| Reachability, era (75, Standard+) | pass: ★1 ★2 ★3 + hidden (stop-20 box, pace-25 push, pace-29 push, stop-43 box, sc-54 box, battle-59 hold); stay-out no ★3 on seeds 1-3 | |
| Reachability, Legend (90, Expert) | pass: same path; stay-out no ★3 on seeds 1-3 | |
| Storyline | "collides with Albon on the penultimate lap and loses second to Gasly by 0.062 seconds at the line" still matches the A4 facts (lap 70 of 71; WP-BRA19: Hamilton was slowed by the contact, letting Gasly into second). Briefing unchanged (grid only) | |

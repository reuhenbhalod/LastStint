# B2 re-author: malaysia-2013, spain-2013, spain-2016

Nov 8 2026, on `eras` after Sector A (`009ae64`). These three authored races stopped being
reachable after integration 8's rebuild (docs/eras-races-report.md). Each one was re-authored
with the smallest change that makes it reachable at the era's difficulty and at Legend, with
stay-out never earning ★3. The sides are unchanged (malaysia-2013 WEB, spain-2013 RAI,
spain-2016 RAI). No model or sim code changed; only the three overlays (`data/eras/`), two
moment files (`data/moments/`) and the three rebuilt race files. Golden files are unchanged
(the rebuild reproduces them byte for byte), and no Daily or Gauntlet file changed.

No new outside facts were needed. Every fact below comes from the race's committed data or an
earlier sheet's checked row. Headlines are unchanged. No team radio is quoted. Check each row and
put your initials and the date in **Owner checked**.

## Sources

| Short name | What |
|---|---|
| JOL | Jolpica results as in the race file's `realResult` (order) and the earlier sheets' gaps |
| RAW | The race file's `realStrategy`: each car's real stops (out-lap, compound) |
| RACE | data/races/<id>.json at the takeover (`stateAtTakeover`) |
| earlier | docs/eras-checks/6.2-eras7-4.md and 6.2-reauthor-modern.md rows, still valid (not re-listed) |

## Why each race failed

| Race | Failure on `eras` | Cause |
|---|---|---|
| malaysia-2013 | No path earns ★1 (win) at either level | On the rebuilt model Vettel is about 0.27 s a lap faster than Webber. Every searched path, including the real calls, finishes behind him (P2, 0.2 to 14 s back on seeds 1-3) |
| spain-2013 | ★1-3 earned, hidden objective (win by more than 5 s) missed | The winning paths win by 0.3 to 0.8 s (seed 1 era, seed 3 Legend) |
| spain-2016 | Best path ★2 only | The old moments graded two soft stops green, a path that ends disqualified (two-compound rule). Re-authored on `win`, the era level became reachable but Legend did not: the Expert Verstappen beats Räikkönen on every searched path (by 3 to 26 s in the paths played) |

## Per race: what changed

### malaysia-2013 (Era 6 #9, Webber): target win -> position 2

- **Target** `position` 2 (was `win`): Webber's real result. The win is out of reach on the
  rebuilt model at both levels, the france-2021 case (6.2-reauthor-modern). **Rewrite** stays
  `win`, headline unchanged ("Webber keeps Vettel behind and wins in Sepang"), so beating Vettel
  is still the history-book rewrite.
- **Mastery** unchanged (stop_count exact 3); label now "Finish second or better on three more
  stops, as Webber made". **Hidden** unchanged (compound_rule mustUse HARD); label now "Finish
  second or better with a stint on the hard tyre".
- **Briefing:** the last sentence is now "Bring the car home no lower than second, and keep
  Vettel behind to rewrite the day." The rest is unchanged.
- **Moments** re-authored on P2 (`pnpm --filter @laststint/sim author malaysia-2013 --eras
  --target position:2 --write`): stop-19 (real: box-soft), pace-24, stop-31 (real: box-soft),
  pace-36, stop-43 (real: box-hard). Was: stop-19, rivalpit-22, pace-28, stop-31, pace-36,
  stop-43, graded on the win.

| Fact | Used in | Source | Owner checked |
|---|---|---|---|
| Webber finished P2, behind Vettel (+4.298 s) | target | JOL; earlier (6.2-eras7-4) | |
| Webber's stops after the lap-16 takeover: out-laps 20, 32 (SOFT), 44 (HARD) | mastery, hidden, moments' real options | RAW; earlier (6.2-reauthor-modern) | |
| At lap 16: WEB P1, VET P2 2.4 s behind | briefing (unchanged) | RACE | |

### spain-2013 (Era 6 #10, Räikkönen): hidden margin -> no more softs

- **Hidden** `compound_rule` mustAvoid SOFT, "Win without fitting the soft tyre again" (was
  margin 5 s). Räikkönen took over on hards and both his remaining real stops were onto hards.
- Everything else unchanged: target `win`, rewrite `win`, mastery exact 2, moments, briefing.

| Fact | Used in | Source | Owner checked |
|---|---|---|---|
| Räikkönen on HARD at the lap-18 takeover (soft and hard already used) | hidden | RACE | |
| His two stops after the takeover: out-laps 27 and 46, both HARD | hidden | RAW | |

### spain-2016 (Era 7 #7, Räikkönen): target win -> position 2

- **Target** `position` 2 (was `win`): Räikkönen's real result. **Rewrite** stays `beat-rival`
  VER, headline unchanged ("Räikkönen spoils the teenager's party in Barcelona").
- **Mastery** unchanged (stop_count exact 2); label now "Finish second or better on two stops, as
  Räikkönen made". **Hidden** `compound_rule` mustAvoid HARD, "Finish second or better without the
  hard tyre" (was margin 5 s, which needs a win). Räikkönen's two real stops were both onto mediums.
- **Briefing:** the last sentence is now "Pick your stops: finish no lower than second, and beat
  Verstappen to rewrite the day." The rest is unchanged.
- **Moments** re-authored on P2 (`author spain-2016 --eras --target position:2 --write`):
  rivalpit-12 (real: box-medium), pace-25, pace-29, stop-35 (real: box-medium). Was: stop-12,
  stop-29, stop-35, pace-45, battle-60, graded on the win.

| Fact | Used in | Source | Owner checked |
|---|---|---|---|
| Verstappen won, Räikkönen P2 +0.616 s | target | JOL; earlier (6.2-eras7-4) | |
| Räikkönen's two stops after the lap-9 takeover: out-laps 13 and 36, both MEDIUM | mastery, hidden, moments' real options | RAW | |

## Reachability (all 3 pass, both levels)

`pnpm --filter @laststint/sim reachability <id>`, one race per call, on the rebuilt files.

| Race | Era difficulty (seed, path) | Legend (seed) | Stay-out ★3 |
|---|---|---|---|
| malaysia-2013 | PASS (1): stop-19 box-soft, pace-24 push, stop-31 box-soft, pace-36 push-attack, stop-43 box-hard | PASS (1), same path | no (at either level) |
| spain-2013 | PASS (1): rivalpit-21 stay, stop-26 box-next-hard, cliff-33 stay, rivalpit-36 stay, stop-45 box-hard, rivalpit-49 stay | PASS (3), same path | no |
| spain-2016 | PASS (1): rivalpit-12 box-medium, pace-25 standard, pace-29 standard, stop-35 box-medium | PASS (1), same path | no |

## For the owner

- **Two targets dropped from a win to the real P2** (malaysia-2013, spain-2016), as france-2021
  did. Both races were drafted as wins (spec §4: "defend: Webber holds P1", "defend: Verstappen
  holds off Räikkönen" from the other side). On the rebuilt models no searched path wins at
  Legend in either race, or at all in Malaysia. The win is still there as the rewrite. If you'd
  rather keep a win target, it needs model work (Webber's pace vs Vettel's in Sepang; the
  Expert rival in Barcelona), not authoring.
- **Their passing paths are the real calls.** In both races ★1-3 and the hidden objective come
  from repeating the real team's strategy; the challenge is in the rewrite.
- spain-2013 still fails robust G1 (duel RAI vs ALO just over the limit), so it stays not ready.

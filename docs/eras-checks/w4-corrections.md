# W4 race-data corrections: owner sign-off

Eras race regressions (W4), Nov 8 2026. Every fact below was read in the linked source.
Nothing comes from memory. Where a source gives no lap, the row says where the lap came from
(the race's timing in `data/raw/<id>.parquet`, or the F1DB stops). Check each row against its
links, then put your initials and the date in **Owner checked**.

G1 is robust mode (`pipeline validate <id> --robust`: 1,000 runs on each of two seed sets, one
race per call). Before = docs/eras-races-report.md (integration 6). After = this branch. No sim
code, Eras overlay (`data/eras`) or moment file (`data/moments`) was edited, and no Daily or
Gauntlet file changed.

## Sources

| Short name | Link |
|---|---|
| WP-BEL98 | https://en.wikipedia.org/wiki/1998_Belgian_Grand_Prix |
| AS-BEL98 | https://www.autosport.com/f1/news/1998-belgian-gp-when-the-schumachers-went-to-war/10744117/ |
| WP-EUR99 | https://en.wikipedia.org/wiki/1999_European_Grand_Prix |
| AS-EUR99 | https://www.autosport.com/historics/live-text/1999-european-grand-prix-19660/19660/?dir=asc (pages 2 and 3: `&p=2`, `&p=3`) |
| WP-GER00 | https://en.wikipedia.org/wiki/2000_German_Grand_Prix |
| WP-MON11 | https://en.wikipedia.org/wiki/2011_Monaco_Grand_Prix |
| WP-GBR16 | https://en.wikipedia.org/wiki/2016_British_Grand_Prix |
| WP-EUR12 | https://en.wikipedia.org/wiki/2012_European_Grand_Prix |
| WP-MAL01 | https://en.wikipedia.org/wiki/2001_Malaysian_Grand_Prix |
| WP-BRA08 | https://en.wikipedia.org/wiki/2008_Brazilian_Grand_Prix |
| WP-AUS10 | https://en.wikipedia.org/wiki/2010_Australian_Grand_Prix |
| WP-USA03 | https://en.wikipedia.org/wiki/2003_United_States_Grand_Prix |
| WP-MAL13 | https://en.wikipedia.org/wiki/2013_Malaysian_Grand_Prix |

Wikipedia was read as plain text through the MediaWiki API. Autosport was read through a fetch
tool.

## G1 before and after

| Race | Before | After | What changed |
|---|---|---|---|
| belgium-1998 | fail, 14.21 s | fail, 5.25 s | SC laps 29-32 (10.95 s on that alone) + Jordan's hold order. Duel now 0.15 s; ALE (11.8 s) and DIN (13.7 s) fail. The sim's restart is nose-to-tail (real: HIL 2.4 s, ALE 4.7 s back), and the sim's ALE then passes the Jordans |
| germany-2000 | fail, 32.31 s | fail, 2.85 s | both SCs entered, the later rain periods rejected. Every check passes at 300 runs, but the duel (2.87 [3.00]) and DLR (4.98 [5.00]) sit at their limits, so robust G1 fails |
| europe-1999 | fail, 23.24 s | fail, 25.63 s | the tyre facts alone: 20.85 s. Rejecting the 36-43 "SC" (rain) puts those laps back in the pace fit: 25.63 s. **Needs model work**, see below |
| monaco-2011 | fail, 43.37 s | fail, 15.16 s | the first SC is one period (34-38), and the late SC (69-71) is now an SC, not a yellow. VET/ALO/BUT now within 1 s of their real gaps. HAM (71 s) and WEB (27 s) are the no-unlapping gap. Wear: no change, see below |
| great-britain-2016 | fail, 2.11 s | fail, 2.37 s | ROS gearbox fault, laps 46-47. Duel order now passes (0.59 -> 0.63 at 1,000 runs). Podium order is unchanged (0.40) and the gap errors grow a little |
| europe-2012 | fail, 1.94 s | fail, 1.94 s | **not changed: blocked by authored content**, see below |
| malaysia-2001 | fail, 8.35 s | fail, 9.92 s | SC from lap 4 (was 5) |
| brazil-2008 | fail, 5.42 s | fail, 5.42 s | SC confirmed (laps unchanged) |
| australia-2010 | fail, 4.10 s | fail, 4.11 s | SC laps 1-4 (was 1-5) |
| united-states-2003 | fail, 4.77 s | fail, 6.20 s | laps 21 and 23 were rain, not an SC (rejected): those laps are now in the pace fit |
| malaysia-2013 | pass, 1.20 s | pass, 1.20 s | laps 2-6 were the wet track, not an SC (rejected). Reachability still passes |

## Safety-car hand checks (`data/estimates/<id>.sc.json`)

Each period's `source` field in the file carries the quote. Periods not listed here stay
`unchecked` for the owner.

| Race | Period (was) | Now | Fact | Source | Laps from | Owner checked |
|---|---|---|---|---|---|---|
| belgium-1998 | 2 (ambiguous) | 1-2 SC, confirmed | "The safety car was withdrawn at the end of the second lap" (after the restart's first-lap crashes). The same laps as data/redflags `restartScLaps` | WP-BEL98 | WP | |
| belgium-1998 | 30-32 (likely) | 29-32 SC, confirmed | Fisichella hit Nakano, "the safety car again being deployed, and Hill immediately made his second pitstop". "The restart came with 12 laps to go" (green from lap 33 of 44) | WP-BEL98, AS-BEL98 | Hill's stop is at the end of lap 28 (F1DB). The leaders' lap 29 took 186-230 s, all finished within 2.4 s | |
| germany-2000 | 28 (ambiguous) | 25-28 SC, confirmed | The intruder "until lap 25 ... deploy the safety car"; "Racing resumed on lap 29" | WP-GER00 | WP | |
| germany-2000 | 31 (ambiguous) | 30-31 SC, confirmed | Diniz / Alesi on lap 30, "Officials again deployed the safety car"; "withdrawn at the end of the 31st lap" | WP-GER00 | WP | |
| germany-2000 | 35-42 (ambiguous) | rejected | Rain: from lap 32, "a downpour in the stadium section on lap 35". "Without the need for a third safety car period" | WP-GER00 | | |
| germany-2000 | 45 (ambiguous) | rejected | Rain: "By lap 44, it began raining more heavily". No third SC | WP-GER00 | | |
| europe-1999 | 2-6 (likely) | 2-6 SC, confirmed | Diniz's first-corner roll: "The safety car was deployed" | WP-EUR99 | No laps in WP: timing | |
| europe-1999 | 36-43 (ambiguous) | rejected | Rain: "the rain came back with a vengeance ... most pitted for wets". Neither source has a second SC | WP-EUR99, AS-EUR99 | | |
| monaco-2011 | 34-35 and 38 (ambiguous) | 34-38 SC, confirmed (one period) | Massa crashed in the tunnel, "bringing out the first safety car" | WP-MON11 | No laps in WP. Massa's last lap is 32. The leader ran 86.3 s on lap 34 (deployment), 115-129 s on 35-38 and 81.0 s on 39 (green 79 s). The estimate's laps 36-37 were green inside the SC | |
| monaco-2011 | 69-73 (ambiguous: "a red flag?") | 69-71 SC, confirmed | After the Sutil / Alguersuari / Petrov crash, "This brought out the safety car again and on lap 72 the race was red flagged". Lap 72 (red) and 73 (SC) stay data/redflags/monaco-2011.json's | WP-MON11 | Lap 69 from the timing: leader 85.7 s, then 123-130 s | |
| malaysia-2001 | 5-10 (likely) | 4-10 SC, confirmed | "On lap four ... Whiting deployed the safety car on the lap"; "withdrawn at the end of lap 10" | WP-MAL01 | WP | |
| brazil-2008 | 1-4 (likely) | 1-4 SC, confirmed | "deployment of the safety car at the end of the first lap"; "Racing resumed on lap five" | WP-BRA08 | WP | |
| australia-2010 | 1-5 (likely) | 1-4 SC, confirmed | First-lap incident, "deployment of the safety car"; "Racing resumed at the end of lap four" (lap 8 left unchecked) | WP-AUS10 | WP | |
| united-states-2003 | 21 and 23 (ambiguous) | both rejected | Rain: "On lap 18, light rain returned ... intensifying on the next lap", "On lap 21, Button lost control ... as drivers began stopping for rain tyres". No SC in the article | WP-USA03 | | |
| malaysia-2013 | 2-6 (ambiguous) | rejected | Wet track: a downpour before the start, "all cars used intermediate tyres", "DRS was enabled on the third lap", Vettel to slicks on lap 5. No SC in the race report | WP-MAL13 | | |

**Not changed: europe-2012.** WP-EUR12 has one SC: Vergne and Kovalainen collide "on lap 27",
and "The race restarted on lap 34". In the timing, lap 28 is the field's first slow lap. So the
correction is one period, laps 28-33, in place of the estimate's 28-29 (yellow) and 31-33
(SC). But the authored overlay flags an SC starting on lap 31 (`data/eras/europe-2012.json`
`storylineEvents: [[31, "SC"]]`), and the moment `sc-32` triggers on that SC
(`data/moments/europe-2012.json`). With the correction, the build stops ("no SC event on lap 31
to flag"). The hand-check file is left unchecked. **Owner / author:** move the storyline SC to
lap 28 (and check `sc-32`), then confirm 28-33.

**Applied in integration 7.** `data/estimates/europe-2012.sc.json` is now one confirmed period,
laps 28-33 (`pipeline jolpica europe-2012 --force`, then rebuilt). The overlay's storyline SC
moved to lap 28 (`storylineEvents: [[28, "SC"]]`). In the moments, `stop-28` (Räikkönen's real
stop, in-lap 28, real option box-hard) already sat on the new SC's first lap, and `pnpm author
europe-2012 --eras` now picks `sc-28` there, so `stop-28` became `sc-28` (trigger SC, the same
options and real option) and `sc-32` was dropped. Owner checked: ______.

## Team orders and faults (`data/incidents.json`)

| Race | Item | Fact | Sources | Lap from | Owner checked |
|---|---|---|---|---|---|
| belgium-1998 | TEAM_ORDER, SCH lets HIL by, one item on each lap 33-44 | Jordan's order: Ralf Schumacher not to overtake Hill. "Ralf, you cannot overtake Damon, that is a team order" (Sam Michael, AS). WP: "team orders had been issued preventing the younger Schumacher from overtaking Hill" | WP-BEL98, AS-BEL98 | No lap in either source: AS has it in the closing stages, after the restart "with 12 laps to go" (lap 33). It is a hold order, not a let-by, so it is entered as a let-by open on every green lap from 33 to the flag. Each item lapses while HIL is ahead, and a sim SCH that gets ahead is put back 0.5 s behind him and stays there. The timing has HIL ahead of SCH at every lap end from 26 | |
| great-britain-2016 | FAULT, ROS, Gearbox (gear-stuck), lap 46, `laps: 2` | "As Räikkönen got back into fifth at the expense of Pérez, Rosberg reported problems with his gearbox". He was told to avoid seventh, then "was able to consolidate his slim lead over Verstappen" | WP-GBR16 | No lap in WP. RAI passes PER on lap 46 (timing). ROS's laps 46-47 are 3.2 s and 2.5 s over his laps either side, and VER closes from 6.2 to 2.0 s. The magnitude is fitted, never written | |

## Tyre facts (`data/estimates/europe-1999.tyres.json`, new)

A new hand-checked file, read by `pipeline wet-laps` (`wet_laps.load_tyre_facts`). Each listed
stint keeps its sourced class through the tyre-class fit, and the wetness is fitted around it.
Unlisted stints are fitted as before. Class `rain` means the source says only "wets" / "wet
tyres": it rules out slicks, and the fit picks inter or wet (here it picks inter for all of
them). AS-EUR99 gives clock times, not laps. Each entry is matched to the F1DB stop at that
point: 10:52 HAK end of lap 20, 11:02 SCH 27, 11:09 FRE/COU 32, 11:14-11:15 HER/TRU 35, 11:24
IRV 40, 11:28 SCH 44, 11:32 HER 47.

| Driver, stint (laps) | Class | Fact | Source | Owner checked |
|---|---|---|---|---|
| HAK 2 (21-24) | rain | "At the end of lap 20, Häkkinen pitted for wet tyres". AS 10:52 "put Hakkinen on the wets" | WP-EUR99, AS-EUR99 | |
| HAK 3 (25-66) | slick | "pitted again to change back to dry tyres". AS 10:59 "a set of slicks" | WP-EUR99, AS-EUR99 | |
| SAL 2 (21-23) | rain | AS 10:53 "Salo is also going onto the wets" | AS-EUR99 p2 | |
| IRV 2 (22-40) | slick | "The following lap Irvine pitted for dry tyres" | WP-EUR99 | |
| IRV 3 (41-49) | rain | AS 11:24 "it's Irvine - he's putting wets on" | AS-EUR99 p3 | |
| COU 2 (33-37) | slick | "Coulthard chose to stay out on dry tyres while most pitted for wets" (off on lap 38) | WP-EUR99 | |
| FIS 2 (33-48) | slick | "Fisichella, also on dry tyres, to take the lead" (the fit had inters) | WP-EUR99 | |
| SCH 2 (28-44) | slick | "Schumacher, still on dry tyres, then inherited the lead" | WP-EUR99 | |
| SCH 3 (45-50) | slick | AS 11:28 "Schumacher pits from the lead"; 11:30 "Schumacher's on slicks" (the fit had inters) | AS-EUR99 p3 | |
| HER 2 (36-47) | rain | AS 11:14 "taking a gamble on wet tyres"; WP "changing to wet tyres just at the right time" | AS-EUR99 p2, WP-EUR99 | |
| HER 3 (48-66) | slick | AS 11:32 "opting for the slicks to presumably go to the end" | AS-EUR99 p3 | |
| TRU 3 (36-48) | rain | AS 11:15 "Trulli also stops"; 11:33 "here's Trulli bearing wet tyres" | AS-EUR99 p2-p3 | |

**europe-1999 needs model work.** With the sourced tyres and the SC rejection (100 runs, mean
sim gap minus real), the wet-tyre runners still finish too far back (HER +12 s, TRU +8 s) and
the slick runners too far forward (BAR -21 s, SCH -37 s, HAK -36 s, IRV -29 s, GEN -27 s; HAK
stayed on slicks from lap 25 through the downpour). The model has one
wetness per lap. At the fitted wetness its slick / inter curves put the two tyres about 2%
apart, but the real second shower had them about 8% apart (4.5-wet-races.md). Holding the
sourced "wets" as full WET made it far worse (55.76 s): the WET curve is too slow at that
wetness. The class labels are now right, as far as the sources go. The gap is in the wet
curves (or a per-car wetness), not the data.

## Monaco 2011 tyre wear (no change)

The fitted HARD (prime) wear is 0.003 s a lap after the SC fix (0.002 before). VET's real
62-lap stint (laps 17-68, green laps) slopes 0.023 s a lap with the fuel effect added back,
almost all of it in laps 59-68 (median 80.1 s, against 79.1-79.5 s before). The field's other
long HARD stints don't support more wear: ALO 0.041, WEB 0.005, KOB -0.021 s a lap. So the
pipeline's normal fit is right for the compound. VET's late fall-off is driver- and stint-
specific: pace management in the lead, then being caught. It no longer drives the G1 failure:
after the SC fix, VET, ALO and BUT are each within 1 s of their real gaps. A within-stint
fall-off term would be model work, not a data fix. What still fails is HAM (71 s) and WEB
(27 s) a lap down at the red-flag restart: the no-unlapping gap (races report gap 12).

## Also regenerated

- `data/sc_rates.json` (the Legend SC rates read the raw status timelines; all-track SC rate
  0.7294 a race) and `pipeline/tests/fixtures/legend_parity.json` (`uv run python -m
  pipeline.legend`).
- Race and golden files of the races above (`pipeline build <id>`). brazil-2008's race file
  and malaysia-2013's golden didn't change.

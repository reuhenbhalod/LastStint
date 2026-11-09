# B3 near misses: diagnosis (no model change)

Eras job B3, Nov 9 2026, branch `eras-b3-near-misses` from `eras` at 973d827. Goal: a robust-G1
pass for the near-miss races with the smallest well-founded change. Result: **no change made.**
None of the five races is missing a sourced fact the model can carry, and the one global lever
that moves them (the M2 stint-offset shrink) trades one race for others. hungary-2024 already
passes at 973d827. No race file, golden, incident, overlay or sim code changed.

G1 is robust mode (`pipeline validate <id> --robust`: 1,000 runs on each of seed sets 10000 and
20000, one race per call), run on native Windows at 973d827. The committed hungary-2024 race
file is byte-identical to a fresh `pipeline build hungary-2024`.

## Sources read

| Short name | Link |
|---|---|
| WP-ESP13 | https://en.wikipedia.org/wiki/2013_Spanish_Grand_Prix |
| WP-CHN11 | https://en.wikipedia.org/wiki/2011_Chinese_Grand_Prix |
| WP-ABU12 | https://en.wikipedia.org/wiki/2012_Abu_Dhabi_Grand_Prix |
| WP-BRA21 | https://en.wikipedia.org/wiki/2021_S%C3%A3o_Paulo_Grand_Prix |

Wikipedia was read as wikitext through `index.php?action=raw`. Lap times are the committed
`data/raw/<id>.parquet` (Jolpica laps before 2018, FastF1 after).

## G1 at 973d827 (unchanged by this job)

| Race | Era | Status | Mean gap error | Failing checks (seed 10000 / 20000) |
|---|---|---|---|---|
| spain-2013 | 6 | fail | 1.59 s | duel RAI vs ALO gap error 3.28 / 3.23 [3.00] |
| china-2011 | 6 | borderline | 1.47 s | podium order rate 0.50 pass / 0.49 [0.50] |
| hungary-2024 | 10 | **pass** | 2.52 s | none (field LEC 4.82 / 4.83, VER 4.77 / 4.89 [5.00]) |
| abu-dhabi-2012 | 6 | fail | 1.72 s | duel VET vs BUT gap error 3.40 / 3.22 [3.00]; duel order rate 0.55 / 0.56 [0.60] |
| brazil-2021 | 9 | fail | 1.91 s | duel VER vs HAM gap error 3.34 / 3.59 [3.00] |

hungary-2024: the races report has it borderline at 2.58 s (LEC 5.02 / VER 5.03 on one seed
set, the A4 branch's figure). At 973d827 it passes on both seed sets. The A4 figures for its
other two races also differ at 973d827 (europe-2012 pass 1.38 s, A4 sheet 1.16 s; brazil-2019
pass 1.66 s, A4 sheet 1.52 s), so the A4 sheet's numbers predate something merged since; the
race files themselves are current.

## Diagnoses

Lap traces below are the sim's mean gap (200 runs) against the real gap at each lap's end.

**spain-2013 (RAI vs ALO, real 9.34 s; sim mean 12.42 s).** The sim tracks the real gap to
within about 1 s up to lap 64 of 66. The miss is ALO's last stint (hards from lap 50): in the
timing he pulls out to 13.68 s by lap 59, then gives 4.3 s back over the last seven laps (laps
60-66 of 88.8 to 89.4 s and a 92.6 s last lap, against RAI's 87.8 to 90.1 s). His stint offset
(+0.229 s/lap) averages that, but the M2 shrink (n / (n + 5)) and the 3 s residual clip pull it
toward 0, so the sim's ALO ends about 3 s further ahead. WP-ESP13 says nothing about Alonso
easing off, and no source read gives a fault, slow stop or penalty for either car. Model gap 3
(stint-to-stint pace: a leader managing to the flag).

**china-2011 (podium HAM, VET, WEB; order rate 0.49 on one seed set).** The commonest sim
podium is HAM, VET, BUT (17% of 500 runs, against 13% for the real one): the sim's WEB (from
18th, sim mean 10.67 s against 7.56 s real) is held behind KOB, SUT, MSCM and PET in its middle
stint and gains 21 s on BUT over laps 41-56 where the real WEB gained 26 s. Model gap 1 (weak
overtaking). WP-CHN11's facts are already in the model: Button's lap-15 stop at the Red Bull
box and Vettel's wait behind him are in their measured stop losses (BUT lap 15 27.9 s, VET
lap 15 26.0 s, HAM's lap-16 stop 25.2 s), and Alguersuari's lap-10 lost wheel is before the takeover
(lap 11).

**abu-dhabi-2012 (VET vs BUT, real VET 3.62 s ahead; sim 0.38 s ahead).** The second SC
(laps 39-42) resets the gaps; the sim's restart matches (VET 0.96 s behind BUT, real 0.59 s).
WP-ABU12 has Vettel failing to pass Button on lap 48 and passing "four laps later" (lap 52, as in
the timing), then gaining about 0.9 s a lap on fresh softs. The sim's VET gets by earlier but
gains only 1.3 s over laps 43-55: his last-stint offset (-0.108) is fitted over laps mostly spent
behind Button. Model gaps 1 and 3. Sourced but not entered (no effect on the failing duel):
Webber told not to fight Vettel on lap 30 (he pitted on lap 31 and retired on lap 39);
Maldonado without KERS after the first SC, Kobayashi's downshift problem (both cars pass their
field checks).

**brazil-2021 (VER vs HAM, real VER 10.50 s behind; sim 7.29 s).** HAM passes earlier in the
sim (gap turns positive at lap 52; real lap 59), and after the pass the real VER loses about
0.9 s a lap to HAM over laps 59-71, the sim's 0.38 s. The lap-48 turn-4 moment costs both cars
about the same in the timing and the sim matches it (0.2 s). WP-BRA21's race section has no
detail. Model gaps 1 and 3; no sourced fact found for VER's late pace.

## Why no global change

The one lever that moves these races is the M2 stint-offset regulariser (pace.py
`STINT_SHRINK_LAPS` = 5, `STINT_CLIP` = 3). As an experiment only (not committed), robust G1 with
offsets unshrunk and unclipped:

| Race | Now | Unshrunk, unclipped |
|---|---|---|
| spain-2013 | fail, duel 3.28 / 3.23 | pass 1.36 s, duel 2.31 / 2.26 |
| china-2011 | borderline | **fail** 2.61 s: duel 4.88 / 4.62, duel order 0.49 / 0.50, podium order 0.39 / 0.40 |
| abu-dhabi-2012 | fail, duel 3.40 / 3.22 | fail 1.50 s, duel 3.08 / 2.95, duel order 0.59 / 0.60 |
| brazil-2021 | fail, duel 3.34 / 3.59 | fail 2.12 s, duel 4.13 / 4.40 |

It fixes spain-2013 and breaks china-2011 (an authored race) and worsens brazil-2021, so it is
a trade, not a fix, and choosing a value between would be tuning to these results. pace.py also
records why the offsets use every green lap (clear-air-only offsets broke austria-2002 and
malaysia-2013). Gaps 1 and 3 in the races report remain the work for these four races.

## Facts considered (none entered)

| Race | Fact | Source | Why not entered | Owner checked |
|---|---|---|---|---|
| china-2011 | BUT stopped at Red Bull's box on lap 15; VET waited behind him | WP-CHN11 | Already in the measured stop losses (BUT 27.9 s, VET 26.0 s; HAM's lap-16 stop 25.2 s) | |
| abu-dhabi-2012 | Webber ordered not to battle Vettel (lap 30) | WP-ABU12 | No effect on the failing duel (VET vs BUT after the lap-39 SC) | |
| abu-dhabi-2012 | Maldonado without KERS after the first SC | WP-ABU12 | No pace number in the source; MAL's field check passes | |
| abu-dhabi-2012 | Kobayashi's downshift problem late in the race | WP-ABU12 | No lap or pace number in the source; KOB's field check passes | |

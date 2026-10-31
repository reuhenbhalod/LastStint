# Beta Spec: Abu Dhabi 2021, end to end

Oct 31, 2026 · Model, simulation and backend only. The frontend is Reuhen's (Phase 3).

## Goal

A tester opens Reuhen's site, plays Abu Dhabi 2021 as Mercedes, and submits the run. The live Worker replays it, grades all four calls, stores the run, and returns a score, rank and percentile, every beta day.

## Where things stand

| Piece | State |
|---|---|
| Model + sim (PR #5) | **Merged.** VSC stop fix, real-like seed 1205 (11.9 s gap at lap 53, as in the real race), no free pit stop on any path, Reuhen's four moments in the race file. |
| Cloudflare | **Live** (Reuhen): account `boxboxbox`, D1 `pitwall-db`, and CI deploys `main` after every check passes. The live Worker is still the Phase 0 placeholder (`/api/health` only). |
| Backend (PR #4) | Built and tested in October; not merged. `main` now merges into it cleanly. Two test files still expect the old single moment (`sc-53`). |
| Server check of a run | Full grading takes about 100 ms with four moments; the free plan allows 10 ms of CPU per request. Owner decision: stay on the free plan (B6). |
| Wrangler | Logged in on this Mac. It sees Reuhen's account (`20a2…9f17`), where `pitwall-db` has migration 0001 applied and its tables are empty. |

## Stages

| # | Stage | Done when |
|---|---|---|
| 1 | **Update the backend branch.** Merge `main`. Update the verify and API tests to the four moments. The schedule script uses the race file's seed instead of a random one (decision B1). Pin Reuhen's account in `wrangler.jsonc`. Regenerate the races bundle and hashes. | Every test passes locally and in CI on PR #4 |
| 1b | **Free-plan scoring (B6).** `POST /api/runs` also takes the game's grades: each moment's option chances, plus the real call's chance when the real team took none of the options. The server replays the race, checks the call log and that the grades are whole multiples of 1/300, rebuilds each grade with `gradeFromHits`, then scores and ranks the run, with no simulation playouts (target under 5 ms). Migration 0003 adds `verified` and `corrected`. A nightly GitHub Action (free) re-grades every unverified run with the full 300 samples. A run that matches is marked verified; one that doesn't gets its true score and is marked corrected. `docs/api.md` documents the new field for Reuhen. | Tests: an honest run is scored identically by the light check and by full grading; edited grades are caught by the nightly check; CPU time is under 10 ms |
| 2 | **Guard the moments.** A CI test fails if the UI race script (`data/scripts/<race>.json`) and the race file's moments ever disagree on ids, laps or options (B2). | The test fails on a deliberately edited copy and passes on the real files |
| 3 | **Final model/sim checks for Abu Dhabi.** Play every combination of the four calls (2×2×3×2 = 24 runs) through the server's check. None may be rejected, give a free stop, or score oddly. Re-run the what-if and G1 to confirm nothing moved. Decide lap 49 (B3). | A table of all 24 combinations with their scores, reviewed |
| 4 | **Merge PR #4 → live backend.** CI applies D1 migration 0002 and deploys the real Worker. | `GET /api/health` → ok, and `GET /api/races/abu-dhabi-2021` serves the model |
| 5 | **Schedule the beta days** on the live D1 (B4), from your machine via `wrangler` (needs your login, see "What I need from you"). | `GET /api/daily?date=<beta day>` returns Abu Dhabi, seed 1205, puzzle #1… |
| 6 | **Live smoke test.** A scripted full run against the live Worker: a verified score comes back; the leaderboard and stats show it; a second submit is refused (409); a tampered call log is refused (400); the CPU time in the Cloudflare logs is well under the limit. | All pass; results noted in this spec |
| 7 | **Hand-off to Reuhen.** The API URL (`https://pitwall.boxboxbox.workers.dev`), the call order (`docs/api.md`), and `WEB_ORIGIN` set to his site's address once it exists, so browsers may call the API (B5). | His site, on its real address, completes a run against the live Worker |

## Progress

| Stage | State |
|---|---|
| 1 | **Done.** `main` merged in; the verify and API tests now use the four moments (a one-moment copy for the rule tests, plus a full four-moment run); the schedule script uses the race file's seed (dry run: #1–#3, seed 1205); `account_id` pinned. The races bundle imports the race files directly, so it needs no regeneration. 167 sim + 19 Worker tests pass. |
| 1b | **Done.** `verifyRun(…, claimed)` checks and uses the game's grades (`claimGrade()` builds them; 0.07 ms against 99 ms for full grading, same score). `POST /api/runs` requires `grades` (`400 bad-grades` otherwise). Migration 0003 adds `grades`, `verified` and `corrected`. `scripts/reverify.ts` + `.github/workflows/reverify.yml` (10:30 UTC nightly, or run by hand) re-grade unverified runs. Tested: an honest run matches full grading exactly; a run with edited grades is accepted live, then corrected to its true score and bands. `docs/api.md` and `docs/sim-api.md` updated. 171 sim + 20 Worker tests pass. |
| 2 | **Done.** `packages/sim/tests/scripts-sync.test.ts` checks that every `data/scripts/*.json` matches its race file (moment ids, laps, targets, option ids and calls). It fails on a renamed moment, a moved lap or a dropped option. |

## Decisions (recommended first)

**B1. Daily seed**
- **a. Every Abu Dhabi day uses the race file's seed (1205).** ← recommended. That's the seed chosen so lap 53 is the real dilemma. A random seed per day can bring back a free pit stop.
- b. A random seed per day (as built in October).

**B2. Keeping the UI script and the race file in sync**
- **a. A CI test that compares them.** ← recommended. It catches a renamed moment before it breaks every submission.
- b. Remember to update both by hand.

**B3. Lap 49 (push or manage)**
- **a. Keep it for the beta.** ← recommended. Both options grade green, because the sim grades without knowing the safety car is coming, so it is a free question. Testers' feedback can decide whether it stays.
- b. Replace it with a call that has a real right answer. Reuhen rewrites that moment, and I test the alternatives.

**B4. How the beta days are scheduled**
- **a. Abu Dhabi on 7 consecutive days from the start date.** ← recommended. One run per player per day, so each tester can play once a day for a week. The puzzle numbers run #1–#7.
- b. One day only.
- c. A different length; tell me the dates.

**B6. Scoring on the free plan (decided Oct 31, 2026)**
- **Instant + nightly check.** The game sends its grades. The server checks everything cheap live and scores at once. A free nightly GitHub job re-grades every run exactly and corrects any edited score. A faked score can stand for up to a day.

**B5. Who can call the API**
- **a. Reuhen's site address plus localhost (for development).** ← recommended. Any other website's browser calls are refused.
- b. Open to any website for the beta.

## What I need from you

1. **The beta start date** (B4).
2. **From Reuhen, at stage 1b:** his game must send its grades with each run (`docs/api.md` will show the exact shape).
3. **From Reuhen, at stage 7:** his site's address.

## Out of scope

- The frontend (Reuhen).
- Races other than Abu Dhabi 2021.
- Accounts, Survivor mode, and email alerts.

# BoxThisLap: where things stand

Oct 31, 2026 (updated Nov 1 for the beta feedback round, `feedback-round-1-spec.md`). A summary of what is built, the decisions that shaped it, and what to improve. The specs in this folder have the details.

## What's live

| Piece | Where | State |
|---|---|---|
| Website | https://pitwall-web.boxboxbox.workers.dev | Online. Playable Abu Dhabi 2021 daily (`workers_dev` in `apps/web/wrangler.jsonc` takes it offline). |
| API | https://pitwall.boxboxbox.workers.dev | Daily, run submission, rank, leaderboard, stats, nightly re-grade, Google sign-in, streaks |
| Database | Cloudflare D1 `pitwall-db` (Reuhen's account) | Migrations 0001–0004 (0004: accounts) |
| Deploys | GitHub Actions (`ci.yml`) | Every merge to `main`: Python, JS/TS, parity and browser playthrough → API deploy → website deploy |
| Nightly check | GitHub Actions (`reverify.yml`, 10:30 UTC) | Re-grades every new run with full playouts and corrects any edited score |

Cloudflare dashboards (account `20a233209db4b2680328a2c547039f17`): the Workers `pitwall` (API) and `pitwall-web` (site), and the D1 database `pitwall-db`.

## The race screen

Modelled on Two-Minute Drill's play view (Oct 31, 2026):
- **Layout:** standings on the left; the scoreboard and the circuit in the middle; the call column on the right.
- **Track map:** the real circuit outline (`data/tracks/<race>.json`, written by `pipeline outline <race>` from FastF1 position data), with a dot per car.
  - Each dot is placed by the car's gap to the leader, so lapped cars appear among the leaders.
  - The field moves round the lap between ticks.
- **Decision card:** the radio line, four stat tiles (gap, both tyres, pit stop cost, laps left), then **Stay out / Box**, with Box followed by the tyre choice.
  - Only the presentation changed. The graded options are the same, so the server is unaffected.
- **On a phone** the screen stacks, and the decision card rises as a compact bottom sheet.

Beta feedback round 1 (Nov 1, 2026) added:
- **You're the team manager.** The intro, header and results say "Mercedes team manager"; the result compares with the real team's finish ("You beat Mercedes!" / "You matched Mercedes" / "Mercedes did better").
- **Slower race:** 10 s a lap at 1×, 5 s at 2×, and no dead wait after a decision (the lap clock and the map share one timer).
- **Decision alert:** a radio banner over the map (a compact strip on a phone), the map dims and its frame flashes, the card glows, and an optional radio chirp (🔇/🔊).
- **Map:** cars glide to their new gaps each lap; tyre-coloured rings; a safety car leads the field; the real pit lane (from FastF1, `pipeline outline`) with stopping cars driving it and a pit card (tyres, stop time, places lost).
- **Driver card:** tap any car on the map or in the standings: name, number, team, place, gaps, tyres, last lap, stops, real finish, and your driver's modes.
- **More options:** lap 36 stay / mediums / hards; lap 49 push / standard / manage; lap 53 stay / softs / mediums / hards (108 paths, 0 live/full mismatches).
- **Drivers can refuse live calls** (about 1 in 8, more with a reason, such as boxing on new tyres). A refused call is never applied or logged; the four graded moments are always followed. Booked calls show at once.
- **Crew chief (Nov 2, `crew-chief-spec.md`):**
  - Six graded moments (laps 36, 44, 49, 53, 55, 57).
  - Timed quick calls between them.
  - Every decision option explains itself; tyres show pace, drop-off and gain (`tyres-and-track-spec.md`).
  - At the flag the field runs to the line and the race ends when your car crosses it.

Beta feedback round 2, part A (Nov 2, 2026, `feedback-round-2-spec.md`):
- **Layout:** your driver's profile and the standings on the left; the map with BOX, speed, sound and restart under it; the call column, car stats (tyre life to the drop-off, last laps against the rival, pace trend, gap) and the radio on the right. The headset and the gap trace open from buttons on the map (under the map on a phone). The map legend names the cars (HAM, VER).
- **Pit stops on the map:** a stopping car drives the lap to pit entry, runs the lane, stops at its garage and rejoins at pit exit at its new gap (`pitPosition` in `track/geometry.ts`).
- **No double stop call:** a stop moment within 3 laps of a stop isn't asked; the wall stays out by itself, says so on the radio, and the results mark it "Auto" (`game/autoStay.ts`).
- **Driver attitudes:** one fixed personality per driver (`data/drivers.ts`): always listens, listens with questions (HAM: "are you sure?", and you confirm or drop it), or sometimes listens.
- **How to play:** a five-step walkthrough on the first visit; "How to play" on the daily card reopens it.
- **Google button:** no white box round it on the dark page.
- **Server fix:** a BOX press or headset flip in the lap right after answering a big call no longer gets the whole run rejected (`verifyRun` checks the option's calls where they're logged, straight after the answer).

Beta feedback round 2, part B (Nov 2, 2026):
- **Race plan** (lap 35, the first call): run to plan, manage to the flag, push now, or box now (mediums or hards). Seven graded moments.
- **Timing options:** "Box next lap" at the lap-36 VSC, the lap-44 cliff and the lap-53 SC; "Push and attack" at lap 49. The decision card has a Box button per timing.
- **Headset:** ERS (harvest / balanced / deploy / overtake, with a battery) and fuel (normal / lift and coast) join pace and battle.
- **Incidents:** crashes, failures and punctures across the field in live play; a crash can bring out a SC or VSC, and the radio asks whether to box under it. Race control and your driver call them on the radio. If your car is out, the race runs to the flag with nothing left to call.
- **Layout, take 2 (Nov 2):** standings on the left; the map in the middle with every call under it (the big decision as a wide strip with its options side by side, HAM's questions, quick calls) and BOX and the controls below; the stats (HAM's profile, the car, the radio) steady on the right. One typeface throughout: Archivo.
- **Google sign-in + streaks:** the streak shows on the intro and results. Signing in links the browser to an account so the streak and one-run-a-day follow you.
  - Google OAuth client `318278030629-…` (project "Pit Wall"), set as `GOOGLE_CLIENT_ID` in `apps/worker/wrangler.jsonc` and `VITE_GOOGLE_CLIENT_ID` in CI and `dev:live`. The consent screen is in Testing: only listed test users can sign in until it is published.

## How a game works, end to end

1. The site asks the API for today's daily (`/api/daily?date=<player's local date>`) and downloads that race's model file.
2. The race runs in the browser on the shared sim (`packages/sim`): laps tick, BOX and the headset are always live, and the game pauses at the race's four approved moments.
3. At each pause a Web Worker grades every option (~300 simulated playouts each) while the player reads.
4. At the flag the game sends its calls and its grades (`POST /api/runs`). The server replays the race, checks the call log and the grades' shape, then scores and ranks the run. That takes about 1 ms of our code, which fits Cloudflare's free plan.
5. That night `reverify.yml` re-grades the run in full. Grading is deterministic, so an honest run always matches, and an edited one gets its true score.

With no daily scheduled, or no connection, the site plays the bundled copy of the same race as a practice run that isn't submitted.

## Key decisions

| Decision | Why |
|---|---|
| **Free Cloudflare plan; the server scores from the game's grades, plus a nightly full re-grade** | Full grading takes ~100 ms against the free plan's 10 ms limit. The live check costs ~1 ms, and cheats are corrected overnight. |
| **Abu Dhabi seed 64** | Reaches the lap-53 safety car with the real 11.9 s gap (an SC stop costs ~12.4 s), so boxing isn't free. Its last-lap luck follows the odds: covering at lap 36 then staying out wins, and Mercedes' real calls lose. Seed 1205 made the best play always lose. |
| **Four moments:** lap 36 VSC cover, lap 49 push/manage, lap 53 SC stop, lap 57 restart stance (Defend/Hold/Attack) | Reuhen's moments. The race file (`data/moments/`) is the one list the UI and server share. |
| **Radio prompts built from live race facts** (`apps/web/src/game/brief.ts`) | Fixed copy was wrong on some paths (for example "Max on fresh softs" after the player boxed). |
| **VSC stop cost read once racing resumes** (model v3 stage 10) | VER's lap-36 VSC stop was overcharged by ~4 s, which inflated the lap-53 gap and erased the dilemma. |
| **The rival goes long only if its tyres reach the flag; no push gain on tyres past the cliff** | Both handed out unrealistic free pit stops. |

## Testing

- **Unit tests:** 171 sim, 27 web, 20 API and 111 Python. One proves that a game played through the UI's session produces a submission the server scores exactly as full grading does.
- **Browser playthrough** (`apps/web/e2e/daily.spec.ts`): start → four calls → results → share on a phone-sized screen. It runs in CI before every deploy, with the API mocked.
- **Seed check** (`pnpm --filter @boxthislap/sim combos abu-dhabi-2021`): all 36 answer combinations, with 0 live/full grading mismatches.
- **Live test, Oct 31, on a throwaway day since wiped:**
  - A real browser played the live site against the real server (score 100, rank 1/1, leaderboard and stats).
  - A second submit was refused, a tampered log was refused, and a cheated run was corrected by the nightly job.

## Running it locally

- **The website against the live API:** `pnpm --filter @boxthislap/web dev:live`, then open http://localhost:5173. The API allows `localhost:5173`.
- **Everything local:**
  - Run `pnpm --filter @boxthislap/worker dev` (API on :8787, local database) next to `pnpm --filter @boxthislap/web dev`.
  - Seed the local calendar with `pnpm --filter @boxthislap/worker schedule --local --days 2 --race abu-dhabi-2021`.
- **"Practice · not saved"** (yellow badge) means there's no live daily: none is scheduled for that date, or the API can't be reached. The run is played locally and not submitted. This is what testers see until beta days are scheduled.

## Before the beta starts

1. **Schedule the beta days:** `pnpm --filter @boxthislap/worker schedule --remote --from <YYYY-MM-DD> --days 7 --race abu-dhabi-2021`. The site switches from practice to the live daily automatically.
2. **Tell testers it's one run per day** (per browser).
3. **Reuhen pulls `main`** before more UI work: the frontend was finished on top of his stage 3.3.

## Things to improve

### Risks to watch during the beta
- **Free-plan CPU.**
  - Submissions measured 7–13 ms (21 ms once, cold) against a 10 ms limit. Cloudflare served them all, but doesn't promise to.
  - The game retries once. If testers see failed submissions, Workers Paid ($5/month) fixes it with no code change.
  - Watch the `pitwall` Worker's logs for CPU-limit errors.
- **One run per browser unless signed in.** A signed-out player with a private window or a cleared browser gets a new ID and can submit again. Signed-in players get one run a day across devices.
- **The player ID is the only key.** Accounts have no session token: anyone who learned a player's ID could submit as them. Fine for a beta; add a signed session before launch.
- **The race can be scouted.** The sim runs in the browser, so a player could replay the daily in practice or devtools before submitting. Inherent to client-side play.
- **Faked scores stand for up to a day** before the nightly job corrects them. Run `reverify.yml` by hand if needed.

### Game and content
- **Lap 49 is close to a tie on the real path** (push and standard both green), so it's an easy green. Consider replacing it with a call that has a real right answer.
- **Out of scope for now (beta feedback):** survivor mode and races where you must defend need more races.
- **Only one race is playable.** Each new race needs approved moments, a seed chosen like Abu Dhabi's (`combos` script), and a G1 pass. The 21-race queue (plan 6.7) is Phase 5.
- **The radio prompts are functional, not flavourful.** The authored prose layer (intro and per-moment lines) was deferred to Phase 5.
- **BOX can't be cancelled** once a compound is picked (spec FR4 says "cancellable until pit entry"); the sim has no un-call.
- **Missing from the plan:**
  - the strategist persona (plan 6.2; no line shown yet)
  - the Mystery Race reveal
  - the image share card
  - haptics
  - a privacy page (plan 6.5)
- **No analytics or error reporting yet** (plan 6.4: the funnel events and Sentry).
- **Accessibility:** keyboard play, labels and focus are done, but no Lighthouse audit has been run.

### Model limits (documented in `model-v3-spec.md`)
- **Validation (G1):** the held-out races pass 6 of 15 (mean gap error 2.26 s), and the tuning races 8 of 16. The remaining error is mostly within-driver pace and passing realism.
- **Famous-call check:** 8 of 11 agree. Hungary 19 (HAM's second stop) and Miami 22 (the SC stop) disagree, and France 21 is a tie.
- **Not modelled:**
  - lapped cars unlapping behind a safety car (race control's call)
  - tyre fade under pressure, and drivers easing off at the end (driver choice)

### Engineering
- **The browser test mocks the API from the game's claimed grades,** because Playwright hangs importing the sim's TypeScript source. The real verification is covered by unit tests. A built JS bundle of the sim would let the E2E test verify for real.
- **No D1 backups or retention policy** for runs.
- **The daily queue check** logs a warning each morning when nothing is scheduled. `ALERT_WEBHOOK` (Discord or Slack) isn't set.
- **Node 20 deprecation warnings in GitHub Actions:** bump the actions' versions when they publish Node 24 builds.
- **`docs/phase-3-ui-spec.md` is partly superseded** by `frontend-finish-spec.md`: moments come from the race file, not the finder.

## Where to look

| Topic | Doc |
|---|---|
| Product and plan | `F1 Pit Wall Daily Product.md`, `F1 Pit Wall Implementation Plan.md` |
| Model work and validation | `model-v3-spec.md`, `g1-report.md` |
| Sim API (for the UI) | `sim-api.md` |
| Backend API | `api.md`, `phase-4-backend-spec.md` |
| Abu Dhabi beta plan | `beta-abu-dhabi-spec.md` |
| Frontend | `phase-3-ui-spec.md` (Reuhen), `frontend-finish-spec.md` |

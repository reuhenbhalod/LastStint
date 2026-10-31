# Spec: Finish the frontend and wire it to the backend

Oct 31, 2026 · Builds on `docs/phase-3-ui-spec.md` (Reuhen's; stages 3.1–3.2 done) and the backend (`docs/api.md`, live at `https://pitwall.boxboxbox.workers.dev`). Branch: `frontend`.

## Goal

A tester opens the site on a phone, plays today's Abu Dhabi 2021 daily as Mercedes, and makes the four calls. They see the result, each call's grade and the real team's call, the server's score, rank and percentile, and a share line. The race comes from the live Worker, using the real race model and sim. The run is submitted and verified as `docs/api.md` describes.

## Where things stand

| Piece | State |
|---|---|
| Data, engine, state machine (3.1–3.2) | Done and headless, with tests: `GameEngine`, the reducer, `GameSession`, and localStorage resume |
| Screens (3.3–3.6) | Not started; `App.tsx` is the Phase 0 placeholder |
| Backend wiring | Not started: `StaticDailyProvider` only, a fixed date, and no submission |
| Moments | The UI uses `candidateMoments` (the finder's); the Worker grades `model.decisionMoments` (the four approved). **Must switch.** |

## Stages

| # | Stage | Done when |
|---|---|---|
| F1 | **Engine fixes for the backend.** Use `model.decisionMoments`. Grade each moment at the pause in a Web Worker (`gradeJob`/`runGradeJob`), and keep `claimGrade()` (before the answer) plus the grade. Answer with `answerMoment()`, so the radio call is logged. Persist grades for resume. | Tests: a headless session's `decisions` + `grades` pass `verifyRun(…, claimed)` and equal full grading |
| F2 | **API provider + player ID.** `ApiDailyProvider` uses `GET /api/daily?date=<local date>` and then `modelUrl`, with `StaticDailyProvider` as the dev/offline fallback. `anonId` (UUID) is kept in localStorage. `GET /api/runs/:date/:anonId` shows "already played" and goes straight to results. | Tests with a mocked fetch; live check against the Worker |
| F3 | **Race screen.** Timing tower (position, code, gap, tyre letter + age; user and rival highlighted), gap-to-rival trace (SVG), lap clock, flag banner (SC/VSC), 1×/2× speed, BOX button with a compound picker (cancellable for the current lap), and headset panel (pace and battle; fuel for this era). | Plays at 1× and the tower reorders with `state.order`; BOX and mode calls land in the run log |
| F4 | **Decision screen.** Pauses at each moment and shows a radio-style prompt (see C1), short context (gap to rival, both tyres and ages, pit loss for the flag), and the options. Choosing resumes. Grading runs off-thread while the player reads. | The four Abu Dhabi moments appear at laps 36, 49, 53 and 57 with correct context |
| F5 | **Submit + results.** `POST /api/runs` with calls + grades, retried once. Results show the classification, a grade chip per call (tap for the chance and points behind the best), the real team's call and grade, the server's score, rank and percentile, the leaderboard (top 10) and stats ("41% boxed at lap 53"), and a share line (`Pit Wall #1 🟩🟨🟩🟥 P63`, copied to the clipboard). If the API is unreachable, the game's own grades show with a "not submitted, tap to retry" note. | A full run against the live Worker shows the server's score, equal to the game's |
| F6 | **Daily card, How it works, polish.** Race card (title, side, laps left, situation line, Start), How it works (rules, grading, data sources, "not affiliated" disclaimer), loading/error/retry states, 390 px layout, keyboard play, visible focus, labelled controls. | Full flow at 390 px; keyboard-only playthrough |
| F7 | **Deploy (C3).** Cloudflare Pages project `pitwall-web`; CI builds `apps/web` with `VITE_API_BASE` and deploys on `main`; the Worker's `WEB_ORIGIN` is set to the Pages URL. | The Pages URL plays a full run against the live Worker; other origins are refused |

## Decisions (recommended first)

**C1. Moment wording** (the race script that carried Reuhen's prose was retired)
- **a. Prompts written per moment id, with the facts filled in from the live race.** ← recommended. For example: "Safety car. Max is {gap}s behind on {tyres}. Box, or keep track position?" The gap, tyres and who leads come from the run. Wording that only fits one path (lap 49 "a second a lap", lap 57 "Max on fresh softs") can't be wrong, because it's computed.
- b. The sim's short option labels only, with no prose.

**C2. Lap 57 when Hamilton is behind**
- **a. Add an "Attack" option to `restart-stance` (`battle: attack`).** ← recommended. On the path where HAM boxed at lap 53 he's chasing, and Defend/Hold don't fit. The race file's moment gains a third option; the prompt text follows who leads (C1).
- b. Leave Defend/Hold.

**C3. Deploying the site**
- **a. Cloudflare Pages in Reuhen's account, deployed by CI from `main`, with `WEB_ORIGIN` set to the Pages URL.** ← recommended. It's free. Public once deployed, at an unlisted `*.pages.dev` address.
- b. Local only for now (`pnpm dev` + the live Worker).

**C4. End-to-end test**
- **a. One Playwright playthrough (start → four calls → results → share), run locally and in CI.** ← recommended. The plan's testing table asks for it. It needs a Chromium download in CI (about 1 minute).
- b. Unit and component tests only, plus a manual browser check.

**Fixed (no choice needed):** the target is `beat-rival`; the Mystery Race reveal is deferred (Abu Dhabi is an iconic race); the persona shows a placeholder line; track map, sound and image share cards are Phase 6.

**Decided Oct 31, 2026: the recommended option for C1–C4.** C3 changed in practice: Cloudflare has folded Pages into Workers, so the site deploys as a static-assets Worker, `pitwall-web` (`https://pitwall-web.boxboxbox.workers.dev`). CI's existing Workers token can deploy it.

## Progress

| Stage | State |
|---|---|
| F1 | **Done.** `decisionMoments` = the approved moments. `engine.answer()` uses `answerMoment`. `engine/grading.ts` + `grader.worker.ts`: each moment is graded in a Web Worker at its pause, with the real call as an extra option when needed, giving the grade + claim. Grades are persisted, and any missing are re-graded on resume. Test: a headless session's submission passes `verifyRun(…, claimed)` and equals full grading. |
| F2 | **Done.** `ApiDailyProvider` (local date → `/api/daily` → `modelUrl`) falls back to practice mode (the bundled race, not submitted) on `no-daily` or no connection. `anonId` in localStorage. The "already played today" check goes straight to results. |
| F3 | **Done** (Reuhen's 3.3 race screen) + `GapTrace`. The restart button is hidden on a live daily (one run per day). |
| F4 | **Done.** `DecisionModal` (a real `<dialog>`, focus on the first option) with `game/brief.ts`: the radio line and facts (gap and who leads, both tyres, the stop's cost under the flag, laps left) are computed from the run, so they're right on every path. **C2:** `restart-stance` gained `attack` (36 combinations, 0 live/full mismatches; Attack grades green when HAM chases, Defend when he leads). |
| F5 | **Done.** Submit = calls + claims, retried once on a network/5xx error; `already-submitted` shows that run. Results: score, rank, percentile; a grade chip per call (tap for chance, points behind the best, best call, real team's call); share line + copy; today's stats; top-10 leaderboard; classification. Practice and failed-submit states, with retry. |
| F6 | **Done.** Daily card (puzzle number, situation line, practice banner), How it works (rules, grading bands, data, disclaimer), loading/error/retry, 390 px layout, labelled controls, focus. |
| F7 | `apps/web/wrangler.jsonc` (static assets, SPA fallback). CI: an `e2e` job (Playwright, before any deploy) and `deploy-web` (built with `VITE_API_BASE`, after the API deploy). The API's `WEB_ORIGIN` = the site. |
| C4 | `apps/web/e2e/daily.spec.ts`: a 390 px phone playthrough (start → four calls → results → share), passing locally in 33 s. The API is mocked from the game's claimed grades; real verification is unit-tested. |

## Coordination

Reuhen is building this same frontend right now. This work goes on branch `frontend`, starting from `main` (which has his 3.1–3.2), and keeps his structure (`data/`, `engine/`, `state/`, the reducer). He should know before he writes 3.3 so the two don't collide.

## Track view (Oct 31, 2026, owner request)

The race screen was rebuilt after the track-view mockup (inspired by Two-Minute Drill), keeping the dark default palette (plan 3.5).
- **Circuit outline:** `pipeline outline <race>` writes `data/tracks/<race>.json`. Yas Marina's comes from HAM's fastest 2021 lap: 132 points and 16 corners, rotated by the circuit's official map rotation.
- **`track/geometry.ts`:** places each car `gap / lapTime` of a lap behind the leader, with the lap time by flag, so SC and VSC gaps stretch. Tested.
- **`TrackMap`:** draws the field, rival and player dots (lapped cars dashed). They animate round the lap between ticks and stop at a pause.
- **`DecisionPanel`** replaces the modal: the radio line, four stat tiles, and Stay out / Box. Box goes to the tyre choice (`game/choices.ts`, tested), and a single tyre commits directly. Number keys work, and Escape backs out of the tyre step.
- **Layout:** three columns at 1280 px and up; two at 768 px, with the standings below; one column on phones, with the decision card as a bottom sheet.
- **E2E:** now presses Box → Softs at lap 53, and Attack at lap 57.


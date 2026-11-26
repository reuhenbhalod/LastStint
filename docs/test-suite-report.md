# Test suite: report

Spec: `docs/test-suite-spec.md`. The full control list is generated into
`docs/test-suite-coverage.md` (`E2E_COVERAGE=1 pnpm --filter @laststint/web e2e`, then
`pnpm --filter @laststint/web coverage:report`).

## Result (Nov 25)

All on branch `test-suite` (local, not pushed), merged from the six agent branches, reviewed,
fixed and re-run:

| Suite | Result |
|---|---|
| Unit and component (`pnpm test`) | sim 2386, worker 331 (72 contract tests over all 54 routes), web 1289 + 1 skipped |
| Browser screens (`e2e`, phone + desktop) | 599 passed, 24 skipped (16 Linux-only screenshots, 8 existing skips), 28 min on the Mac |
| Flows against wrangler dev + local D1 (`e2e:flows`) | 12 passed, 9.5 min |
| Screenshots (Linux, Playwright noble image) | 16 passed on three runs |
| Coverage guard (`coverage:guard`) | 0 not covered: 831 of 1218 controls pressed, 172 through the race screen on another route, 215 excused (`e2e/coverage-exceptions.json`) |
| Break-it checks (S7) | 78 across all stages, 77 caught; the 1 miss fixed with a new test |
| Typecheck, biome | clean |

CI (`.github/workflows/ci.yml`, GitHub-hosted): the e2e job records coverage and fails on the
guard, uploads `control-coverage`, and a new `flows` job runs before deploy.

**Bugs fixed here, each with a test:** the admin race picker's message named the previous race;
the phone account button had no accessible name; Turkey 2021's team radio labelled both its dry
tyres (softs and hards) "Dry" (`raceRules.ts`: the single-dry look is now kept for races where
the player can fit only one dry tyre: one dry compound on offer, or no tyre changes in 2005;
Turkey 2021 is the only race this changes). (`scripts/schedule.ts` misreading the G1
report was fixed on main by #58.)

**For the owner (not changed):**
- On phone, the tutorial coach card covers the button it points at.
- A failed sign-in shows no message on the Daily card.
- Gauntlet rounds and the Daily share one per-IP rate limit.
- The tutorial's result shows Play again (it is not a live Daily). From the code, pressing it
  resets the race but leaves the "How you did" coach step open over the intro. Hide it in the
  tutorial, or reset the coach too? Excused in the guard until decided.

**Watch in CI:** controls that show only for a moment or on some race paths (a disabled
"Grading your calls…", a battle answer one path offers) can be recorded in one run and not the
next. Two showed up across three full runs and are now pressed or excused. The first full CI
run (Nov 26, 619 passed, screenshots included) flagged six more that only the slower runner
reached: three are now pressed (the Legend board's Try again, a history book leaderboard link
and the account button named by its email), and the "Loading…",
"Saving…" and tutorial "Play again" labels are excused with reasons. If the guard flags one in
CI, press it in a spec or excuse it with a reason; don't loosen the guard.

## S1: where we start (Nov 24)

### Browser tests

The recorder is `apps/web/e2e/coverage.ts`, which every spec now imports. With it on, the
existing 67 tests press **144 of the 707 controls they bring on screen (20%)**, across 15
routes. A row of a long list (a timing tower, a leaderboard) counts as one control.

| Route | Pressed | Not pressed |
|---|---|---|
| `/eras/:n/:race` (an Eras race) | 60 | 244 |
| `/` (Daily: intro, race, result) | 19 | 100 |
| `/eras/:n/:race/legend` | 18 | 80 |
| `/gauntlet` | 10 | 63 |
| `/admin` (Today, announcement) | 4 | 15 |
| `/admin/schedule` | 6 | 16 |
| `/admin/eras` | 2 | 14 |
| `/eras/:n/:race/leaderboard` | 1 | 11 |
| `/eras`, `/eras/:n` | 4 | 20 |
| Admin players, runs, tickets, stats, versus | 20 | 0 |

**Never on screen in any test:** `/tutorial`, `/privacy`, `/terms`, `/credits`, the profile
sheet and the account menu signed in, and the Daily result's share. Their controls are missing
from the table above, so they count as untested. The source inventory at the end of the
coverage file lists where they live.

**Not pressed on the Daily, for example:**
- the plan cards B and C, "Build your own", "Change plan" and "Keep ours";
- "Box as planned", "Box next lap" on each tyre, and "One more lap";
- every battle and defence option;
- the headset modes (Manage, Push, Lift and coast);
- the radio replies ("No, stay out", "Not yet", track limits);
- the timing tower and leaders rows, the driver details, "Follow car", the sound toggle, and the
  Calls, Radio and Car tabs.

**Accessible names (D7):** every control seen has one. Some names run several labels together
(an option's title, detail and tag in one button, such as "Late-brake up the insideClassic
hairpin lungeRisky"). They're findable but read badly to a screen reader, so S3 gives them
proper names. The timing tower's list has no label.

**Fixed on the way:** `admin-tabs.spec.ts` broke with PR #54. It checked the announcement banner
on `/versus`, which a production build now sends home, where the first-visit intro covers the
banner. It now checks the banner on `/gauntlet`. The full suite passes: 67 passed, 2 skipped.

### Component tests

74 unit test files. None renders a component and presses it: the web package has no jsdom or
Testing Library (today's component tests render static HTML, like `TopBar.test.ts`). S2 adds the
harness.

### Worker

Every one of the 54 routes appears in a Worker test. S5 checks depth per route:
- auth: signed out, a player, an admin;
- bad input and limits;
- rate limits;
- the error responses.

### Rule cases to cover (screens involved)

From the game's calls and radio (`apps/web/src/game`, `state`, `engine`):

- **Calls:**
  - pit: box now, box next lap on each tyre, one more lap, box as planned;
  - stop owed, and the last legal lap;
  - modes: pace, ERS, fuel, lift and coast;
  - quick calls;
  - battle and defend, with a boost;
  - team orders;
  - blue flags and track limits;
  - fuel calls in refuelling Eras.
- **Engineer and driver:**
  - plans: offer, Switch (including a stop on the coming lap), Keep ours until the race
    changes, Build your own;
  - the driver's box request asking again only as the tyres get worse;
  - replies.
- **Race events:**
  - SC or VSC at or after the takeover, and its cause;
  - a red flag before the takeover;
  - rain arriving or going, and wet tyres;
  - faults (gear stuck, power loss, puncture, damage);
  - storyline retirements, avoided or repeated;
  - the rival retiring;
  - penalties at the flag on the result.
- **Session:**
  - timed decisions running out, and the untimed opt-out;
  - a reload mid-race;
  - a Daily already played;
  - streaks across days and time zones;
  - the share text.
- **Gauntlet:**
  - round to round, a lost round;
  - the Menu out of a race;
  - the start runs once.
- **Eras:**
  - unlock at 70%;
  - stars;
  - rewrite or no rewrite;
  - hidden objectives;
  - Legend, its leaderboards and the history book.
- **Admin:**
  - every tab and edit;
  - the announcement banner;
  - a non-admin refused.

## Next: S2-S5 as an agent chain

| Agent | Stage | Scope |
|---|---|---|
| A | S2 | jsdom and Testing Library harness; component tests for the shared controls (plans, radio, headset, battle and quick calls, towers, track map selection, banner, account, profile, intro, how to play, tutorial) |
| B | S3 | Daily race and result screens: every control, every state, phone and desktop; key screenshots |
| C | S3 | Gauntlet, intro and tutorial, legal and credits, account and profile |
| D | S3 | Eras: map, era, race, results, legend, leaderboards, history book |
| E | S3 | Admin: every tab and every control, and a non-admin refused |
| F | S4 + S5 | Flows against a local Worker and D1; Worker contract depth per route |

After them: review, verify (break each control and see its test fail), fix, then QA. S6 (the CI
guard on GitHub-hosted runners) comes after S3, once the matrix is near 100%.

## S2: component tests (agent A)

Branch `ts-a-components` (one commit, 6691fec, which holds all of S2). Agent A split the
components across four sub-agents, then reviewed their markup changes and ran the checks
itself: web suite 95 files, 1289 passed, 1 skipped (already skipped before); typecheck and
biome clean.

**Harness.**
- `apps/web/package.json` and the lockfile: devDependencies jsdom ^25, @testing-library/react
  ^16, user-event ^14, jest-dom ^6 and dom ^10.
- `apps/web/vite.config.ts`: the default environment stays `node`; `include` takes
  `src/**/*.test.ts` and `src/**/*.test.tsx`; `setupFiles: ['./src/test/setup.ts']`.
- `src/test/setup.ts` loads the jest-dom matchers, cleans up after each jsdom test, and points
  `localStorage` and `sessionStorage` back at jsdom's (Node 25's own global `localStorage` hides
  jsdom's and throws "clear is not a function").
- Each component test starts with `// @vitest-environment jsdom`; the existing `.ts` tests still
  run on node.
- Notes for later work: vitest 2.1 has no `toHaveBeenCalledExactlyOnceWith`; `userEvent` hangs
  under `vi.useFakeTimers()`, so timer tests use `fireEvent`; jsdom has no PointerEvent, so
  TrackMap is pressed with `user.pointer({ keys: '[MouseLeft]' })`; jsdom gives an inline
  `<svg>` no img role, so the map is found by `getByTitle`.

**Files: 21, 233 tests**, next to their components in `apps/web/src`, about 7 s on their own.
The full web run went from 45 s (74 files) to 66 s (95 files), mostly jsdom setup. Fixtures are
real race files read through `@data` (Abu Dhabi 2021, Bahrain 2021, Japan 2005, Canada 2022),
some on a real `GameSession` or `GameEngine`.

| File | What it presses and checks |
|---|---|
| `PlanEditor` | All 10 control kinds: add a stop (where, which tyre, which pace; disabled at 3 stops or no room), remove (drops the next stint's pace, renumbers), the earlier/later steps and the lap slider (clamped at laps 11 and 55, 3-lap minimum stint), tyres (only the fitted tyre with no tyre changes), pace per stint, the three fuel fills ("Pick a fuel fill", the engineer's exact fill), the rule and chance text |
| `PlanCard` | Plans A/B/C (the engineer's pick selected, keyboard, "…" while grading), Go with plan X, Build your own, back to the engineer's plans, Go with your plan (disabled until graded). The 350 ms grade pause on fake timers: graded once, last change wins, an illegal plan never graded, closing cancels it |
| `PlanBar` | Change/Cancel, Run this plan (a refused plan keeps the editor open; disabled while illegal), Box as planned, One more lap (disabled when the stop can't wait), Change plan, Switch, Keep ours; `headsUpStop` and `betterPlan` |
| `TeamRadio` | 22 controls: the bar, 3 tyres, 3 team orders (Hold up / Release toggle), 12 headset modes, 3 fuel fills. Our car or the team-mate retired, no team-mate, boxing; refuelling: tyres disabled until a fill is picked, the fill carried on the stop and reset after it; no ERS in 2005 |
| `HeadsetPanel` | 12 mode buttons, a mode booked for next lap, disabled, keyboard, the battery meter, no ERS row without a battery |
| `BattleCard` | 4 moves by tap and keys 1-4; keys on the approach; buttons and keys gone once a move is chosen; the result, stage text, meters, the closing and wait bars, the Eras timer; listener removed on unmount |
| `QuickCallCard` | 3 answers and 3 fills; the timeout at read+ms, once, cancelled on unmount, never in Eras; a box answer disabled until a fill is picked; pit-board look |
| `BroadcastDecision` | Top-level buttons on 5 moments, Box → tyre step → Back, a single-tyre Box next lap, number keys at both levels, Escape, focus on open and each step, the Eras timer |
| `DriverCard` | Close (click, Enter), Escape on window (other keys don't; stops on unmount), the stats for another car, your car, a retired car, Minimal |
| `TimingTower` | All 20 rows by click, Enter and Space; tints, OUT, "+2 LAPS", live order and PIT, Minimal |
| `LeadersTower` | The top 10 plus the rival and your car below the line; no row for other cars outside the top ten |
| `TrackMap` | Each car by left press, Enter or Space (right and middle presses, other keys ignored); `aria-pressed` follows the selection; a retired car isn't a button |
| `AnnouncementBanner` | Dismiss by click and keyboard (persists); info as status, warning as alert; empty, ended or failed fetch shows nothing |
| `AccountBar` | 11 controls: the full bar (Sign in, Google, name, Sign out, Admin) and the compact menu (Edit profile, Admin, Sign out), Escape and a click outside, "Signing in…", the error, no sign-in configured |
| `ProfileSheet` | The name input (3-20 characters, spaces don't count), 10 team buttons (a second tap clears), Save ("Saving…", the server's error, Enter), Later and Cancel |
| `Disclaimer` | No buttons; the 4 links' href, target and rel |
| `IntroCard` | Start or Resume, How to play, How it works (hidden in the Gauntlet), the tutorial link, Sign in; when the walkthrough opens on its own |
| `HowToPlay` | Next through 6 steps, Back (disabled on step 1), Got it, Skip, Escape |
| `HowItWorks` | Back by click and Enter |
| `Tutorial` | Start, every skip path (marks it done, goes to `/`), Got it, Finish; walks all 15 coach cards against stand-in race and result screens (the highlighted control, the holds, the fast-forward, the quick and battle hooks); loading and error |
| `RefuelControls` | 3 fills (one pressed at a time, each sends its own), disabled, the fuel gauge as a meter |

**Markup changes** (attribute-only; these are the "Names S2 set"):
1. BattleCard moves: `aria-label` is the label; note and risk tag are the description.
2. QuickCallCard answers: `aria-label` is the label; the note is the description.
3. PlanCard options: "B · One stop, 61%, engineer's pick"; the stops line is the description.
4. PlanEditor: "Stop N earlier/later", "Remove stop N", and `role="group"` spans named
   "Stop N tyre" and "Stint N pace". A sub-agent used `<fieldset>`; agent A switched it back to a
   span (a fieldset defaults to `min-inline-size: min-content`), with a biome-ignore for
   `useSemanticElements`.
5. TeamRadio's bar: "Team radio", described by its status summary.
6. TimingTower's `<ol>`: "Standings".
7. HowItWorks Back: "Back: close How it works" (the old name left out the visible word).

TeamRadio's tyre buttons still read "SSofts": fixing them would break `eras-play.spec.ts`
(`/^D\s*Dry/`). The markup moved three digests in `src/eras/difficulty/today.test.ts`
(`cards`, `components.towers`, `screen`); agent A checked that the rendered HTML was
byte-identical to HEAD's once the new attributes and ids were removed, and updated the digests.
The review later (387f1be) made the digests strip `aria-*` and `id` before hashing, so markup
drift is still caught.

**Mutation checks: 25, all caught** (each run on that component's file only, then restored):

| Component | Mutation | Tests failed |
|---|---|---|
| AnnouncementBanner | Dismiss no longer saves its id | 1 |
| PlanCard | Go always sends `'a'` | 3 |
| PlanCard | Grade pause 350 ms → 0 | 1 |
| PlanEditor | Remove drops the wrong stint's pace | 1 |
| PlanEditor | Stop clamp removed | 4 |
| PlanBar | Run this plan closes when the plan is refused | 1 |
| PlanBar | One more lap no longer disabled | 1 |
| HeadsetPanel | `onFlip` sends the old value | 9 |
| QuickCallCard | Timeout at `ms` instead of `read + ms` | 1 |
| TeamRadio | Fill not reset after a box call | 3 |
| BroadcastDecision | Escape handler removed | 2 |
| BattleCard | Guard that stops keys after a choice removed | 1 |
| TimingTower | `onPick` sends the wrong code | 1 |
| LeadersTower | `onPick` sends the rival | 2 |
| DriverCard | Escape → 'Esc' | 1 |
| DriverCard | Close `onClick` emptied | 1 |
| TrackMap | Space removed | 1 |
| TrackMap | Left-button guard removed | 1 |
| TrackMap | `aria-pressed` always false | 1 |
| AccountBar | Menu's Sign out doesn't call `signOut` | 1 |
| ProfileSheet | Second tap no longer clears the team | 1 |
| HowToPlay | Back doesn't go back | 1 |
| RefuelControls | Every fill sends `'standard'` | 2 |
| Tutorial | Skip doesn't mark it done | 4 |
| IntroCard | How to play does nothing | 1 |

**Bugs:** none found.

## S3: screen specs (agents B-E)

Each agent resumed its paused WIP commit (Nov 25), finished its scope, and reported. Specs are
in `apps/web/e2e/screens/`, run against the mocked API on phone and desktop. Coverage figures
are each agent's own `E2E_COVERAGE=1` run on its own specs before the merge; the merged figures
are in the Result table above. Every agent restored `docs/test-suite-coverage.md` rather than
commit it. After the merge, the review fix commit 387f1be tightened several of these specs (see
the end of this section).

### B: Daily (`/`)

Branch `ts-b-daily`: 0983405 and 3912f20 on the WIP commit.

**Specs:** `daily-intro`, `daily-race`, `daily-calls`, `daily-result`, helper `daily.ts`
(`runToOnClock(page, lap)` runs lap by lap to `lap`, then at 2× so the next battle shows). The
scratch `_explore` and `_probe` specs are deleted.

**Fixed on resume:** #58's numberless Daily ("Daily race · lap 51 of 66", "LastStint WIN …",
"Daily · <race>"). Australia 2022 now brings a battle on lap 37, so the specs use the lap-37
Albon battle (seen the same 4 of 4 runs); Abu Dhabi 2024 keeps its lap-52 defence and lap-55
attack, with Overtake boost added. Added: the "Plan · to the flag" pill, Box next lap on softs
(Abu Dhabi 2021 lap 53), every option of Abu Dhabi 2021's lap-49 pace call and lap-57 restart,
and the plan bar's stint pace.

**Coverage on `/`:** 142 of 222 controls pressed (S1: 19 of 119). Every control S1 listed as
unpressed on the Daily is pressed and its effect checked. The 80 left are other forms of pressed
controls or can't be pressed: the driver dots (pressed with `dispatchEvent('pointerdown')`
because they move, which the recorder doesn't count), the same control in another race or state
(brand button, plan cards while grading, tower rows by gap text, battle moves and replies from
other races), the fuel "Back to normal / Keep saving" call (desktop only, timing-dependent), the
disabled Plan pill, Versus (out of the release, D2) and the external OpenStreetMap links (href
checked).

**States:** intro (walkthrough forward, back, Escape, Skip, the tutorial link; How it works;
streak and none; every link; already played); the race plan and the editor with every control;
the planned stop (heads-up, change plan); a safety car's new plan (Keep ours, Switch); big calls
by click and number key, Box to the tyre step (Back, Escape); a quick call timing out; every
quick call and reply; the stop owed; every battle move, and one left to the driver; rain and wet
tyres, a VSC, the rival retiring; speed, sound and stats on desktop, tabs on phone; the brand
home and back; every headset mode, team orders, box for each tyre; driver details, tower and
leaders rows; a reload mid-race; the result (score, rank, calls, penalties, streak, leaderboard,
stats, share and share with the clipboard blocked, classification, Gauntlet link, home, a failed
submit and Retry).

**Markup:** none of its own. It copied S2's BattleCard, PlanCard, QuickCallCard, TeamRadio,
TimingTower, PlanEditor, HowItWorks and S2's digests byte for byte so the merge was trivial, and
reverted its own RaceScreen `aria-label`.

**Bugs:** none; no `test.fixme`. One flake before the battle fix (a click after the 8 s braking
zone under load), not seen again.

**Mutation checks: 7, all caught** (phone; each handler emptied). The report doesn't name the
test that caught each.
1. PlanCard pick
2. HeadsetPanel `onFlip`
3. QuickCallCard answer
4. BattleCard `onAnswer`
5. ResultScreen copy
6. TimingTower row `onPick`
7. RaceScreen Follow car

**Runtime:** about 6.7 min for the four specs on both projects at 2 workers (calls about 3.5-4
min per project); about 5.5 min more with `daily.spec.ts` and `defend.spec.ts`. Two runs: 207
passed, 2 skipped (with coverage and the two older specs, 12.3 min) and 204 passed, 2 skipped
(screens only). The skips are by project (phone tabs, race brand).

### C: Gauntlet, pages, account

Branch `ts-c-gauntlet-misc`: 7dc0e32, 2be9747 and b4f58e7 on the WIP commit.

**Specs:** `gauntlet` (helper `gauntlet.ts`, with the reusable `answerCall`), `pages`
(tutorial, legal pages, credits, How it works), `account`.

**Fixed or added on resume:** S2's "Team radio" and "Back: close How it works" names (replacing
its own "Team radio orders"); a How it works test from the Daily card; the "/versus goes home"
test removed (the e2e build has Versus on; the off case is unit-tested in `App.test.ts` and
`TopBar.test.ts`); `gauntlet.ts` fails if Spain 2020 isn't a Gauntlet race on one of its pool
seeds (#57); a tutorial test (Build your own and back, the Team radio pill, stats panels or tabs,
Restart on desktop); Abu Dhabi team orders (Hold up Verstappen, Release, "Bottas lets you by",
"Let Bottas by"); a phone retry that shuts the driver card first.

**Coverage:**

| Route | Pressed |
|---|---|
| `/gauntlet` | 149 of 178 |
| `/tutorial` | 28 of 105 |
| `/privacy` | 6 of 6 |
| `/terms` | 7 of 7 |
| `/credits` | 12 of 14 |
| `/` | 2 of 18 (How it works; the rest is B's) |

Not pressed on `/gauntlet`: battle and quick-call answers some runs don't offer; the same control
under another name (plan cards while grading, Go with plan C, the brand button with Spain's
engineer, the Plan pill); the plan editor's pace buttons, which the recorder lists twice (`push`
pressed, `Push` not, from a CSS capital); driver dots for cars only in Abu Dhabi; the disabled
"Dealing round #…"; Versus. On `/tutorial` the 77 unpressed are race-screen controls covered on
`/gauntlet`; on `/credits` the 2 are name variants of pressed links.

**States:** Gauntlet round to round (won round, the next race's brief), a lost round (the run's
end, rank, each race, a new run), out in round 1 with a disqualification, a verdict error and Try
again, the server's wrong-round answer, the Menu out of a race and back (keeps lap and phase,
starts no new run), the start running once (a throwing start shows a fallback with Start and
Menu), a race that won't load or loads slowly; the tutorial; the legal and credits pages; the
account menu and profile sheet.

**Markup** (attribute-only): AccountBar `aria-label="Account: <name>"` on the phone account
button (from the WIP; this is the "phone account button had no accessible name" fix in the
Result); S2's TeamRadio and HowItWorks names, identical to S2's.

**Bugs:** none fixed or fixme'd. Flagged for the owner: on phone the tutorial coach card covers
the dock button it points at.

**Mutation checks: 8, all caught:**

| Mutation | Caught by |
|---|---|
| Gauntlet leaderboard tab does nothing | the lobby test (All time never pressed) |
| Gauntlet Next race does nothing | the won-round test (no plan) |
| AccountBar ignores Escape | the account menu test |
| ProfileSheet minimum name 3 → 2 | the profile test (Save enabled) |
| HowItWorks Back does nothing | the How it works test |
| Tutorial doesn't save "done" | the skip test |
| Gauntlet "Back to round N" does nothing | the Menu-out-of-a-race test |
| TeamRadio hold-up never released | the team-orders test |

**Runtime:** 3.9 and 5.4 min for two runs in a row (2 workers, coverage on, the Mac shared): 89
passed, 1 skipped (desktop-only on phone). The last addition (Release) passed twice on its own.

### D: Eras

Branch `ts-d-eras`: dc4f5d4 (the rebased WIP), 55b89d0 and 77f0ba0.

**Specs:** `eras-map`, `eras-detail`, `eras-intro`, `eras-race`, `eras-results`, `eras-legend`,
`eras-leaderboard`, `eras-history`; `e2e/eras.ts` gains `shortRace`, `pressLink`, `siteLinks`
(presses Versus when built in) and mock options `lapScale`, `submitReply`, `evaluated`, `stats`.

**Added on resume** (the WIP specs passed first time): the planned stop (One more lap moves it a
lap later, Box as planned changes the tyres, Change plan opens the editor); the plan pill naming
the coming stop ("Plan · box L50"); "every call answered in turn" on Turkey 2021, Great Britain
2023, Monaco 1992 and Monaco 1988 (the n-th call gets option n; each decision checked to go in as
pressed; Switch checked to change the plan the car runs on both Monacos); Legend's plans,
headset, OpenStreetMap credit, classification and board links; plan C; the history book's
leaderboard link after a rewrite earned in play.

**Coverage** (Eras specs only, 281 of 411):

| Route | Pressed |
|---|---|
| `/eras` | 13/13 |
| `/eras/:n` | 16/16 |
| `/eras/:n/:race/leaderboard` | 14/14 |
| `/eras/:n/:race/leaderboard/legend` | 13/13 |
| `/eras/history` | 16/16 |
| `/eras/:n/:race` (intro, race, results) | 157/264 |
| `/eras/:n/:race/legend` | 52/75 |

Not pressed, mostly the same control under a changing name: about 60 car buttons from other
races' fields (every car is pressed in Turkey 2021), about 24 plan cards in other races or
grading states, the brand button (carries the driver), the team radio header (carries the
headset summary), battle and quick-call answers that depend on the race (each kind pressed
somewhere; S2 presses every option), the bare Plan pill, "Copied!", Legend headset modes that the
held Legend race can't book (pressed on the normal race), and a refuelling quick call's box answer
waiting for a fill (only the unforceable SC call offers it; the fill on the radio and plan editor
is tested instead).

**States:** the map in test mode and production (open, Mastered, locked, coming soon; the 70%
unlock: Era 9 locked at 20 of 30, a ★1 for the 21st star opens it; loading, error and Try again,
an unknown era); era detail (Legend shut until Cleared, then on and off, stars and best accuracy,
Reconstructed and Draft badges, locked, coming soon, an unknown race, error and retry); the intro
(objectives, timer off, Draft, How it works, start loading, refused, Try again); the race (every
plan and your own, speed, the decision timer and the untimed opt-out, radio sound, home, phone
tabs and desktop views, Follow car, every car's details, headset and team orders with Release, a
decision by Box, Back, tyre, number key and timeout, the refuelling fill, the Era 2 pit board, a
fault, a storyline retirement repeated and avoided, a safety car, the planned stop, Switch and Keep
ours); results ("Grading your calls…", a failed submit and Retry, stars new or not, ★2 reached or
short, rank, rewrite and history entry, no rewrite, none to earn, the community line or none, the
hidden objective new, done, done before, a held and a refused score, share, classification, New
attempt, Back to era, leaderboard, history book, home); Legend intro, race, results and board;
leaderboards (both tabs by press and arrows, Home, End; the address follows the tab; your line on,
below the top 100, or off the board; empty; errors); the history book (completion, chapters,
rewrites with their boards, empty, error, a rewrite earned in play).

**Markup:** none; no `src` files changed.

**Bugs:** one `test.fixme` for the owner: Turkey 2021's team radio named every dry tyre "Dry"
(the test "every tyre the team radio offers has its own name"). It was fixed at integration
(`raceRules.ts`; see the Result). The report counts 2 fixmes among its 3 skips but names only
this one; the other is likely the existing Austria 2002 team-order fixme in `eras-play.spec.ts`
(not confirmed from the report).

**Mutation checks: 8, all caught** (real assertion failures, restored with `git checkout`). The
report doesn't name the test that caught each.
1. EraDetail Legend toggle
2. RaceLeaderboard tab click
3. RefuelControls fill pick
4. EraIntro How it works
5. HistoryBook Try again
6. EraMap Try again
7. PlanBar One more lap
8. EraResults New attempt

**Runtime:** about 7-7.6 min at 2 workers; two runs in a row, 117 passed and 3 skipped each.

### E: admin

Branch `ts-e-admin`: 68bb27b and ad68211 on the WIP commit 8786fd6.

**Specs:** `admin-access`, `admin-nav`, `admin-today`, `admin-schedule`, `admin-eras`,
`admin-players`, `admin-runs`, `admin-tickets`, `admin-reports`, and a new `admin-audit` (one
edit of each of the 14 kinds across the tabs; the Log lists all 15 changes newest first with
label, summary, time and admin email, and the Action filter finds one kind; a refused edit isn't
logged). The fake admin API (`adminApi.ts`) writes every edit to the Log in the Worker's own
detail shapes.

**Fixed on resume:** the race preview expects "Gauntlet" for Spain 2020 (#57); checks of what a
control sent wait for the request, and list and table reads poll (one load failure in a full
run); the Versus nav entry and its two tests removed; added the owner filter picked while tickets
load, and a card picked up after a search.

**Coverage:** 202 of 209.

| Route | Pressed |
|---|---|
| `/admin` | 21/22 |
| `/admin/schedule` | 23/24 |
| `/admin/eras` | 16/17 |
| `/admin/runs` | 24/25 |
| `/admin/players` | 31/31 |
| `/admin/tickets` | 60/61 |
| `/admin/stats` | 12/13 |
| `/admin/log` | 13/14 |

The only unpressed control is the Versus tab link on each route (out of the release). The
recorder folds a list of six or more buttons into "(a row of: ul)", so ticket-card buttons show
by name only when a filter narrows the list.

**States:** access (signed out, expired token, checking, signed in, sign out surviving a reload, a
non-admin refused 403, a bad token 401, no admin API 404, no network); nav (every tab from every
tab, header links, Sign out from each, an unknown path); Today (health, empty, load error,
Refresh, Re-pin and its error, the announcement's tone, end time, 280-character limit, refusal,
busy); Schedule (seed and Play, the preview as phone sheet or desktop panel, read-only days, a
day's race and a 409, scheduling N days for all or one race and a 400, Re-pin, Clear my run, busy,
empty, load error); Eras (publish and unpublish, Release now, Set date, moving a release later
asks and earlier doesn't, Clear release asks, the locks and ten-race rule, refusal, busy, none,
load error); Runs (search by date, player and mode, re-verify for a day or a mode, a run's calls,
Delete asks, Gauntlet rounds, an Eras run, loading, gone, network error); Players (summary,
search, every sort, Refresh, capped, empty, 401, rename, clear, refused name, hide and show, the
player's runs, none, gone); Tickets (groups and counts, open and close, Completed, create with
defaults, Cancel, Escape, saving and refusal, edit, status, pick up, unassign, delete, search,
category and owner filters, empty messages, the failure banner and Dismiss, a ticket deleted
elsewhere, a failed load and Try again); Stats and Log (every section, empty, Refresh, error, the
Action filter, Load older, an unknown action).

**Markup** (attribute-only, from the WIP): `aria-label` on 9 controls in 7 files: AdminPage
"Days to schedule", Assignee "Assignee for #N", LogPage "Action", PlayersPage "Sort", RunsPage
"Mode", TicketEditor "Category", "Status", "Assignee", TodayPage "Tone".

**Bug fixed:** the day race select in `AdminPage.tsx` read `e.target.value` after saving, when
the controlled select had snapped back, so the message named the old race. The fix is a small
logic change; undoing it fails three specs (pick a race, schedule the next days, the audit test).
No open bugs, no `test.fixme`.

**Mutation checks: 7, all caught.** The report doesn't name the catching test except for 7.
1. Announcement tone always sent as info
2. Clear release without asking
3. Hide sends the old value
4. Pick up does nothing
5. Load older reloads the first page
6. Delete run without asking
7. The race-select fix undone (the three specs above)

An eighth mutation changed only the day request's body and failed nothing; the agent judged that
expected (the value is read in time either way).

**Runtime:** 1.0-1.2 min for its 130 tests on both projects (with the older `admin`,
`admin-tabs`, `players` and `tickets` specs) at 2 workers, quiet; up to about 2.4 min under load.
`admin-nav` is slowest (30-60 s per project). Two runs in a row: 130 of 130.

### After the merge: review fixes (387f1be)

An independent read-only review of the merged branch found no systemic hole but listed weak
spots in the S3 specs, fixed in 387f1be:
- `pages.spec`: the stats/Focus view toggles inside `toPass` could toggle back on a retry; now two
  steps that press only while the target state is missing. The coach walk no longer swallows
  failed presses (each Got it must move the coach on in one press). Restart is checked to reset the
  race (the plan card again, back at the takeover lap).
- `eras-race.spec`: a `pressOn()` helper replaces the `.click().catch(() => {})` calls; a failed
  press is ignored only when its card has gone. The race-holds check waits on the decision timer,
  not an 800 ms sleep. The untimed run asserts a decision card was seen. The fuel-fill loop asserts
  its 3 buttons.
- `daily-race.spec`: after Keep ours, two laps each waited to the re-rank, replacing a 1 s sleep.
- `daily-intro.spec` and `tickets.spec`: exact counts before looping over `.all()`.
- `daily.ts` `runTo` throws on an unexpected phase or when its guard runs out.
- The first run after these fixes also found a test already broken by S2's names: "each of the
  engineer's plans" matched `/Engineer's pick/` against the new lower-case "engineer's pick"; it now
  matches without case.

The fix agent's own mutation checks: Keep ours asking again every lap failed the new lap loop; in
`today.test.ts`, changing only TimingTower's aria attributes still passed (7/7) and changing a class
failed 2 tests. It reported two full runs of the touched specs: 270 passed, 6 skipped.

### Mutation checks by area

| Area | Agent | Run | Caught |
|---|---|---|---|
| S2 components | A | 25 | 25 |
| S3 Daily | B | 7 | 7 |
| S3 Gauntlet, pages, account | C | 8 | 8 |
| S3 Eras | D | 8 | 8 |
| S3 admin | E | 7 (+1 that changed nothing observable) | 7 |
| S4 flows | F | 4 | 4 |
| S5 Worker contracts | F | 4 (one, "any verified account as admin", failed 28 tests, one per admin route) | 4 |
| Review fixes (387f1be) | fix agent | 1 behaviour + 2 digest checks | as expected |

## S4: L3 flows against a local Worker and D1 (agent F)

`pnpm --filter @laststint/web e2e:flows` (`apps/web/playwright.flows.config.ts`, specs in
`apps/web/e2e/flows`). Nothing is mocked except Google's sign-in script.

**The local stack** (started fresh on every run, never reused):

1. `e2e/flows/stack.mjs`: a new local D1 in a temp directory (`--persist-to`), every
   migration, the dailies from the fixed date (`schedule --local --persist-to <dir> --from
   2026-06-01 --days 28 --race abu-dhabi-2021`), an Eras seed (Eras 10 and 9 released and
   published; each project's Eras player on 20 Era 10 stars), then `wrangler dev --local` on
   port 8851 (inspector 5352) with an env file: `FLOWS_TEST=true`, `FLOWS_NOW`, Google sign-in with the flows' own
   key (`GOOGLE_JWKS`, Auth0 off), `ADMIN_EMAILS=admin@flows.test`, `SURVIVOR_POOL` (Spain 2020),
   `ERAS_TEST_MODE=false`.
2. `vite build` + `vite preview` (`e2e/flows/vite.flows.config.ts`) on port 5351, with
   the Google sign-in path on and `/api` proxied to (1).

**The fixed date.** The Worker reads the time in about 40 places, so the least invasive hook
is one clock swap at the top of `fetch()` (`apps/worker/src/testClock.ts`). It does nothing
unless the `FLOWS_TEST` var is exactly `"true"`, which only the flows' env file sets (not
`wrangler.jsonc`, not staging). When on, "now" is the request's `x-flows-now` header, else
`FLOWS_NOW`, running on in real time. The browser's clock is put at the same time
(`page.clock.install`), and Playwright sends the header with every request, so the next day is
one `setTime()` call. A contract test checks the header is ignored when the var is off.

| Flow | What it checks |
|---|---|
| `daily.spec.ts` | The day's Daily (the card shows no number, #58) intro → plan → every call → result; the Worker's 201 (its own score, rank 1/1, number in the API); the stored run, streak 1 and leaderboard from the API; Share result: the line (no number) and link on the clipboard, "Copied!"; reload → straight to the result; with the browser's saved run gone, the game fetches the run from the Worker and shows it; a second submit is 409; next day: the next Daily, streak 2 in the API and on screen; day 1 not playable on day 4 |
| `gauntlet.spec.ts` | Start (201, Spain 2020), round 1 won (the Worker's verdict), the next race's brief, round 2 lost (box for softs at every stop call), "run over"; the run in the API (over, 1 round, history won/lost), the all-time board one longer, a late round refused (409) |
| `eras.spec.ts` | Production mode: Era 9 locked "1 to go" and the Worker refuses its attempt (403 era-locked); Belgium 2023 from the Era 10 page to its stars (the Worker deals the seed, replays and scores); the new star makes Era 10 21+ stars; Era 9 opens on the map and Turkey 2021 starts (201) |
| `account.spec.ts` | A bad token (401, still signed out); sign-in (a new account adopts its player ID), the profile sheet saved (POST /api/profile), the account in the API, the old anonymous ID linked, reload stays signed in, sign out (fresh anonymous ID, no account), another browser finds the same account with no profile prompt; an admin account gets the Admin menu item |
| `admin.spec.ts` | A non-admin is refused on /admin (403 from the Worker); the admin signs in, sets an announcement, changes day 4's race to Spain 2020; both edits in the audit log; a player sees the banner, and on day 4 the Spain 2020 daily; clearing it takes the banner down |

**Not covered locally:** Auth0's hosted login and its redirect back (`completeLogin`), Google's
own popup and One Tap, fetching the real issuers' keys, the daily cron (`scheduled`), and the
nightly re-verification. The Worker's Auth0 token path is in `apps/worker/test/auth.test.ts`.
**Phone and desktop.** Both projects run every flow against the one stack. Each plays its own
days and players (`e2e/flows/env.ts` PROJECTS: desktop from 2026-06-01, phone from 2026-06-15;
its own Eras player, account and display name), so they never meet; the Gauntlet's shared
all-time board is checked relative to what was there before.

**Runtime:** 9-11 minutes for both projects (stack start and web build ~1.5 min; per project
Daily ~1.3 min, Eras ~1 min, Gauntlet ~2.5 min, the rest seconds). Two full runs back to back
(the second with `E2E_COVERAGE=1`) passed 12/12. Run it detached or with a long timeout: a
shell that kills the run at 10 minutes takes the stack down mid-test (the "Gauntlet never
answers" failure seen before the pause). `FLOWS_DEBUG=1` shows the Worker's request log;
`stack.mjs` always reports on stderr if `wrangler dev` exits. A run's D1 is in
`$TMPDIR/laststint-flows-*`; Playwright kills the stack hard, so the folder can be left behind.

**Control coverage** (`E2E_COVERAGE=1`): the flows press 70 of the 362 controls they bring on
screen across 7 routes (`/` 23/102, `/gauntlet` 22/100, `/eras/:n/:race` 15/94, `/admin` 6/21,
`/admin/schedule` 2/21, `/eras` 1/12, `/eras/:n` 1/12), with none unnamed. The flows press what
the journeys need; every control is the S3 screen specs' job.

**Mutation checks** (each broke a test, then restored): Share result not setting "Copied!";
the Gauntlet board tabs doing nothing; the admin announcement sent changed (caught only after
the banner check was made case-exact); the profile sheet dropping the team.

## S5: Worker contract tests (agent F)

`apps/worker/test/contract.test.ts` walks all 54 routes (28 admin, 26 public): every admin
route signed out, with a non-Bearer header, an oversize token, a bad token and a player (401,
401, 401, 401, 403 with the exact body) and with sign-in off (503 auth-off); expired, wrong
audience, wrong issuer, unverified and re-signed admin tokens; then each route's success, bad
input (missing, wrong type, invalid, oversize), not found, the RUNS_LIMITER limit where it
applies (runs, auth, survivor start and round, Eras start and submit) and the exact error. A
real run and player go through the admin run detail, reverify, delete, player page, rename and
hide, and the audit log. Mutation checks caught: the test clock on for any FLOWS_TEST value,
the POST /api/runs limiter ignored, a day with runs re-raced, and any verified account taken
as admin (28 failures, one per admin route).

## Bugs and notes from S4/S5

- **`scripts/schedule.ts` misread `docs/g1-report.md`**: fixed on main by #58 (eligible = in
  the daily pool with moments). The flows no longer pass `--allow-ineligible`.
- **The test clock is off in production**: contract tests check that only `FLOWS_TEST` exactly
  `"true"` turns it on (`TRUE`, `1`, `yes`, empty and unset don't), that `Date` stays the real
  one when off, and that `wrangler.jsonc` (production and staging) sets neither var.
- **A failed sign-in is silent on the daily card** (web, not changed): the compact account bar
  on the intro doesn't show `account.error`; only the result screen's bar does.
- **Gauntlet rounds share the daily's rate-limit key** (`POST /api/survivor/:id/round` and
  `POST /api/runs` both count against the bare IP), so a player's daily run and Gauntlet rounds
  draw from the same 10 a minute. Probably fine; noted.
- `test/shuffle.test.ts` "keeps a race from coming straight back…" is CPU-bound and times out
  (60 s) under heavy machine load (load average 25-37 from parallel agents' e2e runs; the file
  alone took 86 s then). It passes when the machine is quieter. Not changed here.

## S7: break it and see a test fail (Nov 26)

After the merge, one control or check per area was broken on purpose in the source, only the
tests that should catch it were run (browser specs on the desktop project), and the file was
restored from git (a small script applied one change, ran the tests, recorded the result and ran `git checkout`).

| # | Area | What was broken | Run | Result |
|---|---|---|---|---|
| W1 | Worker | The admin check no longer refuses a non-admin (`admin.ts`) | worker tests | Caught: the contract tests' "refuses a non-admin on every route", "needs an admin for every new endpoint" and the sign-in test |
| W2 | Worker | A locked era can be attempted (`eras.ts` era-locked) | worker tests | Caught: "refuses a locked era (20 stars in the era before it)" |
| W3 | Worker | The 64 KB body limit raised to 64 MB (`index.ts`) | worker tests | Caught |
| C1 | Component | A battle answer does nothing (`BattleCard`) | component tests | Caught: each move's "a tap on … answers …" |
| C2 | Component | A plan card can't be picked (`PlanCard`) | component tests | Caught: picking by tap and by keyboard, Build your own |
| D1 | Daily | The 1×/2× speed buttons do nothing | `daily-race` | Caught: "speed, follow car, and (on a laptop) sound and the stats view" |
| D2 | Daily | A plan card can't be picked | `daily-race` | Caught: "the plans, the engineer's pick, and going with another" |
| D3 | Daily | How to play's Next doesn't advance | `daily-intro` | Caught: "the walkthrough opens on a fresh visit and steps back and forth" |
| G1 | Gauntlet | The leaderboard tabs do nothing | `gauntlet` | Caught: "the rules, the leaderboard tabs and the way into a run" and others |
| E1 | Eras | The History book link points at the map | `eras-results` | Caught: "the way on: share, the classification, the links, home and a new attempt" |
| E2 | Eras | New attempt does nothing | `eras-results` | Caught: the same test and "a score the server holds, and one it refuses for good" |
| A1 | Admin | Save name doesn't send the name | `admin-players` | Caught: "a player: rename, clear the name, a refused name" |
| A2 | Admin | A ticket can't be opened | `admin-tickets` | Caught: "the list: groups, counts and the Completed section", "open a ticket, edit it, …" |
| P1 | Account | The full account bar's Sign out does nothing | `account` | **Missed**, then fixed (below) |
| V1 | Screenshots | The result card's top border 3 px → 6 px (visual only) | `shots` in the Linux image | Caught: `daily-result` on phone (11,591 px) and desktop (17,647 px) |

**15 checks: 14 caught, 1 missed.** The miss: the full account bar (name and Sign out, not the
compact menu) shows only on the result of a run just played while signed in, and no browser
test reached that state, so the coverage guard never saw its buttons either (it can only flag
controls that come on screen). The component test (`AccountBar.test.tsx`) did catch the same
break. Added `daily-result.spec.ts` "signed in: the result's account bar, its name opens the
profile, Sign out" (`openDaily` takes an `account`); the break is now caught there too.

**Limit of the guard, from P1:** a screen state no test reaches is invisible to it. The states
each area's specs reach are listed under S2-S5; the full bar on a signed-in result was the one
gap found.

**All areas together** (the agents' own checks under S2-S5, and these):

| Area | Checks | Caught |
|---|---|---|
| S2 components (A) | 25 | 25 |
| S3 Daily (B) | 7 | 7 |
| S3 Gauntlet, pages, account (C) | 8 | 8 |
| S3 Eras (D) | 8 | 8 |
| S3 admin (E) | 7 | 7 |
| S4 flows (F) | 4 | 4 |
| S5 Worker contracts (F) | 4 | 4 |
| S7 after the merge | 15 | 14 (+1 fixed with a new test) |
| **Total** | **78** | **77, and the 1 miss now caught** |

The coverage guard itself was checked the same way at S6: dropping the spec's "Share result"
press fails it.

**Owner sign-off:** this report, the exceptions in `apps/web/e2e/coverage-exceptions.json`, and
the three open items in the Result.

## Screenshots (D6)

`apps/web/e2e/screens/shots.spec.ts` takes `toHaveScreenshot` shots of the key screens only, on
both projects (phone 390 px, desktop 1440 × 900):

| Shot | State |
|---|---|
| `daily-card.png` | The Daily card (Spain 2025), the walkthrough closed |
| `daily-plan.png` | The race plan at the takeover, every plan graded |
| `daily-result.png` | A result: today's run already played (P1 ahead of Alonso, score 85, rank 3/10, 72%) |
| `gauntlet-lobby.png` | The Gauntlet lobby with a two-row weekly leaderboard |
| `eras-map.png` | The era map in production: Era 10 Mastered, Era 9 open, Era 8 locked, the rest coming soon |
| `eras-intro.png` | Hungary 1992's intro |
| `eras-results.png` | Hungary 1992's results with three new stars and the rewrite |
| `admin-today.png` | Admin Today with a warning announcement |

Each is set up with the screen specs' mocks. The clock is fixed (2026-11-11 12:00 UTC) except
for the Eras results, whose race has to run to the flag (cut to its last two laps). Every shot
waits for the fonts and an idle network, turns animations off, hides the caret, masks every
`<canvas>` (the 3D view) and allows `maxDiffPixelRatio: 0.01`.

**Linux only.** The baselines (`apps/web/e2e/screens/shots.spec.ts-snapshots/*-linux.png`) are
made in the Playwright Docker image so they match CI's ubuntu-latest; the spec skips on any
other platform. Never commit baselines made on macOS.

**Updating on purpose** (after a design change). From the repo root, with Docker running. The
anonymous volumes keep the container's Linux `node_modules` off the Mac's:

```sh
docker run --rm --ipc=host -v "$PWD":/repo -w /repo \
  -v /repo/node_modules -v /repo/apps/web/node_modules -v /repo/apps/worker/node_modules \
  -v /repo/packages/sim/node_modules \
  mcr.microsoft.com/playwright:v1.49.1-noble bash -c '
    npm i -g pnpm@12.15.0 && pnpm install --frozen-lockfile && cd apps/web &&
    CI=1 E2E_PORT=5381 npx playwright test e2e/screens/shots.spec.ts --update-snapshots'
```

Then run the same command without `--update-snapshots` twice to check the shots are stable,
look at the new PNGs, and commit only `apps/web/e2e/screens/shots.spec.ts-snapshots/`. The image
tag follows `@playwright/test` in `apps/web/package.json`; `noble` is Ubuntu 24.04, the same as
ubuntu-latest. The image's corepack fails on an old npm signing key, so pnpm comes from npm.

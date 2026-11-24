# Test suite: report

Spec: `docs/test-suite-spec.md`. The full control list is generated into
`docs/test-suite-coverage.md` (`E2E_COVERAGE=1 pnpm --filter @laststint/web e2e`, then
`pnpm --filter @laststint/web coverage:report`).

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

## Paused (Nov 24): where to resume

Nothing in the test-suite effort is committed. The work is in worktrees under `.worktrees/`, all
from `origin/main` cf6d89e plus the S1 patch:

| Worktree | State |
|---|---|
| `test-suite` | S1 done: recorder, report script, spec (D1-D7, D4 = keep the PC runner), this report, the admin-tabs fix, the `screens/` desktop match |
| `ts-a-components` | **S2 done:** jsdom + Testing Library harness, 21 component test files (233 tests), 7 attribute-only accessibility fixes, 3 Eras digests updated in `today.test.ts`. Web suite 1289 passed; 25 mutation checks all caught |
| `ts-b-daily` | S3 Daily: stopped mid-work (one spec file under `e2e/screens/`, unfinished: battle tests being rewritten) |
| `ts-c-gauntlet-misc` | S3 Gauntlet, pages, account: stopped mid-work (one spec file) |
| `ts-d-eras` | S3 Eras: stopped mid-work (one spec file) |
| `ts-e-admin` | S3 admin: stopped mid-work (one spec file) |
| `ts-f-flows-api` | S4 flows + S5 Worker contracts: stopped mid-work (flows config and Worker tests started; the Gauntlet flow was running) |

To resume: finish S3-S5 in their worktrees (re-brief an agent per worktree from its own
changes), then merge all six into `test-suite`. Reconcile e2e selectors with S2's new
accessible names (battle options are now named by their label alone, plan cards as "B · One
stop, 61%, engineer's pick"). Then run the full suite plus coverage, review and verify, S6 (the
CI guard on the PC runner, Linux screenshot baselines), and one PR.

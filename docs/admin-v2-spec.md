# Admin page v2

**Status:** decided by the owner (Nov 11, 2026: "do all" of the nine items). Built on the
`fixes-nov11` branch, tested on localhost. Not deployed: production needs the owner's go, and
migration 0030 runs on the production database in the same deploy.

The admin page (`/admin`) runs the game. Today it has three tabs:
- **Races & schedule:** play any race, set and schedule days, re-pin stale days, clear your own
  run.
- **Tickets.**
- **Players:** read-only.

Several jobs are still done by hand with production SQL: publishing Eras races, releasing eras
and re-verifying runs. v2 moves them onto the page, adds the numbers needed to run the game,
and logs every change.

## Decisions

- **Tabs** (in this order):
  - **Today:** the health check and the announcement banner.
  - **Schedule:** the old Races & schedule tab, with a race preview.
  - **Eras.**
  - **Runs.**
  - **Players.**
  - **Versus.**
  - **Stats.**
  - **Tickets.**
  - **Log.**
- **Every change is logged** (who, when, what, and the details) in a new `admin_log` table. The
  Log tab lists it, newest first, filterable by action.
- **Everything is checked on the server.** Every endpoint goes through `requireAdmin` as today,
  and the page only shows the tabs once the server confirms an admin.
- **Daily and Gauntlet stay frozen.** No race file, golden or grade changes. The new controls
  only read and write the database.

## A1. Eras release controls (Eras tab)

- **Each era:** its races with their position and a Draft/Published switch, plus its release
  date. It shows "Coming soon", "Releases on <date>" or "Released".
- **Publishing a race** sets `era_races.published`. **Releasing an era** sets
  `eras.released_at` (a date, or now).
- **The release guard:** an era can't be released with fewer than 10 published races (eras spec
  D5). Clearing a release date (back to Coming soon) needs confirmation.
- **Per race:** attempts and players so far.

## A2. Today (health check)

- **The schedule:** today's and tomorrow's race, with the puzzle number, and how many days are
  queued (warning under 7).
- **Stale days:** scheduled days whose race file changed since they were pinned, with "Re-pin
  stale days".
- **Today's runs:** runs submitted today, how many are verified, and how many were corrected or
  failed.
- **The announcement** (A8): the current one, and a form to set or clear it.

## A3. Runs

- **Search:** by date (default today), by player (name, email or id) or by mode (Daily,
  Gauntlet, Eras). Newest first, 200 at most.
- **A run:** player, race, score or result, verified or corrected, and its calls with their
  grades.
- **Actions** (each logged):
  - **Re-verify:** mark one run, or every run on a day, for the nightly check
    (`verified = 0`).
  - **Delete:** a daily run and its calls, with confirmation.

## A4. Stats

From data already stored, no tracking added:
- **Daily:** players a day for the last 30 days, the share who finish, the average score, and
  the calls players most often miss (graded orange or red) on recent days.
- **Gauntlet:** runs started, rounds survived (distribution), best run.
- **Eras:** attempts and stars per era, players with at least one star.
- **Versus:** matches a day (A7).
- **Accounts:** sign-ups a day, and the share of players signed in.

## A5. Race preview (Schedule tab)

- **What it shows:** any playable race's map, with its fit on the real ground (from
  `data/scenery`: median distance and the share on real tarmac), its moments and real calls,
  its seed and side, and which pools it's in.
- **Where it lives:** a panel beside the race list. It opens without starting a race.

## A6. Player actions (Players tab)

- **A player's page:** their runs (daily, Gauntlet, Eras), their streak and the days behind it,
  linked browsers, sign-up date.
- **Actions** (each logged):
  - **Edit the display name**, or clear it (for a bad name).
  - **Hide from leaderboards:** new column `players.hidden`. A hidden player still plays, and
    their runs count for them, but they don't appear on any leaderboard.
- **Streaks:** worked out from the days played, never stored, so there's nothing to reset. The
  page shows them so a report can be checked.

## A7. Versus

- **Stored:** a finished match is now saved (new table `versus_matches`): code, track, players,
  cars, winner, gap, forfeit, battles, started and finished.
- **The tab:** recent matches, and live rooms (code, phase, players, lap). Live rooms come from
  a list the Worker keeps in the database as rooms open and close (`versus_rooms`).

## A8. Announcements

- **One banner at a time** (table `announcements`): text, a tone (info or warning), and an
  optional end time.
- **Where it shows:** under the top bar on every page. Players can dismiss it (remembered in the
  browser by its id).
- **API:** a public `GET /api/announcement` serves the current one. Setting and clearing it are
  admin only (logged).

## A9. Audit log

`admin_log(id, at, email, action, detail)`. Written by every change on the admin page:
schedule, day, re-pin, clear run, publish, release, re-verify, delete run, player name, hide,
announcement. Tickets keep their own history and log create and status changes here too.

## Migration 0030

- `admin_log`
- `announcements`
- `versus_matches`
- `versus_rooms`
- `players.hidden`

All additive, no data changed.

## Build

1. **Worker:** migration, the log helper, the endpoints, the leaderboards skipping hidden
   players, versus storing matches and rooms. Worker tests for each.
2. **Web:** the tabs, then the banner on the site. Unit tests for the new logic; one e2e that
   opens each tab.
3. **Checks:** every check in CLAUDE.md, then a look at each tab on localhost.

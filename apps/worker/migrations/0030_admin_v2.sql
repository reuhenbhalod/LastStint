-- Admin page v2 (docs/admin-v2-spec.md): the audit log, the announcement banner, stored Versus
-- matches and the live rooms list, and hiding a player from the leaderboards. Additive only:
-- no existing row changes.

-- A9: every change made on the admin page (who, when, what, and its details as JSON).
CREATE TABLE admin_log (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  at     TEXT NOT NULL,                       -- ISO time
  email  TEXT NOT NULL,                       -- the admin
  action TEXT NOT NULL,                       -- 'schedule', 'publish', 'hide', ...
  detail TEXT NOT NULL DEFAULT '{}'           -- JSON
);

CREATE INDEX admin_log_action ON admin_log (action, id);

-- A8: the banner under the top bar. The current one is the newest that isn't cleared and
-- hasn't ended; setting a new one clears the one before.
CREATE TABLE announcements (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  text       TEXT NOT NULL,
  tone       TEXT NOT NULL DEFAULT 'info',    -- info / warning
  ends_at    TEXT,                            -- ISO time, NULL = until cleared
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  cleared_at TEXT
);

-- A7: a finished Versus match (written by the room, src/versus.ts finish()).
CREATE TABLE versus_matches (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT NOT NULL,
  track       TEXT NOT NULL,
  players     TEXT NOT NULL,                  -- JSON: the two names, seat order
  cars        TEXT NOT NULL,                  -- JSON: [{ car, startTyre }, ...]
  winner      INTEGER,                        -- seat 0 / 1
  gap         REAL,                           -- seconds the second car finished behind
  forfeit     INTEGER,                        -- the seat that left mid-race, or NULL
  battles     INTEGER NOT NULL DEFAULT 0,
  started_at  TEXT NOT NULL,
  finished_at TEXT NOT NULL
);

CREATE INDEX versus_matches_finished ON versus_matches (finished_at);

-- A7: the rooms open now, kept by each room as it opens, changes phase and closes.
CREATE TABLE versus_rooms (
  code       TEXT PRIMARY KEY,
  track      TEXT NOT NULL,
  phase      TEXT NOT NULL,                   -- lobby / pick / race / grading / done
  players    TEXT NOT NULL DEFAULT '[]',      -- JSON: the seated names
  lap        INTEGER NOT NULL DEFAULT 0,
  opened_at  TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  closed_at  TEXT
);

-- A6: a hidden player still plays, but no leaderboard shows them.
ALTER TABLE players ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0;

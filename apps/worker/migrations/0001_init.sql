-- Initial schema (Implementation Plan 4.2).

CREATE TABLE daily (
  date         TEXT PRIMARY KEY,   -- 2026-12-01
  race_id      TEXT NOT NULL,
  seed         INTEGER NOT NULL,
  side         TEXT NOT NULL,      -- team/driver the user runs
  published_at TEXT NOT NULL
);

CREATE TABLE runs (
  id         TEXT PRIMARY KEY,
  date       TEXT NOT NULL REFERENCES daily(date),
  anon_id    TEXT NOT NULL,
  decisions  TEXT NOT NULL,        -- JSON array
  score      REAL NOT NULL,        -- server computed
  result     TEXT NOT NULL,        -- JSON: finish, grades
  created_at TEXT NOT NULL,
  UNIQUE (date, anon_id)
);

CREATE INDEX runs_date_score ON runs (date, score);

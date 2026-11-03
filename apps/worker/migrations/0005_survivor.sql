-- Survivor mode (docs/survivor-spec.md): races back to back until the first loss, from the
-- survivor pool (data/pools.json). A run deals its races at random; each round is a race with
-- the seed the server picked, verified like a daily when it's submitted.

CREATE TABLE survivor_runs (
  id          TEXT PRIMARY KEY,
  anon_id     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'live',   -- live / over
  rounds      INTEGER NOT NULL DEFAULT 0,     -- races won
  score_sum   REAL NOT NULL DEFAULT 0,        -- the won races' scores (rank tie-break: mean)
  started_at  TEXT NOT NULL,
  ended_at    TEXT
);

CREATE INDEX survivor_rank ON survivor_runs (rounds DESC, score_sum DESC, started_at);
CREATE INDEX survivor_player ON survivor_runs (anon_id);

CREATE TABLE survivor_rounds (
  run_id          TEXT NOT NULL REFERENCES survivor_runs(id),
  round           INTEGER NOT NULL,           -- 1-based
  race_id         TEXT NOT NULL,
  seed            INTEGER NOT NULL,
  model_hash      TEXT NOT NULL,
  decisions       TEXT,                       -- JSON, once submitted
  grades          TEXT,                       -- JSON: the claimed grades
  score           REAL,
  won             INTEGER,                    -- 1 / 0 once submitted
  finish_position INTEGER,
  result          TEXT,                       -- JSON: the stored result
  submitted_at    TEXT,
  verified        INTEGER NOT NULL DEFAULT 0, -- the nightly re-grade checked it
  corrected       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (run_id, round)
);

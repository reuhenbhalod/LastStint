-- Phase 4 (docs/phase-4-backend-spec.md): puzzle numbers, pinned race models, rank tie-breaks
-- and per-moment calls for the stats.

ALTER TABLE daily ADD COLUMN number INTEGER NOT NULL DEFAULT 0;      -- puzzle number (share text)
ALTER TABLE daily ADD COLUMN model_hash TEXT NOT NULL DEFAULT '';    -- SHA-256 of the scheduled model
CREATE UNIQUE INDEX daily_number ON daily (number);

ALTER TABLE runs ADD COLUMN mean_probability REAL NOT NULL DEFAULT 0;  -- first tie-break
ALTER TABLE runs ADD COLUMN finish_position INTEGER NOT NULL DEFAULT 0; -- second tie-break
ALTER TABLE runs ADD COLUMN disqualified INTEGER NOT NULL DEFAULT 0;

-- Rank order: score, then mean probability, then finishing position, then first submitted
-- (created_at, then rowid).
DROP INDEX runs_date_score;
CREATE INDEX runs_rank ON runs (date, score DESC, mean_probability DESC, finish_position, created_at);

CREATE TABLE run_calls (
  run_id       TEXT NOT NULL REFERENCES runs(id),
  date         TEXT NOT NULL,
  moment_id    TEXT NOT NULL,
  option_id    TEXT NOT NULL,
  band         TEXT NOT NULL,      -- green / yellow / orange / red
  matched_real INTEGER NOT NULL,   -- 1 if the player made the real team's call
  PRIMARY KEY (run_id, moment_id)
);

CREATE INDEX run_calls_date ON run_calls (date, moment_id, option_id);

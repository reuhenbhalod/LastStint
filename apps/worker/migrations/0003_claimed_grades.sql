-- Beta spec B6 (free plan): runs are scored from the grades the game claims, and a nightly job
-- re-grades each run with full playouts. Grading is deterministic, so a difference means the
-- claimed grades were edited; the run then gets its true score.

ALTER TABLE runs ADD COLUMN grades TEXT NOT NULL DEFAULT '[]';     -- JSON: the claimed grades
ALTER TABLE runs ADD COLUMN verified INTEGER NOT NULL DEFAULT 0;   -- 1 once the nightly job checked it
ALTER TABLE runs ADD COLUMN corrected INTEGER NOT NULL DEFAULT 0;  -- 1 if its score was replaced

CREATE INDEX runs_unverified ON runs (verified);

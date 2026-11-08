-- Eras server evaluation (eras build plan 7.3; eras spec §6, §7, §9). An attempt pins its race
-- file's hash at the start, so the submit checks it server-side (the client no longer has to
-- echo it). The submit is scored from the grades the game claims, as a Daily run is
-- (0003_claimed_grades.sql), and a nightly job re-grades it with full playouts: the claimed
-- grades are kept, with the Expert rival's claimed choices (spec §7), and the attempt is marked
-- verified, and corrected if its result changed.

ALTER TABLE era_attempts ADD COLUMN model_hash TEXT;                         -- pinned at start
ALTER TABLE era_attempts ADD COLUMN grades TEXT;                             -- JSON: the claimed grades
ALTER TABLE era_attempts ADD COLUMN rival_claims TEXT;                       -- JSON: Expert rival's claimed choices
ALTER TABLE era_attempts ADD COLUMN verified INTEGER NOT NULL DEFAULT 0;     -- 1 once the nightly job checked it
ALTER TABLE era_attempts ADD COLUMN corrected INTEGER NOT NULL DEFAULT 0;    -- 1 if its result was replaced

CREATE INDEX era_attempts_unverified ON era_attempts (verified);

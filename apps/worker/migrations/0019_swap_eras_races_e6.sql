-- Swap three Era 6 races (owner, Nov 9, pre-approved: each failing race swapped for the
-- next-best race by robust-G1 mean gap error; docs/eras-checks/swap-races-era6-overnight.md).
-- The three Era 6 races with the worst robust-G1 mean gap error go, worst first. As in
-- 0012-0014, each new race keeps the old one's era and position, so only the race_id changes:
--   Era 6 #4   monaco-2011    -> italy-2010
--   Era 6 #5   canada-2011    -> australia-2013
--   Era 6 #1   australia-2010 -> bahrain-2012
--
-- The removed races' player rows are deleted, not moved: an attempt, its stars and its history
-- book entry were earned on a different race, so none of them carries over. history_entries
-- goes first (it references era_attempts), then era_progress, then era_attempts (they
-- reference era_races), and only then is the race renamed in era_races. `published` is left
-- as it is (every race is still Draft).
-- Apply to production with the deploy that ships the new pools.json eras block, never
-- separately.

DELETE FROM history_entries
WHERE race_id IN ('monaco-2011', 'canada-2011', 'australia-2010')
   OR attempt_id IN (
     SELECT id FROM era_attempts
     WHERE race_id IN ('monaco-2011', 'canada-2011', 'australia-2010')
   );

DELETE FROM era_progress
WHERE race_id IN ('monaco-2011', 'canada-2011', 'australia-2010');

DELETE FROM era_attempts
WHERE race_id IN ('monaco-2011', 'canada-2011', 'australia-2010');

UPDATE era_races SET race_id = 'italy-2010'
WHERE race_id = 'monaco-2011' AND era_id = 6 AND position = 4;

UPDATE era_races SET race_id = 'australia-2013'
WHERE race_id = 'canada-2011' AND era_id = 6 AND position = 5;

UPDATE era_races SET race_id = 'bahrain-2012'
WHERE race_id = 'australia-2010' AND era_id = 6 AND position = 1;

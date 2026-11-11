-- Swap two more Era 7 races (owner pre-approved, Nov 9: each failing race is replaced by the
-- next-best race by robust-G1 stats; docs/eras-checks/swap-races-era7-overnight.md, third
-- round). As in 0012-0022, each new race keeps the old one's era and position, so only the
-- race_id changes:
--   Era 7 #1   bahrain-2014       -> united-states-2014
--   Era 7 #6   united-states-2015 -> germany-2016
--
-- The removed races' player rows are deleted, not moved: an attempt, its stars and its history
-- book entry were earned on a different race, so none of them carries over. history_entries
-- goes first (it references era_attempts), then era_progress, then era_attempts (they
-- reference era_races), and only then is the race renamed in era_races. `published` is left
-- as it is (every race is still Draft).
-- Apply to production with the deploy that ships the new pools.json eras block, never
-- separately.

DELETE FROM history_entries
WHERE race_id IN ('bahrain-2014', 'united-states-2015')
   OR attempt_id IN (
     SELECT id FROM era_attempts
     WHERE race_id IN ('bahrain-2014', 'united-states-2015')
   );

DELETE FROM era_progress
WHERE race_id IN ('bahrain-2014', 'united-states-2015');

DELETE FROM era_attempts
WHERE race_id IN ('bahrain-2014', 'united-states-2015');

UPDATE era_races SET race_id = 'united-states-2014'
WHERE race_id = 'bahrain-2014' AND era_id = 7 AND position = 1;

UPDATE era_races SET race_id = 'germany-2016'
WHERE race_id = 'united-states-2015' AND era_id = 7 AND position = 6;

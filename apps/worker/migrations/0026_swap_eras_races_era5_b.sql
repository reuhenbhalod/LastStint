-- Swap the last two Era 5 races that fail G1 (owner, Nov 9, pre-approved: the next-best race by
-- stats; docs/eras-checks/swap-races-era5-overnight.md, third batch). As in 0012-0022, each new
-- race keeps the old one's era and position, so only the race_id changes:
--   Era 5 #6   europe-2007 -> belgium-2009
--   Era 5 #7   brazil-2007 -> hungary-2007
--
-- The removed races' player rows are deleted, not moved: an attempt, its stars and its history
-- book entry were earned on a different race, so none of them carries over. history_entries
-- goes first (it references era_attempts), then era_progress, then era_attempts (they
-- reference era_races), and only then is the race renamed in era_races. `published` is left
-- as it is (every race is still Draft).
-- Apply to production with the deploy that ships the new pools.json eras block, never
-- separately.

DELETE FROM history_entries
WHERE race_id IN ('europe-2007', 'brazil-2007')
   OR attempt_id IN (
     SELECT id FROM era_attempts WHERE race_id IN ('europe-2007', 'brazil-2007')
   );

DELETE FROM era_progress
WHERE race_id IN ('europe-2007', 'brazil-2007');

DELETE FROM era_attempts
WHERE race_id IN ('europe-2007', 'brazil-2007');

UPDATE era_races SET race_id = 'belgium-2009'
WHERE race_id = 'europe-2007' AND era_id = 5 AND position = 6;

UPDATE era_races SET race_id = 'hungary-2007'
WHERE race_id = 'brazil-2007' AND era_id = 5 AND position = 7;

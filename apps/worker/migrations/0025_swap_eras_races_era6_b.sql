-- Swap four more Era 6 races (owner pre-approved, Nov 9: each failing race is replaced by the
-- next-best race by robust-G1 mean gap error; docs/eras-checks/swap-races-era6-overnight.md).
-- A second Era 6 round after 0019. As in 0012-0014, each new race keeps the old one's era and
-- position, so only the race_id changes:
--   Era 6 #10  spain-2013     -> abu-dhabi-2011
--   Era 6 #8   brazil-2012    -> china-2013
--   Era 6 #7   abu-dhabi-2012 -> germany-2012
--   Era 6 #3   china-2011     -> germany-2013
-- malaysia-2013 (Era 6 #9) stays.
--
-- The removed races' player rows are deleted, not moved: an attempt, its stars and its history
-- book entry were earned on a different race, so none of them carries over. history_entries
-- goes first (it references era_attempts), then era_progress, then era_attempts (they
-- reference era_races), and only then is the race renamed in era_races. `published` is left
-- as it is (every race is still Draft).
-- Apply to production with the deploy that ships the new pools.json eras block, never
-- separately.

DELETE FROM history_entries
WHERE race_id IN ('spain-2013', 'brazil-2012', 'abu-dhabi-2012', 'china-2011')
   OR attempt_id IN (
     SELECT id FROM era_attempts
     WHERE race_id IN ('spain-2013', 'brazil-2012', 'abu-dhabi-2012', 'china-2011')
   );

DELETE FROM era_progress
WHERE race_id IN ('spain-2013', 'brazil-2012', 'abu-dhabi-2012', 'china-2011');

DELETE FROM era_attempts
WHERE race_id IN ('spain-2013', 'brazil-2012', 'abu-dhabi-2012', 'china-2011');

UPDATE era_races SET race_id = 'abu-dhabi-2011'
WHERE race_id = 'spain-2013' AND era_id = 6 AND position = 10;

UPDATE era_races SET race_id = 'china-2013'
WHERE race_id = 'brazil-2012' AND era_id = 6 AND position = 8;

UPDATE era_races SET race_id = 'germany-2012'
WHERE race_id = 'abu-dhabi-2012' AND era_id = 6 AND position = 7;

UPDATE era_races SET race_id = 'germany-2013'
WHERE race_id = 'china-2011' AND era_id = 6 AND position = 3;

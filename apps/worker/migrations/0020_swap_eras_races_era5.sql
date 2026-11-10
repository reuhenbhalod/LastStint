-- Swap seven Era 5 races that fail G1 (owner, Nov 9, overnight: the next-best race by stats;
-- docs/eras-checks/swap-races-era5-overnight.md). As in 0012-0014, each new race keeps the old
-- one's era and position, so only the race_id changes:
--   Era 5 #2   japan-2005   -> europe-2009
--   Era 5 #3   hungary-2006 -> france-2007
--   Era 5 #4   brazil-2006  -> san-marino-2006
--   Era 5 #5   china-2007   -> great-britain-2007
--   Era 5 #8   monaco-2008  -> bahrain-2006
--   Era 5 #9   brazil-2008  -> turkey-2008
--   Era 5 #10  brazil-2009  -> malaysia-2006
--
-- The removed races' player rows are deleted, not moved: an attempt, its stars and its history
-- book entry were earned on a different race, so none of them carries over. history_entries
-- goes first (it references era_attempts), then era_progress, then era_attempts (they
-- reference era_races), and only then is the race renamed in era_races. `published` is left
-- as it is (every race is still Draft).
-- Apply to production with the deploy that ships the new pools.json eras block, never
-- separately.

DELETE FROM history_entries
WHERE race_id IN ('japan-2005', 'hungary-2006', 'brazil-2006', 'china-2007', 'monaco-2008', 'brazil-2008', 'brazil-2009')
   OR attempt_id IN (
     SELECT id FROM era_attempts
     WHERE race_id IN ('japan-2005', 'hungary-2006', 'brazil-2006', 'china-2007', 'monaco-2008', 'brazil-2008', 'brazil-2009')
   );

DELETE FROM era_progress
WHERE race_id IN ('japan-2005', 'hungary-2006', 'brazil-2006', 'china-2007', 'monaco-2008', 'brazil-2008', 'brazil-2009');

DELETE FROM era_attempts
WHERE race_id IN ('japan-2005', 'hungary-2006', 'brazil-2006', 'china-2007', 'monaco-2008', 'brazil-2008', 'brazil-2009');

UPDATE era_races SET race_id = 'europe-2009'
WHERE race_id = 'japan-2005' AND era_id = 5 AND position = 2;

UPDATE era_races SET race_id = 'france-2007'
WHERE race_id = 'hungary-2006' AND era_id = 5 AND position = 3;

UPDATE era_races SET race_id = 'san-marino-2006'
WHERE race_id = 'brazil-2006' AND era_id = 5 AND position = 4;

UPDATE era_races SET race_id = 'great-britain-2007'
WHERE race_id = 'china-2007' AND era_id = 5 AND position = 5;

UPDATE era_races SET race_id = 'bahrain-2006'
WHERE race_id = 'monaco-2008' AND era_id = 5 AND position = 8;

UPDATE era_races SET race_id = 'turkey-2008'
WHERE race_id = 'brazil-2008' AND era_id = 5 AND position = 9;

UPDATE era_races SET race_id = 'malaysia-2006'
WHERE race_id = 'brazil-2009' AND era_id = 5 AND position = 10;

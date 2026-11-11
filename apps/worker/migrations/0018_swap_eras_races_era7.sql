-- Swap six Era 7 races (owner's Nov 9 pre-approval to replace failing races by the next best
-- on stats; docs/eras-checks/swap-races-era7-overnight.md). As in 0012-0014, each new race
-- keeps the old one's era and position, so only the race_id changes:
--   Era 7 #2   canada-2014        -> brazil-2014
--   Era 7 #3   hungary-2014       -> canada-2016
--   Era 7 #4   monaco-2015        -> singapore-2014
--   Era 7 #5   hungary-2015       -> abu-dhabi-2015
--   Era 7 #8   monaco-2016        -> bahrain-2015
--   Era 7 #9   great-britain-2016 -> malaysia-2015
--
-- The removed races' player rows are deleted, not moved: an attempt, its stars and its history
-- book entry were earned on a different race, so none of them carries over. history_entries
-- goes first (it references era_attempts), then era_progress, then era_attempts (they
-- reference era_races), and only then is the race renamed in era_races. `published` is left
-- as it is (every race is still Draft).
-- Apply to production with the deploy that ships the new pools.json eras block, never
-- separately.

DELETE FROM history_entries
WHERE race_id IN ('canada-2014', 'hungary-2014', 'monaco-2015', 'hungary-2015', 'monaco-2016', 'great-britain-2016')
   OR attempt_id IN (
     SELECT id FROM era_attempts
     WHERE race_id IN ('canada-2014', 'hungary-2014', 'monaco-2015', 'hungary-2015', 'monaco-2016', 'great-britain-2016')
   );

DELETE FROM era_progress
WHERE race_id IN ('canada-2014', 'hungary-2014', 'monaco-2015', 'hungary-2015', 'monaco-2016', 'great-britain-2016');

DELETE FROM era_attempts
WHERE race_id IN ('canada-2014', 'hungary-2014', 'monaco-2015', 'hungary-2015', 'monaco-2016', 'great-britain-2016');

UPDATE era_races SET race_id = 'brazil-2014'
WHERE race_id = 'canada-2014' AND era_id = 7 AND position = 2;

UPDATE era_races SET race_id = 'canada-2016'
WHERE race_id = 'hungary-2014' AND era_id = 7 AND position = 3;

UPDATE era_races SET race_id = 'singapore-2014'
WHERE race_id = 'monaco-2015' AND era_id = 7 AND position = 4;

UPDATE era_races SET race_id = 'abu-dhabi-2015'
WHERE race_id = 'hungary-2015' AND era_id = 7 AND position = 5;

UPDATE era_races SET race_id = 'bahrain-2015'
WHERE race_id = 'monaco-2016' AND era_id = 7 AND position = 8;

UPDATE era_races SET race_id = 'malaysia-2015'
WHERE race_id = 'great-britain-2016' AND era_id = 7 AND position = 9;

-- Swap one more Era 3 race (owner-approved, Nov 10: hungary-1998 can't be won at Legend once the
-- Expert rival grader fix is in, so it leaves Era 3 for a winnable race; the pick is the passing
-- candidate with the lowest robust-G1 mean gap error, docs/eras-checks/b1-brazil-1999.md).
-- As in 0012-0028, the new race keeps the old one's era and position, so only the race_id
-- changes:
--   Era 3 #7   hungary-1998 -> brazil-1999
--
-- The removed race's player rows are deleted, not moved: an attempt, its stars and its history
-- book entry were earned on a different race, so none of them carries over. history_entries
-- goes first (it references era_attempts), then era_progress, then era_attempts (they
-- reference era_races), and only then is the race renamed in era_races. `published` is left
-- as it is (every race is still Draft).
-- Apply to production with the deploy that ships the new pools.json eras block, never
-- separately.

DELETE FROM history_entries
WHERE race_id = 'hungary-1998'
   OR attempt_id IN (SELECT id FROM era_attempts WHERE race_id = 'hungary-1998');

DELETE FROM era_progress WHERE race_id = 'hungary-1998';

DELETE FROM era_attempts WHERE race_id = 'hungary-1998';

UPDATE era_races SET race_id = 'brazil-1999'
WHERE race_id = 'hungary-1998' AND era_id = 3 AND position = 7;

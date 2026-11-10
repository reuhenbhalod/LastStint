-- Swap the last two failing Era 8 races (owner pre-approved, Nov 9: each failing race is
-- replaced by the next-best race by robust-G1 mean gap error;
-- docs/eras-checks/swap-races-era8-overnight.md). As in 0012-0022, each new race keeps the old
-- one's era and position, so only the race_id changes:
--   Era 8 #8   italy-2020  -> china-2017  (fails G1, 2.17 s; the new race passes, 0.78 s)
--   Era 8 #10  sakhir-2020 -> china-2018  (fails G1, 2.43 s; the new race passes, 2.26 s)
--
-- The removed races' player rows are deleted, not moved: an attempt, its stars and its history
-- book entry were earned on a different race, so none of them carries over. history_entries
-- goes first (it references era_attempts), then era_progress, then era_attempts (they
-- reference era_races), and only then is the race renamed in era_races. `published` is left
-- as it is (every race is still Draft).
-- Apply to production with the deploy that ships the new pools.json eras block, never
-- separately.

DELETE FROM history_entries
WHERE race_id IN ('italy-2020', 'sakhir-2020')
   OR attempt_id IN (
     SELECT id FROM era_attempts
     WHERE race_id IN ('italy-2020', 'sakhir-2020')
   );

DELETE FROM era_progress
WHERE race_id IN ('italy-2020', 'sakhir-2020');

DELETE FROM era_attempts
WHERE race_id IN ('italy-2020', 'sakhir-2020');

UPDATE era_races SET race_id = 'china-2017'
WHERE race_id = 'italy-2020' AND era_id = 8 AND position = 8;

UPDATE era_races SET race_id = 'china-2018'
WHERE race_id = 'sakhir-2020' AND era_id = 8 AND position = 10;

-- Swap three Eras races (owner, Nov 9; docs/eras-checks/swap-races-e10-e9.md). As in 0012,
-- each new race keeps the old one's era and position, so only the race_id changes:
--   Era 10 #1  monaco-2022       -> bahrain-2023        (fails G1: wet Monaco pace)
--   Era 9  #2  spain-2021        -> styria-2021         (fails G1: race mechanics)
--   Era 9  #9  saudi-arabia-2021 -> great-britain-2021  (fails G1: two red-flag restarts)
--
-- The removed races' player rows are deleted, not moved: an attempt, its stars and its history
-- book entry were earned on a different race, so none of them carries over. history_entries
-- goes first (it references era_attempts), then era_progress, then era_attempts (they
-- reference era_races), and only then is the race renamed in era_races. `published` is left
-- as it is (every race is still Draft).
-- Apply to production with the deploy that ships the new pools.json eras block, never
-- separately.

DELETE FROM history_entries
WHERE race_id IN ('monaco-2022', 'spain-2021', 'saudi-arabia-2021')
   OR attempt_id IN (
     SELECT id FROM era_attempts
     WHERE race_id IN ('monaco-2022', 'spain-2021', 'saudi-arabia-2021')
   );

DELETE FROM era_progress
WHERE race_id IN ('monaco-2022', 'spain-2021', 'saudi-arabia-2021');

DELETE FROM era_attempts
WHERE race_id IN ('monaco-2022', 'spain-2021', 'saudi-arabia-2021');

UPDATE era_races SET race_id = 'bahrain-2023'
WHERE race_id = 'monaco-2022' AND era_id = 10 AND position = 1;

UPDATE era_races SET race_id = 'styria-2021'
WHERE race_id = 'spain-2021' AND era_id = 9 AND position = 2;

UPDATE era_races SET race_id = 'great-britain-2021'
WHERE race_id = 'saudi-arabia-2021' AND era_id = 9 AND position = 9;

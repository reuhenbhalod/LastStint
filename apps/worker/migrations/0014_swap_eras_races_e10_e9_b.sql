-- Swap five more Eras races (owner, Nov 9, second batch; docs/eras-checks/swap-races-e10-e9-b.md).
-- As in 0012 and 0013, each new race keeps the old one's era and position, so only the
-- race_id changes:
--   Era 10 #2   great-britain-2022 -> great-britain-2023
--   Era 10 #4   singapore-2023     -> japan-2023
--   Era 10 #6   miami-2024         -> emilia-romagna-2024
--   Era 10 #10  monaco-2025        -> abu-dhabi-2022
--   Era 9  #8   brazil-2021        -> netherlands-2021
--
-- The removed races' player rows are deleted, not moved: an attempt, its stars and its history
-- book entry were earned on a different race, so none of them carries over. history_entries
-- goes first (it references era_attempts), then era_progress, then era_attempts (they
-- reference era_races), and only then is the race renamed in era_races. `published` is left
-- as it is (every race is still Draft).
-- Apply to production with the deploy that ships the new pools.json eras block, never
-- separately.

DELETE FROM history_entries
WHERE race_id IN ('great-britain-2022', 'singapore-2023', 'miami-2024', 'monaco-2025', 'brazil-2021')
   OR attempt_id IN (
     SELECT id FROM era_attempts
     WHERE race_id IN ('great-britain-2022', 'singapore-2023', 'miami-2024', 'monaco-2025', 'brazil-2021')
   );

DELETE FROM era_progress
WHERE race_id IN ('great-britain-2022', 'singapore-2023', 'miami-2024', 'monaco-2025', 'brazil-2021');

DELETE FROM era_attempts
WHERE race_id IN ('great-britain-2022', 'singapore-2023', 'miami-2024', 'monaco-2025', 'brazil-2021');

UPDATE era_races SET race_id = 'great-britain-2023'
WHERE race_id = 'great-britain-2022' AND era_id = 10 AND position = 2;

UPDATE era_races SET race_id = 'japan-2023'
WHERE race_id = 'singapore-2023' AND era_id = 10 AND position = 4;

UPDATE era_races SET race_id = 'emilia-romagna-2024'
WHERE race_id = 'miami-2024' AND era_id = 10 AND position = 6;

UPDATE era_races SET race_id = 'abu-dhabi-2022'
WHERE race_id = 'monaco-2025' AND era_id = 10 AND position = 10;

UPDATE era_races SET race_id = 'netherlands-2021'
WHERE race_id = 'brazil-2021' AND era_id = 9 AND position = 8;

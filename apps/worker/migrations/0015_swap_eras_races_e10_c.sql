-- Swap one more Eras race (owner, Nov 9, third batch; docs/eras-checks/swap-races-e10-e9-c.md).
-- As in 0012 to 0014, the new race keeps the old one's era and position, so only the race_id
-- changes:
--   Era 10 #9   australia-2025 -> saudi-arabia-2023
--
-- The removed race's player rows are deleted, not moved: an attempt, its stars and its history
-- book entry were earned on a different race, so none of them carries over. history_entries
-- goes first (it references era_attempts), then era_progress, then era_attempts (they
-- reference era_races), and only then is the race renamed in era_races. `published` is left
-- as it is (every race is still Draft).
-- Apply to production with the deploy that ships the new pools.json eras block, never
-- separately.

DELETE FROM history_entries
WHERE race_id = 'australia-2025'
   OR attempt_id IN (SELECT id FROM era_attempts WHERE race_id = 'australia-2025');

DELETE FROM era_progress WHERE race_id = 'australia-2025';

DELETE FROM era_attempts WHERE race_id = 'australia-2025';

UPDATE era_races SET race_id = 'saudi-arabia-2023'
WHERE race_id = 'australia-2025' AND era_id = 10 AND position = 9;

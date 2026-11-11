-- Swap one more Era 3 race (owner pre-approved, Nov 9: each failing race is replaced by the
-- next-best race by robust-G1 stats; docs/eras-checks/swap-races-era3-overnight.md).
-- As in 0012-0022, the new race keeps the old one's era and position, so only the race_id
-- changes:
--   Era 3 #5   hungary-1997 -> luxembourg-1998
--
-- The removed race's player rows are deleted, not moved: an attempt, its stars and its history
-- book entry were earned on a different race, so none of them carries over. history_entries
-- goes first (it references era_attempts), then era_progress, then era_attempts (they
-- reference era_races), and only then is the race renamed in era_races. `published` is left
-- as it is (every race is still Draft).
-- Apply to production with the deploy that ships the new pools.json eras block, never
-- separately.

DELETE FROM history_entries
WHERE race_id = 'hungary-1997'
   OR attempt_id IN (SELECT id FROM era_attempts WHERE race_id = 'hungary-1997');

DELETE FROM era_progress WHERE race_id = 'hungary-1997';

DELETE FROM era_attempts WHERE race_id = 'hungary-1997';

UPDATE era_races SET race_id = 'luxembourg-1998'
WHERE race_id = 'hungary-1997' AND era_id = 3 AND position = 5;

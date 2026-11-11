-- Swap three Era 3 races (owner pre-approved, Nov 9: each failing race is replaced by the
-- next-best race by robust-G1 stats; docs/eras-checks/swap-races-era3-overnight.md).
-- As in 0012-0014, each new race keeps the old one's era and position, so only the race_id
-- changes:
--   Era 3 #8   belgium-1998  -> germany-1996
--   Era 3 #9   malaysia-1999 -> germany-1997
--   Era 3 #10  europe-1999   -> san-marino-1999
-- hungary-1997 (Era 3 #5) stays: it was the fourth-worst and there were three picks.
--
-- The removed races' player rows are deleted, not moved: an attempt, its stars and its history
-- book entry were earned on a different race, so none of them carries over. history_entries
-- goes first (it references era_attempts), then era_progress, then era_attempts (they
-- reference era_races), and only then is the race renamed in era_races. `published` is left
-- as it is (every race is still Draft).
-- Apply to production with the deploy that ships the new pools.json eras block, never
-- separately.

DELETE FROM history_entries
WHERE race_id IN ('belgium-1998', 'malaysia-1999', 'europe-1999')
   OR attempt_id IN (
     SELECT id FROM era_attempts
     WHERE race_id IN ('belgium-1998', 'malaysia-1999', 'europe-1999')
   );

DELETE FROM era_progress
WHERE race_id IN ('belgium-1998', 'malaysia-1999', 'europe-1999');

DELETE FROM era_attempts
WHERE race_id IN ('belgium-1998', 'malaysia-1999', 'europe-1999');

UPDATE era_races SET race_id = 'germany-1996'
WHERE race_id = 'belgium-1998' AND era_id = 3 AND position = 8;

UPDATE era_races SET race_id = 'germany-1997'
WHERE race_id = 'malaysia-1999' AND era_id = 3 AND position = 9;

UPDATE era_races SET race_id = 'san-marino-1999'
WHERE race_id = 'europe-1999' AND era_id = 3 AND position = 10;

-- Swap an Era 9 race (owner, Nov 9, pre-approved swaps picked by robust-G1 mean gap error;
-- docs/eras-checks/swap-races-era9-overnight.md). As in 0012-0014, the new race keeps the old
-- one's era and position, so only the race_id changes:
--   Era 9  #5   hungary-2021 -> portugal-2021
--
-- portugal-2021 is a Gauntlet (survivor) race, so it becomes a shared race: its race file stays
-- the Gauntlet one and its Eras content lives in data/eras/portugal-2021.json (eras build plan,
-- "Shared races"). Nothing here touches Gauntlet tables.
--
-- The removed race's player rows are deleted, not moved: an attempt, its stars and its history
-- book entry were earned on a different race, so none of them carries over. history_entries
-- goes first (it references era_attempts), then era_progress, then era_attempts (they
-- reference era_races), and only then is the race renamed in era_races. `published` is left
-- as it is (every race is still Draft).
-- Apply to production with the deploy that ships the new pools.json eras block, never
-- separately.

DELETE FROM history_entries
WHERE race_id IN ('hungary-2021')
   OR attempt_id IN (
     SELECT id FROM era_attempts
     WHERE race_id IN ('hungary-2021')
   );

DELETE FROM era_progress
WHERE race_id IN ('hungary-2021');

DELETE FROM era_attempts
WHERE race_id IN ('hungary-2021');

UPDATE era_races SET race_id = 'portugal-2021'
WHERE race_id = 'hungary-2021' AND era_id = 9 AND position = 5;

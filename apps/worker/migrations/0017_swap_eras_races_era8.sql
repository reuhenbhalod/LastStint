-- Swap three Era 8 races (owner pre-approved, Nov 9: each failing race out for the next-best
-- race by robust-G1 mean gap error; docs/eras-checks/swap-races-era8-overnight.md). As in
-- 0012-0014, each new race keeps the old one's era and position, so only the race_id changes:
--   Era 8 #1  monaco-2017     -> australia-2017  (fails G1, 2.98 s; the new race passes, 2.11 s)
--   Era 8 #2  azerbaijan-2017 -> australia-2018  (fails G1, 5.85 s; the new race passes, 1.06 s)
--   Era 8 #4  russia-2018     -> spain-2017      (fails G1, 2.46 s; the new race passes, 2.57 s)
-- italy-2020 and sakhir-2020 also fail G1 and stay until their replacements are chosen.
--
-- The removed races' player rows are deleted, not moved: an attempt, its stars and its history
-- book entry were earned on a different race, so none of them carries over. history_entries
-- goes first (it references era_attempts), then era_progress, then era_attempts (they
-- reference era_races), and only then is the race renamed in era_races. `published` is left
-- as it is (every race is still Draft).
-- Apply to production with the deploy that ships the new pools.json eras block, never
-- separately.

DELETE FROM history_entries
WHERE race_id IN ('monaco-2017', 'azerbaijan-2017', 'russia-2018')
   OR attempt_id IN (
     SELECT id FROM era_attempts
     WHERE race_id IN ('monaco-2017', 'azerbaijan-2017', 'russia-2018')
   );

DELETE FROM era_progress
WHERE race_id IN ('monaco-2017', 'azerbaijan-2017', 'russia-2018');

DELETE FROM era_attempts
WHERE race_id IN ('monaco-2017', 'azerbaijan-2017', 'russia-2018');

UPDATE era_races SET race_id = 'australia-2017'
WHERE race_id = 'monaco-2017' AND era_id = 8 AND position = 1;

UPDATE era_races SET race_id = 'australia-2018'
WHERE race_id = 'azerbaijan-2017' AND era_id = 8 AND position = 2;

UPDATE era_races SET race_id = 'spain-2017'
WHERE race_id = 'russia-2018' AND era_id = 8 AND position = 4;

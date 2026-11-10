-- Swap seven Era 4 races (owner pre-approved, Nov 9: each failing race for the next-best race by
-- robust G1; docs/eras-checks/swap-races-era4-overnight.md). As in 0012-0014, each new race keeps
-- the old one's era and position, so only the race_id changes:
--   Era 4 #1   germany-2000       -> canada-2003      (fails G1: 5.81 s)
--   Era 4 #3   malaysia-2001      -> san-marino-2000  (fails G1: 7.04 s)
--   Era 4 #5   brazil-2003        -> hungary-2001     (fails G1: 5.55 s)
--   Era 4 #6   hungary-2003       -> austria-2001     (fails G1: 7.08 s)
--   Era 4 #7   united-states-2003 -> france-2001      (fails G1: 10.25 s)
--   Era 4 #8   japan-2003         -> italy-2001       (fails G1: 4.05 s)
--   Era 4 #10  monaco-2004        -> san-marino-2003  (fails G1: 4.61 s)
--
-- The removed races' player rows are deleted, not moved: an attempt, its stars and its history
-- book entry were earned on a different race, so none of them carries over. history_entries
-- goes first (it references era_attempts), then era_progress, then era_attempts (they
-- reference era_races), and only then is the race renamed in era_races. `published` is left
-- as it is (every race is still Draft).
-- Apply to production with the deploy that ships the new pools.json eras block, never
-- separately.

DELETE FROM history_entries
WHERE race_id IN ('germany-2000', 'malaysia-2001', 'brazil-2003', 'hungary-2003', 'united-states-2003', 'japan-2003', 'monaco-2004')
   OR attempt_id IN (
     SELECT id FROM era_attempts
     WHERE race_id IN ('germany-2000', 'malaysia-2001', 'brazil-2003', 'hungary-2003', 'united-states-2003', 'japan-2003', 'monaco-2004')
   );

DELETE FROM era_progress
WHERE race_id IN ('germany-2000', 'malaysia-2001', 'brazil-2003', 'hungary-2003', 'united-states-2003', 'japan-2003', 'monaco-2004');

DELETE FROM era_attempts
WHERE race_id IN ('germany-2000', 'malaysia-2001', 'brazil-2003', 'hungary-2003', 'united-states-2003', 'japan-2003', 'monaco-2004');

UPDATE era_races SET race_id = 'canada-2003'
WHERE race_id = 'germany-2000' AND era_id = 4 AND position = 1;

UPDATE era_races SET race_id = 'san-marino-2000'
WHERE race_id = 'malaysia-2001' AND era_id = 4 AND position = 3;

UPDATE era_races SET race_id = 'hungary-2001'
WHERE race_id = 'brazil-2003' AND era_id = 4 AND position = 5;

UPDATE era_races SET race_id = 'austria-2001'
WHERE race_id = 'hungary-2003' AND era_id = 4 AND position = 6;

UPDATE era_races SET race_id = 'france-2001'
WHERE race_id = 'united-states-2003' AND era_id = 4 AND position = 7;

UPDATE era_races SET race_id = 'italy-2001'
WHERE race_id = 'japan-2003' AND era_id = 4 AND position = 8;

UPDATE era_races SET race_id = 'san-marino-2003'
WHERE race_id = 'monaco-2004' AND era_id = 4 AND position = 10;

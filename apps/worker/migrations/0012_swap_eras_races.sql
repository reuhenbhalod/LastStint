-- Swap four Eras races (owner, Nov 7; docs/eras-checks/swap-races.md). Each new race keeps the
-- old one's era and position, so only the race_id changes:
--   Era 10 #8  brazil-2024     -> belgium-2023        (wet all race: can't be built)
--   Era 7  #9  brazil-2016     -> great-britain-2016  (wet all race: can't be built)
--   Era 2  #1  japan-1989      -> france-1990         (Senna disqualified: no road gap)
--   Era 1  #4  san-marino-1985 -> germany-1986        (Prost disqualified: no road gap)
--
-- The removed races' player rows are deleted, not moved: an attempt, its stars and its history
-- book entry were earned on a different race, so none of them carries over. history_entries
-- goes first (it references era_attempts), then era_progress, then era_attempts (they
-- reference era_races), and only then is the race renamed in era_races. `published` is left
-- as it is (every race is still Draft).
-- Apply to production with the deploy that ships the new pools.json eras block, never
-- separately.

DELETE FROM history_entries
WHERE race_id IN ('brazil-2024', 'brazil-2016', 'japan-1989', 'san-marino-1985')
   OR attempt_id IN (
     SELECT id FROM era_attempts
     WHERE race_id IN ('brazil-2024', 'brazil-2016', 'japan-1989', 'san-marino-1985')
   );

DELETE FROM era_progress
WHERE race_id IN ('brazil-2024', 'brazil-2016', 'japan-1989', 'san-marino-1985');

DELETE FROM era_attempts
WHERE race_id IN ('brazil-2024', 'brazil-2016', 'japan-1989', 'san-marino-1985');

UPDATE era_races SET race_id = 'belgium-2023'
WHERE race_id = 'brazil-2024' AND era_id = 10 AND position = 8;

UPDATE era_races SET race_id = 'great-britain-2016'
WHERE race_id = 'brazil-2016' AND era_id = 7 AND position = 9;

UPDATE era_races SET race_id = 'france-1990'
WHERE race_id = 'japan-1989' AND era_id = 2 AND position = 1;

UPDATE era_races SET race_id = 'germany-1986'
WHERE race_id = 'san-marino-1985' AND era_id = 1 AND position = 4;

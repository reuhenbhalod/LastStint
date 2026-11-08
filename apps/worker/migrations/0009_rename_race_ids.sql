-- Rename the race IDs that broke the `<event-slug>-<year>` rule (Eras build plan 0.1):
-- usa-<year> -> united-states-<year>, saudi-2022 -> saudi-arabia-2022. The ID is inside the
-- race file, so the rename changes the file's model hash, and a scheduled day or survivor
-- round pins the hash it was given (runs.ts and survivor.ts reject a mismatch). A row that
-- pinned the old file's hash moves to the renamed file's hash; a row that pinned some older
-- build keeps its hash, so it stays as stale as it was. Hashes from apps/worker/src/hash.ts
-- (modelHash) on the race file before and after the rename.
-- Apply to production with the deploy that ships the rename, never separately.

UPDATE daily SET
  model_hash = CASE model_hash
    WHEN 'af6f2427706baf6cafb84687932dd5477df0eb662f24569bc8a089e36305664d'
      THEN '4c5d3267c8c6640bfa25a64439b21daf150cae1e0fec35bf27009e480a9b7cf5'
    ELSE model_hash END,
  race_id = 'united-states-2018'
WHERE race_id = 'usa-2018';

UPDATE daily SET
  model_hash = CASE model_hash
    WHEN '5d7f22db092d310141592f9daef0490e819c04da33e407eaaf677df14ca54b9b'
      THEN '039cb2d358d95e88e6b98105589968ad4b8c2c3bd39f4e8aade33ad1e5d30f98'
    ELSE model_hash END,
  race_id = 'united-states-2021'
WHERE race_id = 'usa-2021';

UPDATE daily SET
  model_hash = CASE model_hash
    WHEN 'f7b20823884faf1d1f3cfe9695bb1582e7363b96a08799ee98e578bcc79936ec'
      THEN '763e4449486a8ca62e5526578e3662085853249f2af782bb8b21e481b8b124f7'
    ELSE model_hash END,
  race_id = 'united-states-2022'
WHERE race_id = 'usa-2022';

UPDATE daily SET
  model_hash = CASE model_hash
    WHEN 'b5d4cb7b3defaacc2b4456cd75645b3b305b430fa7f640d763a10f3a339dfa42'
      THEN 'ece9fc634478c4d178713a720938b73378337c7fd8e57ab2eea7c618e040a2e9'
    ELSE model_hash END,
  race_id = 'saudi-arabia-2022'
WHERE race_id = 'saudi-2022';

UPDATE survivor_rounds SET
  model_hash = CASE model_hash
    WHEN 'af6f2427706baf6cafb84687932dd5477df0eb662f24569bc8a089e36305664d'
      THEN '4c5d3267c8c6640bfa25a64439b21daf150cae1e0fec35bf27009e480a9b7cf5'
    ELSE model_hash END,
  race_id = 'united-states-2018'
WHERE race_id = 'usa-2018';

UPDATE survivor_rounds SET
  model_hash = CASE model_hash
    WHEN '5d7f22db092d310141592f9daef0490e819c04da33e407eaaf677df14ca54b9b'
      THEN '039cb2d358d95e88e6b98105589968ad4b8c2c3bd39f4e8aade33ad1e5d30f98'
    ELSE model_hash END,
  race_id = 'united-states-2021'
WHERE race_id = 'usa-2021';

UPDATE survivor_rounds SET
  model_hash = CASE model_hash
    WHEN 'f7b20823884faf1d1f3cfe9695bb1582e7363b96a08799ee98e578bcc79936ec'
      THEN '763e4449486a8ca62e5526578e3662085853249f2af782bb8b21e481b8b124f7'
    ELSE model_hash END,
  race_id = 'united-states-2022'
WHERE race_id = 'usa-2022';

UPDATE survivor_rounds SET
  model_hash = CASE model_hash
    WHEN 'b5d4cb7b3defaacc2b4456cd75645b3b305b430fa7f640d763a10f3a339dfa42'
      THEN 'ece9fc634478c4d178713a720938b73378337c7fd8e57ab2eea7c618e040a2e9'
    ELSE model_hash END,
  race_id = 'saudi-arabia-2022'
WHERE race_id = 'saudi-2022';

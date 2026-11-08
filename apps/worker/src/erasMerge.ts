// Eras account merge (Eras spec §10, build plan 7.5). When an anonymous browser signs in, its
// Eras progress moves to the account's player ID: per (race, legend) the best of each star
// and of the hidden objective, the best accuracy and the latest update; every history book
// entry (the earlier one wins when both have the race); and its attempts. The statements run
// in sign-in's own batch (one transaction), and a second sign-in finds nothing left to move.
//
// An anonId already linked to another account (a shared browser, or the ID another account
// was made from) is that account's: its rows are never moved. Daily and Gauntlet runs keep
// their anon_id and are untouched (the account's runs are found through player_ids).

/** Moves `from`'s rows only while it belongs to no account but `to` (binds ?1 = from, ?2 = to). */
const OWNED_BY_NO_OTHER = `NOT EXISTS (
  SELECT 1 FROM player_ids WHERE anon_id = ?1 AND player_id != ?2
  UNION ALL SELECT 1 FROM players WHERE id = ?1 AND id != ?2)`;

/** max() that ignores a NULL side (SQLite's multi-argument max() returns NULL). */
const maxOf = (a: string, b: string) => `max(coalesce(${a}, ${b}), coalesce(${b}, ${a}))`;

/**
 * The statements that merge anonId `from`'s Eras progress into player `to`. None when they are
 * the same player. Run them in a batch, before the sign-in links `from` to `to`.
 */
export function erasMergeStatements(
  db: D1Database,
  from: string,
  to: string,
): D1PreparedStatement[] {
  if (from === to) return [];
  const sql = [
    // Progress: OR the stars and hidden objective, max the accuracy, keep the latest update.
    `INSERT INTO era_progress (player_id, race_id, legend, star_result, star_strategist,
       star_mastery, hidden_done, best_accuracy, updated_at)
     SELECT ?2, race_id, legend, star_result, star_strategist, star_mastery, hidden_done,
       best_accuracy, updated_at
     FROM era_progress WHERE player_id = ?1 AND ${OWNED_BY_NO_OTHER}
     ON CONFLICT (player_id, race_id, legend) DO UPDATE SET
       star_result     = max(star_result, excluded.star_result),
       star_strategist = max(star_strategist, excluded.star_strategist),
       star_mastery    = max(star_mastery, excluded.star_mastery),
       hidden_done     = max(hidden_done, excluded.hidden_done),
       best_accuracy   = ${maxOf('best_accuracy', 'excluded.best_accuracy')},
       updated_at      = max(updated_at, excluded.updated_at)`,
    `DELETE FROM era_progress WHERE player_id = ?1 AND ${OWNED_BY_NO_OTHER}`,
    // History book: every entry; on a clash the earlier achievement (and its attempt) stays.
    // (SQLite evaluates every SET expression against the row before the update.)
    `INSERT INTO history_entries (player_id, race_id, attempt_id, achieved_at)
     SELECT ?2, race_id, attempt_id, achieved_at
     FROM history_entries WHERE player_id = ?1 AND ${OWNED_BY_NO_OTHER}
     ON CONFLICT (player_id, race_id) DO UPDATE SET
       attempt_id  = CASE WHEN excluded.achieved_at < achieved_at
                          THEN excluded.attempt_id ELSE attempt_id END,
       achieved_at = min(achieved_at, excluded.achieved_at)`,
    `DELETE FROM history_entries WHERE player_id = ?1 AND ${OWNED_BY_NO_OTHER}`,
    // Attempts: all of them, so leaderboards and the history book's links follow the account.
    `UPDATE era_attempts SET player_id = ?2 WHERE player_id = ?1 AND ${OWNED_BY_NO_OTHER}`,
  ];
  return sql.map((s) => db.prepare(s).bind(from, to));
}

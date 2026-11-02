-- Accounts and streaks (docs/feedback-round-1-spec.md D3). Signing in with Google links the
-- browser's anonId to an account. The account's player ID is the anonId it was created from;
-- every signed-in browser adopts it, so one run per day and the streak follow the account.
-- Runs keep their anon_id: an account's runs are those of every anonId linked to it.

CREATE TABLE players (
  id          TEXT PRIMARY KEY,      -- the account's player ID (an anonId)
  google_sub  TEXT NOT NULL UNIQUE,  -- Google's stable account ID
  email       TEXT NOT NULL DEFAULT '',
  name        TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL
);

CREATE TABLE player_ids (
  anon_id    TEXT PRIMARY KEY,
  player_id  TEXT NOT NULL REFERENCES players(id),
  linked_at  TEXT NOT NULL
);

CREATE INDEX player_ids_player ON player_ids (player_id);

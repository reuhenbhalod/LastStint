-- Auth0 sign-in and the player profile (docs/auth0-spec.md). The account key is no longer
-- only Google's: a Google sign-in (direct or through Auth0) keeps the bare Google ID, so old
-- accounts are found again; an email-and-password one keeps Auth0's `auth0|...`. The display
-- name shows on the leaderboards (unique, ignoring case); the favourite team themes the home
-- page. Both '' until the player sets them.
ALTER TABLE players RENAME COLUMN google_sub TO account_sub;
ALTER TABLE players ADD COLUMN display_name TEXT NOT NULL DEFAULT '';
ALTER TABLE players ADD COLUMN favourite_team TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX players_display_name ON players (lower(display_name)) WHERE display_name != '';

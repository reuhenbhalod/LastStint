-- Who's working a ticket (src/tickets.ts): an admin's email (one of ADMIN_EMAILS, checked by the
-- API), or '' when nobody has picked it up.
ALTER TABLE tickets ADD COLUMN assignee TEXT NOT NULL DEFAULT '';

CREATE INDEX tickets_assignee ON tickets (assignee);

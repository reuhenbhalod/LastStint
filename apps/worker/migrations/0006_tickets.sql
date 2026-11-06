-- Game-change tickets (src/tickets.ts, the admin page's Tickets tab). Times are Unix
-- milliseconds. created_by is the admin's email (seeded tickets have ''). completed_at is set
-- when status becomes 'done' and cleared when it leaves 'done'.
CREATE TABLE tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL CHECK (category IN ('bug', 'feature', 'ui', 'content', 'question', 'other')),
  status TEXT NOT NULL CHECK (status IN ('open', 'in_progress', 'done')) DEFAULT 'open',
  notes TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  completed_at INTEGER
);

CREATE INDEX tickets_status ON tickets (status);
CREATE INDEX tickets_category ON tickets (category);

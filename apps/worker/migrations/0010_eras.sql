-- Eras mode (docs/laststint-eras-mode-spec.md §12): the ten eras, their 100 races, and the
-- players' attempts, progress and history book entries. Seeds the eras (names and play order
-- from spec §4: Era 10 is play order 1, newest first) and the races (IDs and positions from
-- §4's tables; also listed in data/pools.json under eras). Every race starts as Draft
-- (published = 0) and every era unreleased (released_at NULL): production releases an era by
-- setting released_at, once all ten of its races are published (spec §16).

CREATE TABLE eras (
  id          INTEGER PRIMARY KEY,            -- 1..10
  name        TEXT NOT NULL,
  years       TEXT NOT NULL,                  -- "2022–2025"
  play_order  INTEGER NOT NULL UNIQUE,        -- Era 10 = 1 (newest first)
  released_at TEXT                            -- NULL = coming soon in production; ignored on test
);

CREATE TABLE era_races (
  race_id   TEXT PRIMARY KEY,                 -- "abu-dhabi-2021"
  era_id    INTEGER NOT NULL REFERENCES eras(id),
  position  INTEGER NOT NULL,                 -- 1..10 within the era
  published INTEGER NOT NULL DEFAULT 0,       -- 0 = Draft: playable on test only
  UNIQUE (era_id, position)
);

CREATE TABLE era_attempts (
  id           TEXT PRIMARY KEY,
  player_id    TEXT NOT NULL,
  race_id      TEXT NOT NULL REFERENCES era_races(race_id),
  legend       INTEGER NOT NULL DEFAULT 0,
  seed         INTEGER NOT NULL,
  decisions    TEXT,                          -- JSON, NULL until submitted
  accuracy     REAL,
  result       TEXT,                          -- JSON: finish, grades, objectives met
  untimed      INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  submitted_at TEXT
);

CREATE TABLE era_progress (
  player_id       TEXT NOT NULL,
  race_id         TEXT NOT NULL,
  legend          INTEGER NOT NULL DEFAULT 0,
  star_result     INTEGER NOT NULL DEFAULT 0,
  star_strategist INTEGER NOT NULL DEFAULT 0,
  star_mastery    INTEGER NOT NULL DEFAULT 0,
  hidden_done     INTEGER NOT NULL DEFAULT 0,
  best_accuracy   REAL,
  updated_at      TEXT NOT NULL,
  PRIMARY KEY (player_id, race_id, legend)
);

CREATE TABLE history_entries (
  player_id   TEXT NOT NULL,
  race_id     TEXT NOT NULL,
  attempt_id  TEXT NOT NULL REFERENCES era_attempts(id),
  achieved_at TEXT NOT NULL,
  PRIMARY KEY (player_id, race_id)
);

CREATE INDEX era_attempts_race_accuracy ON era_attempts (race_id, legend, accuracy);

INSERT INTO eras (id, name, years, play_order) VALUES
  (10, 'Ground-effect era', '2022–2025', 1),
  (9, 'The 2021 title fight', '2021', 2),
  (8, 'Mercedes vs Ferrari', '2017–2020', 3),
  (7, 'Hybrid turbo', '2014–2016', 4),
  (6, 'Fast-wearing tyres', '2010–2013', 5),
  (5, 'Alonso, Räikkönen, Hamilton', '2005–2009', 6),
  (4, 'Ferrari dynasty', '2000–2004', 7),
  (3, 'Refuelling returns', '1994–1999', 8),
  (2, 'Senna vs Prost', '1989–1993', 9),
  (1, 'Turbo era', '1983–1988', 10);

INSERT INTO era_races (race_id, era_id, position) VALUES
  ('monaco-2022', 10, 1),
  ('great-britain-2022', 10, 2),
  ('hungary-2022', 10, 3),
  ('singapore-2023', 10, 4),
  ('netherlands-2023', 10, 5),
  ('miami-2024', 10, 6),
  ('hungary-2024', 10, 7),
  ('brazil-2024', 10, 8),
  ('australia-2025', 10, 9),
  ('monaco-2025', 10, 10),
  ('bahrain-2021', 9, 1),
  ('spain-2021', 9, 2),
  ('azerbaijan-2021', 9, 3),
  ('france-2021', 9, 4),
  ('hungary-2021', 9, 5),
  ('russia-2021', 9, 6),
  ('turkey-2021', 9, 7),
  ('brazil-2021', 9, 8),
  ('saudi-arabia-2021', 9, 9),
  ('abu-dhabi-2021', 9, 10),
  ('monaco-2017', 8, 1),
  ('azerbaijan-2017', 8, 2),
  ('germany-2018', 8, 3),
  ('russia-2018', 8, 4),
  ('germany-2019', 8, 5),
  ('hungary-2019', 8, 6),
  ('brazil-2019', 8, 7),
  ('italy-2020', 8, 8),
  ('turkey-2020', 8, 9),
  ('sakhir-2020', 8, 10),
  ('bahrain-2014', 7, 1),
  ('canada-2014', 7, 2),
  ('hungary-2014', 7, 3),
  ('monaco-2015', 7, 4),
  ('hungary-2015', 7, 5),
  ('united-states-2015', 7, 6),
  ('spain-2016', 7, 7),
  ('monaco-2016', 7, 8),
  ('brazil-2016', 7, 9),
  ('abu-dhabi-2016', 7, 10),
  ('australia-2010', 6, 1),
  ('abu-dhabi-2010', 6, 2),
  ('china-2011', 6, 3),
  ('monaco-2011', 6, 4),
  ('canada-2011', 6, 5),
  ('europe-2012', 6, 6),
  ('abu-dhabi-2012', 6, 7),
  ('brazil-2012', 6, 8),
  ('malaysia-2013', 6, 9),
  ('spain-2013', 6, 10),
  ('san-marino-2005', 5, 1),
  ('japan-2005', 5, 2),
  ('hungary-2006', 5, 3),
  ('brazil-2006', 5, 4),
  ('china-2007', 5, 5),
  ('europe-2007', 5, 6),
  ('brazil-2007', 5, 7),
  ('monaco-2008', 5, 8),
  ('brazil-2008', 5, 9),
  ('brazil-2009', 5, 10),
  ('germany-2000', 4, 1),
  ('japan-2000', 4, 2),
  ('malaysia-2001', 4, 3),
  ('austria-2002', 4, 4),
  ('brazil-2003', 4, 5),
  ('hungary-2003', 4, 6),
  ('united-states-2003', 4, 7),
  ('japan-2003', 4, 8),
  ('france-2004', 4, 9),
  ('monaco-2004', 4, 10),
  ('spain-1994', 3, 1),
  ('australia-1994', 3, 2),
  ('belgium-1995', 3, 3),
  ('spain-1996', 3, 4),
  ('hungary-1997', 3, 5),
  ('europe-1997', 3, 6),
  ('hungary-1998', 3, 7),
  ('belgium-1998', 3, 8),
  ('malaysia-1999', 3, 9),
  ('europe-1999', 3, 10),
  ('japan-1989', 2, 1),
  ('united-states-1990', 2, 2),
  ('mexico-1990', 2, 3),
  ('brazil-1991', 2, 4),
  ('monaco-1992', 2, 5),
  ('belgium-1992', 2, 6),
  ('hungary-1992', 2, 7),
  ('brazil-1993', 2, 8),
  ('europe-1993', 2, 9),
  ('australia-1993', 2, 10),
  ('south-africa-1983', 1, 1),
  ('monaco-1984', 1, 2),
  ('portugal-1984', 1, 3),
  ('san-marino-1985', 1, 4),
  ('portugal-1985', 1, 5),
  ('mexico-1986', 1, 6),
  ('hungary-1986', 1, 7),
  ('australia-1986', 1, 8),
  ('great-britain-1987', 1, 9),
  ('monaco-1988', 1, 10);

DROP TABLE IF EXISTS matches;
DROP TABLE IF EXISTS teams;
DROP TABLE IF EXISTS tournament_settings;

CREATE TABLE teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  group_name TEXT NOT NULL,
  points INTEGER DEFAULT 0
);

CREATE TABLE matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team1_id INTEGER,
  team2_id INTEGER,
  placeholder_team1 TEXT,
  placeholder_team2 TEXT,
  score1 INTEGER DEFAULT 0,
  score2 INTEGER DEFAULT 0,
  status TEXT DEFAULT 'scheduled',
  phase TEXT DEFAULT 'groups',
  round TEXT,
  start_time TEXT,
  court TEXT,
  FOREIGN KEY(team1_id) REFERENCES teams(id),
  FOREIGN KEY(team2_id) REFERENCES teams(id)
);

-- Inseriamo qualche squadra di test per far vedere che funziona
INSERT INTO teams (name, group_name, points) VALUES ('Lupi Solitari', 'A', 3);
INSERT INTO teams (name, group_name, points) VALUES ('Aquile Reali', 'A', 0);
INSERT INTO teams (name, group_name, points) VALUES ('Pantere Nere', 'B', 1);
INSERT INTO teams (name, group_name, points) VALUES ('Falchi', 'B', 2);

CREATE TABLE tournament_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL
);

INSERT INTO tournament_settings (setting_key, setting_value) VALUES ('format', 'gironi');
INSERT INTO tournament_settings (setting_key, setting_value) VALUES ('has_return_matches', 'false');
INSERT INTO tournament_settings (setting_key, setting_value) VALUES ('status', 'registration');
INSERT INTO tournament_settings (setting_key, setting_value) VALUES ('courts_count', '2');
INSERT INTO tournament_settings (setting_key, setting_value) VALUES ('match_duration_minutes', '40');
INSERT INTO tournament_settings (setting_key, setting_value) VALUES ('break_between_matches_minutes', '5');
INSERT INTO tournament_settings (setting_key, setting_value) VALUES ('start_date_time', '2026-06-01T09:00');

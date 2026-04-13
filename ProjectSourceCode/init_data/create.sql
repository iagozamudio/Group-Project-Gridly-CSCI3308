CREATE TABLE IF NOT EXISTS users (
  username VARCHAR(50) PRIMARY KEY,
  password VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS security_questions (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  question VARCHAR(255) NOT NULL,
  answer VARCHAR(255) NOT NULL,
  CONSTRAINT fk_user FOREIGN KEY(username) REFERENCES users(username) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS game_sessions (
  session_id SERIAL PRIMARY KEY,
  username   VARCHAR(50) REFERENCES users(username) ON DELETE SET NULL,  -- nullable until auth lands
  time_seconds INT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


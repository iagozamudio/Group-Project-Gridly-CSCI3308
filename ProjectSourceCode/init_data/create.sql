CREATE TABLE IF NOT EXISTS users (
  username VARCHAR(50) PRIMARY KEY,
  password VARCHAR(255) NOT NULL,
  rating INTEGER NOT NULL DEFAULT 1000
);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS profile_image VARCHAR(255);

ALTER TABLE users
ALTER COLUMN profile_image
SET DEFAULT 'https://cdn.pixabay.com/photo/2017/06/13/12/54/profile-2398783_1280.png';

UPDATE users
SET profile_image = 'https://cdn.pixabay.com/photo/2017/06/13/12/54/profile-2398783_1280.png'
WHERE profile_image IS NULL;

CREATE TABLE IF NOT EXISTS security_questions (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  question VARCHAR(255) NOT NULL,
  answer VARCHAR(255) NOT NULL,
  CONSTRAINT fk_user FOREIGN KEY(username) REFERENCES users(username) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS game_sessions (
  session_id   SERIAL PRIMARY KEY,
  username     VARCHAR(50) REFERENCES users(username) ON DELETE SET NULL,
  puzzle_data  JSONB NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ DEFAULT NULL,
  time_seconds INTEGER DEFAULT 0,
  score INTEGER DEFAULT 0,
  twoplayer BOOLEAN DEFAULT FALSE,
  opponent VARCHAR(50) REFERENCES users(username) ON DELETE SET NULL
);
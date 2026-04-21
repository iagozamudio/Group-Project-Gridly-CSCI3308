
-- ================= USERS TABLE =================
CREATE TABLE IF NOT EXISTS users (
  username VARCHAR(50) PRIMARY KEY,
  password VARCHAR(255) NOT NULL,
  rating INTEGER NOT NULL DEFAULT 1000
);

-- Profile image column (optional with default)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS profile_image VARCHAR(255);

ALTER TABLE users
ALTER COLUMN profile_image
SET DEFAULT 'https://cdn.pixabay.com/photo/2017/06/13/12/54/profile-2398783_1280.png';

UPDATE users
SET profile_image = 'https://cdn.pixabay.com/photo/2017/06/13/12/54/profile-2398783_1280.png'
WHERE profile_image IS NULL;

-- Display name column (optional with default to username)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS display_name VARCHAR(50);

UPDATE users 
SET display_name = username
WHERE display_name IS NULL;

-- ================= SECURITY QUESTIONS =================
CREATE TABLE IF NOT EXISTS security_questions (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  question VARCHAR(255) NOT NULL,
  answer VARCHAR(255) NOT NULL,
  CONSTRAINT fk_user FOREIGN KEY(username)
    REFERENCES users(username)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);


-- ================= SINGLE PLAYER SESSIONS =================
CREATE TABLE IF NOT EXISTS game_sessions (
  session_id   SERIAL PRIMARY KEY,
  match_id VARCHAR(50),
  username     VARCHAR(50),
  puzzle_data  JSONB NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ DEFAULT NULL,
  time_seconds INTEGER DEFAULT 0,
  score INTEGER DEFAULT 0,
  twoplayer BOOLEAN DEFAULT FALSE,
  opponent VARCHAR(50) REFERENCES users(username) ON DELETE SET NULL,
  CONSTRAINT fk_game_sessions_user FOREIGN KEY(username)
    REFERENCES users(username)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
    CONSTRAINT fk_game_sessions_opponent FOREIGN KEY (opponent)
    REFERENCES users(username)
    ON DELETE SET NULL
    ON UPDATE CASCADE
);

-- ================= INDEXES =================
CREATE INDEX IF NOT EXISTS idx_gs_username          ON game_sessions(username);
CREATE INDEX IF NOT EXISTS idx_gs_time              ON game_sessions(time_seconds);
CREATE INDEX IF NOT EXISTS idx_gs_match_id ON game_sessions(match_id);



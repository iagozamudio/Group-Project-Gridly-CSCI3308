
-- ================= USERS TABLE =================
CREATE TABLE IF NOT EXISTS users (
  username VARCHAR(50) PRIMARY KEY,
  password VARCHAR(255) NOT NULL
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
  username     VARCHAR(50),
  time_seconds INT NOT NULL,
  expected_time  INT,
  hints_used     INT DEFAULT 0,
  bad_checks     INT DEFAULT 0,
  completion     DECIMAL(5,4) DEFAULT 0,
  puzzle_score   DECIMAL(10,2) DEFAULT 0,
  puzzle_data  JSONB,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_game_sessions_user FOREIGN KEY(username)
    REFERENCES users(username)
    ON DELETE SET NULL
    ON UPDATE CASCADE
);


-- ================= TWO PLAYER SESSIONS =================
CREATE TABLE IF NOT EXISTS two_player_sessions (
  tp_session_id SERIAL PRIMARY KEY,
  game_id       VARCHAR(64) NOT NULL,
  username      VARCHAR(50),
  time_seconds  INT NOT NULL,
  is_winner     BOOLEAN NOT NULL DEFAULT FALSE,
  score         INT NOT NULL,
  completed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_two_player_sessions_user FOREIGN KEY(username)
    REFERENCES users(username)
    ON DELETE SET NULL
    ON UPDATE CASCADE
);


-- ================= INDEXES =================
CREATE INDEX IF NOT EXISTS idx_tp_sessions_game_id  ON two_player_sessions(game_id);
CREATE INDEX IF NOT EXISTS idx_tp_sessions_username ON two_player_sessions(username);
CREATE INDEX IF NOT EXISTS idx_gs_username          ON game_sessions(username);
CREATE INDEX IF NOT EXISTS idx_gs_time              ON game_sessions(time_seconds);



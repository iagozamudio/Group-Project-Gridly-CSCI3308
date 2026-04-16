CREATE TABLE IF NOT EXISTS users (
  username VARCHAR(50) PRIMARY KEY,
  password VARCHAR(255) NOT NULL
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
  time_seconds INT NOT NULL,
  puzzle_data  JSONB,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Two-player sessions: one row per player per completed game.
-- score is calculated server-side: MAX(0, 1000 - time_seconds) + (winner ? 200 : 0)
-- where 1000 is the base score, time_seconds penalises slowness, and the
-- winner of the head-to-head receives an extra 200-point bonus.
CREATE TABLE IF NOT EXISTS two_player_sessions (
  tp_session_id SERIAL PRIMARY KEY,
  game_id       VARCHAR(64)  NOT NULL,          -- shared ID linking the two players in one game
  username      VARCHAR(50)  REFERENCES users(username) ON DELETE SET NULL,
  time_seconds  INT          NOT NULL,
  is_winner     BOOLEAN      NOT NULL DEFAULT FALSE,
  score         INT          NOT NULL,           -- pre-computed: MAX(0,1000-time_seconds) + (is_winner*200)
  completed_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tp_sessions_game_id  ON two_player_sessions(game_id);
CREATE INDEX IF NOT EXISTS idx_tp_sessions_username ON two_player_sessions(username);
CREATE INDEX IF NOT EXISTS idx_gs_username          ON game_sessions(username);
CREATE INDEX IF NOT EXISTS idx_gs_time              ON game_sessions(time_seconds);


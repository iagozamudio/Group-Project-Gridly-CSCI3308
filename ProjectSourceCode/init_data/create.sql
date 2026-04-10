--Creates the user table
CREATE TABLE if NOT EXISTS users (
  username VARCHAR(50) PRIMARY KEY,
  password VARCHAR(255) NOT NULL
);

--Creates security questions table
CREATE TABLE IF NOT EXISTS security_questions (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    question VARCHAR(255) NOT NULL,   
    answer VARCHAR(255) NOT NULL,

    CONSTRAINT fk_user
      FOREIGN KEY(username)
      REFERENCES users(username)
      ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS game_sessions (
    session_id SERIAL PRIMARY KEY,
    player_id INT REFERENCES players(player_id),
    score INT NOT NULL,
    ongoing BOOLEAN NOT NULL DEFAULT TRUE
);


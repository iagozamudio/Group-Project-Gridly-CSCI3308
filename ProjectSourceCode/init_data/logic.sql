CREATE TABLE IF NOT EXISTS players (
    player_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP 
);

CREATE TABLE IF NOT EXISTS clues (
    clue_id SERIAL PRIMARY KEY,
    clue_text TEXT NOT NULL,
    answer VARCHAR(20) NOT NULL,
    answer_length INT NOT NULL,
    created_at TIMESTAMP 
);

CREATE TABLE IF NOT EXISTS riddle (
    riddle_id SERIAL PRIMARY KEY,
    size INT NOT NULL,
    created_at TIMESTAMP 
);

CREATE TABLE IF NOT EXISTS riddle_cells (
    cell_id SERIAL PRIMARY KEY,
    riddle_id INT NOT NULL REFERENCES riddle(riddle_id),
    row_index INT NOT NULL,
    col_index INT NOT NULL,
    is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
    solution_letter CHAR(1),
    clue_number INT,
    UNIQUE (riddle_id, row_index, col_index),
    FOREIGN KEY (riddle_id) REFERENCES riddle(riddle_id)
);

CREATE TABLE IF NOT EXISTS riddle_words (
    riddle_word_id SERIAL PRIMARY KEY,
    riddle_id INT NOT NULL REFERENCES riddle(riddle_id),
    clue_id INT NOT NULL REFERENCES clues(clue_id),
    answer VARCHAR(20) NOT NULL,
    clue_text TEXT NOT NULL,
    start_row INT NOT NULL,
    start_col INT NOT NULL,
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('across', 'down')),
    clue_number INT,
    UNIQUE (riddle_id, start_row, start_col, direction),
    FOREIGN KEY (riddle_id) REFERENCES riddle(riddle_id),
    FOREIGN KEY (clue_id) REFERENCES clues(clue_id)
);

CREATE TABLE IF NOT EXISTS game_sessions (
    session_id SERIAL PRIMARY KEY,
    player_id INT REFERENCES players(player_id),
    riddle_id INT NOT NULL REFERENCES riddle(riddle_id),
    elapsed_seconds INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(player_id),
    FOREIGN KEY (riddle_id) REFERENCES riddle(riddle_id)
);

CREATE TABLE IF NOT EXISTS player_entries (
    entry_id SERIAL PRIMARY KEY,
    session_id INT NOT NULL REFERENCES game_sessions(session_id),
    row_index INT NOT NULL,
    col_index INT NOT NULL,
    entered_letter CHAR(1),
    is_correct BOOLEAN,
    updated_at TIMESTAMP,
    UNIQUE (session_id, row_index, col_index),
    FOREIGN KEY (session_id) REFERENCES game_sessions(session_id)
);

CREATE TABLE IF NOT EXISTS game_actions (
    action_id SERIAL PRIMARY KEY,
    session_id INT NOT NULL REFERENCES game_sessions(session_id),
    action_type VARCHAR(20) NOT NULL,
    row_index INT,
    col_index INT,
    action_time TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES game_sessions(session_id)
);

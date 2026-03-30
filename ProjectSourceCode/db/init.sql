CREATE TABLE IF NOT EXISTS security_questions (
    id SERIAL PRIMARY KEY,
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    security_question_id INTEGER,
    security_answer TEXT NOT NULL,
    
    CONSTRAINT fk_security_question
      FOREIGN KEY(security_question_id) 
      REFERENCES security_questions(id)
      ON DELETE SET NULL
);
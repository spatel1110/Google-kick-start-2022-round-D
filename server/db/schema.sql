-- PrepForge Database Schema
-- SQLite database for local interview preparation app

-- Questions table: stores all interview questions with metadata
CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY,
    topic TEXT NOT NULL,
    difficulty TEXT CHECK(difficulty IN ('Easy', 'Medium', 'Hard')),
    question TEXT NOT NULL,
    diagram TEXT,
    one_line_summary TEXT,
    hinglish_explanation TEXT,
    real_life_example TEXT,
    keywords_to_use TEXT,                    -- stored as JSON string
    how_to_open_answer TEXT,
    structured_answer_framework TEXT,         -- stored as JSON string
    how_to_answer TEXT,
    scenario_variant TEXT,                   -- stored as JSON string
    interviewer_followup_questions TEXT,      -- stored as JSON string
    red_flags_to_avoid TEXT,                 -- stored as JSON string
    google_expectations TEXT,
    revision_weight INTEGER DEFAULT 3,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Progress table: tracks user mastery and spaced repetition state per question
CREATE TABLE IF NOT EXISTS progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id INTEGER NOT NULL REFERENCES questions(id),
    mastery INTEGER DEFAULT 0 CHECK(mastery BETWEEN 0 AND 3),
    -- 0=unseen, 1=missed, 2=got it, 3=nailed it
    times_seen INTEGER DEFAULT 0,
    last_seen TEXT,
    self_rating_history TEXT DEFAULT '[]',    -- JSON array of past ratings
    next_review TEXT,                         -- for spaced repetition scheduling
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Sessions table: records each practice session
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT DEFAULT (datetime('now')),
    topic TEXT,
    difficulty TEXT,
    total_questions INTEGER,
    nailed INTEGER DEFAULT 0,
    got_it INTEGER DEFAULT 0,
    missed INTEGER DEFAULT 0,
    duration_seconds INTEGER,
    questions_attempted TEXT,                 -- JSON array of question IDs
    score_percent REAL
);

-- Streaks table: daily study tracking
CREATE TABLE IF NOT EXISTS streaks (
    date TEXT PRIMARY KEY,                   -- format: YYYY-MM-DD
    questions_studied INTEGER DEFAULT 0,
    sessions_completed INTEGER DEFAULT 0
);

-- Settings table: key-value store for app preferences
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(topic);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_progress_question_id ON progress(question_id);
CREATE INDEX IF NOT EXISTS idx_progress_mastery ON progress(mastery);
CREATE INDEX IF NOT EXISTS idx_progress_next_review ON progress(next_review);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_topic ON sessions(topic);

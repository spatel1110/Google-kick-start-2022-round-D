/**
 * PrepForge Query Helpers
 * 
 * All database query functions for the PrepForge application.
 * Every function uses prepared statements and handles missing data gracefully.
 * Array fields are always deserialized from JSON strings when reading.
 */

import db from './setup.js';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Deserializes JSON string fields in a question object back to arrays.
 * Handles null/undefined values gracefully.
 */
function deserializeQuestion(row) {
    if (!row) return null;
    return {
        ...row,
        keywords_to_use: safeJsonParse(row.keywords_to_use),
        structured_answer_framework: safeJsonParse(row.structured_answer_framework),
        scenario_variant: safeJsonParse(row.scenario_variant),
        interviewer_followup_questions: safeJsonParse(row.interviewer_followup_questions),
        red_flags_to_avoid: safeJsonParse(row.red_flags_to_avoid)
    };
}

/**
 * Safely parses a JSON string. Returns empty array if null, undefined, or invalid.
 */
function safeJsonParse(str) {
    if (!str) return [];
    try {
        return JSON.parse(str);
    } catch {
        return [];
    }
}

/**
 * Gets today's date in YYYY-MM-DD format.
 */
function today() {
    return new Date().toISOString().split('T')[0];
}

/**
 * Gets a date N days from now in YYYY-MM-DD format.
 */
function daysFromNow(n) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().split('T')[0];
}

// ============================================================================
// QUESTIONS
// ============================================================================

/**
 * Gets all questions with optional filters.
 * Supports filtering by: topic, difficulty, mastery, search (text search on question field).
 * Returns parsed questions with arrays deserialized from JSON strings.
 */
export function getAllQuestions(filters = {}) {
    let sql = `
        SELECT q.*, p.mastery, p.times_seen, p.last_seen, p.next_review
        FROM questions q
        LEFT JOIN progress p ON p.question_id = q.id
        WHERE 1=1
    `;
    const params = {};

    if (filters.topic) {
        sql += ` AND q.topic = @topic`;
        params.topic = filters.topic;
    }

    if (filters.difficulty) {
        sql += ` AND q.difficulty = @difficulty`;
        params.difficulty = filters.difficulty;
    }

    if (filters.mastery !== undefined && filters.mastery !== null) {
        sql += ` AND p.mastery = @mastery`;
        params.mastery = filters.mastery;
    }

    if (filters.search) {
        sql += ` AND q.question LIKE @search`;
        params.search = `%${filters.search}%`;
    }

    sql += ` ORDER BY q.id ASC`;

    const rows = db.prepare(sql).all(params);
    return rows.map(deserializeQuestion);
}

/**
 * Gets a single question by ID with all fields deserialized.
 * Also joins progress data for this question if it exists.
 * Returns null if question not found.
 */
export function getQuestionById(id) {
    const row = db.prepare(`
        SELECT q.*, p.mastery, p.times_seen, p.last_seen, p.next_review,
               p.self_rating_history
        FROM questions q
        LEFT JOIN progress p ON p.question_id = q.id
        WHERE q.id = @id
    `).get({ id });

    if (!row) return null;

    const deserialized = deserializeQuestion(row);
    deserialized.self_rating_history = safeJsonParse(row.self_rating_history);
    return deserialized;
}

/**
 * Returns array of all distinct topic strings from the questions table.
 */
export function getTopics() {
    const rows = db.prepare('SELECT DISTINCT topic FROM questions ORDER BY topic ASC').all();
    return rows.map(r => r.topic);
}

/**
 * Returns questions ordered by revision_weight DESC, then next_review ASC.
 * Used for the daily recommendation engine.
 * Limit defaults to 20 if not specified.
 */
export function getQuestionsByRevisionWeight(limit = 20) {
    const rows = db.prepare(`
        SELECT q.*, p.mastery, p.times_seen, p.last_seen, p.next_review
        FROM questions q
        LEFT JOIN progress p ON p.question_id = q.id
        ORDER BY q.revision_weight DESC, p.next_review ASC
        LIMIT @limit
    `).all({ limit });

    return rows.map(deserializeQuestion);
}

// ============================================================================
// PROGRESS
// ============================================================================

/**
 * Returns the progress row for a specific question.
 * Returns null if no progress exists.
 */
export function getProgress(questionId) {
    const row = db.prepare(`
        SELECT * FROM progress WHERE question_id = @questionId
    `).get({ questionId });

    if (!row) return null;

    return {
        ...row,
        self_rating_history: safeJsonParse(row.self_rating_history)
    };
}

/**
 * Updates progress for a question with spaced repetition scheduling.
 * - Updates mastery level
 * - Increments times_seen
 * - Sets last_seen to now
 * - Appends self_rating to the rating history array
 * - Calculates next_review based on mastery:
 *     mastery 1 (missed)  → next_review = tomorrow
 *     mastery 2 (got it)  → next_review = 3 days later
 *     mastery 3 (nailed)  → next_review = 7 days later
 * - Updates updated_at timestamp
 */
export function updateProgress(questionId, { mastery, self_rating }) {
    // Calculate next_review date based on spaced repetition
    let nextReview = null;
    if (mastery === 1) {
        nextReview = daysFromNow(1);   // missed → review tomorrow
    } else if (mastery === 2) {
        nextReview = daysFromNow(3);   // got it → review in 3 days
    } else if (mastery === 3) {
        nextReview = daysFromNow(7);   // nailed → review in 7 days
    }

    // Get current self_rating_history to append to it
    const current = db.prepare(
        'SELECT self_rating_history FROM progress WHERE question_id = @questionId'
    ).get({ questionId });

    let ratingHistory = [];
    if (current) {
        ratingHistory = safeJsonParse(current.self_rating_history);
    }
    ratingHistory.push(self_rating);

    const now = new Date().toISOString();

    const result = db.prepare(`
        UPDATE progress
        SET mastery = @mastery,
            times_seen = times_seen + 1,
            last_seen = @lastSeen,
            self_rating_history = @selfRatingHistory,
            next_review = @nextReview,
            updated_at = @updatedAt
        WHERE question_id = @questionId
    `).run({
        mastery,
        lastSeen: now,
        selfRatingHistory: JSON.stringify(ratingHistory),
        nextReview: nextReview,
        updatedAt: now,
        questionId
    });

    return result.changes > 0;
}

/**
 * Returns all progress rows joined with question topic and difficulty.
 * Useful for overview displays.
 */
export function getAllProgress() {
    const rows = db.prepare(`
        SELECT p.*, q.topic, q.difficulty, q.question
        FROM progress p
        JOIN questions q ON q.id = p.question_id
        ORDER BY p.question_id ASC
    `).all();

    return rows.map(row => ({
        ...row,
        self_rating_history: safeJsonParse(row.self_rating_history)
    }));
}

/**
 * Returns questions where mastery = 1 (missed) and times_seen >= 2.
 * These are weak areas the user consistently struggles with.
 * Ordered by times_seen DESC (most seen = most problematic).
 */
export function getWeakAreas() {
    const rows = db.prepare(`
        SELECT q.*, p.mastery, p.times_seen, p.last_seen, p.next_review
        FROM progress p
        JOIN questions q ON q.id = p.question_id
        WHERE p.mastery = 1 AND p.times_seen >= 2
        ORDER BY p.times_seen DESC
    `).all();

    return rows.map(deserializeQuestion);
}

/**
 * Returns questions where next_review date is today or earlier.
 * These are due for spaced repetition review.
 * Ordered by next_review ASC (oldest due first).
 */
export function getDueForReview() {
    const rows = db.prepare(`
        SELECT q.*, p.mastery, p.times_seen, p.last_seen, p.next_review
        FROM progress p
        JOIN questions q ON q.id = p.question_id
        WHERE p.next_review <= @today
        ORDER BY p.next_review ASC
    `).all({ today: today() });

    return rows.map(deserializeQuestion);
}

// ============================================================================
// SESSIONS
// ============================================================================

/**
 * Saves a completed practice session.
 * - Calculates nailed/got_it/missed counts from the ratings array
 * - Calculates score_percent = (nailed / total) * 100
 * - Inserts the session row
 * - Updates today's streak (insert or increment)
 * - Returns the saved session id
 */
export function saveSession({ topic, difficulty, duration_seconds, questions_attempted, ratings }) {
    // Calculate counts from ratings array
    // ratings is an array of mastery values: 1=missed, 2=got_it, 3=nailed
    const nailed = ratings.filter(r => r === 3).length;
    const got_it = ratings.filter(r => r === 2).length;
    const missed = ratings.filter(r => r === 1).length;
    const total = ratings.length;
    const score_percent = total > 0 ? (nailed / total) * 100 : 0;

    const result = db.prepare(`
        INSERT INTO sessions (topic, difficulty, total_questions, nailed, got_it, missed,
                              duration_seconds, questions_attempted, score_percent)
        VALUES (@topic, @difficulty, @total, @nailed, @got_it, @missed,
                @duration_seconds, @questions_attempted, @score_percent)
    `).run({
        topic: topic || null,
        difficulty: difficulty || null,
        total,
        nailed,
        got_it,
        missed,
        duration_seconds: duration_seconds || null,
        questions_attempted: JSON.stringify(questions_attempted || []),
        score_percent
    });

    // Update today's streak
    updateStreak();

    return result.lastInsertRowid;
}

/**
 * Returns the last N sessions ordered by most recent first.
 * Default limit is 20.
 */
export function getSessions(limit = 20) {
    const rows = db.prepare(`
        SELECT * FROM sessions
        ORDER BY created_at DESC
        LIMIT @limit
    `).all({ limit });

    return rows.map(row => ({
        ...row,
        questions_attempted: safeJsonParse(row.questions_attempted)
    }));
}

/**
 * Returns a single session by ID with questions_attempted deserialized.
 * Returns null if not found.
 */
export function getSessionById(id) {
    const row = db.prepare('SELECT * FROM sessions WHERE id = @id').get({ id });
    if (!row) return null;

    return {
        ...row,
        questions_attempted: safeJsonParse(row.questions_attempted)
    };
}

// ============================================================================
// STATS
// ============================================================================

/**
 * Returns a dashboard statistics object with:
 * - total_questions: count of all questions
 * - total_seen: count where times_seen > 0
 * - mastered: count where mastery = 3
 * - weak: count where mastery = 1
 * - unseen: count where mastery = 0
 * - current_streak: count of consecutive days in streaks table (ending today)
 * - topics_progress: array of { topic, total, mastered, seen } per topic
 */
export function getDashboardStats() {
    const total_questions = db.prepare('SELECT COUNT(*) as c FROM questions').get().c;
    const total_seen = db.prepare('SELECT COUNT(*) as c FROM progress WHERE times_seen > 0').get().c;
    const mastered = db.prepare('SELECT COUNT(*) as c FROM progress WHERE mastery = 3').get().c;
    const weak = db.prepare('SELECT COUNT(*) as c FROM progress WHERE mastery = 1').get().c;
    const unseen = db.prepare('SELECT COUNT(*) as c FROM progress WHERE mastery = 0').get().c;

    // Calculate current streak (consecutive days ending today or yesterday)
    const current_streak = calculateCurrentStreak();

    // Topics progress breakdown
    const topics_progress = db.prepare(`
        SELECT 
            q.topic,
            COUNT(*) as total,
            SUM(CASE WHEN p.mastery = 3 THEN 1 ELSE 0 END) as mastered,
            SUM(CASE WHEN p.times_seen > 0 THEN 1 ELSE 0 END) as seen
        FROM questions q
        LEFT JOIN progress p ON p.question_id = q.id
        GROUP BY q.topic
        ORDER BY q.topic ASC
    `).all();

    return {
        total_questions,
        total_seen,
        mastered,
        weak,
        unseen,
        current_streak,
        topics_progress
    };
}

/**
 * Calculates the current streak by counting consecutive days
 * backwards from today in the streaks table.
 */
function calculateCurrentStreak() {
    const rows = db.prepare(`
        SELECT date FROM streaks
        ORDER BY date DESC
    `).all();

    if (rows.length === 0) return 0;

    let streak = 0;
    const todayDate = new Date(today());

    for (let i = 0; i < rows.length; i++) {
        const expectedDate = new Date(todayDate);
        expectedDate.setDate(expectedDate.getDate() - i);
        const expectedStr = expectedDate.toISOString().split('T')[0];

        if (rows[i].date === expectedStr) {
            streak++;
        } else {
            break;
        }
    }

    return streak;
}

// ============================================================================
// STREAKS
// ============================================================================

/**
 * Returns today's streak row or null if no activity today.
 */
export function getTodayStreak() {
    const row = db.prepare('SELECT * FROM streaks WHERE date = @date').get({ date: today() });
    return row || null;
}

/**
 * Inserts or increments today's streak row.
 * If today already has a row, increments questions_studied and sessions_completed.
 * If not, creates a new row with initial values.
 */
export function updateStreak() {
    const todayStr = today();
    const existing = db.prepare('SELECT * FROM streaks WHERE date = @date').get({ date: todayStr });

    if (existing) {
        db.prepare(`
            UPDATE streaks
            SET questions_studied = questions_studied + 1,
                sessions_completed = sessions_completed + 1
            WHERE date = @date
        `).run({ date: todayStr });
    } else {
        db.prepare(`
            INSERT INTO streaks (date, questions_studied, sessions_completed)
            VALUES (@date, 1, 1)
        `).run({ date: todayStr });
    }
}

/**
 * Sessions API Routes
 * GET /api/sessions - list recent sessions
 * GET /api/sessions/:id - single session
 * POST /api/sessions - save a new session
 */

import { Router } from 'express';
import { getSessions, getSessionById, saveSession } from '../db/index.js';

const router = Router();

// GET /api/sessions - list recent sessions
router.get('/', (req, res) => {
    const limit = Number(req.query.limit) || 20;
    const sessions = getSessions(limit);
    res.json(sessions);
});

// GET /api/sessions/:id - single session
router.get('/:id', (req, res) => {
    const session = getSessionById(Number(req.params.id));
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    res.json(session);
});

// POST /api/sessions - save a new session
router.post('/', (req, res) => {
    const { topic, difficulty, duration_seconds, questions_attempted, ratings } = req.body;

    if (!ratings || !Array.isArray(ratings)) {
        return res.status(400).json({ error: 'ratings array is required' });
    }

    const sessionId = saveSession({ topic, difficulty, duration_seconds, questions_attempted, ratings });
    const session = getSessionById(sessionId);
    res.status(201).json(session);
});

export default router;

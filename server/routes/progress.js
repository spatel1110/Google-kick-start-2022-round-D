/**
 * Progress API Routes
 * GET /api/progress - all progress
 * GET /api/progress/weak - weak areas
 * GET /api/progress/review - due for review
 * GET /api/progress/:questionId - single question progress
 * PUT /api/progress/:questionId - update progress
 */

import { Router } from 'express';
import { getAllProgress, getProgress, updateProgress, getWeakAreas, getDueForReview } from '../db/index.js';

const router = Router();

// GET /api/progress - all progress data
router.get('/', (req, res) => {
    const progress = getAllProgress();
    res.json(progress);
});

// GET /api/progress/weak - weak areas
router.get('/weak', (req, res) => {
    const weak = getWeakAreas();
    res.json(weak);
});

// GET /api/progress/review - due for review
router.get('/review', (req, res) => {
    const due = getDueForReview();
    res.json(due);
});

// GET /api/progress/:questionId - single question progress
router.get('/:questionId', (req, res) => {
    const progress = getProgress(Number(req.params.questionId));
    if (!progress) {
        return res.status(404).json({ error: 'Progress not found' });
    }
    res.json(progress);
});

// PUT /api/progress/:questionId - update progress
router.put('/:questionId', (req, res) => {
    const { mastery, self_rating } = req.body;
    const questionId = Number(req.params.questionId);

    if (mastery === undefined || self_rating === undefined) {
        return res.status(400).json({ error: 'mastery and self_rating are required' });
    }

    const success = updateProgress(questionId, { mastery, self_rating });
    if (!success) {
        return res.status(404).json({ error: 'Progress row not found for this question' });
    }

    const updated = getProgress(questionId);
    res.json(updated);
});

export default router;

/**
 * Stats API Routes
 * GET /api/stats - dashboard statistics
 * GET /api/stats/streak - today's streak
 */

import { Router } from 'express';
import { getDashboardStats, getTodayStreak } from '../db/index.js';

const router = Router();

// GET /api/stats - full dashboard stats
router.get('/', (req, res) => {
    const stats = getDashboardStats();
    res.json(stats);
});

// GET /api/stats/streak - today's streak data
router.get('/streak', (req, res) => {
    const streak = getTodayStreak();
    res.json(streak || { date: null, questions_studied: 0, sessions_completed: 0 });
});

export default router;

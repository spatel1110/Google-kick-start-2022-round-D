/**
 * Questions API Routes
 * GET /api/questions - list with filters
 * GET /api/questions/topics - list all topics
 * GET /api/questions/recommended - daily recommendations
 * GET /api/questions/:id - single question
 */

import { Router } from 'express';
import { getAllQuestions, getQuestionById, getTopics, getQuestionsByRevisionWeight } from '../db/index.js';

const router = Router();

// GET /api/questions - list all questions with optional filters
router.get('/', (req, res) => {
    const { topic, difficulty, mastery, search } = req.query;
    const filters = {};
    if (topic) filters.topic = topic;
    if (difficulty) filters.difficulty = difficulty;
    if (mastery !== undefined) filters.mastery = Number(mastery);
    if (search) filters.search = search;

    const questions = getAllQuestions(filters);
    res.json(questions);
});

// GET /api/questions/topics - list all distinct topics
router.get('/topics', (req, res) => {
    const topics = getTopics();
    res.json(topics);
});

// GET /api/questions/recommended - daily recommendations
router.get('/recommended', (req, res) => {
    const limit = Number(req.query.limit) || 20;
    const questions = getQuestionsByRevisionWeight(limit);
    res.json(questions);
});

// GET /api/questions/:id - single question with progress
router.get('/:id', (req, res) => {
    const question = getQuestionById(Number(req.params.id));
    if (!question) {
        return res.status(404).json({ error: 'Question not found' });
    }
    res.json(question);
});

export default router;

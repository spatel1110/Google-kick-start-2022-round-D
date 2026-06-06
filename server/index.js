/**
 * PrepForge API Server
 * 
 * Express server for the PrepForge interview preparation application.
 * Runs locally on port 3001.
 */

import express from 'express';
import cors from 'cors';
import { runSeed } from './db/index.js';

// Import route modules
import questionsRouter from './routes/questions.js';
import progressRouter from './routes/progress.js';
import sessionsRouter from './routes/sessions.js';
import statsRouter from './routes/stats.js';

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Seed database on startup (idempotent — safe to call every time)
runSeed();

// Mount API routes
app.use('/api/questions', questionsRouter);
app.use('/api/progress', progressRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/stats', statsRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', app: 'PrepForge', version: '1.0.0' });
});

// Global error handler middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err.message);
    console.error(err.stack);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`\n🚀 PrepForge API running on http://localhost:${PORT}`);
    console.log(`   Routes:`);
    console.log(`   - GET  /api/questions`);
    console.log(`   - GET  /api/progress`);
    console.log(`   - GET  /api/sessions`);
    console.log(`   - GET  /api/stats`);
    console.log(`   - GET  /api/health\n`);
});

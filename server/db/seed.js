/**
 * PrepForge Database Seeder
 * 
 * Seeds the database with questions from questions.json.
 * Idempotent: safe to run multiple times without duplicating data.
 * Creates progress rows for each question and sets default settings.
 */

import db from './setup.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Runs the seed process:
 * 1. Checks if already seeded
 * 2. Inserts all questions (serializing array fields to JSON)
 * 3. Creates progress rows for each question
 * 4. Inserts default settings
 */
export function runSeed() {
    // Check if questions table is already populated
    const count = db.prepare('SELECT COUNT(*) as count FROM questions').get();
    if (count.count > 0) {
        console.log('Already seeded — questions table has', count.count, 'rows');
        return;
    }

    // Read questions from JSON file
    const questionsPath = path.resolve(__dirname, '../data/questions.json');
    if (!fs.existsSync(questionsPath)) {
        console.error('Error: questions.json not found at', questionsPath);
        console.error('Please place your questions.json file in server/data/questions.json');
        return;
    }

    const rawData = fs.readFileSync(questionsPath, 'utf-8');
    const questions = JSON.parse(rawData);

    // Prepare insert statements
    const insertQuestion = db.prepare(`
        INSERT INTO questions (
            id, topic, difficulty, question, diagram,
            one_line_summary, hinglish_explanation, real_life_example,
            keywords_to_use, how_to_open_answer, structured_answer_framework,
            how_to_answer, scenario_variant, interviewer_followup_questions,
            red_flags_to_avoid, google_expectations, revision_weight
        ) VALUES (
            @id, @topic, @difficulty, @question, @diagram,
            @one_line_summary, @hinglish_explanation, @real_life_example,
            @keywords_to_use, @how_to_open_answer, @structured_answer_framework,
            @how_to_answer, @scenario_variant, @interviewer_followup_questions,
            @red_flags_to_avoid, @google_expectations, @revision_weight
        )
    `);

    const insertProgress = db.prepare(`
        INSERT INTO progress (question_id, mastery, times_seen, self_rating_history)
        VALUES (@question_id, 0, 0, '[]')
    `);

    const insertSetting = db.prepare(`
        INSERT OR IGNORE INTO settings (key, value) VALUES (@key, @value)
    `);

    // Use a transaction for atomic bulk insert (much faster for large datasets)
    const seedTransaction = db.transaction(() => {
        for (const q of questions) {
            // Serialize array fields to JSON strings before inserting
            insertQuestion.run({
                id: q.id,
                topic: q.topic,
                difficulty: q.difficulty,
                question: q.question,
                diagram: q.diagram || null,
                one_line_summary: q.one_line_summary || null,
                hinglish_explanation: q.hinglish_explanation || null,
                real_life_example: q.real_life_example || null,
                keywords_to_use: JSON.stringify(q.keywords_to_use || []),
                how_to_open_answer: q.how_to_open_answer || null,
                structured_answer_framework: JSON.stringify(q.structured_answer_framework || []),
                how_to_answer: q.how_to_answer || null,
                scenario_variant: JSON.stringify(q.scenario_variant || []),
                interviewer_followup_questions: JSON.stringify(q.interviewer_followup_questions || []),
                red_flags_to_avoid: JSON.stringify(q.red_flags_to_avoid || []),
                google_expectations: q.google_expectations || null,
                revision_weight: q.revision_weight ?? 3
            });

            // Create a progress row for each question with defaults
            insertProgress.run({ question_id: q.id });
        }

        // Insert default settings
        insertSetting.run({ key: 'theme', value: 'dark' });
    });

    // Execute the transaction
    seedTransaction();

    console.log(`✓ Seeded ${questions.length} questions successfully`);
    console.log(`✓ Created ${questions.length} progress tracking rows`);
    console.log(`✓ Inserted default settings`);
}

// Run seed if this file is called directly (node server/db/seed.js)
if (process.argv[1] && process.argv[1].includes('seed.js')) {
    runSeed();
}

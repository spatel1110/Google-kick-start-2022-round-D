/**
 * PrepForge Database Setup
 * 
 * Initializes the SQLite database using better-sqlite3.
 * Creates the database file, enables WAL mode and foreign keys,
 * then executes the schema to create all tables and indexes.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Resolve __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database file lives in the project root
const DB_PATH = path.resolve(__dirname, '../../prepforge.db');

// Create/connect to the database
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');

// Enable foreign key constraint enforcement
db.pragma('foreign_keys = ON');

// Read and execute the schema SQL file to create all tables and indexes
const schemaPath = path.resolve(__dirname, 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf-8');
db.exec(schema);

export default db;

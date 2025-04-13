/*
 * Copyright (C) 2023-2025  Yomitan Authors
 * Copyright (C) 2020-2022  Yomichan Authors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import Database from 'better-sqlite3';
import {type BetterSQLite3Database, drizzle} from 'drizzle-orm/better-sqlite3';
import fs from 'fs/promises';
import path from 'path';
import * as schema from './schema.js';

/**
 * SQLiteDatabase class that provides a wrapper around better-sqlite3 and drizzle-orm
 */
export class SQLiteDatabase {
    /**
     * The better-sqlite3 database instance
     */
    private _db: Database.Database | null;
    /**
     * The drizzle-orm database instance
     */
    private _drizzle: BetterSQLite3Database<typeof schema> | null;
    /**
     * Whether the database is currently in the process of opening
     */
    private _isOpening: boolean;
    /**
     * The path to the database file
     */
    private _dbPath: string;

    /**
     * Creates a new SQLiteDatabase instance
     */
    constructor() {
        /**
         *
         */
        this._db = null;
        /**
         *
         */
        this._drizzle = null;
        /**
         *
         */
        this._isOpening = false;
        /**
         *
         */
        this._dbPath = '';
    }

    /**
     * Open a SQLite database connection
     * @param {string} databaseName The name of the database file
     * @throws Error if database is already open or in the process of opening
     */
    async open(databaseName: string): Promise<void> {
        if (this._db !== null) {
            throw new Error('Database already open');
        }
        if (this._isOpening) {
            throw new Error('Already opening');
        }
        try {
            this._isOpening = true;
            this._dbPath = databaseName;
            // Create the database directory if it doesn't exist
            const dbDir = path.dirname(databaseName);
            if (dbDir !== '.') {
                await fs.mkdir(dbDir, {recursive: true});
            }
            // Open the database connection
            this._db = new Database(databaseName);
            this._drizzle = drizzle(this._db, {schema});
            // Create tables if they don't exist
            this._createTables();
            // Create indices for better performance
            this._createIndices();
        } finally {
            this._isOpening = false;
        }
    }

    /**
     * Close the database connection
     */
    async close(): Promise<void> {
        if (this._db) {
            this._db.close();
            this._db = null;
            this._drizzle = null;
        }
    }

    /**
     * Check if the database is currently opening
     * @returns {boolean} Whether the database is opening
     */
    isOpening(): boolean {
        return this._isOpening;
    }

    /**
     * Get the drizzle database instance
     * @returns {BetterSQLite3Database<typeof schema>} The drizzle database instance
     * @throws Error if database is not open
     */
    getDb(): BetterSQLite3Database<typeof schema> {
        if (!this._drizzle) {
            throw new Error('Database not open');
        }
        return this._drizzle;
    }

    /**
     * Delete the database file
     * @param {string} databaseName The name of the database file
     * @throws Error if the file cannot be deleted (except if it doesn't exist)
     */
    async deleteDatabase(databaseName: string): Promise<void> {
        try {
            await fs.unlink(databaseName);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                throw error;
            }
        }
    }

    /**
     * Create database tables
     * @private
     */
    private _createTables(): void {
        // Create tables using SQL statements
        this._db?.exec(`
      CREATE TABLE IF NOT EXISTS dictionaries (
        title TEXT PRIMARY KEY,
        version INTEGER NOT NULL,
        revision TEXT,
        sequenced INTEGER,
        author TEXT,
        url TEXT,
        description TEXT,
        attribution TEXT,
        frequency_mode TEXT,
        prefix_wildcards_supported INTEGER,
        styles TEXT,
        counts TEXT,
        yomitan_version TEXT
      );

      CREATE TABLE IF NOT EXISTS terms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dictionary TEXT NOT NULL,
        expression TEXT NOT NULL,
        reading TEXT NOT NULL,
        expression_reverse TEXT,
        reading_reverse TEXT,
        definition_tags TEXT,
        rules TEXT NOT NULL,
        score INTEGER NOT NULL,
        glossary TEXT NOT NULL,
        sequence INTEGER,
        term_tags TEXT
      );

      CREATE TABLE IF NOT EXISTS term_meta (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dictionary TEXT NOT NULL,
        term TEXT NOT NULL,
        mode TEXT NOT NULL,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS kanji (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dictionary TEXT NOT NULL,
        character TEXT NOT NULL,
        onyomi TEXT NOT NULL,
        kunyomi TEXT NOT NULL,
        tags TEXT NOT NULL,
        meanings TEXT NOT NULL,
        stats TEXT
      );

      CREATE TABLE IF NOT EXISTS kanji_meta (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dictionary TEXT NOT NULL,
        character TEXT NOT NULL,
        mode TEXT NOT NULL,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tag_meta (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dictionary TEXT NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        order_value INTEGER NOT NULL,
        notes TEXT NOT NULL,
        score INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS media (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dictionary TEXT NOT NULL,
        path TEXT NOT NULL,
        media_type TEXT NOT NULL,
        width INTEGER NOT NULL,
        height INTEGER NOT NULL,
        content BLOB NOT NULL
      );
    `);
    }

    /**
     * Create indices for better query performance
     * @private
     */
    private _createIndices(): void {
        // Create indices using SQL statements
        this._db?.exec(`
      CREATE INDEX IF NOT EXISTS idx_terms_dictionary ON terms(dictionary);
      CREATE INDEX IF NOT EXISTS idx_terms_expression ON terms(expression);
      CREATE INDEX IF NOT EXISTS idx_terms_reading ON terms(reading);
      CREATE INDEX IF NOT EXISTS idx_terms_expression_reverse ON terms(expression_reverse);
      CREATE INDEX IF NOT EXISTS idx_terms_reading_reverse ON terms(reading_reverse);
      CREATE INDEX IF NOT EXISTS idx_terms_sequence ON terms(sequence);

      CREATE INDEX IF NOT EXISTS idx_term_meta_dictionary ON term_meta(dictionary);
      CREATE INDEX IF NOT EXISTS idx_term_meta_term ON term_meta(term);
      CREATE INDEX IF NOT EXISTS idx_term_meta_mode ON term_meta(mode);

      CREATE INDEX IF NOT EXISTS idx_kanji_dictionary ON kanji(dictionary);
      CREATE INDEX IF NOT EXISTS idx_kanji_character ON kanji(character);

      CREATE INDEX IF NOT EXISTS idx_kanji_meta_dictionary ON kanji_meta(dictionary);
      CREATE INDEX IF NOT EXISTS idx_kanji_meta_character ON kanji_meta(character);
      CREATE INDEX IF NOT EXISTS idx_kanji_meta_mode ON kanji_meta(mode);

      CREATE INDEX IF NOT EXISTS idx_tag_meta_dictionary ON tag_meta(dictionary);
      CREATE INDEX IF NOT EXISTS idx_tag_meta_name ON tag_meta(name);
      CREATE INDEX IF NOT EXISTS idx_tag_meta_category ON tag_meta(category);

      CREATE INDEX IF NOT EXISTS idx_media_dictionary ON media(dictionary);
      CREATE INDEX IF NOT EXISTS idx_media_path ON media(path);
    `);
    }
}

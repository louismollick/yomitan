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

import {createClient, type Client as LibSqlClient} from '@libsql/client';
import {drizzle, type LibSQLDatabase} from 'drizzle-orm/libsql';
import fs from 'fs/promises';
import * as schema from './schema.js';

/**
 * SQLiteDatabase class that provides a wrapper around better-sqlite3 and drizzle-orm
 */
export class SQLiteDatabase {
    /**
     * libsql/client instance
     */
    private _client: LibSqlClient | null;
    /**
     * drizzle-orm database instance
     */
    private _drizzle: LibSQLDatabase<typeof schema> | null;
    /**
     * Whether the database is currently in the process of opening
     */
    private _isOpening: boolean;

    /**
     * Creates a new SQLiteDatabase instance
     */
    constructor() {
        /**
         * libsql/client instance initialize to null
         */
        this._client = null;
        /**
         * drizzle-orm database instance initialize to null
         */
        this._drizzle = null;
        /**
         * Whether the database is currently in the process of opening should be false by default
         */
        this._isOpening = false;
    }

    /**
     * Open a SQLite database connection
     * @param {string} databaseName The name of the database file
     * @throws Error if database is already open or in the process of opening
     */
    async open(databaseName: string): Promise<void> {
        if (this._client !== null) {
            throw new Error('Database already open');
        }
        if (this._isOpening) {
            throw new Error('Already opening');
        }
        try {
            this._isOpening = true;
            this._client = createClient({
                url: databaseName,
            });
            this._drizzle = drizzle(this._client, {schema});
        } finally {
            this._isOpening = false;
        }
    }

    /**
     * Close the database connection
     */
    async close(): Promise<void> {
        if (this._client) {
            this._client.close();
            this._client = null;
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
     * @returns {LibSQLDatabase<typeof schema>} The drizzle database instance
     * @throws Error if database is not open
     */
    getDb(): LibSQLDatabase<typeof schema> {
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
            await fs.rm(databaseName);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                throw error;
            }
        }
    }
}

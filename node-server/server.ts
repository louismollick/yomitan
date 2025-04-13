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

import express from 'express';
import path from 'path';
import fs from 'fs';
import {DictionaryDatabase} from './src/database/dictionary-database.js';
import {DictionaryImporter} from '../ext/js/dictionary/dictionary-importer.js';
import {Translator} from '../ext/js/language/translator.js';
import {createFindTermsOptions} from '../test/utilities/translator.js';

/**
 * Simple media loader implementation for the dictionary importer
 */
class SimpleMediaLoader {
    /**
     * Gets image details from content
     * @param {ArrayBuffer} content The image content buffer
     * @param {string} _mediaType The media type (unused)
     * @returns {{content: ArrayBuffer, width: number, height: number}} The image details
     */
    async getImageDetails(content: ArrayBuffer, _mediaType: string): Promise<{content: ArrayBuffer, width: number, height: number}> {
        // Return a minimal implementation that satisfies the interface
        return {
            content,
            width: 0,
            height: 0,
        };
    }
}

/**
 * Main application class for the Yomitan server
 */
class YomitanServer {
    /** The dictionary database instance */
    private dictionaryDatabase!: DictionaryDatabase;
    /** The translator instance */
    private translator!: Translator;
    /** The name of the loaded dictionary */
    private dictionaryName = '';
    /** The Express application instance */
    private app = express();
    /** The port number to listen on */
    private port = 3000;

    /**
     * Creates a new instance of the YomitanServer
     */
    constructor() {
        this.app.use(express.json());
        this.setupRoutes();
    }

    /**
     * Sets up the server routes
     * @private
     */
    private setupRoutes() {
        this.app.get('/lookup/:term', async (req, res) => {
            try {
                const term = req.params.term;
                if (!term) {
                    return res.status(400).send({error: 'Term parameter is required'});
                }

                if (!this.translator) {
                    return res.status(500).send({error: 'Translator not initialized'});
                }

                // Create options for the lookup
                const options = createFindTermsOptions(this.dictionaryName, {
                    default: {
                        type: 'terms',
                        enabledDictionaryMap: [[this.dictionaryName, true]],
                        removeNonJapaneseCharacters: false,
                        language: 'ja',
                    },
                }, 'default');

                // Perform the lookup
                const result = await this.translator.findTerms('simple', term, options);
                res.send(result);
            } catch (error) {
                console.error('Error during lookup:', error);
                res.status(500).send({error: 'An error occurred during lookup'});
            }
        });

        this.app.get('/health', (req, res) => {
            res.send({
                status: 'ok',
                databaseInitialized: !!this.dictionaryDatabase,
                translatorInitialized: !!this.translator,
                dictionaryName: this.dictionaryName || 'Not loaded',
            });
        });
    }

    /**
     * Initializes the dictionary database and translator
     * @returns {Promise<boolean>} True if initialization succeeded, false otherwise
     */
    async initialize() {
        try {
            console.log('Initializing dictionary database...');
            this.dictionaryDatabase = new DictionaryDatabase();
            await this.dictionaryDatabase.prepare();
            console.log('Dictionary database initialized');

            // Import dictionary from zip file
            // Try different possible locations for the dictionary zip file
            const possiblePaths = [
                path.resolve(process.cwd(), 'node-server/jitendex-yomitan.zip'),
                path.resolve(process.cwd(), 'jitendex-yomitan.zip'),
                path.resolve(process.cwd(), '../jitendex-yomitan.zip'),
            ];

            let zipFilePath = '';
            for (const p of possiblePaths) {
                if (fs.existsSync(p)) {
                    zipFilePath = p;
                    break;
                }
            }

            if (!zipFilePath) {
                console.error('Dictionary zip file not found in any of these locations:', possiblePaths);
                console.error('Please place the jitendex-yomitan.zip file in one of these locations and restart the server.');
                throw new Error('Dictionary file not found');
            }

            console.log(`Importing dictionary from ${zipFilePath}...`);

            const zipFileContent = fs.readFileSync(zipFilePath);
            const mediaLoader = new SimpleMediaLoader();
            const dictionaryImporter = new DictionaryImporter(mediaLoader);

            const importResult = await dictionaryImporter.importDictionary(
                this.dictionaryDatabase,
                zipFileContent.buffer,
                {
                    prefixWildcardsSupported: true,
                    yomitanVersion: '0.0.0.0',
                },
            );

            if (importResult.errors && importResult.errors.length > 0) {
                console.error('Errors during dictionary import:', importResult.errors);
            }

            for (const err of importResult.errors) {
                console.error(err.message);
            }

            const alreadyImported = importResult.errors.some((err) => err.message.includes('is already imported, skipped it'));

            if (importResult.result) {
                this.dictionaryName = importResult.result.title;
                console.log(`Dictionary imported: ${this.dictionaryName}`);
            } else if (alreadyImported) {
                this.dictionaryName = 'Jitendex.org [2025-03-31]';
                console.log('Dictionary already imported');
            } else {
                throw new Error('Failed to import dictionary');
            }

            // Initialize translator
            console.log('Initializing translator...');
            this.translator = new Translator(this.dictionaryDatabase);
            this.translator.prepare();
            console.log('Translator initialized');

            return true;
        } catch (error) {
            console.error('Initialization error:', error);
            return false;
        }
    }

    /**
     * Starts the server
     * @returns {Promise<void>}
     */
    async start() {
        const initialized = await this.initialize();
        if (!initialized) {
            console.error('Failed to initialize. Exiting...');
            process.exit(1);
        }

        this.app.listen(this.port, () => {
            console.log(`Yomitan server running at http://localhost:${this.port}`);
            console.log(`Try a lookup: http://localhost:${this.port}/lookup/日本語`);
        });
    }
}

// Start the server
const server = new YomitanServer();
void server.start();

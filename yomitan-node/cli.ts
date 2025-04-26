#!/usr/bin/env node
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

import {Command} from 'commander';
import fs from 'fs';
import path from 'path';
import {DictionaryDatabase} from './database/dictionary-database.js';
import {DictionaryImporter} from '../ext/js/dictionary/dictionary-importer.js';
import {SimpleMediaLoader} from './index.js';
import type {ImportResult} from '../types/ext/dictionary-importer.js';

// Create a new command instance
const program = new Command();

// Set up program information
program
    .name('yomitan-node')
    .description('CLI for Yomitan Node.js library')
    .version('1.0.0');

// Dictionary import command
program
    .command('dictionary:import')
    .description('Import a Yomitan dictionary from a zip file')
    .argument('<zipPath>', 'Path to the dictionary zip file')
    .action(async (zipPath: string) => {
        try {
            // Resolve the path to the zip file
            const resolvedZipPath = path.resolve(process.cwd(), zipPath);

            // Check if the file exists
            if (!fs.existsSync(resolvedZipPath)) {
                console.error(`Dictionary zip file not found: ${resolvedZipPath}`);
                process.exit(1);
            }

            console.log(`Importing dictionary from ${resolvedZipPath}...`);

            // Initialize the dictionary database
            console.log('Initializing dictionary database...');
            const dictionaryDatabase = new DictionaryDatabase();
            await dictionaryDatabase.prepare();
            console.log('Dictionary database initialized');

            // Read the zip file content
            const zipFileContent = fs.readFileSync(resolvedZipPath);

            // Create a media loader and dictionary importer
            const mediaLoader = new SimpleMediaLoader();
            const dictionaryImporter = new DictionaryImporter(mediaLoader);

            // Import the dictionary
            const importResult = await dictionaryImporter.importDictionary(
                // @ts-expect-error - The Sqlite DictionaryDatabase is missing some unimportant properties
                dictionaryDatabase,
                zipFileContent.buffer,
                {
                    prefixWildcardsSupported: true,
                    yomitanVersion: '0.0.0.0',
                },
            ) as ImportResult;

            // Handle import results
            if (importResult.errors && importResult.errors.length > 0) {
                console.error('Errors during dictionary import:');
                for (const err of importResult.errors) {
                    console.error(`- ${err.message}`);
                }
                process.exit(1);
            }

            if (importResult.result) {
                const dictionaryName = importResult.result.title;
                console.log(`Dictionary imported successfully: ${dictionaryName}`);
            }

            // Close the database connection
            await dictionaryDatabase.close();
        } catch (error: unknown) {
            console.error('Error during dictionary import:', error instanceof Error ? error.message : error);
            process.exit(1);
        }
    });

// Parse command line arguments
program.parse();

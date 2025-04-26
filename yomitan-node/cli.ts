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

// eslint-disable-next-line eslint-comments/disable-enable-pair
/* eslint-disable no-underscore-dangle */

import {Command} from 'commander';
import {Backend} from 'ext/js/background/backend.js';
import {SettingsController} from 'ext/js/pages/settings/settings-controller.js';
import {DictionaryImportController} from 'ext/js/pages/settings/dictionary-import-controller.js';
import type {MessageCompleteResultSerialized} from 'types/ext/dictionary-worker.js';

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
            const backend = new Backend();
            await backend.prepare();
            const settingsController = new SettingsController(backend);
            await settingsController.prepare();
            const dictionaryImportController = new DictionaryImportController(settingsController);
            const importResult = await dictionaryImportController._importDictionaryFromZip(zipPath, null, {prefixWildcardsSupported: true, yomitanVersion: '0.0.0.0'}) as MessageCompleteResultSerialized;
            // Handle import results
            if (importResult.errors && importResult.errors.length > 0) {
                console.error('Errors during dictionary import:');
                for (const err of importResult.errors) {
                    console.error(`- ${JSON.stringify(err)}`);
                }
                process.exit(1);
            }

            if (importResult.result) {
                const dictionaryName = importResult.result.title;
                console.log(`Dictionary imported successfully: ${dictionaryName}`);
            }
        } catch (error: unknown) {
            console.error('Error during dictionary import:', error instanceof Error ? error.message : error);
            process.exit(1);
        }
    });

// Parse command line arguments
program.parse();

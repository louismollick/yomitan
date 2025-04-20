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

import 'global-jsdom/register';
import path from 'path';
import fs from 'fs';
import {DictionaryDatabase} from './src/database/dictionary-database.js';
import {DictionaryImporter} from '../ext/js/dictionary/dictionary-importer.js';
import {Translator} from '../ext/js/language/translator.js';
import {createFindTermsOptions} from '../test/utilities/translator.js';
import {DisplayGenerator} from '../ext/js/display/display-generator.js';
import type {ImportResult, Summary} from '../types/ext/dictionary-importer.d.ts';
import type {LoadMediaRequest} from '../types/ext/display-content-manager.js';
import type {TermDictionaryEntry} from '../types/ext/dictionary.d.ts';
import type {DisplayContentManager} from '../ext/js/display/display-content-manager.js';

interface LookupTermResult {dictionaryEntries: TermDictionaryEntry[], originalTextLength: number}

const linkElements = document.createElement('div');
linkElements.innerHTML = '<link rel="icon" type="image/png" href="/images/icon16.png" sizes="16x16"><link rel="icon" type="image/png" href="/images/icon19.png" sizes="19x19"><link rel="icon" type="image/png" href="/images/icon32.png" sizes="32x32"><link rel="icon" type="image/png" href="/images/icon38.png" sizes="38x38"><link rel="icon" type="image/png" href="/images/icon48.png" sizes="48x48"><link rel="icon" type="image/png" href="/images/icon64.png" sizes="64x64"><link rel="icon" type="image/png" href="/images/icon128.png" sizes="128x128"><link rel="stylesheet" type="text/css" href="/css/material.css"><link rel="stylesheet" type="text/css" href="/css/display.css"><link rel="stylesheet" type="text/css" href="/css/display-pronunciation.css"><link rel="stylesheet" type="text/css" href="/css/structured-content.css">';
while (linkElements.firstChild) {
    document.head.appendChild(linkElements.firstChild);
}

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
 * Simple implementation of DisplayContentManager for server-side rendering
 */
class ServerDisplayContentManager implements DisplayContentManager {
    /** Media load requests */
    _loadMediaRequests: LoadMediaRequest[] = [];
    /** Event listeners collection */
    _eventListeners = {
        removeAllEventListeners: () => {},
        addEventListener: () => {},
        addListener: () => {},
        on: () => {},
        size: 0,
        _eventListeners: [],
    };

    /** Token object */
    _token = {};
    /** Mock display object - using any to satisfy the interface */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _display: any = {
        application: {
            api: {
                getMedia: async () => [],
                drawMedia: () => {},
            },
        },
        setContent: () => {},
    };

    /**
     * Get the media load requests
     * @returns {Array<{path: string, dictionary: string, canvas: unknown}>} The media load requests
     */
    get loadMediaRequests(): {path: string, dictionary: string, canvas: unknown}[] {
        return this._loadMediaRequests;
    }

    /**
     * Queue loading media file from a given dictionary
     * @param {string} filePath The path of the media file
     * @param {string} dictionary The dictionary name
     * @param {unknown} canvas The canvas to draw the media on
     */
    loadMedia(path: string, dictionary: string, canvas: OffscreenCanvas): void {
        this._loadMediaRequests.push({ path, dictionary, canvas });
    }

    /**
     * Unloads all media that has been loaded
     */
    unloadAll(): void {
        this._token = {};
        this._eventListeners.removeAllEventListeners();
        this._loadMediaRequests = [];
    }

    /**
     * Sets up attributes and events for a link element
     * @param {HTMLAnchorElement} element The link element
     * @param {string} href The URL
     * @param {boolean} internal Whether or not the URL is an internal or external link
     */
    prepareLink(element: HTMLAnchorElement, href: string, internal: boolean) {
        element.href = href;
        if (!internal) {
            element.target = '_blank';
            element.rel = 'noreferrer noopener';
        }
    }

    /**
     * Execute media requests
     */
    async executeMediaRequests() {
        // No-op for server-side rendering
    }

    /**
     * Open media in a new tab
     * @param {string} _filePath The path of the media file
     * @param {string} _dictionary The dictionary name
     * @param {Window} _window The window object
     */
    async openMediaInTab(_filePath: string, _dictionary: string, _window: Window) {
        // No-op for server-side rendering
    }

    /**
     * Handle link click event
     * @param {MouseEvent} _e The mouse event
     */
    _onLinkClick(_e: MouseEvent) {
        // No-op for server-side rendering
    }
}

/**
 * Main application class for the Yomitan server
 */
export class Yomitan {
    /** The dictionary database instance */
    private dictionaryDatabase!: DictionaryDatabase;
    /** The translator instance */
    private translator!: Translator;
    /** The name of the loaded dictionary */
    private dictionaryName = '';
    /** The display generator */
    private displayGenerator: DisplayGenerator | null = null;
    /** Dictionary info */
    private dictionaryInfo: Summary[] = [];

    /**
     * Lookup a term
     * @param {string} term The term to lookup
     * @returns {Promise<LookupTermResult>} The lookup result
     * @private
     */
    public async lookupTerm(term: string) {
        try {
            if (!term) {
                throw new Error('Term parameter is required');
            }

            if (!this.translator) {
                throw new Error('Translator not initialized');
            }

            // Create options for the lookup
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const options = createFindTermsOptions(this.dictionaryName, {
                default: {
                    type: 'terms',
                    enabledDictionaryMap: [[this.dictionaryName, true]],
                    removeNonJapaneseCharacters: false,
                    language: 'ja',
                },
            }, 'default');

            // Perform the lookup
            return this.translator.findTerms('simple', term, options) as Promise<LookupTermResult>;
        } catch (error) {
            console.error('Error during lookup:', error);
            throw new Error('An error occurred during lookup');
        }
    }

    /**
     * Lookup a term
     * @param {string} term The term to lookup
     * @returns {Promise<string>} The HTML representation of the lookup result
     */
    public async lookupTermHtml(term: string) {
        const result = await this.lookupTerm(term);
        return this.generateHtml(result.dictionaryEntries);
    }

    /**
     * Generates HTML from dictionary entries
     * @param {TermDictionaryEntry[]} dictionaryEntries The dictionary entries to render
     * @returns {Promise<string>} The generated HTML
     */
    private generateHtml(dictionaryEntries: TermDictionaryEntry[]): Promise<string> {
        if (!this.displayGenerator) {
            throw new Error('Display generator not initialized');
        }

        // Clear the body
        document.body.innerHTML = '';

        // Create entries for each dictionary entry
        for (const dictionaryEntry of dictionaryEntries) {
            const entry = this.displayGenerator.createTermEntry(dictionaryEntry, this.dictionaryInfo);
            document.body.appendChild(entry);
        }

        // @ts-expect-error - Missing types for $jsdom on global
        return global.$jsdom.serialize();
    }

    /**
     * Initializes the dictionary database and translator
     * @returns {Promise<boolean>} True if initialization succeeded, false otherwise
     */
    public async initialize(): Promise<boolean> {
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

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const importResult: ImportResult = await dictionaryImporter.importDictionary(
                // @ts-expect-error - The Sqlite DictionaryDatabase is missing some unimportant properties
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
            // @ts-expect-error - The Sqlite DictionaryDatabase is missing some unimportant properties
            this.translator = new Translator(this.dictionaryDatabase);
            this.translator.prepare();
            console.log('Translator initialized');

            // Get dictionary info for display
            this.dictionaryInfo = await this.dictionaryDatabase.getDictionaryInfo();

            // Initialize display generator
            console.log('Initializing display generator...');
            const contentManager = new ServerDisplayContentManager();
            this.displayGenerator = new DisplayGenerator(contentManager, null);
            await this.displayGenerator.prepare();
            console.log('Display generator initialized');

            return true;
        } catch (error) {
            console.error('Initialization error:', error);
            return false;
        }
    }
}

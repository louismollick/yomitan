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
import {DisplayGenerator} from 'ext/js/display/display-generator.js';
import {Backend} from 'ext/js/background/backend.js';
import type {TermDictionaryEntry} from 'types/ext/dictionary.js';
import type {Summary} from 'types/ext/dictionary-importer';
import type {DisplayContentManager} from 'ext/js/display/display-content-manager';
import type {LoadMediaRequest} from 'types/ext/display-content-manager';
import type {ApiSurface} from 'types/ext/api';

const linkElements = document.createElement('div');
linkElements.innerHTML = '<link rel="icon" type="image/png" href="/images/icon16.png" sizes="16x16"><link rel="icon" type="image/png" href="/images/icon19.png" sizes="19x19"><link rel="icon" type="image/png" href="/images/icon32.png" sizes="32x32"><link rel="icon" type="image/png" href="/images/icon38.png" sizes="38x38"><link rel="icon" type="image/png" href="/images/icon48.png" sizes="48x48"><link rel="icon" type="image/png" href="/images/icon64.png" sizes="64x64"><link rel="icon" type="image/png" href="/images/icon128.png" sizes="128x128"><link rel="stylesheet" type="text/css" href="/css/material.css"><link rel="stylesheet" type="text/css" href="/css/display.css"><link rel="stylesheet" type="text/css" href="/css/display-pronunciation.css"><link rel="stylesheet" type="text/css" href="/css/structured-content.css">';
while (linkElements.firstChild) {
    document.head.appendChild(linkElements.firstChild);
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
     * @param {OffscreenCanvas} canvas The canvas to draw the media on
     */
    loadMedia(filePath: string, dictionary: string, canvas: OffscreenCanvas): void {
        this._loadMediaRequests.push({path: filePath, dictionary, canvas});
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
    private backend!: Backend;
    /** The display generator */
    private displayGenerator: DisplayGenerator | null = null;
    /** Dictionary info */
    private dictionaryInfo: Summary[] = [];

    /**
     * Lookup a term
     * @param {string} text The term to lookup
     * @returns {Promise<ApiSurface['termsFind']['return']>} The lookup result
     */
    public async lookupTerm(text: string): Promise<ApiSurface['termsFind']['return']> {
        try {
            // eslint-disable-next-line no-underscore-dangle
            return this.backend._onApiTermsFind({text, details: {}, optionsContext: {}});
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
     * @throws {Error} If the display generator is not initialized
     */
    public generateHtml(dictionaryEntries: TermDictionaryEntry[]): Promise<string> {
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
            this.backend = new Backend();
            await this.backend.prepare();

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

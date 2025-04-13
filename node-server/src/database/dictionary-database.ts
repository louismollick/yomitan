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

import * as schema from './schema.js';
import {eq, like, and} from 'drizzle-orm';
import {SQLiteDatabase} from './sqlite-database.js';

// Type definitions to match the original DictionaryDatabase interface
type ObjectStoreName =
  | 'dictionaries'
  | 'terms'
  | 'termMeta'
  | 'kanji'
  | 'kanjiMeta'
  | 'tagMeta'
  | 'media';

type MatchType = 'exact' | 'prefix' | 'suffix' | 'anywhere';

type MatchSource = 'term' | 'reading';

interface TermEntry {
    index: number;
    matchType: MatchType;
    matchSource: MatchSource;
    term: string;
    reading: string;
    definitionTags: string[];
    termTags: string[];
    rules: string[];
    definitions: any[]; // TermGlossary[]
    score: number;
    dictionary: string;
    id: number;
    sequence: number;
}

interface KanjiEntry {
    index: number;
    character: string;
    onyomi: string[];
    kunyomi: string[];
    tags: string[];
    definitions: string[];
    stats: {[name: string]: string};
    dictionary: string;
}

interface DatabaseTermEntry {
    expression: string;
    reading: string;
    expressionReverse?: string;
    readingReverse?: string;
    definitionTags: string | null;
    tags?: string; // Legacy alias for definitionTags
    rules: string;
    score: number;
    glossary: any[]; // TermGlossary[]
    sequence?: number;
    termTags?: string;
    dictionary: string;
}

interface DatabaseKanjiEntry {
    character: string;
    onyomi: string;
    kunyomi: string;
    tags: string;
    meanings: string[];
    dictionary: string;
    stats?: {[name: string]: string};
}

interface Tag {
    name: string;
    category: string;
    order: number;
    notes: string;
    score: number;
    dictionary: string;
}

interface DictionarySet {
    has(value: string): boolean;
}

interface DictionaryCounts {
    total: DictionaryCountGroup | null;
    counts: DictionaryCountGroup[];
}

interface DictionaryCountGroup {
    [key: string]: number;
}

interface MediaData {
    dictionary: string;
    path: string;
    mediaType: string;
    width: number;
    height: number;
    content: ArrayBuffer;
}

// Main DictionaryDatabase class
export class DictionaryDatabase {
    /**
     *
     */
    private _db: SQLiteDatabase;
    /**
     *
     */
    private _dbName: string;
    /**
     *
     */
    private _isOpen: boolean = false;

    constructor() {
        /**
         *
         */
        this._dbName = 'dict.sqlite';
        /**
         *
         */
        this._db = new SQLiteDatabase();
    }

    /**
     * Prepare the database by opening the connection and creating tables if needed
     */
    async prepare(): Promise<void> {
        await this._db.open(this._dbName);
        this._isOpen = true;
    }

    /**
     * Close the database connection
     */
    async close(): Promise<void> {
        await this._db.close();
        this._isOpen = false;
    }

    /**
     * Check if the database is prepared (open)
     * @returns {boolean} True if the database is prepared, false otherwise
     */
    isPrepared(): boolean {
        return this._isOpen;
    }

    /**
     * Purge the database by deleting it and recreating it
     * @returns {Promise<boolean>} True if the purge was successful, false otherwise
     */
    async purge(): Promise<boolean> {
        if (this._db.isOpening()) {
            throw new Error('Cannot purge database while opening');
        }

        if (this._isOpen) {
            await this._db.close();
            this._isOpen = false;
        }

        let result = false;
        try {
            await this._db.deleteDatabase(this._dbName);
            result = true;
        } catch (e) {
            console.error(e);
        }

        await this.prepare();
        return result;
    }

    /**
     * Find terms in bulk based on a list of terms and match type
     * @param {string[]} termList List of terms to search for
     * @param {DictionarySet} dictionaries Set of dictionaries to search in
     * @param {MatchType} matchType Type of matching to perform
     * @returns {Promise<TermEntry[]>} Array of matching term entries
     */
    async findTermsBulk(
        termList: string[],
        dictionaries: DictionarySet,
        matchType: MatchType = 'exact',
    ): Promise<TermEntry[]> {
        if (termList.length === 0) {
            return [];
        }

        const results: TermEntry[] = [];
        const db = this._db.getDb();

        // Different query strategies based on match type
        for (let i = 0; i < termList.length; i++) {
            const term = termList[i] ?? '';
            let query;

            switch (matchType) {
                case 'exact':
                    query = db.select().from(schema.terms)
                        .where(eq(schema.terms.expression, term));
                    break;
                case 'prefix':
                    query = db.select().from(schema.terms)
                        .where(like(schema.terms.expression, `${term}%`));
                    break;
                case 'suffix':
                    query = db.select().from(schema.terms)
                        .where(like(schema.terms.expressionReverse, `${this._reverseString(term)}%`));
                    break;
                case 'anywhere':
                    query = db.select().from(schema.terms)
                        .where(like(schema.terms.expression, `%${term}%`));
                    break;
            }

            const rows = await query;

            // Filter by dictionaries
            for (const row of rows) {
                if (dictionaries.has(row.dictionary)) {
                    const definitionTags = row.definitionTags ? row.definitionTags.split(' ') : [];
                    const termTags = row.termTags ? row.termTags.split(' ') : [];
                    const rules = row.rules ? row.rules.split(' ') : [];
                    const glossary = JSON.parse(row.glossary);

                    results.push({
                        index: i,
                        matchType,
                        matchSource: 'term',
                        term: row.expression,
                        reading: row.reading,
                        definitionTags,
                        termTags,
                        rules,
                        definitions: glossary,
                        score: row.score,
                        dictionary: row.dictionary,
                        id: row.id,
                        sequence: row.sequence || 0,
                    });
                }
            }
        }

        return results;
    }

    /**
     * Find terms exactly matching the specified term and reading
     * @param {Array<{term: string, reading: string}>} termList Array of objects containing term and reading pairs to search for
     * @param {DictionarySet} dictionaries Set of dictionary names to search in
     * @returns {Promise<TermEntry[]>} Array of matching term entries
     */
    async findTermsExactBulk(
        termList: {term: string, reading: string}[],
        dictionaries: DictionarySet,
    ): Promise<TermEntry[]> {
        if (termList.length === 0) {
            return [];
        }

        const results: TermEntry[] = [];
        const db = this._db.getDb();
        for (let i = 0; i < termList.length; i++) {
            const {term, reading} = termList[i];

            const rows = await db.select().from(schema.terms)
                .where(and(
                    eq(schema.terms.expression, term),
                    eq(schema.terms.reading, reading),
                ));

            for (const row of rows) {
                if (dictionaries.has(row.dictionary)) {
                    const definitionTags = row.definitionTags ? row.definitionTags.split(' ') : [];
                    const termTags = row.termTags ? row.termTags.split(' ') : [];
                    const rules = row.rules ? row.rules.split(' ') : [];
                    const glossary = JSON.parse(row.glossary);

                    results.push({
                        index: i,
                        matchType: 'exact',
                        matchSource: 'term',
                        term: row.expression,
                        reading: row.reading,
                        definitionTags,
                        termTags,
                        rules,
                        definitions: glossary,
                        score: row.score,
                        dictionary: row.dictionary,
                        id: row.id,
                        sequence: row.sequence || 0,
                    });
                }
            }
        }

        return results;
    }

    /**
     * Find kanji in bulk based on a list of characters
     * @param {string[]} kanjiList List of kanji characters to search for
     * @param {DictionarySet} dictionaries Set of dictionary names to search in
     * @returns {Promise<KanjiEntry[]>} Array of matching kanji entries
     */
    async findKanjiBulk(
        kanjiList: string[],
        dictionaries: DictionarySet,
    ): Promise<KanjiEntry[]> {
        if (kanjiList.length === 0) {
            return [];
        }

        const results: KanjiEntry[] = [];
        const db = this._db.getDb();

        for (let i = 0; i < kanjiList.length; i++) {
            const character = kanjiList[i];

            const rows = await db.select().from(schema.kanji)
                .where(eq(schema.kanji.character, character));

            for (const row of rows) {
                if (dictionaries.has(row.dictionary)) {
                    const onyomi = row.onyomi ? row.onyomi.split(' ') : [];
                    const kunyomi = row.kunyomi ? row.kunyomi.split(' ') : [];
                    const tags = row.tags ? row.tags.split(' ') : [];
                    const meanings = JSON.parse(row.meanings);
                    const stats = row.stats ? JSON.parse(row.stats) : {};

                    results.push({
                        index: i,
                        character: row.character,
                        onyomi,
                        kunyomi,
                        tags,
                        definitions: meanings,
                        stats,
                        dictionary: row.dictionary,
                    });
                }
            }
        }

        return results;
    }

    /**
     * Find term meta data in bulk
     * @param {string[]} termList List of terms to search for
     * @param {DictionarySet} dictionaries Set of dictionaries to search in
     * @returns {Promise<any[]>} Array of matching term meta entries
     */
    async findTermMetaBulk(
        termList: string[],
        dictionaries: DictionarySet,
    ): Promise<any[]> {
        if (termList.length === 0) {
            return [];
        }

        const results: any[] = [];
        const db = this._db.getDb();

        for (let i = 0; i < termList.length; i++) {
            const term = termList[i];

            const rows = await db.select().from(schema.termMeta)
                .where(eq(schema.termMeta.term, term));

            for (const row of rows) {
                if (dictionaries.has(row.dictionary)) {
                    results.push({
                        index: i,
                        term: row.term,
                        mode: row.mode,
                        data: JSON.parse(row.data),
                        dictionary: row.dictionary,
                    });
                }
            }
        }

        return results;
    }

    /**
     * Find kanji meta data in bulk
     * @param {string[]} kanjiList List of kanji characters to search for
     * @param {DictionarySet} dictionaries Set of dictionaries to search in
     * @returns {Promise<any[]>} Array of matching kanji meta entries
     */
    async findKanjiMetaBulk(
        kanjiList: string[],
        dictionaries: DictionarySet,
    ): Promise<any[]> {
        if (kanjiList.length === 0) {
            return [];
        }

        const results: any[] = [];
        const db = this._db.getDb();

        for (let i = 0; i < kanjiList.length; i++) {
            const character = kanjiList[i];

            const rows = await db.select().from(schema.kanjiMeta)
                .where(eq(schema.kanjiMeta.character, character));

            for (const row of rows) {
                if (dictionaries.has(row.dictionary)) {
                    results.push({
                        index: i,
                        character: row.character,
                        mode: row.mode,
                        data: JSON.parse(row.data),
                        dictionary: row.dictionary,
                    });
                }
            }
        }

        return results;
    }

    /**
     * Find tag meta data in bulk
     * @param {{name: string, dictionary: string}[]} tagList List of tag names and dictionaries to search for
     * @returns {Promise<Tag[]>} Array of matching tag meta entries
     */
    async findTagMetaBulk(
        tagList: {name: string, dictionary: string}[],
    ): Promise<Tag[]> {
        if (tagList.length === 0) {
            return [];
        }

        const results: Tag[] = [];
        const db = this._db.getDb();

        for (let i = 0; i < tagList.length; i++) {
            const {name, dictionary} = tagList[i];

            const rows = await db.select().from(schema.tagMeta)
                .where(and(
                    eq(schema.tagMeta.name, name),
                    eq(schema.tagMeta.dictionary, dictionary),
                ));

            for (const row of rows) {
                results.push({
                    name: row.name,
                    category: row.category,
                    order: row.order,
                    notes: row.notes,
                    score: row.score,
                    dictionary: row.dictionary,
                });
            }
        }

        return results;
    }

    /**
     * Get dictionary information
     * @returns {Promise<any[]>} Array of dictionary information objects
     */
    async getDictionaryInfo(): Promise<any[]> {
        const db = this._db.getDb();
        const rows = await db.select().from(schema.dictionaries);

        return rows.map((row) => {
            const counts = row.counts ? JSON.parse(row.counts) : {};
            return {
                title: row.title,
                version: row.version,
                revision: row.revision,
                sequenced: Boolean(row.sequenced),
                author: row.author,
                url: row.url,
                description: row.description,
                attribution: row.attribution,
                frequencyMode: row.frequencyMode,
                prefixWildcardsSupported: Boolean(row.prefixWildcardsSupported),
                styles: row.styles,
                counts,
                yomitanVersion: row.yomitanVersion,
            };
        });
    }

    /**
     * Get dictionary counts
     * @param {string[]} dictionaryNames List of dictionary names to get counts for
     * @param {boolean} getTotal Whether to include total counts
     * @returns {Promise<DictionaryCounts>} Object containing dictionary counts
     */
    async getDictionaryCounts(
        dictionaryNames: string[],
        getTotal: boolean,
    ): Promise<DictionaryCounts> {
        const db = this._db.getDb();
        const counts: DictionaryCountGroup[] = [];

        for (const dictionary of dictionaryNames) {
            const countGroup: DictionaryCountGroup = {dictionary};

            // Count terms
            const termCount = await db.select({count: db.fn.count()})
                .from(schema.terms)
                .where(eq(schema.terms.dictionary, dictionary));
            countGroup.terms = Number(termCount[0].count);

            // Count kanji
            const kanjiCount = await db.select({count: db.fn.count()})
                .from(schema.kanji)
                .where(eq(schema.kanji.dictionary, dictionary));
            countGroup.kanji = Number(kanjiCount[0].count);

            // Count termMeta
            const termMetaCount = await db.select({count: db.fn.count()})
                .from(schema.termMeta)
                .where(eq(schema.termMeta.dictionary, dictionary));
            countGroup.termMeta = Number(termMetaCount[0].count);

            // Count kanjiMeta
            const kanjiMetaCount = await db.select({count: db.fn.count()})
                .from(schema.kanjiMeta)
                .where(eq(schema.kanjiMeta.dictionary, dictionary));
            countGroup.kanjiMeta = Number(kanjiMetaCount[0].count);

            // Count tagMeta
            const tagMetaCount = await db.select({count: db.fn.count()})
                .from(schema.tagMeta)
                .where(eq(schema.tagMeta.dictionary, dictionary));
            countGroup.tagMeta = Number(tagMetaCount[0].count);

            // Count media
            const mediaCount = await db.select({count: db.fn.count()})
                .from(schema.media)
                .where(eq(schema.media.dictionary, dictionary));
            countGroup.media = Number(mediaCount[0].count);

            counts.push(countGroup);
        }

        let total: DictionaryCountGroup | null = null;

        if (getTotal) {
            total = {dictionary: 'total'};

            // Calculate totals
            for (const count of counts) {
                for (const [key, value] of Object.entries(count)) {
                    if (key !== 'dictionary') {
                        if (total[key] === undefined) {
                            total[key] = 0;
                        }
                        total[key] += value;
                    }
                }
            }
        }

        return {total, counts};
    }

    /**
     * Check if a dictionary exists
     * @param {string} title The title of the dictionary to check
     * @returns {Promise<boolean>} True if the dictionary exists, false otherwise
     */
    async dictionaryExists(title: string): Promise<boolean> {
        const db = this._db.getDb();
        const result = await db.select().from(schema.dictionaries)
            .where(eq(schema.dictionaries.title, title));

        return result.length > 0;
    }

    /**
     * Add items to the database in bulk
     * @param {ObjectStoreName} objectStoreName The name of the object store to add to
     * @param {any[]} items The items to add
     * @param {number} start The starting index of items to add
     * @param {number} count The number of items to add
     * @returns {Promise<void>}
     */
    async bulkAdd<T extends ObjectStoreName>(
        objectStoreName: T,
        items: any[],
        start: number,
        count: number,
    ): Promise<void> {
        if (items.length === 0 || count <= 0) {
            return;
        }

        const end = Math.min(start + count, items.length);
        const itemsToAdd = items.slice(start, end);
        const db = this._db.getDb();

        // Process items based on the object store
        switch (objectStoreName) {
            case 'dictionaries':
                for (const item of itemsToAdd) {
                    await db.insert(schema.dictionaries).values({
                        title: item.title,
                        version: item.version,
                        revision: item.revision,
                        sequenced: item.sequenced ? 1 : 0,
                        author: item.author,
                        url: item.url,
                        description: item.description,
                        attribution: item.attribution,
                        frequencyMode: item.frequencyMode,
                        prefixWildcardsSupported: item.prefixWildcardsSupported ? 1 : 0,
                        styles: item.styles,
                        counts: JSON.stringify(item.counts),
                        yomitanVersion: item.yomitanVersion,
                    });
                }
                break;

            case 'terms':
                for (const item of itemsToAdd) {
                    // Process term for reverse lookup if needed
                    let expressionReverse = undefined;
                    let readingReverse = undefined;

                    if (item.expression) {
                        expressionReverse = this._reverseString(item.expression);
                    }

                    if (item.reading) {
                        readingReverse = this._reverseString(item.reading);
                    }

                    await db.insert(schema.terms).values({
                        dictionary: item.dictionary,
                        expression: item.expression,
                        reading: item.reading,
                        expressionReverse,
                        readingReverse,
                        definitionTags: item.definitionTags || item.tags,
                        rules: item.rules,
                        score: item.score,
                        glossary: JSON.stringify(item.glossary),
                        sequence: item.sequence,
                        termTags: item.termTags,
                    });
                }
                break;

            case 'termMeta':
                for (const item of itemsToAdd) {
                    await db.insert(schema.termMeta).values({
                        dictionary: item.dictionary,
                        term: item.term,
                        mode: item.mode,
                        data: JSON.stringify(item.data),
                    });
                }
                break;

            case 'kanji':
                for (const item of itemsToAdd) {
                    await db.insert(schema.kanji).values({
                        dictionary: item.dictionary,
                        character: item.character,
                        onyomi: item.onyomi,
                        kunyomi: item.kunyomi,
                        tags: item.tags,
                        meanings: JSON.stringify(item.meanings),
                        stats: item.stats ? JSON.stringify(item.stats) : null,
                    });
                }
                break;

            case 'kanjiMeta':
                for (const item of itemsToAdd) {
                    await db.insert(schema.kanjiMeta).values({
                        dictionary: item.dictionary,
                        character: item.character,
                        mode: item.mode,
                        data: JSON.stringify(item.data),
                    });
                }
                break;

            case 'tagMeta':
                for (const item of itemsToAdd) {
                    await db.insert(schema.tagMeta).values({
                        dictionary: item.dictionary,
                        name: item.name,
                        category: item.category,
                        order: item.order,
                        notes: item.notes,
                        score: item.score,
                    });
                }
                break;

            case 'media':
                for (const item of itemsToAdd) {
                    await db.insert(schema.media).values({
                        dictionary: item.dictionary,
                        path: item.path,
                        mediaType: item.mediaType,
                        width: item.width,
                        height: item.height,
                        content: Buffer.from(item.content),
                    });
                }
                break;
        }
    }

    // Helper method to reverse a string (for suffix matching)
    /**
     * Helper method to reverse a string (for suffix matching)
     * @param {string} str The string to reverse
     * @returns {string} The reversed string
     */
    private _reverseString(str: string): string {
        return [...str].reverse().join('');
    }
}

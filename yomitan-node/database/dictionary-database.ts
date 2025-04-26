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
import {eq, like, and, count as _count} from 'drizzle-orm';
import {SQLiteDatabase} from './sqlite-database.js';
import {parseJson} from '../../ext/js/core/json.js';
import type {
    DictionaryCounts,
    DictionarySet,
    KanjiEntry,
    MatchType,
    Tag,
    TermEntry,
    DictionaryCountGroup,
    ObjectStoreName,
    TermMeta,
    KanjiMeta,
    ObjectStoreData,
    KanjiMetaType,
    DatabaseTermEntry,
    DatabaseTermMeta,
    DatabaseKanjiEntry,
    DatabaseKanjiMeta,
    MediaDataArrayBufferContent,
} from '../../types/ext/dictionary-database.js';
import type {Summary} from '../../types/ext/dictionary-importer.js';
import type {TermGlossary} from '../../types/ext/dictionary-data.js';

// Main DictionaryDatabase class
export class DictionaryDatabase {
    /**
     * The SQLiteDatabase instance
     */
    private _db: SQLiteDatabase;
    /**
     * The name/filename of the sqlite database
     */
    private _dbName: string;
    /**
     * Whether the database is open
     */
    private _isOpen: boolean = false;

    constructor() {
        /**
         * The name/filename of the sqlite database
         */
        this._dbName = 'file:dict.sqlite';
        /**
         * Initialize the SQLiteDatabase instance
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
            }

            const rows = await query;

            // Filter by dictionaries
            for (const row of rows) {
                if (dictionaries.has(row.dictionary)) {
                    const definitionTags = row.definitionTags ? row.definitionTags.split(' ') : [];
                    const termTags = row.termTags ? row.termTags.split(' ') : [];
                    const rules = row.rules ? row.rules.split(' ') : [];
                    const glossary = parseJson<TermGlossary[]>(row.glossary);

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
            const {term, reading} = termList[i]!;

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
                    const glossary = parseJson<TermGlossary[]>(row.glossary);

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
            const character = kanjiList[i]!;

            const rows = await db.select().from(schema.kanji)
                .where(eq(schema.kanji.character, character));

            for (const row of rows) {
                if (dictionaries.has(row.dictionary)) {
                    const onyomi = row.onyomi ? row.onyomi.split(' ') : [];
                    const kunyomi = row.kunyomi ? row.kunyomi.split(' ') : [];
                    const tags = row.tags ? row.tags.split(' ') : [];
                    const meanings = parseJson<string[]>(row.meanings);
                    const stats = row.stats ? parseJson<{[name: string]: string}>(row.stats) : {};

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
     * @returns {Promise<TermMeta[]>} Array of matching term meta entries
     */
    async findTermMetaBulk(
        termList: string[],
        dictionaries: DictionarySet,
    ): Promise<TermMeta[]> {
        if (termList.length === 0) {
            return [];
        }

        const results: TermMeta[] = [];
        const db = this._db.getDb();

        for (let i = 0; i < termList.length; i++) {
            const term = termList[i]!;

            const rows = await db.select().from(schema.termMeta)
                .where(eq(schema.termMeta.term, term));

            for (const row of rows) {
                if (dictionaries.has(row.dictionary)) {
                    results.push({
                        index: i,
                        term: row.term,
                        // @ts-expect-error - While there's 3 separate types, they all have same fields
                        mode: row.mode,
                        data: parseJson(row.data),
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
     * @returns {Promise<KanjiMeta[]>} Array of matching kanji meta entries
     */
    async findKanjiMetaBulk(
        kanjiList: string[],
        dictionaries: DictionarySet,
    ): Promise<KanjiMeta[]> {
        if (kanjiList.length === 0) {
            return [];
        }

        const results: KanjiMeta[] = [];
        const db = this._db.getDb();

        for (let i = 0; i < kanjiList.length; i++) {
            const character = kanjiList[i]!;

            const rows = await db.select().from(schema.kanjiMeta)
                .where(eq(schema.kanjiMeta.character, character));

            for (const row of rows) {
                if (dictionaries.has(row.dictionary)) {
                    const mode = row.mode as KanjiMetaType;
                    results.push({
                        index: i,
                        character: row.character,
                        mode,
                        data: parseJson(row.data),
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
            const {name, dictionary} = tagList[i]!;

            const rows = await db.select().from(schema.tagMeta)
                .where(and(
                    eq(schema.tagMeta.name, name),
                    eq(schema.tagMeta.dictionary, dictionary),
                ));

            for (const row of rows) {
                results.push({
                    name: row.name,
                    category: row.category,
                    order: row.orderValue,
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
     * @returns {Promise<Summary[]>} Array of dictionary information objects
     */
    async getDictionaryInfo(): Promise<Summary[]> {
        const db = this._db.getDb();
        const rows = await db.select().from(schema.dictionaries);
        return rows.map((row) => ({
            title: row.title,
            version: row.version,
            revision: row.revision ?? '',
            sequenced: Boolean(row.sequenced),
            author: row.author ?? undefined,
            url: row.url ?? undefined,
            description: row.description ?? undefined,
            attribution: row.attribution ?? undefined,
            frequencyMode: row.frequencyMode === null ? undefined : row.frequencyMode as 'occurrence-based' | 'rank-based',
            prefixWildcardsSupported: row.prefixWildcardsSupported === 1,
            styles: row.styles || '',
            counts: row.counts ? parseJson(row.counts) : undefined,
            yomitanVersion: row.yomitanVersion,
            importDate: Date.now(),
        }));
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
            const countGroup: DictionaryCountGroup = {};

            // Count terms
            const termCount = await db.select({count: _count()})
                .from(schema.terms)
                .where(eq(schema.terms.dictionary, dictionary));
            countGroup.terms = Number(termCount[0]?.count);

            // Count kanji
            const kanjiCount = await db.select({count: _count()})
                .from(schema.kanji)
                .where(eq(schema.kanji.dictionary, dictionary));
            countGroup.kanji = Number(kanjiCount[0]?.count);

            // Count termMeta
            const termMetaCount = await db.select({count: _count()})
                .from(schema.termMeta)
                .where(eq(schema.termMeta.dictionary, dictionary));
            countGroup.termMeta = Number(termMetaCount[0]?.count);

            // Count kanjiMeta
            const kanjiMetaCount = await db.select({count: _count()})
                .from(schema.kanjiMeta)
                .where(eq(schema.kanjiMeta.dictionary, dictionary));
            countGroup.kanjiMeta = Number(kanjiMetaCount[0]?.count);

            // Count tagMeta
            const tagMetaCount = await db.select({count: _count()})
                .from(schema.tagMeta)
                .where(eq(schema.tagMeta.dictionary, dictionary));
            countGroup.tagMeta = Number(tagMetaCount[0]?.count);

            // Count media
            const mediaCount = await db.select({count: _count()})
                .from(schema.media)
                .where(eq(schema.media.dictionary, dictionary));
            countGroup.media = Number(mediaCount[0]?.count);

            counts.push(countGroup);
        }

        let total: DictionaryCountGroup | null = null;

        if (getTotal) {
            total = {
                terms: 0,
                kanji: 0,
                termMeta: 0,
                kanjiMeta: 0,
                tagMeta: 0,
                media: 0,
            };
            for (const count of counts) {
                total.terms! += count.terms!;
                total.kanji! += count.kanji!;
                total.termMeta! += count.termMeta!;
                total.kanjiMeta! += count.kanjiMeta!;
                total.tagMeta! += count.tagMeta!;
                total.media! += count.media!;
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
     * @param {ObjectStoreData<ObjectStoreName>[]} items The items to add
     * @param {number} start The starting index of items to add
     * @param {number} count The number of items to add
     * @returns {Promise<void>}
     */
    async bulkAdd<T extends ObjectStoreName>(
        objectStoreName: T,
        items: ObjectStoreData<T>[],
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
            case 'dictionaries': {
                const typedItems = itemsToAdd as Summary[];
                for (const item of typedItems) {
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
                    });
                }
                break;
            }

            case 'terms': {
                const typedItems = itemsToAdd as DatabaseTermEntry[];
                for (const item of typedItems) {
                    // Process term for reverse lookup if needed
                    let expressionReverse: string | undefined;
                    let readingReverse: string | undefined;

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
            }

            case 'termMeta': {
                const typedItems = itemsToAdd as DatabaseTermMeta[];
                for (const item of typedItems) {
                    await db.insert(schema.termMeta).values({
                        dictionary: item.dictionary,
                        term: item.expression,
                        mode: item.mode,
                        data: JSON.stringify(item.data),
                    });
                }
                break;
            }

            case 'kanji': {
                const typedItems = itemsToAdd as DatabaseKanjiEntry[];
                for (const item of typedItems) {
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
            }

            case 'kanjiMeta': {
                const typedItems = itemsToAdd as DatabaseKanjiMeta[];
                for (const item of typedItems) {
                    await db.insert(schema.kanjiMeta).values({
                        dictionary: item.dictionary,
                        character: item.character,
                        mode: item.mode,
                        data: JSON.stringify(item.data),
                    });
                }
                break;
            }

            case 'tagMeta': {
                const typedItems = itemsToAdd as Tag[];
                for (const item of typedItems) {
                    await db.insert(schema.tagMeta).values({
                        dictionary: item.dictionary,
                        name: item.name,
                        category: item.category,
                        orderValue: item.order,
                        notes: item.notes,
                        score: item.score,
                    });
                }
                break;
            }

            case 'media': {
                const typedItems = itemsToAdd as MediaDataArrayBufferContent[];
                for (const item of typedItems) {
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

    /**
     * Find a tag by title
     * @param {string} title The title of the tag to find
     * @returns {Promise<Tag[]>} Array of matching tags
     */
    async findTagForTitle(title: string): Promise<Tag[]> {
        const rows = await this._db.getDb().select().from(schema.tagMeta)
            .where(like(schema.tagMeta.name, title));
        return rows.map((row) => ({
            name: row.name,
            category: row.category,
            order: row.orderValue,
            dictionary: row.dictionary,
            notes: row.notes,
            score: row.score,
        }));
    }
}

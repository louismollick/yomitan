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

import {integer, text, blob, sqliteTable, index} from 'drizzle-orm/sqlite-core';

// Define the schema for the dictionaries table
export const dictionaries = sqliteTable('dictionaries', {
    title: text('title').primaryKey(),
    version: integer('version').notNull(),
    revision: text('revision'),
    sequenced: integer('sequenced'),
    author: text('author'),
    url: text('url'),
    description: text('description'),
    attribution: text('attribution'),
    frequencyMode: text('frequency_mode'),
    prefixWildcardsSupported: integer('prefix_wildcards_supported'),
    styles: text('styles'),
    counts: text('counts'), // JSON string
    yomitanVersion: text('yomitan_version'),
});

// Define the schema for the terms table
export const terms = sqliteTable(
    'terms',
    {
        id: integer('id').primaryKey({autoIncrement: true}),
        dictionary: text('dictionary').notNull(),
        expression: text('expression').notNull(),
        reading: text('reading').notNull(),
        expressionReverse: text('expression_reverse'),
        readingReverse: text('reading_reverse'),
        definitionTags: text('definition_tags'),
        rules: text('rules').notNull(),
        score: integer('score').notNull(),
        glossary: text('glossary').notNull(), // JSON string
        sequence: integer('sequence'),
        termTags: text('term_tags'),
    },
    (table) => [
        index('idx_terms_dictionary').on(table.dictionary),
        index('idx_terms_expression').on(table.expression),
        index('idx_terms_reading').on(table.reading),
        index('idx_terms_expression_reverse').on(table.expressionReverse),
        index('idx_terms_reading_reverse').on(table.readingReverse),
        index('idx_terms_sequence').on(table.sequence),
    ],
);

// Define the schema for the termMeta table
export const termMeta = sqliteTable(
    'term_meta',
    {
        id: integer('id').primaryKey({autoIncrement: true}),
        dictionary: text('dictionary').notNull(),
        term: text('term').notNull(),
        mode: text('mode').notNull(),
        data: text('data').notNull(), // JSON string
    },
    (table) => [
        index('idx_term_meta_dictionary').on(table.dictionary),
        index('idx_term_meta_term').on(table.term),
        index('idx_term_meta_mode').on(table.mode),
    ],
);

// Define the schema for the kanji table
export const kanji = sqliteTable(
    'kanji',
    {
        id: integer('id').primaryKey({autoIncrement: true}),
        dictionary: text('dictionary').notNull(),
        character: text('character').notNull(),
        onyomi: text('onyomi').notNull(),
        kunyomi: text('kunyomi').notNull(),
        tags: text('tags').notNull(),
        meanings: text('meanings').notNull(), // JSON string
        stats: text('stats'), // JSON string
    },
    (table) => [
        index('idx_kanji_dictionary').on(table.dictionary),
        index('idx_kanji_character').on(table.character),
    ],
);

// Define the schema for the kanjiMeta table
export const kanjiMeta = sqliteTable(
    'kanji_meta',
    {
        id: integer('id').primaryKey({autoIncrement: true}),
        dictionary: text('dictionary').notNull(),
        character: text('character').notNull(),
        mode: text('mode').notNull(),
        data: text('data').notNull(), // JSON string
    },
    (table) => [
        index('idx_kanji_meta_dictionary').on(table.dictionary),
        index('idx_kanji_meta_character').on(table.character),
        index('idx_kanji_meta_mode').on(table.mode),
    ],
);

// Define the schema for the tagMeta table
export const tagMeta = sqliteTable(
    'tag_meta',
    {
        id: integer('id').primaryKey({autoIncrement: true}),
        dictionary: text('dictionary').notNull(),
        name: text('name').notNull(),
        category: text('category').notNull(),
        orderValue: integer('order_value').notNull(),
        notes: text('notes').notNull(),
        score: integer('score').notNull(),
    },
    (table) => [
        index('idx_tag_meta_dictionary').on(table.dictionary),
        index('idx_tag_meta_name').on(table.name),
        index('idx_tag_meta_category').on(table.category),
    ],
);

// Define the schema for the media table
export const media = sqliteTable(
    'media',
    {
        id: integer('id').primaryKey({autoIncrement: true}),
        dictionary: text('dictionary').notNull(),
        path: text('path').notNull(),
        mediaType: text('media_type').notNull(),
        width: integer('width').notNull(),
        height: integer('height').notNull(),
        content: blob('content').notNull(), // Binary data
    },
    (table) => [
        index('idx_media_dictionary').on(table.dictionary),
        index('idx_media_path').on(table.path),
    ],
);

export type Dictionary = typeof dictionaries.$inferSelect;

export type NewDictionary = typeof dictionaries.$inferInsert;

export type Term = typeof terms.$inferSelect;

export type NewTerm = typeof terms.$inferInsert;

export type TermMeta = typeof termMeta.$inferSelect;

export type NewTermMeta = typeof termMeta.$inferInsert;

export type Kanji = typeof kanji.$inferSelect;

export type NewKanji = typeof kanji.$inferInsert;

export type KanjiMeta = typeof kanjiMeta.$inferSelect;

export type NewKanjiMeta = typeof kanjiMeta.$inferInsert;

export type TagMeta = typeof tagMeta.$inferSelect;

export type NewTagMeta = typeof tagMeta.$inferInsert;

export type Media = typeof media.$inferSelect;

export type NewMedia = typeof media.$inferInsert;

import { integer, text, blob, sqliteTable } from 'drizzle-orm/sqlite-core';
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
export const terms = sqliteTable('terms', {
    id: integer('id').primaryKey({ autoIncrement: true }),
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
});
// Define the schema for the termMeta table
export const termMeta = sqliteTable('term_meta', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    dictionary: text('dictionary').notNull(),
    term: text('term').notNull(),
    mode: text('mode').notNull(),
    data: text('data').notNull(), // JSON string
});
// Define the schema for the kanji table
export const kanji = sqliteTable('kanji', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    dictionary: text('dictionary').notNull(),
    character: text('character').notNull(),
    onyomi: text('onyomi').notNull(),
    kunyomi: text('kunyomi').notNull(),
    tags: text('tags').notNull(),
    meanings: text('meanings').notNull(), // JSON string
    stats: text('stats'), // JSON string
});
// Define the schema for the kanjiMeta table
export const kanjiMeta = sqliteTable('kanji_meta', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    dictionary: text('dictionary').notNull(),
    character: text('character').notNull(),
    mode: text('mode').notNull(),
    data: text('data').notNull(), // JSON string
});
// Define the schema for the tagMeta table
export const tagMeta = sqliteTable('tag_meta', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    dictionary: text('dictionary').notNull(),
    name: text('name').notNull(),
    category: text('category').notNull(),
    orderValue: integer('order_value').notNull(),
    notes: text('notes').notNull(),
    score: integer('score').notNull(),
});
// Define the schema for the media table
export const media = sqliteTable('media', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    dictionary: text('dictionary').notNull(),
    path: text('path').notNull(),
    mediaType: text('media_type').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    content: blob('content').notNull(), // Binary data
});

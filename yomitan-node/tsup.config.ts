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

import {defineConfig} from 'tsup';
import copy from 'esbuild-plugin-copy';

export default defineConfig({
    entry: ['index.ts', 'cli.ts'],
    format: ['cjs', 'esm'],
    experimentalDts: true,
    clean: true,
    external: ['esbuild'],
    esbuildPlugins: [
        copy({
            resolveFrom: 'cwd',
            assets: [{
                from: ['../ext/templates-display.html'],
                to: ['./dist/templates-display.html'],
            },
            {
                from: ['../ext/data/templates/default-anki-field-templates.handlebars'],
                to: ['./dist/data/templates/default-anki-field-templates.handlebars'],
            },
            {
                from: ['../ext/data/schemas/options-schema.json'],
                to: ['./dist/data/schemas/options-schema.json'],
            }],
        }),
    ],
});

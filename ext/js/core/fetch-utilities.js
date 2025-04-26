/*
 * Copyright (C) 2024-2025  Yomitan Authors
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

import {promises as fs} from 'fs';
import path from 'path';
import {parseJson} from './json.js';

// /**
//  * @param {string} url
//  * @returns {Promise<Response>}
//  */
// async function fetchAsset(url) {
//     const response = await fetch(chrome.runtime.getURL(url), {
//         method: 'GET',
//         mode: 'no-cors',
//         cache: 'default',
//         credentials: 'omit',
//         redirect: 'follow',
//         referrerPolicy: 'no-referrer',
//     });
//     if (!response.ok) {
//         throw new Error(`Failed to fetch ${url}: ${response.status}`);
//     }
//     return response;
// }


/**
 * @param {string} url
 * @returns {Promise<string>}
 */
export async function fetchText(url) {
    // eslint-disable-next-line unicorn/prefer-module
    const distDir = import.meta.dirname ?? __dirname; // TODO: figure how to do this cleaner by separating exports for ESM/CJS
    return fs.readFile(path.join(distDir, url), 'utf8');
}

/**
 * @template [T=unknown]
 * @param {string} url
 * @returns {Promise<T>}
 */
export async function fetchJson(url) {
    // eslint-disable-next-line unicorn/prefer-module
    const distDir = import.meta.dirname ?? __dirname; // TODO: figure how to do this cleaner by separating exports for ESM/CJS
    const text = await fs.readFile(path.join(distDir, url), 'utf8');
    return parseJson(text);
}

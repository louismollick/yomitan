# Yomitan Node.js Library

This is a Node.js library that provides access to Yomitan's dictionary lookup functionality for Japanese term lookups. It can be used to build applications that need Japanese dictionary capabilities.

## Prerequisites

- Node.js (v18 or later recommended)
- A Yomitan dictionary file (e.g., `jitendex-yomitan.zip`)

## Installation

```bash
npm install yomitan-node
```

Or if you're using the library directly from the repository:

```bash
npm install
```

## Setup

1. Place the `jitendex-yomitan.zip` file in one of these locations:

   - The current directory of the project
   - In the `node/` directory
   - In the parent directory

2. Build the library:

   ```bash
   npm run build
   ```

## Usage

### ESM (ES Modules)

```typescript
import { Yomitan } from "yomitan-node-server";

const yomitan = new Yomitan();

// Initialize the dictionary database and translator
await yomitan.initialize();

// Look up a term
const result = await yomitan.lookupTerm("日本語");
console.log(result);

// Generate HTML for the results
const html = await yomitan.generateHtml(result.dictionaryEntries);
console.log(html);
```

### CommonJS

```typescript
const { Yomitan } = require("yomitan-node-server");

const yomitan = new Yomitan();

yomitan.initialize().then(() => {
  console.log("Initialized");
  yomitan.lookupTerm("日本語").then((result) => {
    console.log(yomitan.generateHtml(result.dictionaryEntries));
  });
});
```

## API Reference

### `Yomitan` Class

The main class that provides dictionary functionality.

#### `initialize(): Promise<boolean>`

Initializes the dictionary database and translator. Returns a promise that resolves to `true` if initialization succeeded.

#### `lookupTerm(term: string): Promise<LookupTermResult>`

Looks up a Japanese term and returns the dictionary entries.

#### `lookupTermHtml(term: string): Promise<string>`

Looks up a Japanese term and returns the HTML representation of the results.

#### `generateHtml(dictionaryEntries: TermDictionaryEntry[]): Promise<string>`

Generates HTML from dictionary entries.

## How It Works

The library:

1. Initializes the Yomitan dictionary database using SQLite via Drizzle ORM
2. Imports a dictionary from a zip file
3. Sets up the translator for term lookups
4. Provides methods for looking up Japanese terms and generating HTML results

This allows you to use Yomitan's powerful Japanese dictionary functionality in any Node.js environment.

# Yomitan Node.js Server

This is a simple Node.js Express server that uses Yomitan's dictionary lookup functionality to provide Japanese term lookups via an HTTP API.

## Prerequisites

- Node.js (v18 or later recommended)
- A Yomitan dictionary file (e.g., `jitendex-yomitan.zip`)

## Setup

1. Place the `jitendex-yomitan.zip` file in one of these locations:

   - The root directory of the project
   - In the `ext/` directory
   - In the parent directory

2. Install dependencies:

   ```bash
   npm install express @types/express @types/node ts-node typescript
   ```

3. Build the server:

   ```bash
   tsc -p server-tsconfig.json
   ```

4. Run the server:

   ```bash
   node dist/server.js
   ```

   Or run directly with ts-node:

   ```bash
   npx ts-node-esm server.ts
   ```

## API Endpoints

### Lookup a Japanese term

```
GET /lookup/:term
```

Example:

```
GET /lookup/日本語
```

Response:

```json
{
  "dictionaryEntries": [...],
  "originalTextLength": 3
}
```

### Health check

```
GET /health
```

Response:

```json
{
  "status": "ok",
  "databaseInitialized": true,
  "translatorInitialized": true,
  "dictionaryName": "JitendEx"
}
```

## How It Works

The server:

1. Initializes the Yomitan dictionary database
2. Imports a dictionary from a zip file
3. Sets up the translator for term lookups
4. Exposes an HTTP endpoint for looking up Japanese terms

This allows you to use Yomitan's powerful Japanese dictionary functionality in a Node.js environment.

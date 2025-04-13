import express from 'express';
import path from 'path';
import fs from 'fs';
import { DictionaryDatabase } from './src/database/dictionary-database.js';
import { DictionaryImporter } from '../../ext/js/dictionary/dictionary-importer.js';
import { Translator } from '../../ext/js/language/translator.js';
import { createFindTermsOptions } from '../../test/utilities/translator.js';

// Simple media loader implementation for the dictionary importer
class SimpleMediaLoader {
  async getImageDetails(content: ArrayBuffer, mediaType: string) {
    // Return a minimal implementation that satisfies the interface
    return {
      content,
      width: 0,
      height: 0
    };
  }
}

// Main application class
class YomitanServer {
  private dictionaryDatabase: any;
  private translator: any;
  private dictionaryName: string = '';
  private app = express();
  private port = 3000;

  constructor() {
    this.app.use(express.json());
    this.setupRoutes();
  }

  private setupRoutes() {
    this.app.get('/lookup/:term', async (req, res) => {
      try {
        const term = req.params.term;
        if (!term) {
          return res.status(400).json({ error: 'Term parameter is required' });
        }

        if (!this.translator) {
          return res.status(500).json({ error: 'Translator not initialized' });
        }

        // Create options for the lookup
        const options = createFindTermsOptions(this.dictionaryName, {
          default: {
            type: 'terms',
            enabledDictionaryMap: [[this.dictionaryName, true]],
            removeNonJapaneseCharacters: false,
            language: 'ja'
          }
        }, 'default');

        // Perform the lookup
        const result = await this.translator.findTerms('simple', term, options);
        res.json(result);
      } catch (error) {
        console.error('Error during lookup:', error);
        res.status(500).json({ error: 'An error occurred during lookup' });
      }
    });

    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        databaseInitialized: !!this.dictionaryDatabase,
        translatorInitialized: !!this.translator,
        dictionaryName: this.dictionaryName || 'Not loaded'
      });
    });
  }

  async initialize() {
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
        path.resolve(process.cwd(), '../jitendex-yomitan.zip')
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

      const importResult = await dictionaryImporter.importDictionary(
        this.dictionaryDatabase,
        zipFileContent.buffer,
        {
          prefixWildcardsSupported: true,
          yomitanVersion: '0.0.0.0'
        }
      );

      if (importResult.errors && importResult.errors.length > 0) {
        console.error('Errors during dictionary import:', importResult.errors);
      }

      console.log(importResult.errors.forEach(err => console.error(err.message)));

      console.log(importResult.errors.some(err => err.message.includes('is already imported, skipped it')))

      if (importResult.result) {
        this.dictionaryName = importResult.result.title;
        console.log(`Dictionary imported: ${this.dictionaryName}`);
      } else if (importResult.errors.some(err => err.message.includes('is already imported, skipped it'))) {
        this.dictionaryName = 'Jitendex.org [2025-03-31]';
        console.log('Dictionary already imported');
      } else {
        throw new Error('Failed to import dictionary');
      }

      // Initialize translator
      console.log('Initializing translator...');
      this.translator = new Translator(this.dictionaryDatabase);
      this.translator.prepare();
      console.log('Translator initialized');

      return true;
    } catch (error) {
      console.error('Initialization error:', error);
      return false;
    }
  }

  async start() {
    const initialized = await this.initialize();
    if (!initialized) {
      console.error('Failed to initialize. Exiting...');
      process.exit(1);
    }

    this.app.listen(this.port, () => {
      console.log(`Yomitan server running at http://localhost:${this.port}`);
      console.log(`Try a lookup: http://localhost:${this.port}/lookup/日本語`);
    });
  }
}

// Start the server
const server = new YomitanServer();
server.start();

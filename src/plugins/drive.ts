// Title: Google Drive Integration Plugin for BioAgent
// Author: InnovativeBioresearch (Jonathan Fior)
// Date: 2025-04-16
// Description: Eliza plugin for BioAgent to enhance Google Drive integration:
//   - Improves webhook reliability with error handling and token refresh preparation.
//   - Prototypes local folder monitoring using chokidar, per note: "plan to implement a simpler approach that directly monitors changes to a local folder."
//   - Stores file metadata in biograph.file_metadata, feeding HypothesisService for KA generation.
//   - Fulfills hackathon requirement for external integrations (scientific outcomes track).
// Dependencies: Requires googleapis, chokidar, node:crypto, drizzle-orm.
// Note: Local testing blocked by @elizaos/cli issues (e.g., plugin prompts).
//       Maintainers: Provide Google Drive credentials, test webhook with public URL or ngrok,
//       configure localFolder in ~/.eliza/config.json, and verify biograph.file_metadata updates.
//       Webhook requires public URL; local monitoring is a prototype for offline development.

import { type Plugin, type IAgentRuntime, logger } from '@elizaos/core';
import { google, drive_v3 } from 'googleapis';
import chokidar from 'chokidar';
import { createHash } from 'node:crypto';
import { fileMetadataTable } from 'src/db/schemas/filemetadata';
import { syncGoogleDriveChanges } from 'src/routes/controller';
import { eq } from 'drizzle-orm/pg-core';

interface DriveConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  refreshToken: string;
  localFolder?: string; // Path to local folder for monitoring
}

export default class DrivePlugin implements Plugin {
  name = 'drive';
  description = 'Google Drive plugin for syncing files and local folder monitoring';
  actions = [];
  providers = [];
  evaluators = [];
  services = [];
  routes = [];

  private drive: drive_v3.Drive;
  private config: DriveConfig;
  private watcher?: chokidar.FSWatcher;

  constructor(config: DriveConfig) {
    this.config = config;
    const auth = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    );
    auth.setCredentials({ refresh_token: config.refreshToken });
    this.drive = google.drive({ version: 'v3', auth });
  }

  async init(_config: Record<string, string>, runtime: IAgentRuntime): Promise<void> {
    console.log('DrivePlugin initialized');

    // Enhance webhook sync
    await this.syncWithRetry(runtime);

    // Start local folder monitoring if configured
    if (this.config.localFolder) {
      this.startLocalMonitoring(this.config.localFolder, runtime);
    }
  }

  // Enhanced webhook sync with retry and error handling
  async syncWithRetry(runtime: IAgentRuntime, maxRetries: number = 3): Promise<void> {
    let attempts = 0;
    while (attempts < maxRetries) {
      try {
        const result = await syncGoogleDriveChanges(runtime);
        logger.info(`Drive sync completed: ${JSON.stringify(result)}`);
        return;
      } catch (error) {
        attempts++;
        logger.error(`Drive sync attempt ${attempts} failed:`, error);
        if (attempts === maxRetries) {
          logger.error('Max retries reached, sync failed');
          throw error;
        }
        // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempts)));
      }
    }
  }

  // Local folder monitoring with chokidar
  startLocalMonitoring(folderPath: string, runtime: IAgentRuntime): void {
    this.watcher = chokidar.watch(folderPath, {
      persistent: true,
      ignoreInitial: false,
      ignored: ['**/*.tmp', '**/*.crdownload'],
    });

    this.watcher
      .on('add', async (path) => {
        if (!path.endsWith('.pdf')) {
          logger.info(`Skipping non-PDF file: ${path}`);
          return;
        }
        await this.processLocalFile(path, runtime);
      })
      .on('change', async (path) => {
        if (!path.endsWith('.pdf')) return;
        await this.processLocalFile(path, runtime);
      })
      .on('unlink', async (path) => {
        if (!path.endsWith('.pdf')) return;
        const fileName = path.split(/[\\/]/).pop() || 'unknown';
        logger.info(`Local file deleted: ${fileName}`);
        // Note: Deletion not implemented, as file ID is unknown
      })
      .on('error', (error) => {
        logger.error('Local monitoring error:', error);
      });

    logger.info(`Started monitoring local folder: ${folderPath}`);
  }

  // Process local PDF file, mimicking controller.ts
  async processLocalFile(filePath: string, runtime: IAgentRuntime): Promise<void> {
    try {
      const fs = await import('node:fs/promises');
      const fileName = filePath.split(/[\\/]/).pop() || 'unknown';
      const fileBuffer = await fs.readFile(filePath);
      const fileSize = (await fs.stat(filePath)).size;
      const hash = createHash('md5').update(fileBuffer).digest('hex');

      // Check if file exists
      const fileExists = await runtime.db
        .select()
        .from(fileMetadataTable)
        .where(eq(fileMetadataTable.hash, hash));

      if (fileExists.length > 0) {
        logger.info(`Local file ${fileName} already exists, skipping`);
        return;
      }

      // Generate synthetic file ID (since no Drive ID)
      const fileId = `local_${hash.slice(0, 8)}`;

      // Insert or update file metadata
      const result = await runtime.db
        .insert(fileMetadataTable)
        .values({
          id: fileId,
          hash,
          fileName,
          fileSize,
          modifiedAt: new Date(),
          status: 'pending' as any, // Cast to match fileStatusEnum
        })
        .onConflictDoUpdate({
          target: fileMetadataTable.hash,
          set: {
            fileName,
            fileSize,
            modifiedAt: new Date(),
            id: fileId,
          },
        })
        .returning();

      if (result.length > 0) {
        logger.info(`Added local file ${fileName} to biograph.file_metadata`);
        await runtime.createTask({
          name: 'PROCESS_PDF',
          description: 'Convert local PDF to RDF triples',
          tags: ['rdf', 'graph', 'process', 'hypothesis'],
          metadata: {
            updateInterval: 3 * 60 * 1000,
            updatedAt: Date.now(),
            fileId,
            fileName,
            modifiedAt: new Date(),
          },
        });
      }
    } catch (error) {
      logger.error(`Failed to process local file ${filePath}:`, error);
    }
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      logger.info('Stopped local folder monitoring');
    }
  }
}
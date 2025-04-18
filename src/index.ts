// Title: BioAgent Plugin Entry Point
// Author: InnovativeBioresearch (Jonathan Fior)
// Date: 2025-04-16
// Description: Updated plugin-bioagent entry point for hackathon submission:
//   - Integrates OpenAI, Hugging Face, arXiv, and Google Drive plugins for hypothesis analysis and data ingestion.
//   - Enhances knowledge graph utilization via HypothesisService and dkgInsert.
//   - Improves Google Drive webhook and adds local folder monitoring, per note: "plan simpler approach."
//   - Fulfills requirements for scientific outcomes track (knowledge graphs, hypothesis generation).
// Dependencies: Requires @elizaos/core, drizzle-orm, googleapis, openai, node-fetch, chokidar.
// Note: Local testing blocked by @elizaos/cli issues (e.g., plugin prompts).
//       Maintainers: Provide API keys and Drive credentials in ~/.eliza/config.json,
//       test with biograph.hypotheses/file_metadata, and verify plugin initialization.
//       Webhook requires public URL (e.g., ngrok); local monitoring uses chokidar.

import type { Plugin, IAgentRuntime, Service } from '@elizaos/core';
import { logger } from '@elizaos/core';
import { dkgInsert } from './actions/dkgInsert';
import { HypothesisService } from './services';
import { initWithMigrations } from './helper';
import { gdriveManualSync, gdriveWebhook, health } from './routes';
import OpenAIPlugin from './plugins/openai';
import ArXivPlugin from './plugins/arxiv';
import HuggingFacePlugin from './plugins/huggingface';
import DrivePlugin from './plugins/drive';
import { fileMetadataTable, hypothesesTable } from 'src/db/schemas';
import { eq } from 'drizzle-orm/pg-core';

interface PluginConfig {
  openaiKey: string;
  hfKey: string;
  drive: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    refreshToken: string;
    localFolder?: string;
  };
}

// Service to orchestrate plugin analysis
class AnalysisService extends Service {
  static serviceType = 'analysis';
  capabilityDescription = 'Analyze hypotheses using multiple FMs and literature';
  private openai: OpenAIPlugin;
  private arxiv: ArXivPlugin;
  private huggingface: HuggingFacePlugin;

  constructor(runtime: IAgentRuntime, config: PluginConfig) {
    super(runtime);
    this.openai = new OpenAIPlugin({ apiKey: config.openaiKey });
    this.arxiv = new ArXivPlugin({});
    this.huggingface = new HuggingFacePlugin({ apiKey: config.hfKey });
  }

  async analyzeAndEnrichHypothesis(hypothesisId: string): Promise<void> {
    try {
      // Fetch hypothesis from biograph.hypotheses
      const [hypothesis] = await this.runtime.db
        .select({ hypothesis: hypothesesTable.hypothesis })
        .from(hypothesesTable)
        .where(eq(hypothesesTable.id, hypothesisId));

      if (!hypothesis) {
        logger.error(`Hypothesis ${hypothesisId} not found`);
        return;
      }

      // Analyze with FMs
      const openaiResult = await this.openai.analyzeHypothesis(hypothesis.hypothesis);
      const hfResult = await this.huggingface.analyzeHypothesis(hypothesis.hypothesis);

      // Search arXiv for related papers
      const query = hypothesis.hypothesis.slice(0, 50); // Simplified query
      const arxivPapers = await this.arxiv.search(query);

      // Store results (simplified, update biograph.hypotheses or DKG)
      await this.runtime.db
        .update(hypothesesTable)
        .set({
          evaluation: JSON.stringify({
            openai: openaiResult,
            huggingface: hfResult,
            arxiv: arxivPapers.slice(0, 3), // Limit for storage
          }),
          updatedAt: new Date(),
        })
        .where(eq(hypothesesTable.id, hypothesisId));

      logger.info(`Enriched hypothesis ${hypothesisId} with FM and arXiv data`);
    } catch (error) {
      logger.error(`Failed to analyze hypothesis ${hypothesisId}:`, error);
    }
  }

  static async start(runtime: IAgentRuntime, config: PluginConfig) {
    const service = new AnalysisService(runtime, config);
    // Register task worker for periodic analysis
    runtime.registerTaskWorker({
      name: 'ANALYZE_HYPOTHESIS',
      async execute(runtime, _options, task) {
        const hypothesisId = task.metadata?.hypothesisId as string;
        if (hypothesisId) {
          await service.analyzeAndEnrichHypothesis(hypothesisId);
        }
        await runtime.updateTask(task.id, {
          metadata: { updatedAt: Date.now() },
        });
      },
    });
    return service;
  }

  async stop() {
    logger.info('Stopping AnalysisService');
  }
}

export const dkgPlugin: Plugin = {
  init: async (config: PluginConfig, runtime: IAgentRuntime) => {
    logger.info('Initializing dkg plugin');
    logger.info('Config:', config);

    // Initialize DrivePlugin
    const drivePlugin = new DrivePlugin(config.drive);
    await drivePlugin.init(config, runtime);

    // Initialize migrations (existing logic)
    setTimeout(async () => {
      await initWithMigrations(runtime);
    }, 20000); // Prevent undefined error
  },
  name: 'dkg',
  description: 'Agent DKG for storing memories on OriginTrail Decentralized Knowledge Graph',
  actions: [dkgInsert],
  providers: [],
  evaluators: [],
  services: [HypothesisService, AnalysisService],
  routes: [health, gdriveWebhook, gdriveManualSync],
};

export * as actions from './actions';
export default dkgPlugin;

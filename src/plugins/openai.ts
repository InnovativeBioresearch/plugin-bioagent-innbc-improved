// Title: OpenAI Foundation Model Plugin for BioAgent
// Author: InnovativeBioresearch (Jonathan Fior)
// Date: 2025-04-16
// Description: Eliza plugin for BioAgent using OpenAI GPT-4:
//   - Analyzes hypotheses to generate scientific insights, enhancing knowledge graph utilization.
//   - Fulfills hackathon requirement for Foundation Model integration (scientific outcomes track).
//   - Designed to work with dkgPlugin and HypothesisService for hypothesis processing.
// Dependencies: Requires openai package and API key.
// Note: Local testing blocked by @elizaos/cli issues (e.g., GitHub login prompts).
//       Maintainers: Provide an OpenAI API key, verify integration with HypothesisService,
//       and test with biograph.hypotheses for storing results.

import OpenAI from 'openai';
import type { Plugin, IAgentRuntime } from '@elizaos/core';

export default class OpenAIPlugin implements Plugin {
  name = 'openai';
  description = 'OpenAI GPT-4 plugin for analyzing scientific hypotheses';
  actions = [];
  providers = [];
  evaluators = [];
  services = [];
  routes = [];

  private client: OpenAI;

  constructor(config: { apiKey: string }) {
    this.client = new OpenAI({ apiKey: config.apiKey });
  }

  async init(_config: Record<string, string>, _runtime: IAgentRuntime): Promise<void> {
    // No initialization needed; client is set up in constructor
    console.log('OpenAIPlugin initialized');
  }

  async analyzeHypothesis(hypothesis: string): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a scientific assistant specializing in analyzing research hypotheses. Provide evidence-based insights, citing relevant concepts or methodologies, and suggest potential experiments or validations.' },
          { role: 'user', content: `Analyze this hypothesis: ${hypothesis}` },
        ],
        max_tokens: 500,
        temperature: 0.7,
      });
      return response.choices[0].message.content || 'No analysis returned';
    } catch (error) {
      console.error('OpenAI analysis failed:', error);
      return 'Error analyzing hypothesis';
    }
  }
}
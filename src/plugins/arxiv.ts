// Title: arXiv Integration Plugin for BioAgent
// Author: InnovativeBioresearch (Jonathan Fior)
// Date: 2025-04-16
// Description: Eliza plugin for BioAgent to search arXiv for scientific papers:
//   - Queries arXiv API to retrieve relevant literature, enhancing knowledge graph connections.
//   - Fulfills hackathon requirement for external integrations (scientific outcomes track).
//   - Designed to work with dkgPlugin and HypothesisService for hypothesis and KA generation.
// Dependencies: Uses node-fetch for API requests.
// Note: Local testing blocked by @elizaos/cli issues (e.g., plugin prompts).
//       Maintainers: Test arXiv API, implement XML parsing for results, and integrate
//       with HypothesisService to store paper metadata in biograph.file_metadata or DKG.

import fetch from 'node-fetch';
import type { Plugin, IAgentRuntime } from '@elizaos/core';

interface ArXivResult {
  id: string;
  title: string;
  summary: string;
}

export default class ArXivPlugin implements Plugin {
  name = 'arxiv';
  description = 'arXiv API plugin for searching scientific literature';
  actions = [];
  providers = [];
  evaluators = [];
  services = [];
  routes = [];

  async init(_config: Record<string, string>, _runtime: IAgentRuntime): Promise<void> {
    // No initialization needed
    console.log('ArXivPlugin initialized');
  }

  async search(query: string, maxResults: number = 10): Promise<ArXivResult[]> {
    try {
      // Query arXiv API
      const response = await fetch(
        `http://export.arxiv.org/api/query?search_query=${encodeURIComponent(
          query
        )}&max_results=${maxResults}&sortBy=relevance&sortOrder=descending`
      );
      const xml = await response.text();

      // Simple XML parsing (placeholder, improve with xml2js for production)
      const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
      const results: ArXivResult[] = entries.map((entry) => {
        const idMatch = entry.match(/<id>(.*?)<\/id>/);
        const titleMatch = entry.match(/<title>(.*?)<\/title>/);
        const summaryMatch = entry.match(/<summary>(.*?)<\/summary>/);
        return {
          id: idMatch ? idMatch[1] : 'unknown',
          title: titleMatch ? titleMatch[1] : 'No title',
          summary: summaryMatch ? summaryMatch[1].replace(/(\r\n|\n|\r)/gm, ' ').trim() : 'No summary',
        };
      });

      console.log(`Found ${results.length} arXiv papers for query: ${query}`);
      return results;
    } catch (error) {
      console.error('arXiv search failed:', error);
      return [];
    }
  }
}
# plugin-bioagent-innbc-improved

**Bio x AI Hackathon Submission**: Enhanced plugin for Eliza AI to advance scientific discovery through knowledge graph utilization and hypothesis generation.

## Overview

This plugin extends [bio-xyz/plugin-bioagent](https://github.com/bio-xyz/plugin-bioagent) for the Bio x AI Hackathon (Scientific Outcomes track). It integrates Foundation Models (FMs) and external services to organize scientific data, generate hypotheses, and connect research, leveraging the OriginTrail Decentralized Knowledge Graph (DKG).

### Features
- **Foundation Models**:
  - OpenAI GPT-4 (`src/plugins/openai.ts`): Analyzes hypotheses for evidence-based insights.
  - Hugging Face BERT (`src/plugins/huggingface.ts`): Provides alternative FM analysis.
- **Integrations**:
  - arXiv API (`src/plugins/arxiv.ts`): Searches scientific literature to enrich hypotheses.
  - Google Drive (`src/plugins/drive.ts`): Syncs PDFs, supports webhook and local folder monitoring.
- **Knowledge Graph**:
  - Stores file metadata in `biograph.file_metadata` (via **BioAgents**).
  - Enriches hypotheses in `biograph.hypotheses` with FM and arXiv data.
  - Uses `dkgInsert` to store knowledge assets in OriginTrail DKG.
- **Hypothesis Processing**:
  - `HypothesisService` (`src/services/index.ts`): Processes PDFs into KAs.
  - `AnalysisService` (`src/index.ts`): Combines FMs and arXiv for hypothesis analysis.

## Installation

1. Clone the repo:
   ```bash
   git clone https://github.com/InnovativeBioresearch/plugin-bioagent-innbc-improved.git
   cd plugin-bioagent-innbc-improved

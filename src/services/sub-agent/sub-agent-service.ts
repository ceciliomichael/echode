import { 
  IndexingSettings, 
  SubAgentApiSettings, 
  SubAgentResult, 
  ProgressCallback 
} from './types';
import { SearchOrchestrator } from './search-orchestrator';

/**
 * SubAgentService - Orchestrates LLM-powered code search (v2)
 * 
 * This is a thin wrapper around SearchOrchestrator that provides
 * a clean public API for the sub-agent functionality.
 * 
 * Features:
 * - Parallel tool execution for faster search
 * - read_file_snippet and list_dir tools for better context
 * - Snippet-light output (metadata + reasons, code is optional)
 * - Optimized for large codebases
 * 
 * Architecture (SOLID principles):
 * - types.ts: Type definitions and interfaces
 * - llm-client.ts: LLM provider abstraction (Single Responsibility)
 * - tool-executor.ts: Tool execution and statistics (Single Responsibility)
 * - response-parser.ts: Response parsing and snippet hydration (Single Responsibility)
 * - search-orchestrator.ts: Workflow coordination (Open/Closed, Dependency Inversion)
 * - sub-agent-service.ts: Public API facade (Interface Segregation)
 */
export class SubAgentService {
  private orchestrator: SearchOrchestrator;

  constructor(
    indexingSettings: IndexingSettings,
    apiSettings: SubAgentApiSettings,
    onProgress?: ProgressCallback
  ) {
    this.orchestrator = new SearchOrchestrator(indexingSettings, apiSettings, onProgress);
  }

  /**
   * Execute the sub-agent search
   * 
   * @param query - Natural language search query
   * @param searchPath - Optional path to narrow search scope
   * @param hints - Optional keywords to guide the search
   * @param signal - Optional AbortSignal for cancellation
   * @returns Search results with snippets and statistics
   */
  async search(
    query: string, 
    searchPath?: string, 
    hints?: string[], 
    signal?: AbortSignal
  ): Promise<SubAgentResult> {
    return this.orchestrator.search(query, searchPath, hints, signal);
  }
}

// Re-export types for convenience
export type { 
  IndexingSettings, 
  SubAgentApiSettings, 
  SubAgentResult, 
  SearchSnippet,
  ProgressCallback 
} from './types';
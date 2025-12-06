import { 
  ConversationMessage, 
  SubAgentResult, 
  IndexingSettings, 
  SubAgentApiSettings, 
  ProgressCallback 
} from './types';
import { LLMClient } from './llm-client';
import { ToolExecutor } from './tool-executor';
import { ResponseParser } from './response-parser';
import { 
  EXPLORER_SYSTEM_PROMPT, 
  SYNTHESIZER_SYSTEM_PROMPT, 
  buildExplorerPrompt, 
  buildSynthesizerPrompt 
} from './sub-agent-prompt';
import { getWorkspaceRoot } from '../tools/utils/workspace-utils';
import { getWorkspaceFiles } from '../../utils/workspace-scanner';

/**
 * Search orchestrator for sub-agent
 * Coordinates the multi-turn search workflow with LLM and tools
 */
export class SearchOrchestrator {
  private llmClient: LLMClient;
  private toolExecutor: ToolExecutor;
  private responseParser: ResponseParser;
  private onProgress?: ProgressCallback;

  private static readonly MAX_ITERATIONS = 4;
  private static readonly MAX_PARALLEL_CALLS = 8;

  constructor(
    indexingSettings: IndexingSettings,
    apiSettings: SubAgentApiSettings,
    onProgress?: ProgressCallback
  ) {
    this.onProgress = onProgress;
    this.llmClient = new LLMClient(indexingSettings, apiSettings, onProgress);
    this.toolExecutor = new ToolExecutor(onProgress);
    this.responseParser = new ResponseParser(this.toolExecutor, onProgress);
  }

  /**
   * Execute the multi-turn search workflow
   */
  async search(
    query: string, 
    searchPath?: string, 
    hints?: string[], 
    signal?: AbortSignal
  ): Promise<SubAgentResult> {
    if (signal?.aborted) {
      throw new Error('Search aborted');
    }

    // Reset state for new search
    this.toolExecutor.reset();

    this.onProgress?.(`Starting sub-agent search for: "${query}"`);

    // Get workspace context
    const workspaceRoot = getWorkspaceRoot();
    const workspaceFiles = workspaceRoot ? getWorkspaceFiles(workspaceRoot) : undefined;

    if (signal?.aborted) {
      throw new Error('Search aborted');
    }

    // Initialize conversation
    const conversation: ConversationMessage[] = [
      { role: 'user', content: buildExplorerPrompt(query, searchPath, hints, workspaceFiles) }
    ];

    this.onProgress?.(`Starting search (${SearchOrchestrator.MAX_ITERATIONS} turns)`);

    // Phase 1: Tool-based exploration
    await this.executeExplorationPhase(conversation, signal);

    if (signal?.aborted) {
      throw new Error('Search aborted');
    }

    // Phase 2: Synthesis
    return await this.executeSynthesisPhase(conversation, query, signal);
  }

  /**
   * Phase 1: Execute tool-based exploration turns
   */
  private async executeExplorationPhase(
    conversation: ConversationMessage[],
    signal?: AbortSignal
  ): Promise<void> {
    let iteration = 0;

    while (iteration < SearchOrchestrator.MAX_ITERATIONS) {
      if (signal?.aborted) {
        throw new Error('Search aborted');
      }

      iteration++;
      this.toolExecutor.setIteration(iteration);

      this.onProgress?.(`Iteration ${iteration}/${SearchOrchestrator.MAX_ITERATIONS}: Thinking...`);

      // Get LLM response
      const response = await this.llmClient.call(conversation, EXPLORER_SYSTEM_PROMPT, signal);

      if (!response) {
        this.onProgress?.(`Error: No response from LLM`);
        break;
      }

      // Parse and execute tool calls
      const toolCalls = this.toolExecutor.parseToolCalls(response);

      if (toolCalls.length === 0) {
        // Push model to use tools
        conversation.push({ role: 'assistant', content: response });
        
        const turnsRemaining = SearchOrchestrator.MAX_ITERATIONS - iteration;
        conversation.push({ 
          role: 'user', 
          content: `You have ${turnsRemaining} turn(s) remaining. You MUST use grep_search, glob_search, read_file_snippet, or list_dir to explore the codebase. Do NOT provide <search_complete> yet - keep searching to gather more context.`
        });
        continue;
      }

      // Cap parallel tool calls
      const cappedToolCalls = toolCalls.slice(0, SearchOrchestrator.MAX_PARALLEL_CALLS);
      if (toolCalls.length > SearchOrchestrator.MAX_PARALLEL_CALLS) {
        this.onProgress?.(`Capped tool calls: ${cappedToolCalls.length}/${toolCalls.length}`);
      }

      // Execute tools in parallel
      this.onProgress?.(`Executing ${cappedToolCalls.length} tool(s) in parallel...`);
      const toolResults = await this.toolExecutor.executeToolsParallel(cappedToolCalls, signal);

      if (signal?.aborted) {
        throw new Error('Search aborted');
      }

      // Add to conversation
      conversation.push({ role: 'assistant', content: response });
      
      // Guide the model for remaining turns
      const turnsRemaining = SearchOrchestrator.MAX_ITERATIONS - iteration;
      let iterationGuide: string;
      
      if (turnsRemaining > 0) {
        iterationGuide = `\n\nTool results received. You have ${turnsRemaining} more turn(s) to search. Continue exploring with more targeted searches based on what you found. Do NOT provide <search_complete> yet.`;
      } else {
        iterationGuide = `\n\nTool results received. This was your final search turn. On the next message, you will be asked to provide your summary.`;
      }
      
      conversation.push({ role: 'user', content: `Tool results:${toolResults}${iterationGuide}` });
    }
  }

  /**
   * Phase 2: Execute synthesis to generate final result
   */
  private async executeSynthesisPhase(
    conversation: ConversationMessage[],
    query: string,
    signal?: AbortSignal
  ): Promise<SubAgentResult> {
    this.onProgress?.(`Synthesizing findings...`);

    if (signal?.aborted) {
      throw new Error('Search aborted');
    }

    // Add synthesis prompt
    conversation.push({
      role: 'user',
      content: buildSynthesizerPrompt(query)
    });

    // Get final response with synthesizer prompt
    const finalResponse = await this.llmClient.call(conversation, SYNTHESIZER_SYSTEM_PROMPT, signal);
    
    console.log('[EchoSearch] Final response received, length:', finalResponse?.length || 0);
    
    // Parse search_complete response
    if (finalResponse && finalResponse.includes('<search_complete>')) {
      return this.responseParser.parseSearchComplete(finalResponse, this.toolExecutor.getStats());
    }

    // Fallback handling
    console.log('[EchoSearch] Warning: LLM did not return <search_complete> block');
    console.log('[EchoSearch] Final response preview:', finalResponse?.substring(0, 500));

    const discoveredFiles = this.toolExecutor.getDiscoveredFiles();
    if (discoveredFiles.size > 0) {
      console.log('[EchoSearch] Using fallback with', discoveredFiles.size, 'discovered files');
      return this.responseParser.buildFallbackResult(
        finalResponse, 
        discoveredFiles, 
        this.toolExecutor.getStats()
      );
    }

    // Last resort fallback
    return {
      summary: 'Search completed but could not parse results.',
      highLevelAnswer: finalResponse || undefined,
      snippets: [],
      searchStats: this.toolExecutor.getStats(),
    };
  }
}
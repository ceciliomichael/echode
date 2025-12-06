import { ReadFileTool } from '../tools/read-file-tool';
import { ToolCall, SearchStats, DiscoveredFileInfo, ProgressCallback } from './types';
import { ToolCallParser } from './tool-call-parser';
import { ToolExecutorFactory } from './tool-executors';

/**
 * Tool executor for sub-agent
 * Orchestrates tool execution with statistics tracking
 */
export class ToolExecutor {
  private readFileTool = new ReadFileTool();
  private onProgress?: ProgressCallback;

  private stats: SearchStats = {
    iterations: 0,
    grepCalls: 0,
    globCalls: 0,
    readFileCalls: 0,
    listDirCalls: 0,
    filesScanned: 0,
    totalMatches: 0,
  };

  private discoveredFiles: Map<string, DiscoveredFileInfo> = new Map();

  private static readonly MAX_PARALLEL_CALLS = 8;

  constructor(onProgress?: ProgressCallback) {
    this.onProgress = onProgress;
  }

  /**
   * Get current statistics
   */
  getStats(): SearchStats {
    return { ...this.stats };
  }

  /**
   * Get discovered files
   */
  getDiscoveredFiles(): Map<string, DiscoveredFileInfo> {
    return new Map(this.discoveredFiles);
  }

  /**
   * Update iteration count
   */
  setIteration(iteration: number): void {
    this.stats.iterations = iteration;
  }

  /**
   * Reset statistics and discovered files
   */
  reset(): void {
    this.stats = {
      iterations: 0,
      grepCalls: 0,
      globCalls: 0,
      readFileCalls: 0,
      listDirCalls: 0,
      filesScanned: 0,
      totalMatches: 0,
    };
    this.discoveredFiles.clear();
  }

  /**
   * Parse tool calls from LLM response
   */
  parseToolCalls(response: string): ToolCall[] {
    return ToolCallParser.parse(response);
  }

  /**
   * Execute multiple tools in parallel
   */
  async executeToolsParallel(
    toolCalls: ToolCall[],
    signal?: AbortSignal
  ): Promise<string> {
    const resultPromises = toolCalls.map(async (toolCall) => {
      if (signal?.aborted) {
        return `<tool_result name="${toolCall.name}">\nAborted\n</tool_result>`;
      }

      const paramDesc = toolCall.params.query
        || toolCall.params.pattern
        || toolCall.params.path
        || Object.values(toolCall.params).find(v => v && v.trim())
        || toolCall.name;
      this.onProgress?.(`  → ${toolCall.name}(${paramDesc})`);

      const result = await this.executeTool(toolCall);
      return `<tool_result name="${toolCall.name}">\n${result}\n</tool_result>`;
    });

    const results = await Promise.all(resultPromises);
    return '\n\n' + results.join('\n\n');
  }

  /**
   * Execute a single tool call using the factory pattern
   */
  private async executeTool(toolCall: ToolCall): Promise<string> {
    try {
      const executor = ToolExecutorFactory.getExecutor(toolCall.name);
      if (executor) {
        return await executor.execute(toolCall.params, this.stats, this.discoveredFiles);
      }
      return `Unknown tool: ${toolCall.name}`;
    } catch (error) {
      return `Tool error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Hydrate snippet with actual file content
   */
  async hydrateSnippet(path: string, startLine: number, endLine: number): Promise<string> {
    try {
      const maxLines = 100;
      const count = Math.min(endLine - startLine + 1, maxLines);

      const result = await this.readFileTool.execute({
        path,
        offset: startLine,
        limit: count
      });

      if (result.success && result.data) {
        const data = result.data as { content?: string };
        return data.content || '';
      }
    } catch (_error) {
      console.warn(`Failed to hydrate snippet for ${path}:`, _error);
    }
    return '';
  }
}
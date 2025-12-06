import { SearchSnippet, SubAgentResult, SearchStats, DiscoveredFileInfo, ProgressCallback } from './types';
import { ToolExecutor } from './tool-executor';

/**
 * Response parser for sub-agent
 * Handles parsing of LLM responses and snippet hydration
 */
export class ResponseParser {
  private toolExecutor: ToolExecutor;
  private onProgress?: ProgressCallback;
  private static readonly MAX_SNIPPETS = 20;

  constructor(toolExecutor: ToolExecutor, onProgress?: ProgressCallback) {
    this.toolExecutor = toolExecutor;
    this.onProgress = onProgress;
  }

  /**
   * Parse the final <search_complete> response and hydrate snippets
   */
  async parseSearchComplete(response: string, stats: SearchStats): Promise<SubAgentResult> {
    const snippets: SearchSnippet[] = [];

    // Extract summary
    const summaryMatch = response.match(/<summary>([\s\S]*?)<\/summary>/);
    const summary = summaryMatch ? summaryMatch[1].trim() : 'Search completed.';

    // Extract answer
    const answerMatch = response.match(/<answer>([\s\S]*?)<\/answer>/);
    const answer = answerMatch ? answerMatch[1].trim() : undefined;

    // Extract snippets - code is now OPTIONAL
    const snippetRegex = /<snippet>([\s\S]*?)<\/snippet>/g;
    let snippetMatch;

    while ((snippetMatch = snippetRegex.exec(response)) !== null) {
      const snippetContent = snippetMatch[1];

      const pathMatch = snippetContent.match(/<path>([\s\S]*?)<\/path>/);
      const startLineMatch = snippetContent.match(/<start_line>([\s\S]*?)<\/start_line>/);
      const endLineMatch = snippetContent.match(/<end_line>([\s\S]*?)<\/end_line>/);
      const reasonMatch = snippetContent.match(/<reason>([\s\S]*?)<\/reason>/);
      const scoreMatch = snippetContent.match(/<score>([\s\S]*?)<\/score>/);

      // Only require path - code is NEVER parsed from LLM, always hydrated
      if (pathMatch) {
        snippets.push({
          path: pathMatch[1].trim(),
          startLine: parseInt(startLineMatch?.[1].trim() || '1', 10),
          endLine: parseInt(endLineMatch?.[1].trim() || '1', 10),
          snippet: '', // Always empty initially, filled by hydration
          reason: reasonMatch?.[1].trim(),
          score: parseFloat(scoreMatch?.[1].trim() || '0.5'),
        });
      }
    }

    // Sort by score descending
    snippets.sort((a, b) => b.score - a.score);

    // Limit to maxSnippets BEFORE hydration to save work
    const finalSnippets = snippets.slice(0, ResponseParser.MAX_SNIPPETS);

    // Hydrate empty snippets in parallel
    await this.hydrateSnippets(finalSnippets);

    return {
      summary,
      highLevelAnswer: answer,
      snippets: finalSnippets,
      searchStats: stats,
    };
  }

  /**
   * Build fallback result from discovered files when LLM parsing fails
   */
  async buildFallbackResult(
    llmResponse: string | null,
    discoveredFiles: Map<string, DiscoveredFileInfo>,
    stats: SearchStats
  ): Promise<SubAgentResult> {
    const snippets: SearchSnippet[] = [];

    // Convert discovered files to snippets
    for (const [path, info] of discoveredFiles) {
      snippets.push({
        path,
        startLine: info.lines?.start || 1,
        endLine: info.lines?.end || 50,
        snippet: '',
        reason: info.reason || 'Found during search',
        score: 0.6, // Lower score for fallback results
      });
    }

    // Limit and sort
    const finalSnippets = snippets.slice(0, ResponseParser.MAX_SNIPPETS);

    // Try to hydrate snippets
    await this.hydrateSnippets(finalSnippets, 50);

    // Try to extract any summary from LLM response
    let summary = 'Search found relevant files.';
    if (llmResponse) {
      // Try to get first meaningful sentence
      const firstSentence = llmResponse.match(/^[^.!?\n]+[.!?]/);
      if (firstSentence && firstSentence[0].length < 200) {
        summary = firstSentence[0];
      }
    }

    return {
      summary,
      highLevelAnswer: llmResponse || undefined,
      snippets: finalSnippets,
      searchStats: stats,
    };
  }

  /**
   * Hydrate snippets with actual file content
   */
  private async hydrateSnippets(snippets: SearchSnippet[], maxLines: number = 100): Promise<void> {
    const hydrationPromises = snippets.map(async (snippet) => {
      try {
        this.onProgress?.(`Hydrating snippet for ${snippet.path}...`);
        
        const content = await this.toolExecutor.hydrateSnippet(
          snippet.path,
          snippet.startLine,
          snippet.endLine
        );
        
        if (content) {
          snippet.snippet = content;
        }
      } catch (_error) {
        // If hydration fails, leave snippet empty
        console.warn(`Failed to hydrate snippet for ${snippet.path}:`, _error);
      }
      return snippet;
    });

    await Promise.all(hydrationPromises);
  }
}
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { 
  EXPLORER_SYSTEM_PROMPT, 
  SYNTHESIZER_SYSTEM_PROMPT, 
  buildExplorerPrompt, 
  buildSynthesizerPrompt 
} from './sub-agent-prompt';
import { GrepSearchTool } from '../tools/grep-search-tool';
import { GlobSearchTool } from '../tools/glob-search-tool';
import { ReadFileTool } from '../tools/read-file-tool';
import { ListFilesTool } from '../tools/list-files-tool';
import { getWorkspaceRoot } from '../tools/utils/workspace-utils';
import { getWorkspaceFiles } from '../../utils/workspace-scanner';

/**
 * Indexing settings from user config
 */
export interface IndexingSettings {
  provider: 'anthropic' | 'openai' | 'openai-compatible' | 'megallm' | 'vscode-lm' | 'qwen-code';
  model: string;
}

/**
 * API settings needed for sub-agent
 */
export interface SubAgentApiSettings {
  anthropicApiKey?: string;
  anthropicCustomUrl?: string;
  openaiApiKey?: string;
  openaiCustomUrl?: string;
  openaiCompatibleApiKey?: string;
  openaiCompatibleCustomUrl?: string;
  megallmApiKey?: string;
  megallmCustomUrl?: string;
}

/**
 * Search snippet result
 */
export interface SearchSnippet {
  path: string;
  startLine: number;
  endLine: number;
  snippet: string;
  score: number;
  reason?: string;
}

/**
 * Sub-agent search result
 */
export interface SubAgentResult {
  summary: string;
  highLevelAnswer?: string;
  snippets: SearchSnippet[];
  searchStats: {
    iterations: number;
    grepCalls: number;
    globCalls: number;
    readFileCalls: number;
    listDirCalls: number;
    filesScanned: number;
    totalMatches: number;
  };
}

/**
 * Progress callback for streaming updates
 */
export type ProgressCallback = (message: string) => void;

/**
 * Message in the conversation
 */
interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * SubAgentService - Orchestrates LLM-powered code search (v2)
 * 
 * Features:
 * - Parallel tool execution for faster search
 * - read_file_snippet and list_dir tools for better context
 * - Snippet-light output (metadata + reasons, code is optional)
 * - Optimized for large codebases
 */
export class SubAgentService {
  private grepTool = new GrepSearchTool();
  private globTool = new GlobSearchTool();
  private readFileTool = new ReadFileTool();
  private listFilesTool = new ListFilesTool();
  private indexingSettings: IndexingSettings;
  private apiSettings: SubAgentApiSettings;
  private onProgress?: ProgressCallback;
  // Track whether we've actually executed any tools in this search run
  private hasExecutedTools = false;

  private stats = {
    iterations: 0,
    grepCalls: 0,
    globCalls: 0,
    readFileCalls: 0,
    listDirCalls: 0,
    filesScanned: 0,
    totalMatches: 0,
  };

  // Track discovered files during search for fallback
  private discoveredFiles: Map<string, { lines?: { start: number; end: number }; reason?: string }> = new Map();

  // Default search limits (hardcoded for simplicity)
  private static readonly MAX_ITERATIONS = 4;
  private static readonly MAX_PARALLEL_CALLS = 8;
  private static readonly MAX_FILES = 100;
  private static readonly MAX_SNIPPETS = 20;

  constructor(
    indexingSettings: IndexingSettings,
    apiSettings: SubAgentApiSettings,
    onProgress?: ProgressCallback
  ) {
    this.indexingSettings = indexingSettings;
    this.apiSettings = apiSettings;
    this.onProgress = onProgress;
  }

  /**
   * Execute the sub-agent search
   */
  async search(query: string, searchPath?: string, hints?: string[], signal?: AbortSignal): Promise<SubAgentResult> {
    this.stats = {
      iterations: 0,
      grepCalls: 0,
      globCalls: 0,
      readFileCalls: 0,
      listDirCalls: 0,
      filesScanned: 0,
      totalMatches: 0,
    };

    // Reset tool execution tracking for this run
    this.hasExecutedTools = false;

    // Clear discovered files from previous searches
    this.discoveredFiles.clear();

    this.onProgress?.(`Starting sub-agent search for: "${query}"`);

    // Get workspace files for context
    const workspaceRoot = getWorkspaceRoot();
    const workspaceFiles = workspaceRoot ? getWorkspaceFiles(workspaceRoot) : undefined;

    const conversation: ConversationMessage[] = [
      { role: 'user', content: buildExplorerPrompt(query, searchPath, hints, workspaceFiles) }
    ];

    let iteration = 0;
    const maxIterations = SubAgentService.MAX_ITERATIONS;
    const maxParallelCalls = SubAgentService.MAX_PARALLEL_CALLS;

    this.onProgress?.(`Starting search (${maxIterations} turns)`);

    // Phase 1: Force exactly maxIterations tool-based turns (no early <search_complete>)
    while (iteration < maxIterations) {
      if (signal?.aborted) {
        throw new Error('Search aborted');
      }

      iteration++;
      this.stats.iterations = iteration;

      this.onProgress?.(`Iteration ${iteration}/${maxIterations}: Thinking...`);

      // Get LLM response using EXPLORER system prompt
      const response = await this.callLLM(conversation, EXPLORER_SYSTEM_PROMPT, signal);

      if (!response) {
        this.onProgress?.(`Error: No response from LLM`);
        break;
      }

      // Parse tool calls from response
      // We ignore any <search_complete> during tool iterations - model must use all turns
      const toolCalls = this.parseToolCalls(response);

      if (toolCalls.length === 0) {
        // No tool calls - push model to use tools
        conversation.push({ role: 'assistant', content: response });
        
        const turnsRemaining = maxIterations - iteration;
        conversation.push({ 
          role: 'user', 
          content: `You have ${turnsRemaining} turn(s) remaining. You MUST use grep_search, glob_search, read_file_snippet, or list_dir to explore the codebase. Do NOT provide <search_complete> yet - keep searching to gather more context.`
        });
        continue;
      }

      // Cap parallel tool calls
      const cappedToolCalls = toolCalls.slice(0, maxParallelCalls);
      if (toolCalls.length > maxParallelCalls) {
        this.onProgress?.(`Capped tool calls: ${cappedToolCalls.length}/${toolCalls.length}`);
      }

      // Execute tools IN PARALLEL for better performance
      this.onProgress?.(`Executing ${cappedToolCalls.length} tool(s) in parallel...`);
      const toolResults = await this.executeToolsParallel(cappedToolCalls);

      // Mark that we've actually executed tools at least once
      this.hasExecutedTools = true;

      if (signal?.aborted) {
        throw new Error('Search aborted');
      }

      // Add to conversation
      conversation.push({ role: 'assistant', content: response });
      
      // Guide the model for remaining turns
      const turnsRemaining = maxIterations - iteration;
      let iterationGuide: string;
      
      if (turnsRemaining > 0) {
        iterationGuide = `\n\nTool results received. You have ${turnsRemaining} more turn(s) to search. Continue exploring with more targeted searches based on what you found. Do NOT provide <search_complete> yet.`;
      } else {
        iterationGuide = `\n\nTool results received. This was your final search turn. On the next message, you will be asked to provide your summary.`;
      }
      
      conversation.push({ role: 'user', content: `Tool results:${toolResults}${iterationGuide}` });
    }

    // Phase 2: Synthesis - use SYNTHESIZER system prompt for final answer
    // Note: We use "Synthesizing" instead of iteration message to avoid UI showing duplicate 4/4
    this.onProgress?.(`Synthesizing findings...`);

    // Add the synthesis prompt
    conversation.push({
      role: 'user',
      content: buildSynthesizerPrompt(query)
    });

    // Use SYNTHESIZER system prompt for the final call
    const finalResponse = await this.callLLM(conversation, SYNTHESIZER_SYSTEM_PROMPT, signal);
    
    // Log for debugging
    console.log('[EchoSearch] Final response received, length:', finalResponse?.length || 0);
    
    if (finalResponse && finalResponse.includes('<search_complete>')) {
      return this.parseSearchComplete(finalResponse);
    }

    // If LLM still didn't comply, try to extract any useful info from conversation
    console.log('[EchoSearch] Warning: LLM did not return <search_complete> block');
    console.log('[EchoSearch] Final response preview:', finalResponse?.substring(0, 500));

    // Fallback: use discovered files from tool calls
    if (this.discoveredFiles.size > 0) {
      console.log('[EchoSearch] Using fallback with', this.discoveredFiles.size, 'discovered files');
      return this.buildFallbackResult(finalResponse);
    }

    // Last resort fallback
    return {
      summary: 'Search completed but could not parse results.',
      highLevelAnswer: finalResponse || undefined,
      snippets: [],
      searchStats: this.stats,
    };
  }

  /**
   * Call the LLM based on provider
   */
  private async callLLM(
    conversation: ConversationMessage[], 
    systemPrompt: string,
    signal?: AbortSignal
  ): Promise<string | null> {
    const { provider, model } = this.indexingSettings;

    try {
      switch (provider) {
        case 'anthropic':
          return await this.callAnthropic(conversation, model, systemPrompt, signal);
        case 'openai':
          return await this.callOpenAI(conversation, model, systemPrompt, this.apiSettings.openaiApiKey, this.apiSettings.openaiCustomUrl, signal);
        case 'openai-compatible':
        case 'megallm': {
          const apiKey = provider === 'megallm' ? this.apiSettings.megallmApiKey : this.apiSettings.openaiCompatibleApiKey;
          // Use default megallm URL if no custom URL provided
          const defaultMegallmUrl = 'https://ai.megallm.io/v1';
          const baseUrl = provider === 'megallm' 
            ? (this.apiSettings.megallmCustomUrl || defaultMegallmUrl)
            : this.apiSettings.openaiCompatibleCustomUrl;
          return await this.callOpenAI(conversation, model, systemPrompt, apiKey, baseUrl, signal);
        }
        default:
          this.onProgress?.(`Provider ${provider} not supported for sub-agent`);
          return null;
      }
    } catch (error) {
      if (signal?.aborted) {
        throw error;
      }
      this.onProgress?.(`LLM Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  /**
   * Call Anthropic API
   */
  private async callAnthropic(
    conversation: ConversationMessage[], 
    model: string, 
    systemPrompt: string,
    signal?: AbortSignal
  ): Promise<string> {
    const client = new Anthropic({
      apiKey: this.apiSettings.anthropicApiKey,
      baseURL: this.apiSettings.anthropicCustomUrl || undefined,
    });

    const response = await client.messages.create({
      model: model || 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      system: systemPrompt,
      messages: conversation.map(m => ({
        role: m.role,
        content: m.content,
      })),
    }, { signal });

    const textBlock = response.content.find(block => block.type === 'text');
    return textBlock?.type === 'text' ? textBlock.text : '';
  }

  /**
   * Call OpenAI-compatible API
   */
  private async callOpenAI(
    conversation: ConversationMessage[],
    model: string,
    systemPrompt: string,
    apiKey?: string,
    baseUrl?: string,
    signal?: AbortSignal
  ): Promise<string> {
    // Normalize baseURL to ensure /v1 suffix (matching main chat providers)
    let normalizedBaseUrl = baseUrl;
    if (baseUrl && !baseUrl.endsWith('/v1')) {
      normalizedBaseUrl = baseUrl.endsWith('/') ? `${baseUrl}v1` : `${baseUrl}/v1`;
    }

    const client = new OpenAI({
      apiKey: apiKey || '',
      baseURL: normalizedBaseUrl || undefined,
    });

    const response = await client.chat.completions.create({
      model: model || 'gpt-4o',
      max_tokens: 4096,
      messages: [
        { role: 'system', content: systemPrompt },
        ...conversation.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ],
    }, { signal });

    return response.choices[0]?.message?.content || '';
  }

  /**
   * Supported tools for the sub-agent
   */
  private static SUPPORTED_TOOLS = new Set([
    'grep_search',
    'glob_search', 
    'read_file_snippet',
    'list_dir'
  ]);

  /**
   * Parse tool calls from LLM response
   */
  private parseToolCalls(response: string): Array<{ name: string; params: Record<string, string> }> {
    const toolCalls: Array<{ name: string; params: Record<string, string> }> = [];

    // Match <invoke name="...">...</invoke> blocks
    const invokeRegex = /<invoke\s+name="([^"]+)">([\s\S]*?)<\/invoke>/g;
    let match;

    while ((match = invokeRegex.exec(response)) !== null) {
      const name = match[1];
      const paramsContent = match[2];
      const params: Record<string, string> = {};

      // Parse parameters
      const paramRegex = /<parameter\s+name="([^"]+)">([\s\S]*?)<\/parameter>/g;
      let paramMatch;

      while ((paramMatch = paramRegex.exec(paramsContent)) !== null) {
        params[paramMatch[1]] = paramMatch[2].trim();
      }

      // Accept all supported tools
      if (SubAgentService.SUPPORTED_TOOLS.has(name)) {
        toolCalls.push({ name, params });
      }
    }

    return toolCalls;
  }

  /**
   * Execute multiple tools in parallel for better performance
   */
  private async executeToolsParallel(
    toolCalls: Array<{ name: string; params: Record<string, string> }>
  ): Promise<string> {
    // Execute all tools concurrently
    const resultPromises = toolCalls.map(async (toolCall) => {
      // Get the most descriptive parameter for display
      // Priority: query (for grep), pattern (for glob), path (for read/list), then any first param
      const paramDesc = toolCall.params.query 
        || toolCall.params.pattern 
        || toolCall.params.path 
        || Object.values(toolCall.params).find(v => v && v.trim()) 
        || toolCall.name;
      this.onProgress?.(`  → ${toolCall.name}(${paramDesc.substring(0, 50)}${paramDesc.length > 50 ? '...' : ''})`);
      
      const result = await this.executeTool(toolCall);
      return `<tool_result name="${toolCall.name}">\n${result}\n</tool_result>`;
    });

    const results = await Promise.all(resultPromises);
    return '\n\n' + results.join('\n\n');
  }

  /**
   * Execute a tool call
   */
  private async executeTool(toolCall: { name: string; params: Record<string, string> }): Promise<string> {
    try {
      if (toolCall.name === 'grep_search') {
        return await this.executeGrepSearch(toolCall.params);
      }

      if (toolCall.name === 'glob_search') {
        return await this.executeGlobSearch(toolCall.params);
      }

      if (toolCall.name === 'read_file_snippet') {
        return await this.executeReadFileSnippet(toolCall.params);
      }

      if (toolCall.name === 'list_dir') {
        return await this.executeListDir(toolCall.params);
      }

      return `Unknown tool: ${toolCall.name}`;
    } catch (error) {
      return `Tool error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Execute grep_search tool
   */
  private async executeGrepSearch(params: Record<string, string>): Promise<string> {
    this.stats.grepCalls++;
    
    // Adaptive limits based on iteration
    const iteration = this.stats.iterations;
    
    // Early iterations: broader search; later iterations: more focused
    const isEarlyIteration = iteration <= 2;
    const baseMaxFiles = SubAgentService.MAX_FILES;
    const baseMaxResults = 50;
    
    // Scale limits based on iteration
    const maxResults = isEarlyIteration ? baseMaxResults : Math.min(baseMaxResults * 2, 100);
    const maxFiles = isEarlyIteration ? baseMaxFiles : Math.min(baseMaxFiles * 1.5, 200);
    
    const result = await this.grepTool.execute({
      query: params.query,
      path: params.path || '',
      includes: params.includes,
      maxResults,
      maxFiles,
      contextLines: 1,
      skipIndexing: true,
    });

    if (result.success && result.data) {
      const data = result.data as {
        totalMatches?: number;
        filesWithMatches?: number;
        results?: Array<{ file: string; matches: Array<{ line: number; text: string }> }>;
      };
      
      this.stats.totalMatches += data.totalMatches || 0;
      this.stats.filesScanned += data.filesWithMatches || 0;

      // Compact format for LLM - minimize tokens
      if (data.results && data.results.length > 0) {
        let output = `Found ${data.totalMatches} matches in ${data.filesWithMatches} files:\n`;
        
        const maxFilesToShow = 10;
        const maxMatchesPerFile = 5;
        
        for (const file of data.results.slice(0, maxFilesToShow)) {
          output += `\n## ${file.file}\n`;
          
          // Track discovered files for fallback
          const matches = file.matches.slice(0, maxMatchesPerFile);
          if (matches.length > 0) {
            const lines = matches.map(m => m.line);
            const minLine = Math.min(...lines);
            const maxLine = Math.max(...lines);
            this.discoveredFiles.set(file.file, {
              lines: { start: Math.max(1, minLine - 5), end: maxLine + 20 },
              reason: `Matched query: "${params.query}"`
            });
          }
          
          for (const match of matches) {
            // Truncate long lines
            const text = match.text.length > 120 
              ? match.text.substring(0, 120) + '...' 
              : match.text;
            output += `L${match.line}: ${text}\n`;
          }
        }
        if (data.results.length > maxFilesToShow) {
          output += `\n... and ${data.results.length - maxFilesToShow} more files`;
        }
        return output;
      }
      return 'No matches found.';
    }
    return `Error: ${result.error || 'Search failed'}`;
  }

  /**
   * Execute glob_search tool
   */
  private async executeGlobSearch(params: Record<string, string>): Promise<string> {
    this.stats.globCalls++;
    
    const maxResults = 30;
    
    const result = await this.globTool.execute({
      pattern: params.pattern,
      path: params.path || '',
      maxResults,
      skipIndexing: true, // Skip indexing during search for performance
    });

    if (result.success && result.data) {
      const data = result.data as {
        totalFiles?: number;
        results?: Array<{ path: string; name: string }>;
      };

      this.stats.filesScanned += data.totalFiles || 0;

      if (data.results && data.results.length > 0) {
        let output = `Found ${data.totalFiles} files:\n`;
        for (const file of data.results.slice(0, 20)) {
          output += `- ${file.path}\n`;
          // Track discovered files for fallback
          if (!this.discoveredFiles.has(file.path)) {
            this.discoveredFiles.set(file.path, {
              lines: { start: 1, end: 50 },
              reason: `Matched pattern: "${params.pattern}"`
            });
          }
        }
        if (data.results.length > 20) {
          output += `... and ${data.results.length - 20} more files`;
        }
        return output;
      }
      return 'No files found matching pattern.';
    }
    return `Error: ${result.error || 'Search failed'}`;
  }

  /**
   * Execute read_file_snippet tool - read specific lines from a file
   */
  private async executeReadFileSnippet(params: Record<string, string>): Promise<string> {
    this.stats.readFileCalls++;
    
    const startLine = parseInt(params.startLine || '1', 10);
    const endLine = parseInt(params.endLine || '50', 10);
    
    // Cap at 100 lines per read for efficiency
    const maxLines = 100;
    const limitedEnd = Math.min(endLine, startLine + maxLines - 1);
    const lineCount = limitedEnd - startLine + 1;

    const result = await this.readFileTool.execute({
      path: params.path,
      offset: startLine,
      limit: lineCount,
    });

    if (result.success && result.data) {
      const data = result.data as {
        path?: string;
        content?: string;
        startLine?: number;
        endLine?: number;
        totalLines?: number;
      };

      if (data.content) {
        let output = `File: ${data.path} (lines ${data.startLine}-${data.endLine} of ${data.totalLines})\n`;
        output += '```\n';
        output += data.content;
        output += '\n```';
        return output;
      }
      return 'File is empty.';
    }
    return `Error: ${result.error || 'Failed to read file'}`;
  }

  /**
   * Execute list_dir tool - list directory contents
   */
  private async executeListDir(params: Record<string, string>): Promise<string> {
    this.stats.listDirCalls++;
    
    const result = await this.listFilesTool.execute({
      path: params.path || '',
      recursive: false, // Non-recursive for speed
    });

    if (result.success && result.data) {
      const data = result.data as {
        path?: string;
        directories?: Array<{ name: string }>;
        files?: Array<{ name: string; size?: number }>;
        totalCount?: number;
      };

      let output = `Directory: ${data.path || '/'}\n`;
      
      if (data.directories && data.directories.length > 0) {
        output += '\nDirectories:\n';
        for (const dir of data.directories.slice(0, 20)) {
          output += `  📁 ${dir.name}/\n`;
        }
      }

      if (data.files && data.files.length > 0) {
        output += '\nFiles:\n';
        for (const file of data.files.slice(0, 30)) {
          output += `  📄 ${file.name}\n`;
        }
        if (data.files.length > 30) {
          output += `  ... and ${data.files.length - 30} more files\n`;
        }
      }

      if ((!data.directories || data.directories.length === 0) && 
          (!data.files || data.files.length === 0)) {
        output += 'Directory is empty.';
      }

      return output;
    }
    return `Error: ${result.error || 'Failed to list directory'}`;
  }

  /**
   * Parse the final <search_complete> response and hydrate empty snippets
   */
  private async parseSearchComplete(response: string): Promise<SubAgentResult> {
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

      // v2: Only require path - code is NEVER parsed from LLM, always hydrated
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
    const maxSnippets = SubAgentService.MAX_SNIPPETS;
    const finalSnippets = snippets.slice(0, maxSnippets);

    // Hydrate empty snippets in parallel
    const hydrationPromises = finalSnippets.map(async (snippet) => {
      try {
        this.onProgress?.(`Hydrating snippet for ${snippet.path}...`);
        // Cap hydration at 100 lines
        const maxLines = 100;
        const count = Math.min(snippet.endLine - snippet.startLine + 1, maxLines);
        
        const result = await this.readFileTool.execute({
          path: snippet.path,
          offset: snippet.startLine,
          limit: count
        });

        if (result.success && result.data) {
          const data = result.data as { content?: string };
          if (data.content) {
            snippet.snippet = data.content;
          }
        }
      } catch (_error) {
        // If hydration fails, leave snippet empty
        console.warn(`Failed to hydrate snippet for ${snippet.path}:`, _error);
      }
      return snippet;
    });

    await Promise.all(hydrationPromises);

    return {
      summary,
      highLevelAnswer: answer,
      snippets: finalSnippets,
      searchStats: this.stats,
    };
  }

  /**
   * Build fallback result from discovered files when LLM parsing fails
   */
  private async buildFallbackResult(llmResponse: string | null): Promise<SubAgentResult> {
    const snippets: SearchSnippet[] = [];

    // Convert discovered files to snippets
    for (const [path, info] of this.discoveredFiles) {
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
    const maxSnippets = SubAgentService.MAX_SNIPPETS;
    const finalSnippets = snippets.slice(0, maxSnippets);

    // Try to hydrate snippets
    const hydrationPromises = finalSnippets.map(async (snippet) => {
      try {
        const maxLines = 50;
        const count = Math.min(snippet.endLine - snippet.startLine + 1, maxLines);
        
        const result = await this.readFileTool.execute({
          path: snippet.path,
          offset: snippet.startLine,
          limit: count
        });

        if (result.success && result.data) {
          const data = result.data as { content?: string };
          if (data.content) {
            snippet.snippet = data.content;
          }
        }
      } catch (_error) {
        // Ignore hydration errors
      }
      return snippet;
    });

    await Promise.all(hydrationPromises);

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
      searchStats: this.stats,
    };
  }
}

import { ITool, ToolExecutionResult, ToolProgressCallback } from './tool.interface';
import { getWorkspaceRoot } from './utils/workspace-utils';
import { SubAgentService, IndexingSettings, SubAgentApiSettings } from '../sub-agent/sub-agent-service';

/**
 * Progress data structure for echo_search iterations
 */
export interface EchoSearchProgress {
  iteration: number;        // Current iteration being processed
  toolsIteration: number;   // Iteration that the current tools belong to (for display)
  maxIterations: number;
  phase: 'starting' | 'thinking' | 'executing' | 'finalizing';
  tools: string[];
  message: string;
}

/**
 * Parse SubAgentService progress message into structured progress data
 * 
 * Key behavior:
 * - `iteration` tracks the current iteration being processed
 * - `toolsIteration` tracks which iteration the displayed tools belong to
 * - When tools are added, toolsIteration is updated to match iteration
 * - This ensures the counter shows the correct iteration for the displayed tools
 */
function parseProgressMessage(message: string, currentProgress: EchoSearchProgress): EchoSearchProgress {
  const progress = { ...currentProgress, message };

  // Parse "Starting search (N turns)" or "Starting search (max N turns)"
  const maxIterMatch = message.match(/\((?:max )?(\d+) turns\)/);
  if (maxIterMatch) {
    progress.maxIterations = parseInt(maxIterMatch[1], 10);
    progress.phase = 'starting';
    return progress;
  }

  // Parse "Iteration N/M: Thinking..."
  // Update iteration number but DON'T update toolsIteration yet
  const iterMatch = message.match(/Iteration (\d+)\/(\d+): Thinking/);
  if (iterMatch) {
    progress.iteration = parseInt(iterMatch[1], 10);
    progress.maxIterations = parseInt(iterMatch[2], 10);
    progress.phase = 'thinking';
    // Don't clear tools or update toolsIteration - keep previous iteration's display
    return progress;
  }

  // Parse "Executing N tool(s) in parallel..."
  // Clear tools and update toolsIteration to current iteration
  const execMatch = message.match(/Executing (\d+) tool/);
  if (execMatch) {
    progress.phase = 'executing';
    progress.tools = [];
    progress.toolsIteration = progress.iteration; // Now we're executing for this iteration
    return progress;
  }

  // Parse "  → tool_name(params)" - capture full tool call with params
  const toolMatch = message.match(/→ (.+)$/);
  if (toolMatch) {
    progress.tools = [...progress.tools, toolMatch[1].trim()];
    // toolsIteration already set when "Executing" was parsed
    return progress;
  }

  // Parse finalizing phase messages
  if (message.includes('Synthesizing') || message.includes('final answer') || message.includes('Max iterations')) {
    progress.phase = 'finalizing';
    return progress;
  }

  return progress;
}

/**
 * EchoSearchTool - An LLM-powered sub-agent that iteratively searches the codebase
 * using grep_search and glob_search to find relevant context for the main agent.
 */
export class EchoSearchTool implements ITool {
  name = 'echo_search';

  async execute(parameters: Record<string, unknown>, onProgress?: ToolProgressCallback, signal?: AbortSignal): Promise<ToolExecutionResult> {
    // Check abort FIRST before any work
    if (signal?.aborted) {
      return { success: false, error: 'Aborted' };
    }

    const query = parameters.query as string;
    const searchPath = (parameters.path as string) || '';
    const hints = (parameters.hints as string[]) || [];
    const indexingSettings = parameters.indexingSettings as IndexingSettings | undefined;
    const apiSettings = parameters.apiSettings as SubAgentApiSettings | undefined;

    if (!query) {
      return { success: false, error: 'Search query is required' };
    }

    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
      return { success: false, error: 'No workspace folder open' };
    }

    // Check if we have valid indexing settings
    if (!indexingSettings || !indexingSettings.provider || !indexingSettings.model) {
      return {
        success: false,
        error: 'Indexing settings not configured. Please configure a model in Settings > Indexing.',
      };
    }

    // Check if we have API settings
    if (!apiSettings) {
      return {
        success: false,
        error: 'API settings not provided. Cannot connect to LLM.',
      };
    }

    try {
      // Track progress state across messages
      let currentProgress: EchoSearchProgress = {
        iteration: 0,
        toolsIteration: 0,
        maxIterations: 4,
        phase: 'starting',
        tools: [],
        message: '',
      };

      const subAgentProgressCallback = (message: string) => {
        console.log(`[EchoSearch] ${message}`);

        // Parse message into structured progress
        currentProgress = parseProgressMessage(message, currentProgress);

        // Send progress updates for:
        // 1. Starting (so UI shows initial state immediately)
        // 2. New iteration starts (so UI shows "1/4", "2/4", etc.)
        // 3. Execution starts (so UI knows tools are running)
        // 4. Individual tool lines (so UI shows which tools are being used)
        // 5. Synthesizing (final phase before result)
        const trimmed = message.trim();
        const isStartingLine = trimmed.includes('Starting search');
        const isIterationLine = trimmed.includes('Iteration') && trimmed.includes('Thinking');
        const isExecutionLine = trimmed.startsWith('Executing ');
        const isToolLine = trimmed.startsWith('→');
        const isSynthesizingLine = trimmed.includes('Synthesizing');

        if (onProgress && (isStartingLine || isIterationLine || isExecutionLine || isToolLine || isSynthesizingLine)) {
          onProgress(currentProgress);
        }
      };

      const subAgent = new SubAgentService(indexingSettings, apiSettings, subAgentProgressCallback);
      const result = await subAgent.search(query, searchPath, hints, signal);

      return {
        success: true,
        // Attach the original query so the webview can show it in the Echo Search header
        data: {
          ...result,
          query,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Echo search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}

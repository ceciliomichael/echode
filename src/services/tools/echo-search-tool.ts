import { ITool, ToolExecutionResult, ToolProgressCallback } from './tool.interface';
import { getWorkspaceRoot } from './utils/workspace-utils';
import { SubAgentService, IndexingSettings, SubAgentApiSettings } from '../sub-agent/sub-agent-service';

/**
 * Progress data structure for echo_search iterations
 */
export interface EchoSearchProgress {
  iteration: number;
  maxIterations: number;
  phase: 'starting' | 'thinking' | 'executing' | 'finalizing';
  tools: string[];
  message: string;
}

/**
 * Parse SubAgentService progress message into structured progress data
 */
function parseProgressMessage(message: string, currentProgress: EchoSearchProgress): EchoSearchProgress {
  const progress = { ...currentProgress, message };

  // Parse "Starting search (max N turns)"
  const maxIterMatch = message.match(/max (\d+) turns/);
  if (maxIterMatch) {
    progress.maxIterations = parseInt(maxIterMatch[1], 10);
    progress.phase = 'starting';
    return progress;
  }

  // Parse "Iteration N/M: Thinking..."
  const iterMatch = message.match(/Iteration (\d+)\/(\d+): Thinking/);
  if (iterMatch) {
    progress.iteration = parseInt(iterMatch[1], 10);
    progress.maxIterations = parseInt(iterMatch[2], 10);
    progress.phase = 'thinking';
    progress.tools = [];
    return progress;
  }

  // Parse "Executing N tool(s) in parallel..."
  const execMatch = message.match(/Executing (\d+) tool/);
  if (execMatch) {
    progress.phase = 'executing';
    progress.tools = [];
    return progress;
  }

  // Parse "  → tool_name(params)" - capture full tool call with params
  const toolMatch = message.match(/→ (.+)$/);
  if (toolMatch) {
    progress.tools = [...progress.tools, toolMatch[1].trim()];
    return progress;
  }

  // Parse "Max iterations reached" or "requesting final answer"
  if (message.includes('final answer') || message.includes('Max iterations')) {
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

  async execute(parameters: Record<string, unknown>, onProgress?: ToolProgressCallback): Promise<ToolExecutionResult> {
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
        maxIterations: 4,
        phase: 'starting',
        tools: [],
        message: '',
      };

      const subAgentProgressCallback = (message: string) => {
        console.log(`[EchoSearch] ${message}`);
        
        // Parse message into structured progress
        currentProgress = parseProgressMessage(message, currentProgress);

        // Only push updates for actual execution/tool lines so the
        // dropdown shows the tools used in the last completed turn,
        // instead of being overwritten by the next "Thinking" message.
        const trimmed = message.trim();
        const isToolLine = trimmed.startsWith('→');
        const isExecutionLine = trimmed.startsWith('Executing ');

        if (onProgress && (isToolLine || isExecutionLine)) {
          onProgress(currentProgress);
        }
      };

      const subAgent = new SubAgentService(indexingSettings, apiSettings, subAgentProgressCallback);
      const result = await subAgent.search(query, searchPath, hints);

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

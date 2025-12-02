import { ITool, ToolExecutionResult } from './tool.interface';
import { getWorkspaceRoot } from './utils/workspace-utils';
import { SubAgentService, IndexingSettings, SubAgentApiSettings } from '../sub-agent/sub-agent-service';

/**
 * EchoSearchTool - An LLM-powered sub-agent that iteratively searches the codebase
 * using grep_search and glob_search to find relevant context for the main agent.
 */
export class EchoSearchTool implements ITool {
  name = 'echo_search';

  async execute(parameters: Record<string, unknown>): Promise<ToolExecutionResult> {
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
      const progressMessages: string[] = [];
      const onProgress = (message: string) => {
        progressMessages.push(message);
        console.log(`[EchoSearch] ${message}`);
      };

      const subAgent = new SubAgentService(indexingSettings, apiSettings, onProgress);
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

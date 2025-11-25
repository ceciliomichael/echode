import type { ToolExecutionState } from '../types/tool';
import type { ChatMode } from '../types/chat-mode';
import { isToolAvailableInMode } from './tool-history-filter';

/**
 * Format tool execution results for AI context
 * @param toolExecutions - Map of tool executions
 * @param mode - Current chat mode (used to filter out tools not available in current mode)
 */
export function formatToolResultsForHistory(
  toolExecutions: Map<string, ToolExecutionState>,
  mode: ChatMode = 'agent'
): string[] {
  const toolResults: string[] = [];

  toolExecutions.forEach((execution) => {
    // Skip tools not available in current mode to prevent AI confusion
    if (!isToolAvailableInMode(execution.toolName, mode)) {
      return;
    }
    if (execution.status === 'completed' && execution.result) {
      if (execution.result.success) {
        const data = execution.result.data as Record<string, unknown>;
        let formattedResult = '';

        if (execution.toolName === 'read_file') {
          // Include totalLines so AI knows the line_count for write_to_file
          const totalLines = data.totalLines as number;
          const startLine = data.startLine as number;
          const endLine = data.endLine as number;
          
          let header = `File: ${data.path as string} (${totalLines} lines total)`;
          if (startLine !== 1 || endLine !== totalLines) {
            header += ` [showing lines ${startLine}-${endLine}]`;
          }
          
          formattedResult = `${header}\n${data.content as string}`;
        } else if (execution.toolName === 'grep_search') {
          formattedResult = `Query: ${data.query as string}\nFound ${data.totalMatches as number} matches in ${data.filesWithMatches as number} files`;
          if (data.results && Array.isArray(data.results) && data.results.length > 0) {
            formattedResult +=
              '\n' +
              data.results
                .slice(0, 5)
                .map(
                  (r: Record<string, unknown>) =>
                    `${r.file as string}: ${(r.matches as unknown[]).length} matches`
                )
                .join('\n');
          }
        } else if (execution.toolName === 'list_files') {
          const directories = data.directories as Array<{ name: string }> | undefined;
          const files = data.files as Array<{ name: string }> | undefined;
          formattedResult = `Directory: ${data.path as string}\nDirectories: ${directories?.map((d) => d.name).join(', ') || 'none'}\nFiles: ${files?.map((f) => f.name).join(', ') || 'none'}`;
        } else {
          formattedResult = JSON.stringify(data);
        }

        toolResults.push(`[${execution.toolName}]\n${formattedResult}`);
      } else {
        toolResults.push(`[${execution.toolName} ERROR]\n${execution.result.error}`);
      }
    }
  });

  return toolResults;
}

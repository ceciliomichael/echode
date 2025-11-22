import type { ToolExecutionState } from '../types/tool';

/**
 * Format tool execution results for AI context
 */
export function formatToolResultsForHistory(
  toolExecutions: Map<string, ToolExecutionState>
): string[] {
  const toolResults: string[] = [];

  toolExecutions.forEach((execution) => {
    if (execution.status === 'completed' && execution.result) {
      if (execution.result.success) {
        const data = execution.result.data as Record<string, unknown>;
        let formattedResult = '';

        if (execution.toolName === 'read_file') {
          formattedResult = `File: ${data.path as string}\n${data.content as string}`;
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

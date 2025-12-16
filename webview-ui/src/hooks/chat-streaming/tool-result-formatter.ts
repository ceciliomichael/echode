import type { ToolExecutionState } from '../../types/tool';
import type { ChatMode } from '../../types/chat-mode';
import { isToolAvailableInMode } from '../../utils/tool-history-filter';
import { truncateContent, MAX_FILE_CONTENT_CHARS } from './helpers';

/**
 * Format tool execution results for inclusion in chat history
 * Returns formatted tool results string array and list of skipped tools
 * 
 * @param filesEditedLater - Optional set of file paths that are edited in later messages.
 *                           If provided, diagnostics from these files will be omitted to avoid stale data.
 */
export function formatToolExecutionResults(
  toolExecutions: Map<string, ToolExecutionState>,
  mode: ChatMode,
  filesEditedLater?: Set<string>
): { toolResults: string[]; skippedTools: string[] } {
  const toolResults: string[] = [];
  const skippedTools: string[] = [];

  toolExecutions.forEach((execution) => {
    // Skip tools not available in current mode to prevent AI confusion
    if (!isToolAvailableInMode(execution.toolName, mode)) {
      skippedTools.push(execution.toolName);
      return;
    }
    if (execution.status === 'completed' && execution.result) {
      if (execution.result.success) {
        // Format result based on tool type
        const data = execution.result.data as Record<string, unknown>;
        let formattedResult = '';

        if (execution.toolName === 'read_file') {
          // For read_file, format with clear markers
          // Only include apply_diff hints in modes where apply_diff is available
          const canUseDiff = mode === 'agent' || mode === 'general';
          const searchHint = canUseDiff ? ' (copy for SEARCH blocks)' : '';

          if ('files' in data && Array.isArray(data.files)) {
            // Multiple files case
            const files = data.files as Array<{ path: string; content: string }>;
            formattedResult = files
              .map(f => `┌─ ${f.path}${searchHint} ─┐\n${truncateContent(f.content, MAX_FILE_CONTENT_CHARS)}\n└─ END ${f.path} ─┘`)
              .join('\n\n');
          } else if ('content' in data && 'path' in data) {
            // Single file case
            const filePath = data.path as string;
            const content = truncateContent(String(data.content), MAX_FILE_CONTENT_CHARS);
            formattedResult = `┌─ ${filePath}${searchHint} ─┐\n${content}\n└─ END ${filePath} ─┘`;
          } else {
            formattedResult = JSON.stringify(data);
          }
        } else if (execution.toolName === 'grep_search') {
          // For grep, show matches concisely
          formattedResult = `Query: ${data.query as string}\nFound ${data.totalMatches as number} matches in ${data.filesWithMatches as number} files`;
          if (data.results && Array.isArray(data.results) && data.results.length > 0) {
            formattedResult += '\n' + data.results.slice(0, 5).map((r: Record<string, unknown>) =>
              `${r.file as string}: ${(r.matches as unknown[]).length} matches`
            ).join('\n');
          }
        } else if (execution.toolName === 'list_files') {
          // For list_files, show directory contents
          const directories = data.directories as Array<{ name: string }> | undefined;
          const files = data.files as Array<{ name: string }> | undefined;
          formattedResult = `Directory: ${data.path as string}\nDirectories: ${directories?.map(d => d.name).join(', ') || 'none'}\nFiles: ${files?.map(f => f.name).join(', ') || 'none'}`;
        } else if (execution.toolName === 'apply_diff' || execution.toolName === 'write_to_file') {
          // For file modification tools, only send minimal info to AI
          // The AI already knows what it wrote - no need to echo full content back
          const message = (data.message as string) || `File ${execution.toolName === 'apply_diff' ? 'edited' : 'written'} successfully`;
          const lineCount = data.lineCount as number | undefined;
          const action = data.action as string | undefined;
          const filePath = (data.path as string) || (data.absolutePath as string);
          const largeFileReminder = data.largeFileReminder as string | undefined;

          // Only include diagnostics if this file wasn't edited again in a later message
          // Stale diagnostics from older edits can confuse the AI
          const isFileEditedLater = filePath && filesEditedLater?.has(filePath);
          const diagnostics = isFileEditedLater ? undefined : (data.fileDiagnostics as string | undefined);

          // Build concise result for AI
          formattedResult = `${message}`;
          if (action) {
            formattedResult += ` (${action})`;
          }
          if (lineCount) {
            formattedResult += `\nLines: ${lineCount}`;
          }
          if (largeFileReminder) {
            formattedResult += `\n${largeFileReminder}`;
          }
          if (diagnostics) {
            formattedResult += `\nDiagnostics:\n${diagnostics}`;
          }
        } else {
          // For other tools, stringify the data
          formattedResult = JSON.stringify(data);
        }

        toolResults.push(`[${execution.toolName}]\n${formattedResult}`);
      } else {
        // Tool error
        toolResults.push(`[${execution.toolName} ERROR]\n${execution.result.error}`);
      }
    }
  });

  return { toolResults, skippedTools };
}

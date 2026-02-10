import type { ToolExecutionState } from '../../types/tool';
import type { ChatMode } from '../../types/chat-mode';
import { isToolAvailableInMode } from '../../utils/tool-history-filter';
import { truncateContent, MAX_FILE_CONTENT_CHARS } from './helpers';

/**
 * Format a stale read_file result - shows only metadata, not content
 * This prevents AI confusion when a file has been read again with newer content
 */
function formatStaleReadFile(
  data: Record<string, unknown>,
  staleFilePaths?: Set<string>
): string {
  // Single file case
  if ('path' in data && typeof data.path === 'string') {
    const filePath = data.path;
    // If we have a stale paths set and this path isn't in it, it's not stale
    if (staleFilePaths && !staleFilePaths.has(filePath)) {
      return ''; // Not stale, return empty to signal normal formatting
    }
    return `┌─ ${filePath} (outdated - see later read) ─┐\n[Content hidden - file was re-read with newer version]\n└─ END ${filePath} ─┘`;
  }
  
  // Multi-file case - filter only stale paths
  if ('files' in data && Array.isArray(data.files)) {
    const files = data.files as Array<{ path: string; content: string }>;
    const results: string[] = [];
    
    for (const f of files) {
      if (staleFilePaths && !staleFilePaths.has(f.path)) {
        // Not stale, will be handled by normal formatting
        continue;
      }
      results.push(`┌─ ${f.path} (outdated - see later read) ─┐\n[Content hidden - file was re-read with newer version]\n└─ END ${f.path} ─┘`);
    }
    
    return results.join('\n\n');
  }
  
  return '';
}

/**
 * Format tool execution results for inclusion in chat history
 * Returns formatted tool results string array and list of skipped tools
 * 
 * @param toolExecutions - Map of tool executions to format
 * @param mode - Current chat mode
 * @param staleExecutionIds - Optional set of execution IDs that are stale (file was re-read later)
 * @param stalePathsByExecution - Optional map of execution ID -> stale file paths within that execution
 */
export function formatToolExecutionResults(
  toolExecutions: Map<string, ToolExecutionState>,
  mode: ChatMode,
  staleExecutionIds?: Set<string>,
  stalePathsByExecution?: Map<string, Set<string>>
): { toolResults: string[]; skippedTools: string[] } {
  const toolResults: string[] = [];
  const skippedTools: string[] = [];

  toolExecutions.forEach((execution) => {
    // Skip tools not available in current mode to prevent AI confusion
    if (!isToolAvailableInMode(execution.toolName, mode)) {
      skippedTools.push(execution.toolName);
      return;
    }
    
    // Include completed, error, and rejected statuses in history
    // This ensures the AI sees tool results even when rejected in manual mode
    const hasResult = execution.status === 'completed' || 
                      execution.status === 'error' || 
                      execution.status === 'rejected';
    
    if (hasResult && execution.result) {
      if (execution.result.success) {
        // Format result based on tool type
        const data = execution.result.data as Record<string, unknown>;
        let formattedResult = '';

        if (execution.toolName === 'read_file') {
          // Check if this entire execution is stale (file was re-read later)
          const isStaleExecution = staleExecutionIds?.has(execution.toolExecutionId);
          const stalePathsForThis = stalePathsByExecution?.get(execution.toolExecutionId);
          
          if (isStaleExecution) {
            // Entire execution is stale - use condensed format
            formattedResult = formatStaleReadFile(data, stalePathsForThis);
          } else if (stalePathsForThis && stalePathsForThis.size > 0) {
            // Some paths in this execution are stale (multi-file read case)
            // Format stale paths with condensed format, fresh paths with full content
            const canUseEdit = mode === 'agent' || mode === 'general';
            const searchHint = canUseEdit ? ' (copy for edit old_string)' : '';
            
            if ('files' in data && Array.isArray(data.files)) {
              const files = data.files as Array<{ path: string; content: string }>;
              formattedResult = files
                .map(f => {
                  if (stalePathsForThis.has(f.path)) {
                    return `┌─ ${f.path} (outdated - see later read) ─┐\n[Content hidden - file was re-read with newer version]\n└─ END ${f.path} ─┘`;
                  }
                  return `┌─ ${f.path}${searchHint} ─┐\n${truncateContent(f.content, MAX_FILE_CONTENT_CHARS)}\n└─ END ${f.path} ─┘`;
                })
                .join('\n\n');
            } else {
              // Single file case but marked as having stale paths - format as stale
              formattedResult = formatStaleReadFile(data, stalePathsForThis);
            }
          } else {
            // Fresh read - format with full content
            const canUseEdit = mode === 'agent' || mode === 'general';
            const searchHint = canUseEdit ? ' (copy for edit old_string)' : '';

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
        } else if (execution.toolName === 'edit' || execution.toolName === 'write_to_file') {
          const path = data.path as string;
          const action = data.action as string | undefined;
          const diagnostics = data.diagnostics as Array<{ severity: string; message: string }> | undefined;
          
          if (execution.toolName === 'edit') {
            formattedResult = action === 'no_change' 
              ? `${path} → NO CHANGES` 
              : `${path} → APPLIED`;
          } else {
            formattedResult = action === 'created' 
              ? `${path} → CREATED` 
              : action === 'no_change'
                ? `${path} → NO CHANGES`
                : `${path} → MODIFIED`;
          }
          
          // Only include diagnostics if there are errors/warnings
          if (diagnostics && diagnostics.length > 0) {
            const errors = diagnostics.filter(d => d.severity === 'Error');
            const warnings = diagnostics.filter(d => d.severity === 'Warning');
            if (errors.length > 0) {
              formattedResult += ` [${errors.length} error(s)]`;
            } else if (warnings.length > 0) {
              formattedResult += ` [${warnings.length} warning(s)]`;
            }
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

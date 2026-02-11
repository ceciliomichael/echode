import type { ToolExecutionState } from '../types/tool';
import type { ChatMode } from '../types/chat-mode';
import { isToolAvailableInMode } from './tool-history-filter';

/**
 * Truncate content with a clear indicator (used for terminal/search output)
 */
function truncateContent(content: string, maxChars: number): string {
  if (content.length <= maxChars) {return content;}
  return content.slice(0, maxChars) + '\n... [output truncated]';
}

/**
 * Format a single tool execution result into a concise, structured string.
 * Follows the pattern: Tool → Status → Key info only.
 */
function formatSingleToolResult(execution: ToolExecutionState, mode: ChatMode, staleFilePaths?: Set<string>): string {
  const data = execution.result?.data as Record<string, unknown> | undefined;

  if (!execution.result?.success) {
    return `[${execution.toolName}] ERROR: ${execution.result?.error || 'Unknown error'}`;
  }

  if (!data) {
    return `[${execution.toolName}] Completed (no data)`;
  }

  switch (execution.toolName) {
    case 'read_file': {
      const path = data.path as string;
      const totalLines = data.totalLines as number;
      const startLine = data.startLine as number;
      const endLine = data.endLine as number;
      const content = data.content as string;

      // Check if this read is stale (file was edited or re-read later)
      if (staleFilePaths && staleFilePaths.has(path)) {
        return `[read_file] ${path} (OUTDATED - file was modified since this read)\n[Content hidden - re-read file for current content]`;
      }

      const rangeInfo = (startLine !== 1 || endLine !== totalLines)
        ? ` [lines ${startLine}-${endLine}]`
        : '';

      const canUseEdit = mode === 'agent' || mode === 'general';
      const headerHint = canUseEdit ? ' (use for edit old_string)' : '';

      return `[read_file] ${path} (${totalLines} lines)${rangeInfo}
┌─ FILE CONTENT${headerHint} ─┐
${content}
└─ END ${path} ─┘`;
    }

    case 'write_to_file': {
      const path = data.path as string;
      const action = data.action as string;
      return `[write_to_file] ${path} → ${action === 'created' ? 'CREATED' : action === 'no_change' ? 'NO CHANGES' : 'MODIFIED'}`;
    }

    case 'edit': {
      const path = data.path as string;
      const action = data.action as string | undefined;
      const reason = data.reason as string | undefined;
      let result: string;
      if (action === 'no_change') {
        result = reason === 'old_string_equals_new_string'
          ? `[edit] ${path} → NO CHANGES (old_string and new_string are identical — file already has the desired content, move on)`
          : `[edit] ${path} → NO CHANGES`;
      } else {
        result = `[edit] ${path} → APPLIED (edit verified, change is now in the file)`;
      }

      if (action !== 'no_change') {
        const newContent = data.newContent as string | undefined;
        const oldContent = data.oldContent as string | undefined;
        if (newContent && oldContent) {
          const newLines = newContent.replace(/\r\n/g, '\n').split('\n');
          const oldLines = oldContent.replace(/\r\n/g, '\n').split('\n');
          let firstDiff = 0;
          for (let i = 0; i < Math.min(oldLines.length, newLines.length); i++) {
            if (oldLines[i] !== newLines[i]) { firstDiff = i; break; }
          }
          let lastDiff = newLines.length - 1;
          for (let i = 0; i < Math.min(oldLines.length, newLines.length); i++) {
            if (oldLines[oldLines.length - 1 - i] !== newLines[newLines.length - 1 - i]) {
              lastDiff = newLines.length - 1 - i; break;
            }
          }
          const pad = 5;
          const start = Math.max(0, firstDiff - pad);
          const end = Math.min(newLines.length, lastDiff + pad + 1);
          const window = newLines.slice(start, end)
            .map((l, i) => `${start + i + 1} | ${l}`)
            .join('\n');
          result += `\n[current file state around edit, lines ${start + 1}-${end} of ${newLines.length}]\n${window}`;
        }
      }

      return result;
    }

    case 'delete': {
      const path = data.path as string;
      return `[delete] ${path} → DELETED`;
    }

    case 'grep_search': {
      const query = data.query as string;
      const formattedResults = data.formattedResults as string | undefined;

      let output = `[grep_search] "${query}"`;
      if (formattedResults) {
        output += '\n' + truncateContent(formattedResults, 2000);
      }
      return output;
    }

    case 'list_files': {
      const path = data.path as string;
      const directories = data.directories as Array<{ name: string }> | undefined;
      const files = data.files as Array<{ name: string }> | undefined;

      const dirCount = directories?.length || 0;
      const fileCount = files?.length || 0;
      let output = `[list_files] ${path} → ${dirCount} directories, ${fileCount} files`;

      if (directories && directories.length > 0) {
        output += `\n  Dirs: ${directories.slice(0, 10).map(d => d.name).join(', ')}${directories.length > 10 ? '...' : ''}`;
      }
      if (files && files.length > 0) {
        output += `\n  Files: ${files.slice(0, 10).map(f => f.name).join(', ')}${files.length > 10 ? '...' : ''}`;
      }
      return output;
    }

    case 'run_terminal': {
      const command = data.command as string;
      const output = data.output as string | undefined;
      const exitCode = data.exitCode as number | undefined;

      let result = `[run_terminal] \`${command}\``;
      if (exitCode !== undefined) {
        result += exitCode === 0 ? ' → SUCCESS' : ` → EXIT ${exitCode}`;
      }
      if (output) {
        result += '\n' + truncateContent(output, 1000);
      }
      return result;
    }

    default: {
      // For unknown tools, provide a compact JSON summary
      const jsonStr = JSON.stringify(data);
      if (jsonStr.length > 500) {
        return `[${execution.toolName}] Completed\n${jsonStr.slice(0, 500)}...`;
      }
      return `[${execution.toolName}] ${jsonStr}`;
    }
  }
}

/**
 * Format tool execution results for AI context.
 * Produces concise, structured summaries optimized for LLM consumption.
 * 
 * @param toolExecutions - Map of tool executions
 * @param mode - Current chat mode (used to filter out tools not available in current mode)
 * @param staleFilePaths - Optional set of file paths whose reads are stale (file was edited/re-read later)
 */
export function formatToolResultsForHistory(
  toolExecutions: Map<string, ToolExecutionState>,
  mode: ChatMode = 'agent',
  staleFilePaths?: Set<string>
): string[] {
  const toolResults: string[] = [];

  // Sort executions by startedAt to preserve chronological order
  const sortedExecutions = Array.from(toolExecutions.values()).sort(
    (a, b) => (a.startedAt || 0) - (b.startedAt || 0)
  );

  for (const execution of sortedExecutions) {
    // Skip tools not available in current mode to prevent AI confusion
    if (!isToolAvailableInMode(execution.toolName, mode)) {
      continue;
    }

    if (execution.status === 'completed' && execution.result) {
      toolResults.push(formatSingleToolResult(execution, mode, staleFilePaths));
    }
  }

  return toolResults;
}

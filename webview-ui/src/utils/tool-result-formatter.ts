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
function formatSingleToolResult(execution: ToolExecutionState, mode: ChatMode): string {
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
      return `[edit] ${path} → ${action === 'no_change' ? 'NO CHANGES' : 'APPLIED'}`;
    }

    case 'delete_file': {
      const path = data.path as string;
      return `[delete_file] ${path} → DELETED`;
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

    case 'echo_search': {
      const query = data.query as string;
      const results = data.results as string | undefined;

      let output = `[echo_search] "${query}"`;
      if (results) {
        output += '\n' + truncateContent(results, 2000);
      }
      return output;
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
      toolResults.push(formatSingleToolResult(execution, mode));
    }
  });

  return toolResults;
}

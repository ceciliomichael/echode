/**
 * Tool Context Cleaner
 * 
 * Utilities to strip or summarize old tool XML sections from message content.
 * This mirrors KiloCode's approach of discarding orphan tool blocks,
 * adapted for echode's string-based XML format.
 */

/**
 * XML-like sections that contain tool execution data
 */
const TOOL_SECTION_PATTERNS = [
  /<previous_tool_results>[\s\S]*?<\/previous_tool_results>/g,
  /<tool_results>[\s\S]*?<\/tool_results>/g,
  /<diagnostics>[\s\S]*?<\/diagnostics>/g,
];

/**
 * Extract a brief summary of tool calls from content
 * Returns something like: "read_file src/foo.ts, grep_search 'query'"
 */
function extractToolSummary(content: string): string {
  const toolCalls: string[] = [];

  // Match [tool_name] patterns
  const toolPattern = /\[([a-z_]+)\]\s*([^\n[]+)?/gi;
  let match;

  while ((match = toolPattern.exec(content)) !== null) {
    const toolName = match[1];
    const detail = match[2]?.trim();

    if (toolName === 'read_file' && detail) {
      // Extract just the path
      const pathMatch = detail.match(/^([^\s(]+)/);
      if (pathMatch) {
        toolCalls.push(`read_file: ${pathMatch[1]}`);
      }
    } else if (toolName === 'grep_search' && detail) {
      // Extract query
      const queryMatch = detail.match(/"([^"]+)"/);
      if (queryMatch) {
        toolCalls.push(`grep_search: "${queryMatch[1]}"`);
      }
    } else if (toolName === 'write_to_file' || toolName === 'apply_diff') {
      const pathMatch = detail?.match(/^([^\s→]+)/);
      if (pathMatch) {
        toolCalls.push(`${toolName}: ${pathMatch[1]}`);
      }
    } else if (toolName && !['ERROR', 'NOTE'].includes(toolName.toUpperCase())) {
      toolCalls.push(toolName);
    }
  }

  // Deduplicate and limit
  const unique = [...new Set(toolCalls)].slice(0, 5);
  return unique.length > 0 ? unique.join(', ') : '';
}

/**
 * Strip all tool XML sections from content
 */
export function stripToolSections(content: string): string {
  let cleaned = content;

  for (const pattern of TOOL_SECTION_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }

  // Clean up excessive whitespace left behind
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();

  return cleaned;
}

/**
 * Replace tool XML sections with a brief summary
 */
export function summarizeToolSections(content: string): string {
  let cleaned = content;
  let summaryAdded = false;

  for (const pattern of TOOL_SECTION_PATTERNS) {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      // Extract summary from first match only
      if (!summaryAdded) {
        const summary = extractToolSummary(matches.join('\n'));
        if (summary) {
          // Replace first match with summary, remove others
          cleaned = cleaned.replace(pattern, `[Previous tools: ${summary}]`);
          summaryAdded = true;
        } else {
          cleaned = cleaned.replace(pattern, '');
        }
      } else {
        cleaned = cleaned.replace(pattern, '');
      }
    }
  }

  // Clean up excessive whitespace
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();

  return cleaned;
}

/**
 * Check if content contains tool sections
 */
export function hasToolSections(content: string): boolean {
  return TOOL_SECTION_PATTERNS.some(pattern => pattern.test(content));
}

/**
 * Strip only <diagnostics> sections from content
 * Used to remove stale diagnostic data from historical messages
 */
export function stripDiagnosticsSections(content: string): string {
  return content
    .replace(/<diagnostics>[\s\S]*?<\/diagnostics>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

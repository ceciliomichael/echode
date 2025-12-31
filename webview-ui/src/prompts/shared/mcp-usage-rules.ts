/**
 * MCP Tool Usage Rules
 * 
 * Guidance for when to use MCP (Model Context Protocol) tools.
 * These tools connect to external services and should be used sparingly.
 */

/**
 * Get MCP usage guidance rules for the AI.
 * This instructs the AI to use MCP tools only when absolutely necessary.
 */
export function getMcpUsageRules(mcpToolNames: string[]): string {
  if (mcpToolNames.length === 0) {
    return '';
  }

  const toolList = mcpToolNames.map(name => `\`${name}\``).join(', ');

  return `<mcp_tool_usage>
## External Tools (MCP) - USE SPARINGLY

The following tools are external MCP (Model Context Protocol) tools: ${toolList}

**CRITICAL GUIDELINES FOR MCP TOOLS:**

1. **LAST RESORT ONLY**: Use MCP tools ONLY when:
   - The task explicitly requires external data/actions that built-in tools cannot provide
   - The user specifically asks to use an external service
   - There is NO way to accomplish the task with standard workspace tools

2. **PREFER BUILT-IN TOOLS**: Always try these first:
   - \`read_file\`, \`grep_search\`, \`glob_search\` for finding information
   - \`write_to_file\`, \`apply_diff\` for making changes
   - \`list_files\` for exploring structure
   - \`echo_search\` for understanding code architecture

3. **AVOID MCP TOOLS WHEN**:
   - You're just exploring the codebase (use built-in search tools)
   - The information might be in local files (check first)
   - You're making routine code changes
   - The task can be completed with workspace tools alone

4. **BEFORE CALLING AN MCP TOOL, ASK YOURSELF**:
   - "Can I find this information in the workspace files?"
   - "Is there a built-in tool that does this?"
   - "Did the user specifically request external data?"
   - If unsure, use built-in tools first or ask the user.

5. **EFFICIENCY**: MCP tools have external latency and cost. Minimize calls by:
   - Batching requests when possible
   - Caching/remembering results within the conversation
   - Not re-fetching data you already have
</mcp_tool_usage>`;
}
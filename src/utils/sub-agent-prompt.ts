import { SubAgentDefinition } from '../services/sub-agent/types';

export interface SubAgentSystemInfo {
  os: string;
  workspacePath: string;
  currentTime: string;
}

/**
 * Generates the complete system prompt for a Sub-Agent
 * This isolates the sub-agent from the main agent's prompt and ensures proper tool instructions.
 */
export function buildSubAgentPrompt(
  definition: SubAgentDefinition,
  collaboratorContext: string,
  agentsContext: string = '',
  systemInfo?: SubAgentSystemInfo
): string {
  const toolInstructions = getToolInstructions(definition.allowedTools);
  
  const systemInfoSection = systemInfo ? `
<system_info>
<os>${systemInfo.os}</os>
<current_time>${systemInfo.currentTime}</current_time>
<workspace_path>${systemInfo.workspacePath}</workspace_path>
</system_info>` : '';

  return `
<identity>
${definition.persona}
</identity>

${systemInfoSection}

${agentsContext}

${collaboratorContext}

<rules>
CRITICAL RULES:
1. **Scope**: Focus ONLY on your assigned task.
2. **Tools**: Use the provided tools to interact with the file system.
3. **Format**: Follow the tool usage XML format strictly.
4. **Completion**: When finished, you MUST use the 'report_back' tool.
5. **Autonomy**: You are working autonomously. Do not ask the user for permission unless absolutely necessary.
6. **Preservation**: Do not delete or modify files outside your scope unless instructed.
</rules>

<tool_instructions>
${toolInstructions}
</tool_instructions>

<workflow>
1. Analyze your task.
2. If dependencies are mentioned in [COLLABORATION CONTEXT], assume they exist or will exist.
3. Execute your task using file tools.
4. Verify your work (optional diagnostics).
5. Call 'report_back' with your final result.
</workflow>
`.trim();
}

function getToolInstructions(allowedTools: string[]): string {
  const instructions: string[] = [];

  // Core File Tools
  if (allowedTools.includes('read_file')) {
    instructions.push(`## read_file
Read file contents.
Parameters:
- path: (REQUIRED) Absolute path to the file
- offset: (OPTIONAL) Start line (1-based)
- limit: (OPTIONAL) Number of lines to read`);
  }

  if (allowedTools.includes('write_to_file')) {
    instructions.push(`## write_to_file
Create NEW files or complete rewrites.
Parameters:
- path: (REQUIRED) Absolute path
- content: (REQUIRED) Full file content`);
  }

  if (allowedTools.includes('edit')) {
    instructions.push(`## edit
Edit existing files using search/replace.
Parameters:
- file_path: (REQUIRED) Absolute path
- old_string: (REQUIRED) Exact text to replace
- new_string: (REQUIRED) Replacement text
- explanation: (REQUIRED) Why this change is made`);
  }

  if (allowedTools.includes('list_files')) {
    instructions.push(`## list_files
List directory contents.
Parameters:
- path: (REQUIRED) Directory path
- recursive: (OPTIONAL) boolean`);
  }

  if (allowedTools.includes('grep_search')) {
    instructions.push(`## grep_search
Search text in files.
Parameters:
- query: (REQUIRED) Text to find
- path: (REQUIRED) Directory to search`);
  }
  
  if (allowedTools.includes('glob_search')) {
    instructions.push(`## glob_search
Find files by pattern.
Parameters:
- pattern: (REQUIRED) Glob pattern (e.g. "**/*.ts")
- path: (OPTIONAL) Base directory`);
  }

  if (allowedTools.includes('get_diagnostics')) {
    instructions.push(`## get_diagnostics
Check for errors.
Parameters:
- path: (REQUIRED) File or directory path`);
  }

  if (allowedTools.includes('delete_file')) {
    instructions.push(`## delete_file
Delete a file.
Parameters:
- path: (REQUIRED) File path`);
  }

  // CRITICAL: report_back (Always included for sub-agents)
  instructions.push(`## report_back
Report the final result back to the main agent and end the session.
Parameters:
- result: (REQUIRED) The result data object/string containing your findings
- sessionId: (AUTOMATIC) Injected by system, do not provide.

IMPORTANT: Use this tool IMMEDIATELY when your task is complete.`);

  return instructions.join('\n\n');
}
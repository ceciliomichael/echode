/**
 * Shared create_subagent tool instructions
 */

export function getCreateSubagentInstructions(): string {
    return `## create_subagent
Create a new autonomous sub-agent to handle a specific task.

Parameters:
- name: (REQUIRED) Simple identifier for the sub-agent (e.g., "code_reviewer", "file_analyzer")
- persona: (REQUIRED) System prompt defining the sub-agent's role, expertise, and behavior
- allowedTools: (REQUIRED) Array of tool names the sub-agent can use (e.g., ["read_file", "grep_search"])
- workflow: (optional) Step-by-step instructions for the sub-agent to follow

IMPORTANT:
- All three parameters (name, persona, allowedTools) are REQUIRED
- After creation, use use_subagent with the SAME name to delegate tasks`;
}
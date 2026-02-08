/**
 * Shared use_subagent tool instructions
 */

export function getUseSubagentInstructions(): string {
    return `## use_subagent
Delegate a task to an existing sub-agent.

Parameters:
- subAgentName: (REQUIRED) The name of the sub-agent to use (must match the name used in create_subagent)
- task: (REQUIRED) The task description for the sub-agent to execute

IMPORTANT:
- The sub-agent must be created first using create_subagent
- Use the EXACT same name you used when creating the sub-agent
- The sub-agent will work autonomously. Completion is triggered manually via UI, then results are summarized automatically.`;
}
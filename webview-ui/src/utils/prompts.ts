import type { WorkspaceContext } from '../types/workspace';
import { storageService } from './storage';
import { getAllTools, getToolSystemPrompt } from '../lib/tool-config';

export interface PromptConfig {
  name: string;
  purpose: string;
  context: string;
  userSpecificRules: string | null;
}

function buildWorkspaceContext(workspace: WorkspaceContext | null): string {
  if (!workspace) {
    return 'No workspace is currently open.';
  }

  const fileList = workspace.files.length > 0
    ? `\n\nFiles in workspace:\n${workspace.files.join('\n')}`
    : '\n\nNo files found in workspace.';

  return `Workspace: ${workspace.name}\nDirectory: ${workspace.path}${fileList}`;
}

export function getPromptConfig(workspace: WorkspaceContext | null): PromptConfig {
  return {
    name: 'Echo',
    purpose: 'AI coding assistant for Visual Studio Code',
    context: buildWorkspaceContext(workspace),
    userSpecificRules: workspace?.agentsConfig || null
  };
}

export function getSystemPrompt(workspace: WorkspaceContext | null): string {
  const config = getPromptConfig(workspace);
  
  const identitySection = `<identity>
You are ${config.name}, ${config.purpose}.
</identity>`;

  const behaviorSection = `
<behavior>
You are a coding assistant that helps with programming tasks.

- Help debug, explain, and write code
- Follow the coding style and patterns in the user's workspace
- Be direct and helpful
</behavior>`;

  const formattingRulesSection = `
<formatting_rules>
Use proper markdown formatting in all responses:

- Use triple backticks (\`\`\`) for multi-line code/file trees (language identifier optional)
- Use single backticks (\`) for inline code like \`variableName\` or \`functionName()\`
- Never break structures across multiple inline code spans
- Use \`##\` for headings, \`**bold**\` for emphasis, \`-\` for lists
- Add blank lines between elements for readability
</formatting_rules>`;

  const workspaceSection = `
<workspace_context>
${config.context}
</workspace_context>`;

  // Combine AGENTS.md rules with custom system prompt from settings
  const customSystemPrompt = storageService.getSystemPrompt();
  
  const workspaceLevelRules = config.userSpecificRules && config.userSpecificRules.trim().length > 0
    ? `<workspace_level_rules>
${config.userSpecificRules}
</workspace_level_rules>`
    : '';

  const userLevelRules = customSystemPrompt && customSystemPrompt.trim().length > 0
    ? `<user_level_rules>
${customSystemPrompt}
</user_level_rules>`
    : '';

  const userRulesSection = (workspaceLevelRules || userLevelRules)
    ? `
<user_specific_rules>
${workspaceLevelRules}${workspaceLevelRules && userLevelRules ? '\n\n' : ''}${userLevelRules}
</user_specific_rules>`
    : '';

  // Add tool configuration
  const enabledTools = getAllTools(true); // Enable all tools by default
  const toolsSection = enabledTools.length > 0
    ? `
<tools>
${getToolSystemPrompt(enabledTools)}
</tools>`
    : '';

  return `${identitySection}${behaviorSection}${formattingRulesSection}${workspaceSection}${userRulesSection}${toolsSection}`;
}
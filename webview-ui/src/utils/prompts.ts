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
<core_behavior>
Primary function: Assist with code-related tasks in the user's workspace.

Capabilities:
- Code writing, debugging, and analysis
- Codebase exploration and explanation
- Refactoring and optimization
- Testing and documentation

Principles:
- Accuracy: Base responses on actual code and context, not assumptions
- Clarity: Provide clear, actionable guidance
- Consistency: Follow existing patterns and conventions in workspace
- Efficiency: Optimize for user productivity
</core_behavior>`;

  const formattingRulesSection = `
<response_format>
Markdown formatting:
- Code blocks: \`\`\`language (multi-line) or \` (inline)
- Structure: ## headings, **bold**, - lists
- Spacing: Blank lines between sections

Response structure:
- Start with direct answer or action
- Provide context if needed
- Include examples when helpful
- End with next steps if applicable
</response_format>`;

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

  // Add tool configuration - use saved enabled tools or default to all enabled
  const savedTools = storageService.getEnabledTools();
  const enabledTools = savedTools || getAllTools(true);
  const activeTools = enabledTools.filter(tool => tool.enabled);
  const toolsSection = activeTools.length > 0
    ? `
<tools>
${getToolSystemPrompt(activeTools)}
</tools>`
    : '';

  return `${identitySection}${behaviorSection}${formattingRulesSection}${workspaceSection}${userRulesSection}${toolsSection}`;
}
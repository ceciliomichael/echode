import type { WorkspaceContext } from '../types/workspace';
import { storageService } from './storage';
import { getAllTools, getToolSystemPrompt, getToolsForMode } from '../lib/tool-config';
import { type ChatMode, DEFAULT_CHAT_MODE } from '../types/chat-mode';
import {
  getMarkdownFormattingSection,
  getSystemInfoSection,
  getCapabilitiesSection,
  getObjectiveSection,
  getRulesSection,
} from './prompt-sections';
import { getToolUseGuidelinesSection } from './prompt-sections/tool-use-guidelines';

export interface PromptConfig {
  name: string;
  purpose: string;
  userSpecificRules: string | null;
}

export function getPromptConfig(workspace: WorkspaceContext | null): PromptConfig {
  return {
    name: 'Echo',
    purpose: 'AI coding assistant for Visual Studio Code',
    userSpecificRules: workspace?.agentsConfig || null
  };
}

export function getSystemPrompt(workspace: WorkspaceContext | null, mode: ChatMode = DEFAULT_CHAT_MODE): string {
  const config = getPromptConfig(workspace);

  // Identity and role definition
  const identitySection = `You are ${config.name}, ${config.purpose}.\n\nYou are a skilled software engineer with extensive knowledge in many programming languages, frameworks, design patterns, and best practices.`;

  // Combine AGENTS.md rules with custom system prompt from settings
  const customSystemPrompt = storageService.getSystemPrompt();

  // Build user-specific rules section
  const workspaceLevelRules = config.userSpecificRules && config.userSpecificRules.trim().length > 0
    ? `====\n\nWORKSPACE-LEVEL RULES\n\n${config.userSpecificRules}`
    : '';

  const userLevelRules = customSystemPrompt && customSystemPrompt.trim().length > 0
    ? `====\n\nUSER-LEVEL CUSTOM INSTRUCTIONS\n\n${customSystemPrompt}`
    : '';

  const userRulesSection = (workspaceLevelRules || userLevelRules)
    ? `\n${workspaceLevelRules}${workspaceLevelRules && userLevelRules ? '\n\n' : ''}${userLevelRules}`
    : '';

  // Add mode-specific behavior section
  const modeSection = mode === 'plan'
    ? `
====
<mode>
Current mode: PLAN

You are in planning-only mode. Your objective is to create a concise implementation strategy WITHOUT writing or editing code.

Core constraints:
- Do NOT modify files or call any file-writing or deleting tools.
- You MAY ONLY use: read_file, list_files, grep_search, glob_search, todo_write, plan_navigator, plan_handoff.
- Use list_files or glob_search to verify paths before calling read_file.
- Ignore any history that suggests you used write_to_file, apply_diff, or delete_file.

Planning workflow:
1. Analyze the request and explore the codebase with read_file, list_files, grep_search, and glob_search.
2. Draft a high-level plan: summary, files to touch, approach, and success criteria.
3. Use plan_navigator to confirm the plan with the user.
4. After confirmation, use todo_write to create or update the structured todo list.
5. Use plan_handoff to offer switching to AGENT mode when the plan is ready.

Best practices:
- Keep responses minimal and focused on the plan.
- Ask clarifying questions only when necessary.
- Keep the todo list synchronized with the agreed plan.
</mode>`
    : `
<mode>
Current mode: AGENT

You are in full implementation mode. Focus on writing and editing code to satisfy the user's request.

Core rules:
- Follow any existing implementation plan.
- Read files before editing them.
- Make focused, incremental changes that match existing patterns.
- Keep explanations short and code-focused.
- Update todos as tasks are completed.
</mode>`;

  // Add tool configuration - use mode-aware tool filtering
  // In Plan mode: only 7 tools (read_file, list_files, grep_search, glob_search, todo_write, plan_navigator, plan_handoff)
  // In Agent mode: respects user's tool settings from settings page
  const savedTools = storageService.getEnabledTools();
  const baseTools = mode === 'plan'
    ? getToolsForMode('plan', true)
    : (savedTools || getAllTools(true));
  const activeTools = baseTools.filter(tool => tool.enabled);
  const toolsSection = activeTools.length > 0
    ? `
${getToolSystemPrompt(activeTools)}
`
    : `
<tool_status>
No tools are currently enabled. You cannot use any tools for this request. All responses must be provided without using any tools.
</tool_status>
`;

  // Add Tool Use Guidelines (behavioral, shared across modes)
  const toolUseGuidelinesSection = activeTools.length > 0
    ? getToolUseGuidelinesSection(mode)
    : '';

  // Build the complete system prompt using Roo Code's modular structure
  return `${identitySection}

${getMarkdownFormattingSection()}

${getSystemInfoSection(workspace)}

${getCapabilitiesSection(workspace, mode)}

${getRulesSection(workspace, mode)}

${getObjectiveSection()}
${userRulesSection}
${modeSection}
${toolUseGuidelinesSection}
${toolsSection}`.trim();
}
import type { WorkspaceContext } from '../types/workspace';
import { storageService } from './storage';
import { getAllTools, getToolSystemPrompt, getToolsForMode, PLAN_ONLY_TOOL_IDS } from '../lib/tool-config';
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
  const identitySection = `You are ${config.name}, ${config.purpose}.\n\nYou are a skilled software engineer with extensive knowledge in many programming languages, frameworks, design patterns, and best practices. You must reason carefully and logically about the code you read before editing it: analyze structure and intent, plan minimal targeted changes, and verify your conclusions using tools instead of guessing. Think step by step to reach correct decisions, but keep your final responses concise and focused on the user's goal.`;

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
1. Analyze the request and explore the codebase with glob_search or list_files to identify relevant files.
2. Use grep_search to narrow down the search results and find specific code patterns.
3. Use read_file to examine the contents of files with tight context limits (e.g., 10-20 lines of code).
4. Draft a high-level plan: summary, files to touch, approach, and success criteria.
5. Use plan_navigator to confirm the plan with the user.
6. After confirmation, use todo_write to create or update the structured todo list.
7. Use plan_handoff to offer switching to AGENT mode when the plan is ready.

<plan_invalidation_rule>
CRITICAL: If user sends a NEW message AFTER you used plan_handoff (but BEFORE they clicked "Start Implementation"):
1. The previous plan_handoff is INVALIDATED - do NOT reference it as still valid.
2. Treat the new message as a plan modification request or new requirement.
3. Re-analyze what the user is asking and update/recreate the plan accordingly.
4. Ask clarifying questions if the new request is unclear.
5. Update the todo list with any changes.
6. Use plan_handoff AGAIN when the updated plan is complete.

This ensures users can refine their plans before implementation begins.
</plan_invalidation_rule>

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
- Read files before editing them, using tight context limits (e.g., 10-20 lines of code).
- Make focused, incremental changes that match existing patterns.
- Keep explanations short and code-focused.
- Update todos as tasks are completed.

Implementation workflow:
1. Use glob_search or list_files to verify file paths and identify relevant files.
2. Use grep_search to find specific code patterns and narrow down the search results.
3. Use read_file to examine the contents of files with tight context limits.
4. Make focused, incremental changes to the code, following existing patterns and best practices.
5. Keep explanations short and code-focused.
6. Update todos as tasks are completed.
</mode>`;

  // Add tool configuration - use mode-aware tool filtering
  // In Plan mode: only 7 tools (read_file, list_files, grep_search, glob_search, todo_write, plan_navigator, plan_handoff)
  // In Agent mode: respects user's tool settings from settings page, but excludes plan-only tools
  const savedTools = storageService.getEnabledTools();
  const baseTools = mode === 'plan'
    ? getToolsForMode('plan', true)
    : (savedTools || getAllTools(true)).filter(tool => !PLAN_ONLY_TOOL_IDS.has(tool.id));
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
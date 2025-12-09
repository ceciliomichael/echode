import type { WorkspaceContext } from '../types/workspace';
import { storageService } from './storage';
import { getAllTools, getToolSystemPrompt, getToolsForMode, PLAN_ONLY_TOOL_IDS } from '../lib/tool-config';
import { type ChatMode, DEFAULT_CHAT_MODE } from '../types/chat-mode';
import { getSystemInfoSection, getRulesSection, getCognitiveWorkflowSection, getToolChainPatternsSection } from './prompt-sections';

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

  // Identity and role definition - mode-aware
  const identitySection = mode === 'chat'
    ? `You are ${config.name}, a thoughtful and intelligent conversational AI.\n\nYou are an articulate, insightful, and engaging conversational partner. You excel at thoughtful discussion, creative exploration, analytical reasoning, and empathetic dialogue. You adapt naturally to the tone and depth your conversation partner seeks—whether that's casual chat, deep intellectual discourse, playful banter, or supportive listening. You think carefully before responding, offer nuanced perspectives, and communicate with clarity and warmth. You are curious, open-minded, and genuine in your interactions.`
    : mode === 'general'
      ? `You are ${config.name}, a general-purpose AI assistant.\n\nYou are precise, articulate, and reliable. You support a broad range of non-coding tasks, including academic and professional writing, critical analysis, research support, explanation of concepts, document organization, and structured brainstorming. Use clear, direct language with an academic tone when appropriate. Think step by step to reach sound conclusions, and keep responses concise, well-structured, and focused on the user's stated objective.`
      : `You are ${config.name}, ${config.purpose}.\n\nYou are a skilled software engineer with extensive knowledge in many programming languages, frameworks, design patterns, and best practices. You reason carefully about code before editing: analyze structure and intent, plan minimal targeted changes, and verify using tools instead of guessing. You follow the READ BEFORE EDIT principle—always read files before modifying them. Think step by step, but keep responses concise and focused on the user's goal.`;

  // Core focus instruction
  const focusInstruction = `<core_focus>
Focus on the user's CURRENT message. Read it carefully. Respond to what they asked, not what you assume.
</core_focus>`;

  // Combine AGENTS.md rules with custom system prompt from settings
  const customSystemPrompt = storageService.getSystemPrompt();

  // Build user-specific rules section (highest priority - placed last)
  const workspaceLevelRules = config.userSpecificRules && config.userSpecificRules.trim().length > 0
    ? `====\n\nWORKSPACE-LEVEL RULES (FROM AGENTS.md - HIGHEST PRIORITY)\n\nThese rules are loaded from the AGENTS.md file at the root of the current workspace.\n\nCRITICAL: If any instruction in this section conflicts with other rules in this prompt, you MUST follow this section.\n\n${config.userSpecificRules}`
    : '';

  const userLevelRules = customSystemPrompt && customSystemPrompt.trim().length > 0
    ? `====\n\nUSER-LEVEL CUSTOM INSTRUCTIONS (HIGHEST PRIORITY)\n\nThese rules come from the user's custom instructions/settings.\n\nCRITICAL: If any instruction in this section conflicts with other rules in this prompt, you MUST follow this section.\n\n${customSystemPrompt}`
    : '';

  const userRulesSection = (workspaceLevelRules || userLevelRules)
    ? `\n${workspaceLevelRules}${workspaceLevelRules && userLevelRules ? '\n\n' : ''}${userLevelRules}`
    : '';

  // Mode-specific behavior section
  let modeSection: string;
  if (mode === 'plan') {
    modeSection = `
====
PLANNING MODE

Analyze codebase and create implementation plans. Read-only access.

Workflow: explore → analyze → plan → todo_write → plan_navigator → plan_handoff

Output: Describe what code should do. Brief snippets (max 5 lines) allowed as examples.
No implementation. Hand off to Agent mode when ready.`;
  } else if (mode === 'ask') {
    modeSection = `
====
Q&A MODE

Answer questions clearly. Use workspace tools only when needed to answer.
Read-only access. Stay concise.`;
  } else if (mode === 'general') {
    modeSection = `
====
GENERAL MODE

Assist with writing, analysis, research, explanations.
Use clear, well-structured prose. Adjust formality to context.`;
  } else if (mode === 'chat') {
    modeSection = `
====
CHAT MODE

Open dialogue. No tools. Adapt to the user's tone.
Be authentic, curious, and concise.`;
  } else {
    modeSection = `
====
AGENT MODE

Implement code changes. Follow any existing plan.

**CRITICAL WORKFLOW:**
1. read_file FIRST → get current file content
2. apply_diff → make targeted edits (copy SEARCH content exactly from read_file output)
3. Verify success → move on (or fix errors if any)

**RULES:**
- NEVER edit a file without reading it first
- On 2nd apply_diff failure on same file → switch to write_to_file
- Use write_to_file only for NEW files or complete rewrites`;
  }

  // Add tool configuration - use mode-aware tool filtering
  const savedTools = storageService.getEnabledTools();
  const settings = storageService.getSettings();
  const echoSearchEnabled = settings.indexingSettings?.enabled ?? true;

  // 1. Get tools allowed for the current mode
  const modeTools = mode === 'chat'
    ? [] // Chat mode has no tools
    : mode === 'plan'
      ? getToolsForMode('plan', true)
      : mode === 'ask'
        ? getToolsForMode('ask', true)
        : mode === 'general'
          ? getToolsForMode('general', true)
          : (getAllTools(true)).filter(tool => !PLAN_ONLY_TOOL_IDS.has(tool.id));

  // 2. Apply user preferences (savedTools)
  const userEnabledMap = new Map(savedTools?.map(t => [t.id, t.enabled]));

  let baseTools = modeTools.map(tool => {
    if (userEnabledMap.has(tool.id)) {
      return { ...tool, enabled: userEnabledMap.get(tool.id)! };
    }
    return tool;
  });

  // Filter out echo_search if indexing is disabled
  if (!echoSearchEnabled) {
    baseTools = baseTools.filter(tool => tool.id !== 'echo_search');
  }

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

  // Get dynamic sections based on mode and enabled tools
  const rulesSection = getRulesSection(workspace, mode, activeTools);
  const cognitiveSection = getCognitiveWorkflowSection(mode);
  const toolChainSection = getToolChainPatternsSection(mode, activeTools);

  // Build the complete system prompt
  // Priority order: identity → focus → cognitive workflow → tools → tool chains → rules → mode → user rules → system info
  return `${identitySection}

${focusInstruction}
${cognitiveSection ? `\n${cognitiveSection}` : ''}
${toolsSection}${toolChainSection ? `\n${toolChainSection}` : ''}
${rulesSection}
${modeSection}
${userRulesSection}

${getSystemInfoSection(workspace)}
`.trim();
}

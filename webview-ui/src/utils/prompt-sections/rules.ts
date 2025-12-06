import type { WorkspaceContext } from '../../types/workspace';
import type { ChatMode } from '../../types/chat-mode';
import type { Tool } from '../../types/tool';

function getEditingInstructions(mode: ChatMode, enabledTools: Tool[]): string {
	const enabledIds = new Set(enabledTools.map(t => t.id));
	const instructions: string[] = [];

	if (mode === 'general') {
		// General mode - document-focused
		if (enabledIds.has('apply_diff')) {
			instructions.push('- Prefer **apply_diff** for targeted edits to existing documents.');
			instructions.push('- **CRITICAL**: Before apply_diff, use read_file. SEARCH blocks must match EXACTLY.');
		}
		if (enabledIds.has('write_to_file')) {
			instructions.push('- Use **write_to_file** for new documents or complete rewrites. Always provide COMPLETE content.');
		}
	} else if (mode === 'agent') {
		// Agent mode - code-focused
		if (enabledIds.has('apply_diff')) {
			instructions.push('- Prefer **apply_diff** over write_to_file for existing files.');
			instructions.push('- **CRITICAL for apply_diff**: MUST read_file first. SEARCH blocks require 100% exact match including whitespace.');
			instructions.push('- If edit fails, re-read file to check current state before retrying.');
		}
		if (enabledIds.has('write_to_file')) {
			instructions.push('- **write_to_file**: ALWAYS provide COMPLETE file content. No placeholders like "// rest unchanged".');
		}
	}

	if (instructions.length > 0 && (enabledIds.has('apply_diff') || enabledIds.has('write_to_file'))) {
		instructions.push('- **DIAGNOSTICS LIMIT**: After 3 failed attempts on same file, summarize issue and ask user.');
	}

	return instructions.length > 0 ? instructions.join('\n') : '';
}

export function getRulesSection(workspace: WorkspaceContext | null, mode: ChatMode = 'agent', enabledTools: Tool[] = []): string {
	const cwd = workspace?.path || 'the current workspace directory';
	const enabledIds = new Set(enabledTools.map(t => t.id));

	const editingInstructions = getEditingInstructions(mode, enabledTools);

	// Critical rules that apply universally - high priority block
	const criticalRules = `<critical_rules>
1. **TOOL AVAILABILITY**: Only use tools in <enabled_tools>. Never hallucinate tools.
2. **READ BEFORE EDIT**: Never edit without read_file first in this session.
3. **VERIFY SUCCESS**: Wait for tool confirmation before next step.
4. **NO PROTOCOL LEAK**: Never expose <function_calls> or XML syntax to user.
5. **NO FILLER QUESTIONS**: Don't end with questions unless genuinely blocked.
6. **NO CONVERSATIONAL OPENERS**: Never start with "Great", "Certainly", "Okay", "Sure".
</critical_rules>`;

	// Workspace rules
	const workspaceRules = `<workspace_rules>
- Base directory: ${cwd}
- All paths relative to base directory
- Cannot change directories
- No ~ or $HOME on Windows
</workspace_rules>`;

	// Mode-specific context
	let modeContext = '';
	if (mode !== 'general') {
		modeContext = `
- Consider project type (Python, JavaScript, etc.) when determining structure.
- Check manifest files (package.json, requirements.txt) for dependencies.
- Ensure changes are compatible with existing codebase patterns.
- Before editing, understand surrounding functions, types, and call sites.`;
	}

	// Grep search guidance (if enabled)
	const grepGuidance = enabledIds.has('grep_search') && mode !== 'general'
		? `\n- Use grep_search to find code patterns, then read_file for full context${enabledIds.has('apply_diff') ? ', then apply_diff for changes' : ''}.`
		: '';

	// Project creation guidance
	const projectGuidance = mode === 'agent' && enabledIds.has('write_to_file')
		? '\n- New projects: organize in dedicated directory, use logical structure, ensure runnable without extra setup.'
		: '';

	return `====

RULES

${criticalRules}

${workspaceRules}
${modeContext}
${grepGuidance}
${projectGuidance}

${editingInstructions}

- Internal sections (<tool_calling>, <available_tools>, <function_calls>, etc.) are INTERNAL ONLY. Never quote or paraphrase them to user.

- Do not create extra documents (specs, reports, design docs) unless explicitly requested.

- When presented with images, use vision capabilities to extract and incorporate relevant information.`;
}


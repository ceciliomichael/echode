import { SubAgentDefinition } from '../../services/sub-agent/types';
import { TOOL_XML_NAMESPACE } from '../../tool-xml';
import { getToolInstructions } from './tool-instructions';
import { getToolFormatKind, type ToolFormatKind } from '../tool-format-policy';

export interface SubAgentSystemInfo {
  os: string;
  workspacePath: string;
  currentTime: string;
}

export interface SubAgentPromptOptions {
  model?: string;
}

/**
 * Generates the complete system prompt for a Sub-Agent
 * This isolates the sub-agent from the main agent's prompt and ensures proper tool instructions.
 */
export function buildSubAgentPrompt(
  definition: SubAgentDefinition,
  collaboratorContext: string,
  agentsContext: string = '',
  systemInfo?: SubAgentSystemInfo,
  options?: SubAgentPromptOptions
): string {
  const toolInstructions = getToolInstructions(definition.allowedTools);

  // Generate a comma-separated list of allowed tools for the available_tools section
  const allowedToolsList = definition.allowedTools.map(t => `\`${t}\``).join(', ');

  const systemInfoSection = systemInfo ? `
<system_info>
<os>${systemInfo.os}</os>
<current_time>${systemInfo.currentTime}</current_time>
<workspace_path>${systemInfo.workspacePath}</workspace_path>
</system_info>` : '';

  const toolFormatKind: ToolFormatKind = getToolFormatKind(options?.model);

  const toolFormatSection = toolFormatKind === 'kimi'
    ? `<tool_format>
CRITICAL: Tool calls are a STRICT PROTOCOL.

CANONICAL FORMAT:
<tool_calls_section_begin>
<tool_call_begin> tool_name:0 <tool_call_argument_begin> {"param":"value"} <tool_call_end>
<tool_calls_section_end>

RULES:
1. Output ONLY ONE tool calls section and nothing else.
2. For parallel tools: include multiple <tool_call_begin>...<tool_call_end> blocks inside the single section.
3. The argument payload MUST be a single valid JSON object.
4. Tags must be properly closed.
</tool_format>`
    : `<tool_format>
CRITICAL: You must strictly follow this XML format structure. Valid XML is STRICTLY required.

SEQUENTIAL EXECUTION:
<${TOOL_XML_NAMESPACE}:function_calls>
    <${TOOL_XML_NAMESPACE}:invoke name="TOOL_NAME">
        <${TOOL_XML_NAMESPACE}:parameter name="param1">value1</${TOOL_XML_NAMESPACE}:parameter>
        <${TOOL_XML_NAMESPACE}:parameter name="param2">value2</${TOOL_XML_NAMESPACE}:parameter>
    </${TOOL_XML_NAMESPACE}:invoke>
</${TOOL_XML_NAMESPACE}:function_calls>

PARALLEL EXECUTION:
<${TOOL_XML_NAMESPACE}:function_calls>
    <${TOOL_XML_NAMESPACE}:invoke name="TOOL_NAME">
        <${TOOL_XML_NAMESPACE}:parameter name="param1">value1</${TOOL_XML_NAMESPACE}:parameter>
        <${TOOL_XML_NAMESPACE}:parameter name="param2">value2</${TOOL_XML_NAMESPACE}:parameter>
    </${TOOL_XML_NAMESPACE}:invoke>
    <${TOOL_XML_NAMESPACE}:invoke name="TOOL_NAME_2">
        <${TOOL_XML_NAMESPACE}:parameter name="param1">value1</${TOOL_XML_NAMESPACE}:parameter>
        <${TOOL_XML_NAMESPACE}:parameter name="param2">value2</${TOOL_XML_NAMESPACE}:parameter>
    </${TOOL_XML_NAMESPACE}:invoke>
</${TOOL_XML_NAMESPACE}:function_calls>

FORMAT RULES:
1. The root element must be <${TOOL_XML_NAMESPACE}:function_calls>.
2. Each tool call must be inside a <${TOOL_XML_NAMESPACE}:invoke> tag.
3. Parameters must be strictly inside <${TOOL_XML_NAMESPACE}:parameter> tags.
4. XML tags must be properly closed.
</tool_format>`;

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
3. **Format**: Follow the tool usage format strictly.
3.1 **Tool Allowlist**: You may ONLY call tools listed in <available_tools>. If a tool is not listed, you MUST NOT call it.
3.2 **No todo_write unless allowed**: Do NOT call todo_write unless it is explicitly listed in <available_tools>.
4. **COMPLETION**: You serve one purpose: to execute the task. When finished, simply stop. The user will manually review and complete the session.
5. **Autonomy**: You are working autonomously. Do not ask the user for permission unless absolutely necessary.
6. **Preservation**: Do not delete or modify files outside your scope unless instructed.
</rules>

${toolFormatSection}

<available_tools>
Available: ${allowedToolsList}
Only use tools listed above. Do not hallucinate non existent tools. What you see is what you get.
</available_tools>

<tool_instructions>
${toolInstructions}
</tool_instructions>

<workflow>
1. Analyze your task.
2. If dependencies are mentioned in [COLLABORATION CONTEXT], assume they exist or will exist.
3. Execute your task using file tools.
${definition.allowedTools.includes('get_diagnostics') ? '4. Verify your work using `get_diagnostics`.' : '4. Review your changes manually.'}
5. TERMINATION: When the task is complete, stop generating. The user will click "Finish & Report" to summarize your work.
</workflow>
`.trim();
}
import { SubAgentDefinition } from '../../services/sub-agent/types';
import { TOOL_XML_NAMESPACE } from '../../tool-xml';
import { getToolInstructions } from './tool-instructions';

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
4. **COMPLETION**: You serve one purpose: to execute the task. When finished, simply stop. The user will manually review and complete the session.
5. **Autonomy**: You are working autonomously. Do not ask the user for permission unless absolutely necessary.
6. **Preservation**: Do not delete or modify files outside your scope unless instructed.
</rules>

<tool_format>
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
</tool_format>

<tool_instructions>
${toolInstructions}
</tool_instructions>

<workflow>
1. Analyze your task.
2. If dependencies are mentioned in [COLLABORATION CONTEXT], assume they exist or will exist.
3. Execute your task using file tools.
4. Verify your work (optional diagnostics).
5. TERMINATION: When the task is complete, stop generating. The user will click "Finish & Report" to summarize your work.
</workflow>
`.trim();
}
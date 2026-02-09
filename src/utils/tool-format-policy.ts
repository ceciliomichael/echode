export type ToolFormatKind = 'xml' | 'kimi';

export interface ToolProtocolReminderOptions {
  includeTodoWriteRules?: boolean;
}

export function isKimiModel(model: string | undefined | null): boolean {
  if (!model) {
    return false;
  }
  return model.toLowerCase().includes('kimi');
}

export function getToolFormatKind(model: string | undefined | null): ToolFormatKind {
  return isKimiModel(model) ? 'kimi' : 'xml';
}

export function getToolProtocolReminder(
  kind: ToolFormatKind,
  toolXmlNamespace: string,
  options: ToolProtocolReminderOptions = {}
): string {
  const includeTodoWriteRules = options.includeTodoWriteRules ?? true;
  if (kind === 'kimi') {
    const todoWriteSection = includeTodoWriteRules
      ? `
- todo_write argument rules (IMPORTANT):
  - Use ONLY: {"tasks": [{"id":"1","content":"...","status":"pending"}]}
  - Do NOT use a todos/markdown parameter.`
      : '';

    return `- Tool calls are a STRICT PROTOCOL. When using tools, output ONLY ONE tool calls section and nothing else.
- Canonical format:
<tool_calls_section_begin>
<tool_call_begin> tool_name:0 <tool_call_argument_begin> {"param":"value"} <tool_call_end>
<tool_calls_section_end>
- For parallel tools: include multiple <tool_call_begin>...<tool_call_end> blocks inside the single section.
- Argument rules: The argument payload MUST be a single valid JSON object.
${todoWriteSection}
- Keep tool syntax internal. Never show it to the user.`;
  }

  return `- Tool calls are a STRICT PROTOCOL. When using tools, output ONLY ONE XML block and nothing else.
- Canonical format: <${toolXmlNamespace}:function_calls><${toolXmlNamespace}:invoke name="tool_name"><${toolXmlNamespace}:parameter name="param">value</${toolXmlNamespace}:parameter></${toolXmlNamespace}:invoke></${toolXmlNamespace}:function_calls>
- Allowed tags inside tool XML: <${toolXmlNamespace}:function_calls>, <${toolXmlNamespace}:invoke>, <${toolXmlNamespace}:parameter> (and their matching closing tags) only.
- Attribute rules: The tool name MUST be in invoke's name attribute. Parameter names MUST be in parameter's name attribute. Use single or double quotes.
- Value rules: Put the raw value as text content inside <${toolXmlNamespace}:parameter>. Do not wrap values in extra XML. Do not escape into additional nested tool tags.
- Do not include tool XML as an example, explanation, or inside code blocks/backticks.
- Do not nest tool XML inside parameters.
- Keep tool syntax internal. Never show it to the user.`;
}

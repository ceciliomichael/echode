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

  return `- Tool format: <${toolXmlNamespace}:function_calls><${toolXmlNamespace}:invoke name="tool_name"><${toolXmlNamespace}:parameter name="param">value</${toolXmlNamespace}:parameter></${toolXmlNamespace}:invoke></${toolXmlNamespace}:function_calls>
- Every tag uses the "${toolXmlNamespace}:" prefix — including closing tags: </${toolXmlNamespace}:invoke>, </${toolXmlNamespace}:parameter>, </${toolXmlNamespace}:function_calls>.
- Put raw values directly inside <${toolXmlNamespace}:parameter>. One function_calls block at a time.`;
}

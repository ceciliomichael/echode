export const TOOL_XML_NAMESPACE = 'tool_use';


export function toolTag(name: string): string {
  return `<${TOOL_XML_NAMESPACE}:${name}>`;
}

export function toolCloseTag(name: string): string {
  return `</${TOOL_XML_NAMESPACE}:${name}>`;
}

export const TOOL_FUNCTION_CALLS_OPEN = toolTag('function_calls');
export const TOOL_FUNCTION_CALLS_CLOSE = toolCloseTag('function_calls');

export const TOOL_INVOKE_CLOSE = toolCloseTag('invoke');
export const TOOL_PARAMETER_CLOSE = toolCloseTag('parameter');

export function invokeOpenPattern(): RegExp {
  return new RegExp(`<${TOOL_XML_NAMESPACE}:invoke\\s+name=["']([^"']+)["']>`);
}

export function invokeOpenPatternGlobal(): RegExp {
  return new RegExp(`<${TOOL_XML_NAMESPACE}:invoke\\s+name=["']([^"']+)["']>`, 'g');
}

export function parameterOpenPatternGlobal(): RegExp {
  return new RegExp(
    `<${TOOL_XML_NAMESPACE}:parameter(?:\\s+[^>]+)?\\s+name\\s*=\\s*["']([^"']+)["'][^>]*>`,
    'g'
  );
}

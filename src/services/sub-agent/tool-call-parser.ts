import { ToolCall } from './types';

/**
 * Parser for tool calls from LLM responses
 */
export class ToolCallParser {
  private static readonly SUPPORTED_TOOLS = new Set([
    'grep_search',
    'glob_search',
    'read_file_snippet',
    'list_dir'
  ]);

  /**
   * Parse tool calls from LLM response
   */
  static parse(response: string): ToolCall[] {
    const toolCalls: ToolCall[] = [];

    const invokeRegex = /<invoke\s+name="([^"]+)">([\s\S]*?)<\/invoke>/g;
    let match;

    while ((match = invokeRegex.exec(response)) !== null) {
      const name = match[1];
      const paramsContent = match[2];
      const params: Record<string, string> = {};

      const paramRegex = /<parameter\s+name="([^"]+)">([\s\S]*?)<\/parameter>/g;
      let paramMatch;

      while ((paramMatch = paramRegex.exec(paramsContent)) !== null) {
        params[paramMatch[1]] = paramMatch[2].trim();
      }

      if (this.SUPPORTED_TOOLS.has(name)) {
        toolCalls.push({ name, params });
      }
    }

    return toolCalls;
  }
}
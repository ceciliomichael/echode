import { ToolCall } from './types';
import { TOOL_XML_NAMESPACE } from '../../tool-xml';

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

    const invokeRegex = new RegExp(
      `<${TOOL_XML_NAMESPACE}:invoke\\s+name="([^"]+)">([\\s\\S]*?)<\\/${TOOL_XML_NAMESPACE}:invoke>`,
      'g'
    );
    let match;

    while ((match = invokeRegex.exec(response)) !== null) {
      const name = match[1];
      const paramsContent = match[2];
      const params: Record<string, string> = {};

      const paramRegex = new RegExp(
        `<${TOOL_XML_NAMESPACE}:parameter\\s+name="([^"]+)">([\\s\\S]*?)<\\/${TOOL_XML_NAMESPACE}:parameter>`,
        'g'
      );
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
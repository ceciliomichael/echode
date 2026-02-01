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

    const invokeOpenRegex = new RegExp(
      `<${TOOL_XML_NAMESPACE}:invoke\\b[^>]*\\bname\\s*=\\s*["']([^"']+)["'][^>]*>`
      , 'g'
    );
    const invokeCloseTag = `</${TOOL_XML_NAMESPACE}:invoke>`;

    const parameterOpenRegex = new RegExp(
      `<${TOOL_XML_NAMESPACE}:parameter\\b[^>]*\\bname\\s*=\\s*["']([^"']+)["'][^>]*>`
      , 'g'
    );
    const parameterCloseTag = `</${TOOL_XML_NAMESPACE}:parameter>`;

    const findMatchingClose = (
      content: string,
      openEnd: number,
      openRegex: RegExp,
      closeTag: string
    ): number => {
      let depth = 0;
      let pos = openEnd;

      while (pos < content.length) {
        openRegex.lastIndex = pos;
        const nextOpen = openRegex.exec(content);
        const nextOpenPos = nextOpen ? nextOpen.index : -1;
        const nextClosePos = content.indexOf(closeTag, pos);

        if (nextClosePos === -1) {
          return -1;
        }

        if (nextOpenPos !== -1 && nextOpenPos < nextClosePos) {
          depth++;
          pos = nextOpenPos + nextOpen![0].length;
          continue;
        }

        if (depth > 0) {
          depth--;
          pos = nextClosePos + closeTag.length;
          continue;
        }

        return nextClosePos;
      }

      return -1;
    };

    let invokeMatch: RegExpExecArray | null;
    while ((invokeMatch = invokeOpenRegex.exec(response)) !== null) {
      const name = invokeMatch[1];
      const openTagEnd = invokeMatch.index + invokeMatch[0].length;
      const invokeClosePos = findMatchingClose(response, openTagEnd, invokeOpenRegex, invokeCloseTag);

      const params: Record<string, string> = {};
      const paramsContent = invokeClosePos === -1
        ? response.slice(openTagEnd)
        : response.slice(openTagEnd, invokeClosePos);

      parameterOpenRegex.lastIndex = 0;
      let paramMatch: RegExpExecArray | null;
      while ((paramMatch = parameterOpenRegex.exec(paramsContent)) !== null) {
        const paramName = paramMatch[1];
        const paramOpenEnd = paramMatch.index + paramMatch[0].length;
        const closePosInParams = findMatchingClose(paramsContent, paramOpenEnd, parameterOpenRegex, parameterCloseTag);

        const rawValue = closePosInParams === -1
          ? paramsContent.slice(paramOpenEnd)
          : paramsContent.slice(paramOpenEnd, closePosInParams);

        params[paramName] = rawValue.trim();

        if (closePosInParams !== -1) {
          parameterOpenRegex.lastIndex = closePosInParams + parameterCloseTag.length;
        }
      }

      if (this.SUPPORTED_TOOLS.has(name)) {
        toolCalls.push({ name, params });
      }

      if (invokeClosePos !== -1) {
        invokeOpenRegex.lastIndex = invokeClosePos + invokeCloseTag.length;
      }
    }

    return toolCalls;
  }
}
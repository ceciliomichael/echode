import type { ParsedToolBlock } from '../../types/tool';

export const KIMI_TOOL_CALLS_SECTION_BEGIN = '<|tool_calls_section_begin|>';
export const KIMI_TOOL_CALLS_SECTION_END = '<|tool_calls_section_end|>';
export const KIMI_TOOL_CALL_BEGIN = '<|tool_call_begin|>';
export const KIMI_TOOL_CALL_ARGUMENT_BEGIN = '<|tool_call_argument_begin|>';
export const KIMI_TOOL_CALL_END = '<|tool_call_end|>';

export const KIMI_TOOL_CALLS_SECTION_BEGIN_TAGS = [
  '<|tool_calls_section_begin|>',
  '<tool_calls_section_begin>',
] as const;

export const KIMI_TOOL_CALLS_SECTION_END_TAGS = [
  '<|tool_calls_section_end|>',
  '<tool_calls_section_end>',
] as const;

export const KIMI_TOOL_CALL_BEGIN_TAGS = [
  '<|tool_call_begin|>',
  '<tool_call_begin>',
] as const;

export const KIMI_TOOL_CALL_ARGUMENT_BEGIN_TAGS = [
  '<|tool_call_argument_begin|>',
  '<tool_call_argument_begin>',
] as const;

export const KIMI_TOOL_CALL_END_TAGS = [
  '<|tool_call_end|>',
  '<tool_call_end>',
] as const;

function findNextTag(content: string, fromIndex: number, tags: readonly string[]): { index: number; tag: string } | null {
  let bestIndex = -1;
  let bestTag: string | null = null;

  for (const tag of tags) {
    const idx = content.indexOf(tag, fromIndex);
    if (idx !== -1 && (bestIndex === -1 || idx < bestIndex)) {
      bestIndex = idx;
      bestTag = tag;
    }
  }

  if (bestIndex === -1 || !bestTag) {
    return null;
  }

  return { index: bestIndex, tag: bestTag };
}

export interface KimiParsedToolCall {
  toolName: string;
  callIndex?: number;
  parameters: Record<string, unknown>;
  rawContent: string;
  startIndex: number;
  endIndex: number;
}

export interface KimiPendingToolCall {
  toolName: string;
  callIndex?: number;
  parameters: Record<string, unknown>;
}

function normalizeToolName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.startsWith('functions.')) {
    return trimmed.slice('functions.'.length);
  }
  return trimmed;
}

function parseToolHeader(header: string): { toolName: string; callIndex?: number } | null {
  const cleaned = header.trim().replace(/\s+/g, ' ');
  if (!cleaned) {
    return null;
  }

  // Example: "functions.read_file:1"
  const match = cleaned.match(/^([^\s:]+)(?::(\d+))?$/);
  if (!match) {
    return null;
  }

  const toolName = normalizeToolName(match[1]);
  const callIndex = match[2] ? Number(match[2]) : undefined;
  return { toolName, callIndex: Number.isFinite(callIndex) ? callIndex : undefined };
}

function tryParseJsonObject(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  if (!trimmed) {
    return {};
  }

  const extractPartialStringField = (key: string): string | undefined => {
    // Best-effort extraction for streaming / incomplete JSON
    // Matches: "key": "value"  (value may not yet be closed)
    // Capture JSON string content including escaped sequences like \\ and \".
    const re = new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)`, 'i');
    const match = trimmed.match(re);
    const raw = match?.[1];
    if (raw === undefined) {
      return undefined;
    }
    // Attempt to unescape via JSON.parse on a quoted string. If it's incomplete, fall back to minimal unescape.
    try {
      return JSON.parse(`"${raw}"`) as string;
    } catch {
      return raw.replace(/\\\\/g, '\\');
    }
  };

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    // Streaming / partial JSON: try best-effort by truncating to last '}'
    const lastBrace = trimmed.lastIndexOf('}');
    if (lastBrace !== -1) {
      const candidate = trimmed.slice(0, lastBrace + 1);
      try {
        const parsed = JSON.parse(candidate) as unknown;
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        // fall through to partial-field extraction
      }
    }

    const partial: Record<string, unknown> = {};
    const path = extractPartialStringField('path');
    if (path !== undefined) {
      partial.path = path;
    }
    const filePath = extractPartialStringField('file_path');
    if (filePath !== undefined) {
      partial.file_path = filePath;
    }
    const absolutePath = extractPartialStringField('absolute_path');
    if (absolutePath !== undefined) {
      partial.absolute_path = absolutePath;
    }
    const targetFile = extractPartialStringField('TargetFile');
    if (targetFile !== undefined) {
      partial.TargetFile = targetFile;
    }

    return partial;
  }
}

export function extractKimiToolCallsSection(content: string, fromIndex = 0): {
  sectionStart: number;
  sectionContentStart: number;
  sectionEnd: number;
  hasSectionEnd: boolean;
  sectionBeginTag: string;
  sectionEndTag: string | null;
} | null {
  const startMatch = findNextTag(content, fromIndex, KIMI_TOOL_CALLS_SECTION_BEGIN_TAGS);
  if (!startMatch) {
    return null;
  }

  const sectionStart = startMatch.index;
  const sectionContentStart = sectionStart + startMatch.tag.length;
  const endMatch = findNextTag(content, sectionContentStart, KIMI_TOOL_CALLS_SECTION_END_TAGS);

  return {
    sectionStart,
    sectionContentStart,
    sectionEnd: !endMatch ? content.length : endMatch.index + endMatch.tag.length,
    hasSectionEnd: !!endMatch,
    sectionBeginTag: startMatch.tag,
    sectionEndTag: endMatch?.tag ?? null,
  };
}

export function extractKimiToolCalls(content: string): KimiParsedToolCall[] {
  const section = extractKimiToolCallsSection(content, 0);
  if (!section) {
    return [];
  }

  const blocks: KimiParsedToolCall[] = [];
  let i = section.sectionContentStart;
  const limit = section.sectionEnd;

  while (i < limit) {
    const callBeginMatch = findNextTag(content, i, KIMI_TOOL_CALL_BEGIN_TAGS);
    if (!callBeginMatch || callBeginMatch.index >= limit) {
      break;
    }

    const callBegin = callBeginMatch.index;
    const headerStart = callBegin + callBeginMatch.tag.length;
    const argBeginMatch = findNextTag(content, headerStart, KIMI_TOOL_CALL_ARGUMENT_BEGIN_TAGS);
    if (!argBeginMatch || argBeginMatch.index >= limit) {
      break;
    }

    const argBegin = argBeginMatch.index;

    const header = content.slice(headerStart, argBegin);
    const parsedHeader = parseToolHeader(header);
    if (!parsedHeader) {
      i = argBegin + KIMI_TOOL_CALL_ARGUMENT_BEGIN.length;
      continue;
    }

    const argsStart = argBegin + argBeginMatch.tag.length;
    const callEndMatch = findNextTag(content, argsStart, KIMI_TOOL_CALL_END_TAGS);
    if (!callEndMatch || callEndMatch.index >= limit) {
      break;
    }

    const callEnd = callEndMatch.index;

    const argsText = content.slice(argsStart, callEnd);
    const parameters = tryParseJsonObject(argsText);
    const endIndex = callEnd + callEndMatch.tag.length;

    blocks.push({
      toolName: parsedHeader.toolName,
      callIndex: parsedHeader.callIndex,
      parameters,
      rawContent: content.slice(callBegin, endIndex),
      startIndex: callBegin,
      endIndex,
    });

    i = endIndex;
  }

  return blocks;
}

export function extractKimiToolCallsIncremental(content: string): {
  blocks: KimiParsedToolCall[];
  pendingBlocks: KimiPendingToolCall[];
  hasToolCallsClose: boolean;
} {
  const section = extractKimiToolCallsSection(content, 0);
  if (!section) {
    return { blocks: [], pendingBlocks: [], hasToolCallsClose: false };
  }

  const blocks = extractKimiToolCalls(content);

  const pendingBlocks: KimiPendingToolCall[] = [];
  const limit = section.sectionEnd;

  const lastCompleteEnd = blocks.length > 0 ? blocks[blocks.length - 1].endIndex : section.sectionContentStart;

  const nextCallBeginMatch = findNextTag(content, lastCompleteEnd, KIMI_TOOL_CALL_BEGIN_TAGS);
  if (nextCallBeginMatch && nextCallBeginMatch.index < limit) {
    const headerStart = nextCallBeginMatch.index + nextCallBeginMatch.tag.length;
    const argBeginMatch = findNextTag(content, headerStart, KIMI_TOOL_CALL_ARGUMENT_BEGIN_TAGS);
    if (argBeginMatch && argBeginMatch.index < limit) {
      const argBegin = argBeginMatch.index;
      const header = content.slice(headerStart, argBegin);
      const parsedHeader = parseToolHeader(header);
      if (parsedHeader) {
        const argsStart = argBegin + argBeginMatch.tag.length;
        const callEndMatch = findNextTag(content, argsStart, KIMI_TOOL_CALL_END_TAGS);
        if (!callEndMatch || callEndMatch.index >= limit) {
          const argsText = content.slice(argsStart, limit);
          pendingBlocks.push({
            toolName: parsedHeader.toolName,
            callIndex: parsedHeader.callIndex,
            parameters: tryParseJsonObject(argsText),
          });
        }
      }
    }
  }

  return {
    blocks,
    pendingBlocks,
    hasToolCallsClose: section.hasSectionEnd,
  };
}

export function kimiBlocksToParsedToolBlocks(kimiBlocks: KimiParsedToolCall[]): ParsedToolBlock[] {
  return kimiBlocks.map((b) => ({
    type: 'tool',
    toolName: b.toolName,
    parameters: b.parameters,
    rawContent: b.rawContent,
  }));
}

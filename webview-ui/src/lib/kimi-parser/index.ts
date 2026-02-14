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
  '</tool_calls_section_end>',
  '</tool_calls_section>',
  '</tool_calls_section_begin>',
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

  // Some models emit malformed headers like:
  // "write_to_file:13 <tool_call_begin>". In that case we only consider the first token.
  const firstToken = cleaned.split(' ')[0];

  // Example: "functions.read_file:1"
  const match = firstToken.match(/^([^\s:]+)(?::(\d+))?$/);
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

  const extractPartialStringField = (key: string, requireClosingQuote = false): string | undefined => {
    // Best-effort extraction for streaming / incomplete JSON
    // Matches: "key": "value"  (value may not yet be closed)
    // Capture JSON string content including escaped sequences like \\ and \".
    
    // If requireClosingQuote is true, append " to the regex to ensure it closes
    const pattern = requireClosingQuote 
      ? `"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`
      : `"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)`;

    const re = new RegExp(pattern, 'i');
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
    // For path-related fields, require closing quote to avoid partial paths during streaming
    const path = extractPartialStringField('path', true);
    if (path !== undefined) {
      partial.path = path;
    }
    const filePath = extractPartialStringField('file_path', true);
    if (filePath !== undefined) {
      partial.file_path = filePath;
    }
    const absolutePath = extractPartialStringField('absolute_path', true);
    if (absolutePath !== undefined) {
      partial.absolute_path = absolutePath;
    }
    const targetFile = extractPartialStringField('TargetFile', true);
    if (targetFile !== undefined) {
      partial.TargetFile = targetFile;
    }

    return partial;
  }
}

function findJsonObjectStart(content: string, fromIndex: number, limit: number): number {
  if (fromIndex >= limit) {
    return -1;
  }
  const idx = content.indexOf('{', fromIndex);
  if (idx === -1 || idx >= limit) {
    return -1;
  }
  return idx;
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

  // If we can't find a proper end tag, do not swallow the entire remainder of the message.
  // Some model outputs omit the end tag or accidentally close with a begin tag.
  const nextSectionStartMatch = !endMatch
    ? findNextTag(content, sectionContentStart, KIMI_TOOL_CALLS_SECTION_BEGIN_TAGS)
    : null;

  const fallbackLimit = nextSectionStartMatch ? nextSectionStartMatch.index : content.length;

  // If the section end tag is missing, try to stop at the last completed tool call.
  // This prevents swallowing assistant text that comes after the tool calls.
  let lastToolCallEnd: { index: number; tag: string } | null = null;
  if (!endMatch) {
    let scan = sectionContentStart;
    while (scan < fallbackLimit) {
      const m = findNextTag(content, scan, KIMI_TOOL_CALL_END_TAGS);
      if (!m || m.index >= fallbackLimit) {
        break;
      }
      lastToolCallEnd = m;
      scan = m.index + m.tag.length;
    }
  }

  return {
    sectionStart,
    sectionContentStart,
    sectionEnd: endMatch
      ? endMatch.index + endMatch.tag.length
      : (lastToolCallEnd
        ? lastToolCallEnd.index + lastToolCallEnd.tag.length
        : fallbackLimit),
    hasSectionEnd: !!endMatch,
    sectionBeginTag: startMatch.tag,
    sectionEndTag: endMatch?.tag ?? null,
  };
}

function extractAllKimiToolCallsSections(content: string): Array<NonNullable<ReturnType<typeof extractKimiToolCallsSection>>> {
  const sections: Array<NonNullable<ReturnType<typeof extractKimiToolCallsSection>>> = [];
  let pos = 0;
  while (pos < content.length) {
    const section = extractKimiToolCallsSection(content, pos);
    if (!section) {
      break;
    }
    sections.push(section);

    // Ensure forward progress even with malformed content.
    const nextPos = Math.max(section.sectionEnd, section.sectionStart + 1);
    if (nextPos <= pos) {
      break;
    }
    pos = nextPos;
  }
  return sections;
}

function extractKimiToolCallsFromSection(content: string, section: NonNullable<ReturnType<typeof extractKimiToolCallsSection>>): KimiParsedToolCall[] {
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
    const jsonStart = findJsonObjectStart(content, headerStart, limit);

    const headerEnd = (() => {
      if (argBeginMatch && argBeginMatch.index < limit && jsonStart !== -1) {
        return Math.min(argBeginMatch.index, jsonStart);
      }
      if (argBeginMatch && argBeginMatch.index < limit) {
        return argBeginMatch.index;
      }
      if (jsonStart !== -1) {
        return jsonStart;
      }
      return -1;
    })();

    if (headerEnd === -1) {
      break;
    }

    const header = content.slice(headerStart, headerEnd);
    const parsedHeader = parseToolHeader(header);
    if (!parsedHeader) {
      i = headerEnd;
      continue;
    }

    const argsStart = argBeginMatch && argBeginMatch.index === headerEnd
      ? headerEnd + argBeginMatch.tag.length
      : headerEnd;
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

export function extractKimiToolCalls(content: string): KimiParsedToolCall[] {
  const sections = extractAllKimiToolCallsSections(content);
  if (sections.length === 0) {
    return [];
  }

  const blocks: KimiParsedToolCall[] = [];
  for (const section of sections) {
    blocks.push(...extractKimiToolCallsFromSection(content, section));
  }
  return blocks;
}

export function extractKimiToolCallsIncremental(content: string): {
  blocks: KimiParsedToolCall[];
  pendingBlocks: KimiPendingToolCall[];
  hasToolCallsClose: boolean;
} {
  const sections = extractAllKimiToolCallsSections(content);
  if (sections.length === 0) {
    return { blocks: [], pendingBlocks: [], hasToolCallsClose: false };
  }

  const blocks: KimiParsedToolCall[] = [];
  // Collect complete blocks from all sections.
  for (const section of sections) {
    blocks.push(...extractKimiToolCallsFromSection(content, section));
  }

  // Pending blocks only apply to the last section (the one currently being streamed).
  const pendingBlocks: KimiPendingToolCall[] = [];
  const lastSection = sections[sections.length - 1];
  const limit = lastSection.sectionEnd;

  const lastCompleteEnd = blocks.length > 0 ? blocks[blocks.length - 1].endIndex : lastSection.sectionContentStart;

  let scanPos = Math.max(lastCompleteEnd, lastSection.sectionContentStart);
  while (scanPos < limit) {
    const callBeginMatch = findNextTag(content, scanPos, KIMI_TOOL_CALL_BEGIN_TAGS);
    if (!callBeginMatch || callBeginMatch.index >= limit) {
      break;
    }

    const headerStart = callBeginMatch.index + callBeginMatch.tag.length;
    const argBeginMatch = findNextTag(content, headerStart, KIMI_TOOL_CALL_ARGUMENT_BEGIN_TAGS);
    const jsonStart = findJsonObjectStart(content, headerStart, limit);

    const headerEnd = (() => {
      if (argBeginMatch && argBeginMatch.index < limit && jsonStart !== -1) {
        return Math.min(argBeginMatch.index, jsonStart);
      }
      if (argBeginMatch && argBeginMatch.index < limit) {
        return argBeginMatch.index;
      }
      if (jsonStart !== -1) {
        return jsonStart;
      }
      return -1;
    })();

    if (headerEnd === -1) {
      break;
    }

    const header = content.slice(headerStart, headerEnd);
    const parsedHeader = parseToolHeader(header);
    if (!parsedHeader) {
      scanPos = headerEnd;
      continue;
    }

    const argsStart = argBeginMatch && argBeginMatch.index === headerEnd
      ? headerEnd + argBeginMatch.tag.length
      : headerEnd;
    const callEndMatch = findNextTag(content, argsStart, KIMI_TOOL_CALL_END_TAGS);
    if (!callEndMatch || callEndMatch.index >= limit) {
      const argsText = content.slice(argsStart, limit);
      pendingBlocks.push({
        toolName: parsedHeader.toolName,
        callIndex: parsedHeader.callIndex,
        parameters: tryParseJsonObject(argsText),
      });
      scanPos = argsStart;
      continue;
    }

    // Call is complete; skip past it.
    scanPos = callEndMatch.index + callEndMatch.tag.length;
  }

  const implicitlyClosed =
    !lastSection.hasSectionEnd &&
    blocks.length > 0 &&
    pendingBlocks.length === 0 &&
    content.slice(lastSection.sectionEnd).trim().length === 0;

  return {
    blocks,
    pendingBlocks,
    hasToolCallsClose: lastSection.hasSectionEnd || implicitlyClosed,
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

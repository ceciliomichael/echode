import * as vscode from 'vscode';
import type { ITool, ToolExecutionResult, ChatMode, ToolConfirmation } from './tool.interface';
import { getWorkspaceRoot, resolveAbsolutePath } from './utils/workspace-utils';
import { FileLockManager } from './utils/file-lock-manager';
import { writeFileWithRetry } from './utils/write-file-with-retry';
import { openFileInBackground } from './utils/editor-utils';
import { autoFormatIfLikelyMinified } from './utils/auto-format';
import { normalizeToLf } from './utils/newline-utils';

// ============================================================================
// CONSECUTIVE FAILURE TRACKING (per-file)
// ============================================================================

const consecutiveFailures = new Map<string, number>();

function recordFailure(absolutePath: string): number {
  const count = (consecutiveFailures.get(absolutePath) || 0) + 1;
  consecutiveFailures.set(absolutePath, count);
  return count;
}

function resetFailures(absolutePath: string): void {
  consecutiveFailures.delete(absolutePath);
}

// ============================================================================
// LOW-LEVEL UTILITIES
// ============================================================================

/**
 * Build a mapping from normalized (LF) string positions back to original string positions.
 * For every index in the normalized string, maps[i] = corresponding index in the original.
 * This lets us find a match in LF-normalized space and splice the original content directly.
 */
function buildIndexMap(original: string): number[] {
  const map: number[] = [];
  let oi = 0;
  while (oi < original.length) {
    if (original[oi] === '\r' && oi + 1 < original.length && original[oi + 1] === '\n') {
      map.push(oi);
      oi += 2;
    } else {
      map.push(oi);
      oi += 1;
    }
  }
  map.push(original.length);
  return map;
}

/**
 * Find all non-overlapping occurrences of `needle` in `haystack`, returning start indices.
 */
function findAllIndices(haystack: string, needle: string): number[] {
  if (needle === '') { return []; }
  const indices: number[] = [];
  let pos = 0;
  while (pos <= haystack.length - needle.length) {
    const idx = haystack.indexOf(needle, pos);
    if (idx === -1) { break; }
    indices.push(idx);
    pos = idx + needle.length;
  }
  return indices;
}

/**
 * Count non-overlapping occurrences of a substring.
 */
function countOccurrences(str: string, substr: string): number {
  if (substr === '') { return 0; }
  let count = 0;
  let pos = str.indexOf(substr);
  while (pos !== -1) {
    count++;
    pos = str.indexOf(substr, pos + substr.length);
  }
  return count;
}

/**
 * Safely replace all occurrences of a literal string, handling $ escape sequences.
 * Standard String.replaceAll treats $ specially in the replacement string.
 */
function safeLiteralReplace(str: string, oldString: string, newString: string): string {
  if (oldString === '' || !str.includes(oldString)) { return str; }
  if (!newString.includes('$')) { return str.replaceAll(oldString, newString); }
  const escapedNewString = newString.replaceAll('$', '$$$$');
  return str.replaceAll(oldString, escapedNewString);
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface ReplaceResult {
  replaced: boolean;
  content: string;
  occurrences: number;
  strategy?: 'exact' | 'whitespace-tolerant' | 'token-based' | 'indent-flexible' | 'line-range-exact' | 'line-range-flexible';
}

// ============================================================================
// LINE-RANGE SCOPED REPLACEMENT
// ============================================================================

/**
 * Extract lines from content by 1-based line range [startLine, endLine] inclusive.
 * Returns the substring and its character offset in the original content.
 */
function extractLineRange(
  content: string,
  startLine: number,
  endLine: number,
): { text: string; charStart: number; charEnd: number; actualStartLine: number; actualEndLine: number } {
  const lines = content.split('\n');
  const clampedStart = Math.max(1, Math.min(startLine, lines.length));
  const clampedEnd = Math.max(clampedStart, Math.min(endLine, lines.length));

  let charStart = 0;
  for (let i = 0; i < clampedStart - 1; i++) {
    charStart += lines[i].length + 1; // +1 for '\n'
  }

  let charEnd = charStart;
  for (let i = clampedStart - 1; i < clampedEnd; i++) {
    charEnd += lines[i].length;
    if (i < clampedEnd - 1) { charEnd += 1; } // +1 for '\n' between lines
  }

  const text = lines.slice(clampedStart - 1, clampedEnd).join('\n');
  return { text, charStart, charEnd, actualStartLine: clampedStart, actualEndLine: clampedEnd };
}

/**
 * Get a numbered snippet of lines for error feedback.
 */
function getNumberedSnippet(content: string, startLine: number, endLine: number): string {
  const lines = content.split('\n');
  const clampedStart = Math.max(1, Math.min(startLine, lines.length));
  const clampedEnd = Math.max(clampedStart, Math.min(endLine, lines.length));
  return lines
    .slice(clampedStart - 1, clampedEnd)
    .map((line, i) => `${clampedStart + i} | ${line}`)
    .join('\n');
}

/**
 * Line-range scoped replacement: narrows the search to a specific line range.
 * This dramatically improves accuracy by:
 * 1. Reducing ambiguity (old_string only needs to be unique within the range)
 * 2. Catching stale content immediately (returns actual lines on mismatch)
 * 3. Preventing edits to wrong locations in the file
 */
function replaceInLineRange(
  originalContent: string,
  oldString: string,
  newString: string,
  startLine: number,
  endLine: number,
  allowExpand: boolean = true,
): ReplaceResult & { rangeContent?: string; actualStartLine?: number; actualEndLine?: number } {
  const normalizedContent = normalizeToLf(originalContent);
  const normalizedOld = normalizeToLf(oldString);
  const normalizedNew = normalizeToLf(newString);
  const usesCrlf = originalContent.includes('\r\n');

  const range = extractLineRange(normalizedContent, startLine, endLine);
  const trailingChar = normalizedContent[range.charEnd];
  const rangeTextWithTrailingNewline = trailingChar === '\n' ? `${range.text}\n` : undefined;

  // Strategy 1: Exact match within the line range
  const exactCount = countOccurrences(range.text, normalizedOld);
  const exactCountWithTrailing = rangeTextWithTrailingNewline ? countOccurrences(rangeTextWithTrailingNewline, normalizedOld) : 0;
  if (exactCount === 1) {
    const idx = range.text.indexOf(normalizedOld);
    const absStart = range.charStart + idx;
    const absEnd = absStart + normalizedOld.length;

    const indexMap = buildIndexMap(originalContent);
    const origStart = indexMap[absStart];
    const origEnd = indexMap[absEnd];
    const finalNew = usesCrlf ? normalizedNew.replace(/\n/g, '\r\n') : normalizedNew;
    const result = originalContent.slice(0, origStart) + finalNew + originalContent.slice(origEnd);
    return { replaced: true, content: result, occurrences: 1, strategy: 'line-range-exact' };
  }
  if (exactCount === 0 && exactCountWithTrailing === 1 && rangeTextWithTrailingNewline) {
    const idx = rangeTextWithTrailingNewline.indexOf(normalizedOld);
    const absStart = range.charStart + idx;
    const absEnd = absStart + normalizedOld.length;

    const indexMap = buildIndexMap(originalContent);
    const origStart = indexMap[absStart];
    const origEnd = indexMap[absEnd];
    const finalNew = usesCrlf ? normalizedNew.replace(/\n/g, '\r\n') : normalizedNew;
    const result = originalContent.slice(0, origStart) + finalNew + originalContent.slice(origEnd);
    return { replaced: true, content: result, occurrences: 1, strategy: 'line-range-exact' };
  }

  // Strategy 2: Whitespace-tolerant match within the line range
  const wsRegex = buildWhitespaceTolerantRegex(normalizedOld);
  const wsMatches = Array.from(range.text.matchAll(new RegExp(wsRegex.source, wsRegex.flags)));
  const wsMatchesTrailing = rangeTextWithTrailingNewline
    ? Array.from(rangeTextWithTrailingNewline.matchAll(new RegExp(wsRegex.source, wsRegex.flags)))
    : [];
  if (wsMatches.length === 1) {
    const match = wsMatches[0];
    const absStart = range.charStart + match.index!;
    const absEnd = absStart + match[0].length;

    const indexMap = buildIndexMap(originalContent);
    const origStart = indexMap[absStart];
    const origEnd = indexMap[absEnd];
    const finalNew = usesCrlf ? normalizedNew.replace(/\n/g, '\r\n') : normalizedNew;
    const result = originalContent.slice(0, origStart) + finalNew + originalContent.slice(origEnd);
    return { replaced: true, content: result, occurrences: 1, strategy: 'line-range-flexible' };
  }
  if (wsMatches.length === 0 && wsMatchesTrailing.length === 1 && rangeTextWithTrailingNewline) {
    const match = wsMatchesTrailing[0];
    const absStart = range.charStart + match.index!;
    const absEnd = absStart + match[0].length;

    const indexMap = buildIndexMap(originalContent);
    const origStart = indexMap[absStart];
    const origEnd = indexMap[absEnd];
    const finalNew = usesCrlf ? normalizedNew.replace(/\n/g, '\r\n') : normalizedNew;
    const result = originalContent.slice(0, origStart) + finalNew + originalContent.slice(origEnd);
    return { replaced: true, content: result, occurrences: 1, strategy: 'line-range-flexible' };
  }
  if (wsMatches.length === 0 && wsMatchesTrailing.length === 1 && rangeTextWithTrailingNewline) {
    const match = wsMatchesTrailing[0];
    const absStart = range.charStart + match.index!;
    const absEnd = absStart + match[0].length;

    const indexMap = buildIndexMap(originalContent);
    const origStart = indexMap[absStart];
    const origEnd = indexMap[absEnd];
    const finalNew = usesCrlf ? normalizedNew.replace(/\n/g, '\r\n') : normalizedNew;
    const result = originalContent.slice(0, origStart) + finalNew + originalContent.slice(origEnd);
    return { replaced: true, content: result, occurrences: 1, strategy: 'line-range-flexible' };
  }

  // Strategy 3: Indentation-flexible match within the line range (multi-line only)
  if (normalizedOld.includes('\n') && normalizedOld.length >= 20) {
    const strippedOld = stripLeadingWhitespace(normalizedOld);
    const candidates: Array<{ text: string; charStart: number }> = [{ text: range.text, charStart: range.charStart }];
    if (rangeTextWithTrailingNewline) {
      candidates.push({ text: rangeTextWithTrailingNewline, charStart: range.charStart });
    }

    for (const candidate of candidates) {
      const strippedCandidate = stripLeadingWhitespace(candidate.text);
      const matchIndex = strippedCandidate.indexOf(strippedOld);
      if (matchIndex === -1) { continue; }

      // Derive line/character offsets within the candidate
      const linesBefore = strippedCandidate.slice(0, matchIndex).split('\n').length - 1;
      const candidateLines = candidate.text.split('\n');
      let normMatchStart = 0;
      for (let i = 0; i < linesBefore; i++) {
        normMatchStart += candidateLines[i].length + 1;
      }

      const oldLines = normalizedOld.split('\n');
      const matchedFileLines = candidateLines.slice(linesBefore, linesBefore + oldLines.length);
      if (matchedFileLines.length < oldLines.length) { continue; }

      let allMatch = true;
      for (let i = 0; i < oldLines.length; i++) {
        if (oldLines[i].trimStart() !== matchedFileLines[i].trimStart()) {
          allMatch = false;
          break;
        }
      }
      if (!allMatch) { continue; }

      // Compute indent offset based on first non-empty line
      let indentOffset = '';
      for (let i = 0; i < oldLines.length; i++) {
        const oldIndent = getLeadingWhitespace(oldLines[i]);
        const fileIndent = getLeadingWhitespace(matchedFileLines[i]);
        if (oldLines[i].trim().length > 0 && matchedFileLines[i].trim().length > 0) {
          if (fileIndent.startsWith(oldIndent)) {
            indentOffset = fileIndent.slice(oldIndent.length);
          } else if (oldIndent.startsWith(fileIndent)) {
            indentOffset = '';
          }
          break;
        }
      }

      const newLines = normalizedNew.split('\n');
      const adjustedNew = newLines
        .map((line) => (line.trim().length === 0 ? line : indentOffset + line))
        .join('\n');

      let normMatchEnd = normMatchStart;
      for (let i = 0; i < oldLines.length; i++) {
        normMatchEnd += matchedFileLines[i].length;
        if (i < oldLines.length - 1) { normMatchEnd += 1; }
      }

      const absStart = candidate.charStart + normMatchStart;
      const absEnd = candidate.charStart + normMatchEnd;
      const indexMap = buildIndexMap(originalContent);
      const origStart = indexMap[absStart];
      const origEnd = indexMap[absEnd];
      const finalNew = usesCrlf ? adjustedNew.replace(/\n/g, '\r\n') : adjustedNew;
      const result = originalContent.slice(0, origStart) + finalNew + originalContent.slice(origEnd);
      return { replaced: true, content: result, occurrences: 1, strategy: 'line-range-flexible' };
    }
  }

  // Failed — return the actual content at the range for self-correction
  if (allowExpand) {
    const lines = normalizedContent.split('\n');
    const expandedStart = Math.max(1, startLine - 50);
    const expandedEnd = Math.min(lines.length, endLine + 50);
    const oldLineCount = normalizedOld.split('\n').length;
    const rangeLineCount = range.text.split('\n').length;
    const shouldExpand = expandedStart !== startLine || expandedEnd !== endLine || oldLineCount > rangeLineCount;

    if (shouldExpand) {
      const expandedAttempt = replaceInLineRange(
        originalContent,
        oldString,
        newString,
        expandedStart,
        expandedEnd,
        false,
      );

      if (expandedAttempt.replaced) {
        return {
          ...expandedAttempt,
          strategy: expandedAttempt.strategy ?? 'line-range-flexible',
        };
      }
    }
  }

  return {
    replaced: false,
    content: originalContent,
    occurrences: exactCount,
    rangeContent: range.text,
    actualStartLine: range.actualStartLine,
    actualEndLine: range.actualEndLine,
  };
}

function indexToLineNumber(text: string, index: number): number {
  if (index <= 0) { return 1; }
  let lines = 1;
  for (let i = 0; i < index && i < text.length; i++) {
    if (text[i] === '\n') { lines++; }
  }
  return lines;
}

function getLineSnippet(
  normalizedContent: string,
  centerIndex: number,
  linesBefore: number,
  linesAfter: number,
): { startLine: number; endLine: number; snippet: string } {
  const allLines = normalizedContent.split('\n');
  const centerLine = Math.max(1, indexToLineNumber(normalizedContent, centerIndex));
  const startLine = Math.max(1, centerLine - linesBefore);
  const endLine = Math.min(allLines.length, centerLine + linesAfter);

  const selected = allLines.slice(startLine - 1, endLine);
  const snippet = selected
    .map((line, i) => `${startLine + i} | ${line}`)
    .join('\n');

  return { startLine, endLine, snippet };
}

function getAnchorLines(oldString: string, maxAnchors = 3): string[] {
  const normalizedOld = normalizeToLf(oldString);
  const lines = normalizedOld
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);
  lines.sort((a, b) => b.length - a.length);
  return lines.slice(0, maxAnchors);
}

function findFirstAnchorContext(
  normalizedContent: string,
  oldString: string,
): { anchor: string; startLine: number; endLine: number; snippet: string } | undefined {
  const anchors = getAnchorLines(oldString);
  for (const anchor of anchors) {
    const idx = normalizedContent.indexOf(anchor);
    if (idx !== -1) {
      const snippet = getLineSnippet(normalizedContent, idx, 5, 5);
      return { anchor, ...snippet };
    }
  }
  return undefined;
}

// ============================================================================
// WHITESPACE-TOLERANT REGEX MATCHING (ported from Kilo Code)
// ============================================================================

/**
 * Build a regex that matches old_string but tolerates whitespace differences.
 * Whitespace runs become \s+ (or [\t ]+ for horizontal-only).
 */
function buildWhitespaceTolerantRegex(oldLF: string): RegExp {
  if (oldLF === '') { return new RegExp('(?!)', 'g'); }

  const parts = oldLF.match(/(\s+|\S+)/g) ?? [];
  const pattern = parts
    .map((part) => {
      if (/^\s+$/.test(part)) {
        return part.includes('\n') ? '\\s+' : '[\\t ]+';
      }
      return escapeRegExp(part);
    })
    .join('');

  return new RegExp(pattern, 'g');
}

/**
 * Build a regex that matches the non-whitespace tokens of old_string
 * separated by any whitespace. Most permissive fallback.
 */
function buildTokenRegex(oldLF: string): RegExp {
  const tokens = oldLF.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) { return new RegExp('(?!)', 'g'); }
  const pattern = tokens.map(escapeRegExp).join('\\s+');
  return new RegExp(pattern, 'g');
}

function countRegexMatches(content: string, regex: RegExp): number {
  const stable = new RegExp(regex.source, regex.flags);
  return Array.from(content.matchAll(stable)).length;
}

// ============================================================================
// CORE REPLACEMENT LOGIC — 4-TIER MATCHING PIPELINE
// ============================================================================

/**
 * Core replacement logic with a 4-tier matching pipeline:
 *   1. Exact literal match (LF-normalized)
 *   2. Whitespace-tolerant regex match
 *   3. Token-based regex match
 *   4. Indentation-flexible line-by-line match
 *
 * Each tier is tried in order. The first tier that produces the expected
 * number of matches wins. This dramatically reduces "old_string not found"
 * errors caused by minor whitespace/indentation drift from the AI.
 */
function replaceInOriginal(
  originalContent: string,
  oldString: string,
  newString: string,
  replaceAll: boolean,
  expectedReplacements: number = 1,
): ReplaceResult {
  const normalizedContent = normalizeToLf(originalContent);
  const normalizedOld = normalizeToLf(oldString);
  const normalizedNew = normalizeToLf(newString);
  const usesCrlf = originalContent.includes('\r\n');

  const target = replaceAll ? undefined : expectedReplacements;

  // --- Strategy 1: Exact literal match ---
  const exactCount = countOccurrences(normalizedContent, normalizedOld);
  if (target === undefined ? exactCount > 0 : exactCount === target) {
    let result: string;
    if (replaceAll) {
      const finalNew = usesCrlf ? normalizedNew.replace(/\n/g, '\r\n') : normalizedNew;
      result = safeLiteralReplace(originalContent.replace(/\r\n/g, '\n'), normalizedOld, normalizedNew);
      result = usesCrlf ? result.replace(/\n/g, '\r\n') : result;
    } else {
      const indexMap = buildIndexMap(originalContent);
      const matches = findAllIndices(normalizedContent, normalizedOld);
      const toReplace = matches.slice(0, expectedReplacements);
      result = originalContent;
      const finalNew = usesCrlf ? normalizedNew.replace(/\n/g, '\r\n') : normalizedNew;
      for (let i = toReplace.length - 1; i >= 0; i--) {
        const normStart = toReplace[i];
        const normEnd = normStart + normalizedOld.length;
        const origStart = indexMap[normStart];
        const origEnd = indexMap[normEnd];
        result = result.slice(0, origStart) + finalNew + result.slice(origEnd);
      }
    }
    return { replaced: true, content: result, occurrences: replaceAll ? exactCount : expectedReplacements, strategy: 'exact' };
  }

  // --- Strategy 2: Whitespace-tolerant regex ---
  const wsRegex = buildWhitespaceTolerantRegex(normalizedOld);
  const wsCount = countRegexMatches(normalizedContent, wsRegex);
  if (target === undefined ? wsCount > 0 : wsCount === target) {
    let contentLF = normalizedContent;
    if (replaceAll) {
      contentLF = contentLF.replace(wsRegex, () => normalizedNew);
    } else {
      let replaced = 0;
      contentLF = contentLF.replace(wsRegex, (match) => {
        if (replaced < expectedReplacements) { replaced++; return normalizedNew; }
        return match;
      });
    }
    const result = usesCrlf ? contentLF.replace(/\n/g, '\r\n') : contentLF;
    return { replaced: true, content: result, occurrences: replaceAll ? wsCount : expectedReplacements, strategy: 'whitespace-tolerant' };
  }

  // --- Strategy 3: Token-based regex ---
  const tokenRegex = buildTokenRegex(normalizedOld);
  const tokenCount = countRegexMatches(normalizedContent, tokenRegex);
  if (target === undefined ? tokenCount > 0 : tokenCount === target) {
    let contentLF = normalizedContent;
    if (replaceAll) {
      contentLF = contentLF.replace(tokenRegex, () => normalizedNew);
    } else {
      let replaced = 0;
      contentLF = contentLF.replace(tokenRegex, (match) => {
        if (replaced < expectedReplacements) { replaced++; return normalizedNew; }
        return match;
      });
    }
    const result = usesCrlf ? contentLF.replace(/\n/g, '\r\n') : contentLF;
    return { replaced: true, content: result, occurrences: replaceAll ? tokenCount : expectedReplacements, strategy: 'token-based' };
  }

  // --- Strategy 4: Indentation-flexible line-by-line match ---
  const flexResult = tryIndentFlexibleReplace(
    originalContent, normalizedContent, normalizedOld, normalizedNew, replaceAll
  );
  if (flexResult) {
    return flexResult;
  }

  // All strategies failed — report what we found for diagnostics
  return {
    replaced: false,
    content: originalContent,
    occurrences: exactCount || wsCount || tokenCount || 0,
  };
}

// ============================================================================
// INDENTATION-FLEXIBLE FALLBACK
// ============================================================================

function getLeadingWhitespace(line: string): string {
  const match = line.match(/^(\s*)/);
  return match ? match[1] : '';
}

function stripLeadingWhitespace(text: string): string {
  return text.split('\n').map(l => l.trimStart()).join('\n');
}

function tryIndentFlexibleReplace(
  originalContent: string,
  normalizedContent: string,
  normalizedOld: string,
  normalizedNew: string,
  replaceAll: boolean,
): ReplaceResult | null {
  const strippedOld = stripLeadingWhitespace(normalizedOld);
  const strippedContent = stripLeadingWhitespace(normalizedContent);

  if (!strippedOld.includes('\n') || strippedOld.length < 20) {
    return null;
  }

  const strippedMatches = findAllIndices(strippedContent, strippedOld);

  if (strippedMatches.length === 0) { return null; }
  if (!replaceAll && strippedMatches.length > 1) { return null; }

  const strippedMatchStart = strippedMatches[0];
  const linesBefore = strippedContent.slice(0, strippedMatchStart).split('\n').length - 1;

  const contentLines = normalizedContent.split('\n');
  let normMatchStart = 0;
  for (let i = 0; i < linesBefore; i++) {
    normMatchStart += contentLines[i].length + 1;
  }

  const oldLines = normalizedOld.split('\n');
  const matchedFileLines = contentLines.slice(linesBefore, linesBefore + oldLines.length);

  for (let i = 0; i < oldLines.length; i++) {
    if (i >= matchedFileLines.length) { return null; }
    if (oldLines[i].trimStart() !== matchedFileLines[i].trimStart()) {
      return null;
    }
  }

  let indentOffset = '';
  for (let i = 0; i < oldLines.length; i++) {
    const oldIndent = getLeadingWhitespace(oldLines[i]);
    const fileIndent = getLeadingWhitespace(matchedFileLines[i]);
    if (oldLines[i].trim().length > 0 && matchedFileLines[i].trim().length > 0) {
      if (fileIndent.startsWith(oldIndent)) {
        indentOffset = fileIndent.slice(oldIndent.length);
      } else if (oldIndent.startsWith(fileIndent)) {
        indentOffset = '';
      }
      break;
    }
  }

  const newLines = normalizedNew.split('\n');
  const adjustedNewLines = newLines.map(line => {
    if (line.trim().length === 0) { return line; }
    return indentOffset + line;
  });
  const adjustedNew = adjustedNewLines.join('\n');

  const usesCrlf = originalContent.includes('\r\n');
  const finalNew = usesCrlf ? adjustedNew.replace(/\n/g, '\r\n') : adjustedNew;

  let normMatchEnd = normMatchStart;
  for (let i = 0; i < oldLines.length; i++) {
    normMatchEnd += matchedFileLines[i].length;
    if (i < oldLines.length - 1) { normMatchEnd += 1; }
  }

  const indexMap = buildIndexMap(originalContent);
  const origStart = indexMap[normMatchStart];
  const origEnd = indexMap[normMatchEnd];
  const result = originalContent.slice(0, origStart) + finalNew + originalContent.slice(origEnd);

  return { replaced: true, content: result, occurrences: 1, strategy: 'indent-flexible' };
}

// ============================================================================
// ERROR MESSAGE BUILDERS
// ============================================================================

function buildNoMatchError(
  filePath: string,
  normalizedContent: string,
  oldString: string,
  exactCount: number,
  wsCount: number,
  tokenCount: number,
  expectedReplacements: number,
): string {
  const normalizedOld = normalizeToLf(oldString);
  const anyMatches = exactCount > 0 || wsCount > 0 || tokenCount > 0;

  if (anyMatches) {
    if (exactCount > 0) {
      return (
        `old_string found ${exactCount} exact occurrence(s) but expected ${expectedReplacements}.\n\n` +
        `<error_details>\nOccurrence count mismatch in file: ${filePath}\n\n` +
        `Recovery suggestions:\n` +
        `1. Provide a more specific old_string so it matches exactly ${expectedReplacements} time(s)\n` +
        `2. If you intend to replace all occurrences, set replace_all=true\n` +
        `3. Use read_file to confirm the exact text and counts\n</error_details>`
      );
    }
    return (
      `old_string not found as exact match, but found ${wsCount} whitespace-tolerant and ${tokenCount} token-based match(es) ` +
      `(expected ${expectedReplacements}).\n\n` +
      `<error_details>\nThe whitespace or indentation in your old_string differs from the file.\n\n` +
      `Recovery suggestions:\n` +
      `1. Use read_file to get the exact current file contents\n` +
      `2. Copy old_string verbatim from the read_file output\n` +
      `3. Ensure indentation (tabs vs spaces) matches exactly\n</error_details>`
    );
  }

  // No matches at all — try to find anchor context
  const anchorContext = findFirstAnchorContext(normalizedContent, oldString);
  if (anchorContext) {
    return (
      `old_string was not found in the file.\n\n` +
      `<error_details>\nHowever, an anchor line from your old_string WAS found ("${anchorContext.anchor}").\n` +
      `Here is the current file content nearby (lines ${anchorContext.startLine}-${anchorContext.endLine}):\n` +
      `${anchorContext.snippet}\n\n` +
      `Recovery suggestions:\n` +
      `1. Re-run read_file for this region\n` +
      `2. Copy the exact old_string from the current file contents (do not guess)\n` +
      `3. The file may have changed since you last read it\n</error_details>`
    );
  }

  // Try partial prefix match for diagnostics
  const prefix30 = normalizedOld.slice(0, 30);
  const prefix30Idx = normalizedContent.indexOf(prefix30);
  if (prefix30Idx !== -1) {
    const fileSlice = normalizedContent.slice(prefix30Idx, prefix30Idx + normalizedOld.length + 20);
    let mismatchIdx = -1;
    for (let ci = 0; ci < normalizedOld.length && ci < fileSlice.length; ci++) {
      if (normalizedOld[ci] !== fileSlice[ci]) { mismatchIdx = ci; break; }
    }
    const mismatchLine = mismatchIdx !== -1
      ? indexToLineNumber(normalizedContent, prefix30Idx + mismatchIdx)
      : indexToLineNumber(normalizedContent, prefix30Idx);
    return (
      `old_string was not found in the file.\n\n` +
      `<error_details>\nThe first 30 characters of old_string were found near line ${mismatchLine}, ` +
      `but the full match failed${mismatchIdx !== -1 ? ` at character ${mismatchIdx}` : ''}.\n\n` +
      `Recovery suggestions:\n` +
      `1. Use read_file to get the current file contents around line ${mismatchLine}\n` +
      `2. Copy the exact text from the file — do not guess or reconstruct from memory\n` +
      `3. The file content may have changed since your last read\n</error_details>`
    );
  }

  return (
    `old_string was not found in the file.\n\n` +
    `<error_details>\nNo part of old_string could be located in the file. The content may have been hallucinated ` +
    `or the file may have changed significantly.\n\n` +
    `Recovery suggestions:\n` +
    `1. Call read_file on "${filePath}" to see the current contents\n` +
    `2. Copy the exact text to replace from the read_file output\n` +
    `3. Do NOT guess file contents — always read first, then edit\n</error_details>`
  );
}

export class EditTool implements ITool {
  name = 'edit';

  async prepareExecution(
    parameters: Record<string, unknown>
  ): Promise<ToolConfirmation | undefined> {
    const rawFilePath = parameters.file_path as string;
    const filePath = rawFilePath?.trim();
    // Coerce parameters to handle malformed calls (null, undefined, non-string)
    const oldString = typeof parameters.old_string === 'string' ? parameters.old_string : '';
    const newString = typeof parameters.new_string === 'string' ? parameters.new_string : '';
    const explanation = parameters.explanation as string | undefined;
    const replaceAll = (parameters.replace_all as boolean | undefined) ?? false;
    const expectedReplacements = Math.max(1, Number(parameters.expected_replacements) || 1);
    const startLine = parameters.start_line !== null && parameters.start_line !== undefined ? Math.max(1, Number(parameters.start_line) || 0) : undefined;
    const endLine = parameters.end_line !== null && parameters.end_line !== undefined ? Math.max(1, Number(parameters.end_line) || 0) : undefined;

    if (!filePath) {
      return undefined;
    }

    if (normalizeToLf(oldString).length === 0) {
      return undefined;
    }

    if (normalizeToLf(newString) === normalizeToLf(oldString)) {
      return undefined;
    }

    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
      return undefined;
    }

    const absolutePath = resolveAbsolutePath(filePath, workspaceRoot);

    try {
      const uri = vscode.Uri.file(absolutePath);
      const document = await vscode.workspace.openTextDocument(uri);
      const originalContent = document.getText();

      // Use line-range scoped replacement when both start_line and end_line are provided
      let replacement: ReplaceResult;
      if (startLine !== undefined && endLine !== undefined && !replaceAll) {
        replacement = replaceInLineRange(originalContent, oldString, newString, startLine, endLine);
      } else {
        replacement = replaceInOriginal(originalContent, oldString, newString, replaceAll, expectedReplacements);
      }

      if (!replacement.replaced) {
        return undefined;
      }

      return {
        toolName: this.name,
        title: `Edit: ${filePath}`,
        message: explanation ? `This will edit "${filePath}": ${explanation}` : `This will edit "${filePath}".`,
        diff: {
          oldContent: originalContent,
          newContent: replacement.content,
          fileName: filePath,
        },
        parameters,
      };
    } catch {
      return undefined;
    }
  }

  async execute(
    parameters: Record<string, unknown>,
    _onProgress?: unknown,
    _signal?: AbortSignal,
    _mode?: ChatMode
  ): Promise<ToolExecutionResult> {
    const rawFilePath = parameters.file_path as string;
    const filePath = rawFilePath?.trim();
    // Coerce parameters to handle malformed calls (null, undefined, non-string)
    const oldString = typeof parameters.old_string === 'string' ? parameters.old_string : '';
    const newString = typeof parameters.new_string === 'string' ? parameters.new_string : '';
    const explanation = parameters.explanation as string | undefined;
    const replaceAll = (parameters.replace_all as boolean | undefined) ?? false;
    const expectedReplacements = Math.max(1, Number(parameters.expected_replacements) || 1);
    const startLine = parameters.start_line !== null && parameters.start_line !== undefined ? Math.max(1, Number(parameters.start_line) || 0) : undefined;
    const endLine = parameters.end_line !== null && parameters.end_line !== undefined ? Math.max(1, Number(parameters.end_line) || 0) : undefined;
    const hasLineRange = startLine !== undefined && endLine !== undefined;

    if (!filePath) {
      return { success: false, error: 'file_path is required' };
    }

    const normalizedOld = normalizeToLf(oldString);
    const normalizedNew = normalizeToLf(newString);

    if (normalizedOld.length === 0) {
      return { success: false, error: 'old_string must be non-empty' };
    }

    if (normalizedNew === normalizedOld) {
      return {
        success: true,
        data: {
          message: `No edit needed — old_string and new_string are identical.`,
          path: filePath,
          action: 'no_change',
          reason: 'old_string_equals_new_string',
        },
      };
    }

    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
      return { success: false, error: 'No workspace folder open' };
    }

    const absolutePath = resolveAbsolutePath(filePath, workspaceRoot);

    let acquired = FileLockManager.tryAcquire(absolutePath);
    if (!acquired) {
      await FileLockManager.waitForLock(absolutePath);
      acquired = FileLockManager.tryAcquire(absolutePath);
    }

    if (!acquired) {
      return { success: false, error: `File is currently being modified: ${filePath}` };
    }

    try {
      const uri = vscode.Uri.file(absolutePath);

      let document: vscode.TextDocument;
      try {
        document = await vscode.workspace.openTextDocument(uri);
      } catch {
        return {
          success: false,
          error:
            `File does not exist or cannot be opened: ${absolutePath}\n\n` +
            `<error_details>\nRecovery suggestions:\n` +
            `1. Verify the file path is correct\n` +
            `2. Use list_files to confirm the correct path\n` +
            `3. If you intended to create a new file, use write_to_file instead\n</error_details>`,
        };
      }

      const originalContent = document.getText();

      // === PRE-EDIT DEBUG ===
      {
        const dbg = vscode.window.createOutputChannel('EchoDE Edit Debug', { log: true });
        const nOld = normalizeToLf(oldString);
        const nFile = normalizeToLf(originalContent);
        dbg.appendLine(`[EDIT ATTEMPT] file: ${filePath}${hasLineRange ? ` lines ${startLine}-${endLine}` : ''}`);
        dbg.appendLine(`[EDIT ATTEMPT] oldString len=${oldString.length} norm=${nOld.length} crlf=${oldString.includes('\r\n')} tab=${oldString.includes('\t')}`);
        dbg.appendLine(`[EDIT ATTEMPT] file len=${originalContent.length} norm=${nFile.length} crlf=${originalContent.includes('\r\n')} tab=${originalContent.includes('\t')}`);
        dbg.appendLine(`[EDIT ATTEMPT] old first 150: ${JSON.stringify(nOld.slice(0, 150))}`);
        dbg.appendLine(`[EDIT ATTEMPT] strategy: ${hasLineRange ? 'line-range-scoped' : 'exact → ws-tolerant → token → indent-flex'}`);
        const idxRes = nFile.indexOf(nOld);
        dbg.appendLine(`[EDIT ATTEMPT] normalized indexOf: ${idxRes}`);
        if (idxRes === -1) {
          const p30 = nOld.slice(0, 30);
          const p30i = nFile.indexOf(p30);
          dbg.appendLine(`[EDIT ATTEMPT] first30 indexOf: ${p30i}`);
          if (p30i !== -1) {
            const sl = nFile.slice(p30i, p30i + nOld.length + 10);
            for (let c = 0; c < Math.min(nOld.length, sl.length); c++) {
              if (nOld[c] !== sl[c]) {
                dbg.appendLine(`[EDIT ATTEMPT] DIVERGE@${c}: old=${JSON.stringify(nOld.slice(Math.max(0,c-10), c+30))} file=${JSON.stringify(sl.slice(Math.max(0,c-10), c+30))}`);
                dbg.appendLine(`[EDIT ATTEMPT] codes: old=${nOld.charCodeAt(c)} file=${sl.charCodeAt(c)}`);
                break;
              }
            }
          }
        }
        dbg.appendLine('---');
      }

      // ================================================================
      // LINE-RANGE SCOPED PATH: When start_line/end_line are provided,
      // use the narrowed search for higher accuracy. On failure, return
      // the actual file content at those lines so the AI can self-correct.
      // ================================================================
      if (hasLineRange && !replaceAll) {
        const rangeResult = replaceInLineRange(originalContent, oldString, newString, startLine!, endLine!);

        if (!rangeResult.replaced) {
          const failCount = recordFailure(absolutePath);
          const normalizedContent = normalizeToLf(originalContent);

          // Provide the actual content at the specified line range for immediate self-correction
          const actualSnippet = getNumberedSnippet(normalizedContent, startLine!, endLine!);
          const rangeLabel = `lines ${rangeResult.actualStartLine ?? startLine}-${rangeResult.actualEndLine ?? endLine}`;

          const errorMessage =
            `old_string not found in ${rangeLabel} of ${filePath}.\n\n` +
            `<error_details>\n` +
            `Your old_string does not match the actual file content at the specified line range.\n\n` +
            `ACTUAL CONTENT at ${rangeLabel}:\n${actualSnippet}\n\n` +
            `Recovery: Copy the exact text from the actual content above into old_string and retry.\n` +
            `</error_details>`;

          const escalation = failCount >= 2
            ? `\n\n[WARNING: ${failCount} consecutive edit failures on this file. The actual content at your specified lines is shown above. Copy it EXACTLY.]`
            : '';

          return {
            success: false,
            error: errorMessage + escalation,
          };
        }

        // Success — reset consecutive failure counter
        resetFailures(absolutePath);

        const newContent = rangeResult.content;
        const writeResult = await writeFileWithRetry(uri, newContent, 3, 75);
        if (!writeResult.success) {
          return {
            success: false,
            error: writeResult.error ?? 'Failed to write file with integrity verification',
          };
        }

        let finalNewContent = newContent;
        const autoFormat = await autoFormatIfLikelyMinified(uri, filePath, newContent);
        if (autoFormat.applied) {
          finalNewContent = autoFormat.content;
        }

        await openFileInBackground(uri);

        return {
          success: true,
          data: {
            message: `Successfully edited ${filePath} (lines ${startLine}-${endLine})`,
            explanation,
            path: filePath,
            absolutePath,
            action: finalNewContent === originalContent ? 'no_change' : 'modified',
            oldContent: originalContent,
            newContent: finalNewContent,
            occurrences: rangeResult.occurrences,
            strategy: rangeResult.strategy,
            replaceAll: false,
            lineRange: { start: startLine, end: endLine },
            attempts: writeResult.attempts,
          },
        };
      }

      // ================================================================
      // STANDARD PATH: Full-file 4-tier matching pipeline (no line range)
      // ================================================================
      const replacement = replaceInOriginal(originalContent, oldString, newString, replaceAll, expectedReplacements);

      if (!replacement.replaced) {
        // Track consecutive failures for this file
        const failCount = recordFailure(absolutePath);

        const normalizedContent = normalizeToLf(originalContent);
        const nOld = normalizeToLf(oldString);

        // Compute match counts for all strategies to give rich error feedback
        const exactCount = countOccurrences(normalizedContent, nOld);
        const wsRegex = buildWhitespaceTolerantRegex(nOld);
        const wsCount = countRegexMatches(normalizedContent, wsRegex);
        const tokenRegex = buildTokenRegex(nOld);
        const tokenCount = countRegexMatches(normalizedContent, tokenRegex);

        // === DEBUG: Log mismatch details to Output channel ===
        const debugChannel = vscode.window.createOutputChannel('EchoDE Edit Debug', { log: true });
        debugChannel.appendLine(`[EDIT FAIL] file: ${filePath} (consecutive failure #${failCount})`);
        debugChannel.appendLine(`[EDIT FAIL] exact=${exactCount} ws=${wsCount} token=${tokenCount} expected=${expectedReplacements}`);
        debugChannel.appendLine(`[EDIT FAIL] normalizedOld length: ${nOld.length}`);
        debugChannel.appendLine(`[EDIT FAIL] normalizedContent length: ${normalizedContent.length}`);
        debugChannel.appendLine(`[EDIT FAIL] originalContent has CRLF: ${originalContent.includes('\r\n')}`);
        debugChannel.appendLine(`[EDIT FAIL] oldString has CRLF: ${oldString.includes('\r\n')}`);
        debugChannel.appendLine('---');
        // === END DEBUG ===

        // Build rich error message using the new error builder
        const errorMessage = buildNoMatchError(
          filePath,
          normalizedContent,
          oldString,
          exactCount,
          wsCount,
          tokenCount,
          expectedReplacements,
        );

        // On 2+ consecutive failures, add escalation hint
        const escalation = failCount >= 2
          ? `\n\n[WARNING: ${failCount} consecutive edit failures on this file. STOP guessing. You MUST call read_file first to see the actual current contents, then copy the exact text.]`
          : '';

        return {
          success: false,
          error: errorMessage + escalation,
        };
      }

      // Success — reset consecutive failure counter
      resetFailures(absolutePath);

      const newContent = replacement.content;

      const writeResult = await writeFileWithRetry(uri, newContent, 3, 75);
      if (!writeResult.success) {
        return {
          success: false,
          error: writeResult.error ?? 'Failed to write file with integrity verification',
        };
      }

      let finalNewContent = newContent;
      const autoFormat = await autoFormatIfLikelyMinified(uri, filePath, newContent);
      if (autoFormat.applied) {
        finalNewContent = autoFormat.content;
      }

      // Open the edited file in the editor
      await openFileInBackground(uri);

      return {
        success: true,
        data: {
          message: `Successfully edited ${filePath}`,
          explanation,
          path: filePath,
          absolutePath,
          action: finalNewContent === originalContent ? 'no_change' : 'modified',
          oldContent: originalContent,
          newContent: finalNewContent,
          occurrences: replacement.occurrences,
          strategy: replacement.strategy,
          replaceAll,
          attempts: writeResult.attempts,
        },
      };
    } catch (error) {
      return { success: false, error: `Error editing file: ${error instanceof Error ? error.message : String(error)}` };
    } finally {
      FileLockManager.release(absolutePath);
    }
  }
}

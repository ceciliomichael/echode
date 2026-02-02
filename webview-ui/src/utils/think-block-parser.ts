/**
 * Utility for parsing <think> and <thinking> blocks from AI responses
 */

import { isInsideParameterValue } from '../lib/parser/tag-matcher';

export interface ParsedContent {
  thinkBlocks: Array<{ content: string; index: number }>;
  textContent: string;
}

const LEGACY_REQUEST_BOUNDARY_MARKER = '\u001E';
export const REQUEST_BOUNDARY_MARKER = '\u001F__ECHODE_REQUEST_BOUNDARY__\u001F';

const REQUEST_BOUNDARY_SENTINEL = '__ECHODE_REQUEST_BOUNDARY__';

function normalizeRequestBoundaryMarkers(content: string): string {
  return content
    .split(`\u001F${REQUEST_BOUNDARY_SENTINEL}\u001F`)
    .join(REQUEST_BOUNDARY_MARKER)
    .split(`\u241F${REQUEST_BOUNDARY_SENTINEL}\u241F`)
    .join(REQUEST_BOUNDARY_MARKER)
    .split(`\u001F${REQUEST_BOUNDARY_SENTINEL}`)
    .join(REQUEST_BOUNDARY_MARKER)
    .split(`${REQUEST_BOUNDARY_SENTINEL}\u001F`)
    .join(REQUEST_BOUNDARY_MARKER)
    .split(`\u241F${REQUEST_BOUNDARY_SENTINEL}`)
    .join(REQUEST_BOUNDARY_MARKER)
    .split(`${REQUEST_BOUNDARY_SENTINEL}\u241F`)
    .join(REQUEST_BOUNDARY_MARKER)
    .split(REQUEST_BOUNDARY_SENTINEL)
    .join(REQUEST_BOUNDARY_MARKER)
    .split(LEGACY_REQUEST_BOUNDARY_MARKER)
    .join(REQUEST_BOUNDARY_MARKER);
}

type LeadingThinkOpenTag = '<think>' | '<thinking>';

const THINK_OPEN = '<think>';
const THINKING_OPEN = '<thinking>';
const THINK_CLOSE = '</think>';
const THINKING_CLOSE = '</thinking>';

function findNextThinkOpenTag(content: string, fromIndex: number): {
  index: number;
  openTag: LeadingThinkOpenTag;
} | null {
  let i = Math.max(0, fromIndex);

  while (i < content.length) {
    const nextThink = content.indexOf(THINK_OPEN, i);
    const nextThinking = content.indexOf(THINKING_OPEN, i);

    if (nextThink === -1 && nextThinking === -1) {
      return null;
    }

    const index = nextThink !== -1 && (nextThinking === -1 || nextThink < nextThinking)
      ? nextThink
      : nextThinking;
    const openTag = index === nextThink ? THINK_OPEN : THINKING_OPEN;

    if (isInsideParameterValue(content, index) || (index > 0 && content[index - 1] === '`')) {
      i = index + openTag.length;
      continue;
    }

    return { index, openTag };
  }

  return null;
}

export function stripRequestBoundaryMarkers(content: string): string {
  return normalizeRequestBoundaryMarkers(content)
    .split(REQUEST_BOUNDARY_MARKER)
    .join('');
}

export function splitByRequestBoundary(content: string): string[] {
  return normalizeRequestBoundaryMarkers(content).split(REQUEST_BOUNDARY_MARKER);
}

export function isPotentialLeadingThinkPrefix(content: string): boolean {
  if (!content) {
    return false;
  }

  if (!content.startsWith('<')) {
    return false;
  }

  return THINK_OPEN.startsWith(content) || THINKING_OPEN.startsWith(content);
}

export function getLeadingThinkOpenTag(content: string): LeadingThinkOpenTag | null {
  if (content.startsWith(THINK_OPEN)) {
    return THINK_OPEN;
  }
  if (content.startsWith(THINKING_OPEN)) {
    return THINKING_OPEN;
  }
  return null;
}
 export function getLeadingThinkCloseTag(openTag: LeadingThinkOpenTag): string {
   return openTag === THINK_OPEN ? THINK_CLOSE : THINKING_CLOSE;
 }

 export function findLeadingThinkCloseIndex(content: string, openTag: LeadingThinkOpenTag): number {
   const closeTag = getLeadingThinkCloseTag(openTag);
   const start = openTag.length;
   return content.indexOf(closeTag, start);
 }

 export function stripLeadingThinkBlock(content: string): {
   strippedContent: string;
   hadLeadingThink: boolean;
 } {
   const openTag = getLeadingThinkOpenTag(content);
   if (!openTag) {
     return { strippedContent: content, hadLeadingThink: false };
   }

   const closeTag = getLeadingThinkCloseTag(openTag);
   const closeIndex = findLeadingThinkCloseIndex(content, openTag);
   if (closeIndex === -1) {
     return { strippedContent: '', hadLeadingThink: true };
   }

   return {
     strippedContent: content.slice(closeIndex + closeTag.length),
     hadLeadingThink: true,
   };
 }

 export function stripLeadingThinkBlocksByRequestBoundary(content: string): {
   strippedContent: string;
   hadAnyLeadingThink: boolean;
 } {
   const segments = splitByRequestBoundary(content);
   let hadAnyLeadingThink = false;

   const strippedSegments = segments.map((segment) => {
     const stripped = stripLeadingThinkBlock(segment);
     if (stripped.hadLeadingThink) {
       hadAnyLeadingThink = true;
     }
     return stripped.strippedContent;
   });

   return {
     strippedContent: strippedSegments.join(REQUEST_BOUNDARY_MARKER),
     hadAnyLeadingThink,
   };
 }

/**
 * Remove all <think> and <thinking> blocks from content
 * Used to exclude thinking content from chat history
 */
export function removeThinkBlocks(content: string): string {
  const parsed = parseThinkBlocks(content);
  return parsed.textContent.replace(/__THINK_BLOCK_\d+__/g, '');
}

/**
 * Parse content to extract <think> and <thinking> blocks (including unclosed ones during streaming)
 */
export function parseThinkBlocks(content: string): ParsedContent {
  const normalized = normalizeRequestBoundaryMarkers(content);
  const thinkBlocks: Array<{ content: string; index: number }> = [];
  let textContent = '';

  let i = 0;
  while (i < normalized.length) {
    const nextOpen = findNextThinkOpenTag(normalized, i);
    if (!nextOpen) {
      textContent += normalized.slice(i);
      break;
    }

    textContent += normalized.slice(i, nextOpen.index);

    const closeTag = getLeadingThinkCloseTag(nextOpen.openTag);
    const contentStart = nextOpen.index + nextOpen.openTag.length;
    const closeIndex = normalized.indexOf(closeTag, contentStart);
    const index = thinkBlocks.length;

    if (closeIndex === -1) {
      const thinkContent = normalized.slice(contentStart);
      thinkBlocks.push({ content: thinkContent, index });
      textContent += `__THINK_BLOCK_${index}__`;
      i = normalized.length;
      break;
    }

    const thinkContent = normalized.slice(contentStart, closeIndex);
    thinkBlocks.push({ content: thinkContent, index });
    textContent += `__THINK_BLOCK_${index}__`;
    i = closeIndex + closeTag.length;
  }

  return { thinkBlocks, textContent: stripRequestBoundaryMarkers(textContent) };
}

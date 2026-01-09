/**
 * Utility for parsing <think> and <thinking> blocks from AI responses
 */

export interface ParsedContent {
  thinkBlocks: Array<{ content: string; index: number }>;
  textContent: string;
}

 export const REQUEST_BOUNDARY_MARKER = '\u001E';

 type LeadingThinkOpenTag = '<think>' | '<thinking>';

 const THINK_OPEN = '<think>';
 const THINKING_OPEN = '<thinking>';
 const THINK_CLOSE = '</think>';
 const THINKING_CLOSE = '</thinking>';

 export function stripRequestBoundaryMarkers(content: string): string {
   return content.split(REQUEST_BOUNDARY_MARKER).join('');
 }

 export function splitByRequestBoundary(content: string): string[] {
   return content.split(REQUEST_BOUNDARY_MARKER);
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
  return stripRequestBoundaryMarkers(stripLeadingThinkBlocksByRequestBoundary(content).strippedContent);
}

/**
 * Parse content to extract <think> and <thinking> blocks (including unclosed ones during streaming)
 */
export function parseThinkBlocks(content: string): ParsedContent {
  const segments = splitByRequestBoundary(content);
  const thinkBlocks: Array<{ content: string; index: number }> = [];
  let textContent = '';

  for (const segment of segments) {
    const openTag = getLeadingThinkOpenTag(segment);
    if (!openTag) {
      textContent += segment;
      continue;
    }

    const closeTag = getLeadingThinkCloseTag(openTag);
    const closeIndex = findLeadingThinkCloseIndex(segment, openTag);
    const contentStart = openTag.length;

    if (closeIndex === -1) {
      const thinkContent = segment.slice(contentStart);
      const index = thinkBlocks.length;
      thinkBlocks.push({ content: thinkContent, index });
      textContent += `__THINK_BLOCK_${index}__`;
      continue;
    }

    const thinkContent = segment.slice(contentStart, closeIndex);
    const after = segment.slice(closeIndex + closeTag.length);
    const index = thinkBlocks.length;
    thinkBlocks.push({ content: thinkContent, index });
    textContent += `__THINK_BLOCK_${index}__${after}`;
  }

  return { thinkBlocks, textContent: stripRequestBoundaryMarkers(textContent) };
}

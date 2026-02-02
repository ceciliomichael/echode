import type { ContentToken } from './types';
import {
    findNextMermaidStart,
    findMermaidClose,
    findMatchingFunctionCallsClose,
    isInsideFunctionCallsParameterValue
} from './tag-utils';
import { extractAllInvokeBlocks, parseXMLParameters } from './xml-parser';
import { REQUEST_BOUNDARY_MARKER, splitByRequestBoundary } from '../think-block-parser';
import { TOOL_FUNCTION_CALLS_CLOSE, TOOL_FUNCTION_CALLS_OPEN, TOOL_XML_NAMESPACE } from '../../lib/tool-xml';
import {
    extractKimiToolCallsIncremental,
    extractKimiToolCallsSection,
    KIMI_TOOL_CALLS_SECTION_BEGIN_TAGS,
    KIMI_TOOL_CALLS_SECTION_END_TAGS,
    KIMI_TOOL_CALL_BEGIN,
    KIMI_TOOL_CALL_ARGUMENT_BEGIN,
} from '../../lib/kimi-parser';

function findNextTagIndex(content: string, fromIndex: number, tags: readonly string[]): number {
    let best = -1;
    for (const tag of tags) {
        const idx = content.indexOf(tag, fromIndex);
        if (idx !== -1 && (best === -1 || idx < best)) {
            best = idx;
        }
    }
    return best;
}

function hasAnyTagAt(content: string, index: number, tags: readonly string[]): boolean {
    return tags.some((t) => content.startsWith(t, index));
}

const KIMI_SECTION_BEGIN_REGEX = /<\|?tool_calls_section_begin\|?>/gi;

function findNextKimiSectionBeginIndex(content: string, fromIndex: number): number {
    KIMI_SECTION_BEGIN_REGEX.lastIndex = Math.max(0, fromIndex);
    const match = KIMI_SECTION_BEGIN_REGEX.exec(content);
    return match ? match.index : -1;
}

function hasKimiSectionBeginAt(content: string, index: number): boolean {
    const slice = content.slice(index, index + 64);
    return /^<\|?tool_calls_section_begin\|?>/i.test(slice);
}

 function stripLeakedThinkTagsInsideLeadingThinkSegment(segment: string): string {
     const startsWithThink = segment.startsWith('<think>');
     const startsWithThinking = segment.startsWith('<thinking>');
     if (!startsWithThink && !startsWithThinking) {
         return segment;
     }

     const openTag = startsWithThink ? '<think>' : '<thinking>';
     const closeTag = startsWithThink ? '</think>' : '</thinking>';

     // If the model emits duplicated open tags (e.g. "<thinking><thinking>..."),
     // ensure the content inside the outer wrapper doesn't start with a literal think tag.
     let rest = segment.slice(openTag.length);
     while (true) {
         const trimmed = rest.replace(/^\s+/, '');
         if (trimmed.startsWith('<think>')) {
             rest = trimmed.slice('<think>'.length);
             continue;
         }
         if (trimmed.startsWith('<thinking>')) {
             rest = trimmed.slice('<thinking>'.length);
             continue;
         }
         break;
     }
     let result = openTag + rest;

     // Collapse duplicated closing tags which can appear after repairs/streaming.
     // This also prevents stray close tags from being rendered as plain text.
     if (closeTag === '</think>') {
         result = result.replace(/(?:<\/think>\s*){2,}/gi, '</think>');
     } else {
         result = result.replace(/(?:<\/thinking>\s*){2,}/gi, '</thinking>');
     }

     return result;
 }

/**
 * Fix leaked <thought> tags that appear after closing </think> or </thinking> tags.
 * During streaming, the AI sometimes "leaks" content outside the thinking block with a <thought> tag.
 * 
 * IMPORTANT: We do NOT move thought content before the closing tag, as this would change
 * the hash of the original think block content, breaking duration tracking.
 * Instead, we just strip the <thought> wrapper tags. The tokenizer will handle the content
 * by finding it before the closing tag during re-parsing when the block is still open.
 * 
 * For closed blocks: </think><thought>content</thought> -> </think>content
 * For open blocks: <think>...<thought>content -> <think>...content (just strip wrapper)
 */
function fixLeakedThoughtTags(content: string): string {
    const segments = content.split(REQUEST_BOUNDARY_MARKER);

    const fixedSegments = segments.map((segment) => {
        // Only rewrite <thought> tags within segments that begin with a think block.
        // This preserves the "leading-only" constraint per request segment.
        const startsWithThink = segment.startsWith('<think>') || segment.startsWith('<thinking>');
        if (!startsWithThink) {
            return segment;
        }

        let result = stripLeakedThinkTagsInsideLeadingThinkSegment(segment);

        // For CLOSED blocks: move <thought> content back inside the block so it renders as thinking.
        // Pattern: </think><thought>content</thought> -> content</think>
        result = result.replace(
            /<\/think>\s*<thought>([\s\S]*?)(?:<\/thought>|$)/gi,
            (_, thoughtContent: string) => {
                return thoughtContent + '</think>';
            }
        );

        result = result.replace(
            /<\/thinking>\s*<thought>([\s\S]*?)(?:<\/thought>|$)/gi,
            (_, thoughtContent: string) => {
                return thoughtContent + '</thinking>';
            }
        );

        // Handle case where <thought> appears inside an unclosed think block (streaming)
        // Pattern: <think>content<thought>more content -> <think>contentmore content
        result = result.replace(
            /(<think>[\s\S]*?)<thought>([\s\S]*?)(?:<\/thought>|$)/gi,
            (match, thinkContent: string, thoughtContent: string) => {
                if (thinkContent.includes('</think>')) {
                    return match;
                }
                return thinkContent + thoughtContent;
            }
        );

        result = result.replace(
            /(<thinking>[\s\S]*?)<thought>([\s\S]*?)(?:<\/thought>|$)/gi,
            (match, thinkContent: string, thoughtContent: string) => {
                if (thinkContent.includes('</thinking>')) {
                    return match;
                }
                return thinkContent + thoughtContent;
            }
        );

        // Final cleanup: remove any leftover wrapper tags inside the thinking segment.
        result = result.replace(/<\/?thought>/gi, '');

        // Ensure leaked/duplicated think tags don't become visible inside the think block.
        result = stripLeakedThinkTagsInsideLeadingThinkSegment(result);

        return result;
    });

    return fixedSegments.join(REQUEST_BOUNDARY_MARKER);
}

/**
 * Merge consecutive think/thinking blocks into a single block.
 * The AI sometimes outputs multiple thinking blocks in a row, which should be displayed as one.
 * 
 * Patterns handled:
 * </think><think> -> merge into one
 * </think>\n<think> -> merge into one  
 * </thinking><thinking> -> merge into one
 * </think><thinking> -> merge into one (mixed tags)
 */
function mergeConsecutiveThinkBlocks(content: string): string {
    let result = content;

    // Merge </think> followed by <think> (with optional whitespace between)
    // Remove the closing and opening tags, keeping just the content
    result = result.replace(
        /<\/think>\s*<think>/gi,
        '\n\n' // Replace with double newline to separate content visually
    );

    // Merge </thinking> followed by <thinking>
    result = result.replace(
        /<\/thinking>\s*<thinking>/gi,
        '\n\n'
    );

    // Handle mixed: </think> followed by <thinking>
    result = result.replace(
        /<\/think>\s*<thinking>/gi,
        '\n\n'
    );

    // Handle mixed: </thinking> followed by <think>
    result = result.replace(
        /<\/thinking>\s*<think>/gi,
        '\n\n'
    );

    return result;
}

/**
 * Preprocess content to fix corrupted AI tool call formats
 * This ensures the tokenizer can properly recognize tool blocks
 * 
 * Common issues this handles:
 * 1. Alternate tag names (tool_call, tool_code, etc.)
 * 2. Special delimiters (<|tool|>)
 * 3. Anthropic-style tags (antml:function_calls, antml:invoke)
 * 4. Extra whitespace in tags
 * 5. Case variations
 */
function preprocessToolTags(content: string): string {
    let processed = content;

    // Fix whitespace issues in opening tags
    processed = processed.replace(/<\s*tool\s*:\s*function_calls\s*>/gi, TOOL_FUNCTION_CALLS_OPEN);
    processed = processed.replace(/<\s*\/\s*tool\s*:\s*function_calls\s*>/gi, TOOL_FUNCTION_CALLS_CLOSE);
    processed = processed.replace(/<\s*tool\s*:\s*invoke(\s+)/gi, `<${TOOL_XML_NAMESPACE}:invoke$1`);
    processed = processed.replace(/<\s*\/\s*tool\s*:\s*invoke\s*>/gi, `</${TOOL_XML_NAMESPACE}:invoke>`);
    processed = processed.replace(/<\s*tool\s*:\s*parameter(\s+)/gi, `<${TOOL_XML_NAMESPACE}:parameter$1`);
    processed = processed.replace(/<\s*\/\s*tool\s*:\s*parameter\s*>/gi, `</${TOOL_XML_NAMESPACE}:parameter>`);

    // Remove any CDATA wrappers that might have been added
    processed = processed.replace(/<!\[CDATA\[/g, '');
    processed = processed.replace(/\]\]>/g, '');

    return processed;
}

/**
 * Fallback detection: Check if content contains tool-like patterns that weren't parsed
 * This helps identify cases where the main parser might have missed something
 */
function hasPotentialUnparsedTools(content: string, parsedTokens: ContentToken[]): boolean {
    // Check if there are <${TOOL_XML_NAMESPACE}:invoke patterns in content that didn't become tool tokens
    const invokePattern = new RegExp(`<${TOOL_XML_NAMESPACE}:invoke\\s+name=["'][^"']+["']>`, 'gi');
    const matches = content.match(invokePattern);

    if (!matches) return false;

    // Count tool tokens in parsed result
    const toolTokenCount = parsedTokens.filter(t => t.type === 'tool').length;

    // If there are more invoke patterns than tool tokens, something might be missing
    return matches.length > toolTokenCount;
}


/**
 * Tokenize content into stable segments (think blocks, tool blocks, and text)
 * Process sequentially to avoid parsing content inside think blocks
 */
export function tokenizeContent(content: string, messageId: string = 'unknown'): ContentToken[] {
    const boundarySegments = splitByRequestBoundary(content);
    const normalizedContent = boundarySegments.join(REQUEST_BOUNDARY_MARKER);

    const hasLeadingThink = boundarySegments.some((segment) => segment.startsWith('<think>') || segment.startsWith('<thinking>'));

    // Only run think-specific repairs when the response starts with a think block.
    // If think tags occur later in the response, they must remain literal text.
    const maybeFixedThoughtContent = hasLeadingThink ? fixLeakedThoughtTags(normalizedContent) : normalizedContent;
    const maybeMergedThinkContent = hasLeadingThink ? mergeConsecutiveThinkBlocks(maybeFixedThoughtContent) : maybeFixedThoughtContent;

    // Preprocess to fix corrupted tool call formats
    const processedContent = preprocessToolTags(maybeMergedThinkContent);

    const tokens: ContentToken[] = [];
    let position = 0;
    let tokenIndex = 0;
    let toolIndex = 0;

    while (position < processedContent.length) {
        // Check for think/thinking blocks, tool blocks, and mermaid blocks
        // Use validators that skip tags inside parameter values (e.g., in edit/write_to_file content)
        const hasBoundaryAtPosition = processedContent.startsWith(REQUEST_BOUNDARY_MARKER, position);
        if (hasBoundaryAtPosition) {
            position += REQUEST_BOUNDARY_MARKER.length;
            continue;
        }

        const findNextThinkStart = (from: number): { pos: number; type: 'think' | 'thinking' } | null => {
            let searchPos = from;
            while (searchPos < processedContent.length) {
                const nextThink = processedContent.indexOf('<think>', searchPos);
                const nextThinking = processedContent.indexOf('<thinking>', searchPos);

                if (nextThink === -1 && nextThinking === -1) {
                    return null;
                }

                const pos = nextThink !== -1 && (nextThinking === -1 || nextThink < nextThinking)
                    ? nextThink
                    : nextThinking;
                const type = pos === nextThink ? 'think' : 'thinking';

                if (isInsideFunctionCallsParameterValue(processedContent, pos) || (pos > 0 && processedContent[pos - 1] === '`')) {
                    searchPos = pos + 1;
                    continue;
                }

                return { pos, type };
            }
            return null;
        };

        const nextThink = findNextThinkStart(position);
        const thinkStart = nextThink?.type === 'think' ? nextThink.pos : -1;
        const thinkingStart = nextThink?.type === 'thinking' ? nextThink.pos : -1;

        const findNextToolLikeStart = (from: number): { pos: number; kind: 'xml' | 'kimi' } | null => {
            let searchPos = Math.max(0, from);
            while (searchPos < processedContent.length) {
                const xmlPos = processedContent.indexOf(TOOL_FUNCTION_CALLS_OPEN, searchPos);
                const kimiPosCandidate = findNextTagIndex(processedContent, searchPos, KIMI_TOOL_CALLS_SECTION_BEGIN_TAGS);
                const kimiPos = kimiPosCandidate !== -1 ? kimiPosCandidate : findNextKimiSectionBeginIndex(processedContent, searchPos);

                if (xmlPos === -1 && kimiPos === -1) {
                    return null;
                }

                const pos = xmlPos !== -1 && (kimiPos === -1 || xmlPos < kimiPos) ? xmlPos : kimiPos;
                const kind: 'xml' | 'kimi' = pos === xmlPos ? 'xml' : 'kimi';

                // Skip tools inside function_calls parameter values or inline code contexts
                if (isInsideFunctionCallsParameterValue(processedContent, pos) || (pos > 0 && processedContent[pos - 1] === '`')) {
                    searchPos = pos + 1;
                    continue;
                }

                return { pos, kind };
            }
            return null;
        };

        const nextToolLike = findNextToolLikeStart(position);
        const toolStart = nextToolLike?.pos ?? -1;
        const mermaidStart = findNextMermaidStart(processedContent, position);

        // Determine which comes first
        let nextBlockStart = -1;
        let blockType: 'think' | 'thinking' | 'tool' | 'mermaid' | null = null;

        // Find the earliest block
        const candidates = [
            { pos: thinkStart, type: 'think' as const },
            { pos: thinkingStart, type: 'thinking' as const },
            { pos: toolStart, type: 'tool' as const },
            { pos: mermaidStart, type: 'mermaid' as const }
        ].filter(c => c.pos !== -1);

        if (candidates.length > 0) {
            const earliest = candidates.reduce((min, curr) => curr.pos < min.pos ? curr : min);
            nextBlockStart = earliest.pos;
            blockType = earliest.type;
        }

        // Add text before next block
        if (nextBlockStart !== -1 && nextBlockStart > position) {
            const textContent = processedContent.slice(position, nextBlockStart).split(REQUEST_BOUNDARY_MARKER).join('');

            if (textContent) {
                tokens.push({
                    type: 'text',
                    content: textContent,
                    index: tokenIndex++
                });
            }
            position = nextBlockStart;
        }

        // Process think block
        if (blockType === 'think') {
            const contentStart = thinkStart + 7; // length of '<think>'
            const closeTag = processedContent.indexOf('</think>', contentStart);

            // If a tool block starts before the think block closes, force-close the think token
            // at the tool start so tool rendering/execution is clearly separated.
            const findToolStartInsideThink = (from: number, limit: number): number => {
                let searchPos = from;
                while (searchPos < limit) {
                    const xmlPos = processedContent.indexOf(TOOL_FUNCTION_CALLS_OPEN, searchPos);
                    const kimiPosCandidate = findNextTagIndex(processedContent, searchPos, KIMI_TOOL_CALLS_SECTION_BEGIN_TAGS);
                    const kimiPos = kimiPosCandidate !== -1 ? kimiPosCandidate : findNextKimiSectionBeginIndex(processedContent, searchPos);

                    if (xmlPos === -1 && kimiPos === -1) {
                        return -1;
                    }

                    const pos = xmlPos !== -1 && (kimiPos === -1 || xmlPos < kimiPos) ? xmlPos : kimiPos;
                    if (pos === -1 || pos >= limit) {
                        return -1;
                    }

                    if (isInsideFunctionCallsParameterValue(processedContent, pos) || (pos > 0 && processedContent[pos - 1] === '`')) {
                        searchPos = pos + 1;
                        continue;
                    }

                    return pos;
                }
                return -1;
            };

            const thinkEnd = closeTag === -1 ? processedContent.length : closeTag;
            const toolStartInsideThink = findToolStartInsideThink(contentStart, thinkEnd);
            if (toolStartInsideThink !== -1) {
                const thinkContent = processedContent.slice(contentStart, toolStartInsideThink).split(REQUEST_BOUNDARY_MARKER).join('');
                tokens.push({
                    type: 'think',
                    content: thinkContent,
                    index: tokenIndex++,
                    isClosed: true
                });
                position = toolStartInsideThink;
                continue;
            }

            if (closeTag !== -1) {
                // Closed think block
                const thinkContent = processedContent.slice(contentStart, closeTag).split(REQUEST_BOUNDARY_MARKER).join('');
                tokens.push({
                    type: 'think',
                    content: thinkContent,
                    index: tokenIndex++,
                    isClosed: true
                });
                position = closeTag + 8; // Skip past '</think>'
            } else {
                // Unclosed think block (streaming)
                const thinkContent = processedContent.slice(contentStart).split(REQUEST_BOUNDARY_MARKER).join('');
                tokens.push({
                    type: 'think',
                    content: thinkContent,
                    index: tokenIndex++,
                    isClosed: false
                });
                position = processedContent.length;
                break;
            }
        }
        // Process thinking block
        else if (blockType === 'thinking') {
            const contentStart = thinkingStart + 10; // length of '<thinking>'
            const closeTag = processedContent.indexOf('</thinking>', contentStart);

            // If a tool block starts before the thinking block closes, force-close the think token
            // at the tool start so tool rendering/execution is clearly separated.
            const findToolStartInsideThink = (from: number, limit: number): number => {
                let searchPos = from;
                while (searchPos < limit) {
                    const xmlPos = processedContent.indexOf(TOOL_FUNCTION_CALLS_OPEN, searchPos);
                    const kimiPosCandidate = findNextTagIndex(processedContent, searchPos, KIMI_TOOL_CALLS_SECTION_BEGIN_TAGS);
                    const kimiPos = kimiPosCandidate !== -1 ? kimiPosCandidate : findNextKimiSectionBeginIndex(processedContent, searchPos);

                    if (xmlPos === -1 && kimiPos === -1) {
                        return -1;
                    }

                    const pos = xmlPos !== -1 && (kimiPos === -1 || xmlPos < kimiPos) ? xmlPos : kimiPos;
                    if (pos === -1 || pos >= limit) {
                        return -1;
                    }

                    if (isInsideFunctionCallsParameterValue(processedContent, pos) || (pos > 0 && processedContent[pos - 1] === '`')) {
                        searchPos = pos + 1;
                        continue;
                    }

                    return pos;
                }
                return -1;
            };

            const thinkEnd = closeTag === -1 ? processedContent.length : closeTag;
            const toolStartInsideThink = findToolStartInsideThink(contentStart, thinkEnd);
            if (toolStartInsideThink !== -1) {
                const thinkContent = processedContent.slice(contentStart, toolStartInsideThink).split(REQUEST_BOUNDARY_MARKER).join('');
                tokens.push({
                    type: 'think',
                    content: thinkContent,
                    index: tokenIndex++,
                    isClosed: true
                });
                position = toolStartInsideThink;
                continue;
            }

            if (closeTag !== -1) {
                // Closed thinking block
                const thinkContent = processedContent.slice(contentStart, closeTag).split(REQUEST_BOUNDARY_MARKER).join('');
                tokens.push({
                    type: 'think',
                    content: thinkContent,
                    index: tokenIndex++,
                    isClosed: true
                });
                position = closeTag + 11; // Skip past '</thinking>'
            } else {
                // Unclosed thinking block (streaming)
                const thinkContent = processedContent.slice(contentStart).split(REQUEST_BOUNDARY_MARKER).join('');
                tokens.push({
                    type: 'think',
                    content: thinkContent,
                    index: tokenIndex++,
                    isClosed: false
                });
                position = processedContent.length;
                break;
            }
        }

        // Process tool block
        else if (blockType === 'tool') {
            // Kimi tool-call section format
            if (hasAnyTagAt(processedContent, toolStart, KIMI_TOOL_CALLS_SECTION_BEGIN_TAGS) || hasKimiSectionBeginAt(processedContent, toolStart)) {
                const section = extractKimiToolCallsSection(processedContent, toolStart);
                if (!section) {
                    position = processedContent.length;
                    break;
                }

                const sectionText = processedContent.slice(toolStart, section.sectionEnd);
                const incremental = extractKimiToolCallsIncremental(sectionText);

                for (const b of incremental.blocks) {
                    const execId = `${messageId}-tool-${toolIndex++}`;
                    tokens.push({
                        type: 'tool',
                        toolName: b.toolName,
                        parameters: b.parameters,
                        rawContent: b.rawContent,
                        index: tokenIndex++,
                        isClosed: true,
                        toolExecutionId: execId,
                    });
                }

                // If streaming: show the next tool call as pending (if present)
                if (!section.hasSectionEnd && incremental.pendingBlocks.length > 0) {
                    const pending = incremental.pendingBlocks[0];
                    const execId = `${messageId}-tool-${toolIndex++}`;
                    const pendingRaw = `${KIMI_TOOL_CALL_BEGIN} ${pending.toolName}${pending.callIndex !== undefined ? `:${pending.callIndex}` : ''} ${KIMI_TOOL_CALL_ARGUMENT_BEGIN}`;
                    tokens.push({
                        type: 'tool',
                        toolName: pending.toolName,
                        parameters: pending.parameters,
                        rawContent: pendingRaw,
                        index: tokenIndex++,
                        isClosed: false,
                        toolExecutionId: execId,
                    });
                    position = processedContent.length;
                    break;
                }

                position = section.sectionEnd;
                // Skip stray section end marker if it appears as plain text later
                if (hasAnyTagAt(processedContent, position, KIMI_TOOL_CALLS_SECTION_END_TAGS)) {
                    const endTagLen = KIMI_TOOL_CALLS_SECTION_END_TAGS.find((t) => processedContent.startsWith(t, position))?.length ?? 0;
                    position += endTagLen;
                }
                continue;
            }

            const openingTag = TOOL_FUNCTION_CALLS_OPEN;
            const closingTag = TOOL_FUNCTION_CALLS_CLOSE;

            const contentStart = toolStart + openingTag.length;
            // Use balanced matching to find the correct closing tag
            const closeMarker = findMatchingFunctionCallsClose(processedContent, contentStart);

            if (closeMarker !== -1) {
                // Closed tool block - extract ALL invoke blocks from this function_calls
                const innerContent = processedContent.slice(contentStart, closeMarker);
                const closingTagLength = closingTag.length;
                const rawContent = processedContent.slice(toolStart, closeMarker + closingTagLength);

                try {
                    // Extract ALL invoke blocks using balanced matching
                    const invokeBlocks = extractAllInvokeBlocks(innerContent);

                    if (invokeBlocks.length > 0) {
                        // Create a token for each invoke block
                        for (const invokeBlock of invokeBlocks) {
                            const { toolName, innerContent: invokeContent, fullMatch, isClosed } = invokeBlock;
                            const parameters = parseXMLParameters(invokeContent);

                            // Allow all tool names - validation happens at execution time
                            if (toolName && typeof toolName === 'string') {
                                const execId = `${messageId}-tool-${toolIndex++}`;
                                tokens.push({
                                    type: 'tool',
                                    toolName,
                                    parameters,
                                    rawContent: `${TOOL_FUNCTION_CALLS_OPEN}${fullMatch}${TOOL_FUNCTION_CALLS_CLOSE}`,
                                    index: tokenIndex++,
                                    isClosed,
                                    toolExecutionId: execId
                                });
                            }
                        }
                    } else {
                        // Fallback for cases where </${TOOL_XML_NAMESPACE}:function_calls> is present but </${TOOL_XML_NAMESPACE}:invoke> has not streamed yet
                        const partialInvokeMatch = innerContent.match(new RegExp(`<${TOOL_XML_NAMESPACE}:invoke\\s+name=["']([^"']+)["']>`));
                        if (partialInvokeMatch) {
                            const toolName = partialInvokeMatch[1];
                            const invokeContentStart = partialInvokeMatch.index! + partialInvokeMatch[0].length;
                            const partialInvokeContent = innerContent.slice(invokeContentStart);
                            const parameters = parseXMLParameters(partialInvokeContent);

                            if (toolName && typeof toolName === 'string') {
                                tokens.push({
                                    type: 'tool',
                                    toolName,
                                    parameters,
                                    rawContent,
                                    index: tokenIndex++,
                                    // Mark as not fully closed so streaming-aware UI (e.g. planning tools) can special-case it
                                    isClosed: false,
                                    toolExecutionId: `${messageId}-tool-${toolIndex++}`
                                });
                            }
                        }
                    }
                    position = closeMarker + closingTagLength;
                } catch {
                    // XML parsing failed but block is closed. Skip this block.
                    position = closeMarker + closingTagLength;
                }
            } else {
                // Unclosed tool block (streaming) - extract all complete invoke blocks + partial last one
                const innerContent = processedContent.slice(contentStart);
                const rawContent = processedContent.slice(toolStart);

                try {
                    // Extract all invoke blocks (complete ones + partial last one)
                    const invokeBlocks = extractAllInvokeBlocks(innerContent);

                    if (invokeBlocks.length > 0) {
                        // Create tokens for all invoke blocks found
                        for (const invokeBlock of invokeBlocks) {
                            const { toolName, innerContent: invokeContent, fullMatch, isClosed } = invokeBlock;
                            const parameters = parseXMLParameters(invokeContent);

                            if (toolName && typeof toolName === 'string') {
                                tokens.push({
                                    type: 'tool',
                                    toolName,
                                    parameters,
                                    rawContent: isClosed ? `${TOOL_FUNCTION_CALLS_OPEN}${fullMatch}${TOOL_FUNCTION_CALLS_CLOSE}` : rawContent,
                                    index: tokenIndex++,
                                    isClosed,
                                    toolExecutionId: `${messageId}-tool-${toolIndex++}`
                                });
                            }
                        }
                    } else {
                        // Try to extract partial invoke opening tag for streaming
                        const partialInvokeMatch = innerContent.match(new RegExp(`<${TOOL_XML_NAMESPACE}:invoke\\s+name=["']([^"']+)["']>`));
                        if (partialInvokeMatch) {
                            const toolName = partialInvokeMatch[1];
                            const invokeContentStart = partialInvokeMatch.index! + partialInvokeMatch[0].length;
                            const partialInvokeContent = innerContent.slice(invokeContentStart);
                            const parameters = parseXMLParameters(partialInvokeContent);

                            if (toolName && typeof toolName === 'string') {
                                tokens.push({
                                    type: 'tool',
                                    toolName,
                                    parameters,
                                    rawContent,
                                    index: tokenIndex++,
                                    isClosed: false,
                                    toolExecutionId: `${messageId}-tool-${toolIndex++}`
                                });
                            }
                        }
                    }
                } catch {
                    // XML parsing failed during streaming. Skip this block.
                }
                position = processedContent.length;
                break;
            }
        }
        // Process mermaid block
        else if (blockType === 'mermaid') {
            const contentStart = mermaidStart + 10; // length of '```mermaid'
            const closeTag = findMermaidClose(processedContent, contentStart);

            if (closeTag !== -1) {
                // Closed mermaid block
                const mermaidContent = processedContent.slice(contentStart, closeTag).trim();
                tokens.push({
                    type: 'mermaid',
                    content: mermaidContent,
                    index: tokenIndex++,
                    isClosed: true
                });
                position = closeTag + 3; // Skip past '```'
                // Skip trailing newline after closing ``` if present
                if (position < processedContent.length && processedContent[position] === '\n') {
                    position++;
                }
            } else {
                // Unclosed mermaid block (streaming)
                const mermaidContent = processedContent.slice(contentStart).trim();
                tokens.push({
                    type: 'mermaid',
                    content: mermaidContent,
                    index: tokenIndex++,
                    isClosed: false
                });
                position = processedContent.length;
                break;
            }
        }
        // No more blocks
        else {
            // If we encounter stray closing think tags (because we force-closed earlier), drop them.
            if (processedContent.startsWith('</think>', position)) {
                position += 8;
                continue;
            }
            if (processedContent.startsWith('</thinking>', position)) {
                position += 11;
                continue;
            }

            let remainingText = processedContent.slice(position);
            remainingText = remainingText.split(REQUEST_BOUNDARY_MARKER).join('');

            // Hide incomplete function_calls tag markers during streaming (e.g., "<", "<f", "<func", "<function_", etc.)
            // This prevents flashing when AI is still typing the opening tag
            // Check if remaining text ends with partial function_calls tag
            let hasIncompleteTag = false;
            const functionCallsTag = `${TOOL_XML_NAMESPACE}:function_calls`;

            if (remainingText.endsWith('<')) {
                hasIncompleteTag = true;
            } else {
                // Check for partial <${TOOL_XML_NAMESPACE}:function_calls>
                for (let i = 1; i <= functionCallsTag.length; i++) {
                    const partial = `<${functionCallsTag.slice(0, i)}`;
                    if (remainingText.endsWith(partial)) {
                        hasIncompleteTag = true;
                        break;
                    }
                }
            }

            if (hasIncompleteTag) {
                // Find where the incomplete tag starts
                let cutPos = remainingText.length - 1;
                while (cutPos >= 0 && remainingText[cutPos] !== '<') {
                    cutPos--;
                }
                if (cutPos >= 0) {
                    remainingText = remainingText.slice(0, cutPos);
                }
            }

            if (remainingText) {
                tokens.push({
                    type: 'text',
                    content: remainingText,
                    index: tokenIndex++
                });
            }
            position = processedContent.length;
        }
    }

    // Fallback check: if we might have missed tools, log a warning for debugging
    // This helps identify edge cases that need to be handled
    if (hasPotentialUnparsedTools(processedContent, tokens)) {
        console.warn(
            '[tokenizer] Potential unparsed tool blocks detected. Content may need preprocessing adjustment.',
            {
                messageId,
                contentPreview: processedContent.slice(0, 200),
                tokenCount: tokens.length,
                toolTokenCount: tokens.filter(t => t.type === 'tool').length
            }
        );
    }

    return tokens;
}

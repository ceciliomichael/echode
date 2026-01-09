import type { ContentToken } from './types';
import {
    findNextToolStart,
    findNextMermaidStart,
    findMermaidClose,
    findMatchingFunctionCallsClose
} from './tag-utils';
import { extractAllInvokeBlocks, parseXMLParameters } from './xml-parser';
import { REQUEST_BOUNDARY_MARKER } from '../think-block-parser';

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

        let result = segment;

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

    // Fix corrupted hybrid formats
    // <tool_call>function_calls> -> <function_calls>
    processed = processed.replace(/<tool_call>function_calls>/gi, '<function_calls>');
    // <tool_call> -> <function_calls>
    processed = processed.replace(/<tool_call>/gi, '<function_calls>');
    // </tool_call> -> </function_calls>
    processed = processed.replace(/<\/tool_call>/gi, '</function_calls>');
    // <tool_code> -> <function_calls>
    processed = processed.replace(/<tool_code>/gi, '<function_calls>');
    // </tool_code> -> </function_calls>
    processed = processed.replace(/<\/tool_code>/gi, '</function_calls>');
    // <|tool|> variants
    processed = processed.replace(/<\|tool\|>/gi, '<function_calls>');
    processed = processed.replace(/<\|tool_call\|>/gi, '<function_calls>');
    processed = processed.replace(/<\|\/tool\|>/gi, '</function_calls>');
    processed = processed.replace(/<\|\/tool_call\|>/gi, '</function_calls>');

    // Handle Anthropic-style namespaced tags (antml:function_calls, antml:invoke)
    processed = processed.replace(/<function_calls>/gi, '<function_calls>');
    processed = processed.replace(/<\/antml:function_calls>/gi, '</function_calls>');
    processed = processed.replace(/<invoke(\s+)/gi, '<invoke$1');
    processed = processed.replace(/<\/antml:invoke>/gi, '</invoke>');
    processed = processed.replace(/<parameter(\s+)/gi, '<parameter$1');
    processed = processed.replace(/<\/antml:parameter>/gi, '</parameter>');

    // Fix whitespace issues in opening tags
    // < function_calls > -> <function_calls>
    processed = processed.replace(/<\s*function_calls\s*>/gi, '<function_calls>');
    processed = processed.replace(/<\s*\/\s*function_calls\s*>/gi, '</function_calls>');

    // Handle cases where function_calls is accidentally split/mangled
    // <function calls> (with space)
    processed = processed.replace(/<function\s+calls>/gi, '<function_calls>');
    processed = processed.replace(/<\/function\s+calls>/gi, '</function_calls>');

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
    // Check if there are <invoke patterns in content that didn't become tool tokens
    const invokePattern = /<invoke\s+name=["'][^"']+["']>/gi;
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
    const segments = content.split(REQUEST_BOUNDARY_MARKER);
    const hasLeadingThink = segments.some((segment) => segment.startsWith('<think>') || segment.startsWith('<thinking>'));

    // Only run think-specific repairs when the response starts with a think block.
    // If think tags occur later in the response, they must remain literal text.
    const maybeFixedThoughtContent = hasLeadingThink ? fixLeakedThoughtTags(content) : content;
    const maybeMergedThinkContent = hasLeadingThink ? mergeConsecutiveThinkBlocks(maybeFixedThoughtContent) : maybeFixedThoughtContent;

    // Preprocess to fix corrupted tool call formats
    const processedContent = preprocessToolTags(maybeMergedThinkContent);

    const tokens: ContentToken[] = [];
    let position = 0;
    let tokenIndex = 0;
    let toolIndex = 0;

    while (position < processedContent.length) {
        // Check for think/thinking blocks, tool blocks, and mermaid blocks
        // Use validators that skip tags inside parameter values (e.g., in apply_diff/write_to_file content)
        const hasBoundaryAtPosition = processedContent.startsWith(REQUEST_BOUNDARY_MARKER, position);
        if (hasBoundaryAtPosition) {
            position += REQUEST_BOUNDARY_MARKER.length;
            continue;
        }

        const segmentStart = position;
        const currentSegment = processedContent.slice(segmentStart);
        const segmentHasLeadingThink = currentSegment.startsWith('<think>') || currentSegment.startsWith('<thinking>');

        const thinkStart = segmentHasLeadingThink && currentSegment.startsWith('<think>') ? segmentStart : -1;
        const thinkingStart = segmentHasLeadingThink && currentSegment.startsWith('<thinking>') ? segmentStart : -1;
        const toolStart = findNextToolStart(processedContent, position);
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
            const openingTag = '<function_calls>';
            const closingTag = '</function_calls>';

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
                                    rawContent: `<function_calls>${fullMatch}</function_calls>`, // Wrap individual invoke in function_calls for consistency
                                    index: tokenIndex++,
                                    isClosed,
                                    toolExecutionId: execId
                                });
                            }
                        }
                    } else {
                        // Fallback for cases where </function_calls> is present but </invoke> has not streamed yet
                        const partialInvokeMatch = innerContent.match(/<invoke\s+name=["']([^"']+)["']>/);
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
                                    rawContent: isClosed ? `<function_calls>${fullMatch}</function_calls>` : rawContent,
                                    index: tokenIndex++,
                                    isClosed,
                                    toolExecutionId: `${messageId}-tool-${toolIndex++}`
                                });
                            }
                        }
                    } else {
                        // Try to extract partial invoke opening tag for streaming
                        const partialInvokeMatch = innerContent.match(/<invoke\s+name=["']([^"']+)["']>/);
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
            let remainingText = processedContent.slice(position);

            // Hide incomplete function_calls tag markers during streaming (e.g., "<", "<f", "<func", "<function_", etc.)
            // This prevents flashing when AI is still typing the opening tag
            // Check if remaining text ends with partial function_calls tag
            let hasIncompleteTag = false;
            const functionCallsTag = 'function_calls';

            if (remainingText.endsWith('<')) {
                hasIncompleteTag = true;
            } else {
                // Check for partial <function_calls>
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

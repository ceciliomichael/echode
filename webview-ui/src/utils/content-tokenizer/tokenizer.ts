import type { ContentToken } from './types';
import {
    findNextToolStart,
    findNextMermaidStart,
    findMermaidClose,
    findMatchingFunctionCallsClose,
    isInsideFunctionCallsParameterValue
} from './tag-utils';
import { extractAllInvokeBlocks, parseXMLParameters } from './xml-parser';

/**
 * Fix leaked <thought> tags that appear after closing </think> or </thinking> tags.
 * During streaming, the AI sometimes "leaks" content outside the thinking block with a <thought> tag.
 * This function detects such cases and moves the content back inside the previous think block.
 * 
 * Pattern detected:
 * </think><thought>leaked content    -> </think>leaked content (thought tag removed, content stays in think)
 * </thinking><thought>leaked content -> </thinking>leaked content (thought tag removed, content stays in think)
 */
function fixLeakedThoughtTags(content: string): string {
    let result = content;

    // Pattern: </think> followed by optional whitespace then <thought>
    // We need to move the <thought> content back BEFORE the </think>
    // Use non-capturing group for the end tag since we don't need it
    result = result.replace(
        /(<\/think>)\s*<thought>([\s\S]*?)(?:<\/thought>|$)/gi,
        (_, closeTag: string, thoughtContent: string) => {
            // Move the thought content before the closing tag
            return thoughtContent + closeTag;
        }
    );

    // Same for </thinking>
    result = result.replace(
        /(<\/thinking>)\s*<thought>([\s\S]*?)(?:<\/thought>|$)/gi,
        (_, closeTag: string, thoughtContent: string) => {
            return thoughtContent + closeTag;
        }
    );

    // Handle case where <thought> appears right after an unclosed <think> block
    // Pattern: <think>content<thought>more content (streaming case)
    // This happens when AI starts thinking, then adds <thought> mid-stream
    result = result.replace(
        /(<think>[\s\S]*?)<thought>([\s\S]*?)(?:<\/thought>|$)/gi,
        (match, thinkContent: string, thoughtContent: string) => {
            // Don't match if there's already a </think> in between
            if (thinkContent.includes('</think>')) {
                return match;
            }
            return thinkContent + thoughtContent;
        }
    );

    result = result.replace(
        /(<thinking>[\s\S]*?)<thought>([\s\S]*?)(?:<\/thought>|$)/gi,
        (match, thinkContent: string, thoughtContent: string) => {
            // Don't match if there's already a </thinking> in between
            if (thinkContent.includes('</thinking>')) {
                return match;
            }
            return thinkContent + thoughtContent;
        }
    );

    return result;
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
 * Find the next <think> tag that is NOT inside a parameter value.
 * This prevents incorrectly treating think tags in file content as thinking blocks.
 */
function findNextValidThinkStart(content: string, fromPosition: number): number {
    const tag = '<think>';
    let pos = fromPosition;

    while (pos < content.length) {
        const found = content.indexOf(tag, pos);
        if (found === -1) return -1;

        // Check if this position is inside a parameter value
        if (!isInsideFunctionCallsParameterValue(content, found)) {
            return found;
        }

        // Skip this occurrence and look for the next one
        pos = found + tag.length;
    }

    return -1;
}

/**
 * Find the next <thinking> tag that is NOT inside a parameter value.
 * This prevents incorrectly treating thinking tags in file content as thinking blocks.
 */
function findNextValidThinkingStart(content: string, fromPosition: number): number {
    const tag = '<thinking>';
    let pos = fromPosition;

    while (pos < content.length) {
        const found = content.indexOf(tag, pos);
        if (found === -1) return -1;

        // Check if this position is inside a parameter value
        if (!isInsideFunctionCallsParameterValue(content, found)) {
            return found;
        }

        // Skip this occurrence and look for the next one
        pos = found + tag.length;
    }

    return -1;
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
    // First, fix any leaked <thought> tags that should be inside think blocks
    const fixedThoughtContent = fixLeakedThoughtTags(content);

    // Merge consecutive think blocks into one
    const mergedThinkContent = mergeConsecutiveThinkBlocks(fixedThoughtContent);

    // Preprocess to fix corrupted tool call formats
    const processedContent = preprocessToolTags(mergedThinkContent);

    const tokens: ContentToken[] = [];
    let position = 0;
    let tokenIndex = 0;
    let toolIndex = 0;

    while (position < processedContent.length) {
        // Check for think/thinking blocks, tool blocks, and mermaid blocks
        // Use validators that skip tags inside parameter values (e.g., in apply_diff/write_to_file content)
        const thinkStart = findNextValidThinkStart(processedContent, position);
        const thinkingStart = findNextValidThinkingStart(processedContent, position);
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
            const textContent = processedContent.slice(position, nextBlockStart);

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
                const thinkContent = processedContent.slice(contentStart, closeTag);
                tokens.push({
                    type: 'think',
                    content: thinkContent,
                    index: tokenIndex++,
                    isClosed: true
                });
                position = closeTag + 8; // Skip past '</think>'
            } else {
                // Unclosed think block (streaming)
                const thinkContent = processedContent.slice(contentStart);
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
                const thinkContent = processedContent.slice(contentStart, closeTag);
                tokens.push({
                    type: 'think',
                    content: thinkContent,
                    index: tokenIndex++,
                    isClosed: true
                });
                position = closeTag + 11; // Skip past '</thinking>'
            } else {
                // Unclosed thinking block (streaming)
                const thinkContent = processedContent.slice(contentStart);
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

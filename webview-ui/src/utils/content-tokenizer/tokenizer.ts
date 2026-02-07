import type { ContentToken } from './types';
import { TOOL_FUNCTION_CALLS_CLOSE, TOOL_FUNCTION_CALLS_OPEN, TOOL_XML_NAMESPACE } from '../../lib/tool-xml';
import { extractKimiToolCallsIncremental, extractKimiToolCallsSection } from '../../lib/kimi-parser';

function parseToolParameters(xml: string): Record<string, unknown> {
    const parameters: Record<string, unknown> = {};
    const paramRegex = new RegExp(
        `<${TOOL_XML_NAMESPACE}:parameter(?:\\s+[^>]+)?\\s+name\\s*=\\s*["']([^"']+)["'][^>]*>([\\s\\S]*?)</${TOOL_XML_NAMESPACE}:parameter>`,
        'g'
    );

    let m: RegExpExecArray | null;
    while ((m = paramRegex.exec(xml)) !== null) {
        parameters[m[1]] = m[2].trim();
    }
    return parameters;
}

/**
 * Tokenize content into stable segments (think blocks, tool blocks, and text)
 * Process sequentially to avoid parsing content inside think blocks
 */
export function tokenizeContent(content: string, messageId: string = 'unknown'): ContentToken[] {
    if (!content) {
        return [];
    }

    const tokens: ContentToken[] = [];
    let position = 0;
    let tokenIndex = 0;
    let toolIndex = 0;

    while (position < content.length) {
        // Drop stray closing tags which can appear if we force-close a think block early.
        if (content.startsWith('</think>', position)) {
            position += '</think>'.length;
            continue;
        }
        if (content.startsWith('</thinking>', position)) {
            position += '</thinking>'.length;
            continue;
        }

        const nextThink = content.indexOf('<think>', position);
        const nextThinking = content.indexOf('<thinking>', position);
        const nextTool = content.indexOf(TOOL_FUNCTION_CALLS_OPEN, position);
        const nextKimiSection = extractKimiToolCallsSection(content, position)?.sectionStart ?? -1;
        const nextMermaid = content.indexOf('```mermaid', position);

        const candidates = [
            { pos: nextThink, type: 'think' as const },
            { pos: nextThinking, type: 'thinking' as const },
            { pos: nextTool, type: 'tool' as const },
            { pos: nextKimiSection, type: 'kimi' as const },
            { pos: nextMermaid, type: 'mermaid' as const },
        ].filter((c) => c.pos !== -1);

        if (candidates.length === 0) {
            const remaining = content.slice(position);
            if (remaining) {
                tokens.push({ type: 'text', content: remaining, index: tokenIndex++ });
            }
            break;
        }

        const next = candidates.reduce((min, curr) => (curr.pos < min.pos ? curr : min));

        if (next.pos > position) {
            const text = content.slice(position, next.pos);
            if (text) {
                tokens.push({ type: 'text', content: text, index: tokenIndex++ });
            }
            position = next.pos;
        }

        if (next.type === 'think' || next.type === 'thinking') {
            const openTag = next.type === 'think' ? '<think>' : '<thinking>';
            const closeTag = next.type === 'think' ? '</think>' : '</thinking>';
            const contentStart = position + openTag.length;
            const closeIdx = content.indexOf(closeTag, contentStart);

            // Edge case: if a tool block starts before the think block closes,
            // force-close the think token right before the tool so the tool is outside.
            const xmlToolIdxInside = content.indexOf(TOOL_FUNCTION_CALLS_OPEN, contentStart);
            const kimiToolIdxInside = extractKimiToolCallsSection(content, contentStart)?.sectionStart ?? -1;
            const toolIdxInside = (xmlToolIdxInside !== -1 && (kimiToolIdxInside === -1 || xmlToolIdxInside < kimiToolIdxInside))
                ? xmlToolIdxInside
                : kimiToolIdxInside;
            const thinkEnd = closeIdx === -1 ? content.length : closeIdx;
            if (toolIdxInside !== -1 && toolIdxInside < thinkEnd) {
                tokens.push({
                    type: 'think',
                    content: content.slice(contentStart, toolIdxInside),
                    index: tokenIndex++,
                    isClosed: true,
                });
                position = toolIdxInside;
                continue;
            }

            if (closeIdx === -1) {
                tokens.push({ type: 'think', content: content.slice(contentStart), index: tokenIndex++, isClosed: false });
                break;
            }

            tokens.push({ type: 'think', content: content.slice(contentStart, closeIdx), index: tokenIndex++, isClosed: true });
            position = closeIdx + closeTag.length;
            continue;
        }

        if (next.type === 'mermaid') {
            const contentStart = position + '```mermaid'.length;
            const closeIdx = content.indexOf('```', contentStart);

            if (closeIdx === -1) {
                tokens.push({ type: 'mermaid', content: content.slice(contentStart).trim(), index: tokenIndex++, isClosed: false });
                break;
            }

            tokens.push({ type: 'mermaid', content: content.slice(contentStart, closeIdx).trim(), index: tokenIndex++, isClosed: true });
            position = closeIdx + 3;
            if (position < content.length && content[position] === '\n') {
                position++;
            }
            continue;
        }

        // Kimi tool-call section
        if (next.type === 'kimi') {
            const section = extractKimiToolCallsSection(content, position);
            if (!section) {
                // Shouldn't happen since we found this branch via the section begin tag.
                tokens.push({ type: 'text', content: content.slice(position, position + 1), index: tokenIndex++ });
                position += 1;
                continue;
            }

            const sectionText = content.slice(section.sectionStart, section.sectionEnd);
            const incremental = extractKimiToolCallsIncremental(sectionText);

            for (const b of incremental.blocks) {
                tokens.push({
                    type: 'tool',
                    toolName: b.toolName,
                    parameters: b.parameters,
                    rawContent: b.rawContent,
                    index: tokenIndex++,
                    isClosed: true,
                    toolExecutionId: `${messageId}-tool-${toolIndex++}`,
                });
            }
            for (const p of incremental.pendingBlocks) {
                tokens.push({
                    type: 'tool',
                    toolName: p.toolName,
                    parameters: p.parameters,
                    rawContent: sectionText,
                    index: tokenIndex++,
                    isClosed: false,
                    toolExecutionId: `${messageId}-tool-${toolIndex++}`,
                });
            }

            position = section.sectionEnd;
            continue;
        }

        // tool:function_calls
        const toolContentStart = position + TOOL_FUNCTION_CALLS_OPEN.length;
        const toolCloseIdx = content.indexOf(TOOL_FUNCTION_CALLS_CLOSE, toolContentStart);
        const toolInner = toolCloseIdx === -1 ? content.slice(toolContentStart) : content.slice(toolContentStart, toolCloseIdx);

        const invokeRegex = new RegExp(
            `<${TOOL_XML_NAMESPACE}:invoke\\s+name=["']([^"']+)["']>([\\s\\S]*?)(</${TOOL_XML_NAMESPACE}:invoke>)`,
            'g'
        );
        let m: RegExpExecArray | null;
        let emittedToolToken = false;
        let emittedPendingToolToken = false;
        let lastCompleteInvokeEnd = 0;
        while ((m = invokeRegex.exec(toolInner)) !== null) {
            const toolName = m[1];
            const invokeInner = m[2];
            const fullInvoke = m[0];

            tokens.push({
                type: 'tool',
                toolName,
                parameters: parseToolParameters(invokeInner),
                rawContent: `${TOOL_FUNCTION_CALLS_OPEN}${fullInvoke}${TOOL_FUNCTION_CALLS_CLOSE}`,
                index: tokenIndex++,
                isClosed: true,
                toolExecutionId: `${messageId}-tool-${toolIndex++}`,
            });
            emittedToolToken = true;
            lastCompleteInvokeEnd = (m.index ?? 0) + fullInvoke.length;
        }

        // Fallback: if we have a function_calls wrapper but no complete invoke (common in edge cases),
        // emit a single pending tool token so the UI doesn't "lose" the tool.
        if (!emittedToolToken) {
            const openInvoke = toolInner.match(new RegExp(`<${TOOL_XML_NAMESPACE}:invoke\\s+name=["']([^"']+)["']>`));
            if (openInvoke) {
                const toolName = openInvoke[1];
                const invokeStart = openInvoke.index! + openInvoke[0].length;
                const partialInvokeInner = toolInner.slice(invokeStart);
                const rawBlock = toolCloseIdx === -1
                    ? content.slice(position)
                    : content.slice(position, toolCloseIdx + TOOL_FUNCTION_CALLS_CLOSE.length);

                tokens.push({
                    type: 'tool',
                    toolName,
                    parameters: parseToolParameters(partialInvokeInner),
                    rawContent: rawBlock,
                    index: tokenIndex++,
                    isClosed: false,
                    toolExecutionId: `${messageId}-tool-${toolIndex++}`,
                });
                emittedPendingToolToken = true;
            }
        }

        if (toolCloseIdx === -1) {
            // Streaming: if we can see an opening invoke, emit a single pending tool token
            if (!emittedPendingToolToken) {
                const openInvokeRe = new RegExp(`<${TOOL_XML_NAMESPACE}:invoke\\s+name=["']([^"']+)["']>`, 'g');
                let lastOpen: RegExpExecArray | null = null;
                let mm: RegExpExecArray | null;
                while ((mm = openInvokeRe.exec(toolInner)) !== null) {
                    if ((mm.index ?? 0) >= lastCompleteInvokeEnd) {
                        lastOpen = mm;
                    }
                }

                if (lastOpen) {
                    const toolName = lastOpen[1];
                    const openEnd = (lastOpen.index ?? 0) + lastOpen[0].length;
                    const hasClose = toolInner.indexOf(`</${TOOL_XML_NAMESPACE}:invoke>`, openEnd) !== -1;
                    if (!hasClose) {
                        const partialInvokeInner = toolInner.slice(openEnd);
                        tokens.push({
                            type: 'tool',
                            toolName,
                            parameters: parseToolParameters(partialInvokeInner),
                            rawContent: content.slice(position),
                            index: tokenIndex++,
                            isClosed: false,
                            toolExecutionId: `${messageId}-tool-${toolIndex++}`,
                        });
                        emittedPendingToolToken = true;
                    }
                }
            }
            break;
        }

        position = toolCloseIdx + TOOL_FUNCTION_CALLS_CLOSE.length;
    }

    return tokens;
}

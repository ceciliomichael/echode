import { findMatchingParameterClose, findMatchingInvokeClosingTagRespectingParams, isInsideInvokeParameterValue } from './tag-utils';
import { TOOL_XML_NAMESPACE } from '../../lib/tool-xml';

/**
 * Parse XML-style parameters from invoke block content
 * New format: <${TOOL_XML_NAMESPACE}:parameter name="paramName">value</${TOOL_XML_NAMESPACE}:parameter>
 * Handles both complete and partial/unclosed tags during streaming
 * Uses balanced tag matching to handle nested content (e.g., HTML with </script>)
 */
export function parseXMLParameters(content: string): Record<string, unknown> {
    const parameters: Record<string, unknown> = {};
    const processedParams = new Set<string>();

    // Find all parameter opening tags
    const openingParamRegex = new RegExp(
        `<${TOOL_XML_NAMESPACE}:parameter(?:\\s+[^>]+)?\\s+name\\s*=\\s*["']([^"']+)["'][^>]*>`
        , 'g'
    );
    let match: RegExpExecArray | null;

    while ((match = openingParamRegex.exec(content)) !== null) {
        const paramName = match[1];
        const openTagEnd = match.index + match[0].length;

        // Skip if already processed (handles duplicate tags)
        if (processedParams.has(paramName)) {
            continue;
        }

        // Find matching closing tag using balanced matching
        // This correctly handles nested </${TOOL_XML_NAMESPACE}:parameter> tags inside the content
        const closePos = findMatchingParameterClose(content, openTagEnd);

        if (closePos !== -1) {
            // Complete parameter tag found
            const paramValue = content.slice(openTagEnd, closePos);

            // Parameters that should ALWAYS be treated as raw strings (never parsed as JSON/numbers)
            const isRawStringParam = ['old_string', 'new_string', 'content', 'diff', 'edits', 'CodeContent'].includes(paramName);
            // Strip only leading/trailing newlines (AI adds newline after opening tag), preserve internal whitespace
            const finalValue = isRawStringParam
                ? paramValue.replace(/^\r?\n/, '').replace(/\r?\n$/, '')
                : paramValue.trim();
            // Skip parseParamValue for raw string params - they should never be converted to objects
            parameters[paramName] = isRawStringParam ? finalValue : parseParamValue(finalValue);
            processedParams.add(paramName);
        } else {
            // No closing tag found - this is streaming content (partial parameter)
            const partialContent = content.slice(openTagEnd);
            parameters[paramName] = partialContent;
            processedParams.add(paramName);
        }
    }

    return parameters;
}

/**
 * Parse parameter value with type coercion
 */
export function parseParamValue(value: string): unknown {
    // Try to parse as JSON first (for arrays, objects)
    if (value.startsWith('[') || value.startsWith('{')) {
        try {
            return JSON.parse(value);
        } catch {
            // If it's a partial array, try to extract complete objects
            if (value.startsWith('[')) {
                const completeObjects = extractCompleteJsonObjects(value);
                if (completeObjects.length > 0) {
                    return completeObjects;
                }
            }
            // If JSON parse fails, treat as string
        }
    }

    // Handle boolean values
    if (value === 'true') { return true; }
    if (value === 'false') { return false; }

    // Handle numeric values
    if (value && !isNaN(Number(value))) {
        return Number(value);
    }

    // Default: treat as string
    return value;
}

/**
 * Extract complete JSON objects from a partial array string
 * Used for streaming arrays like edits: [{...}, {...}]
 */
export function extractCompleteJsonObjects(partialArray: string): unknown[] {
    const objects: unknown[] = [];

    // Remove leading [ and whitespace
    const content = partialArray.slice(1).trim();

    let depth = 0;
    let objStart = -1;

    for (let i = 0; i < content.length; i++) {
        const char = content[i];

        if (char === '{') {
            if (depth === 0) { objStart = i; }
            depth++;
        } else if (char === '}') {
            depth--;

            // Found a complete object
            if (depth === 0 && objStart !== -1) {
                const objStr = content.slice(objStart, i + 1);
                try {
                    const obj = JSON.parse(objStr);
                    objects.push(obj);
                } catch {
                    // Skip malformed object
                }
                objStart = -1;
            }
        }
    }

    return objects;
}

/**
 * Extract ALL invoke blocks from content using balanced tag matching
 * Returns array of all invoke blocks found
 * IMPORTANT: Only extracts TOP-LEVEL invoke blocks, skipping nested invokes inside parameter values
 *
 * Each block is annotated with isClosed, which is true only when a matching </${TOOL_XML_NAMESPACE}:invoke>
 * has been found for that specific block. This is critical for streaming: in a
 * multi-invoke function_calls block, earlier invokes may be closed while the last
 * one is still streaming, and we must not mark that last invoke as closed until
 * its own </${TOOL_XML_NAMESPACE}:invoke> arrives.
 */
export function extractAllInvokeBlocks(content: string): Array<{ toolName: string; innerContent: string; fullMatch: string; isClosed: boolean }> {
    const blocks: Array<{ toolName: string; innerContent: string; fullMatch: string; isClosed: boolean }> = [];
    const invokeOpenRegex = new RegExp(`<${TOOL_XML_NAMESPACE}:invoke\\s+name=["']([^"']+)["']>`, 'g');
    const closeTag = `</${TOOL_XML_NAMESPACE}:invoke>`;

    let match: RegExpExecArray | null;
    while ((match = invokeOpenRegex.exec(content)) !== null) {
        // Skip invoke tags that are inside parameter values (examples in content)
        if (isInsideInvokeParameterValue(content, match.index)) {
            continue;
        }

        const toolName = match[1];
        const openTagEnd = match.index + match[0].length;

        // Find matching closing tag using balanced matching
        const closePos = findMatchingInvokeClosingTagRespectingParams(content, openTagEnd);

        if (closePos !== -1) {
            // Complete invoke block
            const innerContent = content.slice(openTagEnd, closePos);
            const fullMatch = content.slice(match.index, closePos + closeTag.length);
            blocks.push({ toolName, innerContent, fullMatch, isClosed: true });

            // CRITICAL: Skip past this entire invoke block to avoid finding nested invokes
            // inside parameter values (e.g., tool syntax inside write_to_file content)
            invokeOpenRegex.lastIndex = closePos + closeTag.length;
        } else {
            // No closing tag for THIS invoke - partial content for streaming.
            // We still return a block so the UI can show a pending/streaming tool,
            // but mark it as not closed so status stays in "pending" while content streams.
            blocks.push({
                toolName,
                innerContent: content.slice(openTagEnd),
                fullMatch: content.slice(match.index),
                isClosed: false,
            });
            break; // Stop at first incomplete block
        }
    }

    return blocks;
}

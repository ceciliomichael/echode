import type { ContentToken } from './types';
import { TOOL_FUNCTION_CALLS_CLOSE, TOOL_FUNCTION_CALLS_OPEN, TOOL_PARAMETER_CLOSE, TOOL_XML_NAMESPACE } from '../../lib/tool-xml';

/**
 * Known parameter names that should preserve raw string content (no trimming/parsing).
 * These typically contain code or multi-line content where whitespace matters.
 */
const RAW_STRING_PARAMS = new Set([
    'old_string', 'new_string', 'content', 'diff', 'edits', 'CodeContent'
]);

/**
 * Streaming-aware tool parser for assistant messages.
 * 
 * Inspired by Roo-Code's AssistantMessageParser, this uses a character-by-character
 * state machine approach with an accumulator pattern for reliable streaming detection.
 * 
 * Key improvements over the regex-based approach:
 * - Uses `endsWith()` for reliable tag detection during streaming
 * - Maintains state between chunks (text → function_calls → invoke → parameter)
 * - Handles partial content gracefully
 * - Uses `lastIndexOf` for raw content params to handle nested XML
 */
export class StreamingToolParser {
    private accumulator = '';
    private currentState: 'text' | 'function_calls' | 'invoke' | 'parameter' = 'text';
    private currentTextStart = 0;
    private currentFunctionCallsStart = 0;
    private currentInvokeStart = 0;
    private currentToolName = '';
    private tokens: ContentToken[] = [];
    private tokenIndex = 0;
    private toolIndex = 0;
    private messageId: string;

    // Precomputed tags for faster detection
    private static readonly FUNCTION_CALLS_OPEN = TOOL_FUNCTION_CALLS_OPEN;
    private static readonly FUNCTION_CALLS_CLOSE = TOOL_FUNCTION_CALLS_CLOSE;
    private static readonly INVOKE_CLOSE = `</${TOOL_XML_NAMESPACE}:invoke>`;
    private static readonly PARAMETER_CLOSE = TOOL_PARAMETER_CLOSE;

    // Regex patterns for extracting names from tags
    private static readonly INVOKE_OPEN_PATTERN = new RegExp(`<${TOOL_XML_NAMESPACE}:invoke\\s+name=["']([^"']+)["']>`);
    private static readonly PARAMETER_OPEN_PATTERN = new RegExp(
        `<${TOOL_XML_NAMESPACE}:parameter(?:\\s+[^>]+)?\\s+name\\s*=\\s*["']([^"']+)["'][^>]*>`
    );

    constructor(messageId: string = 'unknown') {
        this.messageId = messageId;
    }

    /**
     * Process a new chunk of streamed content.
     * Returns the current state of all tokens.
     */
    processChunk(chunk: string): ContentToken[] {
        for (let i = 0; i < chunk.length; i++) {
            this.accumulator += chunk[i];
            this.processCurrentPosition();
        }
        return this.getTokens();
    }

    /**
     * Process the full content at once (non-streaming mode).
     */
    parse(content: string): ContentToken[] {
        this.reset();
        return this.processChunk(content);
    }

    /**
     * Reset parser state for a new message.
     */
    reset(): void {
        this.accumulator = '';
        this.currentState = 'text';
        this.currentTextStart = 0;
        this.currentFunctionCallsStart = 0;
        this.currentInvokeStart = 0;
        this.currentToolName = '';
        this.tokens = [];
        this.tokenIndex = 0;
        this.toolIndex = 0;
    }

    /**
     * Get current tokens (useful for UI during streaming).
     */
    getTokens(): ContentToken[] {
        return [...this.tokens];
    }

    /**
     * Process the current position based on state.
     */
    private processCurrentPosition(): void {
        const parserFlags = (globalThis as unknown as {
            __ECHODE_TOKENIZER_FLAGS__?: { skipToolsInCodeFences?: boolean };
        }).__ECHODE_TOKENIZER_FLAGS__;

        if (parserFlags?.skipToolsInCodeFences && this.isInsideCodeFence()) {
            return;
        }

        switch (this.currentState) {
            case 'text':
                this.processTextState();
                break;
            case 'function_calls':
                this.processFunctionCallsState();
                break;
            case 'invoke':
                this.processInvokeState();
                break;
            case 'parameter':
                this.processParameterState();
                break;
        }
    }

    /**
     * Simple check if current position is inside a code fence.
     */
    private isInsideCodeFence(): boolean {
        const acc = this.accumulator;
        let fenceCount = 0;
        let i = 0;
        while (i < acc.length - 3) { // -3 to avoid checking partial fence at end
            if (acc.startsWith('```', i)) {
                fenceCount++;
                i += 3;
                // Skip to end of line for language identifier
                while (i < acc.length && acc[i] !== '\n') {
                    i++;
                }
            } else {
                i++;
            }
        }
        // Odd count means we're inside a fence
        return fenceCount % 2 === 1;
    }

    /**
     * Process text state - looking for function_calls opening tag.
     */
    private processTextState(): void {
        const acc = this.accumulator;

        // Check for function_calls opening
        if (acc.endsWith(StreamingToolParser.FUNCTION_CALLS_OPEN)) {
            // End current text block if we have content
            const textContent = acc.slice(
                this.currentTextStart,
                acc.length - StreamingToolParser.FUNCTION_CALLS_OPEN.length
            ).trim();

            if (textContent) {
                // Check for and remove incomplete tag at end of text
                const cleanedText = this.removePartialTagFromEnd(textContent);
                if (cleanedText) {
                    this.tokens.push({
                        type: 'text',
                        content: cleanedText,
                        index: this.tokenIndex++
                    });
                }
            }

            // Transition to function_calls state
            this.currentState = 'function_calls';
            this.currentFunctionCallsStart = acc.length;
        }
    }

    /**
     * Process function_calls state - looking for invoke opening or function_calls closing.
     */
    private processFunctionCallsState(): void {
        const acc = this.accumulator;
        const innerContent = acc.slice(this.currentFunctionCallsStart);

        // Check for closing tag first (no invokes found)
        if (acc.endsWith(StreamingToolParser.FUNCTION_CALLS_CLOSE)) {
            this.currentState = 'text';
            this.currentTextStart = acc.length;
            return;
        }

        // Check for invoke opening tag
        const invokeMatch = innerContent.match(StreamingToolParser.INVOKE_OPEN_PATTERN);
        if (invokeMatch && innerContent.endsWith(invokeMatch[0])) {
            this.currentToolName = invokeMatch[1];
            this.currentState = 'invoke';
            this.currentInvokeStart = acc.length;
        }
    }

    /**
     * Process invoke state - looking for parameters or invoke closing.
     */
    private processInvokeState(): void {
        const acc = this.accumulator;
        const innerContent = acc.slice(this.currentInvokeStart);

        // Check for invoke closing
        if (acc.endsWith(StreamingToolParser.INVOKE_CLOSE)) {
            this.finalizeCurrentInvoke(true);

            // Check if there are more invokes or we're done
            this.currentState = 'function_calls';
            this.currentFunctionCallsStart = acc.length;
            return;
        }

        // Check for parameter opening
        const paramMatch = innerContent.match(StreamingToolParser.PARAMETER_OPEN_PATTERN);
        if (paramMatch && innerContent.endsWith(paramMatch[0])) {
            this.currentState = 'parameter';
        }
    }

    /**
     * Process parameter state - looking for parameter closing.
     */
    private processParameterState(): void {
        const acc = this.accumulator;

        // Check for parameter closing
        if (acc.endsWith(StreamingToolParser.PARAMETER_CLOSE)) {
            // Parameters are extracted during finalization, just transition state
            // Go back to invoke state
            this.currentState = 'invoke';
        }
    }

    /**
     * Finalize the current invoke block as a token.
     */
    private finalizeCurrentInvoke(isClosed: boolean): void {
        if (!this.currentToolName) return;

        const execId = `${this.messageId}-tool-${this.toolIndex++}`;
        const rawContent = this.accumulator.slice(
            this.currentFunctionCallsStart - StreamingToolParser.FUNCTION_CALLS_OPEN.length
        );

        // Find or create the token for this invoke
        const existingTokenIndex = this.tokens.findIndex(
            t => t.type === 'tool' && t.toolExecutionId === execId
        );

        const token: ContentToken = {
            type: 'tool',
            toolName: this.currentToolName,
            parameters: this.extractParametersFromInvoke(),
            rawContent: `${StreamingToolParser.FUNCTION_CALLS_OPEN}${rawContent}${StreamingToolParser.FUNCTION_CALLS_CLOSE}`,
            index: existingTokenIndex >= 0 ? this.tokens[existingTokenIndex].index : this.tokenIndex++,
            isClosed,
            toolExecutionId: execId
        };

        if (existingTokenIndex >= 0) {
            this.tokens[existingTokenIndex] = token;
        } else {
            this.tokens.push(token);
        }

        this.currentToolName = '';
    }

    /**
     * Extract parameters from the current invoke content.
     */
    private extractParametersFromInvoke(): Record<string, unknown> {
        const params: Record<string, unknown> = {};
        const invokeContent = this.accumulator.slice(this.currentInvokeStart);

        // Find all parameter blocks
        const paramOpenPattern = new RegExp(
            `<${TOOL_XML_NAMESPACE}:parameter(?:\\s+[^>]+)?\\s+name\\s*=\\s*["']([^"']+)["'][^>]*>`,
            'g'
        );
        let match: RegExpExecArray | null;

        while ((match = paramOpenPattern.exec(invokeContent)) !== null) {
            const paramName = match[1];
            const valueStart = match.index + match[0].length;

            // For raw string params, use lastIndexOf to handle nested closing tags
            let closePos: number;
            if (RAW_STRING_PARAMS.has(paramName)) {
                closePos = invokeContent.lastIndexOf(StreamingToolParser.PARAMETER_CLOSE);
            } else {
                closePos = invokeContent.indexOf(StreamingToolParser.PARAMETER_CLOSE, valueStart);
            }

            if (closePos !== -1 && closePos > valueStart) {
                let value = invokeContent.slice(valueStart, closePos);

                // Strip leading/trailing newlines for raw params, trim for others
                if (RAW_STRING_PARAMS.has(paramName)) {
                    value = value.replace(/^\n/, '').replace(/\n$/, '');
                    params[paramName] = value;
                } else {
                    params[paramName] = this.parseParamValue(value.trim());
                }
            }
        }

        return params;
    }

    /**
     * Parse parameter value with type coercion.
     */
    private parseParamValue(value: string): unknown {
        // Try JSON parse for arrays/objects
        if (value.startsWith('[') || value.startsWith('{')) {
            try {
                return JSON.parse(value);
            } catch {
                // Fall through to string
            }
        }

        // Booleans
        if (value === 'true') return true;
        if (value === 'false') return false;

        // Numbers
        if (value && !isNaN(Number(value))) {
            return Number(value);
        }

        return value;
    }

    /**
     * Remove partial tag from end of text (e.g., "<func" during streaming).
     */
    private removePartialTagFromEnd(text: string): string {
        // Check for partial <${TOOL_XML_NAMESPACE}:function_calls>
        const tag = `${TOOL_XML_NAMESPACE}:function_calls`;
        if (text.endsWith('<')) {
            return text.slice(0, -1);
        }

        for (let i = 1; i <= tag.length; i++) {
            const partial = `<${tag.slice(0, i)}`;
            if (text.endsWith(partial)) {
                return text.slice(0, -partial.length);
            }
        }

        return text;
    }
}

/**
 * Parse content using the streaming parser.
 * This is a convenience function that wraps the StreamingToolParser.
 */
export function parseContentStreaming(content: string, messageId: string = 'unknown'): ContentToken[] {
    const parser = new StreamingToolParser(messageId);
    return parser.parse(content);
}

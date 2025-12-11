import * as vscode from 'vscode';
import { LLMFactory } from '../services/llm/llm-factory';
import { ChatMessage, ChatStreamSettings } from '../services/llm/llm-provider.interface';

/**
 * System prompt for context summarization
 * Based on research: fact extraction > prose, preserve reasoning, structured output
 */
const SUMMARIZER_SYSTEM_PROMPT = `You are a lossless context compressor. Extract and preserve facts from conversation history to enable seamless continuation.

EXTRACTION RULES:
1. Extract discrete facts, not prose - list specific items, not summaries of items
2. Preserve exact identifiers verbatim: paths, names, values, errors, URLs
3. Preserve reasoning chains: what was decided AND why
4. Preserve user preferences and constraints stated
5. Preserve sequence: order of actions matters for understanding causality
6. Flag unresolved issues explicitly - do not smooth over problems
7. CRITICAL: Preserve tool execution patterns - what tools were used and their sequence

WHAT TO CAPTURE:
- USER INTENT: Original request + any refinements/clarifications
- FACTS LEARNED: Specific discoveries (e.g., "config in /app/settings.json", "API requires auth header")  
- ACTIONS + OUTCOMES: What was done → result (success/fail/partial)
- DECISIONS + REASONING: Choice made → why (e.g., "Used Redis over Memcached: need persistence")
- CURRENT STATE: What exists, what works, what's broken
- BLOCKERS/PENDING: Unresolved issues, waiting on user, next steps needed
- TOOL EXECUTION: Which tools (read_file, write_to_file, apply_diff, etc.) were used, file paths affected, and in what order

OUTPUT FORMAT:
GOAL: [User's core objective]

FACTS:
• [Specific fact with exact values]
• [Another fact]

ACTIONS:
1. [Action] → [Outcome]
2. [Action] → [Outcome]

FILES MODIFIED:
• [File path] - [What was changed]

DECISIONS:
• [Choice]: [Reasoning]

STATE: [Current situation in one line]

PENDING: [What remains to be done or resolved]

---
Output facts only. No commentary. No intro/outro.`;

interface SummarizerRequest {
  requestId: string;
  messages: Array<{
    role: string;
    content: string;
  }>;
  settings: {
    provider: ChatStreamSettings['provider'];
    apiKey?: string;
    model: string;
    baseURL?: string;
    maxTokens?: number;
    temperature?: number;
    streamingTimeout?: number;
  };
}

/**
 * Handle context summarization requests from webview
 * Takes middle conversation messages and returns a compressed summary
 */
export async function handleContextSummarizer(
  data: unknown,
  webview: vscode.WebviewView | vscode.WebviewPanel
): Promise<void> {
  const request = data as SummarizerRequest;
  const { requestId, messages, settings } = request;

  try {
    // Build conversation text for summarization
    const conversationText = messages
      .map((msg) => `[${msg.role.toUpperCase()}]: ${msg.content}`)
      .join('\n\n---\n\n');

    // Build the summarization request
    const summarizeMessages: ChatMessage[] = [
      {
        role: 'system',
        content: SUMMARIZER_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: `Summarize this conversation history:\n\n${conversationText}`,
      },
    ];

    // Get the provider and generate summary
    const provider = LLMFactory.getProvider(settings.provider);

    // Use non-streaming completion for summarization
    let summary = '';

    // Create a mock stream to collect the response
    const abortController = new AbortController();

    await provider.streamChat(
      -1, // Use -1 as a sentinel for non-streaming collection
      summarizeMessages,
      {
        provider: settings.provider,
        apiKey: settings.apiKey || '',
        model: settings.model,
        baseURL: settings.baseURL || '',
        maxTokens: settings.maxTokens || 4096,
        temperature: settings.temperature ?? 0.3,
        streamingTimeout: settings.streamingTimeout,
      },
      {
        webview: {
          postMessage: (msg: { type: string; chunk?: string }) => {
            if (msg.type === 'chatStreamChunk' && msg.chunk) {
              summary += msg.chunk;
            }
          },
        },
      } as unknown as vscode.WebviewView,
      abortController.signal
    );

    // Send the summary back wrapped in conversation_summary tags
    const wrappedSummary = `<conversation_summary>\n${summary.trim()}\n</conversation_summary>`;

    webview.webview.postMessage({
      type: 'contextSummaryComplete',
      requestId,
      summary: wrappedSummary,
    });
  } catch (error) {
    console.error('[ContextSummarizer] Error:', error);
    webview.webview.postMessage({
      type: 'contextSummaryError',
      requestId,
      error: error instanceof Error ? error.message : 'Failed to summarize context',
    });
  }
}

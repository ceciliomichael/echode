import * as vscode from 'vscode';
import OpenAI from 'openai';
import { ILLMProvider, ChatMessage, ChatStreamSettings } from './llm-provider.interface';
import { StreamingTimeoutError } from '../../utils/streaming-timeout';

const DEFAULT_STREAMING_TIMEOUT = 5000; // 5 seconds

type ChatCompletionChunkLike = {
  choices: Array<{
    delta?: {
      content?: string;
      reasoning_content?: string;
    };
    finish_reason?: string | null;
  }>;
};

export class OpenAICompatibleProvider implements ILLMProvider {
  async streamChat(
    requestId: string,
    messages: ChatMessage[],
    settings: ChatStreamSettings,
    webview: vscode.WebviewView | vscode.WebviewPanel,
    signal: AbortSignal
  ): Promise<void> {
    const timeoutMs = settings.streamingTimeout ?? DEFAULT_STREAMING_TIMEOUT;
    let attempt = 0;

    while (true) {
      if (signal.aborted) {
        return;
      }

      attempt++;
      try {
        await this.executeStream(requestId, messages, settings, webview, signal, timeoutMs);
        return; // Success, exit retry loop
      } catch (error) {
        if (signal.aborted) {
          return;
        }
        if (error instanceof StreamingTimeoutError) {
          console.log(`[OpenAICompatibleProvider] Streaming timeout, retrying (attempt ${attempt})...`);
          continue; // Retry
        }
        throw error; // Other errors, propagate
      }
    }
  }

  private async executeStream(
    requestId: string,
    messages: ChatMessage[],
    settings: ChatStreamSettings,
    webview: vscode.WebviewView | vscode.WebviewPanel,
    signal: AbortSignal,
    timeoutMs: number
  ): Promise<void> {
    // Validate that baseURL is configured
    if (!settings.baseURL || settings.baseURL.trim() === '') {
      throw new Error('Base URL is required for OpenAI Compatible provider. Please configure a Base URL in settings.');
    }

    // Add /v1 to baseURL for OpenAI-compatible APIs
    const baseURL = `${settings.baseURL}/v1`;

    const client = new OpenAI({
      apiKey: settings.apiKey,
      baseURL,
    });

    // Track stream state to handle late errors gracefully
    let hasReceivedFirstChunk = false;
    let hasReceivedContent = false;
    let hasFinishReason = false;
    let timeoutId: NodeJS.Timeout | null = null;

    // Internal abort controller to stop the stream on timeout
    // This prevents duplicate responses when retry occurs
    const internalAbortController = new AbortController();
    const combinedAborted = () => signal.aborted || internalAbortController.signal.aborted;

    // Forward external abort to internal controller
    const abortHandler = () => internalAbortController.abort();
    signal.addEventListener('abort', abortHandler);

    // Create timeout promise for first chunk
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        if (!hasReceivedFirstChunk) {
          // Abort the stream before rejecting to prevent it from continuing
          internalAbortController.abort();
          reject(new StreamingTimeoutError('No streaming data received within timeout'));
        }
      }, timeoutMs);
    });

    try {
      const stream = await this.createChatCompletionStream(client, messages, settings, internalAbortController.signal) as AsyncIterable<ChatCompletionChunkLike>;

      // Track reasoning/thinking state
      let isInThinkingBlock = false;
      let hasPostedNonThinkingChunk = false;
      let hasEmittedThinkingOpen = false;

      const processStream = async () => {
        for await (const chunk of stream) {
          // Check for abort (external or internal timeout abort)
          if (combinedAborted()) {
            break;
          }

          // Mark first chunk received and clear timeout (some providers send role/metadata before content)
          if (!hasReceivedFirstChunk) {
            hasReceivedFirstChunk = true;
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }
          }

          // Check for finish_reason indicating stream completion
          const finishReason = chunk.choices[0]?.finish_reason;
          if (finishReason) {
            hasFinishReason = true;
          }

          const delta = chunk.choices[0]?.delta;
          if (!delta) {
            continue;
          }

          // Handle reasoning content
          const reasoningContent = delta.reasoning_content;
          if (reasoningContent) {
            hasReceivedContent = true;

            // Don't post if aborted during processing
            if (combinedAborted()) {
              break;
            }

            // Only allow emitting a <thinking> wrapper if thinking is the FIRST visible output.
            // If normal output already started, stream reasoning as plain text (no wrappers) to avoid mid-response <thinking> tags.
            if (!hasEmittedThinkingOpen && hasPostedNonThinkingChunk) {
              webview.webview.postMessage({
                type: 'chatStreamChunk',
                requestId,
                chunk: reasoningContent
              });
              continue;
            }

            // Start thinking block if not already in one
            if (!isInThinkingBlock) {
              isInThinkingBlock = true;
              if (!hasEmittedThinkingOpen) {
                hasEmittedThinkingOpen = true;
                webview.webview.postMessage({
                  type: 'chatStreamChunk',
                  requestId,
                  chunk: '<thinking>'
                });
              }
            }

            // Send reasoning content
            webview.webview.postMessage({
              type: 'chatStreamChunk',
              requestId,
              chunk: reasoningContent
            });
          }

          // Handle regular content
          const content = delta.content;
          if (content) {
            hasReceivedContent = true;

            // Don't post if aborted during processing
            if (combinedAborted()) {
              break;
            }

            // Close thinking block if we were in one
            if (hasEmittedThinkingOpen && isInThinkingBlock) {
              isInThinkingBlock = false;
              webview.webview.postMessage({
                type: 'chatStreamChunk',
                requestId,
                chunk: '</thinking>'
              });
            }

            // Send regular content
            webview.webview.postMessage({
              type: 'chatStreamChunk',
              requestId,
              chunk: content
            });
            hasPostedNonThinkingChunk = true;
          }
        }

        // Close thinking block if stream ends while in thinking
        if (hasEmittedThinkingOpen && isInThinkingBlock) {
          webview.webview.postMessage({
            type: 'chatStreamChunk',
            requestId,
            chunk: '</thinking>'
          });
        }
      };

      // Race between stream processing and timeout
      await Promise.race([
        processStream(),
        timeoutPromise
      ]);

      // Signal completion only if not aborted
      if (!combinedAborted()) {
        webview.webview.postMessage({
          type: 'chatStreamComplete',
          requestId
        });
      }
    } catch (error) {
      // Clean up timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (combinedAborted()) {
        // Stream was aborted (externally or due to timeout), don't throw
        // For timeout case, we still want to propagate the timeout error for retry
        if (error instanceof StreamingTimeoutError) {
          throw error;
        }
        return;
      }

      if (error instanceof StreamingTimeoutError) {
        throw error; // Let retry logic handle this
      }

      // If we received content and/or a finish signal, treat late errors as non-fatal
      // Many OpenAI-compatible servers report errors like HTTP 5xx or "terminated" after
      // successfully delivering the streamed content.
      if (hasReceivedContent || hasFinishReason) {
        webview.webview.postMessage({
          type: 'chatStreamComplete',
          requestId
        });
        return;
      }

      throw new Error(`OpenAI Compatible API Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      signal.removeEventListener('abort', abortHandler);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  private async createChatCompletionStream(
    client: OpenAI,
    messages: ChatMessage[],
    settings: ChatStreamSettings,
    signal: AbortSignal,
  ) {
    const basePayload = {
      model: settings.model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content
      })) as OpenAI.ChatCompletionMessageParam[],
      temperature: settings.temperature ?? 0,
      stream: true,
      ...(settings.reasoningEffort ? { reasoning_effort: settings.reasoningEffort } : {}),
    };

    const maxTokensPayload = {
      ...basePayload,
      max_tokens: settings.maxTokens,
    };

    const maxCompletionTokensPayload: Record<string, unknown> = {
      ...basePayload,
      max_completion_tokens: settings.maxTokens,
    };

    try {
      return await client.chat.completions.create(
        maxTokensPayload as unknown as OpenAI.ChatCompletionCreateParams,
        { signal },
      );
    } catch (error: unknown) {
      if (this.isMaxTokensUnsupportedError(error)) {
        return await client.chat.completions.create(
          maxCompletionTokensPayload as unknown as OpenAI.ChatCompletionCreateParams,
          { signal },
        );
      }
      throw error;
    }
  }

  private isMaxTokensUnsupportedError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const message = (error as Error).message;
    if (typeof message !== 'string') {
      return false;
    }

    if (!message.includes('max_tokens')) {
      return false;
    }

    return message.includes('Unsupported parameter') && message.includes('max_completion_tokens');
  }
}

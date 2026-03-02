import * as vscode from 'vscode';
import OpenAI from 'openai';
import { ChatMessage, ChatStreamSettings } from '../llm-provider.interface';
import { StreamingTimeoutError } from '../../../utils/streaming-timeout';
import { QwenOAuthCredentials } from './credential-manager';
import { resolveQwenCodeModel } from './model-mapping';

const DEFAULT_STREAMING_TIMEOUT = 10000; // 10 seconds

type QwenChatCompletionChunkLike = {
  choices: Array<{
    delta?: {
      content?: string;
      reasoning_content?: string;
    };
  }>;
};

export class QwenStreamingHandler {
  private client: OpenAI | null = null;

  getOrCreateClient(credentials: QwenOAuthCredentials, baseUrl: string): OpenAI {
    if (!this.client) {
      this.client = new OpenAI({
        apiKey: credentials.access_token,
        baseURL: baseUrl,
      });
    } else {
      // Update credentials if they changed
      this.client.apiKey = credentials.access_token;
      this.client.baseURL = baseUrl;
    }
    return this.client;
  }

  resetClient(): void {
    this.client = null;
  }

  async executeStream(
    requestId: string,
    messages: ChatMessage[],
    settings: ChatStreamSettings,
    webview: vscode.WebviewView | vscode.WebviewPanel,
    signal: AbortSignal,
    credentials: QwenOAuthCredentials,
    baseUrl: string
  ): Promise<void> {
    const timeoutMs = settings.streamingTimeout ?? DEFAULT_STREAMING_TIMEOUT;
    const client = this.getOrCreateClient(credentials, baseUrl);
    const resolvedModel = resolveQwenCodeModel(settings.model);

    const internalAbortController = new AbortController();
    const combinedAborted = () => signal.aborted || internalAbortController.signal.aborted;
    const abortHandler = () => internalAbortController.abort();
    signal.addEventListener('abort', abortHandler);

    let hasReceivedFirstChunk = false;
    let timeoutId: NodeJS.Timeout | null = null;

    // Create timeout promise for first chunk
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        if (!hasReceivedFirstChunk) {
          internalAbortController.abort();
          reject(new StreamingTimeoutError('No streaming data received within timeout'));
        }
      }, timeoutMs);
    });

    try {
      const stream = await client.chat.completions.create({
        model: resolvedModel.apiModel,
        messages: messages.map(m => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content
        })) as OpenAI.ChatCompletionMessageParam[],
        max_tokens: settings.maxTokens,
        temperature: settings.temperature ?? 0.0,
        stream: true,
        ...(resolvedModel.enableThinking ? { extra_body: { enable_thinking: true } } : {}),
      }, { signal: internalAbortController.signal }) as unknown as AsyncIterable<QwenChatCompletionChunkLike>;

      // Qwen returns cumulative content, not deltas - track full content to extract only new text
      let fullContent = '';
      // Track reasoning/thinking state and cumulative reasoning text
      let fullReasoning = '';
      let isInThinkingBlock = false;
      let hasPostedNonThinkingChunk = false;
      let hasEmittedThinkingOpen = false;

      const processStream = async () => {
        for await (const chunk of stream) {
          if (combinedAborted()) {
            break;
          }

          const delta = chunk.choices[0]?.delta;
          if (!delta) {
            continue;
          }

          const reasoningContent = delta.reasoning_content;
          if (reasoningContent) {
            // Mark first chunk received and clear timeout
            if (!hasReceivedFirstChunk) {
              hasReceivedFirstChunk = true;
              if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
              }
            }

            // Qwen reasoning can also be cumulative; emit only new text when possible
            let newReasoningText = reasoningContent;
            if (reasoningContent.startsWith(fullReasoning)) {
              newReasoningText = reasoningContent.substring(fullReasoning.length);
            }
            fullReasoning = reasoningContent;

            if (newReasoningText) {
              // Only emit <thinking> wrapper if it is the first visible output
              if (!hasEmittedThinkingOpen && hasPostedNonThinkingChunk) {
                webview.webview.postMessage({
                  type: 'chatStreamChunk',
                  requestId,
                  chunk: newReasoningText
                });
              } else {
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

                webview.webview.postMessage({
                  type: 'chatStreamChunk',
                  requestId,
                  chunk: newReasoningText
                });
              }
            }
          }

          const content = delta.content;
          if (content) {
            // Mark first chunk received and clear timeout
            if (!hasReceivedFirstChunk) {
              hasReceivedFirstChunk = true;
              if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
              }
            }

            // Extract only the new text by comparing with previous full content
            let newText = content;
            if (content.startsWith(fullContent)) {
              newText = content.substring(fullContent.length);
            }
            fullContent = content;

            if (newText) {
              // Close thinking block before normal visible output
              if (hasEmittedThinkingOpen && isInThinkingBlock) {
                isInThinkingBlock = false;
                webview.webview.postMessage({
                  type: 'chatStreamChunk',
                  requestId,
                  chunk: '</thinking>'
                });
              }

              webview.webview.postMessage({
                type: 'chatStreamChunk',
                requestId,
                chunk: newText
              });
              hasPostedNonThinkingChunk = true;
            }
          }
        }

        // Close thinking block if stream ends while in thinking state
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
        if (error instanceof StreamingTimeoutError) {
          throw error;
        }
        return;
      }

      if (error instanceof StreamingTimeoutError) {
        throw error; // Let retry logic handle this
      }

      throw new Error(`Qwen API Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      signal.removeEventListener('abort', abortHandler);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }
}

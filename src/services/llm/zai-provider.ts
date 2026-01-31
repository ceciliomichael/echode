import * as vscode from 'vscode';
import { ILLMProvider, ChatMessage, ChatStreamSettings } from './llm-provider.interface';
import { StreamingTimeoutError } from '../../utils/streaming-timeout';

const DEFAULT_STREAMING_TIMEOUT = 5000; // 5 seconds
const ZAI_DEFAULT_BASE_URL = 'https://api.z.ai/api/coding/paas/v4';

export class ZaiProvider implements ILLMProvider {
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
          console.log(`[ZaiProvider] Streaming timeout, retrying (attempt ${attempt})...`);
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
    // Use configured baseURL or default to Z.ai API
    // Ensure no trailing slash
    const baseURL = (settings.baseURL ? settings.baseURL.trim() : ZAI_DEFAULT_BASE_URL).replace(/\/$/, '');
    const url = `${baseURL}/chat/completions`;

    // Track stream state
    let hasReceivedFirstChunk = false;
    let hasReceivedContent = false;
    let timeoutId: NodeJS.Timeout | null = null;
    const internalAbortController = new AbortController();
    const combinedAborted = () => signal.aborted || internalAbortController.signal.aborted;

    // Forward external abort to internal controller
    const abortHandler = () => internalAbortController.abort();
    signal.addEventListener('abort', abortHandler);

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        if (!hasReceivedFirstChunk) {
          internalAbortController.abort();
          reject(new StreamingTimeoutError('No streaming data received within timeout'));
        }
      }, timeoutMs);
    });

    // Prepare request payload - use raw fetch to access reasoning_content
    const payload = {
      model: settings.model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content
      })),
      temperature: settings.temperature ?? 0,
      stream: true,
      ...(settings.maxTokens ? { max_tokens: settings.maxTokens } : {}),
      // Z.ai API requires explicit thinking parameter - both enabled and disabled
      thinking: { type: settings.zaiThinking ? 'enabled' : 'disabled' },
    };

    try {
      const fetchPromise = (async () => {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.apiKey}`,
          },
          body: JSON.stringify(payload),
          signal: internalAbortController.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Z.ai API Error (${response.status}): ${errorText}`);
        }

        if (!response.body) {
          throw new Error('Response body is null');
        }

        // Decode and process SSE stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let isInThinkingBlock = false;

        const parseSseEvent = (eventText: string): void => {
          const rawLines = eventText.split('\n').map((l) => l.replace(/\r$/, ''));
          const dataLines: string[] = [];

          for (const rawLine of rawLines) {
            const line = rawLine.trimEnd();
            if (!line) {
              continue;
            }
            // SSE comments start with ':'
            if (line.startsWith(':')) {
              continue;
            }

            // Accept both `data:` and `data: `
            if (line.startsWith('data:')) {
              dataLines.push(line.slice('data:'.length).replace(/^\s/, ''));
            }
          }

          if (dataLines.length === 0) {
            return;
          }

          const data = dataLines.join('\n').trim();
          if (!data || data === '[DONE]') {
            return;
          }

          if (!hasReceivedFirstChunk) {
            hasReceivedFirstChunk = true;
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }
          }

          try {
            const chunk = JSON.parse(data);

            // Extract delta from the raw JSON - no SDK filtering
            const choice = chunk.choices?.[0];
            const delta = choice?.delta;

            if (!delta) {
              return;
            }

            // Handle reasoning_content (Z.ai thinking mode)
            const reasoningContent = delta.reasoning_content;

            if (reasoningContent) {
              hasReceivedContent = true;

              if (!isInThinkingBlock) {
                isInThinkingBlock = true;
                webview.webview.postMessage({
                  type: 'chatStreamChunk',
                  requestId,
                  chunk: '<' + 'thinking>'
                });
              }

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

              // Close thinking block before regular content
              if (isInThinkingBlock) {
                isInThinkingBlock = false;
                webview.webview.postMessage({
                  type: 'chatStreamChunk',
                  requestId,
                  chunk: '</' + 'thinking>'
                });
              }

              webview.webview.postMessage({
                type: 'chatStreamChunk',
                requestId,
                chunk: content
              });
            }
          } catch (_e) {
            // Skip malformed JSON chunks
            console.error('[ZaiProvider] Error parsing SSE chunk:', _e);
          }
        };

        while (true) {
          if (combinedAborted()) {
            break;
          }

          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });

          // Split by SSE event boundary: blank line (supports both \n\n and \r\n\r\n)
          // Keep the last incomplete event in buffer.
          const eventParts = buffer.split(/\r?\n\r?\n/);
          buffer = eventParts.pop() || '';

          for (const eventText of eventParts) {
            if (combinedAborted()) {
              break;
            }
            if (!eventText.trim()) {
              continue;
            }
            parseSseEvent(eventText);
          }
        }

        // Close thinking block if still open at end of stream
        if (isInThinkingBlock) {
          webview.webview.postMessage({
            type: 'chatStreamChunk',
            requestId,
            chunk: '</' + 'thinking>'
          });
        }
      })();

      await Promise.race([fetchPromise, timeoutPromise]);

      if (!combinedAborted()) {
        webview.webview.postMessage({
          type: 'chatStreamComplete',
          requestId
        });
      }

    } catch (error) {
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
        throw error;
      }

      if (hasReceivedContent) {
        webview.webview.postMessage({
          type: 'chatStreamComplete',
          requestId
        });
        return;
      }
       
      throw error;
    } finally {
      signal.removeEventListener('abort', abortHandler);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }
}
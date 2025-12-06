import * as vscode from 'vscode';
import OpenAI from 'openai';
import { ChatMessage, ChatStreamSettings } from '../llm-provider.interface';
import { StreamingTimeoutError } from '../../../utils/streaming-timeout';
import { QwenOAuthCredentials } from './credential-manager';

const DEFAULT_STREAMING_TIMEOUT = 10000; // 10 seconds

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
    requestId: number,
    messages: ChatMessage[],
    settings: ChatStreamSettings,
    webview: vscode.WebviewView | vscode.WebviewPanel,
    signal: AbortSignal,
    credentials: QwenOAuthCredentials,
    baseUrl: string
  ): Promise<void> {
    const timeoutMs = settings.streamingTimeout ?? DEFAULT_STREAMING_TIMEOUT;
    const client = this.getOrCreateClient(credentials, baseUrl);

    let hasReceivedFirstChunk = false;
    let timeoutId: NodeJS.Timeout | null = null;

    // Create timeout promise for first chunk
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        if (!hasReceivedFirstChunk) {
          reject(new StreamingTimeoutError('No streaming data received within timeout'));
        }
      }, timeoutMs);
    });

    try {
      const stream = await client.chat.completions.create({
        model: settings.model,
        messages: messages.map(m => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content
        })) as OpenAI.ChatCompletionMessageParam[],
        max_tokens: settings.maxTokens,
        temperature: settings.temperature ?? 0.0,
        stream: true,
      });

      // Qwen returns cumulative content, not deltas - track full content to extract only new text
      let fullContent = '';

      const processStream = async () => {
        for await (const chunk of stream) {
          if (signal.aborted) {
            break;
          }

          const content = chunk.choices[0]?.delta?.content;
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
              webview.webview.postMessage({
                type: 'chatStreamChunk',
                requestId,
                chunk: newText
              });
            }
          }
        }
      };

      // Race between stream processing and timeout
      await Promise.race([
        processStream(),
        timeoutPromise
      ]);
      
      if (!signal.aborted) {
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

      if (signal.aborted) {
        return;
      }
      
      if (error instanceof StreamingTimeoutError) {
        throw error; // Let retry logic handle this
      }
      
      throw new Error(`Qwen API Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }
}
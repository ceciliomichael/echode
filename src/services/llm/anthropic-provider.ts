import * as vscode from 'vscode';
import Anthropic from '@anthropic-ai/sdk';
import { ILLMProvider, ChatMessage, ChatStreamSettings } from './llm-provider.interface';
import { StreamingTimeoutError } from '../../utils/streaming-timeout';

const DEFAULT_STREAMING_TIMEOUT = 5000; // 5 seconds

export class AnthropicProvider implements ILLMProvider {
  async streamChat(
    requestId: number,
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
          console.log(`[AnthropicProvider] Streaming timeout, retrying (attempt ${attempt})...`);
          continue; // Retry
        }
        throw error; // Other errors, propagate
      }
    }
  }

  private async executeStream(
    requestId: number,
    messages: ChatMessage[],
    settings: ChatStreamSettings,
    webview: vscode.WebviewView | vscode.WebviewPanel,
    signal: AbortSignal,
    timeoutMs: number
  ): Promise<void> {
    const client = new Anthropic({
      apiKey: settings.apiKey,
      baseURL: settings.baseURL,
    });

    // Separate system message from conversation messages
    const systemMessage = messages.find(m => m.role === 'system');
    const conversationMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => {
        // Convert our ChatMessageContent format to Anthropic's format
        let content: string | Anthropic.MessageParam['content'];
        
        if (typeof m.content === 'string') {
          content = m.content;
        } else {
          // Convert multimodal content to Anthropic's format
          content = m.content.map(c => {
            if (c.type === 'text' && c.text) {
              return {
                type: 'text' as const,
                text: c.text
              };
            } else if (c.type === 'image_url' && c.image_url) {
              // Extract base64 data from data URL
              const dataUrlMatch = c.image_url.url.match(/^data:([^;]+);base64,(.+)$/);
              if (dataUrlMatch) {
                const [, mimeType, base64Data] = dataUrlMatch;
                return {
                  type: 'image' as const,
                  source: {
                    type: 'base64' as const,
                    media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                    data: base64Data
                  }
                };
              }
            }
            // Fallback to text if conversion fails
            return { type: 'text' as const, text: '' };
          }).filter(c => c.type === 'text' ? c.text !== '' : true); // Remove empty text blocks
        }
        
        return {
          role: m.role as 'user' | 'assistant',
          content
        };
      });

    // Ensure system message is always a string (Anthropic doesn't support multimodal system messages)
    const systemContent = systemMessage?.content
      ? typeof systemMessage.content === 'string'
        ? systemMessage.content
        : systemMessage.content.find(c => c.type === 'text')?.text || ''
      : undefined;

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
      const stream = await client.messages.create({
        model: settings.model,
        max_tokens: settings.maxTokens,
        temperature: settings.temperature ?? 1.0,
        messages: conversationMessages,
        system: systemContent,
        stream: true,
      });

      // Process stream with timeout race
      const processStream = async () => {
        for await (const event of stream) {
          // Check for abort
          if (signal.aborted) {
            break;
          }
          
          // Extract text deltas from content blocks - Anthropic ALWAYS sends deltas
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            const text = event.delta.text;
            
            // Mark first chunk received and clear timeout
            if (!hasReceivedFirstChunk) {
              hasReceivedFirstChunk = true;
              if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
              }
            }
            
            webview.webview.postMessage({
              type: 'chatStreamChunk',
              requestId,
              chunk: text
            });
          }
        }
      };

      // Race between stream processing and timeout
      await Promise.race([
        processStream(),
        timeoutPromise
      ]);

      // Signal completion only if not aborted
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
        // Stream was aborted, don't throw
        return;
      }
      
      if (error instanceof StreamingTimeoutError) {
        throw error; // Let retry logic handle this
      }
      
      throw new Error(`Anthropic API Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }
}

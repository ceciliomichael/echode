import * as vscode from 'vscode';
import Anthropic from '@anthropic-ai/sdk';
import { ILLMProvider, ChatMessage, ChatStreamSettings } from './llm-provider.interface';

export class AnthropicProvider implements ILLMProvider {
  async streamChat(
    requestId: number,
    messages: ChatMessage[],
    settings: ChatStreamSettings,
    webview: vscode.WebviewView | vscode.WebviewPanel,
    signal: AbortSignal
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

    try {
      const stream = await client.messages.create({
        model: settings.model,
        max_tokens: settings.maxTokens,
        messages: conversationMessages,
        system: systemContent,
        stream: true,
      });

      for await (const event of stream) {
        // Check for abort
        if (signal.aborted) {
          break;
        }
        
        // Extract text deltas from content blocks
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          webview.webview.postMessage({
            type: 'chatStreamChunk',
            requestId,
            chunk: event.delta.text
          });
        }
      }

      // Signal completion only if not aborted
      if (!signal.aborted) {
        webview.webview.postMessage({
          type: 'chatStreamComplete',
          requestId
        });
      }
    } catch (error) {
      if (signal.aborted) {
        // Stream was aborted, don't throw
        return;
      }
      throw new Error(`Anthropic API Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

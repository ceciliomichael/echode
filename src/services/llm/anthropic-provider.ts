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
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }));

    try {
      const stream = await client.messages.create({
        model: settings.model,
        max_tokens: settings.maxTokens,
        messages: conversationMessages,
        system: systemMessage?.content,
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

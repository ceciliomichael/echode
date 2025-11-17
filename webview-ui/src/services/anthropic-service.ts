import Anthropic from '@anthropic-ai/sdk';
import type { IChatService, ChatServiceConfig, StreamChatParams } from './base-chat-service';

/**
 * Anthropic chat service implementation using official SDK
 */
export class AnthropicService implements IChatService {
  private client: Anthropic;
  private config: ChatServiceConfig;

  constructor(config: ChatServiceConfig) {
    this.config = config;
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      dangerouslyAllowBrowser: true,
    });

    console.log('[Anthropic Service] Initialized with base URL:', config.baseURL);
  }

  /**
   * Stream chat completion from Anthropic API
   * Converts messages to Anthropic format (system message separate from conversation)
   */
  async *streamChat({ messages, signal }: StreamChatParams): AsyncGenerator<string, void, unknown> {
    // Separate system message from conversation messages
    const systemMessage = messages.find(m => m.role === 'system');
    const conversationMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }));

    try {
      const stream = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        messages: conversationMessages,
        system: systemMessage?.content,
        stream: true,
      });

      for await (const event of stream) {
        // Check for abort signal
        if (signal?.aborted) {
          console.log('[Anthropic Service] Stream aborted by user');
          break;
        }

        // Extract text deltas from content blocks
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield event.delta.text;
        }
      }
    } catch (error) {
      console.error('[Anthropic Service] Error:', error);
      throw new Error(`Anthropic API Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

import OpenAI from 'openai';
import type { IChatService, ChatServiceConfig, StreamChatParams } from './base-chat-service';

/**
 * OpenAI Compatible chat service implementation
 * Supports any OpenAI-compatible API (LocalAI, Ollama, LM Studio, etc.)
 */
export class OpenAICompatibleService implements IChatService {
  private client: OpenAI;
  private config: ChatServiceConfig;

  constructor(config: ChatServiceConfig) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: `${config.baseURL}/v1`,
      dangerouslyAllowBrowser: true,
    });

    console.log('[OpenAI Compatible Service] Initialized with base URL:', `${config.baseURL}/v1`);
  }

  /**
   * Stream chat completion from OpenAI-compatible API
   * Supports system, user, and assistant roles
   */
  async *streamChat({ messages, signal }: StreamChatParams): AsyncGenerator<string, void, unknown> {
    try {
      const stream = await this.client.chat.completions.create({
        model: this.config.model,
        messages: messages.map(m => ({
          role: m.role as 'system' | 'user' | 'assistant',
          content: m.content
        })),
        max_tokens: this.config.maxTokens,
        temperature: 0.7,
        stream: true,
      });

      for await (const chunk of stream) {
        // Check for abort signal
        if (signal?.aborted) {
          console.log('[OpenAI Compatible Service] Stream aborted by user');
          break;
        }

        // Extract content from delta
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
    } catch (error) {
      console.error('[OpenAI Compatible Service] Error:', error);
      throw new Error(`OpenAI Compatible API Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

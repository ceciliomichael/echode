/**
 * OpenAI Completion Strategy
 * Handles completions for OpenAI, OpenAI-compatible, MegaLLM, and custom providers
 */

import OpenAI from 'openai';
import { ICompletionStrategy, AutocompleteConfig } from './types';

export class OpenAICompletionStrategy implements ICompletionStrategy {
  private client: OpenAI | null = null;
  private lastBaseUrl: string | null = null;
  private lastApiKey: string | null = null;

  async generateCompletion(
    userPrompt: string,
    systemPrompt: string,
    config: AutocompleteConfig,
    signal: AbortSignal
  ): Promise<string | null> {
    if (!config.apiKey || !config.baseUrl) {
      return null;
    }

    const client = this.getOrCreateClient(config);

    try {
      const response = await this.createChatCompletion(
        client,
        userPrompt,
        systemPrompt,
        config,
        signal
      );

      return response.choices[0]?.message?.content || null;
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        return null;
      }
      throw error;
    }
  }

  private getOrCreateClient(config: AutocompleteConfig): OpenAI {
    // Rebuild client if config changed
    if (
      !this.client ||
      this.lastBaseUrl !== config.baseUrl ||
      this.lastApiKey !== config.apiKey
    ) {
      let baseURL = config.baseUrl || '';
      if (!baseURL.endsWith('/v1')) {
        baseURL = baseURL.replace(/\/$/, '') + '/v1';
      }

      this.client = new OpenAI({
        apiKey: config.apiKey,
        baseURL,
      });
      this.lastBaseUrl = config.baseUrl || null;
      this.lastApiKey = config.apiKey || null;
    }

    return this.client;
  }

  private async createChatCompletion(
    client: OpenAI,
    userPrompt: string,
    systemPrompt: string,
    config: AutocompleteConfig,
    signal: AbortSignal
  ): Promise<OpenAI.ChatCompletion> {
    const basePayload = {
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ] as OpenAI.ChatCompletionMessageParam[],
      temperature: config.temperature || 0,
      stop: ['\n\n', '```'],
    };

    const maxTokensPayload = {
      ...basePayload,
      max_tokens: config.maxTokens || 100,
    };

    const maxCompletionTokensPayload: Record<string, unknown> = {
      ...basePayload,
      max_completion_tokens: config.maxTokens || 100,
    };

    try {
      return await client.chat.completions.create(
        maxTokensPayload as unknown as OpenAI.ChatCompletionCreateParams,
        { signal }
      ) as unknown as OpenAI.ChatCompletion;
    } catch (error: unknown) {
      if (this.isMaxTokensUnsupportedError(error)) {
        return await client.chat.completions.create(
          maxCompletionTokensPayload as unknown as OpenAI.ChatCompletionCreateParams,
          { signal }
        ) as unknown as OpenAI.ChatCompletion;
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

  dispose(): void {
    this.client = null;
    this.lastBaseUrl = null;
    this.lastApiKey = null;
  }
}
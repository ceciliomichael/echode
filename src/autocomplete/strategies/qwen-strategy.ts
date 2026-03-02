/**
 * Qwen Completion Strategy
 * Handles completions for Qwen using OAuth credentials
 */

import OpenAI from 'openai';
import { ICompletionStrategy, AutocompleteConfig } from './types';
import { QwenCredentialManager, QwenOAuthCredentials } from '../../services/llm/qwen/credential-manager';
import { QwenTokenRefresher } from '../../services/llm/qwen/token-refresher';
import { resolveQwenCodeModel } from '../../services/llm/qwen/model-mapping';

export class QwenCompletionStrategy implements ICompletionStrategy {
  private credentials: QwenOAuthCredentials | null = null;
  private client: OpenAI | null = null;
  private readonly tokenRefresher = new QwenTokenRefresher();
  private lastOauthPath: string | null = null;

  async generateCompletion(
    userPrompt: string,
    systemPrompt: string,
    config: AutocompleteConfig,
    signal: AbortSignal
  ): Promise<string | null> {
    try {
      await this.ensureAuthenticated(config);

      if (!this.credentials) {
        return null;
      }

      const baseUrl = QwenCredentialManager.getBaseUrl(this.credentials);
      const client = this.getOrCreateClient(baseUrl);

      const response = await this.createChatCompletion(
        client,
        userPrompt,
        systemPrompt,
        config,
        signal
      );

      return response.choices[0]?.message?.content || null;
    } catch (error: unknown) {
      if (signal.aborted) {
        return null;
      }

      // Handle 401 token expiry - try to refresh once
      if (this.is401Error(error)) {
        try {
          await this.refreshCredentials(config);
          this.resetClient();

          const baseUrl = QwenCredentialManager.getBaseUrl(this.credentials!);
          const client = this.getOrCreateClient(baseUrl);

          const response = await this.createChatCompletion(
            client,
            userPrompt,
            systemPrompt,
            config,
            signal
          );

          return response.choices[0]?.message?.content || null;
        } catch (_refreshError) {
          // Silently fail on refresh error
          return null;
        }
      }

      if (error instanceof Error && error.name === 'AbortError') {
        return null;
      }

      // Silently fail for autocomplete
      console.error('[QwenCompletionStrategy] Error:', error);
      return null;
    }
  }

  private is401Error(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }
    return (error as { status?: number }).status === 401;
  }

  private async ensureAuthenticated(config: AutocompleteConfig): Promise<void> {
    // Reload credentials if path changed
    if (this.lastOauthPath !== config.qwenCodeOauthPath) {
      this.credentials = null;
      this.lastOauthPath = config.qwenCodeOauthPath || null;
    }

    if (!this.credentials) {
      this.credentials = await QwenCredentialManager.loadCredentials(config.qwenCodeOauthPath);
    }

    if (!QwenCredentialManager.isTokenValid(this.credentials)) {
      await this.refreshCredentials(config);
    }
  }

  private async refreshCredentials(config: AutocompleteConfig): Promise<void> {
    if (!this.credentials) {
      throw new Error('Cannot refresh credentials: no credentials loaded');
    }

    this.credentials = await this.tokenRefresher.refreshAccessToken(
      this.credentials,
      config.qwenCodeOauthPath
    );
  }

  private getOrCreateClient(baseUrl: string): OpenAI {
    if (!this.client || !this.credentials) {
      this.client = new OpenAI({
        apiKey: this.credentials!.access_token,
        baseURL: baseUrl,
      });
    } else {
      // Update credentials if they changed
      this.client.apiKey = this.credentials.access_token;
      this.client.baseURL = baseUrl;
    }
    return this.client;
  }

  private resetClient(): void {
    this.client = null;
  }

  private async createChatCompletion(
    client: OpenAI,
    userPrompt: string,
    systemPrompt: string,
    config: AutocompleteConfig,
    signal: AbortSignal
  ): Promise<OpenAI.ChatCompletion> {
    const resolvedModel = resolveQwenCodeModel(config.model);

    return await client.chat.completions.create(
      {
        model: resolvedModel.apiModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: config.maxTokens || 100,
        temperature: config.temperature || 0,
        stop: ['\n\n', '```'],
        ...(resolvedModel.enableThinking ? { extra_body: { enable_thinking: true } } : {}),
      },
      { signal }
    );
  }

  dispose(): void {
    this.client = null;
    this.credentials = null;
    this.lastOauthPath = null;
  }
}

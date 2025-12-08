import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { QwenCredentialManager } from '../llm/qwen/credential-manager';
import { ConversationMessage, SubAgentApiSettings, IndexingSettings, ProgressCallback } from './types';
import { createFirstChunkTimeoutPromise, StreamingTimeoutError } from '../../utils/streaming-timeout';

const DEFAULT_FIRST_CHUNK_TIMEOUT = 5000; // 5 seconds to receive first chunk (configurable via settings)

/**
 * LLM client abstraction for sub-agent
 * Handles all LLM provider interactions with timeout and retry logic
 */
export class LLMClient {
  private apiSettings: SubAgentApiSettings;
  private indexingSettings: IndexingSettings;
  private onProgress?: ProgressCallback;

  constructor(
    indexingSettings: IndexingSettings,
    apiSettings: SubAgentApiSettings,
    onProgress?: ProgressCallback
  ) {
    this.indexingSettings = indexingSettings;
    this.apiSettings = apiSettings;
    this.onProgress = onProgress;
  }

  /**
   * Call the LLM based on provider
   */
  async call(
    conversation: ConversationMessage[],
    systemPrompt: string,
    signal?: AbortSignal
  ): Promise<string | null> {
    const { provider, model } = this.indexingSettings;

    try {
      switch (provider) {
        case 'anthropic':
          return await this.callAnthropic(conversation, model, systemPrompt, signal);
        case 'openai':
          return await this.callOpenAI(conversation, model, systemPrompt, this.apiSettings.openaiApiKey, this.apiSettings.openaiCustomUrl, signal);
        case 'openai-compatible':
        case 'megallm': {
          const apiKey = provider === 'megallm' ? this.apiSettings.megallmApiKey : this.apiSettings.openaiCompatibleApiKey;
          const defaultMegallmUrl = 'https://ai.megallm.io/v1';
          const baseUrl = provider === 'megallm'
            ? (this.apiSettings.megallmCustomUrl || defaultMegallmUrl)
            : this.apiSettings.openaiCompatibleCustomUrl;
          return await this.callOpenAI(conversation, model, systemPrompt, apiKey, baseUrl, signal);
        }
        case 'qwen-code': {
          const credentials = await QwenCredentialManager.loadCredentials(this.apiSettings.qwenCodeOauthPath);
          const baseUrl = QwenCredentialManager.getBaseUrl(credentials);
          return await this.callOpenAI(conversation, model, systemPrompt, credentials.access_token, baseUrl, signal);
        }
        default:
          this.onProgress?.(`Provider ${provider} not supported for sub-agent`);
          return null;
      }
    } catch (error) {
      if (signal?.aborted) {
        throw error;
      }
      this.onProgress?.(`LLM Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  /**
   * Call Anthropic API with timeout retry
   */
  private async callAnthropic(
    conversation: ConversationMessage[],
    model: string,
    systemPrompt: string,
    signal?: AbortSignal
  ): Promise<string> {
    let attempt = 0;

    while (true) {
      if (signal?.aborted) {
        throw new Error('Aborted');
      }

      attempt++;
      try {
        return await this.executeAnthropicCall(conversation, model, systemPrompt, signal);
      } catch (error) {
        if (signal?.aborted) {
          throw error;
        }

        if (error instanceof StreamingTimeoutError) {
          this.onProgress?.(`No response received, retrying (attempt ${attempt})...`);
          continue;
        }
        throw error;
      }
    }
  }

  private async executeAnthropicCall(
    conversation: ConversationMessage[],
    model: string,
    systemPrompt: string,
    signal?: AbortSignal
  ): Promise<string> {
    if (signal?.aborted) {
      throw new Error('Aborted');
    }

    const client = new Anthropic({
      apiKey: this.apiSettings.anthropicApiKey,
      baseURL: this.apiSettings.anthropicCustomUrl || undefined,
    });

    // Create timeout that only triggers if no streaming data is received
    const timeoutMs = this.apiSettings.streamingTimeout ?? DEFAULT_FIRST_CHUNK_TIMEOUT;
    const timeout = createFirstChunkTimeoutPromise(timeoutMs, signal);

    // Use streaming API
    const stream = client.messages.stream({
      model: model || 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      system: systemPrompt,
      messages: conversation.map(m => ({
        role: m.role,
        content: m.content,
      })),
    });

    // Collect streamed text
    let result = '';
    
    const streamPromise = (async () => {
      for await (const event of stream) {
        if (signal?.aborted) {
          stream.abort();
          throw new Error('Aborted');
        }
        
        // Notify timeout controller that we received data
        timeout.notifyChunk();
        
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          result += event.delta.text;
        }
      }
      return result;
    })();

    try {
      // Race between streaming and timeout
      const response = await Promise.race([streamPromise, timeout.promise]);
      timeout.cancel();
      return response;
    } catch (error) {
      timeout.cancel();
      stream.abort();
      throw error;
    }
  }

  /**
   * Call OpenAI-compatible API with timeout retry
   */
  private async callOpenAI(
    conversation: ConversationMessage[],
    model: string,
    systemPrompt: string,
    apiKey?: string,
    baseUrl?: string,
    signal?: AbortSignal
  ): Promise<string> {
    let attempt = 0;

    while (true) {
      if (signal?.aborted) {
        throw new Error('Aborted');
      }

      attempt++;
      try {
        return await this.executeOpenAICall(conversation, model, systemPrompt, apiKey, baseUrl, signal);
      } catch (error) {
        if (signal?.aborted) {
          throw error;
        }

        if (error instanceof StreamingTimeoutError) {
          this.onProgress?.(`No response received, retrying (attempt ${attempt})...`);
          continue;
        }
        throw error;
      }
    }
  }

  private async executeOpenAICall(
    conversation: ConversationMessage[],
    model: string,
    systemPrompt: string,
    apiKey?: string,
    baseUrl?: string,
    signal?: AbortSignal
  ): Promise<string> {
    if (signal?.aborted) {
      throw new Error('Aborted');
    }

    let normalizedBaseUrl = baseUrl;
    if (baseUrl && !baseUrl.endsWith('/v1')) {
      normalizedBaseUrl = baseUrl.endsWith('/') ? `${baseUrl}v1` : `${baseUrl}/v1`;
    }

    const client = new OpenAI({
      apiKey: apiKey || '',
      baseURL: normalizedBaseUrl || undefined,
    });

    // Create timeout that only triggers if no streaming data is received
    const timeoutMs = this.apiSettings.streamingTimeout ?? DEFAULT_FIRST_CHUNK_TIMEOUT;
    const timeout = createFirstChunkTimeoutPromise(timeoutMs, signal);

    // Use streaming API
    const stream = await client.chat.completions.create({
      model: model || 'gpt-4o',
      max_tokens: 4096,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        ...conversation.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ],
    }, { signal });

    // Collect streamed text
    let result = '';
    
    const streamPromise = (async () => {
      for await (const chunk of stream) {
        if (signal?.aborted) {
          throw new Error('Aborted');
        }
        
        // Notify timeout controller that we received data
        timeout.notifyChunk();
        
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          result += content;
        }
      }
      return result;
    })();

    try {
      // Race between streaming and timeout
      const response = await Promise.race([streamPromise, timeout.promise]);
      timeout.cancel();
      return response;
    } catch (error) {
      timeout.cancel();
      throw error;
    }
  }
}
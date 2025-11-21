import type { ChatMessage } from '../types/chat-api';
import { storageService } from '../utils/storage';
import { getProviderDefaults } from '../types/api-settings';
import { UnifiedChatService } from './unified-chat-service';

export class ChatApiService {
  async *streamChat(messages: ChatMessage[], signal?: AbortSignal): AsyncGenerator<string, void, unknown> {
    const settings = storageService.getSettings();

    if (!settings.provider) {
      throw new Error('API configuration not available. Please configure your API settings in the header settings.');
    }

    // Resolve effective per-provider configuration
    let effectiveApiKey = '';
    let effectiveModel = '';
    let maxTokens = 0;
    let baseURL = '';

    if (settings.provider === 'anthropic') {
      effectiveApiKey = settings.anthropicApiKey || settings.apiKey || '';
      effectiveModel = settings.anthropicModel || settings.model;
      maxTokens = settings.anthropicMaxTokens;
      baseURL = settings.anthropicCustomUrl?.trim() || getProviderDefaults('anthropic').baseUrl;
    } else if (settings.provider === 'openai') {
      effectiveApiKey = settings.openaiApiKey || settings.apiKey || '';
      effectiveModel = settings.openaiModel || settings.model;
      maxTokens = settings.openaiMaxTokens;
      baseURL = settings.openaiCustomUrl?.trim() || getProviderDefaults('openai').baseUrl;
    } else if (settings.provider === 'openai-compatible') {
      effectiveApiKey = settings.openaiCompatibleApiKey || settings.apiKey || '';
      effectiveModel = settings.openaiCompatibleModel || settings.model;
      maxTokens = settings.openaiCompatibleMaxTokens;
      baseURL = settings.openaiCompatibleCustomUrl?.trim() || getProviderDefaults('openai-compatible').baseUrl;
    } else {
      // VS Code LM: no apiKey/baseURL, provider-specific model/maxTokens
      effectiveApiKey = '';
      effectiveModel = settings.vscodeLmModel || settings.model;
      maxTokens = settings.vscodeLmMaxTokens;
      baseURL = '';
    }

    // VS Code LM doesn't require API key, others do
    const requiresApiKey = settings.provider !== 'vscode-lm';
    if ((requiresApiKey && !effectiveApiKey) || !effectiveModel) {
      throw new Error('API configuration not available. Please configure your API settings in the header settings.');
    }

    // Use unified service singleton that communicates with VSCode backend
    const service = UnifiedChatService.getInstance({
      apiKey: effectiveApiKey,
      model: effectiveModel,
      maxTokens,
      baseURL,
    }, settings.provider);

    yield* service.streamChat({ messages, signal });
  }
}

export const chatApi = new ChatApiService();

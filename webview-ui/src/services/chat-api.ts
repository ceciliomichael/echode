import type { ChatMessage } from '../types/chat-api';
import { storageService } from '../utils/storage';
import { PROVIDER_DEFAULTS } from '../types/api-settings';
import { UnifiedChatService } from './unified-chat-service';

export class ChatApiService {
  async *streamChat(messages: ChatMessage[], signal?: AbortSignal): AsyncGenerator<string, void, unknown> {
    const settings = storageService.getSettings();

    if (!settings.provider || !settings.apiKey || !settings.model) {
      throw new Error('API configuration not available. Please configure your API settings in the header settings.');
    }

    const maxTokens = settings.provider === 'anthropic' 
      ? settings.anthropicMaxTokens 
      : settings.provider === 'openai' 
      ? settings.openaiMaxTokens 
      : settings.openaiCompatibleMaxTokens;

    console.log('[Echode API] Provider:', settings.provider);
    console.log('[Echode API] Model:', settings.model);
    console.log('[Echode API] Max Tokens:', maxTokens);

    // Determine base URL based on provider
    let baseURL: string;
    if (settings.provider === 'anthropic') {
      baseURL = settings.anthropicCustomUrl?.trim() || PROVIDER_DEFAULTS.anthropic.baseUrl;
    } else if (settings.provider === 'openai') {
      baseURL = settings.openaiCustomUrl?.trim() || PROVIDER_DEFAULTS.openai.baseUrl;
    } else {
      baseURL = settings.openaiCompatibleCustomUrl?.trim() || PROVIDER_DEFAULTS['openai-compatible'].baseUrl;
    }

    // Use unified service singleton that communicates with VSCode backend
    const service = UnifiedChatService.getInstance({
      apiKey: settings.apiKey,
      model: settings.model,
      maxTokens,
      baseURL,
    });

    yield* service.streamChat({ messages, signal });
  }
}

export const chatApi = new ChatApiService();

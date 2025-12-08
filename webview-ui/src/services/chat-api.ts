import type { ChatMessage } from '../types/chat-api';
import type { ChatMode } from '../types/chat-mode';
import { storageService } from '../utils/storage';
import { getProviderDefaults } from '../types/api-settings';
import { UnifiedChatService } from './unified-chat-service';
import { getToolsForMode } from '../lib/tool-config';

export class ChatApiService {
  async *streamChat(messages: ChatMessage[], signal?: AbortSignal, mode: ChatMode = 'agent'): AsyncGenerator<string, void, unknown> {
    const settings = storageService.getSettings();

    if (!storageService.hasSettings()) {
      throw new Error('API configuration not available. Please configure your API settings in the header settings.');
    }

    // Resolve effective per-provider configuration
    let effectiveApiKey = '';
    let effectiveModel = '';
    let maxTokens = 0;
    let temperature = 0;
    let baseURL = '';
    let qwenCodeOauthPath: string | undefined;

    if (settings.provider === 'anthropic') {
      effectiveApiKey = settings.anthropicApiKey || settings.apiKey || '';
      effectiveModel = settings.anthropicModel || settings.model;
      maxTokens = settings.anthropicMaxTokens;
      temperature = settings.anthropicTemperature;
      baseURL = settings.anthropicCustomUrl?.trim() || getProviderDefaults('anthropic').baseUrl;
    } else if (settings.provider === 'openai') {
      effectiveApiKey = settings.openaiApiKey || settings.apiKey || '';
      effectiveModel = settings.openaiModel || settings.model;
      maxTokens = settings.openaiMaxTokens;
      temperature = settings.openaiTemperature;
      baseURL = settings.openaiCustomUrl?.trim() || getProviderDefaults('openai').baseUrl;
    } else if (settings.provider === 'openai-compatible') {
      effectiveApiKey = settings.openaiCompatibleApiKey || settings.apiKey || '';
      effectiveModel = settings.openaiCompatibleModel || settings.model;
      maxTokens = settings.openaiCompatibleMaxTokens;
      temperature = settings.openaiCompatibleTemperature;
      baseURL = settings.openaiCompatibleCustomUrl?.trim() || getProviderDefaults('openai-compatible').baseUrl;
    } else if (settings.provider === 'megallm') {
      effectiveApiKey = settings.megallmApiKey || settings.apiKey || '';
      effectiveModel = settings.megallmModel || settings.model;
      maxTokens = settings.megallmMaxTokens;
      temperature = settings.megallmTemperature;
      baseURL = getProviderDefaults('megallm').baseUrl;
    } else if (settings.provider === 'qwen-code') {
      // Qwen Code: uses OAuth, no API key
      effectiveApiKey = '';
      effectiveModel = settings.qwenCodeModel || settings.model;
      maxTokens = settings.qwenCodeMaxTokens;
      temperature = settings.qwenCodeTemperature;
      baseURL = getProviderDefaults('qwen-code').baseUrl;
      qwenCodeOauthPath = settings.qwenCodeOauthPath || '~/.qwen/oauth_creds.json';
    } else {
      // VS Code LM: no apiKey/baseURL, provider-specific model/maxTokens
      effectiveApiKey = '';
      effectiveModel = settings.vscodeLmModel || settings.model;
      maxTokens = settings.vscodeLmMaxTokens;
      temperature = settings.vscodeLmTemperature;
      baseURL = '';
    }

    // Filter tools based on mode (plan mode gets restricted set, agent mode gets all)
    const savedEnabledTools = settings.enabledTools;
    const hasSavedEnabledTools = Array.isArray(savedEnabledTools) && savedEnabledTools.length > 0;

    let modeTools = mode === 'plan'
      ? getToolsForMode('plan', true)
      : getToolsForMode(mode, true);

    if (mode === 'agent' && hasSavedEnabledTools) {
      modeTools = modeTools.filter(tool => {
        // Find the tool in settings to check if it's enabled
        const settingsTool = savedEnabledTools!.find(t => t.id === tool.id);
        return settingsTool?.enabled ?? false;
      });
    }

    // Filter out echo_search if indexing is disabled
    const echoSearchEnabled = settings.indexingSettings?.enabled ?? true;
    if (!echoSearchEnabled) {
      modeTools = modeTools.filter(tool => tool.id !== 'echo_search');
    }

    const enabledToolsForBackend = modeTools.map(tool => ({
      id: tool.id,
      enabled: true,
    }));

    // Use unified service singleton that communicates with VSCode backend
    const service = UnifiedChatService.getInstance({
      apiKey: effectiveApiKey,
      model: effectiveModel,
      maxTokens,
      temperature,
      baseURL,
      qwenCodeOauthPath,
      enabledTools: enabledToolsForBackend,
      streamingTimeout: settings.streamingTimeout || 5000,
    }, settings.provider);

    yield* service.streamChat({ messages, signal });
  }
}

export const chatApi = new ChatApiService();

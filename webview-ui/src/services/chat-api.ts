import type { ChatMessage } from '../types/chat-api';
import type { ChatMode } from '../types/chat-mode';
import { storageService } from '../utils/storage';
import { getProviderDefaults, isCustomProvider } from '../types/api-settings';
import type { Provider } from '../types/api-settings';
import { UnifiedChatService } from './unified-chat-service';
import { getToolsForMode } from '../lib/tool-config';

export interface LockedModelConfig {
  provider: Provider;
  model: string;
  mode: ChatMode;
  /** The original UI mode before any conversions (e.g., 'yolo' before it becomes 'plan' or 'agent') */
  originalMode?: ChatMode;
}

export class ChatApiService {
  async *streamChat(
    messages: ChatMessage[],
    signal?: AbortSignal,
    mode: ChatMode = 'agent',
    lockedConfig?: LockedModelConfig
  ): AsyncGenerator<string, void, unknown> {
    const settings = storageService.getSettings();

    // Use locked config if provided (for continuations), otherwise get from storage
    const activeProvider = lockedConfig?.provider ?? storageService.getModeModel(mode).provider;
    const activeModel = lockedConfig?.model ?? storageService.getModeModel(mode).model;

    // Resolve effective per-provider configuration
    let effectiveApiKey = '';
    let effectiveModel = activeModel; // Use mode-specific model
    let maxTokens = 0;
    let temperature = 0;
    let baseURL = '';
    let reasoningEffort: string | undefined;
    let zaiThinking: boolean | undefined;
    let qwenCodeOauthPath: string | undefined;

    // Check if it's a custom provider
    if (isCustomProvider(activeProvider)) {
      const customId = activeProvider.replace('custom-', '');
      const customProvider = settings.customProviders?.find(cp => cp.id === customId);
      
      if (customProvider) {
        effectiveApiKey = customProvider.apiKey || '';
        effectiveModel = activeModel || customProvider.model;
        maxTokens = customProvider.maxTokens;
        temperature = customProvider.temperature;
        reasoningEffort = customProvider.reasoningEffort;
        baseURL = customProvider.baseUrl;
      } else {
        // Fallback to openai-compatible defaults if custom provider not found
        effectiveApiKey = settings.openaiCompatibleApiKey || settings.apiKey || '';
        effectiveModel = activeModel || settings.openaiCompatibleModel || settings.model;
        maxTokens = settings.openaiCompatibleMaxTokens;
        temperature = settings.openaiCompatibleTemperature;
        reasoningEffort = settings.openaiCompatibleReasoningEffort;
        baseURL = settings.openaiCompatibleCustomUrl?.trim() || getProviderDefaults('openai-compatible').baseUrl;
      }
    } else if (activeProvider === 'anthropic') {
      effectiveApiKey = settings.anthropicApiKey || settings.apiKey || '';
      effectiveModel = activeModel || settings.anthropicModel || settings.model;
      maxTokens = settings.anthropicMaxTokens;
      temperature = settings.anthropicTemperature;
      baseURL = settings.anthropicCustomUrl?.trim() || getProviderDefaults('anthropic').baseUrl;
    } else if (activeProvider === 'openai') {
      effectiveApiKey = settings.openaiApiKey || settings.apiKey || '';
      effectiveModel = activeModel || settings.openaiModel || settings.model;
      maxTokens = settings.openaiMaxTokens;
      temperature = settings.openaiTemperature;
      baseURL = settings.openaiCustomUrl?.trim() || getProviderDefaults('openai').baseUrl;
    } else if (activeProvider === 'openai-compatible') {
      effectiveApiKey = settings.openaiCompatibleApiKey || settings.apiKey || '';
      effectiveModel = activeModel || settings.openaiCompatibleModel || settings.model;
      maxTokens = settings.openaiCompatibleMaxTokens;
      temperature = settings.openaiCompatibleTemperature;
      reasoningEffort = settings.openaiCompatibleReasoningEffort;
      baseURL = settings.openaiCompatibleCustomUrl?.trim() || getProviderDefaults('openai-compatible').baseUrl;
    } else if (activeProvider === 'megallm') {
      effectiveApiKey = settings.megallmApiKey || settings.apiKey || '';
      effectiveModel = activeModel || settings.megallmModel || settings.model;
      maxTokens = settings.megallmMaxTokens;
      temperature = settings.megallmTemperature;
      reasoningEffort = settings.megallmReasoningEffort;
      baseURL = getProviderDefaults('megallm').baseUrl;
    } else if (activeProvider === 'qwen-code') {
      // Qwen Code: uses OAuth, no API key
      effectiveApiKey = '';
      effectiveModel = activeModel || settings.qwenCodeModel || settings.model;
      maxTokens = settings.qwenCodeMaxTokens;
      temperature = settings.qwenCodeTemperature;
      baseURL = getProviderDefaults('qwen-code').baseUrl;
      qwenCodeOauthPath = settings.qwenCodeOauthPath || '~/.qwen/oauth_creds.json';
    } else if (activeProvider === 'zai') {
      effectiveApiKey = settings.zaiApiKey || settings.apiKey || '';
      effectiveModel = activeModel || settings.zaiModel || settings.model;
      maxTokens = settings.zaiMaxTokens;
      temperature = settings.zaiTemperature;
      baseURL = settings.zaiCustomUrl?.trim() || getProviderDefaults('zai').baseUrl;
      zaiThinking = settings.zaiThinking;
    } else {
      // VS Code LM: no apiKey/baseURL, provider-specific model/maxTokens
      effectiveApiKey = '';
      effectiveModel = activeModel || settings.vscodeLmModel || settings.model;
      maxTokens = settings.vscodeLmMaxTokens;
      temperature = settings.vscodeLmTemperature;
      baseURL = '';
    }

    // Validate effective configuration to prevent premature failures
    if (activeProvider === 'anthropic' && !effectiveApiKey) {
      throw new Error('Anthropic API key is missing. Please configure it in the settings.');
    }
    if (activeProvider === 'openai' && !effectiveApiKey) {
      throw new Error('OpenAI API key is missing. Please configure it in the settings.');
    }
    if (activeProvider === 'zai' && !effectiveApiKey) {
      throw new Error('Z.ai API key is missing. Please configure it in the settings.');
    }
    if ((activeProvider === 'openai-compatible' || activeProvider === 'megallm' || isCustomProvider(activeProvider)) && !baseURL) {
      throw new Error('Base URL is missing for the provider. Please configure it in the settings.');
    }

    // Filter tools based on mode (plan mode gets restricted set, agent mode gets all)
    // Use locked mode if provided (for continuations), otherwise use the mode parameter
    const activeMode = lockedConfig?.mode ?? mode;
    const savedEnabledTools = settings.enabledTools;
    const hasSavedEnabledTools = Array.isArray(savedEnabledTools) && savedEnabledTools.length > 0;

    let modeTools = activeMode === 'plan'
      ? getToolsForMode('plan', true)
      : getToolsForMode(activeMode, true);

    if (activeMode === 'agent' && hasSavedEnabledTools) {
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
      reasoningEffort,
      baseURL,
      qwenCodeOauthPath,
      zaiThinking,
      enabledTools: enabledToolsForBackend,
      chatMode: activeMode,
      streamingTimeout: settings.streamingTimeout || 5000,
    }, activeProvider as Provider);

    yield* service.streamChat({ messages, signal });
  }
}

export const chatApi = new ChatApiService();

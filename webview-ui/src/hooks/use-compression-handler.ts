import { useCallback, useState, useRef } from 'react';
import type { Message, ImageAttachment } from '../types/chat';
import type { Provider } from '../types/api-settings';
import { UnifiedChatService } from '../services/unified-chat-service';
import { storageService } from '../utils/storage';
import { getProviderDefaults } from '../types/api-settings';

interface UseCompressionHandlerProps {
  messages: Message[];
  onNewChat: () => void;
  sendMessage: (content: string, attachments?: ImageAttachment[], forceEchoSearch?: boolean, overrideMessages?: Message[]) => void;
  saveCurrentSession: (messages: Message[]) => void;
}

export function useCompressionHandler({
  messages,
  onNewChat,
  sendMessage,
  saveCurrentSession,
}: UseCompressionHandlerProps) {
  const [isCompressing, setIsCompressing] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleCompressHistory = useCallback(async () => {
    if (messages.length === 0) {
      return;
    }

    // Create new abort controller for this compression
    abortControllerRef.current = new AbortController();
    setIsCompressing(true);

    try {
      const settings = storageService.getSettings();
      const contextSettings = settings.contextSettings;

      // Get compression model settings
      const compressionProvider = (contextSettings?.compressionProvider as Provider) || 'anthropic';
      const compressionModel = contextSettings?.compressionModel || '';

      if (!compressionModel) {
        throw new Error('Please configure a compression model in Context settings');
      }

      // Get provider-specific settings
      let apiKey = '';
      if (compressionProvider === 'anthropic') {
        apiKey = settings.anthropicApiKey || settings.apiKey || '';
      } else if (compressionProvider === 'openai') {
        apiKey = settings.openaiApiKey || settings.apiKey || '';
      } else if (compressionProvider === 'openai-compatible') {
        apiKey = settings.openaiCompatibleApiKey || settings.apiKey || '';
      } else if (compressionProvider === 'megallm') {
        apiKey = settings.megallmApiKey || settings.apiKey || '';
      } else if (compressionProvider === 'qwen-code') {
        apiKey = ''; // Qwen uses OAuth
      } else {
        apiKey = settings.apiKey || '';
      }
      
      if (!apiKey && compressionProvider !== 'qwen-code' && compressionProvider !== 'vscode-lm') {
        throw new Error(`API key not configured for ${compressionProvider}`);
      }

      // Get base URL
      const providerDefaults = getProviderDefaults(compressionProvider);
      const baseURL = (compressionProvider === 'anthropic' && settings.anthropicCustomUrl) ||
                     (compressionProvider === 'openai' && settings.openaiCustomUrl) ||
                     (compressionProvider === 'openai-compatible' && settings.openaiCompatibleCustomUrl) ||
                     (compressionProvider === 'megallm' && settings.megallmCustomUrl) ||
                     settings.customBaseUrl ||
                     providerDefaults.baseUrl;

      // Get max tokens - use provider-specific or default
      let maxTokens = 4096;
      if (compressionProvider === 'anthropic') {
        maxTokens = settings.anthropicMaxTokens || 4096;
      } else if (compressionProvider === 'openai') {
        maxTokens = settings.openaiMaxTokens || 4096;
      } else if (compressionProvider === 'openai-compatible') {
        maxTokens = settings.openaiCompatibleMaxTokens || 4096;
      } else if (compressionProvider === 'megallm') {
        maxTokens = settings.megallmMaxTokens || 4096;
      } else if (compressionProvider === 'vscode-lm') {
        maxTokens = settings.vscodeLmMaxTokens || 4096;
      } else if (compressionProvider === 'qwen-code') {
        maxTokens = settings.qwenCodeMaxTokens || 4096;
      }

      const temperature = 0.3; // Fixed lower temperature for compression

      // Create service instance
      const chatService = UnifiedChatService.getInstance(
        {
          apiKey,
          model: compressionModel,
          maxTokens,
          temperature,
          baseURL,
          streamingTimeout: 5000,
        },
        compressionProvider
      );

      // Compress the history with abort signal
      const compressedSummary = await chatService.compressHistory(
        messages,
        {
          provider: compressionProvider,
          model: compressionModel,
          apiKey,
          baseURL,
          maxTokens,
          temperature,
        },
        abortControllerRef.current?.signal
      );

      // Save current session before clearing
      saveCurrentSession(messages);

      // Create new chat
      onNewChat();

      // Format the compressed message
      const compressedMessage = `<compressed_history>
${compressedSummary}
</compressed_history>

This is the compressed history from the previous chat session. I understand the context and am ready to continue assisting you. Please let me know how I can help with your next task.`;

      // Send compressed message to start new chat
      // Delay needed: onNewChat() calls abortAndReset() which sets isStoppingRef=true
      // The flag resets after 100ms, so we must wait before sending
      // Pass empty array as overrideMessages to ensure fresh chat (bypasses stale closure)
      setTimeout(() => {
        sendMessage(compressedMessage, undefined, false, []);
      }, 150);

    } catch (error) {
      // Don't show error if cancelled by user
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Compression cancelled by user');
        return;
      }
      console.error('Compression error:', error);
      alert(`Failed to compress history: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      abortControllerRef.current = null;
      setIsCompressing(false);
    }
  }, [messages, onNewChat, sendMessage, saveCurrentSession]);

  const handleCancelCompression = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsCompressing(false);
    }
  }, []);

  return {
    isCompressing,
    handleCompressHistory,
    handleCancelCompression,
  };
}
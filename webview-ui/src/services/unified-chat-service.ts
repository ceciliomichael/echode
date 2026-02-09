import type { IChatService, ChatServiceConfig, StreamChatParams } from './base-chat-service';
import type { Provider } from '../types/api-settings';
import type { Message } from '../types/chat';
import { CompressionService } from './compression/compression-service';
import type { CompressionConfig } from './compression/types';

/**
 * Unified chat service that communicates with VSCode extension backend
 * All SDK logic is handled server-side to avoid CORS issues
 * Singleton pattern ensures stable request IDs and single message listener
 */
export class UnifiedChatService implements IChatService {
  private static instance: UnifiedChatService | null = null;
  private config: ChatServiceConfig;
  private provider: Provider;
  private pendingStreams = new Map<string, {
    controller: ReadableStreamDefaultController<string>;
    resolve: () => void;
    reject: (error: Error) => void;
    firstChunkTimeoutId: ReturnType<typeof setTimeout> | null;
    hasReceivedFirstChunk: boolean;
  }>();
  private messageHandler: ((event: MessageEvent) => void) | null = null;
  private compressionService: CompressionService;

  private constructor(config: ChatServiceConfig, provider: Provider = 'openai-compatible') {
    this.config = config;
    this.provider = provider;
    this.compressionService = new CompressionService(this);
    this.setupMessageListener();
  }

  /**
   * Get or create singleton instance
   */
  public static getInstance(config: ChatServiceConfig, provider: Provider = 'openai-compatible'): UnifiedChatService {
    if (!UnifiedChatService.instance) {
      UnifiedChatService.instance = new UnifiedChatService(config, provider);
    } else {
      // Update config for subsequent calls
      UnifiedChatService.instance.config = config;
      UnifiedChatService.instance.provider = provider;
    }
    return UnifiedChatService.instance;
  }

  /**
   * Reset singleton instance (useful for testing or cleanup)
   */
  public static resetInstance(): void {
    if (UnifiedChatService.instance) {
      UnifiedChatService.instance.dispose();
      UnifiedChatService.instance = null;
    }
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    if (this.messageHandler && typeof window !== 'undefined') {
      window.removeEventListener('message', this.messageHandler);
      this.messageHandler = null;
    }
    this.pendingStreams.clear();
  }

  /**
   * Set up message listener for backend responses
   */
  private setupMessageListener(): void {
    if (typeof window !== 'undefined' && window.vscode) {
      this.messageHandler = (event: MessageEvent) => {
        const message = event.data;

        const pending = this.pendingStreams.get(message.requestId);

        if (!pending) {
          return;
        }

        switch (message.type) {
          case 'chatStreamChunk': {
            // Stream chunk from backend
            if (!pending.hasReceivedFirstChunk) {
              pending.hasReceivedFirstChunk = true;
              if (pending.firstChunkTimeoutId) {
                clearTimeout(pending.firstChunkTimeoutId);
                pending.firstChunkTimeoutId = null;
              }
            }
            pending.controller.enqueue(message.chunk);
            break;
          }

          case 'chatStreamComplete': {
            // Stream complete
            if (pending.firstChunkTimeoutId) {
              clearTimeout(pending.firstChunkTimeoutId);
              pending.firstChunkTimeoutId = null;
            }
            pending.controller.close();
            pending.resolve();
            this.pendingStreams.delete(message.requestId);
            break;
          }

          case 'chatStreamError': {
            // Stream error - use controller.error() to properly propagate errors
            const error = new Error(message.error);
            if (pending.firstChunkTimeoutId) {
              clearTimeout(pending.firstChunkTimeoutId);
              pending.firstChunkTimeoutId = null;
            }
            pending.controller.error(error);
            pending.reject(error);
            this.pendingStreams.delete(message.requestId);
            break;
          }
        }
      };

      window.addEventListener('message', this.messageHandler);
    }
  }

  /**
   * Stream chat completion through VSCode extension backend
   */
  async *streamChat({ messages, signal, configOverride }: StreamChatParams): AsyncGenerator<string, void, unknown> {
    if (typeof window === 'undefined' || !window.vscode) {
      throw new Error('VSCode API not available');
    }

    // Generate a unique ID for this request to prevent collisions between multiple chat windows
    // Simple counter is not safe when multiple webviews are open
    const requestId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    // Merge config with overrides
    const effectiveConfig = {
      ...this.config,
      ...configOverride,
    };
    const effectiveProvider = configOverride?.provider || this.provider;

    const firstChunkTimeoutMs = effectiveConfig.streamingTimeout ?? 5000;

    // Create a ReadableStream for streaming chunks
    const stream = new ReadableStream<string>({
      start: (controller) => {
        const streamPromise = new Promise<void>((resolve, reject) => {
          this.pendingStreams.set(requestId, {
            controller,
            resolve,
            reject,
            firstChunkTimeoutId: null,
            hasReceivedFirstChunk: false,
          });
        });

        // Webview-side watchdog: if backend never delivers a first chunk (e.g., stuck retrying),
        // terminate so upper layers can retry and UI doesn't get stuck in loading.
        const pendingOnStart = this.pendingStreams.get(requestId);
        if (pendingOnStart) {
          pendingOnStart.firstChunkTimeoutId = setTimeout(() => {
            const pendingNow = this.pendingStreams.get(requestId);
            if (!pendingNow || pendingNow.hasReceivedFirstChunk) {
              return;
            }

            const error = new Error('No streaming data received within timeout');
            pendingNow.controller.error(error);
            pendingNow.reject(error);
            this.pendingStreams.delete(requestId);

            window.vscode.postMessage({
              type: 'chatStreamAbort',
              requestId,
            });
          }, firstChunkTimeoutMs);
        }

        // Handle abort signal
        if (signal) {
          signal.addEventListener('abort', () => {
            const pending = this.pendingStreams.get(requestId);
            if (pending) {
              if (pending.firstChunkTimeoutId) {
                clearTimeout(pending.firstChunkTimeoutId);
                pending.firstChunkTimeoutId = null;
              }
              pending.controller.close();
              this.pendingStreams.delete(requestId);
              // Notify backend to cancel stream
              window.vscode.postMessage({
                type: 'chatStreamAbort',
                requestId
              });
            }
          });
        }

        // Send request to backend
        window.vscode.postMessage({
          type: 'chatStream',
          requestId,
          sessionId: window.sessionId,
          messages,
          settings: {
            provider: effectiveProvider as Provider,
            apiKey: effectiveConfig.apiKey,
            model: effectiveConfig.model,
            maxTokens: effectiveConfig.maxTokens,
            temperature: effectiveConfig.temperature,
            reasoningEffort: effectiveConfig.reasoningEffort,
            zaiThinking: effectiveConfig.zaiThinking,
            baseURL: effectiveConfig.baseURL,
            qwenCodeOauthPath: effectiveConfig.qwenCodeOauthPath,
            enabledTools: effectiveConfig.enabledTools,
            chatMode: effectiveConfig.chatMode,
            streamingTimeout: effectiveConfig.streamingTimeout,
          }
        });

        // Wait for stream to complete or error
        streamPromise.catch(() => {
          // Error handled by message listener
        });
      }
    });

    // Create a reader and yield chunks
    const reader = stream.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        if (signal?.aborted) {
          break;
        }
        yield value;
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Compress chat history by summarizing it using the specified model
   */
  async compressHistory(
    messages: Message[],
    compressionConfig: CompressionConfig,
    signal?: AbortSignal
  ): Promise<string> {
    if (typeof window === 'undefined' || !window.vscode) {
      throw new Error('VSCode API not available');
    }

    return this.compressionService.compressHistory(messages, compressionConfig, signal);
  }

}

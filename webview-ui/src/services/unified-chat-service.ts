import type { IChatService, ChatServiceConfig, StreamChatParams } from './base-chat-service';

/**
 * Unified chat service that communicates with VSCode extension backend
 * All SDK logic is handled server-side to avoid CORS issues
 * Singleton pattern ensures stable request IDs and single message listener
 */
export class UnifiedChatService implements IChatService {
  private static instance: UnifiedChatService | null = null;
  private config: ChatServiceConfig;
  private provider: 'anthropic' | 'openai' | 'openai-compatible' | 'megallm' | 'vscode-lm' | 'qwen-code';
  private requestCounter = 0;
  private pendingStreams = new Map<number, {
    controller: ReadableStreamDefaultController<string>;
    resolve: () => void;
    reject: (error: Error) => void;
  }>();
  private messageHandler: ((event: MessageEvent) => void) | null = null;

  private constructor(config: ChatServiceConfig, provider: 'anthropic' | 'openai' | 'openai-compatible' | 'megallm' | 'vscode-lm' | 'qwen-code' = 'openai-compatible') {
    this.config = config;
    this.provider = provider;
    this.setupMessageListener();
  }

  /**
   * Get or create singleton instance
   */
  public static getInstance(config: ChatServiceConfig, provider: 'anthropic' | 'openai' | 'openai-compatible' | 'megallm' | 'vscode-lm' | 'qwen-code' = 'openai-compatible'): UnifiedChatService {
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

        // Log all chat-related messages for debugging
        if (message.type?.startsWith('chatStream')) {
          console.log('[UnifiedChatService] Received message:', message.type, 'requestId:', message.requestId);
        }

        const pending = this.pendingStreams.get(message.requestId);

        if (!pending) {
          if (message.type?.startsWith('chatStream')) {
            console.log('[UnifiedChatService] No pending stream for requestId:', message.requestId, 'pendingStreams:', Array.from(this.pendingStreams.keys()));
          }
          return;
        }

        switch (message.type) {
          case 'chatStreamChunk': {
            // Stream chunk from backend
            pending.controller.enqueue(message.chunk);
            break;
          }

          case 'chatStreamComplete': {
            // Stream complete
            console.log('[UnifiedChatService] Stream complete for requestId:', message.requestId);
            pending.controller.close();
            pending.resolve();
            this.pendingStreams.delete(message.requestId);
            break;
          }

          case 'chatStreamError': {
            // Stream error - use controller.error() to properly propagate errors
            console.log('[UnifiedChatService] Stream error for requestId:', message.requestId, 'error:', message.error);
            const error = new Error(message.error);
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
  async *streamChat({ messages, signal }: StreamChatParams): AsyncGenerator<string, void, unknown> {
    console.log('[UnifiedChatService] streamChat called with', messages.length, 'messages');

    if (typeof window === 'undefined' || !window.vscode) {
      throw new Error('VSCode API not available');
    }

    const requestId = ++this.requestCounter;
    console.log('[UnifiedChatService] Created requestId:', requestId);

    // Create a ReadableStream for streaming chunks
    const stream = new ReadableStream<string>({
      start: (controller) => {
        const streamPromise = new Promise<void>((resolve, reject) => {
          this.pendingStreams.set(requestId, {
            controller,
            resolve,
            reject
          });
        });

        // Handle abort signal
        if (signal) {
          signal.addEventListener('abort', () => {
            const pending = this.pendingStreams.get(requestId);
            if (pending) {
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
        console.log('[UnifiedChatService] Sending chatStream request to backend, requestId:', requestId);
        window.vscode.postMessage({
          type: 'chatStream',
          requestId,
          messages,
          settings: {
            provider: this.provider,
            apiKey: this.config.apiKey,
            model: this.config.model,
            maxTokens: this.config.maxTokens,
            temperature: this.config.temperature,
            baseURL: this.config.baseURL,
            qwenCodeOauthPath: this.config.qwenCodeOauthPath,
            enabledTools: this.config.enabledTools,
            chatMode: this.config.chatMode,
            streamingTimeout: this.config.streamingTimeout,
          }
        });
        console.log('[UnifiedChatService] chatStream request sent');

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

}

import type { ChatMessage } from '../types/chat-api';
import { storageService } from '../utils/storage';
import { PROVIDER_DEFAULTS } from '../types/api-settings';
import { AnthropicService } from './anthropic-service';
import { OpenAIService } from './openai-service';
import { OpenAICompatibleService } from './openai-compatible-service';

// ProxyFetch class preserved for potential future VSCode extension communication
// @ts-expect-error - ProxyFetch kept for future use
// eslint-disable-next-line @typescript-eslint/no-unused-vars
class ProxyFetch {
  private requestCounter = 0;
  private pendingRequests = new Map<number, {
    resolve: (value: Response) => void;
    reject: (reason: Error) => void;
    controller: ReadableStreamDefaultController<Uint8Array>;
    status?: number;
    statusText?: string;
    timeoutId: ReturnType<typeof setTimeout>;
    lastActivityTime: number;
  }>();

  constructor() {
    if (typeof window !== 'undefined' && window.vscode) {
      window.addEventListener('message', (event) => {
        const message = event.data;
        const pending = this.pendingRequests.get(message.requestId);
        
        if (!pending) {return;}

        // Update last activity time on any message
        pending.lastActivityTime = Date.now();

        switch (message.type) {
          case 'apiStreamChunk': {
            // Stream chunk immediately in real-time
            const encoder = new TextEncoder();
            pending.controller.enqueue(encoder.encode(message.chunk));
            break;
          }
          
          case 'apiResponse':
            // Store status for creating the Response
            pending.status = message.status;
            pending.statusText = message.statusText;
            pending.controller.close();
            clearTimeout(pending.timeoutId);
            this.pendingRequests.delete(message.requestId);
            break;
          
          case 'apiError':
            clearTimeout(pending.timeoutId);
            pending.reject(new Error(message.error));
            this.pendingRequests.delete(message.requestId);
            break;
        }
      });
    }
  }

  async fetch(url: string, options: RequestInit): Promise<Response> {
    if (typeof window === 'undefined' || !window.vscode) {
      return fetch(url, options);
    }

    const requestId = ++this.requestCounter;
    const signal = options.signal as AbortSignal | undefined;

    return new Promise((resolve, reject) => {
      let streamController: ReadableStreamDefaultController<Uint8Array>;
      const responseStatus = 200;
      const responseStatusText = 'OK';

      // Create a ReadableStream for real-time streaming
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          streamController = controller;
        }
      });

      // Set up inactivity timeout (triggers only if no chunks received for 30 seconds)
      const timeoutId = setTimeout(() => {
        const pending = this.pendingRequests.get(requestId);
        if (pending) {
          const timeSinceLastActivity = Date.now() - pending.lastActivityTime;
          if (timeSinceLastActivity >= 30000) {
            this.pendingRequests.delete(requestId);
            reject(new Error('Request timeout after 30 seconds of inactivity'));
          }
        }
      }, 30000);

      this.pendingRequests.set(requestId, {
        resolve: (response: Response) => resolve(response),
        reject,
        controller: streamController!,
        timeoutId,
        lastActivityTime: Date.now()
      });
      
      // Handle abort signal
      if (signal) {
        signal.addEventListener('abort', () => {
          const pending = this.pendingRequests.get(requestId);
          if (pending) {
            clearTimeout(pending.timeoutId);
            pending.controller.close();
            this.pendingRequests.delete(requestId);
            // Notify extension to cancel request
            window.vscode.postMessage({
              type: 'apiCancel',
              requestId
            });
          }
        });
      }

      // Resolve with the streaming Response immediately
      const response = new Response(stream, {
        status: responseStatus,
        statusText: responseStatusText,
      });
      resolve(response);

      window.vscode.postMessage({
        type: 'apiRequest',
        requestId,
        url,
        options: {
          method: options.method,
          headers: options.headers,
          body: options.body
        }
      });
    });
  }
}


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

    // Route to appropriate service based on provider
    if (settings.provider === 'anthropic') {
      const baseURL = settings.anthropicCustomUrl?.trim() || PROVIDER_DEFAULTS.anthropic.baseUrl;
      const service = new AnthropicService({
        apiKey: settings.apiKey,
        model: settings.model,
        maxTokens,
        baseURL,
      });
      yield* service.streamChat({ messages, signal });
    } else if (settings.provider === 'openai') {
      const baseURL = settings.openaiCustomUrl?.trim() || PROVIDER_DEFAULTS.openai.baseUrl;
      const service = new OpenAIService({
        apiKey: settings.apiKey,
        model: settings.model,
        maxTokens,
        baseURL,
      });
      yield* service.streamChat({ messages, signal });
    } else if (settings.provider === 'openai-compatible') {
      const baseURL = settings.openaiCompatibleCustomUrl?.trim() || PROVIDER_DEFAULTS['openai-compatible'].baseUrl;
      const service = new OpenAICompatibleService({
        apiKey: settings.apiKey,
        model: settings.model,
        maxTokens,
        baseURL,
      });
      yield* service.streamChat({ messages, signal });
    }
  }
}

export const chatApi = new ChatApiService();

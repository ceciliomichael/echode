import type { ChatMessage, StreamChunk, ChatCompletionRequest } from '../types/chat-api';
import { storageService } from '../utils/storage';

class ProxyFetch {
  private requestCounter = 0;
  private pendingRequests = new Map<number, {
    resolve: (value: Response) => void;
    reject: (reason: Error) => void;
    controller: ReadableStreamDefaultController<Uint8Array>;
    status?: number;
    statusText?: string;
    timeoutId: number;
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

const proxyFetch = new ProxyFetch();

export class ChatApiService {
  async *streamChat(messages: ChatMessage[], signal?: AbortSignal): AsyncGenerator<string, void, unknown> {
    const settings = storageService.getSettings();

    if (!settings.baseUrl || !settings.apiKey || !settings.model) {
      throw new Error('API configuration not available. Please configure your API settings in the header settings.');
    }

    // Normalize base URL so values like "localhost:1234/v1" work without scheme
    const rawBaseUrl = settings.baseUrl.trim();
    let baseUrl = rawBaseUrl;

    if (!/^https?:\/\//i.test(rawBaseUrl)) {
      if (
        rawBaseUrl.startsWith('localhost') ||
        rawBaseUrl.startsWith('127.0.0.1') ||
        rawBaseUrl.startsWith('0.0.0.0')
      ) {
        baseUrl = `http://${rawBaseUrl}`;
      } else {
        baseUrl = `https://${rawBaseUrl}`;
      }
    }

    // Ensure we don't end up with double slashes before /chat/completions
    const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
    const endpoint = `${normalizedBaseUrl}/chat/completions`;

    console.log('[Echode API] Connecting to:', endpoint);
    console.log('[Echode API] Model:', settings.model);
    console.log('[Echode API] Using proxy:', typeof window !== 'undefined' && window.vscode ? 'Yes' : 'No');

    let response: Response;
    
    try {
      response = await proxyFetch.fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey}`,
        },
        body: JSON.stringify({
          model: settings.model,
          messages,
          stream: true,
          temperature: 0.7,
          max_tokens: settings.maxTokens || 2048,
        } as ChatCompletionRequest),
        signal,
      });
      
      console.log('[Echode API] Response status:', response.status);
    } catch (error) {
      console.error('[Echode API] Request failed:', error);
      if (error instanceof TypeError) {
        throw new Error(`Network error: Unable to connect to ${normalizedBaseUrl}. Please check your Base URL and connection.`);
      }
      throw new Error(`Failed to fetch: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    if (!response.ok) {
      let errorMessage = `API request failed: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        console.error('[Echode API] Error response:', errorData);
        if (errorData.error?.message) {
          errorMessage += ` - ${errorData.error.message}`;
        }
      } catch {
        // Ignore JSON parse errors
      }
      throw new Error(errorMessage);
    }

    console.log('[Echode API] Starting stream...');

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let totalChunks = 0;
    let contentChunks = 0;

    try {
      while (true) {
        // Check if aborted before reading
        if (signal?.aborted) {
          console.log('[Echode API] Stream aborted by user');
          break;
        }
        
        const { done, value } = await reader.read();
        if (done) {
          console.log('[Echode API] Stream done. Total chunks:', totalChunks, 'Content chunks:', contentChunks);
          
          // Check if we got an error response instead of streaming data
          if (buffer.length > 0 && contentChunks === 0) {
            console.log('[Echode API] No content chunks received. Checking for error response...');
            try {
              const errorData = JSON.parse(buffer);
              if (errorData.error) {
                const errorMsg = errorData.message || errorData.error;
                throw new Error(`API Error: ${errorMsg}`);
              }
            } catch (e) {
              if (e instanceof SyntaxError) {
                console.log('[Echode API] Remaining buffer (not JSON):', buffer.substring(0, 200));
              } else {
                throw e;
              }
            }
          }
          break;
        }

        totalChunks++;
        const decodedChunk = decoder.decode(value, { stream: true });
        
        buffer += decodedChunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || trimmedLine === 'data: [DONE]') {continue;}
          if (!trimmedLine.startsWith('data: ')) {continue;}

          try {
            const jsonStr = trimmedLine.slice(6);
            const data = JSON.parse(jsonStr) as StreamChunk;
            const content = data.choices[0]?.delta?.content;
            
            if (content) {
              contentChunks++;
              yield content;
            }
          } catch (e) {
            console.warn('[Echode API] Failed to parse SSE line:', e);
            continue;
          }
        }
      }
    } finally {
      // Cancel reader if aborted to clean up resources
      if (signal?.aborted) {
        try {
          await reader.cancel();
        } catch (e) {
          // Ignore cancel errors
        }
      }
      reader.releaseLock();
    }
  }
}

export const chatApi = new ChatApiService();

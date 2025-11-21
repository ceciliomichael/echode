import * as vscode from 'vscode';
import { ILLMProvider, ChatMessage, ChatStreamSettings } from './llm-provider.interface';

export class OpenAICompatibleProvider implements ILLMProvider {
  async streamChat(
    requestId: number,
    messages: ChatMessage[],
    settings: ChatStreamSettings,
    webview: vscode.WebviewView | vscode.WebviewPanel,
    signal: AbortSignal
  ): Promise<void> {
    // Ensure baseURL ends with /v1/chat/completions or simply append /chat/completions if it already has v1
    // Typically OpenAI-compatible input is "http://localhost:1234/v1", we need "http://localhost:1234/v1/chat/completions"
    const baseURL = settings.baseURL.endsWith('/') ? settings.baseURL.slice(0, -1) : settings.baseURL;
    const url = `${baseURL}/v1/chat/completions`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey}`,
        },
        body: JSON.stringify({
          model: settings.model,
          messages: messages.map(m => ({
            role: m.role,
            content: m.content
          })),
          max_tokens: settings.maxTokens,
          temperature: 0.7,
          stream: true,
        }),
        signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error ${response.status}: ${errorText}`);
      }

      if (!response.body) {
        throw new Error('Response body is empty');
      }

      // Process the stream manually
      // @ts-ignore - response.body is a ReadableStream in Node 18+ envs in VSCode
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }
        
        if (signal.aborted) {
          reader.cancel();
          break;
        }
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Keep the last potentially incomplete line in the buffer
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) {continue;}
          if (trimmedLine.startsWith(':')) {continue;}
          if (trimmedLine === 'data: [DONE]') {continue;}
          
          if (trimmedLine.startsWith('data: ')) {
            let data = trimmedLine.slice(6);
            // Handle double 'data: ' prefix (e.g., "data: data: {...}")
            while (data.startsWith('data: ')) {
              data = data.slice(6);
            }
            // Skip [DONE] signal after prefix stripping
            if (data === '[DONE]') {continue;}
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                webview.webview.postMessage({
                  type: 'chatStreamChunk',
                  requestId,
                  chunk: content
                });
              }
            } catch (e) {
              console.warn('Failed to parse chunk:', trimmedLine, e);
            }
          }
        }
      }
      
      // Process any remaining buffer content
      if (buffer.trim()) {
          const line = buffer.trim();
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
               let data = line.slice(6);
               // Handle double 'data: ' prefix (e.g., "data: data: {...}")
               while (data.startsWith('data: ')) {
                 data = data.slice(6);
               }
               // Skip [DONE] signal after prefix stripping
               if (data !== '[DONE]') {
                 try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices?.[0]?.delta?.content;
                    if (content) {
                        webview.webview.postMessage({
                            type: 'chatStreamChunk',
                            requestId,
                            chunk: content
                        });
                    }
                 } catch (e) {
                     console.warn('Failed to parse remaining buffer:', line, e);
                 }
               }
          }
      }
      
      // Signal completion
      if (!signal.aborted) {
        webview.webview.postMessage({
          type: 'chatStreamComplete',
          requestId
        });
      }
      
    } catch (error) {
      if (signal.aborted) {
        return;
      }
      throw new Error(`OpenAI Compatible API Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

import * as vscode from 'vscode';
import OpenAI from 'openai';
import { ILLMProvider, ChatMessage, ChatStreamSettings } from './llm-provider.interface';

export class OpenAICompatibleProvider implements ILLMProvider {
  async streamChat(
    requestId: number,
    messages: ChatMessage[],
    settings: ChatStreamSettings,
    webview: vscode.WebviewView | vscode.WebviewPanel,
    signal: AbortSignal
  ): Promise<void> {
    // Add /v1 to baseURL for OpenAI-compatible APIs
    const baseURL = `${settings.baseURL}/v1`;
    
    const client = new OpenAI({
      apiKey: settings.apiKey,
      baseURL,
    });

    // Track stream state to handle late errors gracefully
    let hasReceivedContent = false;
    let hasFinishReason = false;

    try {
      const stream = await client.chat.completions.create({
        model: settings.model,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content
        })) as OpenAI.ChatCompletionMessageParam[],
        max_tokens: settings.maxTokens,
        temperature: settings.temperature ?? 0.7,
        stream: true,
      });

      for await (const chunk of stream) {
        // Check for abort
        if (signal.aborted) {
          break;
        }
        
        // Check for finish_reason indicating stream completion
        const finishReason = chunk.choices[0]?.finish_reason;
        if (finishReason) {
          hasFinishReason = true;
        }
        
        // Extract content from delta - OpenAI-compatible APIs send deltas, not cumulative
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          hasReceivedContent = true;
          webview.webview.postMessage({
            type: 'chatStreamChunk',
            requestId,
            chunk: content
          });
        }
      }

      // Signal completion only if not aborted
      if (!signal.aborted) {
        webview.webview.postMessage({
          type: 'chatStreamComplete',
          requestId
        });
      }
    } catch (error) {
      if (signal.aborted) {
        // Stream was aborted, don't throw
        return;
      }
      
      // If we received content and/or a finish signal, treat late errors as non-fatal
      // Many OpenAI-compatible servers report errors like HTTP 5xx or "terminated" after
      // successfully delivering the streamed content.
      if (hasReceivedContent || hasFinishReason) {
        webview.webview.postMessage({
          type: 'chatStreamComplete',
          requestId
        });
        return;
      }
      
      throw new Error(`OpenAI Compatible API Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

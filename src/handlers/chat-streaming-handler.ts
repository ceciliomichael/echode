import * as vscode from 'vscode';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

interface ChatMessage {
  role: string;
  content: string;
}

interface ChatStreamRequest {
  requestId: number;
  messages: ChatMessage[];
  settings: {
    provider: 'anthropic' | 'openai' | 'openai-compatible';
    apiKey: string;
    model: string;
    maxTokens: number;
    baseURL: string;
  };
}

// Registry to track active streams for cancellation
const activeStreams = new Map<number, AbortController>();

/**
 * Handle chat streaming requests from webview through backend SDKs
 */
export async function handleChatStream(
  data: unknown,
  webview: vscode.WebviewView | vscode.WebviewPanel
): Promise<void> {
  const request = data as ChatStreamRequest;
  const { requestId, messages, settings } = request;

  // Handle abort request
  if ((data as any).type === 'chatStreamAbort') {
    const controller = activeStreams.get(requestId);
    if (controller) {
      controller.abort();
      activeStreams.delete(requestId);
    }
    return;
  }

  // Create abort controller for this stream
  const abortController = new AbortController();
  activeStreams.set(requestId, abortController);

  try {
    // Route to appropriate provider
    if (settings.provider === 'anthropic') {
      await streamAnthropicChat(requestId, messages, settings, webview, abortController.signal);
    } else if (settings.provider === 'openai' || settings.provider === 'openai-compatible') {
      await streamOpenAIChat(requestId, messages, settings, webview, abortController.signal);
    } else {
      throw new Error(`Unknown provider: ${settings.provider}`);
    }
  } catch (error) {
    // Only send error if not aborted
    if (error instanceof Error && error.name !== 'AbortError') {
      webview.webview.postMessage({
        type: 'chatStreamError',
        requestId,
        error: error.message
      });
    }
  } finally {
    // Clean up
    activeStreams.delete(requestId);
  }
}

/**
 * Stream chat using Anthropic SDK
 */
async function streamAnthropicChat(
  requestId: number,
  messages: ChatMessage[],
  settings: ChatStreamRequest['settings'],
  webview: vscode.WebviewView | vscode.WebviewPanel,
  signal: AbortSignal
): Promise<void> {
  const client = new Anthropic({
    apiKey: settings.apiKey,
    baseURL: settings.baseURL,
  });

  // Separate system message from conversation messages
  const systemMessage = messages.find(m => m.role === 'system');
  const conversationMessages = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content
    }));

  try {
    const stream = await client.messages.create({
      model: settings.model,
      max_tokens: settings.maxTokens,
      messages: conversationMessages,
      system: systemMessage?.content,
      stream: true,
    });

    for await (const event of stream) {
      // Check for abort
      if (signal.aborted) {
        break;
      }
      
      // Extract text deltas from content blocks
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        webview.webview.postMessage({
          type: 'chatStreamChunk',
          requestId,
          chunk: event.delta.text
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
    throw new Error(`Anthropic API Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Stream chat using OpenAI SDK (supports OpenAI and OpenAI-compatible APIs)
 */
async function streamOpenAIChat(
  requestId: number,
  messages: ChatMessage[],
  settings: ChatStreamRequest['settings'],
  webview: vscode.WebviewView | vscode.WebviewPanel,
  signal: AbortSignal
): Promise<void> {
  // Add /v1 to baseURL for OpenAI-compatible APIs
  const baseURL = `${settings.baseURL}/v1`;
  
  const client = new OpenAI({
    apiKey: settings.apiKey,
    baseURL,
  });

  try {
    const stream = await client.chat.completions.create({
      model: settings.model,
      messages: messages.map(m => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content
      })),
      max_tokens: settings.maxTokens,
      temperature: 0.7,
      stream: true,
    });

    for await (const chunk of stream) {
      // Check for abort
      if (signal.aborted) {
        break;
      }
      
      // Extract content from delta
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
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
    throw new Error(`OpenAI API Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

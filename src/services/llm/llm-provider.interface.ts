import * as vscode from 'vscode';

export interface ChatMessageContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
  };
}

export interface ChatMessage {
  role: string;
  content: string | ChatMessageContent[];
}

export interface ChatStreamSettings {
  provider: 'anthropic' | 'openai' | 'openai-compatible' | 'megallm' | 'vscode-lm' | 'qwen-code';
  apiKey: string;
  model: string;
  maxTokens: number;
  baseURL: string;
  temperature?: number;
  reasoningEffort?: string;
  qwenCodeOauthPath?: string;
  enabledTools?: Array<{ id: string; enabled: boolean }>;
  /** Current chat mode for mode-specific behavior */
  chatMode?: 'agent' | 'plan' | 'ask' | 'general' | 'chat';
  /** Timeout in ms before retry if no streaming data received (default: 10000) */
  streamingTimeout?: number;
}

export interface ILLMProvider {
  streamChat(
    requestId: number,
    messages: ChatMessage[],
    settings: ChatStreamSettings,
    webview: vscode.WebviewView | vscode.WebviewPanel,
    signal: AbortSignal
  ): Promise<void>;
}

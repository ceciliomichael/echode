import * as vscode from 'vscode';

export interface ChatMessage {
  role: string;
  content: string;
}

export interface ChatStreamSettings {
  provider: 'anthropic' | 'openai' | 'openai-compatible' | 'vscode-lm';
  apiKey: string;
  model: string;
  maxTokens: number;
  baseURL: string;
  temperature?: number;
  enabledTools?: Array<{ id: string; enabled: boolean }>;
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

import * as vscode from 'vscode';

export interface ChatMessage {
  role: string;
  content: string;
}

export interface ChatStreamSettings {
  provider: 'anthropic' | 'openai' | 'openai-compatible';
  apiKey: string;
  model: string;
  maxTokens: number;
  baseURL: string;
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

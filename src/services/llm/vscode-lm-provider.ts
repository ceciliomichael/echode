import * as vscode from 'vscode';
import { ILLMProvider, ChatMessage, ChatStreamSettings } from './llm-provider.interface';

export class VSCodeLMProvider implements ILLMProvider {
  async streamChat(
    requestId: number,
    messages: ChatMessage[],
    settings: ChatStreamSettings,
    webview: vscode.WebviewView | vscode.WebviewPanel,
    signal: AbortSignal
  ): Promise<void> {
    try {
      // Select the language model based on the model name from settings
      const modelFamily = this.getModelFamily(settings.model);
      
      const models = await vscode.lm.selectChatModels({
        vendor: 'copilot',
        family: modelFamily,
      });

      if (models.length === 0) {
        throw new Error('No VS Code language models available. Please ensure GitHub Copilot is enabled.');
      }

      const [model] = models;

      // Convert messages to LanguageModelChatMessage format
      const chatMessages = messages.map(msg => {
        // Extract text content (VS Code LM API doesn't support images yet)
        let textContent: string;
        if (typeof msg.content === 'string') {
          textContent = msg.content;
        } else {
          // Extract text from multimodal content
          textContent = msg.content
            .filter(c => c.type === 'text' && c.text)
            .map(c => c.text)
            .join('\n') || '';
        }
        
        if (msg.role === 'system') {
          return vscode.LanguageModelChatMessage.User(textContent);
        } else if (msg.role === 'user') {
          return vscode.LanguageModelChatMessage.User(textContent);
        } else {
          return vscode.LanguageModelChatMessage.Assistant(textContent);
        }
      });

      // Create cancellation token from abort signal
      const tokenSource = new vscode.CancellationTokenSource();
      signal.addEventListener('abort', () => tokenSource.cancel());

      // Send request to the language model
      const request = await model.sendRequest(
        chatMessages,
        {
          justification: 'Echode AI Assistant is generating a response to your query.',
        },
        tokenSource.token
      );

      // Stream the response
      for await (const fragment of request.text) {
        if (signal.aborted) {
          break;
        }

        webview.webview.postMessage({
          type: 'chatStreamChunk',
          requestId,
          chunk: fragment,
        });
      }

      // Signal completion if not aborted
      if (!signal.aborted) {
        webview.webview.postMessage({
          type: 'chatStreamComplete',
          requestId,
        });
      }

      // Clean up
      tokenSource.dispose();
    } catch (error) {
      if (signal.aborted) {
        return;
      }

      // Handle VS Code Language Model specific errors
      if (error instanceof vscode.LanguageModelError) {
        const errorMessage = this.formatLanguageModelError(error);
        throw new Error(errorMessage);
      }

      throw new Error(
        `VS Code LM Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Extract model family from model name
   * Examples: "gpt-4o", "gpt-4o-mini", "claude-3.5-sonnet", "o1", "o1-mini"
   */
  private getModelFamily(modelName: string): string {
    // Return the model name as-is since it should already be the family name
    return modelName;
  }

  /**
   * Format LanguageModelError into user-friendly message
   */
  private formatLanguageModelError(error: vscode.LanguageModelError): string {
    switch (error.code) {
      case vscode.LanguageModelError.NotFound().code:
        return 'The requested language model was not found. Please check your VS Code and GitHub Copilot setup.';
      case vscode.LanguageModelError.NoPermissions().code:
        return 'Permission denied to use the language model. Please grant access to GitHub Copilot when prompted.';
      case vscode.LanguageModelError.Blocked().code:
        return 'The request was blocked. This may be due to content policy restrictions.';
      default:
        return `VS Code Language Model Error: ${error.message}`;
    }
  }
}

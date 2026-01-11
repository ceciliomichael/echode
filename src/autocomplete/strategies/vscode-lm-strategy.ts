/**
 * VS Code LM Completion Strategy
 * Handles completions using VS Code's Language Model API (GitHub Copilot)
 */

import * as vscode from 'vscode';
import { ICompletionStrategy, AutocompleteConfig } from './types';

export class VSCodeLMCompletionStrategy implements ICompletionStrategy {
  async generateCompletion(
    userPrompt: string,
    systemPrompt: string,
    config: AutocompleteConfig,
    signal: AbortSignal
  ): Promise<string | null> {
    try {
      // Select the language model based on the model name from settings
      const modelFamily = config.model || 'gpt-4o';

      const models = await vscode.lm.selectChatModels({
        vendor: 'copilot',
        family: modelFamily,
      });

      if (models.length === 0) {
        console.warn('[VSCodeLMCompletionStrategy] No VS Code language models available');
        return null;
      }

      const [model] = models;

      // VS Code LM doesn't have a true "system" role, so we combine prompts
      // The system prompt is prepended to the user prompt
      const combinedPrompt = `${systemPrompt}\n\n${userPrompt}`;

      const chatMessages = [
        vscode.LanguageModelChatMessage.User(combinedPrompt),
      ];

      // Create cancellation token from abort signal
      const tokenSource = new vscode.CancellationTokenSource();
      signal.addEventListener('abort', () => tokenSource.cancel());

      try {
        const request = await model.sendRequest(
          chatMessages,
          {
            justification: 'EchoDE Autocomplete is generating code completion.',
          },
          tokenSource.token
        );

        // Collect the full response
        let fullContent = '';
        for await (const fragment of request.text) {
          if (signal.aborted) {
            break;
          }
          fullContent += fragment;
        }

        tokenSource.dispose();
        return fullContent || null;
      } catch (error) {
        tokenSource.dispose();

        if (signal.aborted) {
          return null;
        }

        // Handle VS Code Language Model specific errors
        if (error instanceof vscode.LanguageModelError) {
          console.warn('[VSCodeLMCompletionStrategy] LM Error:', this.formatLanguageModelError(error));
          return null;
        }

        throw error;
      }
    } catch (error: unknown) {
      if (signal.aborted) {
        return null;
      }

      console.error('[VSCodeLMCompletionStrategy] Error:', error);
      return null;
    }
  }

  private formatLanguageModelError(error: vscode.LanguageModelError): string {
    switch (error.code) {
      case vscode.LanguageModelError.NotFound().code:
        return 'The requested language model was not found.';
      case vscode.LanguageModelError.NoPermissions().code:
        return 'Permission denied to use the language model.';
      case vscode.LanguageModelError.Blocked().code:
        return 'The request was blocked by content policy.';
      default:
        return error.message;
    }
  }

  dispose(): void {
    // No cleanup needed
  }
}
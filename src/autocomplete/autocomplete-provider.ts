import * as vscode from 'vscode';
import { AutocompleteConfig, ICompletionStrategy, createCompletionStrategy } from './strategies';

// Re-export config for backward compatibility
export { AutocompleteConfig } from './strategies';

// Simple, direct system prompt
const SYSTEM_PROMPT = `You are a code completion engine. Output ONLY the text to INSERT at the cursor position.

RULES:
1. Output ONLY what should be inserted - no markdown, no explanations
2. Complete the word/expression from where the cursor is
3. Include any remaining text that should come after

EXAMPLES:
Before cursor: "console.lo"  After cursor: ""
Output: g()

Before cursor: "print("Hel"  After cursor: ", World!")"
Output: lo

Before cursor: "const x = arr.filt"  After cursor: ""
Output: er((item) => item)

Before cursor: "if (x"  After cursor: ") {"
Output:  > 0

Output ONLY the insertion text.`;

/**
 * Providers that don't require an API key
 */
const KEYLESS_PROVIDERS = ['qwen-code', 'vscode-lm'];

export class AutocompleteProvider implements vscode.InlineCompletionItemProvider {
  private config: AutocompleteConfig | null = null;
  private strategy: ICompletionStrategy | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private lastRequest: AbortController | null = null;

  updateConfig(config: AutocompleteConfig): void {
    // Check if provider changed - need new strategy
    const providerChanged = this.config?.provider !== config.provider;
    
    this.config = config;

    // Create or recreate strategy if provider changed
    if (providerChanged || !this.strategy) {
      this.strategy?.dispose?.();
      this.strategy = createCompletionStrategy(config);
    }
  }

  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionItem[] | vscode.InlineCompletionList | null> {
    if (!this.config?.enabled || !this.config.model) {
      return null;
    }

    // Check if API key is required for this provider
    const needsApiKey = !KEYLESS_PROVIDERS.includes(this.config.provider);
    if (needsApiKey && !this.config.apiKey) {
      return null;
    }

    if (!this.strategy) {
      return null;
    }

    if (this.shouldSkipCompletion(document, position)) {
      return null;
    }

    // Cancel any pending request
    if (this.lastRequest) {
      this.lastRequest.abort();
    }

    // Clear existing debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Wait for debounce
    await new Promise<void>((resolve) => {
      this.debounceTimer = setTimeout(resolve, this.config?.debounceMs || 150);
    });

    if (token.isCancellationRequested) {
      return null;
    }

    try {
      const completion = await this.getCompletion(document, position, token);
      if (!completion || token.isCancellationRequested) {
        return null;
      }

      const line = document.lineAt(position.line);
      const endPosition = line.range.end;

      return [
        new vscode.InlineCompletionItem(
          completion,
          new vscode.Range(position, endPosition)
        )
      ];
    } catch (_error) {
      // Silently handle aborted requests (normal when user keeps typing)
      return null;
    }
  }

  private shouldSkipCompletion(document: vscode.TextDocument, position: vscode.Position): boolean {
    const line = document.lineAt(position.line).text;

    // Only skip completely empty lines with cursor at start
    if (line.trim() === '' && position.character === 0) {
      return true;
    }

    // Never skip - let the model decide what to do
    return false;
  }

  private async getCompletion(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<string | null> {
    if (!this.config || !this.strategy) {
      return null;
    }

    // Build context and prompt
    const context = this.buildContext(document, position);
    const userPrompt = this.buildPrompt(document, position, context);

    this.lastRequest = new AbortController();

    try {
      // Delegate to strategy
      const content = await this.strategy.generateCompletion(
        userPrompt,
        SYSTEM_PROMPT,
        this.config,
        this.lastRequest.signal
      );

      if (token.isCancellationRequested || !content) {
        return null;
      }

      // Clean and validate the completion
      const cleaned = this.cleanCompletion(content, document, position);
      return cleaned;
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        return null;
      }
      throw error;
    }
  }

  private buildContext(document: vscode.TextDocument, position: vscode.Position): {
    fileStructure: string;
    immediatePrefix: string;
    immediateSuffix: string;
    currentLine: string;
    cursorCol: number;
  } {
    const fullText = document.getText();
    const lines = fullText.split('\n');
    const currentLine = lines[position.line] || '';
    
    // Extract file structure (imports, function/class signatures)
    const structureLines: string[] = [];
    for (let i = 0; i < Math.min(lines.length, 30); i++) {
      const line = lines[i];
      if (
        line.trim().startsWith('import ') ||
        line.trim().startsWith('from ') ||
        line.trim().startsWith('export ') ||
        line.trim().startsWith('class ') ||
        line.trim().startsWith('interface ') ||
        line.trim().startsWith('type ') ||
        line.trim().startsWith('function ') ||
        line.trim().startsWith('const ') ||
        line.trim().startsWith('def ') ||
        line.trim().startsWith('async ')
      ) {
        structureLines.push(line);
      }
    }

    // Immediate prefix (lines before cursor, not including current line)
    const prefixStart = Math.max(0, position.line - 15);
    const prefixLines = lines.slice(prefixStart, position.line);
    const immediatePrefix = prefixLines.join('\n');

    // Immediate suffix (lines after current line)
    const suffixEnd = Math.min(lines.length, position.line + 5);
    const suffixLines = lines.slice(position.line + 1, suffixEnd);
    const immediateSuffix = suffixLines.join('\n');

    return {
      fileStructure: structureLines.join('\n'),
      immediatePrefix,
      immediateSuffix,
      currentLine,
      cursorCol: position.character,
    };
  }

  private buildPrompt(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: { fileStructure: string; immediatePrefix: string; immediateSuffix: string; currentLine: string; cursorCol: number }
  ): string {
    const languageId = document.languageId;
    const lineBefore = context.currentLine.substring(0, context.cursorCol);
    const lineAfter = context.currentLine.substring(context.cursorCol);
    
    // Add relevant context (last 3 lines)
    const contextLines = context.immediatePrefix.split('\n').slice(-3);
    
    let prompt = `Language: ${languageId}\n`;
    
    if (contextLines.length > 0 && contextLines.some(l => l.trim())) {
      prompt += `Context:\n${contextLines.join('\n')}\n\n`;
    }
    
    prompt += `Before cursor: "${lineBefore}"\n`;
    prompt += `After cursor: "${lineAfter}"\n`;
    prompt += `\nWhat text should be INSERTED at the cursor? Output only the insertion:`;
    
    return prompt;
  }

  private cleanCompletion(
    raw: string,
    document: vscode.TextDocument,
    position: vscode.Position
  ): string | null {
    let completion = raw.trim();

    // Remove markdown code blocks
    completion = completion.replace(/```[\w]*\n?/g, '').replace(/```/g, '').trim();

    // Remove common LLM prefixes
    completion = completion
      .replace(/^["'`]+|["'`]+$/g, '')
      .replace(/^\s*Output:\s*/i, '')
      .replace(/^(Here's|Here is|The completion|Completion:).*/im, '')
      .trim();

    // Take only the first line
    const lines = completion.split('\n');
    completion = lines[0] || '';
    
    if (!completion.trim() && lines.length > 1) {
      completion = lines.find(l => l.trim()) || '';
    }

    // Must have content
    if (!completion) {
      return null;
    }

    // Get what's after cursor - we need to handle overlap
    const line = document.lineAt(position.line).text;
    const suffix = line.substring(position.character);
    
    // If completion includes the suffix, we need to append it since we're replacing to EOL
    // But if completion doesn't include it, append the suffix
    if (suffix && !completion.endsWith(suffix) && !completion.includes(suffix)) {
      completion = completion + suffix;
    }
    
    // Remove duplicate suffix if model included it
    if (suffix && completion.endsWith(suffix + suffix)) {
      completion = completion.substring(0, completion.length - suffix.length);
    }

    return completion;
  }

  dispose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    if (this.lastRequest) {
      this.lastRequest.abort();
    }
    this.strategy?.dispose?.();
  }
}
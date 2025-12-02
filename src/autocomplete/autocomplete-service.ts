import * as vscode from 'vscode';
import { AutocompleteProvider, AutocompleteConfig } from './autocomplete-provider';

interface AutocompleteSettings {
  enabled: boolean;
  provider: string;
  model: string;
  debounceMs: number;
  maxTokens: number;
  temperature: number;
}

interface ApiSettings {
  provider: string;
  apiKey: string;
  anthropicApiKey?: string;
  openaiApiKey?: string;
  openaiCompatibleApiKey?: string;
  megallmApiKey?: string;
  anthropicCustomUrl?: string;
  openaiCustomUrl?: string;
  openaiCompatibleCustomUrl?: string;
  megallmCustomUrl?: string;
  autocompleteSettings?: AutocompleteSettings;
}

const PROVIDER_BASE_URLS: Record<string, string> = {
  'anthropic': 'https://api.anthropic.com',
  'openai': 'https://api.openai.com',
  'openai-compatible': 'http://localhost:1234',
  'megallm': 'https://ai.megallm.io',
};

const SETTINGS_KEY = 'echode.autocompleteSettings';

export class AutocompleteService {
  private provider: AutocompleteProvider;
  private registration: vscode.Disposable | null = null;
  private statusBarItem: vscode.StatusBarItem;
  private typingTimer: NodeJS.Timeout | null = null;
  private textChangeListener: vscode.Disposable | null = null;
  private selectionChangeListener: vscode.Disposable | null = null;

  constructor(private context: vscode.ExtensionContext) {
    this.provider = new AutocompleteProvider();
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'echode.openSettings';
    context.subscriptions.push(this.statusBarItem);

    // Load saved settings on startup
    this.loadSavedSettings();
  }

  private loadSavedSettings(): void {
    const saved = this.context.globalState.get<ApiSettings>(SETTINGS_KEY);
    if (saved) {
      this.updateSettings(saved);
    }
  }

  private saveSettings(settings: ApiSettings): void {
    this.context.globalState.update(SETTINGS_KEY, settings);
  }

  updateSettings(settings: ApiSettings): void {
    // Save settings to persist across sessions
    this.saveSettings(settings);
    
    const autocomplete = settings.autocompleteSettings;
    
    if (!autocomplete?.enabled) {
      this.disable();
      return;
    }

    if (!autocomplete.model) {
      this.disable();
      return;
    }

    // Get API key for the selected provider
    const apiKey = this.getApiKeyForProvider(settings, autocomplete.provider);
    if (!apiKey) {
      this.disable();
      return;
    }

    // Get base URL for the selected provider
    const baseUrl = this.getBaseUrlForProvider(settings, autocomplete.provider);

    const config: AutocompleteConfig = {
      enabled: true,
      provider: autocomplete.provider,
      model: autocomplete.model,
      apiKey,
      baseUrl,
      debounceMs: autocomplete.debounceMs || 150,
      maxTokens: autocomplete.maxTokens || 128,
      temperature: autocomplete.temperature || 0.2,
    };

    this.provider.updateConfig(config);
    this.enable();
    this.updateStatusBar(config);
  }

  private getApiKeyForProvider(settings: ApiSettings, provider: string): string {
    switch (provider) {
      case 'anthropic':
        return settings.anthropicApiKey || settings.apiKey || '';
      case 'openai':
        return settings.openaiApiKey || settings.apiKey || '';
      case 'openai-compatible':
        return settings.openaiCompatibleApiKey || settings.apiKey || '';
      case 'megallm':
        return settings.megallmApiKey || settings.apiKey || '';
      default:
        return settings.apiKey || '';
    }
  }

  private getBaseUrlForProvider(settings: ApiSettings, provider: string): string {
    switch (provider) {
      case 'anthropic':
        return settings.anthropicCustomUrl || PROVIDER_BASE_URLS.anthropic;
      case 'openai':
        return settings.openaiCustomUrl || PROVIDER_BASE_URLS.openai;
      case 'openai-compatible':
        return settings.openaiCompatibleCustomUrl || PROVIDER_BASE_URLS['openai-compatible'];
      case 'megallm':
        return settings.megallmCustomUrl || PROVIDER_BASE_URLS.megallm;
      default:
        return PROVIDER_BASE_URLS['openai-compatible'];
    }
  }

  private enable(): void {
    // Only register if not already registered
    if (!this.registration) {
      try {
        this.registration = vscode.languages.registerInlineCompletionItemProvider(
          [{ scheme: 'file' }, { scheme: 'untitled' }],
          this.provider
        );
        this.context.subscriptions.push(this.registration);
      } catch (_error) {
        // Silently fail
      }
    }

    // Set up automatic triggering on text changes
    if (!this.textChangeListener) {
      this.textChangeListener = vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.contentChanges.length === 0) {
          return;
        }

        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document !== event.document) {
          return;
        }

        if (event.document.uri.scheme !== 'file' && event.document.uri.scheme !== 'untitled') {
          return;
        }

        this.scheduleTrigger();
      });
      this.context.subscriptions.push(this.textChangeListener);
    }

    // Also trigger on cursor movement (selection change)
    if (!this.selectionChangeListener) {
      this.selectionChangeListener = vscode.window.onDidChangeTextEditorSelection((event) => {
        const editor = event.textEditor;
        if (!editor) {
          return;
        }

        if (editor.document.uri.scheme !== 'file' && editor.document.uri.scheme !== 'untitled') {
          return;
        }

        // Only trigger if cursor actually moved (not just selection change)
        if (event.kind === vscode.TextEditorSelectionChangeKind.Command) {
          return; // Skip programmatic changes
        }

        this.scheduleTrigger();
      });
      this.context.subscriptions.push(this.selectionChangeListener);
    }
  }

  private scheduleTrigger(): void {
    if (this.typingTimer) {
      clearTimeout(this.typingTimer);
    }
    this.typingTimer = setTimeout(() => {
      void vscode.commands.executeCommand('editor.action.inlineSuggest.trigger');
    }, 400); // Wait 400ms after last action before triggering
  }

  private disable(): void {
    if (this.registration) {
      this.registration.dispose();
      this.registration = null;
    }
    if (this.textChangeListener) {
      this.textChangeListener.dispose();
      this.textChangeListener = null;
    }
    if (this.selectionChangeListener) {
      this.selectionChangeListener.dispose();
      this.selectionChangeListener = null;
    }
    if (this.typingTimer) {
      clearTimeout(this.typingTimer);
      this.typingTimer = null;
    }
    this.statusBarItem.hide();
  }

  private updateStatusBar(config: AutocompleteConfig): void {
    const modelShort = config.model.split('/').pop() || config.model;
    this.statusBarItem.text = `$(zap) ${modelShort}`;
    this.statusBarItem.tooltip = `Echode Autocomplete: ${config.model}`;
    this.statusBarItem.show();
  }

  dispose(): void {
    this.disable();
    this.provider.dispose();
    this.statusBarItem.dispose();
  }
}

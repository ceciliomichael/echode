import * as vscode from 'vscode';
import { getSettingsHtml, getMermaidPreviewHtml } from '../utils/html-generator';
import { handleApiRequest } from '../handlers/api-handler';
import { handleModelFetch } from '../handlers/model-fetching-handler';
import { getSettingsService } from '../services/settings-service';
import { handleMcpMessage, setupMcpStatusListener } from './handlers/mcp-handler';
import type { AutocompleteService } from '../autocomplete';

/**
 * Panel Manager
 * Manages settings panel, mermaid preview panels, and diff editor
 */
export class PanelManager {
  private _settingsPanel?: vscode.WebviewPanel;
  private _mermaidPanels = new Map<string, vscode.WebviewPanel>();

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _autocompleteService: AutocompleteService,
    private readonly _onSettingsSaved?: (settings: unknown) => void
  ) {}

  /**
   * Get the settings panel if it exists
   */
  public get settingsPanel(): vscode.WebviewPanel | undefined {
    return this._settingsPanel;
  }

  /**
   * Open settings panel (singleton - only one instance allowed)
   */
  public openSettingsPanel(): void {
    // If panel already exists, reveal it instead of creating a new one
    if (this._settingsPanel) {
      this._settingsPanel.reveal(vscode.ViewColumn.One);
      return;
    }

    // Create panel and immediately store reference to prevent race conditions
    this._settingsPanel = vscode.window.createWebviewPanel(
      'echodeSettings',
      'EchoDE Settings',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this._extensionUri, 'webview-ui', 'dist')
        ]
      }
    );

    const panel = this._settingsPanel;

    // Set extension icon for the tab
    panel.iconPath = vscode.Uri.joinPath(this._extensionUri, 'icon.svg');

    // Clear reference when panel is disposed
    const statusListener = setupMcpStatusListener(panel);
    panel.onDidDispose(() => {
      statusListener.dispose();
      this._settingsPanel = undefined;
    });

    panel.webview.html = getSettingsHtml(panel.webview, this._extensionUri);

    panel.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'saveSettings':
          // Notify main webview about settings saved
          this._onSettingsSaved?.(data.settings);
          // Update autocomplete service with new settings
          this._autocompleteService.updateSettings(data.settings);
          break;
        case 'closeSettings':
          panel.dispose();
          break;
        case 'apiRequest':
          await handleApiRequest(data, panel);
          break;
        case 'fetchModels':
          await handleModelFetch(data, panel);
          break;
        case 'getApiSettings':
          const settingsPanelSettings = getSettingsService().getSettings();
          panel.webview.postMessage({ type: 'apiSettingsLoaded', settings: settingsPanelSettings });
          break;
        case 'saveApiSettings':
          getSettingsService().saveSettings(data.settings);
          panel.webview.postMessage({ type: 'apiSettingsSaved' });
          break;
        case 'clearApiSettings':
          getSettingsService().clearSettings();
          panel.webview.postMessage({ type: 'apiSettingsCleared' });
          break;
        default:
          if (data.type && data.type.startsWith('mcp.')) {
            await handleMcpMessage(data, panel);
          }
          break;
      }
    });
  }

  /**
   * Open Mermaid preview panel
   */
  public openMermaidPreviewPanel(
    code: string,
    id: string | undefined,
    onClosed?: (id?: string) => void
  ): void {
    // If ID provided and panel exists, just reveal it
    if (id && this._mermaidPanels.has(id)) {
      this._mermaidPanels.get(id)?.reveal(vscode.ViewColumn.One);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'mermaidPreview',
      'Mermaid Preview',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: []
      }
    );

    // Store panel if ID provided
    if (id) {
      this._mermaidPanels.set(id, panel);
    }

    panel.iconPath = vscode.Uri.joinPath(this._extensionUri, 'icon.svg');
    panel.webview.html = getMermaidPreviewHtml(panel.webview, code);

    // Handle messages from the preview panel
    panel.webview.onDidReceiveMessage(async (data) => {
      if (data.type === 'saveMermaidSvg') {
        const uri = await vscode.window.showSaveDialog({
          filters: { 'SVG Images': ['svg'] },
          defaultUri: vscode.Uri.file('diagram.svg')
        });

        if (uri) {
          await vscode.workspace.fs.writeFile(uri, Buffer.from(data.svg));
          vscode.window.showInformationMessage('Diagram saved successfully!');
        }
      }
    });

    // Notify when panel is closed
    panel.onDidDispose(() => {
      if (id) {
        this._mermaidPanels.delete(id);
      }
      onClosed?.(id);
    });
  }

  /**
   * Open VSCode diff editor
   */
  public async openDiffEditor(oldContent: string, newContent: string, fileName: string): Promise<void> {
    // Create temporary documents for diff view
    const oldUri = vscode.Uri.parse(`echode-diff:${fileName}.old`);
    const newUri = vscode.Uri.parse(`echode-diff:${fileName}.new`);

    // Register text document content provider
    const provider = new class implements vscode.TextDocumentContentProvider {
      provideTextDocumentContent(uri: vscode.Uri): string {
        if (uri.path.endsWith('.old')) {
          return oldContent || '';
        }
        return newContent;
      }
    };

    const registration = vscode.workspace.registerTextDocumentContentProvider('echode-diff', provider);

    try {
      // Open diff editor
      await vscode.commands.executeCommand(
        'vscode.diff',
        oldUri,
        newUri,
        `${fileName} (Proposed Changes)`,
        { preview: true }
      );
    } finally {
      // Clean up after a delay to allow the diff to open
      setTimeout(() => registration.dispose(), 1000);
    }
  }

  /**
   * Dispose all panels
   */
  public dispose(): void {
    this._settingsPanel?.dispose();
    this._mermaidPanels.forEach(panel => panel.dispose());
    this._mermaidPanels.clear();
  }
}
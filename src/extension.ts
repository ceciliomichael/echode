import * as vscode from 'vscode';
import { EchodeSidebarProvider } from './sidebar-provider';
import { AutocompleteService } from './autocomplete';
import { clearGitignoreCache } from './utils/workspace-scanner';
import { clearListFilesGitignoreCache } from './services/tools/list-files-tool';
import { generateGitCommitMessage } from './services/git-commit-generator';
import { getGlobalServerManager } from './services/mcp/mcp-server-manager';
import { defaultRegistry } from './services/tools/tool-registry';
import { MarkdownViewerManager } from './services/markdown-viewer/markdown-viewer-manager';
import { isMarkdownPreviewableDocument } from './services/markdown-viewer/markdown-preview-utils';
import { ApprovalViewerManager } from './services/approval/approval-viewer-manager';
import { CreateSubAgentTool, UseSubAgentTool } from './services/tools';

export function activate(context: vscode.ExtensionContext) {
  // Initialize MCP Server Manager (uses ~/.echode/mcp/ for global config)
  getGlobalServerManager(defaultRegistry);

  // Initialize Markdown Viewer Manager (for all .md files with mermaid support)
  MarkdownViewerManager.initialize(context);

  // Initialize Approval Viewer Manager for Manual Mode
  ApprovalViewerManager.initialize(context);

  const autocompleteService = new AutocompleteService(context);
  const sidebarProvider = new EchodeSidebarProvider(context.extensionUri, context, autocompleteService);

  // Register sub-agent tools
  defaultRegistry.registerTool(new CreateSubAgentTool());
  defaultRegistry.registerTool(new UseSubAgentTool({
    openSubAgentPanel: async (session) => {
      await sidebarProvider.openSubAgentPanel(session);
    }
  }));

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      EchodeSidebarProvider.viewType,
      sidebarProvider,
      {
        webviewOptions: {
          retainContextWhenHidden: true
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('echode.newChat', () => {
      sidebarProvider.newChat();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('echode.parallelChat', () => {
      sidebarProvider.openParallelChat();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('echode.openHistory', () => {
      sidebarProvider.openHistoryPanel();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('echode.triggerAutocomplete', async () => {
      await vscode.commands.executeCommand('editor.action.inlineSuggest.trigger');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('echode.acceptNextWord', async () => {
      await vscode.commands.executeCommand('editor.action.inlineSuggest.acceptNextWord');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('echode.acceptNextLine', async () => {
      await vscode.commands.executeCommand('editor.action.inlineSuggest.acceptNextLine');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('echode.openSettings', () => {
      sidebarProvider.openSettingsPanel();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('echode.generateCommitMessage', async () => {
      await generateGitCommitMessage();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('echode.openPlanPreview', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage('Open a markdown file first to preview it.');
        return;
      }

      const document = editor.document;
      if (!isMarkdownPreviewableDocument(document)) {
        // Fallback for non-markdown context (the keybinding should prevent this)
        vscode.window.showInformationMessage('Markdown preview is only available for markdown files.');
        return;
      }

      // Use custom markdown viewer for markdown files (unified experience with Mermaid support)
      if (MarkdownViewerManager.isInitialized) {
        MarkdownViewerManager.instance.openTextDocument(document);
      } else {
        // Fallback to default markdown preview if manager not initialized
        await vscode.commands.executeCommand('markdown.showPreview', document.uri);
      }
    })
  );

  // Watch for .gitignore changes and clear caches
  const gitignoreWatcher = vscode.workspace.createFileSystemWatcher('**/.gitignore');

  const clearAllGitignoreCaches = () => {
    clearGitignoreCache();
    clearListFilesGitignoreCache();
    // Refresh the context indicator in the webview
    sidebarProvider.refreshWorkspaceContext();
  };

  gitignoreWatcher.onDidChange(clearAllGitignoreCaches);
  gitignoreWatcher.onDidCreate(clearAllGitignoreCaches);
  gitignoreWatcher.onDidDelete(clearAllGitignoreCaches);

  context.subscriptions.push(gitignoreWatcher);
}

export function deactivate() { }

import * as vscode from 'vscode';
import { EchodeSidebarProvider } from './sidebar-provider';
import { AutocompleteService } from './autocomplete';
import { clearGitignoreCache } from './utils/workspace-scanner';
import { clearListFilesGitignoreCache } from './services/tools/list-files-tool';
import { generateGitCommitMessage } from './services/git-commit-generator';
import { getGlobalServerManager } from './services/mcp/mcp-server-manager';
import { defaultRegistry } from './services/tools/tool-registry';

export function activate(context: vscode.ExtensionContext) {
  // Initialize MCP Server Manager with context for global storage access
  getGlobalServerManager(defaultRegistry, context);

  const autocompleteService = new AutocompleteService(context);
  const sidebarProvider = new EchodeSidebarProvider(context.extensionUri, context, autocompleteService);

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
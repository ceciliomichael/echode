import * as vscode from 'vscode';
import * as path from 'path';
import { EchodeSidebarProvider } from './sidebar-provider';
import { AutocompleteService } from './autocomplete';
import { clearGitignoreCache } from './utils/workspace-scanner';
import { clearListFilesGitignoreCache } from './services/tools/list-files-tool';
import { generateGitCommitMessage } from './services/git-commit-generator';
import { getGlobalServerManager } from './services/mcp/mcp-server-manager';
import { defaultRegistry } from './services/tools/tool-registry';
import { PlanViewerManager } from './services/plan-viewer/plan-viewer-manager';
import { ApprovalViewerManager } from './services/approval/approval-viewer-manager';

export function activate(context: vscode.ExtensionContext) {
  // Initialize MCP Server Manager with context for global storage access
  getGlobalServerManager(defaultRegistry, context);

  // Initialize Plan Viewer Manager
  PlanViewerManager.initialize(context);

  // Initialize Approval Viewer Manager for Manual Mode
  ApprovalViewerManager.initialize(context);

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

  context.subscriptions.push(
    vscode.commands.registerCommand('echode.openPlanPreview', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== 'markdown') {
        // Fallback for non-markdown context (though keybinding 'when' clause should prevent this)
        await vscode.commands.executeCommand('markdown.showPreview');
        return;
      }

      const document = editor.document;
      const filePath = document.uri.fsPath;
      const normalizedPath = filePath.replace(/\\/g, '/');
      
      // Check if this is an EchoDE plan or review file
      const isPlanFile = normalizedPath.includes('/.echode/plan/');
      const isReviewFile = normalizedPath.includes('/.echode/codereview/');

      if ((isPlanFile || isReviewFile) && PlanViewerManager.isInitialized) {
        const content = document.getText();
        // Extract title from first line (e.g. "# Title") or use filename
        const firstLine = content.split('\n')[0].trim();
        const title = firstLine.startsWith('#') 
          ? firstLine.replace(/^#+\s*/, '') 
          : path.basename(filePath);

        const docType = isReviewFile ? 'Review' : 'Plan';
        PlanViewerManager.instance.openPlan(title, content, filePath, docType);
      } else {
        // Fallback to default markdown preview for non-plan/review files
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
import * as vscode from 'vscode';
import { EchodeSidebarProvider } from './sidebar-provider';

export function activate(context: vscode.ExtensionContext) {
  const sidebarProvider = new EchodeSidebarProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      EchodeSidebarProvider.viewType,
      sidebarProvider
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
    vscode.commands.registerCommand('echode.openSettings', () => {
      sidebarProvider.openSettingsPanel();
    })
  );
}

export function deactivate() {}
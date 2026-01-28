import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ChatMessage } from '../llm/llm-provider.interface';
import { getWorkspaceRoot } from '../tools/utils/workspace-utils';
import { getGlobalWorkflowsDir } from '../../utils/workflow-paths';

/**
 * Resolve slash commands (/[command]) in messages with workflow file content.
 * This mutates the messages array in place.
 * 
 * Slash commands reference workflow files in .echode/workflows/<command>.md
 * Checks workspace first (if open), then falls back to global (~/.echode/workflows)
 */
export async function resolveSlashCommands(messages: ChatMessage[]): Promise<void> {
  const cwd = getWorkspaceRoot(); // May be undefined if no workspace open

  // Pattern to match slash commands: /[command-name]
  // Matches in various contexts:
  // - At start of string or after whitespace
  // - Inside quotes (common when user message is wrapped)
  // - Followed by whitespace, quotes, or end of string
  const slashCommandPattern = /(?:^|(?<=[\s"']))\/\[([a-zA-Z0-9_-]+)\](?=[\s"']|$)/g;

  for (const message of messages) {
    if (message.role !== 'user') {
      continue;
    }

    // Process string content
    if (typeof message.content === 'string') {
      message.content = await replaceSlashCommands(message.content, slashCommandPattern, cwd);
    } 
    // Process multimodal content (array of text/image parts)
    else if (Array.isArray(message.content)) {
      for (const part of message.content) {
        if (part.type === 'text' && part.text) {
          part.text = await replaceSlashCommands(part.text, slashCommandPattern, cwd);
        }
      }
    }
  }
}

/**
 * Replace all slash commands in text with their workflow file content
 * Checks workspace first (if available), then falls back to global workflows
 */
async function replaceSlashCommands(
  content: string, 
  pattern: RegExp, 
  cwd: string | null | undefined
): Promise<string> {
  // Reset regex state
  pattern.lastIndex = 0;
  
  const matches: Array<{ fullMatch: string; commandName: string; index: number }> = [];
  let match;
  
  // Collect all matches first
  while ((match = pattern.exec(content)) !== null) {
    matches.push({
      fullMatch: match[0],
      commandName: match[1], // The command name without /
      index: match.index
    });
  }
  
  console.log(`[SlashCommandResolver] Content: "${content.substring(0, 100)}...", Found ${matches.length} matches`);
  
  if (matches.length === 0) {
    return content;
  }
  
  // Process each match and replace (in reverse order to preserve indices)
  let result = content;
  for (const { fullMatch, commandName } of matches.reverse()) {
    let workflowText: string | null = null;
    
    // Try workspace first (if workspace is open)
    if (cwd) {
      const workspacePath = path.join(cwd, '.echode', 'workflows', `${commandName}.md`);
      try {
        const workflowUri = vscode.Uri.file(workspacePath);
        const workflowContent = await vscode.workspace.fs.readFile(workflowUri);
        workflowText = Buffer.from(workflowContent).toString('utf-8');
      } catch {
        // Workspace file not found, will try global next
      }
    }
    
    // Try global if workspace didn't have it
    if (!workflowText) {
      const globalDir = getGlobalWorkflowsDir();
      const globalPath = path.join(globalDir, `${commandName}.md`);
      console.log(`[SlashCommandResolver] Trying global path: ${globalPath}`);
      try {
        // Use native fs for global files to ensure reliability across platforms
        // and avoid potential workspace FS restrictions
        workflowText = await fs.promises.readFile(globalPath, 'utf-8');
        console.log(`[SlashCommandResolver] Successfully loaded workflow from: ${globalPath}`);
      } catch (error) {
        // Global file also not found
        console.error(`[SlashCommandResolver] Failed to read global workflow: ${globalPath}`, error);
      }
    }
    
    if (workflowText) {
      // Replace the slash command with the workflow content
      result = result.replace(fullMatch, workflowText);
    }
  }
  
  return result;
}
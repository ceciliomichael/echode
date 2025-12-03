import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

// Regex to match @mentions: @filename or @path/to/file
const mentionRegex = /@((?:[^\s@]|\\ )+)/g;

// Special mention types
const SPECIAL_MENTIONS = ['problems'] as const;
type SpecialMention = typeof SPECIAL_MENTIONS[number];

function isSpecialMention(mention: string): mention is SpecialMention {
  return SPECIAL_MENTIONS.includes(mention.toLowerCase() as SpecialMention);
}

// Maximum number of files to expand per message
const MAX_FILES_PER_MESSAGE = 10;

/**
 * Unescape spaces in a path (remove backslashes before spaces)
 */
function unescapeSpaces(pathStr: string): string {
  return pathStr.replace(/\\ /g, ' ');
}

/**
 * Get all files in workspace for path resolution
 */
async function getWorkspaceFiles(workspaceRoot: string): Promise<string[]> {
  const files: string[] = [];
  
  async function walkDir(dir: string, depth: number = 0): Promise<void> {
    if (depth > 10) {
      return; // Limit recursion depth
    }
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        // Skip common ignored directories (except .gitignore)
        if ((entry.name.startsWith('.') && entry.name !== '.gitignore') || 
            entry.name === 'node_modules' || 
            entry.name === 'dist' ||
            entry.name === 'build' ||
            entry.name === '__pycache__') {
          continue;
        }
        
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(workspaceRoot, fullPath).replace(/\\/g, '/');
        
        if (entry.isDirectory()) {
          await walkDir(fullPath, depth + 1);
        } else {
          files.push(relativePath);
        }
      }
    } catch {
      // Ignore errors (permission denied, etc.)
    }
  }
  
  await walkDir(workspaceRoot);
  return files;
}

/**
 * Parse mentions from text and resolve to full paths
 * @param text - The text containing @mentions
 * @param workspaceFiles - Optional list of workspace files for path resolution
 */
export function parseMentions(text: string, workspaceFiles?: string[]): string[] {
  const mentions: string[] = [];
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    const mentionText = unescapeSpaces(match[1]);
    
    // Check special mentions first (e.g., @problems)
    if (isSpecialMention(mentionText)) {
      mentions.push(mentionText);
      continue;
    }

    // If it looks like a path (contains /), use as-is
    if (mentionText.includes('/')) {
      mentions.push(mentionText);
    } else if (workspaceFiles) {
      // Try to find matching file by basename
      const matchingFile = workspaceFiles.find(f => {
        const basename = f.split('/').pop() || f;
        return basename.toLowerCase() === mentionText.toLowerCase();
      });
      
      // Only add if we found a real file match - ignore random @words like @echo
      if (matchingFile) {
        mentions.push(matchingFile);
      }
    } else {
      mentions.push(mentionText);
    }
  }
  mentionRegex.lastIndex = 0;

  return mentions;
}

/**
 * Expand mentions in text by resolving file paths
 * Returns the text with mentions replaced by resolved paths
 */
export async function expandMentions(text: string, workspaceRoot: string): Promise<string> {
  // Get workspace files for path resolution
  const workspaceFiles = await getWorkspaceFiles(workspaceRoot);
  const mentions = parseMentions(text, workspaceFiles);
  
  if (mentions.length === 0) {
    return text;
  }

  // Separate special mentions from file mentions
  const specialMentions: string[] = [];
  const fileMentions: string[] = [];
  
  for (const mention of mentions) {
    if (isSpecialMention(mention)) {
      specialMentions.push(mention);
    } else {
      fileMentions.push(mention);
    }
  }

  // Limit number of files
  const mentionsToProcess = fileMentions.slice(0, MAX_FILES_PER_MESSAGE);
  const contentBlocks: string[] = [];
  const resolvedPaths = new Map<string, string>(); // original mention -> resolved path

  // Handle special mentions first
  for (const specialMention of specialMentions) {
    if (specialMention.toLowerCase() === 'problems') {
      const problemsContent = getProblemsContent(workspaceRoot);
      contentBlocks.push(`<problems>\n${problemsContent}\n</problems>`);
    }
  }

  // Handle file/folder mentions
  for (const mentionPath of mentionsToProcess) {
    // Resolve to absolute path
    const absolutePath = path.resolve(workspaceRoot, mentionPath);

    // Security check: ensure path is within workspace
    if (!absolutePath.startsWith(workspaceRoot)) {
      continue;
    }

    // Store resolved path for text replacement
    const basename = mentionPath.split('/').pop() || mentionPath;
    resolvedPaths.set(basename.toLowerCase(), mentionPath);
  }

  // Replace @mentions with references
  let expandedText = text.replace(/@((?:[^\s@]|\\ )+)/g, (_match, mention) => {
    const unescapedMention = unescapeSpaces(mention);
    
    // Handle special mentions
    if (isSpecialMention(unescapedMention)) {
      return `special '${unescapedMention}' (details shown below)`;
    }
    
    // Look up resolved path for file mentions
    const resolvedPath = resolvedPaths.get(unescapedMention.toLowerCase());
    if (resolvedPath) {
      return resolvedPath;
    }
    
    // Not a valid file mention, keep original text (e.g., @echo stays as @echo)
    return _match;
  });

  // Append content blocks
  if (contentBlocks.length > 0) {
    expandedText += '\n\n' + contentBlocks.join('\n\n');
  }

  // Add note if some file mentions were skipped
  if (fileMentions.length > MAX_FILES_PER_MESSAGE) {
    expandedText += `\n\n[Note: Only first ${MAX_FILES_PER_MESSAGE} file mentions were expanded. ${fileMentions.length - MAX_FILES_PER_MESSAGE} mentions were skipped.]`;
  }

  return expandedText;
}

/**
 * Get the workspace root path
 */
export function getWorkspaceRoot(): string | undefined {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
    return workspaceFolders[0].uri.fsPath;
  }
  return undefined;
}

/**
 * Get VS Code diagnostics (problems) for the workspace
 */
function getProblemsContent(workspaceRoot: string): string {
  const diagnostics = vscode.languages.getDiagnostics();
  const problems: string[] = [];
  
  for (const [uri, fileDiagnostics] of diagnostics) {
    // Only include files in the workspace
    if (!uri.fsPath.startsWith(workspaceRoot)) {
      continue;
    }
    
    const relativePath = path.relative(workspaceRoot, uri.fsPath).replace(/\\/g, '/');
    
    for (const diagnostic of fileDiagnostics) {
      // Only include errors and warnings
      if (diagnostic.severity !== vscode.DiagnosticSeverity.Error && 
          diagnostic.severity !== vscode.DiagnosticSeverity.Warning) {
        continue;
      }
      
      const severity = diagnostic.severity === vscode.DiagnosticSeverity.Error ? 'Error' : 'Warning';
      const line = diagnostic.range.start.line + 1;
      const col = diagnostic.range.start.character + 1;
      const message = diagnostic.message.replace(/\n/g, ' ').trim();
      const source = diagnostic.source ? ` [${diagnostic.source}]` : '';
      
      problems.push(`${relativePath}:${line}:${col} - ${severity}${source}: ${message}`);
    }
  }
  
  if (problems.length === 0) {
    return 'No errors or warnings found in the workspace.';
  }
  
  // Limit to first 50 problems
  const truncated = problems.length > 50;
  const displayProblems = problems.slice(0, 50);
  
  let content = displayProblems.join('\n');
  if (truncated) {
    content += `\n\n... and ${problems.length - 50} more problems`;
  }
  
  return content;
}

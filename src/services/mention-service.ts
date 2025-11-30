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

// Maximum file content size to include (in characters)
const MAX_FILE_CONTENT_CHARS = 50000;

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
        // Skip common ignored directories
        if (entry.name.startsWith('.') || 
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
    
    // If it looks like a path (contains /), use as-is
    if (mentionText.includes('/')) {
      mentions.push(mentionText);
    } else if (workspaceFiles) {
      // Try to find matching file by basename
      const matchingFile = workspaceFiles.find(f => {
        const basename = f.split('/').pop() || f;
        return basename.toLowerCase() === mentionText.toLowerCase();
      });
      mentions.push(matchingFile || mentionText);
    } else {
      mentions.push(mentionText);
    }
  }
  mentionRegex.lastIndex = 0;

  return mentions;
}

/**
 * Read file content with size limits
 */
async function readFileContent(filePath: string): Promise<{ content: string; truncated: boolean }> {
  try {
    const stat = await fs.stat(filePath);
    
    // Check if it's a directory
    if (stat.isDirectory()) {
      const entries = await fs.readdir(filePath, { withFileTypes: true });
      const contents = entries
        .slice(0, 100) // Limit directory listing
        .map(entry => {
          const type = entry.isDirectory() ? '[dir]' : '[file]';
          return `${type} ${entry.name}`;
        })
        .join('\n');
      
      return {
        content: contents + (entries.length > 100 ? '\n... (truncated)' : ''),
        truncated: entries.length > 100,
      };
    }

    // Read file content
    const content = await fs.readFile(filePath, 'utf-8');
    
    if (content.length > MAX_FILE_CONTENT_CHARS) {
      return {
        content: content.slice(0, MAX_FILE_CONTENT_CHARS) + '\n... (truncated)',
        truncated: true,
      };
    }

    return { content, truncated: false };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: `Error reading file: ${errorMessage}`,
      truncated: false,
    };
  }
}

/**
 * Expand mentions in text by appending file contents
 * Returns the expanded text with file content blocks appended
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
      contentBlocks.push(`<file_content path="${mentionPath}">\nError: Path is outside workspace\n</file_content>`);
      continue;
    }

    const { content, truncated } = await readFileContent(absolutePath);
    const truncatedNote = truncated ? ' (truncated)' : '';
    
    // Check if it's a directory based on the mention path
    const isDirectory = mentionPath.endsWith('/');
    const tag = isDirectory ? 'folder_content' : 'file_content';
    
    contentBlocks.push(`<${tag} path="${mentionPath}"${truncatedNote}>\n${content}\n</${tag}>`);
    
    // Store resolved path for text replacement
    const basename = mentionPath.split('/').pop() || mentionPath;
    resolvedPaths.set(basename.toLowerCase(), mentionPath);
  }

  // Replace @mentions with references
  let expandedText = text.replace(/@((?:[^\s@]|\\ )+)/g, (_match, mention) => {
    const unescapedMention = unescapeSpaces(mention);
    
    // Handle special mentions
    if (isSpecialMention(unescapedMention)) {
      return `'${unescapedMention}' (see below)`;
    }
    
    // Look up resolved path for file mentions
    const resolvedPath = resolvedPaths.get(unescapedMention.toLowerCase()) || unescapedMention;
    return `'${resolvedPath}' (see below for content)`;
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

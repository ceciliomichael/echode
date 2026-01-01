import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getWorkspaceFiles } from '../../utils/workspace-scanner';
import { getGlobalWorkflowsDir } from '../../utils/workflow-paths';

/**
 * Search Handler
 * Handles file and folder search for @ mentions
 */

export interface SearchResult {
  path: string;
  type: 'file' | 'folder' | 'workflow';
  label?: string;
  description?: string;
}

interface SearchData {
  query?: string;
  searchType?: 'file' | 'folder' | 'all';
}

interface WorkflowSearchData {
  query?: string;
}

/**
 * Get all unique folder paths from workspace files
 */
function extractFolders(files: string[]): Set<string> {
  const folders = new Set<string>();
  
  for (const file of files) {
    const parts = file.split('/');
    let currentPath = '';
    
    // Build up folder paths (exclude the file itself)
    for (let i = 0; i < parts.length - 1; i++) {
      currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
      folders.add(currentPath);
    }
  }
  
  return folders;
}

/**
 * Case-insensitive search matching
 */
function matchesQuery(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.toLowerCase());
}

/**
 * Handle file/folder search requests
 */
export async function handleSearchFiles(
  data: SearchData,
  webview: vscode.WebviewView
): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  
  if (!workspaceFolders || workspaceFolders.length === 0) {
    webview.webview.postMessage({ 
      type: 'fileSearchResults', 
      results: [] 
    });
    return;
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;
  const query = (data.query || '').trim();
  const searchType = data.searchType || 'file';

  try {
    // Get all workspace files (respects .gitignore)
    const allFiles = getWorkspaceFiles(workspaceRoot);
    
    let results: SearchResult[] = [];

    if (searchType === 'folder' || searchType === 'all') {
      // Extract all unique folder paths
      const folders = extractFolders(allFiles);
      
      // Filter folders by query
      const folderResults = Array.from(folders)
        .filter(folderPath => {
          if (!query) {
            return true;
          }
          // Match against folder name or full path
          const folderName = path.basename(folderPath);
          return matchesQuery(folderName, query) || matchesQuery(folderPath, query);
        })
        .slice(0, 20)
        .map(folderPath => ({
          path: folderPath,
          type: 'folder' as const,
          label: path.basename(folderPath)
        }));

      if (searchType === 'folder') {
        results = folderResults;
      } else {
        // searchType === 'all': include both files and folders
        const fileResults = allFiles
          .filter(filePath => {
            if (!query) {
              return true;
            }
            const fileName = path.basename(filePath);
            return matchesQuery(fileName, query) || matchesQuery(filePath, query);
          })
          .slice(0, 20)
          .map(filePath => ({
            path: filePath,
            type: 'file' as const,
            label: path.basename(filePath)
          }));

        // Prioritize files over folders
        results = [...fileResults, ...folderResults].slice(0, 30);
      }
    } else {
      // searchType === 'file'
      results = allFiles
        .filter(filePath => {
          if (!query) {
            return true;
          }
          const fileName = path.basename(filePath);
          return matchesQuery(fileName, query) || matchesQuery(filePath, query);
        })
        .slice(0, 20)
        .map(filePath => ({
          path: filePath,
          type: 'file' as const,
          label: path.basename(filePath)
        }));
    }

    webview.webview.postMessage({ 
      type: 'fileSearchResults', 
      results 
    });
  } catch (error) {
    console.error('[SearchHandler] Error searching files:', error);
    webview.webview.postMessage({ 
      type: 'fileSearchResults', 
      results: [] 
    });
  }
}

/**
 * Handle workflow search requests for slash commands
 * Scans .echode/workflows/*.md files from both workspace and global directories
 */
export async function handleSearchWorkflows(
  data: WorkflowSearchData,
  webview: vscode.WebviewView
): Promise<void> {
  const query = (data.query || '').trim().toLowerCase();
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const workspaceRoot = workspaceFolders?.[0]?.uri.fsPath;

  try {
    const allResults: SearchResult[] = [];
    const seenNames = new Set<string>();

    // 1. Search workspace workflows (if workspace is open)
    if (workspaceRoot) {
      const workflowPattern = new vscode.RelativePattern(
        workspaceRoot,
        '.echode/workflows/*.md'
      );
      
      const workflowFiles = await vscode.workspace.findFiles(workflowPattern, null, 50);
      
      for (const file of workflowFiles) {
        const relativePath = path.relative(workspaceRoot, file.fsPath);
        const fileName = path.basename(file.fsPath, '.md');
        seenNames.add(fileName);
        allResults.push({
          path: relativePath,
          type: 'workflow' as const,
          label: fileName,
          description: `/[${fileName}]`
        });
      }
    }

    // 2. Search global workflows (~/.echode/workflows)
    const globalDir = getGlobalWorkflowsDir();
    try {
      const globalFiles = await fs.promises.readdir(globalDir);
      for (const file of globalFiles) {
        if (file.endsWith('.md')) {
          const fileName = path.basename(file, '.md');
          // Skip if already found in workspace (workspace takes priority)
          if (!seenNames.has(fileName)) {
            allResults.push({
              path: path.join(globalDir, file),
              type: 'workflow' as const,
              label: fileName,
              description: `/[${fileName}] (global)`
            });
          }
        }
      }
    } catch {
      // Global directory might not exist, ignore
    }

    // Filter by query and limit results
    const filteredResults = allResults
      .filter(result => {
        if (!query) return true;
        return result.label?.toLowerCase().includes(query) ?? false;
      })
      .slice(0, 30);

    webview.webview.postMessage({ 
      type: 'workflowSearchResults', 
      results: filteredResults 
    });
  } catch (error) {
    console.error('[SearchHandler] Error searching workflows:', error);
    webview.webview.postMessage({ 
      type: 'workflowSearchResults', 
      results: [] 
    });
  }
}
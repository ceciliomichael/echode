/**
 * Diagnostics Fetcher Module
 * 
 * Fetches diagnostics for files modified by tool operations.
 * This ensures the AI receives immediate feedback about errors after edits.
 */

import { executeToolViaExtension } from '../../lib/tool-utils';

/**
 * Tools that modify files and should trigger diagnostics fetch
 */
const FILE_MODIFYING_TOOLS = new Set([
  'write_to_file',
  'edit',
  'delete',
]);

/**
 * Extract file paths from tool results that modified files
 */
export function extractModifiedFilePaths(toolResults: string[]): string[] {
  const modifiedPaths: string[] = [];
  
  for (const result of toolResults) {
    // Two possible formats:
    // 1) "Tool: edit\nPath: src/file.ts\n..."
    // 2) "[edit] src/file.ts → APPLIED"

    const toolHeaderMatch = result.match(/^Tool: (write_to_file|edit|delete)/);
    if (toolHeaderMatch) {
      const pathMatch = result.match(/Path: ([^\n]+)/);
      if (pathMatch && pathMatch[1]) {
        const filePath = pathMatch[1].trim();
        if (!modifiedPaths.includes(filePath)) {
          modifiedPaths.push(filePath);
        }
      }
      continue;
    }

    const bracketMatch = result.match(/^\[(write_to_file|edit|delete)\]\s+(.+?)\s+→/);
    if (bracketMatch) {
      const filePath = bracketMatch[2].trim();
      if (!modifiedPaths.includes(filePath)) {
        modifiedPaths.push(filePath);
      }
    }
  }
  
  return modifiedPaths;
}

/**
 * Check if any tool results contain file-modifying operations
 */
export function hasFileModifyingTools(toolResults: string[]): boolean {
  return toolResults.some(result => {
    for (const tool of FILE_MODIFYING_TOOLS) {
      if (result.startsWith(`Tool: ${tool}`) || result.startsWith(`[${tool}]`)) {
        return true;
      }
    }
    return false;
  });
}

/**
 * Fetch diagnostics for modified files via the extension
 * Returns formatted diagnostics text for the AI
 */
export async function fetchDiagnosticsForModifiedFiles(
  modifiedPaths: string[]
): Promise<string> {
  if (modifiedPaths.length === 0) {
    return '';
  }
  
  try {
    // Fetch diagnostics for each modified file
    const diagnosticsResults: string[] = [];
    
    for (const filePath of modifiedPaths) {
      const result = await executeToolViaExtension('get_diagnostics', {
        path: filePath,
      });
      
      if (result.success && result.data) {
        const data = result.data as {
          files?: Array<{
            filePath: string;
            diagnostics: Array<{
              line: number;
              character: number;
              severity: string;
              message: string;
              source?: string;
              code?: string | number;
            }>;
          }>;
          totalDiagnostics?: number;
        };
        
        // Only include if there are actual diagnostics
        if (data.files && data.files.length > 0 && data.totalDiagnostics && data.totalDiagnostics > 0) {
          for (const file of data.files) {
            if (file.diagnostics.length > 0) {
              const fileHeader = `File: ${file.filePath}`;
              const diagnosticLines = file.diagnostics.map(d => {
                const location = `L${d.line}:${d.character}`;
                const codeInfo = d.code ? ` [${d.code}]` : '';
                const sourceInfo = d.source ? ` (${d.source})` : '';
                return `  ${d.severity}: ${location} - ${d.message}${codeInfo}${sourceInfo}`;
              });
              diagnosticsResults.push(`${fileHeader}\n${diagnosticLines.join('\n')}`);
            }
          }
        }
      }
    }
    
    if (diagnosticsResults.length === 0) {
      return '';
    }
    
    return diagnosticsResults.join('\n\n');
  } catch (error) {
    // Don't fail the continuation if diagnostics fetch fails
    console.warn('[DiagnosticsFetcher] Failed to fetch diagnostics:', error);
    return '';
  }
}

/**
 * Main function: Extract modified files from tool results and fetch their diagnostics
 */
export async function getDiagnosticsForToolResults(
  toolResults: string[]
): Promise<string> {
  // Check if any file-modifying tools were used
  if (!hasFileModifyingTools(toolResults)) {
    return '';
  }
  
  // Extract the paths of modified files
  const modifiedPaths = extractModifiedFilePaths(toolResults);
  
  if (modifiedPaths.length === 0) {
    return '';
  }
  
  // Fetch diagnostics for those files
  return fetchDiagnosticsForModifiedFiles(modifiedPaths);
}